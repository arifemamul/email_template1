# শব্দজট - Shobdojot

A Bengali word-cross puzzle game for Android. Letters sit on a wheel; drag across them to
spell a word, and every word you find fills itself into the crossword above.

Native Android, Kotlin + Jetpack Compose, no third-party game engine, no network access,
no ads, no analytics. Progress lives in SharedPreferences on the device.

## What makes it Bengali rather than a translated English game

Bengali is not one-letter-per-character. The word **মাছ** is stored as three code points
but a reader sees two letter units - **মা** and **ছ**. Those units (aksharas) are what the
game is built on: one akshara per wheel tile, one per grid cell.

`BanglaText.splitAksharas` does the splitting, handling the three cases that matter:

| Case | Word | Aksharas |
|---|---|---|
| Plain consonants | কমল | ক + ম + ল |
| Vowel signs stay attached | বিদেশ | বি + দে + শ |
| Hasanta binds a conjunct | বন্ধু | ব + ন্ধু |

Get this wrong and the game is unplayable - the player would be asked to drag "ম", "া", "ছ"
as three separate tiles, which is not how anyone reads or writes Bengali.

## Gameplay

- **104 levels in teaching order**, for someone learning to read Bengali rather than only to
  speak it. Five blocks, each holding the previous one constant and adding one new thing:
  plain letters, then one vowel sign at a time (া, then ি, then ে, then ু), then several signs
  in one word, then conjuncts one family at a time (ন্ত, স্ত, ন্ধ, ক্ষ), then free play on the
  fullest boards. Puzzle difficulty orders levels only *within* a block. 348 distinct words,
  three to five per board.
- **The whole alphabet, by the end**: all 11 independent vowels, all 10 vowel signs, both
  nasal marks and every consonant - 57 pieces of the writing system, each introduced by name
  in the level that first uses it. Three are left out on purpose and `curriculum.NOT_TAUGHT`
  says why: ৗ is not a sign of its own in modern Bengali, ঃ reaches only দুঃখ and অতঃপর, and
  ঞ never stands outside a cluster. `build.py check` fails if anything else goes missing.
- **Each level records what it is first to introduce** - a letter, a vowel sign, a conjunct -
  Thirty-seven of the 104 introduce nothing at all: a shape met once and never seen again has
  not been learned.
- **No word is set as a puzzle twice.** The catalogue used to fill 377 board slots with 201
  words, leaning on কলম, বল, কল and সব across a dozen tile sets each, so a good part of the
  game was re-spelling words the player already knew. Now every board is words no earlier
  board has used. Nine levels early in block 1 have to borrow and cannot do otherwise - a
  learner who knows four letters has exactly one board available to them - and each is listed
  in `catalogue.SHARED` with the reason. `build.py check` fails on any repeat that is not.
- **Every word spoken.** Web build only so far: a word is said the moment it is found.
  This matters more than it sounds - Bengali spelling hides the sound, since ব and ভ, শ and ষ
  and স, ন and ণ are each one sound in speech and different letters on the page, which is
  exactly where a child who speaks Bengali at home but reads none of it goes wrong. Recorded
  clips take precedence when they exist (`python3 tools/build.py voice` lists what to record);
  failing that the device's own Bengali voice is used; failing that nothing is spoken at all,
  because an English voice reading Bengali would teach the wrong sounds.
- **Drag to spell.** Sliding back onto the previous tile un-picks it.
- **No score.** No coins, no points, no bonus for finishing a level. Finding the word is the
  reward, and the confetti says so; a running total invites a child to play for the number
  rather than to read.
- **Hints** reveal one letter from a word you have not solved. Free, and as many as you like,
  since there is nothing to spend.
- **Shuffle** rearranges the wheel and is free.
- **Finishing a level moves on by itself** (web build), the moment the last word settles onto
  the board. No card and no countdown: the confetti plays across the change.
- **Every level opens blank.** Leaving a level discards the attempt rather than saving it -
  going back to a level means wanting to play it again, and a board arriving part-filled with
  letters you cannot remember placing is worse than a clean one. Which levels you have
  finished is remembered separately, and shows in the level picker.
- **The wheel is scrambled**, from a seed fixed by the level id - so a level looks the same
  every time you return to it, and no wheel lays a word of three or more letters out in
  sequence around the ring.
- The level picker is colour-coded by syllabus block, so it reads as five stages rather than
  104 identical chips.

## Play it on the web

`docs/index.html` (repo root, one level up from this folder) is a complete, self-contained
build of the same game for the browser - one file, no build step, no dependencies, no
network calls. Bengali splitting, the crossword generator and all 104 levels are ported from
this app's Kotlin, and the port is checked by diffing generated boards against the compiled
Kotlin: all 104 come out identical, cell for cell.

Launch it any of these ways:

