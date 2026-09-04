/*
 * Every Bengali WORD on screen can be heard, and no letter can.
 *
 * The game speaks a word as it lands, and `quiettest` guards that. This file guards the rest of
 * the app - the guide's few hundred example words, one per row of the sign table, the বারোখড়ি,
 * the কার lists, the ফলা and যুক্তবর্ণ tables - and the line those words are on the right side
 * of.
 *
 * Because the letters used to be pressable too, and are not any more. Every chart tile, every
 * বারোখড়ি form, every কার pair, every ফলা and যুক্তবর্ণ shape, all 244 level tiles, the chip at
 * the top of the screen and every tile on the wheel said their own letter when pressed. A
 * synthesised voice reading a lone Bengali letter is wrong too often to teach with - ই and উ
 * come back as the letters' names, a bare consonant arrives with a vowel nobody asked for - and
 * the mistakes land precisely on what this game is for. An app that mispronounces the alphabet
 * to a child learning the alphabet is worse than one that says nothing there.
 *
 * So four things are checked, and the middle two are the ones worth having:
 *
 *   1. Each section still carries words that can be heard, and every word it offers is a word
 *      the game actually holds.
 *   2. Nothing that shows a letter is pressable - by selector, one per kind, so a mark added
 *      back to any chart fails here.
 *   3. A press says the pressed word, slowly, and lights up; a tap on the wheel says nothing
 *      while a drag still says the word it spells.
 *   4. On a device with no Bengali voice, none of it looks pressable and none of it speaks.
 */
import { launch, PAGE, openSection, report } from './harness.mjs';

const problems = [];
const b = await launch();

/* A Bengali voice that records instead of speaking, installed before the page runs so that
   `Speech.init` finds it on the first pick rather than on a `voiceschanged` that never comes. */
const withVoice = async (voices) => {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 950 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => problems.push('page error: ' + e.message));
  await p.addInitScript(list => {
    window.__said = [];
    const fake = {
      getVoices: () => list,
      speak(u) { window.__said.push({ text: u.text, rate: u.rate }); },
      cancel() {}, addEventListener() {},
    };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, get: () => fake });
    Object.defineProperty(window, 'SpeechSynthesisUtterance',
      { configurable: true, writable: true, value: function (t) { this.text = t; } });
  }, voices);
  await p.goto(PAGE);
  await p.waitForFunction(() => document.querySelector('.tile'));
  return p;
};

const BENGALI = [{ lang: 'bn-BD', name: 'Test Bengali', default: true }];
const p = await withVoice(BENGALI);

if (!(await p.evaluate(() => document.body.classList.contains('cansay'))))
  problems.push('a Bengali voice is present and the page does not know it (no .cansay on body)');

/* -- 1. every section still carries words that can be heard ------------------------------ */
/* Counts, not exact numbers: these tables are built from the level list and the primer, and a
   test that hardcoded them would fail the next time a word was added. What matters is that no
   section went silent when the letters did. */
const SECTIONS = ['barnamala', 'gathon', 'phala', 'jukto'];
const counts = {};
for (const key of SECTIONS) {
  await openSection(p, key);
  counts[key] = await p.evaluate(k =>
    document.querySelectorAll(`#page-${k} [data-say]`).length, key);
  if (!counts[key]) problems.push(`no word in the ${key} section can be heard`);
}
console.log('words that can be heard: ' + SECTIONS.map(k => `${k} ${counts[k]}`).join(', '));

/* -- 2. nothing that shows a letter is pressable ------------------------------------------ */
/*
 * One selector per kind of letter on screen. Named rather than inferred, because "is this a
 * letter" is not a thing a test can ask of a string: খৈ is one akshara and also a real word in
 * the বারোখড়ি table, so the rule has to be about which part of the page an element is, not
 * about how long its text is.
 */
