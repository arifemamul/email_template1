/*
 * The menu bar and the two alphabet charts.
 *
 * The charts are built from LEVELS rather than written out, which is the whole reason they are
 * worth testing: a hand-written চার্ট of the বর্ণমালা goes quietly wrong the first time a refit
 * changes how many levels ক has, and nobody notices because a chart is not something you play.
 * This counts what the page shows against what the page holds.
 */
import { launch, PAGE, report } from './harness.mjs';

const problems = [];
const b = await launch();

// ---- desktop: the menu is part of the page --------------------------------------------
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
const p = await ctx.newPage();
p.on('pageerror', e => problems.push('pageerror: ' + e.message));
p.on('console', m => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
await p.goto(PAGE);
await p.waitForFunction(() => document.querySelector('.tile') && document.querySelector('#menu .tab'));

const PAGES = ['vowels', 'consonants', 'marks', 'levels', 'about', 'play'];

// ---- one section at a time, and the one you clicked ------------------------------------
for (const key of PAGES) {
  await p.click(`#tab-${key}`);
  const state = await p.evaluate(k => {
    const shown = [...document.querySelectorAll('.pages .page')]
      .filter(x => getComputedStyle(x).display !== 'none').map(x => x.id);
    const tab = document.querySelector(`#tab-${k}`);
    return { shown, selected: tab.getAttribute('aria-selected'), lit: tab.classList.contains('on') };
  }, key);
  if (state.shown.length !== 1 || state.shown[0] !== `page-${key}`) {
    problems.push(`${key}: showing [${state.shown}], expected only page-${key}`);
  }
  if (state.selected !== 'true') problems.push(`${key}: tab not marked selected`);
  if (!state.lit) problems.push(`${key}: tab not lit`);
}

// ---- the charts count what the game actually holds -------------------------------------
const charts = await p.evaluate(() => {
  const read = id => [...document.querySelectorAll('#' + id + ' .ch')].map(c => ({
    letter: c.querySelector('.ch-l').textContent,
    shown: c.querySelector('.ch-n').textContent,
    clickable: c.tagName === 'BUTTON'
  }));
  const truth = {};
  for (const lv of LEVELS) truth[lv.name[0]] = (truth[lv.name[0]] || 0) + 1;
  return { vowels: read('chartVowels'), consonants: read('chartConsonants'), truth,
           bn: n => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[+d]) };
});
const bn = n => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[+d]);

if (charts.vowels.length !== 11) problems.push(`${charts.vowels.length} vowels charted, expected 11`);
if (charts.consonants.length !== 32)
  problems.push(`${charts.consonants.length} consonants charted, expected 32 (ক to হ)`);

for (const tile of [...charts.vowels, ...charts.consonants]) {
  const real = charts.truth[tile.letter] || 0;
  const want = real ? bn(real) : '—';
  if (tile.shown !== want) {
    problems.push(`${tile.letter}: chart says "${tile.shown}", the game has ${real} level(s)`);
  }
  if (tile.clickable !== real > 0) {
    problems.push(`${tile.letter}: ${tile.clickable ? 'is' : 'is not'} a button, but has ${real} level(s)`);
  }
}

// Exactly the three letters no Bengali word begins with should be dead.
const dead = [...charts.vowels, ...charts.consonants].filter(t => !t.clickable).map(t => t.letter);
if (dead.join('') !== 'ঙঞণ') problems.push(`letters with no level: [${dead.join(' ')}], expected ঙ ঞ ণ`);

// ---- tapping a letter opens that letter's first level ----------------------------------
await p.click('#tab-consonants');
const jumped = await p.evaluate(async () => {
  const tiles = [...document.querySelectorAll('#chartConsonants .ch')];
  const m = tiles.find(t => t.querySelector('.ch-l').textContent === 'ম');
  m.click();
  await new Promise(r => requestAnimationFrame(r));
  return { name: LEVELS[game.index].name, index: game.index,
           firstM: LEVELS.findIndex(lv => lv.name[0] === 'ম') };
});
if (jumped.name[0] !== 'ম') problems.push(`tapping ম opened ${jumped.name}`);
if (jumped.index !== jumped.firstM)
  problems.push(`tapping ম opened level ${jumped.index + 1}, not its first (${jumped.firstM + 1})`);

// ---- every কার row shows a real word that really carries the sign -----------------------
await p.click('#tab-marks');
const marks = await p.evaluate(() => [...document.querySelectorAll('#markTable .mk')].map(r => ({
  glyph: r.querySelector('.mk-g').textContent,
  eg: r.querySelector('.mk-eg').textContent,
  live: r.querySelector('.mk-eg').tagName === 'BUTTON',
  onBoard: [...LEVELS].some(lv => lv.words.includes(r.querySelector('.mk-eg').textContent))
})));
if (marks.length !== 13) problems.push(`${marks.length} mark rows, expected 13 (10 কার + 3 signs)`);
for (const m of marks) {
  if (!m.live) problems.push(`${m.glyph}: no example word in the game carries this sign`);
  else if (!m.onBoard) problems.push(`${m.glyph}: example "${m.eg}" is on no board`);
}
console.log(`charts: ${charts.vowels.length} vowels, ${charts.consonants.length} consonants, `
          + `${marks.length} marks; ${dead.length} letters without levels (${dead.join(' ')})`);

