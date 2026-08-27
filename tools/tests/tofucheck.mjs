import { launch, PAGE, serveDocs } from './harness.mjs';
const b = await launch();
const page = await b.newPage({ viewport: { width: 1200, height: 900 } });
await page.goto(PAGE);
await page.waitForTimeout(600);

const out = await page.evaluate(async () => {
  await document.fonts.ready;

  // Everything the game can ever display in Bengali: level tiles, board cells,
  // words, digits, and the UI strings baked into the page.
  const aksharas = new Set();
  for (const lv of LEVELS) {
    lv.letters.forEach(a => aksharas.add(a));
    lv.words.forEach(w => splitAksharas(w).forEach(a => aksharas.add(a)));
  }
  // And everything the primer's three tables show. These reach further into the script than the
  // boards do: 103 যুক্তবর্ণ, and ফলা forms like ঙ্ম and ঠ্র that no word in the game contains.
  // Added as whole aksharas, not loose code points, because a conjunct is one glyph to ask the
  // font for and asking for ঙ, ্ and ম separately does not test whether ঙ্ম exists.
  for (const group of [PRIMER.two, PRIMER.three]) {
    for (const parts of group) parts.forEach(a => aksharas.add(a));
  }
  for (const words of Object.values(PRIMER.byKar)) {
    for (const w of words) splitAksharas(w).forEach(a => aksharas.add(a));
  }
  for (const p of PRIMER.phala) {
    p.forms.forEach(f => aksharas.add(f));
    p.words.forEach(w => splitAksharas(w).forEach(a => aksharas.add(a)));
  }
  for (const r of PRIMER.jukto) {
    aksharas.add(r.form);
    r.words.forEach(w => splitAksharas(w).forEach(a => aksharas.add(a)));
  }

  const uiStrings = [...document.querySelectorAll('.bn, h1, .name, .sub, .hint-text, .action span, .primary, .ghost, .clear-card h2, .akshara-table .w, .akshara-table .a, .eyebrow')]
    .map(e => e.textContent.trim()).filter(Boolean);
  for (const s of uiStrings) for (const ch of s) if (ch >= 'ঀ' && ch <= '৿') aksharas.add(ch);
  for (let d = 0; d <= 9; d++) aksharas.add('০১২৩৪৫৬৭৮৯'[d]);

  // Ink fingerprint of one glyph, drawn with the page's Bengali family.
  const ink = (text, family = '"Noto Sans Bengali"') => {
    const cv = document.createElement('canvas');
    cv.width = 96; cv.height = 96;
    const c = cv.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, 96, 96);
    c.fillStyle = '#000'; c.font = `700 56px ${family}`;
    c.textBaseline = 'middle';
    c.fillText(text, 8, 48);
    const px = c.getImageData(0, 0, 96, 96).data;
    let dark = 0, hash = 0;
    for (let i = 0; i < px.length; i += 4) {
      const on = px[i] < 128 ? 1 : 0;
      dark += on;
      hash = ((hash * 31) + on) | 0;
    }
    return { dark, hash };
  };

  // U+09FF is unassigned in Unicode, so no font can have it: this is what a
  // missing glyph looks like here.
  const tofu = ink('৿');

  const rows = [];
  for (const a of [...aksharas].sort()) {
    const page_ = ink(a);
    const ctrl = ink(a, 'ControlUnset');   // no such family -> system fallback
    rows.push({ a, dark: page_.dark, hash: page_.hash, fallbackDark: ctrl.dark });
  }
  return { count: aksharas.size, tofu, rows, uiStringCount: uiStrings.length };
});

const problems = [];
for (const r of out.rows) {
  if (r.dark === 0) problems.push(`"${r.a}" renders nothing (blank)`);
  else if (r.hash === out.tofu.hash) problems.push(`"${r.a}" renders as a missing-glyph box`);
}
console.log(`checked ${out.count} distinct aksharas/digits drawn from all 31 levels + ${out.uiStringCount} UI strings`);
console.log(`missing-glyph reference (U+09FF): ${out.tofu.dark} dark px, hash ${out.tofu.hash}`);
const inkless = out.rows.filter(r => r.dark === 0).length;
console.log(`glyphs with ink: ${out.rows.length - inkless}/${out.rows.length}`);
console.log('sample:', out.rows.slice(0, 8).map(r => `${r.a}:${r.dark}px`).join('  '));

await b.close();
console.log('\n' + (problems.length ? 'PROBLEMS:\n- ' + problems.join('\n- ') : 'NO TOFU: every akshara the game can show has a real glyph in the embedded font'));
process.exit(problems.length ? 1 : 0);
