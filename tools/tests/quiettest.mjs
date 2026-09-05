/*
 * Guards the cuts to the game screen: no sound button, no word counter, and nothing between
 * levels that has to be dismissed - and now the biggest cut of all, which is that the game
 * does not speak.
 *
 * There was a pronunciation layer here: every word spoken as it landed, any found word or
 * guide word pressable to hear again, through the device's own Bengali voice. It is gone. The
 * voices available on a phone say Bengali wrongly often enough that a child copying them would
 * learn the wrong sounds from the app meant to teach them, and there is no way to check from
 * inside the app which voice a device will hand over. Recordings by a person will replace it;
 * until they exist the game is silent about words.
 *
 * The game's own SOUNDS stay - the tone as a word lands, the bird, the confetti, the page
 * turn. Those are synthesised in 06-sound.js, they say nothing in any language, and they are
 * what makes a five-year-old want the next board. `feeltest` owns them.
 *
 * So the check here is a spy rather than a search: `speechSynthesis` and `Audio` are replaced
 * with recorders, a whole level is played through by dragging real words out of the wheel, and
 * nothing may reach either of them.
 */
import { launch, PAGE, BUILT } from './harness.mjs';
import { readFileSync } from 'fs';
const problems = [];
const src = readFileSync(BUILT, 'utf8');

for (const [needle, what] of [
  ['id="sound"', 'the sound button'],
  ['drawSound', 'the sound button state function'],
  ['shobdojot.sound', 'a stored sound preference'],
  ['levelSub', 'the word counter element'],
  // The pronunciation layer, by every name it had. Left in as a search as well as a spy: a
  // half-removed Speech object that nothing calls yet is how this comes back by accident.
  ['const Speech', 'the pronunciation engine'],
  ['VOICE_CLIPS', 'the recorded-clip table'],
  ['SpeechSynthesisUtterance', 'a call into the browser\'s speech engine'],
  ['speechSynthesis', 'the browser\'s speech engine'],
  ['const Talk', 'the press-to-hear layer'],
  ['data-say', 'a word marked to be spoken'],
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

const b = await launch();
const ctx = await b.newContext({ viewport: { width: 360, height: 640 } });
const p = await ctx.newPage();
p.on('pageerror', e => problems.push('page error: ' + e.message));
/*
 * The spy. A Bengali voice is offered, so a page that still wanted to speak would find one -
 * silence here has to be the page's choice and not the browser's refusal. Every utterance and
 * every audio file is recorded instead of played.
 *
 * `speechSynthesis` is a read-only accessor on window, so plain assignment is silently dropped;
 * that is exactly how an earlier version of this check passed while testing nothing.
 */
await p.addInitScript(() => {
  window.__said = [];
  window.__played = [];
  const voice = { lang: 'bn-BD', name: 'Test Bengali', default: true };
  const fake = {
    getVoices: () => [voice],
    speak(u) { window.__said.push(u && u.text); },
    cancel() {},
    addEventListener() {},
  };
  Object.defineProperty(window, 'speechSynthesis',
    { configurable: true, get: () => fake });
  Object.defineProperty(window, 'SpeechSynthesisUtterance',
    { configurable: true, writable: true, value: function (text) { this.text = text; } });
  // Recordings would arrive through Audio rather than through the speech engine, so it is
  // watched too - a clip table pasted back in has to fail here as loudly as a voice call.
  const RealAudio = window.Audio;
  window.Audio = function (src) { window.__played.push(src); return new RealAudio(); };
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

/*
 * A whole level played through, and neither recorder caught anything.
 *
 * This is the check that matters. A Bengali voice was on offer the entire time, six words were
 * dragged out of the wheel and landed on the board, one of them cleared the level - every
 * moment the game used to speak at - and the page never asked to say a word or play a file.
 */
const heard = await p.evaluate(() => ({ said: window.__said, played: window.__played }));
if (heard.said.length)
  problems.push(`the game spoke ${heard.said.length} time(s): ${JSON.stringify(heard.said)}`);
if (heard.played.length)
  problems.push(`the game played ${heard.played.length} audio file(s): `
              + JSON.stringify(heard.played.map(x => String(x).slice(0, 40))));

/*
 * Nor is there anything left on the board inviting a press to hear it: every cell of every
 * found word used to be a button, with a role, a tabindex and a label saying আবার শুনুন.
 *
 * Asked with a found word actually on the board. Clearing the level advanced the game to the
 * next one, whose board is blank - so asking here without going back would be asking about a
 * board with no found words on it, which is a check that passes against anything. An earlier
 * version of this file made exactly that mistake and a deliberate sabotage walked straight
 * past it.
 */
await p.evaluate(() => loadLevel(0));
await p.waitForTimeout(80);
const firstWord = await p.evaluate(() => game.puzzle.words[0].word);
await trace(firstWord);
await p.waitForTimeout(700);
const inviting = await p.evaluate(w => ({
  found: (game.found[LEVELS[game.index].id] || []).length,
  lit: document.querySelectorAll('.cell.on').length,
  cells: document.querySelectorAll('.cell[role="button"], .cell[tabindex]').length,
  chip: document.getElementById('levelName').getAttribute('role'),
  anywhere: document.querySelectorAll('[data-say]').length,
}), firstWord);
if (!inviting.found || !inviting.lit)
  problems.push('no word was found on the board, so nothing could have invited a press');
if (inviting.cells) problems.push(`${inviting.cells} board cells still invite a press to hear`);
if (inviting.chip) problems.push("the level's letter chip still invites a press");
if (inviting.anywhere) problems.push(`${inviting.anywhere} things are still marked to be spoken`);

// And the game's own sounds are still there - they are not what went. Synthesised, so nothing
// reaches Audio; what proves they exist is the audio graph 06-sound.js builds on first use.
const noise = await p.evaluate(() => ({
  sfx: typeof Sfx === 'object' && typeof Sfx.good === 'function',
  bird: typeof Bird === 'object',
  ctx: !!(Sfx && Sfx.ctx),
}));
if (!noise.sfx) problems.push('the game lost its sound effects along with the voice');
if (!noise.bird) problems.push('the bird is gone');
if (!noise.ctx) problems.push('nothing ever opened an audio context, so no sound was made');
console.log(`silent about words: ${words.length} words found and cleared, `
          + `0 spoken, 0 audio files - and the game's own sounds still play`);

await b.close();
if (problems.length) { console.log('PROBLEMS:'); problems.forEach(x => console.log(' - ' + x)); process.exitCode = 1; }
else console.log('QUIET: no sound button, no word counter, no pause, and not one word spoken');