const LETTERS = {
  '.ch': 'a chart tile',
  '.pair': 'a কার pair',
  '.mk-g': 'a sign in the mark table',
  '.bp': 'the বারোখড়ি letter picker',
  '.br-f': 'a বারোখড়ি form',
  '.eq-l': 'a letter in a word sum',
  '.kp': 'the কার picker',
  '.ph-f': 'a ফলা form',
  '.jp': 'the যুক্তবর্ণ picker',
  '.jr-f': 'a যুক্তবর্ণ form',
  '.lv': 'a level tile',
  '.now-letter': "the level's own chip",
};
for (const key of ['barnamala', 'gathon', 'phala', 'jukto', 'levels']) await openSection(p, key);
const marked = await p.evaluate(kinds => {
  const out = {};
  for (const sel of Object.keys(kinds)) {
    out[sel] = {
      seen: document.querySelectorAll(sel).length,
      says: document.querySelectorAll(`${sel}[data-say], ${sel} [data-say]`).length,
    };
  }
  return out;
}, LETTERS);
for (const [sel, what] of Object.entries(LETTERS)) {
  if (!marked[sel].seen) problems.push(`${what} (${sel}) is not on the page, so this checked nothing`);
  if (marked[sel].says)
    problems.push(`${what} (${sel}) can be pressed to speak - ${marked[sel].says} of them; `
                + 'a lone letter is not spoken any more');
}
console.log('letters on screen and silent: '
  + Object.keys(LETTERS).map(s => `${s} ${marked[s].seen}`).join(' '));

/* -- and every word offered is a word the game holds -------------------------------------- */
/*
 * The failure this catches is a mark wired to the wrong string - a table row whose word column
 * shows বাড়ি and whose `data-say` came from the row above. Checked against the game's own three
 * sources of words rather than against a list here: the boards; PRIMER, which holds the word
 * sums and the কার, ফলা and যুক্তবর্ণ lists transcribed from a printed primer; and KAR_WORDS,
 * which fills the বারোখড়ি forms no board reaches.
 */
const strays = await p.evaluate(() => {
  const real = new Set();
  for (const lv of LEVELS) for (const w of lv.words) real.add(w);
  for (const v of Object.values(KAR_WORDS)) real.add(v.w);
  for (const group of ['two', 'three']) for (const parts of PRIMER[group]) real.add(parts.join(''));
  for (const list of Object.values(PRIMER.byKar)) for (const w of list) real.add(w);
  for (const ph of PRIMER.phala) for (const w of ph.words) real.add(w);
  for (const jk of PRIMER.jukto) for (const w of jk.words) real.add(w);
  return [...document.querySelectorAll('[data-say]')]
    .map(el => ({ say: el.dataset.say, text: el.textContent.trim(), cls: el.className }))
    .filter(x => !real.has(x.say) || !x.text.includes(x.say))
    .slice(0, 5);
});
if (strays.length)
  problems.push(`something says what it does not show, or is not a word in the game: `
              + JSON.stringify(strays));

/* -- 3. a press says the pressed word, slowly, and lights up ------------------------------ */
await openSection(p, 'jukto');
const pressed = await p.evaluate(async () => {
  const chip = document.querySelector('#page-jukto [data-say]');
  window.__said.length = 0;
  chip.click();
  await new Promise(r => requestAnimationFrame(r));
  return {
    say: chip.dataset.say,
    said: window.__said.map(u => u.text),
    rate: window.__said.length ? window.__said[0].rate : null,
    glow: chip.classList.contains('saying'),
    AGAIN: Speech.AGAIN, RATE: Speech.RATE,
  };
});
if (pressed.said.length !== 1 || pressed.said[0] !== pressed.say)
  problems.push(`pressing ${pressed.say} said ${JSON.stringify(pressed.said)}`);
if (pressed.rate !== pressed.AGAIN)
  problems.push(`a pressed word spoke at ${pressed.rate}, expected ${pressed.AGAIN}`);
if (!(pressed.AGAIN < pressed.RATE))
  problems.push(`pressing to hear (${pressed.AGAIN}) is not slower than a word landing (${pressed.RATE})`);
if (!pressed.glow) problems.push('a word said nothing visible - no .saying while it speaks');
console.log(`pressed ${pressed.say}: said "${pressed.said[0]}" at ${pressed.rate}, and lit up`);

/* -- a keyboard can reach the ones that are not buttons ----------------------------------- */
await openSection(p, 'phala');
const reach = await p.evaluate(() =>
  [...document.querySelectorAll('#page-phala [data-say]')]
    .filter(el => el.tagName !== 'BUTTON')
    .map(el => ({ tab: el.getAttribute('tabindex'), role: el.getAttribute('role') })));
if (!reach.length) problems.push('the ফলা tables have no marked spans, so this checked nothing');
if (reach.some(x => x.tab !== '0' || x.role !== 'button'))
  problems.push('a word that speaks cannot be reached or pressed from a keyboard');

/* -- the wheel: silent to a tap, and the word to a drag ----------------------------------- */
/*
 * A tap on a tile used to say its letter. It does not any more, for the reason at the top of
 * this file - and the drag has to keep working, because the word it spells is the one thing the
 * game does say.
 */
