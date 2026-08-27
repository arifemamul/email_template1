/*
 * শব্দ গঠন and ফলা - the three tables taken out of a printed primer.
 *
 * tools/build.py already checks the transcription itself: every equation composes its word,
 * every word carries the কার it is filed under, every ফলা word carries a form the table shows.
 * That check runs against the JSON. This one runs against the rendered page, and asks a
 * different question: does the page show what the JSON holds, and is every word offered as
 * playable really playable?
 *
 * The second half matters more than it sounds. 389 words are on these pages and 626 are in the
 * game, so most of the primer's words have no level behind them. A word wrongly drawn as a
 * button sends a child to whatever level happens to sit at index undefined - which is how the
 * rule "playable words are buttons, the rest are text" ends up being worth a test.
 */
import { launch, PAGE, report } from './harness.mjs';

const problems = [];
const b = await launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
const p = await ctx.newPage();
p.on('pageerror', e => problems.push('pageerror: ' + e.message));
p.on('console', m => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
await p.goto(PAGE);
await p.waitForFunction(() => document.querySelector('.tile') && document.querySelector('#menu .tab'));

// ---- the equations: what is drawn is what PRIMER holds, and it adds up ------------------
await p.click('#tab-gathon');
const eqs = await p.evaluate(() => {
  const read = id => [...document.querySelectorAll('#' + id + ' .eq')].map(e => ({
    parts: [...e.querySelectorAll('.eq-l')].map(x => x.textContent),
    ops: [...e.querySelectorAll('.eq-op')].map(x => x.textContent),
    word: e.querySelector('.eq-w').textContent,
    playable: e.querySelector('.eq-w').tagName === 'BUTTON',
    lit: e.querySelector('.eq-w').classList.contains('on'),
    onBoard: LEVELS.some(l => l.words.includes(e.querySelector('.eq-w').textContent))
  }));
  return { two: read('eqTwo'), three: read('eqThree'),
           heldTwo: PRIMER.two, heldThree: PRIMER.three };
});
// Compared against PRIMER letter by letter, not just counted. Note what this can and cannot
// see: the page builds the answer as parts.join(''), so asserting that the sum equals the word
// would be a tautology - it is true by construction and no bug can break it. What can break is
// the drawing: a part dropped, a pair reversed, a row skipped. That is what is checked here.
// Whether কলম is really ক+ল+ম at all is checked by tools/build.py, against split_aksharas.
for (const [group, held, want] of [[eqs.two, eqs.heldTwo, 2], [eqs.three, eqs.heldThree, 3]]) {
  if (group.length !== held.length)
    problems.push(`${group.length} ${want}-letter sums drawn, PRIMER holds ${held.length}`);
  held.forEach((parts, i) => {
    const drawn = group[i];
    if (!drawn) { problems.push(`${parts.join('+')} is not drawn at all`); return; }
    if (drawn.parts.join() !== parts.join())
      problems.push(`row ${i + 1}: drawn as ${drawn.parts.join('+')}, PRIMER holds ${parts.join('+')}`);
    if (drawn.parts.length !== want)
      problems.push(`${drawn.word}: ${drawn.parts.length} letters shown, expected ${want}`);
    // n letters means n-1 plus signs and one equals.
    if (drawn.ops.join('') !== '+'.repeat(want - 1) + '=')
      problems.push(`${drawn.word}: operators are [${drawn.ops.join(' ')}]`);
    if (drawn.playable !== drawn.onBoard)
      problems.push(`${drawn.word}: drawn as ${drawn.playable ? 'playable' : 'plain text'}, `
                  + `but it is ${drawn.onBoard ? '' : 'not '}on a board`);
    // Being a button and looking like one are separate facts, and a chip that looks playable
    // but is not is the worse of the two failures: a child taps it and nothing happens.
    if (drawn.lit !== drawn.onBoard)
      problems.push(`${drawn.word}: styled as ${drawn.lit ? 'playable' : 'plain'}, `
                  + `but it is ${drawn.onBoard ? '' : 'not '}on a board`);
  });
}
const sums = eqs.two.length + eqs.three.length;
const playableSums = [...eqs.two, ...eqs.three].filter(e => e.playable).length;
console.log(`শব্দ গঠন: ${sums} sums (${eqs.two.length} two-letter, ${eqs.three.length} `
          + `three-letter), ${playableSums} of them playable`);

// ---- a sum actually opens its level ------------------------------------------------------
// Guarded rather than assumed. If nothing is drawn as a button this is itself the finding, and
// reporting it beats throwing on `undefined.click()` - a stack trace loses the problems already
// collected above, which are the ones that say why.
const jumped = await p.evaluate(async () => {
  const go = [...document.querySelectorAll('.eq-w')].find(x => x.tagName === 'BUTTON');
  if (!go) return null;
  const before = game.index;
  go.click();
  await new Promise(r => requestAnimationFrame(r));
  return { word: go.textContent, before, after: game.index,
           holds: LEVELS[game.index].words.includes(go.textContent) };
});
if (!jumped) {
  problems.push('no sum is offered as playable, though the game holds some of these words');
} else {
  if (jumped.after === jumped.before)
    problems.push(`tapping ${jumped.word} did not change level`);
  if (!jumped.holds) problems.push(`tapping ${jumped.word} opened a level without that word`);
}

// ---- every কার picker shows its own words, and each really carries the sign --------------
await p.click('#tab-gathon');
const kars = await p.$$eval('.kp', bs => bs.length);
if (kars !== 10) problems.push(`${kars} কার in the picker, expected 10`);

let totalWords = 0;
for (let i = 0; i < kars; i++) {
  const seen = await p.evaluate(async n => {
    document.querySelectorAll('.kp')[n].click();
    await new Promise(r => requestAnimationFrame(r));
    const sign = ['া','ি','ী','ু','ূ','ৃ','ে','ৈ','ো','ৌ'][n];
    const chips = [...document.querySelectorAll('#karList .kw')];
    return {
      sign,
      shown: chips.map(c => c.textContent),
      held: PRIMER.byKar[sign],
      lit: [...document.querySelectorAll('.kp.on')].length,
      wrong: chips.filter(c => !c.textContent.includes(sign)).map(c => c.textContent),
      // A chip is a button exactly when the game has that word.
      mismatched: chips.filter(c => {
        const real = LEVELS.some(l => l.words.includes(c.textContent));
        return (c.tagName === 'BUTTON') !== real || c.classList.contains('on') !== real;
      }).map(c => c.textContent),
      counted: document.querySelector('.kw-count').textContent
    };
  }, i);
  totalWords += seen.shown.length;
  if (seen.shown.length !== seen.held.length)
    problems.push(`${seen.sign}: ${seen.shown.length} words drawn, PRIMER holds ${seen.held.length}`);
  if (seen.shown.join() !== seen.held.join())
    problems.push(`${seen.sign}: the words drawn are not the words held`);
  if (seen.wrong.length)
    problems.push(`${seen.sign}: ${seen.wrong.join(' ')} do not carry the sign`);
  if (seen.mismatched.length)
    problems.push(`${seen.sign}: ${seen.mismatched.join(' ')} drawn as the wrong kind of chip`);
  if (seen.lit !== 1) problems.push(`${seen.sign}: ${seen.lit} কার lit in the picker`);
  // The count line is read as fact, so it has to be the count.
  const digits = seen.counted.replace(/[^০-৯]/g, '');
  const first = seen.counted.match(/[০-৯]+/);
  const asNumber = first && [...first[0]].reduce((n, d) => n * 10 + '০১২৩৪৫৬৭৮৯'.indexOf(d), 0);
  if (asNumber !== seen.shown.length)
    problems.push(`${seen.sign}: the line says ${asNumber} words, ${seen.shown.length} are drawn`);
}
console.log(`কার যোগে বানান: ${kars} কার, ${totalWords} words across them`);

// ---- ফলা: every mark, its forms and its words -------------------------------------------
await p.click('#tab-phala');
const phala = await p.evaluate(() => {
  const cards = [...document.querySelectorAll('.ph')].map(c => ({
    name: c.querySelector('.ph-h').textContent.replace(c.querySelector('.ph-m').textContent, ''),
    mark: c.querySelector('.ph-m').textContent,
    note: c.querySelector('.ph-note').textContent,
    gap: !!c.querySelector('.ph-gap'),
    // Just the list, not the sentence around it - see the comment in drawPhala.
    gapList: c.querySelector('.ph-gap-list')
      ? c.querySelector('.ph-gap-list').textContent.split(', ') : null,
    forms: [...c.querySelectorAll('.ph-f')].map(x => ({
      f: x.textContent, dim: x.classList.contains('ph-f-none') })),
    words: [...c.querySelectorAll('.ph-w')].map(x => ({
      w: x.textContent, playable: x.tagName === 'BUTTON',
      lit: x.classList.contains('on'),
      onBoard: LEVELS.some(l => l.words.includes(x.textContent))
    }))
  }));
  return { cards, held: PRIMER.phala, note: document.querySelector('#phalaNote').textContent };
});
if (phala.cards.length !== phala.held.length)
  problems.push(`${phala.cards.length} ফলা cards, PRIMER holds ${phala.held.length}`);
if (!phala.note) problems.push('the ফলা page has no introduction');

phala.cards.forEach((c, i) => {
  const held = phala.held[i];
  if (!held) return;
  if (c.name !== held.name) problems.push(`ফলা ${i + 1}: drawn as ${c.name}, held as ${held.name}`);
  if (c.mark !== held.mark) problems.push(`${c.name}: mark drawn as ${c.mark}, held as ${held.mark}`);
  if (!c.note) problems.push(`${c.name}: no note explaining what the mark does`);
  if (c.forms.map(f => f.f).join() !== held.forms.join())
    problems.push(`${c.name}: forms drawn are not the forms held`);
  for (const f of c.forms) {
    if (!f.f.includes(held.mark))
      problems.push(`${c.name}: the form ${f.f} does not carry ${held.mark}`);
    // Dimmed means "the language does not use this shape". Dimming a shape that a word on this
    // very card uses would contradict the card, so the two have to agree.
    if (f.dim !== held.unused.includes(f.f))
      problems.push(`${c.name}: ${f.f} is drawn ${f.dim ? 'dimmed' : 'plain'}, `
                  + `but it is ${held.unused.includes(f.f) ? '' : 'not '}marked unused`);
  }
  // The line under the forms names the dimmed ones, so it has to name all of them and no more.
  if (held.unused.length && !c.gap)
    problems.push(`${c.name}: ${held.unused.length} forms dimmed, but nothing says why`);
  if (c.gapList && c.gapList.join() !== held.unused.join())
    problems.push(`${c.name}: the note lists [${c.gapList}], dimmed are [${held.unused}]`);
  if (held.unused.length && !c.gapList)
    problems.push(`${c.name}: forms are dimmed but none are named`);
  if (!held.unused.length && c.gapList)
    problems.push(`${c.name}: names unused forms but has none`);
  if (c.words.map(w => w.w).join() !== held.words.join())
    problems.push(`${c.name}: words drawn are not the words held`);
  for (const w of c.words) {
    if (!w.w.includes(held.mark))
      problems.push(`${c.name}: ${w.w} does not carry ${held.mark}`);
    if (!c.forms.some(f => w.w.includes(f.f)))
      problems.push(`${c.name}: ${w.w} carries no form the card shows`);
    if (w.playable !== w.onBoard)
      problems.push(`${c.name}: ${w.w} drawn as ${w.playable ? 'playable' : 'text'}, `
                  + `but it is ${w.onBoard ? '' : 'not '}on a board`);
    if (w.lit !== w.onBoard)
      problems.push(`${c.name}: ${w.w} styled as ${w.lit ? 'playable' : 'plain'}, `
                  + `but it is ${w.onBoard ? '' : 'not '}on a board`);
  }
});
const forms = phala.cards.reduce((n, c) => n + c.forms.length, 0);
const words = phala.cards.reduce((n, c) => n + c.words.length, 0);
console.log(`ফলা: ${phala.cards.length} marks, ${forms} forms, ${words} words`);

// ---- যুক্তবর্ণ: the parts really make the letter, and the letter is one tile -------------
await p.click('#tab-jukto');
const jukto = await p.evaluate(() => {
  const rows = [...document.querySelectorAll('.jr')].map(r => ({
    form: r.querySelector('.jr-f').textContent,
    // Counted with the page's own splitter, the one the wheel uses to cut a word into tiles.
    // That is the point of the assertion: not "ক্ষ looks like one letter" but "this game will
    // hand a child ক্ষ as one tile", which is the same function answering both questions.
    tiles: splitAksharas(r.querySelector('.jr-f').textContent).length,
    parts: r.querySelector('.jr-p').textContent.split(' + '),
    note: r.querySelector('.jr-note') ? r.querySelector('.jr-note').textContent : null,
    words: [...r.querySelectorAll('.jr-w')].map(x => ({
      w: x.textContent, playable: x.tagName === 'BUTTON',
      lit: x.classList.contains('on'),
      onBoard: LEVELS.some(l => l.words.includes(x.textContent))
    }))
  }));
  return { rows, held: PRIMER.jukto, note: document.querySelector('#juktoNote').textContent,
           count: document.querySelector('.jk-count').textContent,
           heads: [...document.querySelectorAll('.jp')].map(x => x.textContent) };
});
if (!jukto.note) problems.push('the যুক্তবর্ণ page has no introduction');
if (jukto.rows.length !== jukto.held.length)
  problems.push(`${jukto.rows.length} যুক্তবর্ণ rows drawn, PRIMER holds ${jukto.held.length}`);

jukto.rows.forEach((r, i) => {
  const held = jukto.held[i];
  if (!held) return;
  if (r.form !== held.form) problems.push(`row ${i + 1}: drawn as ${r.form}, held as ${held.form}`);
  if (r.parts.join() !== held.parts.join())
    problems.push(`${r.form}: parts drawn as ${r.parts.join('+')}, held as ${held.parts.join('+')}`);
  // The claim the page makes: these parts, joined by a hasanta, are this letter. Unlike the
  // sums on the শব্দ গঠন page this is NOT true by construction - the page prints the form and
  // the parts from two different fields - so it is worth doing the arithmetic here.
  if (!held.phonetic && r.parts.join('\u09cd') !== r.form)
    problems.push(`${r.form}: ${r.parts.join(' + ')} joins as ${r.parts.join('\u09cd')}`);
  // And the reason this table is in this game at all: one যুক্তবর্ণ is one tile.
  if (r.tiles !== 1) problems.push(`${r.form}: splits into ${r.tiles} tiles, not one`);
  // And the reason this table is in this game at all: one যুক্তবর্ণ is one tile.
  if (r.tiles !== 1) problems.push(`${r.form}: splits into ${r.tiles} tiles, not one`);
  if (held.phonetic && !r.note)
    problems.push(`${r.form}: its বিভাজন is phonetic but the page does not say so`);
  if (!held.phonetic && r.note) problems.push(`${r.form}: has a note it should not`);
  if (!r.words.length) problems.push(`${r.form}: no example word drawn`);
  for (const w of r.words) {
    if (!w.w.includes(r.form)) problems.push(`${r.form}: ${w.w} does not contain it`);
    if (w.playable !== w.onBoard || w.lit !== w.onBoard)
      problems.push(`${r.form}: ${w.w} drawn as ${w.playable ? 'playable' : 'text'}, `
                  + `but it is ${w.onBoard ? '' : 'not '}on a board`);
  }
});

// ---- the first-letter filter shows a subset, and "সব" shows all --------------------------
if (jukto.heads[0] !== 'সব') problems.push(`the যুক্তবর্ণ filter starts with "${jukto.heads[0]}"`);
const filtered = await p.evaluate(async () => {
  const heads = [...document.querySelectorAll('.jp')];
  const k = heads.find(h => h.textContent === 'ক');
  k.click();
  await new Promise(r => requestAnimationFrame(r));
  const shown = [...document.querySelectorAll('.jr-f')].map(x => x.textContent);
  return { shown, expected: PRIMER.jukto.filter(r => r.parts[0] === 'ক').map(r => r.form),
           lit: [...document.querySelectorAll('.jp.on')].map(x => x.textContent),
           count: document.querySelector('.jk-count').textContent };
});
if (filtered.shown.join() !== filtered.expected.join())
  problems.push(`filtering by ক shows [${filtered.shown}], expected [${filtered.expected}]`);
if (filtered.lit.join() !== 'ক') problems.push(`filtering by ক lights [${filtered.lit}]`);
const total = jukto.rows.length;
const juktoWords = jukto.rows.reduce((n, r) => n + r.words.length, 0);
const playableJukto = jukto.rows.reduce((n, r) => n + r.words.filter(w => w.playable).length, 0);
console.log(`যুক্তবর্ণ: ${total} letters, ${juktoWords} words (${playableJukto} playable), `
          + `${jukto.heads.length - 1} first letters; ক shows ${filtered.shown.length}`);

// ---- all three new sections work on a phone ----------------------------------------------
const phone = await (await b.newContext({ viewport: { width: 360, height: 640 } })).newPage();
await phone.goto(PAGE);
await phone.waitForFunction(() => document.querySelector('.tile'));
await phone.click('#guideOpen');
for (const key of ['gathon', 'phala', 'jukto']) {
  await phone.click(`#tab-${key}`).catch(() => problems.push(`${key}: tab not tappable on a phone`));
  const fits = await phone.evaluate(k => {
    const s = document.querySelector(`#page-${k}`);
    return { wide: s.scrollWidth > s.clientWidth + 1, empty: !s.textContent.trim() };
  }, key);
  if (fits.wide) problems.push(`${key}: scrolls sideways on a 360px phone`);
  if (fits.empty) problems.push(`${key}: nothing drawn`);
}

await b.close();
report(problems, `PRIMER OK: ${sums} sums, ${totalWords} কার words, ${phala.cards.length} ফলা, `
               + `${total} যুক্তবর্ণ - all drawn from PRIMER, playable words playable`);
