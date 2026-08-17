# -*- coding: utf-8 -*-
"""
The level catalogue: the single source both builds are generated from.

Add or edit levels here, then run `python3 tools/build.py check` and, once it is clean,
`python3 tools/build.py build`. Never hand-edit `Levels.kt` or the `LEVELS` table inside
`docs/index.html` — they are generated, and editing one of them silently desynchronises the
Android and web games.

A level is written as a word list. The wheel is derived from it (the union of the words'
aksharas), which is what guarantees every tile is usable.
"""
from bangla import (conjunct_tiles, grid_size, layout, split_aksharas, spellable,
                    stray_runs, tiles_for)
from wordpool import zipf

# Ordered by difficulty at build time, so the order here is only for human readability.
CATALOGUE = [
    # ── short words, plain consonants and simple vowel signs ────────────────────────────
    ["কম", "কল", "কমল", "কলম"],
    ["বন", "ধন", "বধ"],
    ["পথ", "পর", "রথ"],
    ["জল", "জন", "মন", "নল"],
    ["নাম", "দাম", "দানা"],
    ["গান", "গাছ", "মান", "মাছ"],
    ["রাত", "নাম", "রাম"],
    ["মন", "তান", "তারা"],
    ["সার", "নগর", "সাগর"],
    ["নাক", "টক", "নাটক"],
    ["কবি", "তাক", "কবিতা"],
    ["মেঘ", "মেলা", "মেঘলা"],
    ["পাড়", "হাড়", "পাহাড়"],
    ["সব", "বস", "বসন্ত"],
    ["রস", "সর", "রসগোল্লা"],
    ["পাস", "পায়ে", "পায়েস"],

    # ── four tiles, four to six words ───────────────────────────────────────────────────
    ["কল", "কলা", "কলম", "কমল", "লাল", "কমলা"],
    ["চার", "কার", "রবি", "চাবি", "চাকা", "বিচার"],
    ["ফুল", "চাল", "চাকু"],
    ["বাস", "তার", "বার", "রস", "তাস", "বাতাস"],
    ["আম", "রাত", "আমরা", "আরাম"],
    ["নদী", "পার", "পান", "নদীর"],
    ["মাটি", "পার", "পাটি", "মাটির"],
    ["কাচ", "চাকা", "চামচ"],
    ["জাম", "নাম", "মজা", "নালা", "জানালা"],
    ["দেশ", "বিশ", "বিদেশ", "বিকাশ"],
    ["বই", "খাই", "খাতা"],
    ["দিন", "রাত", "দিনরাত"],
    ["দুধ", "ভাত", "দুধভাত"],
    ["হাত", "খাত", "পাত", "পাখা", "হাতপাখা"],
    ["হাত", "ঘড়ি", "হাতঘড়ি"],
    ["কলা", "লাগা", "গাছ", "কলাগাছ"],
    ["পড়া", "লেখা", "খাড়া", "পড়ালেখা"],
    ["ঘর", "বাঘ", "ঘড়ি", "বাড়ি", "ঘরবাড়ি"],
    ["বন", "ধন", "বন্ধু"],
    ["রাস্তা", "ঘাট", "রাস্তাঘাট"],
    ["ফুল", "গান", "বাগান", "ফুলবাগান"],

    # ── conjunct tiles and four-akshara spines ──────────────────────────────────────────
    ["বাতি", "তিল", "বালতি", "বাতিল"],
    ["বল", "ফুল", "ফুট", "ফুটবল"],
    ["জন", "দিন", "জন্ম", "জন্মদিন"],
    ["কলা", "শিলা", "শিল্প", "শিল্পকলা"],
    ["পাঠ", "পালা", "পাশা", "পাঠশালা"],
    ["চিঠি", "পত্র", "চিত্র", "চিঠিপত্র"],
    ["বেশ", "পরি", "পরিবেশ"],
    ["পর", "বার", "বাপ", "পরি", "পরিবার"],
    ["তল", "শীত", "কাল", "শীতল", "শীতকাল"],
    ["বল", "বকা", "কাল", "বর্ষা", "বর্ষাকাল"],
    ["মাছ", "মারা", "রাঙা", "মাছরাঙা"],
    ["কর", "কক্ষ", "শিক্ষক"],
    ["বিল", "লয়", "বিদ্যা", "বিদ্যালয়"],
    ["ভালো", "বাসা", "ভাসা", "ভাবা", "ভালোবাসা"],
    ["বাংলা", "দেশ", "বাংলাদেশ"],
    ["বাংলা", "ভাষা", "বাংলাভাষা"],
    ["কল", "কাক", "তাল", "লতা", "কাল", "কলকাতা"],
    ["প্রতি", "জাতি", "প্রজা", "প্রজাতি", "প্রজাপতি"],

    # ── long spines, stacked conjuncts, five and six tiles ──────────────────────────────
    ["তান", "স্বাধীন", "স্বাধীনতা"],
    ["প্রতি", "তিন", "প্রতিষ্ঠা", "প্রতিষ্ঠান"],
    ["পরা", "রাষ্ট্র", "রাষ্ট্রপতি"],
    ["জাত", "প্রজা", "তন্ত্র", "প্রজাতন্ত্র"],
    ["মুক্তি", "যুদ্ধ", "যুক্তি", "মুক্তিযুদ্ধ"],
    ["বাদ", "পদ", "পত্র", "সংবাদ", "সংবাদপত্র"],
    ["বীর", "রথ", "নাথ", "রবীন্দ্র", "রবীন্দ্রনাথ"],
    ["পাতা", "তাল", "হাল", "পাস", "পাতাল", "হাসপাতাল"],
    ["গ্রহ", "গ্রহণ", "চন্দ্র", "চন্দ্রগ্রহণ"],
    ["গ্রহ", "গ্রহণ", "সূর্য", "সূর্যগ্রহণ"],
    ["বন", "মান", "মানব", "বিমান", "বন্দর", "বিমানবন্দর"],

    # ── five tiles with room to spare: these are where the extra-words chest fills ───────
    ["সব", "কম", "রকম", "সবরকম"],
    ["কলা", "কমলা", "কলার", "কমলাপুর"],
    ["মাস", "মান", "মানা", "সমান", "মানানসই"],
    ["মন", "গম", "নগর", "গরম", "মহান", "মহানগর"],
]

