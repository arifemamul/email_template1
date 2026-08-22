# Level pipeline

The 83 levels in the game are generated from `catalogue.py`, not typed into the app. This
directory is that generator, plus the checks that keep bad content out.

```bash
pip install -r tools/requirements.txt

python3 tools/build.py check              # validate the catalogue, print the ramp
python3 tools/build.py build              # regenerate both builds' level tables
python3 tools/build.py curriculum         # the syllabus: what each level teaches
python3 tools/build.py slots              # audio and illustration work, in recording order
python3 tools/build.py show 64            # print one level's board
python3 tools/build.py discover প্রজাপতি   # what else can this word's tiles spell?
python3 tools/propose.py 2 --kar া        # candidate tile sets for one stage of the syllabus
python3 tools/bangla.py                   # self-test the akshara and layout logic
```

## The pieces

| File | What it holds |
|---|---|
| `curriculum.py` | The teaching order: what a letter, sign or conjunct *is*, and the sequence they are taught in |
| `vocabulary.py` | The word pool, themed and curated for a learner, with the rejections written down |
| `catalogue.py` | The levels themselves, grouped into the five blocks of the syllabus |
| `propose.py` | Authoring aid: candidate tile sets for a block, for a person to choose between |
| `wordpool.py` | Corpus frequency, used as the floor that rejects invented words |
| `bangla.py` | Akshara splitting and crossword placement, mirroring the game's own logic |
| `build.py` | The CLI, and the only thing that writes the generated files |

## Teaching order, not difficulty order

Levels are ordered by what they teach first and only then by how hard the board is. Ranking
purely on difficulty produces a good puzzle ramp and a bad syllabus: the previous ordering
handed out its first vowel sign in level 6 without having introduced one, its first conjunct
was a three-consonant cluster, and it introduced 39 distinct letter shapes in the first 20
levels with no review.

The five blocks are plain letters, one vowel sign at a time, several signs together, conjuncts
one family at a time, then free play. A level declares its block and `check` verifies the claim
against what its words actually contain, so a stray conjunct cannot land in the vowel-sign
block where nothing has taught it. `curriculum` prints the result.

`check` exits non-zero if anything is wrong, so it belongs in CI.

## Adding a level

1. Decide which block it belongs in - which stage of the writing system it needs.
2. `python3 tools/propose.py <block>` lists tile sets that stage can support, drawn from the
   curated vocabulary. Add `--kar া` or `--new ন্ত` to anchor it on one sign or cluster, or
   `--theme food` to stay inside one theme.
3. Pick a set. **Do not take the list wholesale** - the proposer only knows what is legal, not
   what is worth a child's time.
4. Add the word list to the right block of `SYLLABUS` in `catalogue.py`.
5. `python3 tools/build.py check`, fix whatever it complains about, then `build`.
6. `cd bengali-word-game && ./gradlew test` to re-verify against the app's own generator.

To add a word to the pool, put it in the right theme in `vocabulary.py`. It has to be a word a
picture could replace - concrete, or a number or colour - and `check_pool` will reject it if it
is not attested or repeats an akshara.

## What `check` enforces

- Every word occurs in real Bengali text. Invented compounds read plausibly and are the
  easiest mistake to make here: বইখাতা and শিশুপাঠ both shipped before this check existed.
- No word is on the rejection list in `vocabulary.py`. That list is where the newspaper
  register goes - প্রতিষ্ঠান, রাষ্ট্রপতি, সংবাদপত্র are all common in adult prose and all
  useless to a beginner - along with proper nouns and unpleasant senses.
- A level's declared block matches what its words need, so the syllabus is not a fiction.
- A board grown to fill its word target only takes words the learner has already been taught
  to read, so a fuller board never smuggles in an unintroduced letter.
- Every word is spellable from the level's tiles using each tile at most once, and every tile
  is used by some word - the wheel never holds a letter the player cannot spend.
- The words form a **connected** crossword. Some sets have no arrangement at all. Only two
  words can pass through one cell - one across, one down - so if three words share nothing but
  the same single akshara, one of them has nowhere to go. `চার / কার / চাবি / চাকা` fails that
  way: চার, চাবি and চাকা meet only at চা. When a level is rejected for this, drop or swap a
  word - `discover` will suggest alternatives, and adding a word can also *fix* it by giving
  the stranded word a second place to cross.
- The board spells nothing besides the level's own words. A stray run of two letters is a word
  the player has no way to solve.
- The board fits a phone: at most 8 rows by 9 columns.

## Why the logic is duplicated

`bangla.py` mirrors `logic/BanglaText.kt` and `logic/CrosswordGenerator.kt`, and the web build
has a third copy in the `<script>` of `docs/index.html`. The tools have to reason about a level
exactly the way the game will lay it out, or a level validates here and breaks on a phone.

The copies are kept honest by regenerating and diffing: the Kotlin generator and the web
generator are run over all 83 levels and their boards compared cell by cell. If you change a
placement rule, change it in all three and re-run that comparison.