// Back to the board: the guide has been open since the first section, and the wheel is under it.
if (await p.isVisible('#guideClose')) await p.click('#guideClose');
await p.waitForSelector('.guide.open', { state: 'hidden' }).catch(() => {});
/*
 * Back to the top of the document before aiming at the wheel: `page.click` scrolls its target
 * into view, and by now the guide column is several screens tall, so the last of those clicks
 * leaves the game scrolled off the top - the wheel at a negative y, where a real mouse cannot
 * go. Then wait until every tile is both on screen and hit-testable where it is drawn: closing
 * the guide re-lays out the screen and a ResizeObserver redraws the wheel 60ms later, so for a
 * moment the tiles are painted in one place and matched against another.
 */
await p.evaluate(() => { window.scrollTo(0, 0); loadLevel(0); });
await p.waitForFunction(() => [...document.querySelectorAll('.tile')].every((t, i) => {
  const r = t.getBoundingClientRect();
  const [x, y] = [r.left + r.width / 2, r.top + r.height / 2];
  return x > 0 && y > 0 && x < innerWidth && y < innerHeight && tileAt(x, y) === i;
}));

/* Real mouse input, not synthesised events: `pointerdown` on the wheel calls
   `setPointerCapture`, and a PointerEvent built by hand carries a pointerId the browser has
   never seen, so the call throws and the rest of the handler never runs. */
const centre = async i => {
  const box = await p.locator('.tile').nth(i).boundingBox();
  return [box.x + box.width / 2, box.y + box.height / 2];
};
const path = await p.evaluate(() => {
  const word = LEVELS[0].words[0];
  return { word, tiles: splitAksharas(word).map(a => game.wheel.indexOf(a)) };
});

await p.evaluate(() => { window.__said.length = 0; });
const [tx, ty] = await centre(0);
await p.mouse.move(tx, ty);
await p.mouse.down();
await p.mouse.up();
await p.waitForTimeout(120);
const tap = await p.evaluate(() => ({
  said: window.__said.map(u => u.text),
  picked: game.picked.length,          // the tap still put a letter on the shelf
  letter: game.wheel[0],
}));
if (tap.said.length) problems.push(`tapping a tile said ${JSON.stringify(tap.said)}, expected silence`);
if (!tap.picked) problems.push('tapping a tile no longer selects it, so this tested nothing');

// The tap left its letter on the shelf and a drag from there would spell that plus the word.
// That is the game working - a tap keeps the selection on purpose - so clear it first.
await p.evaluate(() => {
  game.picked = []; game.tapMode = false; markTiles(); drawTrail(); drawPreview();
  window.__said.length = 0;
});
for (const [n, i] of path.tiles.entries()) {
  const [x, y] = await centre(i);
  await p.mouse.move(x, y);
  if (n === 0) await p.mouse.down();
}
await p.mouse.up();
await p.waitForTimeout(300);
const dragged = await p.evaluate(() => window.__said.map(u => u.text));
if (!dragged.includes(path.word))
  problems.push(`dragging out "${path.word}" said ${JSON.stringify(dragged)} instead`);
if (dragged.some(t => t !== path.word))
  problems.push(`dragging out "${path.word}" also said ${JSON.stringify(dragged)}`);
console.log(`wheel: a tap says nothing and still picks "${tap.letter}", `
          + `a drag says only "${path.word}"`);

/* -- 4. and none of it, on a device with no Bengali voice --------------------------------- */
const mute = await withVoice([{ lang: 'en-US', name: 'English', default: true }]);
const quiet = await mute.evaluate(async () => {
  const word = document.querySelector('[data-say]');
  window.__said.length = 0;
  if (word) word.click();
  await new Promise(r => requestAnimationFrame(r));
  return {
    cansay: document.body.classList.contains('cansay'),
    available: Speech.available,
    said: window.__said.length,
    glow: document.querySelectorAll('.saying').length,
    marked: document.querySelectorAll('[data-say]').length,
  };
});
if (quiet.available || quiet.cansay)
  problems.push('this browser has a Bengali voice, so the silent case went untested');
if (quiet.said) problems.push(`${quiet.said} things were spoken with no Bengali voice`);
if (quiet.glow) problems.push('something lit up as if speaking on a device that cannot speak');
if (!quiet.marked) problems.push('nothing is marked at all, so the silent case tested nothing');
console.log(`silent: ${quiet.marked} words marked, none of them pressable-looking, none spoken`);

await b.close();
report(problems, `HEARING: words can be heard and letters cannot - `
  + SECTIONS.map(k => `${k} ${counts[k]}`).join(', '));
