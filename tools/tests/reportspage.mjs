/*
 * docs/reports/ - the page that reads back what the game kept.
 *
 * Two claims are being tested, and they are different in kind.
 *
 * The first is ordinary: does it read the reports, draw them, let them be copied and deleted,
 * and survive a store full of rubbish. That is the same ground the game's own card covers.
 *
 * The second is the reason the page exists, and it is easy to get wrong by believing the
 * marketing rather than the mechanism. The page is NOT protected by its URL: it sits in the
 * published folder and anyone who types its name gets it. What actually keeps the notes
 * private is localStorage being per-origin *per browser profile* - a stranger opening the same
 * URL sees their own empty store. So this file opens it as a stranger and checks that nothing
 * is there, which is the only form of "private" this design actually provides. If that ever
 * stopped being true - a report cached into the page at build time, say - the URL alone would
 * be protecting nothing at all.
 */
import { launch, serveDocs, report, REPO, openSection } from './harness.mjs';
import { readFileSync } from 'fs';
import { join } from 'path';

const problems = [];
const site = await serveDocs();
const b = await launch();
const GAME = site.url + '/index.html';
const PAGE = site.url + '/reports/';

// ---- the game writes, the page reads, in one browser --------------------------------------
const mine = await b.newContext({ viewport: { width: 1280, height: 1000 },
                                 permissions: ['clipboard-read', 'clipboard-write'] });
const g = await mine.newPage();
g.on('pageerror', e => problems.push('game: ' + e.message));
await g.goto(GAME);
await g.waitForFunction(() => document.querySelector('.tile'));
await openSection(g, 'report');

const NOTES = [
  [0, 'প্রথম নোট: কলম শব্দের মানে ভুল'],
  [12, 'দ্বিতীয় নোট: চাকার অক্ষর ছোট'],
];
for (const [lvl, note] of NOTES) {
  await g.evaluate(i => loadLevel(i), lvl);
  await g.fill('#sayNote', note);
  await g.click('#saySave');
  await g.waitForTimeout(120);
}
const levels = await g.evaluate(ns => ns.map(([i]) => ({ id: LEVELS[i].id, name: LEVELS[i].name })), NOTES);

// The game keeps writing to the drawer and no longer reads from it.
if (await g.evaluate(() => !!document.getElementById('sayList')))
  problems.push('the game still draws the report list; it belongs on the page now');

// ---- nothing anywhere points at the page --------------------------------------------------
const mentions = await g.evaluate(() =>
  /reports\.html|reports\//.test(document.documentElement.innerHTML.toLowerCase()));
if (mentions) problems.push('the game mentions the reports page; it is meant to be unlinked');
await g.close();

const p = await mine.newPage();
p.on('pageerror', e => problems.push('page: ' + e.message));
await p.goto(PAGE);
await p.waitForFunction(() => document.getElementById('list').children.length > 0);

const seen = await p.evaluate(() => ({
  rows: [...document.querySelectorAll('.rp')].map(c => ({
    when: c.querySelector('.rp-when').textContent,
    text: c.querySelector('.rp-text').textContent,
    meta: (c.querySelector('.rp-meta pre') || {}).textContent || '',
  })),
  total: document.getElementById('total').textContent,
  links: [...document.querySelectorAll('a')].map(a => a.getAttribute('href')),
  noindex: (document.querySelector('meta[name="robots"]') || {}).content || '',
}));

if (seen.rows.length !== NOTES.length)
  problems.push(`${seen.rows.length} reports on the page, the game kept ${NOTES.length}`);
else {
  // Newest first.
  if (seen.rows[0].text !== NOTES[1][1]) problems.push('the newest report is not at the top');
  for (const [, note] of NOTES) {
    if (!seen.rows.some(r => r.text === note))
      problems.push(`"${note}" was kept in the game but is not on the page`);
  }
  // The level each note was about travels with it - a report without one cannot be acted on.
  const bn = n => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[+d]);
  levels.forEach((lv, i) => {
    const row = seen.rows.find(r => r.text === NOTES[i][1]);
    if (row && !row.when.includes(bn(lv.id)))
      problems.push(`the report about level ${lv.id} does not say so: "${row.when}"`);
  });
  if (!seen.rows[0].meta.includes('ব্রাউজার'))
    problems.push('the machine details are missing from the folded section');
}
if (!/[০-৯]/.test(seen.total)) problems.push(`the count is not in Bengali numerals: "${seen.total}"`);
if (seen.links.length) problems.push(`the page links out to [${seen.links}]`);
if (!/noindex/.test(seen.noindex)) problems.push('the page is not marked noindex');
console.log(`page: ${seen.rows.length} reports, "${seen.total}", ${seen.links.length} links, `
          + `robots="${seen.noindex}"`);

