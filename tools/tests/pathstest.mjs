import { launch, PAGE, serveDocs } from './harness.mjs';
const b = await launch();
const problems = [];
const url = PAGE;

// The clear card is modal, so the only ways off a just-cleared level are its own two
// buttons. Each route below therefore starts from "cleared level 1, then left via the card".
const routes = {
  'prev arrow': async p => { await p.click('#prev'); },
  'next arrow, all the way round': async p => {
    const n = await p.evaluate(() => LEVELS.length);
    for (let i = 0; i < n - 1; i++) await p.click('#next');
  },
  'level grid': async p => {
    await p.evaluate(() => loadLevel(40));
    await p.evaluate(() => [...document.querySelectorAll('#levelGrid .lv')][0].click());
  },
  'page reload, then the grid': async p => {
    await p.reload();
    await p.waitForFunction(() => document.querySelector('.tile'));
    await p.evaluate(() => [...document.querySelectorAll('#levelGrid .lv')][0].click());
  }
};

for (const [name, go] of Object.entries(routes)) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(url);
  await p.waitForFunction(() => document.querySelector('.tile'));

  const words = await p.evaluate(() => LEVELS[0].words);
  for (const w of words) {
    await p.evaluate(x => { game.picked = splitAksharas(x).map(a => game.wheel.indexOf(a)); submitWord(); }, w);
    await p.waitForTimeout(60);
  }
  await p.waitForTimeout(1700);           // clearing it lands us on level 2 by itself
  await go(p);                            // ... and come back by this route
  await p.waitForTimeout(400);

  const s = await p.evaluate(() => ({
    onLevel: game.index + 1,
    lit: document.querySelectorAll('.cell.on').length,
    sub: (game.found[LEVELS[game.index].id] || []).length + ' / ' + game.puzzle.words.length + ' words',
    stars: document.querySelectorAll('#levelGrid .lv.done').length,
    completed: !!game.completed[LEVELS[0].id]
  }));
  console.log(`${name.padEnd(28)} -> level ${s.onLevel}, lit ${s.lit}, "${s.sub}", stars ${s.stars}`);
  if (s.onLevel !== 1) { problems.push(`${name}: ended on level ${s.onLevel}, expected 1`); await ctx.close(); continue; }
  if (s.lit !== 0) problems.push(`${name}: level 1 still shows ${s.lit} lit cells`);
  if (!s.completed) problems.push(`${name}: completed flag lost`);
  if (s.stars < 1) problems.push(`${name}: level grid lost its done star`);

  // and it must be solvable again by dragging, not just look blank
  const again = await p.evaluate(async () => {
    for (const w of LEVELS[0].words) {
      game.picked = splitAksharas(w).map(a => game.wheel.indexOf(a));
      submitWord();
      await new Promise(r => setTimeout(r, 60));
    }
    return { found: (game.found[LEVELS[0].id] || []).length, want: LEVELS[0].words.length };
  });
  if (again.found !== again.want) problems.push(`${name}: replay found ${again.found}/${again.want} words`);
  await ctx.close();
}

// The replay button on the clear card: stays on the level, blanks it, card goes away.
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(url);
  await p.waitForFunction(() => document.querySelector('.tile'));
  for (const w of await p.evaluate(() => LEVELS[0].words)) {
    await p.evaluate(x => { game.picked = splitAksharas(x).map(a => game.wheel.indexOf(a)); submitWord(); }, w);
    await p.waitForTimeout(60);
  }
  await p.waitForTimeout(1700);
  await p.evaluate(() => loadLevel(0));   // "play again" is walking back into level 1
  await p.waitForTimeout(400);
  const s = await p.evaluate(() => ({
    onLevel: game.index + 1,
    lit: document.querySelectorAll('.cell.on').length,
    stars: document.querySelectorAll('#levelGrid .lv.done').length
  }));
  console.log(`${'replay button'.padEnd(28)} -> level ${s.onLevel}, lit ${s.lit}, stars ${s.stars}`);
  if (s.onLevel !== 1) problems.push(`replay: moved to level ${s.onLevel}`);
  if (s.lit !== 0) problems.push(`replay: still ${s.lit} lit cells`);
  if (s.stars < 1) problems.push('replay: lost the done star');
  await ctx.close();
}

await b.close();
console.log('\n' + (problems.length ? 'PROBLEMS:\n- ' + problems.join('\n- ') : 'EVERY ROUTE BACK FINDS A BLANK, PLAYABLE BOARD'));
process.exit(problems.length ? 1 : 0);
