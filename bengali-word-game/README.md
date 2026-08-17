# শব্দজট — Shobdojot

A Bengali word-cross puzzle game for Android. Letters sit on a wheel; drag across them to
spell a word, and every word you find fills itself into the crossword above.

Native Android, Kotlin + Jetpack Compose, no third-party game engine, no network access,
no ads, no analytics. Progress lives in SharedPreferences on the device.

## What makes it Bengali rather than a translated English game

Bengali is not one-letter-per-character. The word **মাছ** is stored as three code points
but a reader sees two letter units — **মা** and **ছ**. Those units (aksharas) are what the
game is built on: one akshara per wheel tile, one per grid cell.

`BanglaText.splitAksharas` does the splitting, handling the three cases that matter:

| Case | Word | Aksharas |
|---|---|---|
| Plain consonants | কমল | ক · ম · ল |
| Vowel signs stay attached | বিদেশ | বি · দে · শ |
| Hasanta binds a conjunct | বন্ধু | ব · ন্ধু |

Get this wrong and the game is unplayable — the player would be asked to drag "ম", "া", "ছ"
as three separate tiles, which is not how anyone reads or writes Bengali.

## Gameplay

- **70 levels, ordered by difficulty**: three-tile consonant puzzles to open, then vowel
  signs, compound words (ফুল + বাগান → ফুলবাগান), conjunct tiles (বন্ধু, রাস্তা, মুক্তিযুদ্ধ),
  and finally six-tile boards with five- and six-akshara spines (বিমানবন্দর, চন্দ্রগ্রহণ).
  227 distinct words across the catalogue, up to six words per board.
- **Extra words.** Some words the tiles can spell are not on the board. Spell one anyway and
  it goes into the chest; three fills it and pays 15 coins. The chest is shared across levels
  rather than reset with each one — three- and four-tile boards do not always have extras, and
  a chest that sits empty teaches the player to ignore it.
- **Drag to spell.** Sliding back onto the previous tile un-picks it.
- **Coins** for each word found (5 per akshara) and a 30-coin bonus for finishing a level.
- **Hints** cost 25 coins and reveal one letter from a word you have not solved.
- **Shuffle** rearranges the wheel and is free.
- Levels unlock in order; a half-solved board is saved, so you can leave and come back.

## Play it on the web

`docs/index.html` (repo root, one level up from this folder) is a complete, self-contained
build of the same game for the browser — one file, no build step, no dependencies, no
network calls. Bengali splitting, the crossword generator and all 31 levels are ported from
this app's Kotlin, and the port is checked by diffing generated boards against the compiled
Kotlin: all 70 come out identical, cell for cell.

Launch it any of these ways:

- **GitHub Pages** — Settings → Pages → Source: *Deploy from a branch*, branch `main`,
  folder `/docs`. The game is then live at `https://<user>.github.io/<repo>/`.
- **Any static host** — drag `docs/index.html` onto Netlify, Cloudflare Pages, Vercel, or an
  S3 bucket. Rename it `index.html` at the root of whatever you upload.
- **No host at all** — open the file directly, or email it. It runs from `file://`.

Progress is kept in the browser's own storage, so a player keeps their coins and solved
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
into an empty box — the one failure this game cannot survive. Bundling also makes the app
and the web build render identical letterforms.

Licence: SIL Open Font License 1.1 — `app/src/main/assets/fonts/OFL.txt`, which ships inside
the APK so the licence travels with the font.

## How the board gets built

Levels store a word list, not a grid. `CrosswordGenerator` lays the words out at runtime:
one word is seeded across the middle, and every other word must cross an existing akshara
without ever running flush alongside another word (which would spell something unintended).

Greedy placement is not enough — an early choice can strand a later word — so the generator
backtracks over both word order and placement, and is fully deterministic. That determinism
is load-bearing: hint positions are saved as grid coordinates, and they have to still point
at the same cells after the app is killed and reopened.

Some word sets simply cannot be laid out. Only two words can pass through one cell — one
across, one down — so three words that share nothing but the same akshara cannot all be
placed. `চার / কার / চাবি / চাকা` fails that way, because চার, চাবি and চাকা meet only at চা.
The generator degrades gracefully by parking leftovers on their own row, but `LevelsTest`
fails the build instead, because a floating word is a content bug, not something to ship.

Adding a word can *fix* such a level rather than break it: this one becomes placeable — and
better — once বিচার and রবি join it, because they give the stranded words somewhere else to
cross. It ships as a six-word level.

## Adding levels

Add an entry to `data/Levels.kt`:

```kotlin
Level(32, listOf("ক", "লা", "গা", "ছ"), listOf("কলা", "গাছ", "কলাগাছ"))
```

Then run `./gradlew test`. `LevelsTest` checks the whole catalogue: every word spellable from
its tiles using each tile at most once, no tile left unusable, at least three words per level,
a connected layout, no accidental words on the board, a grid that fits a phone screen, a gentle
first eight levels, and a tile count that ramps rather than jumping about.

Words should also be real. Every word shipped here was checked against Bengali corpus
frequency data before being hand-picked; that check caught two compounds in an earlier draft
(বইখাতা, শিশুপাঠ) that read plausibly but do not occur in Bengali text. A frequency list on its
own is not enough either — its most common four-letter entries are verb inflections like
করেছেন, which make dull puzzles.

## Layout

```
app/src/main/java/com/bangla/shobdojot/
├── logic/BanglaText.kt           akshara splitting, spellability, Bengali digits
├── logic/CrosswordGenerator.kt   backtracking crossword layout
├── model/Models.kt               Level, Puzzle, PlacedWord, GridPos
├── data/Levels.kt                the 31 levels
├── data/GameRepository.kt        coins, unlocks, per-level progress
├── ui/GameViewModel.kt           game state and rules
├── ui/components/LetterWheel.kt  the drag-to-connect wheel
├── ui/components/CrosswordGrid.kt
├── ui/components/WordPreview.kt  traced word, shakes on a bad guess
└── ui/screens/                   HomeScreen (level picker), GameScreen
```

Unit tests are in `app/src/test/java/com/bangla/shobdojot/`.
