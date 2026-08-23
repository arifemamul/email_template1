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

- **An alphabet game, twenty letters in.** Each level is a letter, and its board is the words
  that begin with it: ক is কলম কবুতর কমলা কমল কম কর কল কলা, eight words and every one of them ক.
  The alphabet starts with vowels so those come first, two to a level - অ আ, ই উ, এ ও - because
  ঊ, এ and ঐ have a single pool word each and cannot carry a level alone. Then the consonants one
  at a time, ক through ন. ঙ, ঞ and ণ are skipped; no Bengali word begins with any of them. The
  next batch picks up at প.
- **Some words are bridges.** এক and ওজন share no letter, so a board holding both needs কঠিন and
  জন between them. Each level declares its letter in `catalogue.SYLLABUS`, and `build.py check`
  fails unless the board is about that letter: at least two words starting with it, and more
  starting with it than with any other single letter. That caught a level named থ whose board
  was থাকা থালা পাঠশালা পানি পাঠ - two থ words and three প ones, which is a প level, and which
  would have taken three words প's own level needs.
- **A letter's words are reserved for its own level.** ঢ would happily use থাকা and থালা as
  bridges, and then থ - which has four words in the whole pool - would have none left.
- **`catalogue.FULL_SYLLABUS` is `False`** and the ordering follows from it: a syllabus is
  ordered by block, an alphabet game by the alphabet, and the two disagree - ক lands in block 3
  and গ in block 2. Checks and tests that only mean something about a complete syllabus report
  instead of failing.
- **There were 104**, running through all five blocks to free play and covering every letter and
  sign in the language. They were deleted on purpose while the way a level works is reworked;
  `git show d102737:tools/catalogue.py` has all of them.
- **Five blocks are still the plan** for a rebuilt syllabus: plain letters, then one vowel sign
  at a time, then several signs in one word, then conjuncts one family at a time, then free play
  on the fullest boards. Blocks are still derived and checked for every level - they just do not
  decide the order while this is an alphabet game. The machinery for a full syllabus - block
  budgets, board targets, board growth from the pool - is still here and sized for it.
- **The whole alphabet was the promise**, and is what a rebuilt syllabus comes back to: all 11
  independent vowels, all 10 vowel signs, both nasal marks and every consonant - 57 pieces of
  the writing system, each introduced by name in the level that first uses it. Three are left
  out on purpose and `curriculum.NOT_TAUGHT` says why: ৗ is not a sign of its own in modern
  Bengali, ঃ reaches only দুঃখ and অতঃপর, and ঞ never stands outside a cluster. `build.py
  check` reports what is missing, and goes back to failing on a gap when `FULL_SYLLABUS` is
  set again.
- **Each level records what it is first to introduce** - a letter, a vowel sign, a conjunct.
  All ten introduce something, and several introduce a good deal at once: ten levels reaching
  from plain letters to conjuncts cannot also spend two of them per level.
- **No word is set as a puzzle twice.** An earlier catalogue filled 377 board slots with 201
  words, leaning on কলম, বল, কল and সব across a dozen tile sets each, so a good part of the
  game was re-spelling words the player already knew. Nothing borrows now - fifty-nine board
  words out of a five-hundred-word pool leaves no level short of options - so
  `catalogue.SHARED` is empty. `build.py check` fails on any repeat that is not listed there,
  and on any listing no level needs.
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
- The level picker is colour-coded by syllabus block, so that once there is more than one
  block it reads as stages rather than as a wall of identical chips.

## Play it on the web

`docs/index.html` (repo root, one level up from this folder) is a complete, self-contained
build of the same game for the browser - one file, no build step, no dependencies, no
network calls. Bengali splitting, the crossword generator and the levels are ported from this
app's Kotlin, and the port is checked by diffing generated boards against the compiled Kotlin:
every board comes out identical, cell for cell.

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
  data/Levels.kt                the shipping levels, generated by tools/build.py
  data/GameRepository.kt        unlocks and per-level progress
  ui/GameViewModel.kt           game state and rules
  ui/components/LetterWheel.kt  the drag-to-connect wheel
  ui/components/CrosswordGrid.kt
  ui/components/WordPreview.kt  traced word, shakes on a bad guess
  ui/screens/                   HomeScreen (level picker), GameScreen
  ui/theme/                     colours, and the bundled Bengali typography
```

Unit tests are in `app/src/test/java/com/bangla/shobdojot/`.
