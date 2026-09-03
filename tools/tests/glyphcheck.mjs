// The letter no longer scales with its box, so the box has to be big enough for the tallest
// letter in the game. Measures every akshara at GLYPH px and checks it fits GLYPH_BOX, and
// that no cell or tile on any level at any screen size is drawn smaller than GLYPH_BOX.
import { launch, PAGE, serveDocs } from './harness.mjs';
const problems = [];
const b = await launch();
const ctx = await b.newContext({ viewport: { width: 360, height: 640 } });
const p = await ctx.newPage();
await p.goto(PAGE);
await p.waitForFunction(() => document.querySelector('.tile'));

const m = await p.evaluate(() => {
  const all = [...new Set(LEVELS.flatMap(l => l.letters))];
  const probe = document.createElement('span');
  probe.style.cssText = `position:absolute;visibility:hidden;font-family:var(--bn);` +
    `font-weight:700;font-size:${GLYPH}px;white-space:nowrap;line-height:1;`;
  document.body.appendChild(probe);
  const out = [];
  for (const a of all) {
    probe.textContent = a;
    const r = probe.getBoundingClientRect();
    out.push({ a, w: +r.width.toFixed(1), h: +r.height.toFixed(1) });
  }
  probe.remove();
  return { GLYPH, GLYPH_BOX, boxes: out };
});
console.log(`GLYPH ${m.GLYPH}px in a ${m.GLYPH_BOX}px box, ${m.boxes.length} distinct aksharas`);
const tallest = m.boxes.reduce((a, c) => c.h > a.h ? c : a);
const widest  = m.boxes.reduce((a, c) => c.w > a.w ? c : a);
console.log(`tallest "${tallest.a}" ${tallest.h}px   widest "${widest.a}" ${widest.w}px`);
for (const g of m.boxes) {
  if (g.h > m.GLYPH_BOX) problems.push(`"${g.a}" is ${g.h}px tall, taller than the ${m.GLYPH_BOX}px box`);
  if (g.w > m.GLYPH_BOX) problems.push(`"${g.a}" is ${g.w}px wide, wider than the ${m.GLYPH_BOX}px box`);
}

