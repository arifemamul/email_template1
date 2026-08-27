#!/usr/bin/env node
/*
 * The browser test suite.
 *
 *     node tools/tests/run.mjs              the seventeen checks, about four minutes
 *     node tools/tests/run.mjs --sweep      and the full solve sweep, about twelve more
 *     node tools/tests/run.mjs playtest     one check, or several, by name
 *     node tools/tests/run.mjs --list       what there is
 *
 * These tests run against `docs/index.html` - the file that actually ships - and never against
 * the source, so a mistake in the build fails a test instead of shipping. The first thing this
 * does is ask `build.py stale` whether that file is the one `src/` would produce right now, and
 * refuse to run if it is not.
 *
 * That guard is here for a reason. The suite once lived outside the repository and opened the
 * page as `process.cwd() + '/shobdojot.html'`, which resolved to a copy. The copy went stale and
 * ten of the tests spent five commits passing against a file none of those commits had
 * touched, cheerfully reporting 156 levels while the game shipped 169. Nothing ever failed.
 * A test that cannot see the thing it describes is worse than no test, because it is believed.
 */
import { spawn } from 'child_process';
import { readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');

/*
 * What each check is for, in the order it is worth reading. Order matters a little: the cheap
 * structural checks come first so an obvious break is reported in seconds rather than minutes.
 */
const CHECKS = [
  ['parity',      'every board in the page matches the one Python laid out'],
  ['tofucheck',   'every akshara the game can show has a real glyph in the font'],
  ['fontcheck',   'Bengali renders with the embedded font, shaping intact'],
  ['glyphcheck',  'every letter is one size, and every box holds it'],
  ['fittest',     'board, wheel and buttons fit at every screen size'],
  ['rowcheck',    'the actions row fits everywhere'],
  ['guidetest',   'the guide opens, closes and holds what it should'],
  ['menutest',    'every section opens, charts and বারোখড়ি counted from the game'],
  ['primertest',  "the primer's sums, কার words, ফলা and যুক্তবর্ণ are drawn from PRIMER"],
  ['quiettest',   'no sound button, no word counter, no pause - and words are spoken'],
  ['wheeltest',   'the wheel is scrambled, stable between visits, and drawn as scrambled'],
  ['playtest',    'a level can be played through, by drag and by tap'],
  ['pathstest',   'every route back to a finished level finds it blank and playable'],
  ['advancetest', 'clearing advances, the next board is blank, the grid is coloured by letter'],
  ['replaytest',  'a cleared level can be played again'],
  ['oldsavetest', 'progress saved by an older build still loads'],
  ['saytest',     'the feedback card copies a note with the level attached'],
  ['pwatest',     'installs, and plays with the network cut'],
];

/** The slow one: opens all 256 levels and solves each. Opt in with --sweep. */
const SLOW = [['sweep', 'every level solves, fills its board, and marks itself cleared']];

const args = process.argv.slice(2);
const withSweep = args.includes('--sweep');
const named = args.filter(a => !a.startsWith('--'));

if (args.includes('--list')) {
  for (const [name, what] of [...CHECKS, ...SLOW]) console.log(`  ${name.padEnd(12)} ${what}`);
  process.exit(0);
}

const known = new Set(readdirSync(HERE).filter(f => f.endsWith('.mjs')).map(f => f.slice(0, -4)));
const unknown = named.filter(n => !known.has(n));
if (unknown.length) {
  console.error(`no such check: ${unknown.join(', ')}\ntry --list`);
  process.exit(2);
}

function run(cmd, cmdArgs, opts = {}) {
  return new Promise(done => {
    const child = spawn(cmd, cmdArgs, { cwd: REPO, ...opts });
    let out = '';
    child.stdout?.on('data', d => { out += d; });
    child.stderr?.on('data', d => { out += d; });
    child.on('close', code => done({ code, out }));
  });
}

// ---- is the page we are about to test the page the source would build? --------------------
if (!named.length) {
  const { code, out } = await run('python3', ['tools/build.py', 'stale']);
  if (code !== 0) {
    console.log(out.trim());
    console.log('\nrefusing to run: the tests would be describing a page nobody is shipping.');
    process.exit(2);
  }
  console.log(out.trim());
}

const plan = named.length
  ? [...CHECKS, ...SLOW].filter(([n]) => named.includes(n))
  : [...CHECKS, ...(withSweep ? SLOW : [])];

console.log(`\n${plan.length} check${plan.length === 1 ? '' : 's'}` +
            (withSweep || named.length ? '' : '  (--sweep adds the full solve sweep)') + '\n');

const failed = [];
const started = Date.now();
for (const [name, what] of plan) {
  const at = Date.now();
  process.stdout.write(`  ${name.padEnd(12)} `);
  const { code, out } = await run('node', [join('tools', 'tests', `${name}.mjs`)]);
  const secs = ((Date.now() - at) / 1000).toFixed(0).padStart(3);
  const last = out.trim().split('\n').filter(Boolean).pop() || '(no output)';
  if (code === 0) {
    console.log(`ok   ${secs}s  ${what}`);
  } else {
    console.log(`FAIL ${secs}s  ${last}`);
    failed.push([name, out.trim()]);
  }
}

const took = ((Date.now() - started) / 1000 / 60).toFixed(1);
if (failed.length) {
  for (const [name, out] of failed) {
    console.log(`\n${'='.repeat(72)}\n${name}\n${'='.repeat(72)}\n${out}`);
  }
  console.log(`\n${failed.length} of ${plan.length} failed in ${took} min: ` +
              failed.map(([n]) => n).join(', '));
  process.exit(1);
}
console.log(`\nall ${plan.length} passed in ${took} min`);
if (!withSweep && !named.length) console.log('the solve sweep was not run; add --sweep');
