import { launch, PAGE, serveDocs } from './harness.mjs';
const b = await launch();
const problems = [];
const url = PAGE;

const fresh = async () => {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(url);
  await p.waitForFunction(() => document.querySelector('.tile'));
  p.__ctx = ctx;
  return p;
};
const clearLevel = async p => {
  for (const w of await p.evaluate(() => LEVELS[game.index].words)) {
    await p.evaluate(x => { game.picked = splitAksharas(x).map(a => game.wheel.indexOf(a)); submitWord(); }, w);
    await p.waitForTimeout(60);
  }
  await p.waitForTimeout(1700);
};

// ---- 1. it advances on its own, straight away ----
{
  const p = await fresh();
  const t0 = Date.now();
  await clearLevel(p);
  await p.waitForFunction(() => game.index === 1, { timeout: 8000 }).catch(() => {});
  const took = Date.now() - t0;
  const after = await p.evaluate(() => ({
    level: game.index + 1,
    card: !!document.getElementById('clear'),
    countdown: !!document.getElementById('clearProgress'),
    lit: document.querySelectorAll('.cell.on').length
  }));
  console.log('advanced by itself:', JSON.stringify(after), `in ${took}ms`);
  if (after.level !== 2) problems.push(`did not auto-advance; still on level ${after.level}`);
  if (after.card) problems.push('the clear card is still in the page');
  if (after.countdown) problems.push('the countdown bar is still in the page');
  if (after.lit !== 0) problems.push('new level did not start blank');
  await p.__ctx.close();
}

// ---- 2. no waiting period: the next board is up within a beat of the last word landing ----
// The letters still fly to the board and the cells still pop, so this is not instant - but it
// is the animation, not a timer, and it must not be anywhere near the five seconds it was.
{
  const p = await fresh();
  const words = await p.evaluate(() => LEVELS[0].words);
  for (const w of words.slice(0, -1)) {
    await p.evaluate(x => { game.picked = splitAksharas(x).map(a => game.wheel.indexOf(a)); submitWord(); }, w);
    await p.waitForTimeout(60);
  }
  const t0 = Date.now();
  await p.evaluate(x => { game.picked = splitAksharas(x).map(a => game.wheel.indexOf(a)); submitWord(); },
                   words[words.length - 1]);
  await p.waitForFunction(() => game.index === 1, { timeout: 8000 });
  const took = Date.now() - t0;
  console.log(`last word to next level: ${took}ms`);
  if (took > 2000) problems.push(`still waits ${took}ms after the last word`);
  await p.__ctx.close();
}

// ---- 3. a PARTLY solved level also comes back blank ----
{
  const p = await fresh();
  const words = await p.evaluate(() => LEVELS[0].words);
  await p.evaluate(x => { game.picked = splitAksharas(x).map(a => game.wheel.indexOf(a)); submitWord(); }, words[0]);
  await p.waitForTimeout(700);
  const part = await p.evaluate(() => ({
    lit: document.querySelectorAll('.cell.on').length,
    found: (game.found[LEVELS[0].id] || []).length
  }));
  console.log('one word in:', JSON.stringify(part));
  if (part.found !== 1) problems.push('the first word was not recorded at all');

  await p.click('#next');
  await p.click('#prev');
  await p.waitForTimeout(400);
  const back = await p.evaluate(() => ({
    level: game.index + 1,
    lit: document.querySelectorAll('.cell.on').length,
    found: (game.found[LEVELS[0].id] || []).length,
    sub: (game.found[LEVELS[game.index].id] || []).length + ' / ' + game.puzzle.words.length + ' words'
  }));
  console.log('part-solved level revisited:', JSON.stringify(back));
  if (back.lit !== 0) problems.push(`part-solved level came back with ${back.lit} lit cells`);
  if (back.found !== 0) problems.push('part-solved progress was not cleared');
  await p.__ctx.close();
}

