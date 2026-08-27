import { launch, PAGE, serveDocs } from './harness.mjs';
// Does the game install and play with no network at all?
//
// This is the one test that cannot use a file:// page: a service worker needs a secure origin,
// so the page has to be served. The harness serves docs/ on 127.0.0.1, which counts as secure,
// registers the worker, checks what landed in the cache, then cuts the network and reloads.
//
// Written after the registration guard checked `location.protocol === 'https:'`, which is true
// on the real site and false on localhost - so the feature worked in production and could not
// be tested anywhere. `isSecureContext` is the check that means what that one looked like it
// meant.
const site = await serveDocs();

const b = await launch();
const problems = [];
// localhost counts as a secure origin, so the worker registers here exactly as it would on https
const ctx = await b.newContext({ viewport: { width: 360, height: 640 } });
const p = await ctx.newPage();
await p.goto(site.url + '/index.html');
await p.waitForFunction(() => document.querySelector('.tile'));

// What the page holds with the network up, so the offline reload is compared against the real
// number rather than one written into this file and left behind by the next catalogue change.
const online = await p.evaluate(() => ({ levels: LEVELS.length }));
console.log('online:', JSON.stringify(online));

const reg = await p.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return { supported: false };
  const r = await navigator.serviceWorker.ready.catch(() => null);
  return { supported: true, active: !!(r && r.active), scope: r ? r.scope : null };
});
console.log('service worker:', JSON.stringify(reg));
if (!reg.active) problems.push('the service worker never became active');

// the manifest the browser actually parsed
const man = await p.evaluate(async () => {
  const link = document.querySelector('link[rel=manifest]');
  if (!link) return null;
  const r = await fetch(link.href);
  const j = await r.json();
  return { name: j.name, display: j.display, icons: j.icons.length, start: j.start_url };
});
console.log('manifest:', JSON.stringify(man));
if (!man) problems.push('no manifest link');
else {
  if (man.display !== 'standalone') problems.push(`display is ${man.display}`);
  if (man.icons < 2) problems.push('needs a maskable icon as well as a plain one');
}

// what actually got cached
await p.waitForTimeout(1500);
const cached = await p.evaluate(async () => {
  const names = await caches.keys();
  const c = await caches.open(names[0]);
  const keys = await c.keys();
  return { cache: names[0], urls: keys.map(r => new URL(r.url).pathname) };
});
console.log('cached:', JSON.stringify(cached));
if (!cached.urls.some(u => u.endsWith('/index.html') || u === '/')) problems.push('the page itself was not cached');

// now cut the network entirely and reload
await ctx.setOffline(true);
const off = await ctx.newPage();
let loaded = true;
await off.goto(site.url + '/index.html').catch(() => { loaded = false; });
if (loaded) {
  await off.waitForFunction(() => document.querySelector('.tile'), { timeout: 8000 })
    .catch(() => problems.push('offline: the page loaded but the game never started'));
  const state = await off.evaluate(() => ({
    levels: typeof LEVELS !== 'undefined' ? LEVELS.length : 0,
    tiles: document.querySelectorAll('.tile').length,
    font: getComputedStyle(document.querySelector('.tile')).fontFamily.slice(0, 24)
  })).catch(() => null);
  console.log('offline reload:', JSON.stringify(state));
  if (!state || state.levels !== online.levels)
    problems.push(`offline: ${state ? state.levels : 0} levels loaded, ${online.levels} online`);
  if (!state || !state.tiles) problems.push('offline: no wheel drawn');
} else {
  problems.push('offline: the page did not load at all');
}
await b.close();
await site.close();
if (problems.length) { console.log('\nPROBLEMS:'); problems.forEach(x => console.log(' - ' + x)); process.exitCode = 1; }
else console.log('\nINSTALLABLE AND PLAYS WITH THE NETWORK OFF');
