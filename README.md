# email_template1

---

**শব্দজট (Shobdojot)** - a Bengali word-cross puzzle game also lives in this repository:

- **Edit `src/`.** The page ships as one self-contained file - the service worker plays it
  back offline and the artifact host allows no second request - but it is not authored as one.
  [`src/index.html`](src/index.html) is the document and a list of its parts; the parts are in
  [`src/css/`](src/css) and [`src/js/`](src/js), one file per concern, and `build.py` pastes
  them together. An `/* include ... */` line is a comment in both CSS and JavaScript, so
  `index.html` is still a page a browser will parse - just an unstyled, unplayable one. Every
  part is hand-written and commented except `src/js/02-levels.js`, which `build.py` generates.
  `check` fails if a file in `src/css` or `src/js` is not included anywhere, so a new part
  cannot go quietly unwired.
- **`docs/` is the whole site**, and it installs: `manifest.webmanifest`, `icon.svg`,
  `icon-maskable.svg` and `sw.js` make it a home-screen app that plays with no connection at
  all. `sw.js` caches the page on first visit and its `VERSION` is stamped by `build.py` from
  the level count and the built page's length, so returning players get an update whenever the
  page actually changes - left to a human that gets forgotten, and a forgotten bump means the
  site updates for new visitors and for nobody else. A service worker needs a secure origin, so
  none of it runs from a `file://` copy; `pwatest` serves the folder over 127.0.0.1 and checks
  it offline for real.
- **Ship [`docs/index.html`](docs/index.html).** Built from the source by `build.py build`
  with its comments stripped - 104 KB gzipped against the source's 113 - and publishable with
  GitHub Pages by pointing Pages at branch `main`, folder `/docs`.
  [`docs/live.html`](docs/live.html) is the same build with the
  `<!doctype>`/`<head>`/`<body>` wrapper removed, for hosts that supply their own. Neither is
  edited directly: `build.py` overwrites both, and the tests run against the built file rather
  than the source, so a mistake in the stripping fails a test instead of shipping.
- **Test it: `npm test`.** Sixteen browser checks against the built page, about four minutes;
  `npm run test:all` adds the solve sweep, which opens all 256 levels and wins each one. The
  runner refuses to start if `docs/index.html` is not what `src/` would build right now - see
  [`tools/tests/README.md`](tools/tests/README.md) for why that guard is there, and what the
  suite cost before it existed.
- **Android app (Kotlin + Compose): parked.** [`bengali-word-game/`](bengali-word-game/) is a
  working skeleton whose screens are deliberately behind the web version, and it stays that way
  until the design settles. Porting a design twice while it is still moving is wasted work.

The levels themselves are not part of that split. Both builds generate their level table from
[`tools/catalogue.py`](tools/catalogue.py) via `python3 tools/build.py build`, so
`Levels.kt` stays current even while the app's screens do not - which is what lets the Kotlin
unit tests and the board-for-board diff between the two generators keep checking the puzzles.
