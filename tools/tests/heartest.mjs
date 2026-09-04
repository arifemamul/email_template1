/*
 * Every Bengali letter and every Bengali word on screen can be heard.
 *
 * The game speaks a word as it lands, and `quiettest` guards that. This file guards the rest of
 * the app: two alphabet charts, the কার pairs, the sign table, the বারোখড়ি, the primer's
 * equations and কার words, every ফলা and যুক্তবর্ণ form, the 244-letter level grid, and the
 * wheel a child taps. A chart of shapes a learner cannot pronounce is a chart of shapes.
 *
 * Three things are checked, and the third is the one worth having:
 *
 *   1. Each section really does carry things marked to be heard.
 *   2. Pressing one says its own text, slowly, and lights up while it does.
 *   3. On a device with no Bengali voice, none of it looks pressable and none of it lights up.
 *      Speech.say refuses to read Bengali with an English voice, so anything that looked
 *      pressable there would be a promise the app cannot keep.
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

/* -- every section carries letters and words that can be heard --------------------------- */
/* Counts, not exact numbers: the tables are built from the level list and the primer, and a
   test that hardcoded 43 letters would fail the next time a word was added. What matters is
   that no section is silent. */
const SECTIONS = ['barnamala', 'gathon', 'phala', 'jukto', 'levels'];
const counts = {};
for (const key of SECTIONS) {
  await openSection(p, key);
  counts[key] = await p.evaluate(k =>
    document.querySelectorAll(`#page-${k} [data-say]`).length, key);
  if (!counts[key]) problems.push(`nothing in the ${key} section can be heard`);
}
console.log('marked to be heard: '
  + SECTIONS.map(k => `${k} ${counts[k]}`).join(', '));

/* Both charts must be complete - eleven vowels and thirty-two consonants, including the three
   with no level of their own. ঙ is exactly the letter a child will never reach by playing. The
   two charts are one section now, so they are counted by chart rather than by page. */
await openSection(p, 'barnamala');
const chart = await p.evaluate(() => ({
  vowels: document.querySelectorAll('#chartVowels [data-say]').length,
  consonants: document.querySelectorAll('#chartConsonants [data-say]').length,
}));
if (chart.vowels !== 11) problems.push(`${chart.vowels} vowels can be heard, expected 11`);
if (chart.consonants !== 32)
  problems.push(`${chart.consonants} consonants can be heard, expected 32`);

/* -- what a marked thing says is its own text -------------------------------------------- */
/*
 * The failure this catches is a table row whose glyph column shows কা and whose `data-say` was
 * wired to the row's example word, so pressing কা says বাড়ি. Every marked element must say
 * something its own text contains, or contain what it says - the second case is the level grid,
 * where ম ২ is a button about the game and ম is the Bengali in it.
 */
await openSection(p, 'barnamala');
const mismatched = await p.evaluate(() =>
  [...document.querySelectorAll('#page-barnamala [data-say], #page-levels [data-say]')]
    .map(el => ({ say: el.dataset.say, text: el.textContent.trim() }))
    .filter(x => !x.text.includes(x.say) && !x.say.includes(x.text))
    .slice(0, 5));
if (mismatched.length)
  problems.push(`something says words it does not show: ${JSON.stringify(mismatched)}`);

/* The কার pairs are the deliberate exception, and the reason the rule is written as it is: the
   pair shows a vowel and a drawn sign, and pressing it must give the vowel's sound. */
const pairs = await p.evaluate(() =>
  [...document.querySelectorAll('#karPairs .pair')].map(el => el.dataset.say));
if (pairs.length !== 10) problems.push(`${pairs.length} কার pairs can be heard, expected 10`);
if (pairs.some(v => !v || /[ঁ-ঃা-্]/.test(v)))
  problems.push(`a কার pair says a mark rather than its vowel: ${JSON.stringify(pairs)}`);

/* -- pressing one says it, slowly, and lights up ----------------------------------------- */
await openSection(p, 'barnamala');
const pressed = await p.evaluate(async () => {
  const tile = document.querySelector('#chartConsonants .ch');
  window.__said.length = 0;
  tile.click();
  await new Promise(r => requestAnimationFrame(r));
  return {
    say: tile.dataset.say,
    said: window.__said.map(u => u.text),
    rate: window.__said.length ? window.__said[0].rate : null,
    glow: tile.classList.contains('saying'),
    AGAIN: Speech.AGAIN, RATE: Speech.RATE,
  };
});
if (pressed.said.length !== 1 || pressed.said[0] !== pressed.say)
  problems.push(`pressing ${pressed.say} said ${JSON.stringify(pressed.said)}`);
