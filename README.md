# email_template1

---

**শব্দজট (Shobdojot)** - a Bengali word-cross puzzle game also lives in this repository:

- **Edit [`src/shobdojot.html`](src/shobdojot.html).** That is the page, comments and all,
  and the only file to change by hand. All design work happens here.
- **Ship [`docs/index.html`](docs/index.html).** Built from the source by `build.py build`
  with its comments stripped - 104 KB gzipped against the source's 113 - and publishable with
  GitHub Pages by pointing Pages at branch `main`, folder `/docs`.
  [`docs/live.html`](docs/live.html) is the same build with the
  `<!doctype>`/`<head>`/`<body>` wrapper removed, for hosts that supply their own. Neither is
  edited directly: `build.py` overwrites both, and the tests run against the built file rather
  than the source, so a mistake in the stripping fails a test instead of shipping.
- **Android app (Kotlin + Compose): parked.** [`bengali-word-game/`](bengali-word-game/) is a
  working skeleton whose screens are deliberately behind the web version, and it stays that way
  until the design settles. Porting a design twice while it is still moving is wasted work.

The levels themselves are not part of that split. Both builds generate their level table from
[`tools/catalogue.py`](tools/catalogue.py) via `python3 tools/build.py build`, so
`Levels.kt` stays current even while the app's screens do not - which is what lets the Kotlin
unit tests and the board-for-board diff between the two generators keep checking the puzzles.
