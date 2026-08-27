import { launch, PAGE, serveDocs } from './harness.mjs';
const b = await launch();
const problems = [];
for (const [vp, name] of [[{width:360,height:640},'small phone'],[{width:390,height:844},'phone'],
                          [{width:820,height:1180},'tablet'],[{width:1280,height:900},'desktop']]) {
  const ctx = await b.newContext({ viewport: vp });
  const p = await ctx.newPage();
  await p.goto(PAGE);
  await p.waitForTimeout(500);
  const r = await p.evaluate(() => {
    const row = document.querySelector('.actions');
    const rb = row.getBoundingClientRect();
    const screen = document.querySelector('.screen').getBoundingClientRect();
    const btns = [...row.querySelectorAll('.action')].map(x => {
      const r = x.getBoundingClientRect();
      return { id: x.id, left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) };
    });
    return { rows: new Set(btns.map(x => Math.round(x.left))).size,
             fits: rb.left >= screen.left - 1 && rb.right <= screen.right + 1,
             overflowRight: Math.round(btns[btns.length-1].right - screen.right),
             overflowLeft: Math.round(screen.left - btns[0].left),
             btns, rowH: Math.round(rb.height) };
  });
  console.log(`${name}: rowH ${r.rowH}, fits=${r.fits}, spill L${r.overflowLeft}/R${r.overflowRight}, ` +
    r.btns.map(x => `${x.id}:${x.w}`).join(' '));
  if (!r.fits) problems.push(`${name}: actions row spills outside the screen (L${r.overflowLeft}, R${r.overflowRight})`);
  await ctx.close();
}
await b.close();
console.log('\n' + (problems.length ? 'PROBLEMS:\n- ' + problems.join('\n- ') : 'ACTIONS ROW FITS EVERYWHERE'));
process.exit(problems.length ? 1 : 0);
