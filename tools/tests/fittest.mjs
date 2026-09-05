import { launch, PAGE, serveDocs } from './harness.mjs';
const b = await launch();
const problems = [];

const screens = [
  [{ width: 320, height: 568 }, 'iPhone SE 1st gen'],
  [{ width: 360, height: 640 }, 'small Android'],
  [{ width: 375, height: 667 }, 'iPhone 8'],
  [{ width: 390, height: 844 }, 'iPhone 14'],
  [{ width: 412, height: 915 }, 'Pixel 7'],
  [{ width: 640, height: 360 }, 'small phone landscape'],
  [{ width: 820, height: 1180 }, 'iPad portrait'],
  [{ width: 1024, height: 768 }, 'iPad landscape'],
];

for (const [vp, name] of screens) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: true });
  const p = await ctx.newPage();
  await p.goto(PAGE);
  await p.waitForFunction(() => document.querySelector('.tile'));

  const worst = await p.evaluate(async () => {
    const out = [];
    for (let i = 0; i < LEVELS.length; i++) {
      loadLevel(i);
      await new Promise(r => setTimeout(r, 12));
      const screen = document.querySelector('.screen').getBoundingClientRect();
      const style = getComputedStyle(document.querySelector('.screen'));
      const padL = parseFloat(style.paddingLeft), padR = parseFloat(style.paddingRight);
      const padT = parseFloat(style.paddingTop), padB = parseFloat(style.paddingBottom);
      const board = document.getElementById('board').getBoundingClientRect();
      const wheel = document.getElementById('wheel').getBoundingClientRect();
      const cell = document.querySelector('.cell:not(.blank)');
      const cw = cell ? cell.getBoundingClientRect().width : 0;
      out.push({
        id: i + 1,
        rows: game.puzzle.rows, cols: game.puzzle.cols,
        cell: Math.round(cw),
        // how far past the inner edges of the screen anything reaches
        wide: Math.round(Math.max(board.right - (screen.right - padR), (screen.left + padL) - board.left)),
        tall: Math.round(wheel.bottom - (screen.bottom - padB)),
        wheelWide: Math.round(wheel.width - (screen.width - padL - padR))
      });
    }
    return out;
  });

  const widest = worst.reduce((a, c) => (c.wide > a.wide ? c : a));
  const tallest = worst.reduce((a, c) => (c.tall > a.tall ? c : a));
  const tiniest = worst.reduce((a, c) => (c.cell < a.cell ? c : a));
  const maxCols = Math.max(...worst.map(x => x.cols));
  const maxRows = Math.max(...worst.map(x => x.rows));

  console.log(`${name.padEnd(22)} ${String(vp.width).padStart(4)}x${vp.height}  ` +
    `cells ${tiniest.cell}-${Math.max(...worst.map(x => x.cell))}px  ` +
    `grid up to ${maxRows}x${maxCols}  ` +
    `worst spill: side ${widest.wide}px (L${widest.id}), bottom ${tallest.tall}px (L${tallest.id})`);

  for (const x of worst) {
    if (x.wide > 1) problems.push(`${name}: level ${x.id} (${x.rows}x${x.cols}) board spills ${x.wide}px sideways`);
    if (x.tall > 1) problems.push(`${name}: level ${x.id} (${x.rows}x${x.cols}) wheel spills ${x.tall}px below the screen`);
    if (x.wheelWide > 1) problems.push(`${name}: level ${x.id} wheel is ${x.wheelWide}px wider than the screen`);
    if (x.cell < 16) problems.push(`${name}: level ${x.id} cells down to ${x.cell}px, unreadable`);
  }
  await ctx.close();
}

await b.close();
const uniq = [...new Set(problems)];
console.log('\n' + (uniq.length ? `PROBLEMS (${uniq.length}):\n- ` + uniq.slice(0, 25).join('\n- ') : 'EVERYTHING FITS'));
process.exit(uniq.length ? 1 : 0);