// ---- copy all, oldest first ---------------------------------------------------------------
const copied = await p.evaluate(async () => {
  document.getElementById('copyAll').click();
  await new Promise(r => setTimeout(r, 250));
  try { return await navigator.clipboard.readText(); } catch { return null; }
});
if (copied === null) {
  console.log('copy-all: clipboard unavailable in this context, skipped');
} else {
  const first = copied.indexOf(NOTES[0][1]);
  const second = copied.indexOf(NOTES[1][1]);
  if (first < 0 || second < 0) problems.push('copy-all did not include both reports');
  else if (first > second) problems.push('copy-all put the newest first; they should read oldest first');
}

// ---- the note goes back as text, never as markup -------------------------------------------
await p.evaluate(() => {
  const list = JSON.parse(localStorage.getItem('shobdojot.reports') || '[]');
  list.unshift({ at: Date.now(), text: '<img src=x onerror="window.__pwned=1">',
                 level: 1, name: 'অ', words: 'x', cleared: 0, screen: '1x1', ua: 'x' });
  localStorage.setItem('shobdojot.reports', JSON.stringify(list));
});
await p.reload();
await p.waitForFunction(() => document.querySelectorAll('.rp').length > 2);
const escaped = await p.evaluate(() => ({
  pwned: !!window.__pwned,
  imgs: document.querySelectorAll('.rp img').length,
  shown: document.querySelector('.rp-text').textContent,
}));
if (escaped.pwned || escaped.imgs) problems.push('a report was rendered as markup, not as text');
if (!escaped.shown.startsWith('<img')) problems.push('the report text was mangled on the way back');

// ---- deleting takes two presses ------------------------------------------------------------
const del = await p.evaluate(() => {
  const before = JSON.parse(localStorage.getItem('shobdojot.reports') || '[]').length;
  const drop = document.querySelector('.rp .rp-drop');
  drop.click();
  const afterOne = JSON.parse(localStorage.getItem('shobdojot.reports') || '[]').length;
  drop.click();
  const afterTwo = JSON.parse(localStorage.getItem('shobdojot.reports') || '[]').length;
  return { before, afterOne, afterTwo };
});
if (del.afterOne !== del.before) problems.push('one press deleted a report; it should take two');
if (del.afterTwo !== del.before - 1) problems.push('two presses did not delete the report');

// ---- a stranger sees nothing ---------------------------------------------------------------
// The whole privacy claim, in one check. A separate browser profile is a separate store.
const stranger = await b.newContext({ viewport: { width: 900, height: 700 } });
const s = await stranger.newPage();
await s.goto(PAGE);
await s.waitForFunction(() => document.getElementById('list').children.length > 0);
const theirs = await s.evaluate(() => ({
  rows: document.querySelectorAll('.rp').length,
  empty: !!document.querySelector('.rp-empty'),
  // The empty state has to explain itself: "nothing here" almost always means wrong device.
  explains: (document.querySelector('.rp-empty') || {}).textContent || '',
}));
if (theirs.rows) problems.push(`a different browser profile sees ${theirs.rows} of the reports`);
if (!theirs.empty) problems.push('a browser with no reports gets no empty state');
if (!/ব্রাউজার|ডিভাইস/.test(theirs.explains))
  problems.push('the empty state does not explain that reports are per-device');
await s.close();

// ---- rubbish in the store does not stop the page ------------------------------------------
const spoiled = await b.newContext({ viewport: { width: 900, height: 700 } });
const q = await spoiled.newPage();
let threw = null;
q.on('pageerror', e => { threw = e.message; });
await q.addInitScript(() => {
  try { localStorage.setItem('shobdojot.reports', '{not json'); } catch {}
});
await q.goto(PAGE);
await q.waitForFunction(() => document.getElementById('list').children.length > 0);
const corrupt = await q.evaluate(() => !!document.querySelector('.rp-empty'));
if (threw) problems.push(`a corrupt store threw on the page: ${threw}`);
if (!corrupt) problems.push('a corrupt store did not fall back to the empty state');
await q.close();

