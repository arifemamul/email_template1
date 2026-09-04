# The browser test suite

```
npm test                              the seventeen checks, about four minutes
npm run test:all                      and the full solve sweep, about twelve more
node tools/tests/run.mjs playtest     one check, or several, by name
node tools/tests/run.mjs --list       what there is
```

Needs `playwright`. `npm install` in the repository root is enough; a global install works too,
and the harness finds either.

## What these test

`docs/index.html` — **the file that actually ships**, never `src/`. The build strips comments,
splices in a generated level table and assembles seventeen source files into one page, and any
of those steps can go wrong. Testing the source would not notice.

## Why the runner checks staleness first

It asks `python3 tools/build.py stale` whether the built page is what `src/` would produce right
now, and refuses to run if it is not.

That guard exists because of a real failure, not a hypothetical one. This suite used to live
outside the repository and opened the page as `process.cwd() + '/shobdojot.html'` — a path that
resolved to a *copy*. The copy went stale. Ten of the fifteen tests then spent five commits
passing against a file none of those commits had touched, reporting "156 levels" while the game
shipped 169. Nothing failed, so nothing was noticed.

A test that cannot see the thing it describes is worse than no test, because it is believed. So:

- no test knows a path — `harness.mjs` locates the page from its own position in the repository;
- no test knows a port — the harness serves `docs/` on a port the OS picks;
- no test knows the browser's path — the harness resolves it;
- no test hardcodes the level count — it reads `LEVELS.length` from the page.

Three tests had a level count written into them and passed for weeks after the count changed.
If you find yourself typing a number from the game into a test, read it from the page instead.

## The checks

| check | what it is for |
|---|---|
| `parity` | every board in the page matches the one `tools/bangla.py` laid out |
| `tofucheck` | every akshara the game can show has a real glyph in the embedded font |
| `fontcheck` | Bengali renders with the embedded font, conjunct shaping intact |
| `glyphcheck` | every letter is one size on every level, and every box holds it |
| `fittest` | board, wheel and buttons fit at every screen size |
| `rowcheck` | the actions row fits everywhere |
| `guidetest` | the guide opens, closes, and holds the cards it should |
| `menutest` | six menu sections, the alphabet charts counted from the game, letters open their levels |
| `quiettest` | no sound button, no word counter, no pause — and every word is spoken |
| `heartest` | every letter and word on screen can be heard, and nothing looks pressable without a voice |
| `wheeltest` | the wheel is scrambled, stable between visits, and drawn as scrambled |
| `playtest` | a level plays through, by drag and by tap |
| `pathstest` | every route back to a finished level finds it blank and playable |
| `advancetest` | clearing advances, the next board is blank, the grid is coloured by letter |
| `replaytest` | a cleared level can be played again |
| `oldsavetest` | progress saved by an older build still loads |
| `saytest` | the feedback card copies a note with the level attached |
| `pwatest` | installs, and plays with the network cut |
| `sweep` | **slow.** Opens all 256 levels and solves each one at 360×640 |

`sweep` is excluded by default because it takes about twelve minutes. Run it before anything
that changes the catalogue, the board placer or the wheel — it is the only check that proves
every level is actually winnable.

## Two tests are served over http rather than `file://`

`pwatest` and `saytest`. A service worker needs a secure origin and so does the clipboard, and
`127.0.0.1` counts as one where `file://` does not. The harness's `serveDocs()` handles it.

## When a check fails

The runner prints the failing test's whole output after the summary. Run it alone to iterate:

```
node tools/tests/run.mjs guidetest
```

If a check fails because the game legitimately changed, fix the check — but write down in it
what the new contract is and why, the way `quiettest` records that the topbar carries the
level's letter and must never carry a word counter again.
