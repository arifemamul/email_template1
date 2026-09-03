// Guards the cuts to the game screen: no sound BUTTON, no word counter, and nothing between
// levels that has to be dismissed - while checking that the pronunciation those cuts nearly
// took with them is intact, and that every word found is still spoken aloud.
import { launch, PAGE, BUILT } from './harness.mjs';
import { readFileSync } from 'fs';
const problems = [];
const src = readFileSync(BUILT, 'utf8');

for (const [needle, what] of [
  ['id="sound"', 'the sound button'],
  ['drawSound', 'the sound button state function'],
  ['Speech.toggle', 'a mute toggle'],
  ['shobdojot.sound', 'a stored sound preference'],
  ['levelSub', 'the word counter element'],
]) if (src.includes(needle)) problems.push(`page still contains ${what} ("${needle}")`);

// CLEAR_BEAT used to be forbidden here: the between-level pause was cut on the grounds that a
// child should not be made to wait, and this file held it out. That was reversed by a bug
// report from an iPhone - with no pause the finished board was on screen for about no frames
// at all, so nobody ever saw the word they had just found. A hold is now required rather than
// banned, and `advancetest` owns how long it must be. What this file still guards is the thing
// that was actually wrong with the old pause: a card, a countdown, a button to press.
for (const [needle, what] of [
  ['SHOW_CLEARED', 'the hold that lets a finished board be seen'],
]) if (!src.includes(needle)) problems.push(`page is missing ${what} ("${needle}")`);

// The pronunciation itself stays - only its button went. These must be present.
for (const [needle, what] of [
  ['const Speech', 'the pronunciation engine'],
  ['Speech.say(word)', 'the call that speaks a word as it lands'],
  ['Speech.init()', 'the voice pick at startup'],
  ['VOICE_CLIPS', 'the recorded-clip table'],
]) if (!src.includes(needle)) problems.push(`page is missing ${what} ("${needle}")`);

const b = await launch();
const ctx = await b.newContext({ viewport: { width: 360, height: 640 } });
const p = await ctx.newPage();
p.on('pageerror', e => problems.push('page error: ' + e.message));
// If anything still tries to speak, fail loudly rather than silently.
// A fake Bengali voice, so the real refusal path (no bn voice -> silence) does not hide
// whether the game tried to speak at all. Records every utterance.
await p.addInitScript(() => {
  window.__said = [];
  const voice = { lang: 'bn-BD', name: 'Test Bengali', default: true };
  const fake = {
    getVoices: () => [voice],
    speak(u) { window.__said.push(u.text); },
    cancel() {},
    addEventListener() {},
  };
  // speechSynthesis is a read-only accessor on window, so plain assignment is silently
  // dropped - which is exactly how this check passed while testing nothing.
  Object.defineProperty(window, 'speechSynthesis',
    { configurable: true, get: () => fake });
  Object.defineProperty(window, 'SpeechSynthesisUtterance',
    { configurable: true, writable: true, value: function (text) { this.text = text; } });
});
await p.goto(PAGE);
await p.waitForFunction(() => document.querySelector('.tile'));

// -- the actions row is hint + shuffle, nothing else --------------------------------------
const actions = await p.evaluate(() =>
  [...document.querySelectorAll('.actions .action')].map(a => a.id));
if (actions.join(',') !== 'hint,shuffle')
  problems.push(`actions row is [${actions}], expected [hint,shuffle]`);

// -- the top bar holds the two arrows and the level's letter between them -----------------
// It held a word counter once ("২/৬"), and that is what had to go: a child watching a score
// tick is not reading. The letter is the opposite - it says which part of the alphabet this
// is - so what is checked here is that the letter is present and the counter has not returned.
const bar = await p.evaluate(() => {
  const top = document.querySelector('.topbar');
  const kids = [...top.children];
  const text = top.textContent.replace(/[‹›\s]/g, '');
  return { ids: kids.map(k => k.id || k.className), text, letter: LEVELS[game.index].name };
});
if (bar.ids.join(',') !== 'prev,levelName,next') problems.push(`top bar holds [${bar.ids}]`);
if (!bar.text.startsWith(bar.letter))
  problems.push(`top bar shows "${bar.text}", expected it to start with ${bar.letter}`);
if (/[\d০-৯]+\s*\/\s*[\d০-৯]+/.test(bar.text))
  problems.push(`a word counter is back in the top bar: "${bar.text}"`);

// -- no "n / m words" anywhere on the game screen ----------------------------------------
const counter = await p.evaluate(() => {
  const t = document.querySelector('.screen').textContent;
  return /শব্দ\s*$|[০-৯\d]\s*\/\s*[০-৯\d]/.test(t) ? t.slice(0, 80) : null;
});
if (counter) problems.push(`a word count is still on screen: "${counter}"`);

