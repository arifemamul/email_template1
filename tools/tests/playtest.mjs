import { launch, PAGE, serveDocs, shot } from './harness.mjs';

const browser = await launch();

const problems = [];

async function open(size, label) {
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') problems.push(`[${label}] console: ${m.text()}`); });
  page.on('pageerror', e => problems.push(`[${label}] pageerror: ${e.message}`));
  await page.goto(PAGE);
  await page.waitForTimeout(500);
  return { ctx, page };
}

// ── Desktop: play level 1 to completion by dragging the wheel ────────────────
const { page } = await open({ width: 1280, height: 900 }, 'desktop');

// no horizontal page scroll
const overflow = await page.evaluate(() =>
  document.documentElement.scrollWidth - document.documentElement.clientWidth);
if (overflow > 1) problems.push(`desktop: page scrolls sideways by ${overflow}px`);

let lastChip = '';

const info = await page.evaluate(() => ({
  level: 'লেভেল ' + (document.querySelector('.lv.now')?.textContent ?? '?'),
  sub: (game.found[LEVELS[game.index].id] || []).length + ' / ' + game.puzzle.words.length + ' words',
  tiles: [...document.querySelectorAll('.tile')].map(t => t.textContent),
  cells: document.querySelectorAll('.cell:not(.blank)').length,
  lit: document.querySelectorAll('.cell.on').length,
  title: document.title
}));
console.log('opened:', JSON.stringify(info));
if (info.lit !== 0) problems.push('a fresh level starts with letters already revealed');

// drag helper: press on the tile for the first akshara, slide through the rest, release
async function traceWord(word) {
  const path = await page.evaluate(w => {
    const HAS = '্';
    const COMB = new Set(['ঁ','ং','ঃ','়','া','ি','ী','ু','ূ','ৃ','ৄ','ে','ৈ','ো','ৌ','ৗ','ৢ','ৣ', HAS]);
    const split = s => { const u=[]; let c='', j=false;
      for (const ch of s) { if (COMB.has(ch)) { c+=ch; j = ch===HAS; } else if (j) { c+=ch; j=false; } else { if(c)u.push(c); c=ch; } }
      if (c) u.push(c); return u; };
    const tiles = [...document.querySelectorAll('.tile')];
    return split(w).map(a => {
      const t = tiles.find(t => t.textContent === a);
      if (!t) return null;
      const r = t.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2];
    });
  }, word);

  if (path.some(p => !p)) { problems.push(`no tile for part of "${word}"`); return; }
  await page.mouse.move(...path[0]);
  await page.mouse.down();
  for (const [x, y] of path.slice(1)) {
    await page.mouse.move(x, y, { steps: 6 });
  }
  await page.mouse.up();
  await page.waitForTimeout(140);
  lastChip = await page.evaluate(() => document.querySelector('.chip')?.className || '');
  await page.waitForTimeout(1500);   // letters fly, cells reveal
}

const LEVEL1 = await page.evaluate(() => LEVELS[0].words);
const NONSENSE = await page.evaluate(() => {
  const real = new Set(LEVELS[0].words);
  for (const a of game.wheel) for (const b of game.wheel) {
    if (a !== b && !real.has(a + b)) return a + b;
  }
  return null;
});
console.log('level 1 words:', LEVEL1.join(' '), '| non-word:', NONSENSE);

await traceWord(NONSENSE);   // not a word in this level — expect a rejection
const afterWrong = await page.evaluate(() => ({
  chip: '',
  lit: document.querySelectorAll('.cell.on').length
}));
afterWrong.chip = lastChip;
console.log('wrong guess ->', JSON.stringify(afterWrong));
if (!afterWrong.chip.includes('bad')) problems.push('a wrong word was not rejected');
if (afterWrong.lit !== 0) problems.push('a wrong word revealed letters');
await page.waitForTimeout(800);

for (const w of LEVEL1) {
  await traceWord(w);
  if (w === LEVEL1[0]) {
    // same word again, while the board is still live: must be flagged as already found
    await page.waitForTimeout(820);
    await traceWord(w);
    console.log('duplicate ->', lastChip);
    if (!lastChip.includes('dup')) problems.push('a repeated word was not flagged as already found');
    await page.waitForTimeout(820);
  }
  const state = await page.evaluate(() => ({
    sub: (game.found[LEVELS[game.index].id] || []).length + ' / ' + game.puzzle.words.length + ' words',
    lit: document.querySelectorAll('.cell.on').length
  }));
  console.log(`found ${w} ->`, JSON.stringify(state));
}

