import { launch, PAGE, serveDocs } from './harness.mjs';
const b = await launch();
const ctx = await b.newContext({ viewport: { width: 360, height: 640 } });
const p = await ctx.newPage();
p.on('pageerror', e => { console.log('PAGE ERROR', e.message); process.exitCode = 1; });
// The built page, not a copy of it. A stale copy in this directory made four sweeps pass
// against a file nobody was shipping.
await p.goto(PAGE);
await p.waitForFunction(() => document.querySelector('.tile'));

const path = (word) => p.evaluate(w => {
  const HAS='্', COMB=new Set(['ঁ','ং','ঃ','়','া','ি','ী','ু','ূ','ৃ','ৄ','ে','ৈ','ো','ৌ','ৗ','ৢ','ৣ',HAS]);
  const split=s=>{const u=[];let c='',j=false;for(const ch of s){if(COMB.has(ch)){c+=ch;j=ch===HAS;}else if(j){c+=ch;j=false;}else{if(c)u.push(c);c=ch;}}if(c)u.push(c);return u;};
  const tiles=[...document.querySelectorAll('.tile')];
  const used=new Set();
  return split(w).map(a=>{const i=tiles.findIndex((t,k)=>!used.has(k)&&t.textContent===a); if(i<0) return null; used.add(i);
    const r=tiles[i].getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2];});
}, word);

const n = await p.evaluate(() => LEVELS.length);
let bad = 0;
for (let i = 0; i < n; i++) {
  await p.waitForTimeout(1600);
  const info = await p.evaluate(async (i) => {
    loadLevel(i);
    await new Promise(r => setTimeout(r, 60));
    return { words: game.puzzle.words.map(w => w.word), rows: game.puzzle.rows, cols: game.puzzle.cols,
             tiles: document.querySelectorAll('.tile').length, id: LEVELS[i].id, name: String(LEVELS[i].letters || LEVELS[i].id) };
  }, i);
  let broke = null;
  for (const w of info.words) {
    const q = await path(w);
    if (q.some(x => !x)) { broke = `no tile for part of "${w}"`; break; }
    const mid = await p.evaluate(() => {
      const r = document.getElementById('wheel').getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2];
    });
    await p.mouse.move(...q[0]); await p.mouse.down();
    for (const c of q.slice(1)) {
      await p.mouse.move(mid[0], mid[1], { steps: 3 });
      await p.mouse.move(c[0], c[1], { steps: 3 });
    }
    await p.mouse.up();
    await p.waitForTimeout(240);
  }
  const st = await p.evaluate((id) => ({
    found: (game.found[id] || []).length,
    cleared: (game.completed || []).includes ? game.completed.includes(id) : !!game.completed[id],
    open: [...document.querySelectorAll('#board .cell:not(.blank)')].filter(c => !c.textContent.trim()).length }), info.id);
  const ok = !broke && st.found === info.words.length && st.open === 0 && st.cleared;
  if (!ok) { bad++; console.log(`FAIL L${i+1} ${info.letters}: ${broke || `${st.found}/${info.words.length} found, ${st.open} cells left blank, cleared=${st.cleared}`}`); }
  else console.log(`L${String(i+1).padStart(2)} ${info.name.padEnd(4)} ${info.rows}x${info.cols} ${info.tiles} tiles  ${st.found}/${info.words.length} solved, board full, level marked cleared`);
}
console.log(bad ? `${bad} LEVEL(S) FAILED` : `ALL ${n} LEVELS SOLVE AND FILL AT 360x640`);
if (bad) process.exitCode = 1;
await b.close();