// -- solving the last word moves on with no wait -----------------------------------------
const trace = async (word) => {
  const path = await p.evaluate(w => {
    const HAS='্', COMB=new Set(['ঁ','ং','ঃ','়','া','ি','ী','ু','ূ','ৃ','ৄ','ে','ৈ','ো','ৌ','ৗ','ৢ','ৣ',HAS]);
    const split=s=>{const u=[];let c='',j=false;for(const ch of s){if(COMB.has(ch)){c+=ch;j=ch===HAS;}else if(j){c+=ch;j=false;}else{if(c)u.push(c);c=ch;}}if(c)u.push(c);return u;};
    const tiles=[...document.querySelectorAll('.tile')]; const used=new Set();
    return split(w).map(a=>{const i=tiles.findIndex((t,k)=>!used.has(k)&&t.textContent===a);
      if(i<0) return null; used.add(i);
      const r=tiles[i].getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2];});
  }, word);
  if (path.some(x => !x)) { problems.push(`no tile for part of "${word}"`); return false; }
  await p.mouse.move(...path[0]); await p.mouse.down();
  for (const c of path.slice(1)) await p.mouse.move(c[0], c[1], { steps: 6 });
  await p.mouse.up();
  return true;
};

await p.evaluate(() => loadLevel(0));
await p.waitForTimeout(60);
const words = await p.evaluate(() => game.puzzle.words.map(w => w.word));
for (const w of words.slice(0, -1)) { if (!await trace(w)) break; await p.waitForTimeout(240); }
const wasOn = await p.evaluate(() => game.index);
await trace(words.at(-1));
// The letters take ~450ms to land and the finished board is then held for SHOW_CLEARED, so the
// next level is up inside three seconds - with nothing to dismiss on the way.
await p.waitForFunction(i => game.index === i + 1, wasOn, { timeout: 3000 }).catch(() => {});
const now = await p.evaluate(() => ({ index: game.index, blank: (game.found[LEVELS[game.index].id] || []).length }));
if (now.index !== wasOn + 1) problems.push(`did not advance: still on level ${now.index + 1} after 3s`);
if (now.blank !== 0) problems.push(`next level did not arrive blank (${now.blank} words already found)`);

// Every word found should have been spoken, at the rate meant for a learner.
const said = await p.evaluate(() => window.__said);
for (const w of words) if (!said.includes(w)) problems.push(`"${w}" was found but never spoken`);
if (said.length < words.length)
  problems.push(`only ${said.length} of ${words.length} words were spoken`);

// -- and the refusal: an English-only device says nothing at all --------------------------
// This is the line that matters most. speechSynthesis will read Bengali text in an English
// voice without complaining, and a child copying that learns the wrong sounds.
{
  const ctx2 = await b.newContext({ viewport: { width: 360, height: 640 } });
  const q = await ctx2.newPage();
  await q.addInitScript(() => {
    window.__said = [];
    const fake = {
      getVoices: () => [{ lang: 'en-US', name: 'English', default: true }],
      speak(u) { window.__said.push(u.text); },
      cancel() {}, addEventListener() {},
    };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, get: () => fake });
    Object.defineProperty(window, 'SpeechSynthesisUtterance',
      { configurable: true, writable: true, value: function (text) { this.text = text; } });
  });
  await q.goto(PAGE);
  await q.waitForFunction(() => document.querySelector('.tile'));
  const spoke = await q.evaluate(() => {
    const w = game.puzzle.words[0].word;
    Speech.say(w);
    return window.__said;
  });
  if (spoke.length) problems.push(`spoke Bengali through an English voice: ${JSON.stringify(spoke)}`);
}