// ---- and it is not part of the installed app ----------------------------------------------
// The game installs to a home screen and precaches its shell. This page is opened on purpose,
// not installed, and putting it in the shell would list it in the cache for anyone poking
// about in devtools.
const sw = readFileSync(join(REPO, 'docs', 'sw.js'), 'utf8');
const shell = (sw.match(/^const SHELL = \[(.*)\];$/m) || [])[1];
if (!shell) problems.push('could not find the service worker shell list to check it');
else if (/reports/.test(shell)) problems.push('the reports page is in the service worker shell');

// ---- and offline it is never answered with the game ---------------------------------------
// The near miss this guards: the worker used to fall back to the cached game for ANY navigation
// it could not serve, on the grounds that the game was the only page there is. It no longer is.
// With nothing cached and no network, that fallback put the game at the reports address - a page
// that looks like it worked, which is worse than a plain failure for someone checking whether
// their notes are still there.
//
// This asks docs/sw.js directly rather than taking a browser offline, because a browser context
// set offline does NOT make the worker's own fetch() fail - it kept succeeding against the test
// server, so the fallback branch never ran and a deliberately broken worker passed. Running the
// real file against a stubbed cache and a failing network is the only way to reach the decision.
const swpage = await (await b.newContext()).newPage();
swpage.on('pageerror', e => problems.push('sw harness: ' + e.message));
await swpage.goto('about:blank');

const verdicts = await swpage.evaluate(async source => {
  const SHELL_BODY = 'THE-GAME';
  const handlers = {};
  const fake = {
    addEventListener: (name, fn) => { handlers[name] = fn; },
    skipWaiting() {}, clients: { claim() {} },
    location: { origin: 'https://example.test' },
  };
  let online = true;
  const box = {
    open: () => Promise.resolve({ addAll: () => Promise.resolve(), put: () => Promise.resolve() }),
    keys: () => Promise.resolve([]),
    delete: () => Promise.resolve(true),
    // Nothing has been visited yet, so the only thing in the cache is the precached shell.
    match: key => Promise.resolve(typeof key === 'string' && key.includes('index.html')
      ? new Response(SHELL_BODY) : undefined),
  };
  const net = () => online ? Promise.resolve(new Response('FROM-NETWORK'))
                           : Promise.reject(new TypeError('offline'));
  new Function('self', 'caches', 'fetch', source)(fake, box, net);

  const ask = async (url, mode) => {
    let answer;
    handlers.fetch({ request: { method: 'GET', url, mode }, respondWith: p => { answer = p; } });
    if (answer === undefined) return 'not handled';
    try {
      const res = await answer;
      if (!res) return 'nothing';
      if (res.type === 'error') return 'network error';
      return await res.text();
    } catch (err) { return 'rejected'; }
  };

  online = false;
  const offReports = await ask('https://example.test/reports/', 'navigate');
  const offReportsFile = await ask('https://example.test/reports/index.html', 'navigate');
  const offGame = await ask('https://example.test/index.html', 'navigate');
  online = true;
  const onReports = await ask('https://example.test/reports/', 'navigate');
  return { offReports, offReportsFile, offGame, onReports, SHELL_BODY };
}, sw);

for (const [what, got] of [['reports/', verdicts.offReports],
                           ['reports/index.html', verdicts.offReportsFile]]) {
  if (got === verdicts.SHELL_BODY)
    problems.push(`offline with nothing cached, ${what} was answered with the game`);
  else if (got !== 'network error' && got !== 'rejected' && got !== 'nothing')
    problems.push(`offline, ${what} was answered with something unexpected: "${got}"`);
}
// The game's own fallback is the one being narrowed, not removed: it still has to hold.
if (verdicts.offGame !== verdicts.SHELL_BODY)
  problems.push(`offline with nothing cached, the game did not fall back to its shell: `
              + `"${verdicts.offGame}"`);
// And with a network, the reports page is served from the network like anything else.
if (verdicts.onReports !== 'FROM-NETWORK')
  problems.push(`online, reports/ was not served from the network: "${verdicts.onReports}"`);
console.log(`worker: offline reports/ -> ${verdicts.offReports}, offline game -> `
          + `${verdicts.offGame === verdicts.SHELL_BODY ? 'its shell' : verdicts.offGame}`);
await swpage.close();

await b.close();
await site.close();
report(problems, 'REPORTS PAGE OK: reads what the game kept, unlinked and noindexed, '
               + 'text stays text, and another browser sees nothing');