// clearing a level moves on by itself, with no card and no countdown in between
await page.waitForTimeout(1600);
const moved = await page.evaluate(() => ({
  index: game.index,
  card: !!document.getElementById('clear'),
  sub: (game.found[LEVELS[game.index].id] || []).length + ' / ' + game.puzzle.words.length + ' words',
  lit: document.querySelectorAll('.cell.on').length
}));
console.log('after clearing ->', JSON.stringify(moved));
if (moved.index !== 1) problems.push('clearing level 1 did not move on to level 2 by itself');
if (moved.card) problems.push('the level-clear card is still in the page');
if (moved.lit !== 0) problems.push('the next level did not open blank');

await page.screenshot({ path: shot('shot-desktop-clear.png') });

/*
 * A hint on the level it moved us to.
 *
 * A hint shows a letter and does NOT fill the cell: gold is for a word actually found. The two
 * were one set once - `revealedCells` fed the `on` class - so a hinted board looked like a
 * solved one and a child read it as the game answering for them. `.cell.hinted` is the
 * measurement now, and `.cell.on` must not move at all.
 *
 * And a hint costs a minute. The second one has to be refused, and the clock reset by hand to
 * take it, which is the test for the wait rather than a way around it.
 */
const beforeHint = await page.evaluate(() => ({
  on: document.querySelectorAll('.cell.on').length,
  hinted: document.querySelectorAll('.cell.hinted').length,
}));
await page.click('#hint');
await page.waitForTimeout(400);
const oneHint = await page.evaluate(() => ({
  on: document.querySelectorAll('.cell.on').length,
  hinted: document.querySelectorAll('.cell.hinted').length,
  wait: hintWait(),
  disabled: document.getElementById('hint').disabled,
  label: document.getElementById('hint').querySelector('.bn').textContent,
}));
// Pressed while the clock is running: nothing may happen.
await page.evaluate(() => document.getElementById('hint').click());
await page.waitForTimeout(300);
const refused = await page.evaluate(() => document.querySelectorAll('.cell.hinted').length);
// Wound forward, and a second hint lands.
await page.evaluate(() => { game.hintAt = 0; drawHud(); });
await page.click('#hint');
await page.waitForTimeout(400);
const twoHints = await page.evaluate(() => ({
  on: document.querySelectorAll('.cell.on').length,
  hinted: document.querySelectorAll('.cell.hinted').length,
  purse: !!document.getElementById('coinCount')
}));
console.log('hints ->', JSON.stringify({ beforeHint, oneHint, refused, twoHints }));
if (oneHint.hinted !== beforeHint.hinted + 1)
  problems.push('a hint did not show exactly one letter');
if (oneHint.on !== beforeHint.on)
  problems.push(`a hint filled ${oneHint.on - beforeHint.on} cell(s) gold; only a found word does that`);
if (oneHint.wait < 55 || oneHint.wait > 60)
  problems.push(`a hint left ${oneHint.wait}s on the clock, expected about 60`);
if (!oneHint.disabled) problems.push('the hint button is still live while its clock runs');
if (!/[০-৯]/.test(oneHint.label))
  problems.push(`the hint button says "${oneHint.label}" while waiting, with no count in it`);
if (refused !== oneHint.hinted) problems.push('a second hint was given while the clock was running');
if (twoHints.hinted !== beforeHint.hinted + 2)
  problems.push('a second hint was refused after the clock ran out');
if (twoHints.on !== beforeHint.on) problems.push('two hints filled cells gold');
if (twoHints.purse) problems.push('the coin counter is still in the page');

// Finding a word buys the clock back: thirty seconds a word, so two words pay for a hint.
await page.evaluate(() => { game.hintAt = Date.now() + 60000; drawHud(); });
const credit = await page.evaluate(async () => {
  const before = hintWait();
  const words = LEVELS[game.index].words.filter(w => !(game.found[LEVELS[game.index].id] || []).includes(w));
  const step = [];
  for (const w of words.slice(0, 2)) {
    game.picked = splitAksharas(w).map(a => game.wheel.indexOf(a));
    submitWord();
    await new Promise(r => setTimeout(r, 500));
    step.push(hintWait());
  }
  return { before, step };
});
console.log('credit ->', JSON.stringify(credit));
if (credit.step.length < 2) problems.push('the level had too few words left to test the credit');
else {
  if (Math.abs((credit.before - credit.step[0]) - 30) > 2)
    problems.push(`one word took ${credit.before - credit.step[0]}s off the clock, expected 30`);
  if (credit.step[1] !== 0)
    problems.push(`two words left ${credit.step[1]}s on the clock; two words should pay for a hint`);
}

