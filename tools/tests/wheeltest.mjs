// The wheel must not hand the player a word already spelled out around the ring, and the
// arrangement must be the same every time a level is opened.
import { launch, PAGE, serveDocs } from './harness.mjs';
const b = await launch();
const problems = [];
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
await p.goto(PAGE);
await p.waitForFunction(() => document.querySelector('.tile'));

const survey = await p.evaluate(() => {
  const out = [];
  for (const lv of LEVELS) {
    const order = scrambleWheel(lv);
    out.push({
      id: lv.id, n: order.length,
      inOrder: order.join('') === lv.letters.join(''),
      stable: scrambleWheel(lv).join('') === order.join(''),
      spelled: lv.words.filter(w => ringRun(order, w) === 2 && splitAksharas(w).length > 2),
      pairs: lv.words.filter(w => ringRun(order, w) === 2 && splitAksharas(w).length === 2).length
    });
  }
  return out;
});

const unstable = survey.filter(s => !s.stable);
const unchanged = survey.filter(s => s.inOrder && s.n > 3);
const spelling = survey.filter(s => s.spelled.length && s.n > 3);
const pairsTouching = survey.reduce((n, s) => n + s.pairs, 0);
console.log(`${survey.length} levels: ${unchanged.length} left in catalogue order, `
          + `${spelling.length} laying out a word of 3+ letters in ring sequence, `
          + `${pairsTouching} two-letter words on neighbouring tiles`);
for (const s of spelling) console.log(`  level ${s.id}: ${s.n} tiles spells ${s.spelled.join(' ')}`);

if (unstable.length) problems.push(`${unstable.length} levels scramble differently each call`);
// A three-tile wheel is a triangle: every arrangement is a run, so there is nothing to hide.
// Any wider wheel must not lay a whole word out in sequence around the ring.
if (spelling.length) problems.push(`${spelling.length} wheels spell a word of 3+ letters in ring order: `
                                 + spelling.map(s => s.id).join(' '));
if (unchanged.length) problems.push(`${unchanged.length} wheels are still in catalogue order`);

// and the order the page actually draws matches the scramble, level after level
const drawn = await p.evaluate(() => {
  const out = [];
  for (let i = 0; i < Math.min(12, LEVELS.length); i++) {
    loadLevel(i);
    out.push({ id: LEVELS[i].id,
               tiles: [...document.querySelectorAll('.tile')].map(t => t.textContent),
               wheel: game.wheel.slice(),
               expected: scrambleWheel(LEVELS[i]) });
  }
  return out;
});
for (const d of drawn) {
  if (d.wheel.join('') !== d.expected.join(''))
    problems.push(`level ${d.id}: wheel ${d.wheel.join('')} is not the scramble ${d.expected.join('')}`);
  if (d.tiles.join('') !== d.wheel.join(''))
    problems.push(`level ${d.id}: tiles drawn ${d.tiles.join('')} do not match the wheel ${d.wheel.join('')}`);
}

// reopening a level finds the letters where they were left
const twice = await p.evaluate(() => {
  const other = Math.min(20, LEVELS.length - 1);
  loadLevel(2); const a = game.wheel.slice();
  loadLevel(other); loadLevel(2); return [a, game.wheel.slice()];
});
if (twice[0].join('') !== twice[1].join(''))
  problems.push(`revisiting a level rearranged its wheel: ${twice[0].join('')} -> ${twice[1].join('')}`);


// -- twin tiles are never neighbours -----------------------------------------------------
// A wheel can carry the same akshara twice, for a word that uses it twice. Side by side, a
// drag from one to the other runs over the twin and spells the wrong word.
{
  const twins = await p.evaluate(() => {
    const out = [];
    for (let i = 0; i < LEVELS.length; i++) {
      loadLevel(i);
      const ring = [...document.querySelectorAll('.tile')].map(t => t.textContent);
      const dupes = ring.filter((a, k) => ring.indexOf(a) !== k);
      if (!dupes.length) continue;
      const touching = ring.filter((a, k) => a === ring[(k + 1) % ring.length]);
      out.push({ level: i + 1, id: LEVELS[i].id, ring, touching });
    }
    return out;
  });
  const bad = twins.filter(t => t.touching.length);
  console.log(`${twins.length} levels carry a repeated tile; ${bad.length} place a pair side by side`);
  for (const t of bad) problems.push(`level ${t.level} (${t.id}) has ${t.touching.join(',')} next to its twin: ${t.ring.join(' ')}`);
}

await b.close();
console.log('\n' + (problems.length ? 'PROBLEMS:\n- ' + problems.join('\n- ')
                                    : 'THE WHEEL IS SCRAMBLED, STABLE, AND DRAWN AS SCRAMBLED'));
process.exit(problems.length ? 1 : 0);