if (pressed.rate !== pressed.AGAIN)
  problems.push(`a pressed letter spoke at ${pressed.rate}, expected ${pressed.AGAIN}`);
if (!(pressed.AGAIN < pressed.RATE))
  problems.push(`pressing to hear (${pressed.AGAIN}) is not slower than a word landing (${pressed.RATE})`);
if (!pressed.glow) problems.push('a letter said nothing visible - no .saying while it speaks');
console.log(`pressed ${pressed.say}: said "${pressed.said[0]}" at ${pressed.rate}, and lit up`);

/* -- a keyboard can reach the ones that are not buttons ---------------------------------- */
await openSection(p, 'barnamala');
const reach = await p.evaluate(() =>
  [...document.querySelectorAll('#page-barnamala [data-say]')]
    .filter(el => el.tagName !== 'BUTTON')
    .map(el => ({ tab: el.getAttribute('tabindex'), role: el.getAttribute('role') })));
if (!reach.length) problems.push('the বর্ণমালা section has no marked spans, so this checked nothing');
if (reach.some(x => x.tab !== '0' || x.role !== 'button'))
  problems.push('something that speaks cannot be reached or pressed from a keyboard');

/* -- the wheel: a tap says its letter, a drag spells a word ------------------------------- */
/*
 * Both halves matter. A tap is a child putting a finger on a tile and looking at it, and that
 * is where they meet every letter in the game. A drag sweeps four tiles on the way to a word,
 * and four letters each cutting off the last is a stutter, not a lesson.
 */
// Back to the board: the guide has been open since the first section, and the wheel is under it.
if (await p.isVisible('#guideClose')) await p.click('#guideClose');
await p.waitForSelector('.guide.open', { state: 'hidden' }).catch(() => {});
/*
 * Back to the top of the document before aiming at the wheel.
 *
 * `page.click` scrolls its target into view, and this file opens eight sections before it gets
 * here - বর্ণমালা alone is now three charts and the বারোখড়ি, so the guide column is several
 * screens tall and the last of those clicks leaves the game scrolled off the top. The wheel was
 * then at a negative y, where a real mouse cannot go: the press landed nowhere and the test
 * reported that a tap says nothing.
 */
await p.evaluate(() => { window.scrollTo(0, 0); loadLevel(0); });

/*
 * Wait for the wheel to stop moving before aiming at it.
 *
 * Closing the guide re-lays out the screen, and a ResizeObserver redraws the wheel 60ms later.
 * `tileAt` does not read the DOM - it matches a press against `tileCentres`, computed when the
 * wheel was last drawn - so between the layout change and that redraw the tiles are on screen
 * in one place and hit-tested in another, and a press lands on nothing. This test failed one
 * run in two on exactly that, which is a flaky test rather than a flaky game. So: wait until
 * the two agree, and then take the aim point from `tileCentres` itself.
 */
/* And wait until every tile is both on screen and hit-testable where it is drawn: closing the
   guide re-lays out the screen, and a ResizeObserver redraws the wheel 60ms later, so for a
   moment the tiles are painted in one place and matched against another. */
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
await p.waitForTimeout(80);
const tap = await p.evaluate(() => window.__said.map(u => ({ text: u.text, rate: u.rate })));
const first = await p.evaluate(() => game.wheel[0]);

// The tap above left its letter on the shelf, and a drag from there spells র + the word.
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

if (tap.length !== 1 || tap[0].text !== first)
  problems.push(`tapping a tile said ${JSON.stringify(tap)}, expected "${first}"`);
if (tap.length && tap[0].rate !== pressed.AGAIN)
  problems.push(`a tapped tile spoke at ${tap[0].rate}, expected ${pressed.AGAIN}`);
// The word, and nothing else: a drag past three tiles must not say three letters first.
if (!dragged.includes(path.word))
  problems.push(`dragging out "${path.word}" said ${JSON.stringify(dragged)} instead`);
if (dragged.some(t => t !== path.word))
  problems.push(`dragging out "${path.word}" also said ${JSON.stringify(dragged)}`);
console.log(`wheel: a tap says "${tap[0] && tap[0].text}", a drag says only "${path.word}"`);

/* -- and none of it, on a device with no Bengali voice ----------------------------------- */
const mute = await withVoice([{ lang: 'en-US', name: 'English', default: true }]);
const quiet = await mute.evaluate(async () => {
  const tile = document.querySelector('#levelGrid .lv');
  window.__said.length = 0;
  tile.click();
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
console.log(`silent: ${quiet.marked} things marked, none of them pressable-looking, none spoken`);

await b.close();
report(problems, `HEARING: every letter and word can be heard - `
  + SECTIONS.map(k => `${k} ${counts[k]}`).join(', '));