// ---- বারোখড়ি: a picker of 32 letters, and twelve forms for whichever is chosen ---------
const KARS_IN_ORDER = ['', 'া', 'ি', 'ী', 'ু', 'ূ', 'ৃ', 'ে', 'ৈ', 'ো', 'ৌ', 'ং'];
const pickers = await p.$$eval('.bp', bs => bs.map(x => x.textContent));
if (pickers.length !== 32) problems.push(`${pickers.length} letters in the বারোখড়ি picker, expected 32`);
if (pickers.join('') !== 'কখগঘঙচছজঝঞটঠডঢণতথদধনপফবভমযরলশষসহ')
  problems.push('the বারোখড়ি picker is not the consonants in alphabet order');

for (const letter of ['ক', 'ম', 'ঙ', 'হ']) {
  await p.evaluate(l => [...document.querySelectorAll('.bp')].find(x => x.textContent === l).click(), letter);
  const rows = await p.$$eval('.br', rs => rs.map(r => ({
    form: r.querySelector('.br-f').textContent,
    isLevel: r.querySelector('.br-go').classList.contains('br-lvl'),
    label: r.querySelector('.br-go').textContent,
    dead: r.querySelector('.br-go').classList.contains('br-none')
  })));
  if (rows.length !== 12) { problems.push(`${letter}: ${rows.length} forms, expected 12`); continue; }
  // Every row is that letter under the kar for its position, in order.
  rows.forEach((r, i) => {
    const want = letter + KARS_IN_ORDER[i];
    if (r.form !== want) problems.push(`${letter} row ${i + 1}: shows ${r.form}, expected ${want}`);
  });
  // A row marked as a level must really be a level whose whole subject is that akshara.
  const claims = await p.evaluate(ls => ls.map(f => LEVELS.findIndex(lv => lv.name === f)),
                                  rows.map(r => r.form));
  rows.forEach((r, i) => {
    if (r.isLevel && claims[i] < 0)
      problems.push(`${r.form}: offered as a level, but no level is named ${r.form}`);
    if (!r.isLevel && !r.dead && claims[i] >= 0)
      problems.push(`${r.form}: has a level of its own but is shown as a mere example`);
  });
  // The picker marks which letter you are looking at.
  const lit = await p.$$eval('.bp.on', bs => bs.map(x => x.textContent));
  if (lit.length !== 1 || lit[0] !== letter)
    problems.push(`${letter}: picker highlights [${lit}]`);
}

// A row's word or level opens something real.
await p.evaluate(() => [...document.querySelectorAll('.bp')].find(x => x.textContent === 'ক').click());
const opened = await p.evaluate(async () => {
  const go = [...document.querySelectorAll('.br .br-go')].find(b => b.tagName === 'BUTTON');
  const before = game.index;
  go.click();
  await new Promise(r => requestAnimationFrame(r));
  return { before, after: game.index, label: go.textContent };
});
if (opened.after === undefined) problems.push('a বারোখড়ি row opened nothing');
console.log(`বারোখড়ি: ${pickers.length} letters, 12 forms each, "${opened.label}" opened level ${opened.after + 1}`);

// ---- phone: the whole menu is behind the one button ------------------------------------
const phone = await (await b.newContext({ viewport: { width: 360, height: 640 } })).newPage();
await phone.goto(PAGE);
await phone.waitForFunction(() => document.querySelector('.tile'));
if (await phone.isVisible('#menu')) problems.push('the menu is on screen before the button is pressed');
await phone.click('#guideOpen');
await phone.waitForSelector('#menu', { state: 'visible', timeout: 5000 })
  .catch(() => problems.push('the menu did not open on a phone'));
for (const key of PAGES) {
  await phone.click(`#tab-${key}`).catch(() => problems.push(`${key}: tab not tappable on a phone`));
}
// And the game is still playable underneath once it closes.
await phone.click('#guideClose');
const back = await phone.evaluate(() => ({
  menuGone: getComputedStyle(document.querySelector('#menu')).display === 'none'
            || !document.querySelector('.guide').classList.contains('open'),
  tiles: document.querySelectorAll('.tile').length,
  cell: Math.round(document.querySelector('.cell').getBoundingClientRect().width)
}));
if (!back.menuGone) problems.push('the menu stayed open after Close');
if (!back.tiles) problems.push('no wheel after closing the menu');
if (back.cell < 30) problems.push(`cells are ${back.cell}px after closing the menu, under the 30px floor`);

await b.close();
report(problems, 'MENU OK: six sections, charts and বারোখড়ি counted from the game, letters open their levels');