// ---- 4. the celebration actually paints, in colour ----
{
  const p = await fresh();
  const words = await p.evaluate(() => LEVELS[0].words);
  for (const w of words.slice(0, -1)) {
    await p.evaluate(x => { game.picked = splitAksharas(x).map(a => game.wheel.indexOf(a)); submitWord(); }, w);
    await p.waitForTimeout(60);
  }
  await p.evaluate(x => { game.picked = splitAksharas(x).map(a => game.wheel.indexOf(a)); submitWord(); }, words.at(-1));
  await p.waitForTimeout(700);
  const fx = await p.evaluate(() => {
    const pieces = [...document.querySelectorAll('#fx .confetti')];
    const colours = new Set(pieces.map(x => getComputedStyle(x).backgroundColor));
    return { confetti: pieces.length, coins: document.querySelectorAll('#fx .coin').length,
             distinctColours: colours.size,
             glow: document.getElementById('board').classList.contains('cleared') };
  });
  console.log('celebration:', JSON.stringify(fx));
  if (fx.confetti < 10) problems.push(`only ${fx.confetti} confetti pieces`);
  if (fx.distinctColours < 3) problems.push(`confetti is only ${fx.distinctColours} colour(s)`);
  // The board no longer flashes or bows on clearing: both need the finished board to still be
  // on screen, and the next level now loads in the same frame. Confetti is the whole
  // celebration, and it lives in the overlay.
  if (fx.glow) problems.push('board still flashes on clearing - it is replaced too fast to be seen');
  if (fx.coins) problems.push(`${fx.coins} coins still rain on clearing`);
  await p.__ctx.close();
}

// ---- 5. the level picker is colour-coded by letter ----
// Was by block - the five stages of the teaching syllabus the game replaced. In alphabet
// order that grouped nothing a player could see, so the colour is per letter now: every ক
// level one colour, and the next letter a different one.
{
  const p = await fresh();
  const grid = await p.evaluate(() => {
    const chips = [...document.querySelectorAll('#levelGrid .lv')];
    const byName = {};
    chips.forEach((c, i) => {
      const n = LEVELS[i].name;
      (byName[n] = byName[n] || new Set()).add(getComputedStyle(c).backgroundColor);
    });
    const names = Object.keys(byName);
    // Do neighbouring letters ever share a colour? They must not, or the bands merge.
    const order = names.map(n => [...byName[n]][0]);
    let clash = 0;
    for (let i = 1; i < order.length; i++) if (order[i] === order[i - 1]) clash++;
    return {
      letters: names.length,
      distinct: new Set(order).size,
      oneColourEach: Object.values(byName).every(v => v.size === 1),
      neighbourClashes: clash,
      chips: chips.length
    };
  });
  console.log('level picker colours:', JSON.stringify(grid));
  if (grid.chips !== await p.evaluate(() => LEVELS.length))
    problems.push('the level grid does not hold one chip per level');
  if (!grid.oneColourEach) problems.push('a letter has chips of more than one colour');
  if (grid.distinct < 5) problems.push(`only ${grid.distinct} chip colours across the alphabet`);
  if (grid.neighbourClashes) problems.push(`${grid.neighbourClashes} neighbouring letters share a colour`);
  await p.__ctx.close();
}

// ---- 6. every level names the letter it teaches, on screen and in the grid ----
{
  const p = await fresh();
  const seen = await p.evaluate(async () => {
    const out = [];
    for (const i of [0, 1, 20, 60, LEVELS.length - 1]) {
      loadLevel(i);
      await new Promise(r => requestAnimationFrame(r));
      out.push({
        i,
        name: LEVELS[i].name,
        pass: LEVELS[i].pass,
        glyph: document.getElementById('levelGlyph').textContent,
        shown: document.getElementById('levelPass').textContent
      });
    }
    return out;
  });
  console.log('level names:', JSON.stringify(seen));
  const bn = n => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[+d]);
  for (const s of seen) {
    if (s.glyph !== s.name) problems.push(`level ${s.i + 1}: topbar says "${s.glyph}", level is ${s.name}`);
    const want = s.pass ? bn(s.pass) : '';
    if (s.shown !== want) problems.push(`level ${s.i + 1}: pass shows "${s.shown}", expected "${want}"`);
  }
  if (seen.some(s => /^[০-৯]+$/.test(s.glyph)))
    problems.push('a level is still named by its number rather than its letter');
  await p.__ctx.close();
}

await b.close();
console.log('\n' + (problems.length ? 'PROBLEMS:\n- ' + problems.join('\n- ') : 'ALL ADVANCE / BLANK / COLOUR CHECKS PASSED'));
process.exit(problems.length ? 1 : 0);
