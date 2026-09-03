/*
 * The menu bar, the two alphabet charts and the বারোখড়ি.
 *
 * The charts are built from LEVELS rather than written out, which is the whole reason they are
 * worth testing: a hand-written চার্ট of the বর্ণমালা goes quietly wrong the first time a refit
 * changes how many levels ক has, and nobody notices because a chart is not something you play.
 * This counts what the page shows against what the page holds.
 */
import { launch, PAGE, report, openSection } from './harness.mjs';

const problems = [];
const b = await launch();

// ---- desktop: the menu is part of the page --------------------------------------------
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
const p = await ctx.newPage();
p.on('pageerror', e => problems.push('pageerror: ' + e.message));
p.on('console', m => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
await p.goto(PAGE);
await p.waitForFunction(() => document.querySelector('.tile') && document.querySelector('#menuPop .opt'));

// Read off the page rather than written out here. A hardcoded list silently stops testing
// whatever gets added next: two sections were added and this file kept passing, because it was
// still checking the six it knew about. The tab bar and the sections also have to agree with
// each other, and that agreement is itself worth asserting.
const PAGES = await p.$$eval('#menuPop .opt', os => os.map(o => o.dataset.page));
const SECTIONS = await p.$$eval('.pages .page', ss => ss.map(s => s.id.replace(/^page-/, '')));
// The order here is the menu's, which is the teaching order a child meets them in: the letters,
// then what the letters take, then how letters join into words, then the game, then the rest.
const EXPECTED = ['vowels', 'consonants', 'marks', 'gathon', 'phala', 'jukto',
                  'levels', 'play', 'about', 'report'];
if (PAGES.join() !== EXPECTED.join())
  problems.push(`options are [${PAGES}], expected [${EXPECTED}]`);
// Compared as sets, not as sequences. They used to have to be in the same order because the
// menu was a flat bar mirroring the sections; grouping the options moved খেলার নিয়ম up beside
// লেভেল, so the two orders differ on purpose now. What still has to hold is that there is a
// section behind every option and an option in front of every section.
const missing = PAGES.filter(k => !SECTIONS.includes(k));
const stranded = SECTIONS.filter(k => !PAGES.includes(k));
if (missing.length) problems.push(`options with no section: [${missing}]`);
if (stranded.length) problems.push(`sections with no option: [${stranded}]`);

// ---- one section at a time, and the one you clicked ------------------------------------
for (const key of PAGES) {
  await openSection(p, key);
  const state = await p.evaluate(k => {
    const shown = [...document.querySelectorAll('.pages .page')]
      .filter(x => getComputedStyle(x).display !== 'none').map(x => x.id);
    const opt = document.querySelector(`#opt-${k}`);
    return {
      shown,
      current: opt.getAttribute('aria-current'),
      lit: opt.classList.contains('on'),
      // The head of the panel names the section. It used to say "মেনু" for all ten.
      head: document.getElementById('guideTitle').textContent.trim(),
      says: opt.querySelector('.opt-t b').textContent.trim(),
      // Choosing an option puts the options away; leaving them open over the thing you just
      // asked to read is how a menu becomes a wall.
      popOpen: !document.getElementById('menuPop').hidden,
    };
  }, key);
  if (state.shown.length !== 1 || state.shown[0] !== `page-${key}`) {
    problems.push(`${key}: showing [${state.shown}], expected only page-${key}`);
  }
  if (state.current !== 'true') problems.push(`${key}: option not marked as the current one`);
  if (!state.lit) problems.push(`${key}: option not lit`);
  if (state.head !== state.says)
    problems.push(`${key}: the head says "${state.head}", the option says "${state.says}"`);
  if (state.popOpen) problems.push(`${key}: the options stayed open after choosing one`);
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
await openSection(p, 'consonants');
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
await openSection(p, 'marks');
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
// ---- each vowel beside its own কার ------------------------------------------------------
// The pairing is the whole content of that strip, so what is worth checking is that it agrees
// with the table under it rather than that ten swatches exist. A swatch claims "ই becomes ি";
// the row below claims "ি is called ই-কার". Both come from KARS, and if either is edited
// without the other this is what says so.
//
// The sign is drawn, not typed, because a lone কার cannot be set as text - three of the ten
// have zero advance width and paint nothing, and on a space the shaper inserts a dotted circle.
// So the second thing checked here is that the drawing is the right drawing: the outline in the
// page for the sign the label names, and no dotted circle anywhere in the strip.
const pairs = await p.evaluate(() => {
  const nameToSign = {};
  for (const [sign, name] of KARS) nameToSign[name] = sign;
  return [...document.querySelectorAll('#karPairs .pair')].map(x => {
    const svg = x.querySelector('.pair-k svg');
    const label = x.getAttribute('aria-label');
    const want = nameToSign[label];
    return {
      label,
      vowel: x.querySelector('.pair-v').textContent,
      wantSign: want,
      // The outline the page holds for the sign this pair claims to show. Compared as path
      // data rather than as markup: the browser rewrites innerHTML - a self-closing <path/>
      // comes back as <path></path> - so comparing the strings compares the browser's
      // formatting, which is a check that fails on everything and means nothing.
      matchesShape: !!(svg && want && KAR_SHAPES[want]
                    && svg.getAttribute('viewBox') === KAR_SHAPES[want].box
                    && JSON.stringify([...svg.querySelectorAll('path')].map(q => q.getAttribute('d')))
                       === JSON.stringify([...KAR_SHAPES[want].paths.matchAll(/ d="([^"]*)"/g)]
                                          .map(m => m[1]))),
      pieces: svg ? svg.querySelectorAll('path').length : 0,
      block: x.dataset.block,
      // Nothing in the pair may be read aloud but the label: a lone combining mark is noise.
      hidden: [...x.querySelectorAll('[aria-hidden="true"]')].length,
      // The ink, not the box - a shape that renders at zero height is a shape nobody can see.
      ink: svg ? Math.round(svg.querySelector('g').getBoundingClientRect().height) : 0,
    };
  });
});
// ো and ৌ have precomposed glyphs in the font and both are drawn WITH a dotted circle baked
// into the outline - the font means them for a character chart. They have to be built from
// their pieces (ে + া, ে + ৗ) instead, and two paths rather than one is what says they were.
const TWO_PIECE = { 'ও-কার': 2, 'ঔ-কার': 2 };
if (pairs.length !== 10) problems.push(`${pairs.length} কার pairs, expected 10`);
for (const pr of pairs) {
  if (pr.label !== `${pr.vowel}-কার`)
    problems.push(`pair "${pr.label}" shows the vowel ${pr.vowel}, which the name does not match`);
  if (!pr.wantSign)
    problems.push(`pair "${pr.label}" is named nothing the mark table lists`);
  else if (!pr.matchesShape)
    problems.push(`pair "${pr.label}" draws something other than the outline held for ${pr.wantSign}`);
  if (pr.pieces !== (TWO_PIECE[pr.label] || 1))
    problems.push(`pair "${pr.label}" is drawn from ${pr.pieces} outline(s), expected `
                + `${TWO_PIECE[pr.label] || 1} - the precomposed glyph carries a dotted circle`);
  if (pr.hidden !== 2)
    problems.push(`pair "${pr.label}" leaves a bare glyph readable; a lone mark read aloud is noise`);
  if (pr.ink < 8)
    problems.push(`pair "${pr.label}" draws its sign ${pr.ink}px tall - too small to make out`);
}
// No dotted circle, which is the thing this chart exists to avoid showing.
const circled = await p.evaluate(() =>
  document.getElementById('karPairs').textContent.includes('\u25CC'));
if (circled) problems.push('a dotted circle is back in the কার pairs');
// Neighbours must differ, or the colour stops saying "these two belong together".
for (let i = 1; i < pairs.length; i++)
  if (pairs[i].block === pairs[i - 1].block)
    problems.push(`pairs ${i} and ${i + 1} share block colour ${pairs[i].block}`);
console.log(`kar pairs: ${pairs.length} drawn from the font's own outlines, ink `
          + `${Math.min(...pairs.map(x => x.ink))}-${Math.max(...pairs.map(x => x.ink))}px, `
          + `no dotted circles`);

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

// ---- every KAR_WORDS entry really contains its form, and is glossed --------------------
const kar = await p.evaluate(() => {
  const split = w => splitAksharas(w);
  return Object.entries(KAR_WORDS).map(([form, e]) => ({
    form, w: e.w, en: e.en, parts: split(e.w), onBoard: LEVELS.some(l => l.words.includes(e.w))
  }));
});
for (const k of kar) {
  if (!k.parts.includes(k.form))
    problems.push(`KAR_WORDS["${k.form}"] = "${k.w}", which splits as ${k.parts.join('+')}`);
  if (!k.en) problems.push(`KAR_WORDS["${k.form}"] has no gloss`);
  // These exist to cover forms the boards cannot. One that is on a board is dead weight and a
  // sign the emit filter has drifted.
  if (k.onBoard) problems.push(`KAR_WORDS["${k.form}"] = "${k.w}" is on a board already`);
}
// Coverage, so a drop is visible rather than silent.
const cover = await p.evaluate(() => {
  const CONS = [...'কখগঘঙচছজঝঞটঠডঢণতথদধনপফবভমযরলশষসহ'];
  const KARS = ['', 'া', 'ি', 'ী', 'ু', 'ূ', 'ৃ', 'ে', 'ৈ', 'ো', 'ৌ', 'ং'];
  let shown = 0;
  for (const c of CONS) for (const k of KARS) {
    const a = c + k;
    if (LEVELS.some(l => l.name === a) || LEVELS.some(l => l.words.some(w => splitAksharas(w).includes(a)))
        || KAR_WORDS[a]) shown++;
  }
  return { shown, total: CONS.length * KARS.length };
});
console.log(`বারোখড়ি coverage: ${cover.shown} of ${cover.total} forms show a word`);
if (cover.shown < 270)
  problems.push(`only ${cover.shown} of ${cover.total} forms show a word; was 275`);
console.log(`KAR_WORDS: ${kar.length} vetted words for forms no board reaches`);

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
if (await phone.isVisible('#menuPop'))
  problems.push('the options are on screen before the button is pressed');
await phone.click('#guideOpen');
await phone.waitForSelector('#menuPop', { state: 'visible', timeout: 5000 })
  .catch(() => problems.push('the options did not open on a phone'));

// Every option has to be reachable without scrolling the options themselves: ten of them in a
// flat wrapped row was the thing that made this menu hard to use, and a grouped list that
// runs off the bottom of a 640px phone would be the same problem in a new shape.
// Ten options, their descriptions and four group headings do not fit above the fold of a
// 360x640 phone, and squeezing them until they do would mean taking away either the
// descriptions or the size of the targets - the two things that made the menu usable. So the
// sheet scrolls, and what has to hold is that every option can actually be got to and is big
// enough to hit once you are there.
const reach = await phone.evaluate(async () => {
  const pop = document.getElementById('menuPop');
  const opts = [...document.querySelectorAll('#menuPop .opt')];
  const out = [];
  for (const o of opts) {
    o.scrollIntoView({ block: 'center' });
    await new Promise(r => requestAnimationFrame(r));
    const r = o.getBoundingClientRect();
    out.push({
      key: o.dataset.page,
      tall: Math.round(r.height),
      onScreen: r.top >= -1 && r.bottom <= innerHeight + 1,
    });
  }
  pop.scrollTop = 0;
  return { opts: out, scrolls: pop.scrollHeight > pop.clientHeight + 1 };
});
for (const o of reach.opts) {
  if (o.tall < 44) problems.push(`${o.key}: the option is ${o.tall}px tall, under the 44px floor`);
  if (!o.onScreen) problems.push(`${o.key}: the option cannot be scrolled into view`);
}
console.log(`phone: ${reach.opts.length} options, ${Math.min(...reach.opts.map(o => o.tall))}px `
          + `shortest, all reachable${reach.scrolls ? ' (the sheet scrolls)' : ' without scrolling'}`);

for (const key of PAGES) {
  await openSection(phone, key).catch(() => problems.push(`${key}: option not tappable on a phone`));
}
// And the game is still playable underneath once it closes.
await phone.click('#guideClose');
const back = await phone.evaluate(() => ({
  menuGone: document.getElementById('menuPop').hidden
            && !document.querySelector('.guide').classList.contains('open'),
  tiles: document.querySelectorAll('.tile').length,
  cell: Math.round(document.querySelector('.cell').getBoundingClientRect().width)
}));
if (!back.menuGone) problems.push('the menu stayed open after Close');
if (!back.tiles) problems.push('no wheel after closing the menu');
if (back.cell < 30) problems.push(`cells are ${back.cell}px after closing the menu, under the 30px floor`);

await b.close();
report(problems, `MENU OK: ${PAGES.length} sections, charts and বারোখড়ি counted from `
               + 'the game, letters open their levels');
