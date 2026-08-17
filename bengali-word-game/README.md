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

- **31 levels**, from three-tile consonant puzzles up to five-tile compound words
  (ফুল + বাগান → ফুলবাগান), including conjunct levels (বন্ধু, রাস্তা).
- **Drag to spell.** Sliding back onto the previous tile un-picks it.
- **Coins** for each word found (5 per akshara) and a 30-coin bonus for finishing a level.
- **Hints** cost 25 coins and reveal one letter from a word you have not solved.
- **Shuffle** rearranges the wheel and is free.
- Levels unlock in order; a half-solved board is saved, so you can leave and come back.

## Building

Requires the Android SDK (API 35 platform + build tools) and JDK 17.

```bash
cd bengali-word-game
./gradlew assembleDebug          # APK at app/build/outputs/apk/debug/
./gradlew installDebug           # to a connected device or emulator
./gradlew test                   # unit tests: text splitting, layout, level content
```

Bengali text is rendered with the system font (Noto Sans Bengali ships with Android). No
font is bundled; if you target devices with an incomplete font set, drop a Bengali TTF into
`app/src/main/res/font/` and set it as the default `FontFamily` in `ui/theme/Theme.kt`.

## How the board gets built

Levels store a word list, not a grid. `CrosswordGenerator` lays the words out at runtime:
one word is seeded across the middle, and every other word must cross an existing akshara
without ever running flush alongside another word (which would spell something unintended).

Greedy placement is not enough — an early choice can strand a later word — so the generator
backtracks over both word order and placement, and is fully deterministic. That determinism
is load-bearing: hint positions are saved as grid coordinates, and they have to still point
at the same cells after the app is killed and reopened.

Some word sets simply cannot be laid out. `বন / ধন / বধ` is a triangle — every word crosses
every other — and no grid arrangement exists. The generator degrades gracefully by parking
leftovers on their own row, but `LevelsTest` fails the build instead, because a floating word
is a content bug, not something to ship.

## Adding levels

Add an entry to `data/Levels.kt`:

```kotlin
Level(32, listOf("ক", "লা", "গা", "ছ"), listOf("কলা", "গাছ", "কলাগাছ"))
```

Then run `./gradlew test`. `LevelsTest` checks the whole catalogue: every word spellable
from its tiles using each tile at most once, no tile left unusable, at least three words per
level, a connected layout, no accidental words on the board, and a grid that fits a phone
screen.

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
