/*
 * Offline for a child on patchy mobile data.
 *
 * The game is one self-contained file with no other requests, so caching it is the whole job:
 * open the page once on any connection at all and it plays forever after with none. That is
 * the point of this file rather than a nicety - the audience is children in Bangladesh, where
 * a data connection is something you have sometimes.
 *
 * Cache-first, and deliberately so. The page never needs to be fresh mid-session, and a child
 * halfway through a level on a train should not lose it because the network came back badly.
 * Freshness is handled the other way round: every install fetches a new copy in the background
 * and swaps it in on the next open.
 *
 * VERSION is what forces that swap. Bump it whenever the page changes, or returning players
 * keep the copy they already have - `build.py` stamps it from the level count and the page's
 * own length, so it changes on its own whenever the built page does.
 */
const VERSION = 'shobdojot-406-366587';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-maskable.svg'];

/*
 * reports/ is the one other page on the site and it is deliberately absent from SHELL: it is
 * opened on purpose from a typed address, never installed, and listing it here would put it in
 * front of anyone poking through devtools. It still gets cached the moment it is opened, like
 * anything else - it just is not part of the installed app. This pattern is what keeps it out
 * of the shell fallback below.
 */
const REPORTS = /(^|\/)reports\/(index\.html)?$/;

self.addEventListener('install', event => {
  // Take over as soon as the new copy is ready rather than waiting for every tab to close.
  self.skipWaiting();
  event.waitUntil(
    caches.open(VERSION).then(cache => cache.addAll(SHELL)).catch(() => {})
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(n => n !== VERSION).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  // Same-origin only. Anything else is not ours to serve from a cache.
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(hit => {
      // Refresh in the background whether or not the cache had it: the copy on screen stays
      // the one that loaded instantly, and the next open gets the new one.
      const fresh = fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then(cache => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => hit);           // offline: the cache is the answer, or nothing is

      if (hit) return hit;
      return fresh.then(response => {
        if (response) return response;
        // Nothing cached and no network. A navigation to the game can still render, because the
        // shell copy is always there. A navigation to reports/ must not: answering that address
        // with the game would hide "nothing was cached" behind a page that looks like it worked,
        // and someone checking their kept notes would be told a comfortable lie. Let the browser
        // report the failure it actually had.
        if (request.mode === 'navigate' && !REPORTS.test(url.pathname))
          return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
