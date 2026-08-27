// Guards the cuts to the game screen: no sound BUTTON, no word counter, no pause between
// levels - while checking that the pronunciation those cuts nearly took with them is intact,
// and that every word found is still spoken aloud.
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
  ['CLEAR_BEAT', 'the between-level pause constant'],
]) if (src.includes(needle)) problems.push(`page still contains ${what} ("${needle}")`);

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
// the fly animation is ~450ms; by 800ms the next level must already be up, with no beat after it
await p.waitForTimeout(800);
const now = await p.evaluate(() => ({ index: game.index, blank: (game.found[LEVELS[game.index].id] || []).length }));
if (now.index !== wasOn + 1) problems.push(`did not advance: still on level ${now.index + 1} after 800ms`);
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

await b.close();
if (problems.length) { console.log('PROBLEMS:'); problems.forEach(x => console.log(' - ' + x)); process.exitCode = 1; }
else console.log(`QUIET: no sound button, no word counter, no pause - and all ${words.length} words spoken`);
