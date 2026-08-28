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

/* ---- 0. the finished board is on screen long enough to be looked at ----------------------
 *
 * The test that should have existed first. Everything below checks that clearing a level
 * *advances*, which is the mechanism; none of it asked whether a person saw anything happen,
 * and the answer was no. The completed board was replaced in the same frame the last letters
 * landed, so the confetti and the stars were thrown over the next level's empty grid, and with
 * iOS Reduce Motion turned on the whole reward was skipped and the level simply changed.
 *
 * Run under both motion settings, because that is where it went wrong: a hold is not an
 * animation, and it must not disappear with one.
 */
for (const motion of ['no-preference', 'reduce']) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: motion });
  const p = await ctx.newPage();
  await p.goto(PAGE);
  await p.waitForFunction(() => document.querySelector('.tile'));

  const seen = await p.evaluate(async () => {
    // Everything but the last word, so the finish is one submit away.
    const lv = LEVELS[game.index];
    game.found[lv.id] = lv.words.slice(0, -1);
    refreshBoard();
    const cells = document.querySelectorAll('.cell:not(.blank)').length;

    const start = performance.now();
    const was = game.index;
    let advancedAt = null, fullAt = null, chip = false, party = false, celebratedBeforeSwap = false;
    const tick = setInterval(() => {
      if (document.querySelector('.chip.good')) chip = true;
      if (document.querySelector('.bird.party')) party = true;
      if (advancedAt === null) {
        if (fullAt === null && document.querySelectorAll('.cell.on').length === cells) {
          fullAt = performance.now() - start;
        }
        // Confetti or a star while the finished board is still up - the reward landing on the
        // board it is a reward for, which is the part that was wrong.
        if (document.querySelector('.fly.confetti, .star')) celebratedBeforeSwap = true;
      }
      if (advancedAt === null && game.index !== was) advancedAt = performance.now() - start;
    }, 8);

    const w = lv.words.at(-1);
    game.picked = splitAksharas(w).map(a => game.wheel.indexOf(a));
    submitWord();
    await new Promise(r => setTimeout(r, 3200));
    clearInterval(tick);
    return { cells, advancedAt, fullAt, chip, party, celebratedBeforeSwap };
  });

  const label = `motion ${motion}`;
  if (seen.advancedAt === null) {
    problems.push(`${label}: never advanced after the last word`);
  } else if (seen.fullAt === null) {
    problems.push(`${label}: the finished board was never fully on screen before the swap`);
  } else {
    // A second is the floor. Below that a child has not finished looking at the word they
    // found before it is taken away, which is the complaint this came from.
    const visible = seen.advancedAt - seen.fullAt;
    if (visible < 1000)
      problems.push(`${label}: the finished board was up for only ${Math.round(visible)}ms `
                  + `before the next level (want 1000ms or more)`);
    // And not so long that a child thinks the game has stopped.
    if (seen.advancedAt > 3000)
      problems.push(`${label}: took ${Math.round(seen.advancedAt)}ms to advance`);
    console.log(`${label}: full board at ${Math.round(seen.fullAt)}ms, held `
              + `${Math.round(visible)}ms, advanced at ${Math.round(seen.advancedAt)}ms`);
  }
  // The word just found stays named on screen while the board is looked at.
  if (!seen.chip) problems.push(`${label}: the word was never shown as found`);
  // The bird reacts whatever the motion setting - the class is set either way; only the
  // movement it drives is CSS, and CSS is what reduced motion is allowed to stop.
  if (!seen.party) problems.push(`${label}: the bird did not react to the board being finished`);
  if (motion === 'no-preference' && !seen.celebratedBeforeSwap)
    problems.push('the confetti and stars fired after the swap, over the next level');
  await ctx.close();
}

/* ---- 0b. and on an engine with no Web Animations API -------------------------------------
 *
 * `fly` calls `el.animate` from inside a loop that runs inside `submitWord`. Unguarded, a
 * missing Element.animate threw all the way up: the word was already recorded, but the board
 * never updated and the level never advanced. So the whole game hung on an API that only the
 * decoration needs. Deleting the API is the cheapest way to prove the guard is real.
 */
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript(() => { delete Element.prototype.animate; });
  const p = await ctx.newPage();
  const thrown = [];
  p.on('pageerror', e => thrown.push(e.message));
  await p.goto(PAGE);
  await p.waitForFunction(() => document.querySelector('.tile'));
  const bare = await p.evaluate(async () => {
    const lv = LEVELS[game.index];
    game.found[lv.id] = lv.words.slice(0, -1);
    refreshBoard();
    const cells = document.querySelectorAll('.cell:not(.blank)').length;
    const was = game.index;
    const w = lv.words.at(-1);
    game.picked = splitAksharas(w).map(a => game.wheel.indexOf(a));
    submitWord();
    await new Promise(r => setTimeout(r, 600));
    const lit = document.querySelectorAll('.cell.on').length;
    await new Promise(r => setTimeout(r, 2200));
    return { lit, cells, advanced: game.index === was + 1 };
  });
  if (thrown.length) problems.push(`no Element.animate: the page threw - ${thrown[0]}`);
  if (bare.lit !== bare.cells)
    problems.push(`no Element.animate: the board showed ${bare.lit} of ${bare.cells} letters`);
  if (!bare.advanced) problems.push('no Element.animate: the level never advanced');
  console.log(`no Element.animate: board filled ${bare.lit}/${bare.cells}, advanced `
            + `${bare.advanced ? 'yes' : 'no'}, ${thrown.length} errors`);
  await ctx.close();
}

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