# ── extra words ─────────────────────────────────────────────────────────────────────────
# Words the tiles can spell that are NOT on the board. Finding one fills the chest, which
# pays coins — the mechanic that makes a letter wheel feel generous instead of restrictive.
#
# Every level's own words are automatically available as extras to other levels, since they
# are already hand-verified. This list adds the rest, hand-picked from corpus candidates.
# Deliberately rejected while curating: proper names (রবিন, তালহা, রামা), transliterations
# (শপ, চিপ, লস, বট), grammatical fragments (টির, লাম, নত, রন, গন, ইন, নই), a corpus
# misspelling (বিবরন for বিবরণ), and crude words (বাল, লাশ, শালা, মল, মদ).
EXTRA_VOCABULARY = """
তাই মত সবার জানা বার মার পাল বাপ নব বর তাক রক্ষক লতা বাড়ির ঘড়ির চাকার দীন কুল খাব তাস
গাল নল সর হাতা মাপা লেখাপড়া সন্ত নর রশি ছক রব বান কাত মাল আল পাকা টাকা কাঠ নাতি রাজা কাজ
জমা তামা নামা মামা চাচা কাকা দাদা নানা মাসি বোন ভাই বাবা হার মহা গমন মগ কর করব রস বস বর
সরব কসম সম রকম কলাম পুর নামা সই মানস কবর কলার গরম গম নগর নরম মন
""".split()

# Three extra words fill the chest; a full chest pays out and starts again. The chest is
# shared across levels rather than reset each time — with three- and four-tile boards there
# are not always extras to find, so a per-level chest would sit empty and teach the player to
# ignore it.
CHEST_TARGET = 3
CHEST_REWARD = 15
MAX_EXTRAS_PER_LEVEL = 10

