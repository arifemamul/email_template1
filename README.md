# শব্দজট · Shobdojot

A Bengali word-cross game for a child who has just learned their letters.

It ships as **one HTML file**. Open [`docs/index.html`](docs/index.html) in any browser and it
runs: no server, no build step, no install, no sign-up, no ads, no network. The Bengali font is
embedded, so it renders the same on a machine that has never had one.

Drag or tap letters off a wheel to fill a small crossword. 244 levels in বর্ণমালা order -
স্বরবর্ণ first, then ক to হ - and each level is named for the letter it teaches, so a child
reads **কা** at the top of the screen rather than **২১** and knows where in the alphabet they
are.

**A tile is one akshara.** `কা` is one square, not two, and `ক্ষ` is one tile because it is one
letter. That decision runs through everything here: the splitter, the board placer, the wheel,
and the যুক্তবর্ণ page that explains it to the player.

Two limits shape every level, and they are not the same limit:

| | limit | why |
|---|---|---|
| the ring | at most 5 letters | how much there is to rule out before the first tile can be picked |
| the word | at most 3 aksharas | how long the answer is, and so how many chances there are to go wrong |

609 words, all two or three letters. All 57 units of the alphabet are taught.

Behind the menu: the two halves of the বর্ণমালা as charts built from the level table, the full
বারোখড়ি, and three tables transcribed from a printed Bangladeshi primer - শব্দ গঠন, ফলা and
103 যুক্তবর্ণ. Every claim in them is re-derived from scratch on each build rather than trusted.

---

## Working on it

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
  with its comments stripped - 305 KB, 126 KB gzipped - and publishable with
  GitHub Pages by pointing Pages at the default branch, folder `/docs`.
  [`docs/live.html`](docs/live.html) is the same build with the
  `<!doctype>`/`<head>`/`<body>` wrapper removed, for hosts that supply their own. Neither is
  edited directly: `build.py` overwrites both, and the tests run against the built file rather
  than the source, so a mistake in the stripping fails a test instead of shipping.
- **The kept reports are a second page, at [`docs/reports/`](docs/reports/index.html).** Once
  Pages is pointed at `/docs`, its address is `…/reports/` alongside the game - a folder rather
  than a filename, so nothing has to be typed with an extension. It is linked from nowhere and
  carries `noindex`, but the address is not what keeps it private: the notes live in
  `localStorage`, which is per-origin **per browser profile**, so the page shows what this
  browser wrote and a stranger opening the same URL sees an empty list. It is deliberately not
  in the service worker's shell either - it is opened on purpose, not installed - and with no
  network and nothing cached the worker lets the browser report that plainly instead of
  answering the reports address with the game.
- **Test it: `npm test`.** Twenty browser checks against the built page, about five minutes;
  `npm run test:all` adds the solve sweep, which opens all 244 levels and wins each one
  (about eleven minutes more). The
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