// ---- hearing it again --------------------------------------------------------------------
// A word is spoken once, as it lands - which is also the moment a child is watching letters fly
// rather than listening. So the letter this level is about and any word already found can be
// pressed to hear again. Both are silent, and must not look pressable, on a device with no
// Bengali voice and no recordings: something that invites a press and then says nothing teaches
// a child that pressing things does nothing.
{
  const q = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await q.goto(PAGE);
  await q.waitForFunction(() => document.querySelector('.tile'));

  // A word has to be found before any cell could invite a press, so find one first. Asking at
  // load time asked nothing: there were no candidate cells yet, and the check passed against a
  // build that marked every found cell whether the device could speak or not.
  const mute = await q.evaluate(async () => {
    const word = LEVELS[0].words[0];
    loadLevel(0);
    game.picked = splitAksharas(word).map(a => game.wheel.indexOf(a));
    submitWord();
    await new Promise(r => setTimeout(r, 600));
    return {
      available: Speech.available,
      found: (game.found[LEVELS[0].id] || []).length,
      chip: document.getElementById('levelName').classList.contains('says'),
      cells: document.querySelectorAll('.cell.says').length,
      gold: document.querySelectorAll('.cell.on').length,
    };
  });
  if (!mute.found) problems.push('the silent case never found a word, so it tested nothing');
  if (!mute.gold) problems.push('no cell was filled in, so there was nothing that could speak');
  if (mute.available)
    problems.push('this browser has a Bengali voice, so the silent case went untested');
  if (mute.chip) problems.push('the letter chip invites a press on a device that cannot speak');
  if (mute.cells) problems.push(`${mute.cells} cells invite a press on a device that cannot speak`);

  const heard = await q.evaluate(async () => {
    // A voice, and a `say` that records instead of speaking.
    Speech.voice = { lang: 'bn-BD', name: 'test' };
    const said = [];
    const rates = [];
    Speech.say = (t, o = {}) => { said.push(t); rates.push(o.rate ?? Speech.RATE); return true; };
    loadLevel(0);
    drawHud();
    const chipBefore = document.getElementById('levelName').classList.contains('says');

    const word = LEVELS[0].words[0];
    game.picked = splitAksharas(word).map(a => game.wheel.indexOf(a));
    submitWord();
    await new Promise(r => setTimeout(r, 600));

    const chip = document.getElementById('levelName');
    chip.click();
    const said1 = said.length;
    // Every cell of the found word says that word, and no cell of an unfound one says anything.
    const saying = [...document.querySelectorAll('.cell.says')];
    saying.forEach(c => c.click());
    const unfound = [...document.querySelectorAll('.cell:not(.blank):not(.says)')].length;

    return {
      chipBefore, chipAfter: chip.classList.contains('says'),
      chipLabel: chip.getAttribute('aria-label'),
      chipSaid: said[said1 - 1],
      letter: LEVELS[0].name,
      word, cells: saying.length, aksharas: splitAksharas(word).length,
      cellLabels: [...new Set(saying.map(c => c.getAttribute('aria-label')))],
      fromCells: said.slice(said1), unfound,
      focusable: saying.every(c => c.getAttribute('tabindex') === '0'),
      // Asking to hear something a second time is asking to hear it properly, so a press is
      // slower than the moment the word landed.
      landedAt: rates[0], againAt: rates.slice(1), RATE: Speech.RATE, AGAIN: Speech.AGAIN,
    };
  });

  if (!heard.chipBefore || !heard.chipAfter)
    problems.push('the letter chip does not invite a press once there is a voice');
  if (heard.chipSaid !== heard.letter)
    problems.push(`pressing the chip said "${heard.chipSaid}", expected "${heard.letter}"`);
  if (!heard.chipLabel || !heard.chipLabel.startsWith(heard.letter))
    problems.push(`the chip is labelled "${heard.chipLabel}", which does not name its letter`);
  if (heard.cells !== heard.aksharas)
    problems.push(`${heard.cells} cells say the word, expected ${heard.aksharas} - one per akshara`);
  if (heard.cellLabels.length !== 1 || !heard.cellLabels[0].startsWith(heard.word))
    problems.push(`the found word's cells are labelled ${JSON.stringify(heard.cellLabels)}`);
  if (heard.fromCells.some(x => x !== heard.word))
    problems.push(`a cell of "${heard.word}" said something else: ${JSON.stringify(heard.fromCells)}`);
  if (!heard.unfound)
    problems.push('every cell on the board says something; an unfound word must stay quiet');
  if (!heard.focusable) problems.push('a cell that speaks cannot be reached from a keyboard');
  if (heard.landedAt !== heard.RATE)
    problems.push(`a word landed at rate ${heard.landedAt}, expected ${heard.RATE}`);
  if (heard.againAt.some(r => r !== heard.AGAIN))
    problems.push(`a replayed press used ${JSON.stringify(heard.againAt)}, expected ${heard.AGAIN}`);
  if (!(heard.AGAIN < heard.RATE))
    problems.push(`pressing to hear again (${heard.AGAIN}) is not slower than landing (${heard.RATE})`);
  // Below about 0.4 a speechSynthesis voice stops sounding slow and starts sounding broken.
  if (heard.AGAIN < 0.4)
    problems.push(`${heard.AGAIN} is slow enough to distort the voice into a word nobody says`);
  if (heard.RATE > 0.6)
    problems.push(`${heard.RATE} is a native-speed run at a word, not a learner's pace`);
  console.log(`again: the chip says "${heard.chipSaid}", and ${heard.cells} cells say `
            + `"${heard.word}" - ${heard.unfound} cells of unfound words stay quiet; `
            + `landing ${heard.RATE}, pressed ${heard.AGAIN}`);
  await q.close();
}

await b.close();
if (problems.length) { console.log('PROBLEMS:'); problems.forEach(x => console.log(' - ' + x)); process.exitCode = 1; }
else console.log(`QUIET: no sound button, no word counter, no pause - and all ${words.length} words spoken`);
