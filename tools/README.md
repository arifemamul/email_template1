# Level pipeline

The 66 levels in the game are generated from `catalogue.py`, not typed into the app. This
directory is that generator, plus the checks that keep bad content out.

```bash
pip install -r tools/requirements.txt

python3 tools/build.py check              # validate the catalogue, print the difficulty ramp
python3 tools/build.py build              # regenerate both builds' level tables
python3 tools/build.py show 64            # print one level's board
python3 tools/build.py discover প্রজাপতি   # what else can this word's tiles spell?
python3 tools/bangla.py                   # self-test the akshara and layout logic
```

`check` exits non-zero if anything is wrong, so it belongs in CI.

## Adding a level

1. Think of a spine word — a concrete, everyday noun of 3–6 aksharas.
2. `python3 tools/build.py discover <word>` lists every attested Bengali word its tiles can
   spell, with frequencies.
3. Pick the ones that are real, ordinary words. **Do not take the list wholesale** — corpus
   frequency happily offers verb inflections (করেছেন) and fragments, which make dull puzzles.
4. Add the word list to `CATALOGUE` in `catalogue.py`.
5. `python3 tools/build.py check`, fix whatever it complains about, then `build`.
6. `cd bengali-word-game && ./gradlew test` to re-verify against the app's own generator.

## What `check` enforces

- Every word occurs in real Bengali text. Invented compounds read plausibly and are the
  easiest mistake to make here: বইখাতা and শিশুপাঠ both shipped before this check existed.
- Every word is spellable from the level's tiles using each tile at most once, and every tile
  is used by some word — the wheel never holds a letter the player cannot spend.
- The words form a **connected** crossword. Some sets have no arrangement at all. Only two
  words can pass through one cell — one across, one down — so if three words share nothing but
  the same single akshara, one of them has nowhere to go. `চার / কার / চাবি / চাকা` fails that
  way: চার, চাবি and চাকা meet only at চা. When a level is rejected for this, drop or swap a
  word — `discover` will suggest alternatives, and adding a word can also *fix* it by giving
  the stranded word a second place to cross.
- The board spells nothing besides the level's own words. A stray run of two letters is a word
  the player has no way to solve.
- The board fits a phone: at most 8 rows by 9 columns.

## Why the logic is duplicated

`bangla.py` mirrors `logic/BanglaText.kt` and `logic/CrosswordGenerator.kt`, and the web build
has a third copy in the `<script>` of `docs/index.html`. The tools have to reason about a level
exactly the way the game will lay it out, or a level validates here and breaks on a phone.

The copies are kept honest by regenerating and diffing: the Kotlin generator and the web
generator are run over all 66 levels and their boards compared cell by cell. If you change a
placement rule, change it in all three and re-run that comparison.
