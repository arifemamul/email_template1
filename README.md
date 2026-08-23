# email_template1

---

**শব্দজট (Shobdojot)** - a Bengali word-cross puzzle game also lives in this repository:

- **Web build - this is the live one.** One self-contained file:
  [`docs/index.html`](docs/index.html), publishable with GitHub Pages by pointing Pages at
  branch `main`, folder `/docs`. All design work happens here.
- **Android app (Kotlin + Compose): parked.** [`bengali-word-game/`](bengali-word-game/) is a
  working skeleton whose screens are deliberately behind the web version, and it stays that way
  until the design settles. Porting a design twice while it is still moving is wasted work.

The levels themselves are not part of that split. Both builds generate their level table from
[`tools/catalogue.py`](tools/catalogue.py) via `python3 tools/build.py build`, so
`Levels.kt` stays current even while the app's screens do not - which is what lets the Kotlin
unit tests and the board-for-board diff between the two generators keep checking the puzzles.