- **GitHub Pages** - Settings -> Pages -> Source: *Deploy from a branch*, branch `main`,
  folder `/docs`. The game is then live at `https://<user>.github.io/<repo>/`.
- **Any static host** - drag `docs/index.html` onto Netlify, Cloudflare Pages, Vercel, or an
  S3 bucket. Rename it `index.html` at the root of whatever you upload.
- **No host at all** - open the file directly, or email it. It runs from `file://`.

Progress is kept in the browser's own storage, so a player keeps their solved
levels between visits without any account or server.

The Bengali face is embedded in the file as a `data:` URI (Noto Sans Bengali, Bengali range
only, ~92 KB for both weights), so the page reads correctly on machines with no Bengali font
installed and keeps working with no network at all. Originals and the licence are in
`docs/fonts/`.

## Building

Requires the Android SDK (API 35 platform + build tools) and JDK 17.

```bash
cd bengali-word-game
./gradlew assembleDebug          # APK at app/build/outputs/apk/debug/
./gradlew installDebug           # to a connected device or emulator
./gradlew test                   # unit tests: text splitting, layout, level content
```

### Fonts

Noto Sans Bengali is bundled with the app (`res/font/`, regular + bold, ~276 KB) and applied
to every style in the type scale by `ui/theme/Type.kt`. Android has shipped a Bengali font
for years, but OEM builds vary, and a ROM without Bengali coverage would turn every tile
into an empty box - the one failure this game cannot survive. Bundling also makes the app
and the web build render identical letterforms.

Licence: SIL Open Font License 1.1 - `app/src/main/assets/fonts/OFL.txt`, which ships inside
the APK so the licence travels with the font.

## How the board gets built

Levels store a word list, not a grid. `CrosswordGenerator` lays the words out at runtime:
one word is seeded across the middle, and every other word must cross an existing akshara
without ever running flush alongside another word (which would spell something unintended).

Greedy placement is not enough - an early choice can strand a later word - so the generator
backtracks over both word order and placement, and is fully deterministic. That determinism
is load-bearing: hint positions are saved as grid coordinates, and they have to still point
at the same cells after the app is killed and reopened.

Some word sets simply cannot be laid out. Only two words can pass through one cell - one
across, one down - so three words that share nothing but the same akshara cannot all be
placed. `চার / কার / চাবি / চাকা` fails that way, because চার, চাবি and চাকা meet only at চা.
The generator degrades gracefully by parking leftovers on their own row, but `LevelsTest`
fails the build instead, because a floating word is a content bug, not something to ship.

Adding a word can *fix* such a level rather than break it: this one becomes placeable - and
better - once বিচার and রবি join it, because they give the stranded words somewhere else to
cross. It ships as a six-word level.

## Adding levels

`data/Levels.kt` is generated - editing it by hand desynchronises this app from the web build.
Add the level to the right block of `SYLLABUS` in `tools/catalogue.py` instead, then:

```bash
python3 tools/build.py check     # then fix whatever it complains about
python3 tools/build.py build
cd bengali-word-game && ./gradlew test
```

`LevelsTest` checks the whole catalogue: every word spellable from its tiles using each tile at
most once, no tile left unusable, at least three words per level, a connected layout, no
accidental words on the board, a grid that fits a phone screen, blocks that never run backwards,
nothing taught twice, and - the one the ordering exists for - no level showing a letter form that
nothing earlier introduced.

Words should also be real, and worth a learner's time. Every word shipped here was checked
against Bengali corpus frequency data before being hand-picked; that check caught two compounds
in an earlier draft (বইখাতা, শিশুপাঠ) that read plausibly but do not occur in Bengali text.

Frequency is the floor, not the selector. Ranking by it fills the game with প্রতিষ্ঠান
(institution), সংবাদপত্র (newspaper) and রাষ্ট্রপতি (president) - all common in adult prose,
none of them words a child needs - so words now come from a themed pool curated for a learner,
with the rejections written down in `tools/vocabulary.py`.

## Layout

```
app/src/main/java/com/bangla/shobdojot/
  logic/BanglaText.kt           akshara splitting, spellability, Bengali digits
  logic/CrosswordGenerator.kt   backtracking crossword layout
  model/Models.kt               Level, Puzzle, PlacedWord, GridPos
  data/Levels.kt                the 104 levels, generated by tools/build.py
  data/GameRepository.kt        unlocks and per-level progress
  ui/GameViewModel.kt           game state and rules
  ui/components/LetterWheel.kt  the drag-to-connect wheel
  ui/components/CrosswordGrid.kt
  ui/components/WordPreview.kt  traced word, shakes on a bad guess
  ui/screens/                   HomeScreen (level picker), GameScreen
  ui/theme/                     colours, and the bundled Bengali typography
```

Unit tests are in `app/src/test/java/com/bangla/shobdojot/`.
