/*
 * Do the boards in the page match the boards Python laid out?
 *
 * Every board is placed at build time by `tools/bangla.py` and emitted into the page as bare
 * coordinates, which the page rebuilds into a grid in `boardOf`. Two pieces of code therefore
 * have to agree about the same 256 boards: the Python that searched for them and the JavaScript
 * that reads them back. This is the check that they do.
 *
 * It earns its place because the page derives more than it is given. Rows, columns and the word
 * list are all worked out from the coordinates rather than shipped alongside them - 15 KB saved,
 * and three chances for the page to disagree with the placer about what it was handed. A silent
 * disagreement here means a board that is subtly wrong on a level nobody has opened yet.
 */
import { execFileSync } from 'child_process';
import { launch, PAGE, REPO, report } from './harness.mjs';

const PY = `
import sys
sys.path.insert(0, 'tools')
from catalogue import ordered_levels
from bangla import split_aksharas
levels, failures = ordered_levels()
if failures:
    print('CATALOGUE FAILURES', failures); sys.exit(1)
for i, lv in enumerate(levels, 1):
    rows, cols = lv['size']
    grid = {}
    for word, cells in lv['placed']:
        aks = split_aksharas(word)
        for k, (r, c) in enumerate(cells):
            grid[(r, c)] = aks[k]
    body = '/'.join('|'.join(grid.get((r, c), '.') for c in range(cols)) for r in range(rows))
    # The cell path of each word, not only the grid it produces. Two different placements can
    # render the same grid - move a word's first cell onto a letter another word already puts
    # there and the picture is unchanged while the path a finger has to trace is not.
    paths = ';'.join(w + '=' + '>'.join(f'{r},{c}' for r, c in cells) for w, cells in lv['placed'])
    print(f'L{i} {rows}x{cols} {body} :: {paths}')
`;

const fromPython = execFileSync('python3', ['-c', PY], {
  cwd: REPO, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024
}).trim().split('\n');

const b = await launch();
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await p.goto(PAGE);
await p.waitForFunction(() => typeof BOARDS !== 'undefined' && BOARDS.length > 0);
const fromPage = await p.evaluate(() => BOARDS.map((g, i) => {
  const rows = [];
  for (let r = 0; r < g.rows; r++) {
    const row = [];
    for (let c = 0; c < g.cols; c++) row.push(g.letters.get(r + ',' + c) ?? '.');
    rows.push(row.join('|'));
  }
  const paths = g.words.map(w => w.word + '=' + w.cells.map(([r, c]) => `${r},${c}`).join('>'));
  return `L${i + 1} ${g.rows}x${g.cols} ${rows.join('/')} :: ${paths.join(';')}`;
}));
await b.close();

const problems = [];
if (fromPython.length !== fromPage.length) {
  problems.push(`Python laid out ${fromPython.length} boards, the page holds ${fromPage.length}`);
}
let differ = 0;
for (let i = 0; i < Math.min(fromPython.length, fromPage.length); i++) {
  if (fromPython[i] === fromPage[i]) continue;
  differ++;
  if (differ <= 3) {
    problems.push(`board ${i + 1} differs\n      python: ${fromPython[i]}\n      page  : ${fromPage[i]}`);
  }
}
if (differ > 3) problems.push(`...and ${differ - 3} more boards differ`);

console.log(`${fromPython.length} boards from Python, ${fromPage.length} from the page`);
report(problems, `EVERY BOARD MATCHES: ${fromPage.length} identical in Python and in the page`);