# The opening levels are pinned rather than scored: plain consonants carry their own vowel,
# so they teach what an akshara is before vowel signs and conjuncts arrive.
OPENERS = [
    ["কম", "কল", "কমল", "কলম"],
    ["বন", "ধন", "বধ"],
    ["পথ", "পর", "রথ"],
]

MIN_ZIPF = 2.0          # below this, treat a "word" as invented rather than Bengali
MAX_ROWS, MAX_COLS = 8, 9


def difficulty(tiles, words):
    """
    What makes a level hard, weighted: how many tiles to scan, how many words to find, how
    long the longest one is, whether any tile is a conjunct, and how rare the words are.
    """
    longest = max(len(split_aksharas(w)) for w in words)
    rarity = sum(max(0.0, 5.5 - zipf(w)) for w in words) / len(words)
    return (2.4 * len(tiles) + 1.4 * len(words) + 2.2 * longest
            + 3.0 * len(conjunct_tiles(tiles)) + 1.6 * rarity)


def validate(words):
    """Everything that has to be true before a level can ship. Returns (level, problems)."""
    problems = []
    tiles = tiles_for(words)

    if len(words) != len(set(words)):
        problems.append('repeats a word')
    if len(words) < 3:
        problems.append(f'only {len(words)} words; a level needs at least 3')

    for w in words:
        aksharas = split_aksharas(w)
        z = zipf(w)
        if z < MIN_ZIPF:
            problems.append(f'{w} is unattested in Bengali text (zipf {z:.2f})')
        if len(aksharas) < 2:
            problems.append(f'{w} is a single akshara')
        if len(set(aksharas)) != len(aksharas):
            problems.append(f'{w} repeats an akshara {aksharas}, so tiles cannot spell it')
        if not spellable(w, tiles):
            problems.append(f'{w} is not spellable from {" ".join(tiles)}')

    placed = layout(words)
    if not placed:
        problems.append('no connected crossword exists for these words')
        return None, problems

    occupied, words_placed = placed
    rows, cols = grid_size(occupied)
    if rows > MAX_ROWS or cols > MAX_COLS:
        problems.append(f'board is {rows}x{cols}, too big for a phone screen')
    for word, cells in words_placed:
        if ''.join(occupied[c] for c in cells) != word:
            problems.append(f'{word} does not read back off the board')
    stray = stray_runs(occupied, words)
    if stray:
        problems.append('board spells words the player cannot solve: ' + ' '.join(stray))

    level = {
        'tiles': tiles,
        'words': words,
        'occupied': occupied,
        'size': (rows, cols),
        'score': difficulty(tiles, words),
        'extras': [],          # filled in by ordered_levels, which sees the whole catalogue
    }
    return level, problems


def extras_for(tiles, words, vocabulary):
    """
    Attested words those tiles can spell that are not on this board, most common first so
    the ones a player is likeliest to try are the ones that count.
    """
    found = [w for w in vocabulary if w not in words and spellable(w, tiles)]
    found.sort(key=lambda w: (-zipf(w), w))
    return found[:MAX_EXTRAS_PER_LEVEL]


def ordered_levels():
    """
    Every valid level, easiest first. Returns (levels, failures) so callers can report
    problems rather than silently shipping fewer levels than the catalogue lists.
    """
    levels, failures = [], []
    for words in CATALOGUE:
        level, problems = validate(words)
        if problems:
            failures.append((words, problems))
            continue
        levels.append(level)

    # Every level's words are verified vocabulary, so they double as extras elsewhere.
    vocabulary = sorted({w for level in levels for w in level['words']} | set(EXTRA_VOCABULARY))
    for level in levels:
        level['extras'] = extras_for(level['tiles'], level['words'], vocabulary)

    levels.sort(key=lambda l: l['score'])
    pinned = [l for opener in OPENERS for l in levels if l['words'] == opener]
    rest = [l for l in levels if l not in pinned]
    return pinned + rest, failures
