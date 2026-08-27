import { launch, PAGE, serveDocs, shot } from './harness.mjs';
const b = await launch();
const page = await b.newPage({ viewport: { width: 1200, height: 900 } });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto(PAGE);
await page.waitForTimeout(600);

const result = await page.evaluate(async () => {
  await document.fonts.ready;

  // 1. what faces did the page actually load?
  const faces = [...document.fonts].map(f => ({ family: f.family, weight: f.weight, status: f.status }));

  // 2. pull the embedded woff2 back out of the page's own stylesheet
  let dataUri = null;
  for (const sheet of document.styleSheets) {
    for (const rule of sheet.cssRules) {
      if (rule instanceof CSSFontFaceRule && rule.style.fontWeight === '700') {
        dataUri = rule.style.getPropertyValue('src').match(/url\(([^)]+)\)/)[1].replace(/["']/g, '');
      }
    }
  }
  if (!dataUri) return { error: 'no @font-face src found in the page stylesheet' };

  // load the very same bytes under a name nothing else can be using
  const control = new FontFace('ControlBnProof', `url(${dataUri})`);
  await control.load();
  document.fonts.add(control);
  await document.fonts.ready;

  const measure = (text, family, weight = 700) => {
    const c = document.createElement('canvas').getContext('2d');
    c.font = `${weight} 40px ${family}`;
    return Math.round(c.measureText(text).width * 100) / 100;
  };

  // every akshara the game can put on a tile, plus the UI strings
  const samples = ['ন্ধু', 'স্তা', 'ষ্টি', 'মা', 'ছ', 'ড়ি', 'বাং', 'ফুলবাগান', 'অক্ষর জুড়ে শব্দ বানাও', '০১২৩৪৫৬৭৮৯'];
  const rows = samples.map(t => ({
    text: t,
    page: measure(t, '"Noto Sans Bengali"'),
    proof: measure(t, 'ControlBnProof'),
    fallback: measure(t, 'sans-serif')
  }));

  // shaping: a conjunct must be narrower than its parts set side by side
  const conjunct = measure('ন্ধু', '"Noto Sans Bengali"');
  const parts = measure('ন', '"Noto Sans Bengali"') + measure('ধ', '"Noto Sans Bengali"') + measure('ু', '"Noto Sans Bengali"');

  return {
    faces,
    rows,
    shaping: { conjunct, parts },
    checkRegular: document.fonts.check('400 20px "Noto Sans Bengali"'),
    checkBold: document.fonts.check('700 20px "Noto Sans Bengali"'),
    // is a tile actually painted with it?
    tileFamily: getComputedStyle(document.querySelector('.tile')).fontFamily.split(',')[0]
  };
});

if (result.error) { console.log('FAIL:', result.error); process.exit(1); }

console.log('faces loaded:', JSON.stringify(result.faces));
console.log('fonts.check 400/700:', result.checkRegular, result.checkBold);
console.log('tile font-family:', result.tileFamily);
console.log('\ntext                    page   embedded  system-fallback  uses-embedded');
const problems = [];
for (const r of result.rows) {
  const usesEmbedded = Math.abs(r.page - r.proof) < 0.01;
  const differsFromSystem = Math.abs(r.page - r.fallback) > 0.01;
  console.log(
    `${r.text.padEnd(24)}${String(r.page).padEnd(7)}${String(r.proof).padEnd(10)}${String(r.fallback).padEnd(17)}${usesEmbedded ? 'yes' : 'NO'}`
  );
  if (!usesEmbedded) problems.push(`"${r.text}" is not rendered with the embedded font`);
  if (!differsFromSystem) problems.push(`"${r.text}" measures the same as the system fallback (inconclusive)`);
}

console.log(`\nconjunct shaping: ন্ধু = ${result.shaping.conjunct}px vs its parts apart = ${result.shaping.parts}px`);
if (!(result.shaping.conjunct < result.shaping.parts)) problems.push('conjunct ন্ধু is not being shaped as one cluster');
if (!result.checkRegular || !result.checkBold) problems.push('a weight failed document.fonts.check');
if (errs.length) problems.push('page errors: ' + errs.join('; '));

await page.screenshot({ path: shot('font-desktop.png') });
await b.close();
console.log('\n' + (problems.length ? 'PROBLEMS:\n- ' + problems.join('\n- ') : 'FONT VERIFIED: page renders Bengali with the embedded file, shaping intact'));
process.exit(problems.length ? 1 : 0);
