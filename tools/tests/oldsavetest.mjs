import { launch, PAGE, serveDocs } from './harness.mjs';
const b = await launch();
const problems = [];
const url = PAGE;

// Someone who played before this change: their save has `found` but no `completed`.
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const seed = await ctx.newPage();
await seed.goto(url);
const oldSave = await seed.evaluate(() => {
  // pretend levels 1..5 were fully solved under the old format
  const found = {};
  for (let i = 0; i < 5; i++) found[LEVELS[i].id] = LEVELS[i].words.slice();
  // coins, extras and chest are dead keys from a build that scored the player and had an
  // extra-words chest. A save written by that build must still load, dead keys ignored.
  return JSON.stringify({ coins: 400, found, hints: {}, extras: { 1: ["কমল"] }, chest: 2 });
});
await seed.evaluate(v => localStorage.setItem('shobdojot', v), oldSave);
await seed.close();

const p = await ctx.newPage();
await p.goto(url);
await p.waitForFunction(() => document.querySelector('.tile'));
const state = await p.evaluate(() => ({
  landedOn: game.index + 1,
  purse: 'coins' in game,
  completedCount: Object.keys(game.completed).length,
  doneStars: document.querySelectorAll('#levelGrid .lv.done').length,
  foundKeys: Object.keys(game.found).length
}));
console.log('returning player:', JSON.stringify(state));
if (state.purse) problems.push('a coin balance came back from an old save');
if (state.completedCount !== 5) problems.push(`old save: ${state.completedCount} levels counted completed, expected 5`);
if (state.doneStars !== 5) problems.push(`old save: ${state.doneStars} done stars in the grid, expected 5`);
if (state.landedOn !== 6) problems.push(`old save: landed on level ${state.landedOn}, expected 6 (first unfinished)`);

// and one of those old levels must open blank and playable
await p.evaluate(() => loadLevel(0));
await p.waitForTimeout(200);
const lvl1 = await p.evaluate(() => ({
  lit: document.querySelectorAll('.cell.on').length,
  sub: (game.found[LEVELS[game.index].id] || []).length + ' / ' + game.puzzle.words.length + ' words',
  stillDone: document.querySelectorAll('#levelGrid .lv.done').length
}));
console.log('old solved level reopened:', JSON.stringify(lvl1));
if (lvl1.lit !== 0) problems.push(`old solved level shows ${lvl1.lit} lit cells`);
if (lvl1.stillDone !== 5) problems.push('done stars lost after reopening an old solved level');

await ctx.close();
await b.close();
console.log('\n' + (problems.length ? 'PROBLEMS:\n- ' + problems.join('\n- ') : 'OLD-SAVE MIGRATION OK'));
process.exit(problems.length ? 1 : 0);