// click-by-click entry (no dragging) on the current level
await page.keyboard.press('Escape');
const clickWord = await page.evaluate(() => {
  const lv = [...document.querySelectorAll('.lv')].findIndex(b => b.classList.contains('now'));
  return { lv };
});
console.log('tap-mode level index ->', JSON.stringify(clickWord));

// shuffle must keep the same tile letters
const before = await page.evaluate(() => [...document.querySelectorAll('.tile')].map(t => t.textContent).sort().join(''));
await page.click('#shuffle');
await page.waitForTimeout(300);
const after = await page.evaluate(() => [...document.querySelectorAll('.tile')].map(t => t.textContent).sort().join(''));
if (before !== after) problems.push('shuffle changed which letters are on the wheel');

// ── Phone viewport: layout must fit without sideways scroll ──────────────────
const { page: phone } = await open({ width: 390, height: 844 }, 'phone');
const phoneCheck = await phone.evaluate(() => {
  const wheel = document.getElementById('wheel').getBoundingClientRect();
  const screen = document.querySelector('.screen').getBoundingClientRect();
  const board = document.getElementById('board').getBoundingClientRect();
  return {
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    wheelFits: wheel.width <= screen.width + 1,
    boardFits: board.width <= screen.width + 1,
    wheelSize: Math.round(wheel.width),
    tiles: document.querySelectorAll('.tile').length
  };
});
console.log('phone ->', JSON.stringify(phoneCheck));
if (phoneCheck.overflow > 1) problems.push(`phone: page scrolls sideways by ${phoneCheck.overflow}px`);
if (!phoneCheck.wheelFits) problems.push('phone: wheel wider than the screen');
if (!phoneCheck.boardFits) problems.push('phone: board wider than the screen');
await phone.screenshot({ path: shot('shot-phone.png'), fullPage: false });