// -- and no box on any level at any size goes below the floor, or renders a different size --
for (const [w, h, name] of [[320,568,'iPhone SE'],[360,640,'small Android'],[412,915,'Pixel 7'],
                            [820,1180,'iPad'],[1280,900,'desktop']]) {
  const q = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
  await q.goto(PAGE);
  await q.waitForFunction(() => document.querySelector('.tile'));
  const r = await q.evaluate(async () => {
    let minCell = 1e9, minTile = 1e9, fonts = new Set(), worst = null;
    for (let i = 0; i < LEVELS.length; i++) {
      loadLevel(i);
      await new Promise(r => setTimeout(r, 12));
      const c = document.querySelector('.cell:not(.blank)');
      const t = document.querySelector('.tile');
      const cw = c.getBoundingClientRect().width, tw = t.getBoundingClientRect().width;
      if (cw < minCell) { minCell = cw; worst = i + 1; }
      minTile = Math.min(minTile, tw);
      fonts.add(getComputedStyle(c.querySelector('span')).fontSize);
      fonts.add(getComputedStyle(t).fontSize);
    }
    // and the real thing: no letter may reach the edge of the box it is drawn in
    let tightest = null;
    for (let i = 0; i < LEVELS.length; i++) {
      loadLevel(i);
      await new Promise(r => setTimeout(r, 12));
      // An unsolved cell holds its letter at scale(.62) with opacity 0, so measure it the way
      // a solved one is drawn - otherwise every clearance reads 38% too generous.
      for (const sp of document.querySelectorAll('.cell:not(.blank) span')) {
        sp.style.transition = 'none'; sp.style.transform = 'none'; sp.style.opacity = '1';
      }
      for (const c of document.querySelectorAll('.cell:not(.blank)')) {
        const box = c.getBoundingClientRect(), g = c.querySelector('span').getBoundingClientRect();
        const air = Math.min(box.width - g.width, box.height - g.height);
        if (!tightest || air < tightest.air)
          tightest = { air: +air.toFixed(1), letter: c.textContent, level: i + 1 };
      }
      for (const t of document.querySelectorAll('.tile')) {
        const box = t.getBoundingClientRect();
        const r = document.createRange(); r.selectNodeContents(t);
        const g = r.getBoundingClientRect();
        const air = Math.min(box.width - g.width, box.height - g.height);
        if (!tightest || air < tightest.air)
          tightest = { air: +air.toFixed(1), letter: t.textContent, level: i + 1, tile: true };
      }
    }
    return { minCell: Math.round(minCell), minTile: Math.round(minTile), worst, fonts: [...fonts], tightest };
  });
  console.log(`${name.padEnd(14)} ${String(w).padStart(4)}x${h}  smallest cell ${r.minCell}px (L${r.worst}), ` +
              `smallest tile ${r.minTile}px, letter ${r.fonts.join(' / ')}`);
  if (r.fonts.length !== 1) problems.push(`${name}: letters drawn at ${r.fonts.length} different sizes (${r.fonts})`);
  if (r.fonts[0] !== m.GLYPH + 'px') problems.push(`${name}: letters drawn at ${r.fonts[0]}, expected ${m.GLYPH}px`);
  if (r.minCell < m.GLYPH_BOX) problems.push(`${name}: a cell is ${r.minCell}px, under the ${m.GLYPH_BOX}px floor`);
  if (r.minTile < m.GLYPH_BOX) problems.push(`${name}: a tile is ${r.minTile}px, under the ${m.GLYPH_BOX}px floor`);
  console.log(`${' '.repeat(14)} tightest fit: "${r.tightest.letter}" on L${r.tightest.level}` +
              `${r.tightest.tile ? ' (wheel)' : ''} with ${r.tightest.air}px to spare`);
  if (r.tightest.air < 2)
    problems.push(`${name}: "${r.tightest.letter}" has only ${r.tightest.air}px clearance in its box (L${r.tightest.level})`);
}
// -- box sizes across levels ---------------------------------------------------------------
// This used to require one box size per screen, whatever the level. The reason was real: a box
// sized from whichever board was open gave a wide half-empty grid 30px cells and a small board
// 46px on the same phone, and with the letter fixed at 17px either way it read as cramped on
// one level and lost in space on the next.
//
// Reversed at the author's request, who wants the board as large as it can be on every level.
// What has changed since that decision is the ceiling: the cap is 60px now rather than 46, and
// the column counts are lopsided - of 244 boards, one is seven columns wide, 27 are six, and
// the remaining 216 are five or fewer. Sizing every board for the widest one meant 243 levels
// paid for a single seven-column board. So the spread is narrow where it exists at all: no
// variation on a desktop or an iPad, and 60/50/42 on a 390px phone with 216 levels at 60.
//
// The floor still holds - no box under GLYPH_BOX - and so does everything in the next block,
// which is where the part of the old rule worth keeping now lives: the board's slot and the
// wheel below it may not move when the level changes.
for (const [w, h, name] of [[320,568,'iPhone SE'],[360,640,'small Android'],
                            [412,915,'Pixel 7'],[820,1180,'iPad'],[1280,900,'desktop']]) {
  const q = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
  await q.goto(PAGE);
  await q.waitForFunction(() => document.querySelector('.tile'));
  const r = await q.evaluate(async () => {
    const cells = new Map(), tiles = new Map();
    for (let i = 0; i < LEVELS.length; i++) {
      loadLevel(i);
      await new Promise(r => setTimeout(r, 8));
      const c = Math.round(document.querySelector('.cell:not(.blank)').getBoundingClientRect().width);
      const t = Math.round(document.querySelector('.tile').getBoundingClientRect().width);
      if (!cells.has(c)) cells.set(c, i + 1);
      if (!tiles.has(t)) tiles.set(t, i + 1);
    }
    return { cells: [...cells], tiles: [...tiles] };
  });
  const cellSizes = r.cells.map(([px]) => px), tileSizes = r.tiles.map(([px]) => px);
  console.log(`${name.padEnd(14)} box ${cellSizes.join('/')}px   tile ${tileSizes.join('/')}px`);
  // A box may be as big as its own level allows, up to the cap, and never under the floor.
  const under = cellSizes.filter(px => px < 30);
  if (under.length)
    problems.push(`${name}: cells drawn at ${under.join('/')}px, under the 30px box floor`);
  if (tileSizes.length !== 1)
    problems.push(`${name}: wheel tiles drawn at ${tileSizes.length} sizes across levels ` +
                  `(${r.tiles.map(([px, lv]) => `${px}px on L${lv}`).join(', ')})`);
}

