/*
 * The redesign: sound, the bird, and the rule that keeps the palette in one file.
 *
 * None of this is behaviour a player can fail at, which is exactly why it needs a test. A
 * silent sound engine, a bird that never reacts, or a hard-coded colour that survives the next
 * repaint are all invisible to every other check in this directory - the game still solves,
 * still fits, still speaks. They are only visible if something looks for them.
 *
 * Sound is checked by spying rather than by listening. Playwright has no ears, and asserting
 * that an AudioContext was constructed proves nothing about whether the right event made the
 * right noise. So `Sfx.note` is wrapped before the page runs and every call is recorded, which
 * turns "does tapping a tile make a sound" into a question with an answer.
 */
import { launch, PAGE, REPO, report } from './harness.mjs';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const problems = [];

// ---- the palette lives in one file ------------------------------------------------------
// theme.css says so in its own comment. This is what makes that true rather than aspirational.
// White is light, and `rgba(var(--role), a)` is a role taken at some strength - a shadow, a
// halo - which is still the palette speaking. Both describe how a surface is lit rather than
// what it is made of, so both are allowed anywhere. A literal channel triple is not.
const cssDir = join(REPO, 'src/css');
for (const file of readdirSync(cssDir).filter(f => f.endsWith('.css') && f !== 'theme.css')) {
  const body = readFileSync(join(cssDir, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const hex = (body.match(/#[0-9a-fA-F]{3,8}\b/g) || []).filter(h => !/^#(fff|ffffff)$/i.test(h));
  const rgb = (body.match(/rgba?\([^)]*\)/g) || [])
    .filter(c => !c.includes('var(--') && !/^rgba?\(\s*255\s*,\s*255\s*,\s*255/.test(c));
  if (hex.length) problems.push(`${file} names ${hex.length} colours: ${hex.slice(0, 4).join(' ')}`);
  if (rgb.length) problems.push(`${file} has ${rgb.length} raw rgb(): ${rgb.slice(0, 2).join(' ')}`);
}

const b = await launch();
const ctx = await b.newContext({ viewport: { width: 400, height: 820 } });
const p = await ctx.newPage();
p.on('pageerror', e => problems.push('pageerror: ' + e.message));
p.on('console', m => { if (m.type() === 'error') problems.push('console: ' + m.text()); });

// Record every note the game asks for, and stub the audio itself so nothing has to exist.
await p.addInitScript(() => {
  window.__notes = [];
  const install = () => {
    if (typeof Sfx === 'undefined') return false;
    // Guarded: this runs from an interval AND from `load`, and wrapping the wrapper made every
    // note record twice - which read exactly like the game double-firing its own sounds.
    if (Sfx.__wrapped) return true;
    Sfx.__wrapped = true;
    const real = Sfx.note.bind(Sfx);
    Sfx.note = (freq, dur, type, gain, delay, bend) => {
      window.__notes.push({ freq: Math.round(freq), type, muted: Sfx.muted });
      try { real(freq, dur, type, gain, delay, bend); } catch {}
    };
    return true;
  };
  // The engine is defined partway down one long script, so the wrap has to wait for it.
  const t = setInterval(() => { if (install()) clearInterval(t); }, 5);
  addEventListener('load', () => { install(); clearInterval(t); });
});
await p.goto(PAGE);
await p.waitForFunction(() => document.querySelector('.tile') && typeof Sfx !== 'undefined');

// ---- the engine is real, and silent until it is needed ----------------------------------
const engine = await p.evaluate(() => ({
  muted: Sfx.muted,
  built: Sfx.ctx !== null,
  scale: Sfx.SCALE.length,
  // No audio file anywhere in the page - the whole point of synthesising it.
  audioBytes: /data:audio|\.mp3|\.ogg|\.wav|\.opus"/.test(document.documentElement.innerHTML),
}));
if (engine.built) problems.push('an AudioContext was built before any gesture - iOS will suspend it forever');
if (engine.scale < 5) problems.push(`the scale has ${engine.scale} notes`);
if (engine.muted) problems.push('sound is muted on a first visit');

// ---- every game event makes its own sound ------------------------------------------------
const noteCount = () => p.evaluate(() => window.__notes.length);
const since = async (n) => (await p.evaluate(() => window.__notes)).slice(n);

let n = await noteCount();
await p.click('.tile');
await p.waitForTimeout(60);
let heard = await since(n);
if (!heard.length) problems.push('tapping a tile made no sound');

// A word being traced should climb: each tile a higher note than the last.
await p.evaluate(() => { game.picked = []; markTiles(); window.__notes = []; });
const word = await p.evaluate(() => game.puzzle.words[0].word);
await p.evaluate(w => {
  const tiles = [...document.querySelectorAll('.tile')];
  const used = new Set();
  for (const a of splitAksharas(w)) {
    const i = tiles.findIndex((t, k) => !used.has(k) && t.textContent === a);
    if (i < 0) continue;
    used.add(i);
    game.picked.push(+tiles[i].dataset.i);
    markTiles();
  }
}, word);
const climb = await p.evaluate(() => window.__notes.map(x => x.freq));
if (climb.length < 2) problems.push(`tracing ${word} made ${climb.length} sounds`);
else if (!climb.every((f, i) => i === 0 || f > climb[i - 1]))
  problems.push(`the notes for ${word} do not climb: [${climb}]`);

// Submitting a real word is a chord, not a single note.
await p.evaluate(() => { window.__notes = []; submitWord(); });
await p.waitForTimeout(80);
const good = await p.evaluate(() => window.__notes.length);
if (good < 3) problems.push(`finding a word made ${good} notes, expected a chord`);
console.log(`sound: ${climb.length} notes climbing for ${word}, ${good} for finding it`);

// ---- the bird ---------------------------------------------------------------------------
const bird = await p.evaluate(() => {
  const el = document.getElementById('bird');
  return el ? { cls: el.className, svg: !!el.querySelector('svg'),
                parts: ['bd-head','bd-wing','bd-tail','bd-eye','bd-beak']
                  .filter(c => el.querySelector('.' + c)).length } : null;
});
if (!bird) problems.push('there is no bird');
else {
  if (!bird.svg) problems.push('the bird is not drawn');
  if (bird.parts < 5) problems.push(`the bird has ${bird.parts} of 5 moving parts`);
}
// It reacts while a word is traced, and goes back to idle when the word is let go.
// The word submitted above leaves the bird cheering for 700ms. Waiting for that to expire is
// the point rather than an inconvenience: "goes back to idle on its own" is the behaviour.
await p.waitForFunction(() => document.getElementById('bird').className.includes('idle'),
                        null, { timeout: 3000 })
  .catch(() => problems.push('the bird never went back to idle after cheering'));
const states = await p.evaluate(async () => {
  const el = document.getElementById('bird');
  game.picked = []; markTiles();
  const rest = el.className;
  game.picked = [0]; markTiles();
  const busy = el.className;
  return { rest, busy };
});
if (!states.rest.includes('idle')) problems.push(`the bird rests as "${states.rest}"`);
if (!states.busy.includes('think')) problems.push(`the bird ignores a word being traced ("${states.busy}")`);

// ---- the mute switch: silences, persists, and is not in the two rows a child uses --------
const placed = await p.evaluate(() => {
  const m = document.getElementById('mute');
  return m ? { inActions: !!m.closest('.actions'), inTopbar: !!m.closest('.topbar'),
               onScreen: !!m.closest('.screen') } : null;
});
if (!placed) problems.push('there is no mute switch');
else {
  if (placed.inActions) problems.push('the mute switch is in the action row, which is hint + shuffle only');
  if (placed.inTopbar) problems.push('the mute switch is in the top bar, which is the arrows and the letter');
  if (!placed.onScreen) problems.push('the mute switch is not on the game screen');
}
const muting = await p.evaluate(async () => {
  document.getElementById('mute').click();
  const off = Sfx.muted;
  window.__notes = [];
  Sfx.tap(0); Sfx.good(); Sfx.win();
  // Not "were the calls flagged as muted" - that only asks whether the flag the click set is
  // still set, which is true however broken the muting is. What matters is that no oscillator
  // can be built at all, and `wake` returning null is the single gate that guarantees it.
  const whileMuted = Sfx.wake() === null ? 0 : window.__notes.length || 1;
  let stored = null;
  try { stored = localStorage.getItem(Sfx.KEY); } catch {}
  document.getElementById('mute').click();
  return { off, whileMuted, stored, backOn: !Sfx.muted };
});
if (!muting.off) problems.push('pressing mute did not mute');
if (muting.whileMuted) problems.push('muting did not stop the audio engine being used');
if (muting.stored !== 'off') problems.push(`mute was stored as ${JSON.stringify(muting.stored)}`);
if (!muting.backOn) problems.push('pressing mute twice did not turn sound back on');

// ---- and it is remembered on the next visit ---------------------------------------------
await p.evaluate(() => { try { localStorage.setItem(Sfx.KEY, 'off'); } catch {} });
const p2 = await ctx.newPage();
await p2.goto(PAGE);
await p2.waitForFunction(() => typeof Sfx !== 'undefined' && document.querySelector('.tile'));
const remembered = await p2.evaluate(() => ({
  muted: Sfx.muted, label: document.getElementById('mute').getAttribute('aria-pressed') }));
if (!remembered.muted) problems.push('a muted game came back with sound on');
await p2.close();

// ---- someone who asked for less movement gets less of it --------------------------------
const still = await b.newContext({ viewport: { width: 400, height: 820 }, reducedMotion: 'reduce' });
const p3 = await still.newPage();
await p3.addInitScript(() => { try { localStorage.clear(); } catch {} });
await p3.goto(PAGE);
await p3.waitForFunction(() => document.querySelector('.tile') && typeof Sfx !== 'undefined');
const quiet = await p3.evaluate(() => ({
  muted: Sfx.muted,
  birdStill: getComputedStyle(document.querySelector('.bird .bd-head')).animationName === 'none',
  fxHidden: getComputedStyle(document.getElementById('fx')).display === 'none',
}));
if (!quiet.muted) problems.push('reduced motion did not default the sound off');
if (!quiet.birdStill) problems.push('the bird still animates under prefers-reduced-motion');
if (!quiet.fxHidden) problems.push('the effects layer is still shown under prefers-reduced-motion');
console.log(`bird: ${bird ? bird.parts : 0} parts, idle/think both work; `
          + `mute persists; reduced-motion silences and stills`);

await b.close();
report(problems, 'FEEL OK: sound climbs and stops, the bird reacts, mute sticks, '
               + 'and no stylesheet names a colour but theme.css');
