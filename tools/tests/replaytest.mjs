import { launch, PAGE, serveDocs } from './harness.mjs';
const b = await launch();
const problems = [];
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
await p.goto(PAGE);
await p.waitForFunction(() => document.querySelector('.tile'));

const solve = async () => {
  const words = await p.evaluate(() => LEVELS[game.index].words);
  for (const w of words) {
    await p.evaluate(x => { game.picked = splitAksharas(x).map(a => game.wheel.indexOf(a)); submitWord(); }, w);
    await p.waitForTimeout(50);
  }
};

// Clear level 1 fully. The board fills in as the last word lands and then the game moves on
// by itself, so "fully solved" is read before the change rather than after it.
await solve();
await p.waitForFunction(() => {
  const cells = document.querySelectorAll('.cell:not(.blank)').length;
  return cells > 0 && document.querySelectorAll('.cell.on').length === cells;
}, { timeout: 5000 }).catch(() => {});
const justCleared = await p.evaluate(() => ({
  lit: document.querySelectorAll('.cell.on').length,
  cells: document.querySelectorAll('.cell:not(.blank)').length,
  completed: !!game.completed[LEVELS[0].id],
  found: (game.found[LEVELS[0].id] || []).length
}));
console.log('just cleared:', JSON.stringify(justCleared));
if (justCleared.lit !== justCleared.cells) problems.push('level did not show fully solved right after clearing');
if (!justCleared.completed) problems.push('completed flag not set after clearing');

// it has moved on by now; walk back to level 1
await p.waitForTimeout(1600);
const landedOn = await p.evaluate(() => game.index);
if (landedOn !== 1) problems.push(`clearing level 1 left us on level ${landedOn + 1}, expected 2`);
await p.evaluate(() => loadLevel(0));
await p.waitForTimeout(200);
const revisited = await p.evaluate(() => ({
  lit: document.querySelectorAll('.cell.on').length,
  found: (game.found[LEVELS[0].id] || []).length,
  hints: (game.hints[LEVELS[0].id] || []).length,
  completed: !!game.completed[LEVELS[0].id],
  doneStar: document.querySelectorAll('#levelGrid .lv.done').length,
  sub: (game.found[LEVELS[game.index].id] || []).length + ' / ' + game.puzzle.words.length + ' words'
}));
console.log('revisited:', JSON.stringify(revisited));
if (revisited.lit !== 0) problems.push(`revisited level still shows ${revisited.lit} lit cells`);
if (revisited.found !== 0) problems.push('found words were not wiped on revisit');
if (!revisited.completed) problems.push('completed flag was lost on revisit (should be permanent)');
if (revisited.doneStar < 1) problems.push('the level grid lost its "done" star for a replayed level');
// The on-screen counter was removed; a revisited level still has to come back with nothing
// found, which is what this ever really checked.
const wantSub = await p.evaluate(() => `0 / ${LEVELS[0].words.length} words`);
if (revisited.sub !== wantSub) problems.push(`revisited level holds "${revisited.sub}", expected "${wantSub}"`);

// it must actually be playable again: solve it a second time
await solve();
await p.waitForFunction(() => {
  const cells = document.querySelectorAll('.cell:not(.blank)').length;
  return cells > 0 && document.querySelectorAll('.cell.on').length === cells;
}, { timeout: 5000 }).catch(() => {});
const solvedAgain = await p.evaluate(() => ({
  lit: document.querySelectorAll('.cell.on').length,
  cells: document.querySelectorAll('.cell:not(.blank)').length
}));
console.log('solved again:', JSON.stringify(solvedAgain));
if (solvedAgain.lit !== solvedAgain.cells) problems.push('replayed level could not be solved again');

// A part-solved level also comes back blank. Resuming was the old behaviour; it was reported
// as a bug twice - a board arriving with letters you cannot remember placing is worse than a
// clean one - so leaving a level now discards the attempt.
await p.evaluate(() => loadLevel(1));   // level 2, fresh
const w = await p.evaluate(() => LEVELS[1].words[0]);
await p.evaluate(x => { game.picked = splitAksharas(x).map(a => game.wheel.indexOf(a)); submitWord(); }, w);
await p.waitForTimeout(800);
const partial = await p.evaluate(() => (game.found[LEVELS[1].id] || []).length);
await p.evaluate(() => loadLevel(2));   // wander off
await p.evaluate(() => loadLevel(1));   // come back
const afterLeaving = await p.evaluate(() => ({
  found: (game.found[LEVELS[1].id] || []).length,
  lit: document.querySelectorAll('.cell.on').length
}));
console.log('part-solved level, before leaving / after returning:', partial, JSON.stringify(afterLeaving));
if (partial !== 1) problems.push('the one word solved was never recorded in the first place');
if (afterLeaving.found !== 0 || afterLeaving.lit !== 0)
  problems.push(`part-solved level came back with ${afterLeaving.found} words / ${afterLeaving.lit} lit cells`);

// the initial-landing level should be the first NEVER-completed level, not just one that
// happens to look unsolved (which level 1 does again right after our replay wiped it)
const landing = await p.evaluate(() => LEVELS.findIndex(lv => !game.completed[lv.id]));
console.log('first uncompleted level index:', landing);
if (landing !== 1) problems.push(`landing calc says index ${landing}, expected 1 (level 1 completed, level 2 not)`);

await ctx.close();
await b.close();
console.log('\n' + (problems.length ? 'PROBLEMS:\n- ' + problems.join('\n- ') : 'ALL REPLAY CHECKS PASSED'));
process.exit(problems.length ? 1 : 0);