// -- nothing moves or resizes when the level changes --------------------------------------
// Sizes being constant is not enough on its own: the board slot used to be only as tall as the
// open level needed, so the wheel sat anywhere from 381px to 445px down a 360px phone and the
// whole lower half of the game jumped on every level change. And the wheel tile must be the
// larger of the two - it is what the player reads and aims at, while the board is a record of
// what has been found.
for (const [w, h, name] of [[320,568,'iPhone SE'],[360,640,'small Android'],
                            [412,915,'Pixel 7'],[1280,900,'desktop']]) {
  const q = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
  await q.goto(PAGE);
  await q.waitForFunction(() => document.querySelector('.tile'));
  const r = await q.evaluate(async () => {
    const seen = {};
    const note = (k, v, lv) => { (seen[k] = seen[k] || new Map()).set(v, seen[k].get(v) ?? lv); };
    for (let i = 0; i < LEVELS.length; i++) {
      loadLevel(i);
      await new Promise(r => setTimeout(r, 8));
      const wheel = document.getElementById('wheel').getBoundingClientRect();
      const area = document.querySelector('.board-area').getBoundingClientRect();
      note('tile size', Math.round(document.querySelector('.tile').getBoundingClientRect().width), i + 1);
      note('cell size', Math.round(document.querySelector('.cell:not(.blank)').getBoundingClientRect().width), i + 1);
      note('wheel diameter', Math.round(wheel.width), i + 1);
      note('wheel top', Math.round(wheel.top), i + 1);
      note('board slot height', Math.round(area.height), i + 1);
      note('board top', Math.round(area.top), i + 1);
    }
    const out = {};
    for (const [k, m] of Object.entries(seen)) out[k] = [...m.entries()];
    return out;
  });
  // Cell size is allowed to vary now, and only cell size. A board is drawn at the size its own
  // columns allow rather than at the size the widest board in the game allows - 243 of the 244
  // levels were paying for the one seven-column board - and the letter inside the box is a
  // fixed GLYPH either way, so a wider box is more air around the same letter.
  //
  // Everything else must still hold still. The slot the board sits in is reserved at what
  // height allows for the tallest board, not at what this level uses, so the wheel below it
  // does not move when the level changes: that was the reason every board was sized for the
  // widest one, and it is the part worth keeping.
  const MAY_VARY = new Set(['cell size']);
  const moving = Object.entries(r).filter(([k, v]) => v.length > 1 && !MAY_VARY.has(k));
  const cells = r['cell size'].map(([v]) => v);
  console.log(`${' '.repeat(14)} cells ${Math.min(...cells)}-${Math.max(...cells)}px `
            + `across ${r['cell size'].length} distinct sizes, slot fixed at `
            + `${r['board slot height'][0][0]}px`);
  if (Math.min(...cells) < m.GLYPH_BOX)
    problems.push(`${name}: a cell is ${Math.min(...cells)}px, under the ${m.GLYPH_BOX}px floor`);
  const tile = r['tile size'][0][0], cell = Math.max(...r['cell size'].map(([v]) => v));
  console.log(`${name.padEnd(14)} tile ${tile}px, cell ${cell}px, ` +
              `${moving.length ? moving.length + ' MEASURES VARY' : 'nothing varies across levels'}`);
  for (const [k, vals] of moving)
    problems.push(`${name}: ${k} changes with the level - ` +
                  vals.map(([v, lv]) => `${v}px from L${lv}`).join(', '));
  // The wheel must never read weaker than the board. On the smallest screen both land on the
  // glyph's floor and come out equal: a 320x568 screen has 300px for board and wheel together,
  // and a five-row board at the smallest box a 17px letter fits takes 170 of it. Equal is the
  // floor, smaller is a bug.
  if (tile < cell)
    problems.push(`${name}: wheel tile ${tile}px is smaller than a board cell ${cell}px - ` +
                  `the letters being chosen from must not read weaker than the boxes being filled`);
}

await b.close();
if (problems.length) { console.log('\nPROBLEMS:'); problems.forEach(x => console.log(' - ' + x)); process.exitCode = 1; }
else console.log('\nEVERY LETTER IS ONE SIZE AND EVERY BOX HOLDS IT');
