/*
 * What every test needs, so that no test knows where anything is.
 *
 * This module exists because of a specific failure. The tests used to open
 * `process.cwd() + '/shobdojot.html'`, which resolved to a copy of the built page sitting in
 * whatever directory they happened to be run from. That copy went stale, and ten of fifteen
 * tests spent five commits passing against a file none of those commits had touched - reporting
 * "156 levels" while the game shipped 169. Nothing failed. Green is worse than red when it is
 * wrong.
 *
 * So the page is located from THIS file's position in the repository and nowhere else. There is
 * no copy to go stale, no working directory to get wrong, and `run.mjs` refuses to start at all
 * if the built page is older than the source it comes from.
 */
import { createServer } from 'http';
import { execSync } from 'child_process';
import { pathToFileURL } from 'url';
import { readFile, stat } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { dirname, extname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

/*
 * Playwright, from wherever it is. `npm install` in the repository root puts it in
 * node_modules and the plain import finds it. Some machines - this one included - have it
 * installed globally instead, and ESM does not look there, so fall back to asking npm where
 * global packages live. Failing both, say what to run rather than throwing a resolver error.
 */
async function playwright() {
  // Playwright ships CommonJS, so importing it by path puts everything under `default`;
  // importing it by name gives the named exports directly. Accept either shape.
  const unwrap = mod => mod.chromium ? mod : mod.default;
  try {
    return unwrap(await import('playwright'));
  } catch { /* not in node_modules; try a global install */ }
  try {
    const root = execSync('npm root -g', { encoding: 'utf8' }).trim();
    return unwrap(await import(pathToFileURL(join(root, 'playwright', 'index.js')).href));
  } catch { /* not there either */ }
  console.error('playwright is not installed.\n'
                + '  in the repository root:  npm install\n'
                + '  or globally:             npm install -g playwright');
  process.exit(2);
}

const { chromium } = await playwright();

/** The repository, found from this file rather than from wherever node was started. */
const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(HERE, '..', '..');

/** The built page - the artefact that actually ships, and the only thing worth testing. */
export const BUILT = join(REPO, 'docs', 'index.html');
export const PAGE = 'file://' + BUILT;

if (!existsSync(BUILT)) {
  console.error(`the built page is missing: ${BUILT}\nrun: python3 tools/build.py build`);
  process.exit(2);
}

/*
 * Chromium. The path was hardcoded in every test, which breaks the moment the image updates the
 * browser. PLAYWRIGHT_BROWSERS_PATH is set in this environment, so look under it and fall back
 * to letting Playwright find its own.
 */
function chromiumPath() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root) return undefined;
  for (const name of ['chromium', 'chromium-1194', 'chromium_headless_shell']) {
    for (const exe of [join(root, name, 'chrome-linux', 'chrome'), join(root, name)]) {
      if (existsSync(exe)) return exe;
    }
  }
  return undefined;
}

export async function launch(opts = {}) {
  const executablePath = chromiumPath();
  return chromium.launch({ ...(executablePath ? { executablePath } : {}), ...opts });
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png'
};

/**
 * Serve docs/ over http on 127.0.0.1, for the two things file:// cannot do: a service worker
 * needs a secure origin, and so does the clipboard. Returns { url, close }.
 */
export async function serveDocs() {
  const root = join(REPO, 'docs');
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(req.url.split('?')[0]);
    // A trailing slash means a folder, and a folder means its index - the same thing GitHub
    // Pages does, so `/reports/` in a test resolves to what it resolves to on the site.
    const file = join(root, path.endsWith('/') ? path + 'index.html' : path);
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  // Port 0 lets the OS pick a free one, so two tests can never collide and a stuck server from
  // an earlier run cannot make this one fail.
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise(r => server.close(r))
  };
}

/**
 * Open a section the way a player does: press মেনু, then choose from the options.
 *
 * Every test used to click `#tab-<key>` straight off the page, which worked while the ten
 * sections were a row of pills that was always on screen. They are behind a button now, and a
 * test that reaches past the button has stopped testing the only route a player has. On a phone
 * choosing an option also opens the sheet to read it in, which is why this waits for the
 * section rather than for the click.
 */
export async function openSection(page, key) {
  const opt = `#opt-${key}`;
  if (!(await page.isVisible(opt))) {
    // Three routes in, and which one exists depends on the width. A test that knows only one
    // of them has stopped testing the others.
    const route = await page.evaluate(k => {
      const showing = s => { const e = document.querySelector(s);
        return !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'; };
      // A phone: a tab at the foot of the screen, the one holding this section's group. The
      // tab bar sits above the sheet, so this works whether or not a section is already open.
      if (showing('#tabbar'))
        return `#tabbar .tb[data-block="${
          document.getElementById(`opt-${k}`).closest('.menu-group').dataset.block}"]`;
      // A wide screen: the button in the top bar.
      if (showing('#guideOpen')) return '#guideOpen';
      // Neither, which means an open sheet is covering the bar: its own ‹ মেনু goes back.
      return '#guideBack';
    }, key);
    await page.click(route);
  }
  await page.waitForSelector(opt, { state: 'visible' });
  await page.click(opt);
  // Wait for the section to be readable, not merely selected. On a narrow screen choosing an
  // option also opens the sheet, and the sheet slides - a test that read the page the moment
  // the class flipped was looking at it mid-slide, still off the bottom of the screen.
  await page.waitForFunction(k => {
    const pg = document.getElementById(`page-${k}`);
    if (!pg || !pg.classList.contains('on')) return false;
    const guide = document.querySelector('.guide');
    if (!matchMedia('(max-width: 1024px)').matches) return true;
    return guide.classList.contains('open')
        && Math.abs(guide.getBoundingClientRect().top) < 2;
  }, key);
}

/**
 * Where a test may drop a screenshot. Diagnostics for whoever is reading a failure - not
 * artefacts, and gitignored. Tests used to write these to a relative path, which put them in
 * the repository root once the runner started setting cwd there.
 */
export function shot(name) {
  const dir = join(HERE, 'screenshots');
  mkdirSync(dir, { recursive: true });
  return join(dir, name);
}

/**
 * The report every test ends with. `problems` empty means pass; the runner reads the exit code
 * and the last line, so both have to be right.
 */
export function report(problems, passMessage) {
  if (problems.length) {
    console.log('\nPROBLEMS:\n- ' + problems.join('\n- '));
    process.exit(1);
  }
  console.log('\n' + passMessage);
  process.exit(0);
}

/** How many levels the built page actually holds. Never write this number into a test. */
export async function levelCount(page) {
  return page.evaluate(() => LEVELS.length);
}