// ── Topbar navigation: prev and next step levels, and wrap at both ends ──────
{
  const at = () => phone.evaluate(() => game.index);
  const nav = [];
  await phone.evaluate(() => loadLevel(0));
  nav.push(['start', await at()]);
  await phone.click('#next'); nav.push(['next', await at()]);
  await phone.click('#next'); nav.push(['next', await at()]);
  await phone.click('#prev'); nav.push(['prev', await at()]);
  await phone.evaluate(n => loadLevel(n - 1), await phone.evaluate(() => LEVELS.length));
  nav.push(['last', await at()]);
  await phone.click('#next'); nav.push(['next wraps', await at()]);
  await phone.click('#prev'); nav.push(['prev wraps', await at()]);
  const last = await phone.evaluate(() => LEVELS.length - 1);
  const want = [0, 1, 2, 1, last, 0, last];
  const got = nav.map(([, i]) => i);
  console.log('topbar nav:', nav.map(([what, i]) => `${what}=${i + 1}`).join(' '));
  if (JSON.stringify(got) !== JSON.stringify(want))
    problems.push(`topbar nav walked ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
  const board = await phone.evaluate(() => ({
    cells: document.querySelectorAll('.cell:not(.blank)').length,
    tiles: document.querySelectorAll('.tile').length,
    sub: (game.found[LEVELS[game.index].id] || []).length + ' / ' + game.puzzle.words.length + ' words',
    // The topbar carries the level's letter. It used to carry a word counter ("2/6"), which
    // was removed and must stay removed; the letter is a different thing and is wanted.
    letter: (document.getElementById('levelGlyph') || {}).textContent || '',
    counter: /\d\s*\/\s*\d/.test(document.querySelector('.topbar').textContent),
    nextLabel: document.getElementById('next').getAttribute('aria-label')
  }));
  console.log('after nav:', JSON.stringify(board));
  if (!board.cells || !board.tiles) problems.push('navigating with the topbar left an empty board');
  if (!board.letter) problems.push('the topbar does not name the letter this level teaches');
  if (board.counter) problems.push('a word counter is back in the topbar');
  await phone.evaluate(() => loadLevel(0));
}

// ── Every level must render a full board and wheel ───────────────────────────
const sweep = await phone.evaluate(async () => {
  const out = [];
  const buttons = [...document.querySelectorAll('.lv')];
  for (let i = 0; i < buttons.length; i++) {
    buttons[i].click();
    await new Promise(r => setTimeout(r, 30));
    out.push({
      i: i + 1,
      cells: document.querySelectorAll('.cell:not(.blank)').length,
      tiles: document.querySelectorAll('.tile').length,
      name: 'লেভেল ' + (document.querySelector('.lv.now')?.textContent ?? '?')
    });
  }
  return out;
});
const emptyLevels = sweep.filter(s => s.cells === 0 || s.tiles === 0);
if (emptyLevels.length) problems.push('levels failed to render: ' + JSON.stringify(emptyLevels));
console.log(`swept ${sweep.length} levels; cells per level:`, sweep.map(s => s.cells).join(','));

// ── The hardest levels: biggest boards, most tiles, on the smallest phone ────
for (const [size, label] of [[{ width: 360, height: 640 }, 'small phone'], [{ width: 1280, height: 800 }, 'desktop']]) {
  const { page: hp } = await open(size, `hard/${label}`);
  const worst = await hp.evaluate(async () => {
    const out = [];
    const buttons = [...document.querySelectorAll('.lv')];
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].click();
      await new Promise(r => setTimeout(r, 25));
      const cell = document.querySelector('.cell:not(.blank)');
      const board = document.getElementById('board').getBoundingClientRect();
      const screen = document.querySelector('.screen').getBoundingClientRect();
      const wheel = document.getElementById('wheel').getBoundingClientRect();
      out.push({
        id: i + 1,
        cell: cell ? Math.round(cell.getBoundingClientRect().width) : 0,
        boardOver: Math.round(board.width - screen.width),
        wheelOver: Math.round(wheel.width - screen.width),
        tiles: document.querySelectorAll('.tile').length,
        cells: document.querySelectorAll('.cell:not(.blank)').length
      });
    }
    return out;
  });
  const tiniest = worst.reduce((a, b) => (b.cell < a.cell ? b : a));
  const widest = worst.reduce((a, b) => (b.boardOver > a.boardOver ? b : a));
  console.log(`${label}: smallest cell ${tiniest.cell}px (level ${tiniest.id}), widest board overflow ${widest.boardOver}px (level ${widest.id}), max tiles ${Math.max(...worst.map(w => w.tiles))}`);
  // 26px is the documented floor, and it is a floor rather than a target: cells are
  // display-only, nothing on the board is tapped, and the glyph grows as a share of the cell
  // below 40px. Reaching it means the screen genuinely had no more height to give - which
  // beats the old behaviour, where the board kept its 30px and the wheel was clipped off the
  // bottom of the screen instead.
  if (tiniest.cell < 26) problems.push(`${label}: level ${tiniest.id} cells shrink to ${tiniest.cell}px`);
  if (widest.boardOver > 0) problems.push(`${label}: level ${widest.id} board overflows the screen by ${widest.boardOver}px`);
  for (const w of worst) if (!w.cells || !w.tiles) problems.push(`${label}: level ${w.id} failed to render`);
  if (Math.max(...worst.map(w => w.wheelOver)) > 0) problems.push(`${label}: wheel wider than the screen`);
}

// ── Play the widest level in the catalogue end to end ────────────────────────
{
  const { page: hard } = await open({ width: 1280, height: 900 }, 'hardest');
  await hard.evaluate(() => [...document.querySelectorAll('.lv')].at(-1).click());
  await hard.waitForTimeout(300);
  const info = await hard.evaluate(() => ({
    name: 'লেভেল ' + (document.querySelector('.lv.now')?.textContent ?? '?'),
    words: LEVELS.at(-1).words,
    index: game.index,
    tiles: document.querySelectorAll('.tile').length
  }));
  const traceOn = async (pg, word, settle = 1600) => {
    const path = await pg.evaluate(w => {
      const HAS='্', COMB=new Set(['ঁ','ং','ঃ','়','া','ি','ী','ু','ূ','ৃ','ৄ','ে','ৈ','ো','ৌ','ৗ','ৢ','ৣ',HAS]);
      const split=s=>{const u=[];let c='',j=false;for(const ch of s){if(COMB.has(ch)){c+=ch;j=ch===HAS;}else if(j){c+=ch;j=false;}else{if(c)u.push(c);c=ch;}}if(c)u.push(c);return u;};
      // A tile is consumed as the drag passes through it, and a wheel can carry the same
      // akshara twice - হিজিবিজি needs জি from two different tiles. Taking the first match
      // every time would trace one tile twice and never spell the word.
      const tiles=[...document.querySelectorAll('.tile')]; const used=new Set();
      return split(w).map(a=>{const i=tiles.findIndex((t,k)=>!used.has(k)&&t.textContent===a);
        if(i<0) return null; used.add(i);
        const r=tiles[i].getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2];});
    }, word);
    if (path.some(q => !q)) { problems.push(`hardest level has no tile for part of "${word}"`); return; }
    // Hop through the middle of the wheel between tiles. A straight line from one tile to
    // another can run over a third, which the game adds to the word - the same thing that
    // makes a player arc their finger rather than cut across.
    const mid = await pg.evaluate(() => {
      const r = document.getElementById('wheel').getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2];
    });
    await pg.mouse.move(...path[0]);
    await pg.mouse.down();
    for (const q of path.slice(1)) {
      await pg.mouse.move(mid[0], mid[1], { steps: 3 });
      await pg.mouse.move(q[0], q[1], { steps: 3 });
    }
    await pg.mouse.up();
    await pg.waitForTimeout(settle);
  };
  // every word but the last with a beat between them; the last one with none, because the
  // finished board is only on screen until the game moves on by itself
  // every word but the last with a beat between them; the last one with none, because the
  // finished board is only on screen until the game moves on by itself
  for (const w of info.words.slice(0, -1)) await traceOn(hard, w);
  const wasOn = info.index;
  await traceOn(hard, info.words.at(-1), 0);
  await hard.waitForFunction(n => (game.found[LEVELS[n].id] || []).length === LEVELS[n].words.length,
                             wasOn, { timeout: 6000 });
  // Not "every cell is lit": this is the last level, and clearing it wraps straight round to
  // level 1 with a blank board, so the lit board may already be gone. What has to be true is
  // that the level was recorded as finished.
  await hard.waitForFunction(n => !!game.completed[LEVELS[n].id], wasOn, { timeout: 6000 });
  const done = await hard.evaluate(was => ({
    sub: (game.found[LEVELS[game.index].id] || []).length + ' / ' + game.puzzle.words.length + ' words',
    allLit: !!game.completed[LEVELS[was].id],
    allFound: (game.found[LEVELS[was].id] || []).length === LEVELS[was].words.length
  }), info.index);
  await hard.waitForFunction(n => game.index !== n, info.index, { timeout: 6000 })
    .then(() => { done.moved = true; }).catch(() => { done.moved = false; });
  console.log(`widest level (${info.name}, ${info.tiles} tiles, ${info.words.length} words): ${JSON.stringify(done)}`);
  if (!done.allLit) problems.push('the widest level did not fully reveal after its last word');
  if (!done.moved) problems.push('the widest level did not move on after its last word');
  await hard.screenshot({ path: shot('hardest-level.png') });
}

// ── The whole phone (wheel included) must sit inside the first screen ────────
for (const size of [
  { width: 1440, height: 900, label: 'desktop 1440x900' },
  { width: 1280, height: 800, label: 'laptop 1280x800' },
  { width: 1366, height: 700, label: 'short laptop 1366x700' },
  { width: 390,  height: 844, label: 'phone 390x844' },
  { width: 360,  height: 640, label: 'small phone 360x640' },
  { width: 820,  height: 1180, label: 'tablet 820x1180' }
]) {
  const { page: p2 } = await open(size, size.label);
  const fold = await p2.evaluate(() => {
    const d = document.querySelector('.device').getBoundingClientRect();
    const w = document.getElementById('wheel').getBoundingClientRect();
    return {
      deviceBottom: Math.round(d.bottom),
      wheelBottom: Math.round(w.bottom),
      viewport: window.innerHeight,
      sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      tiles: document.querySelectorAll('.tile').length,
      cells: document.querySelectorAll('.cell:not(.blank)').length
    };
  });
  const ok = fold.wheelBottom <= fold.viewport + 1;
  console.log(`${size.label}: wheel bottom ${fold.wheelBottom} / viewport ${fold.viewport} ${ok ? 'OK' : 'BELOW FOLD'}`);
  if (!ok) problems.push(`${size.label}: wheel sits ${fold.wheelBottom - fold.viewport}px below the fold`);
  if (fold.sideways > 1) problems.push(`${size.label}: page scrolls sideways by ${fold.sideways}px`);
  if (!fold.tiles || !fold.cells) problems.push(`${size.label}: game did not render`);
}

await browser.close();

console.log('\n' + (problems.length ? 'PROBLEMS:\n- ' + problems.join('\n- ') : 'ALL CHECKS PASSED'));
process.exit(problems.length ? 1 : 0);
