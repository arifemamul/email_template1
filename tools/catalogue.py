# -*- coding: utf-8 -*-
"""
The level catalogue: the single source both builds are generated from.

Add or edit levels here, then run `python3 tools/build.py check` and, once it is clean,
`python3 tools/build.py build`. Never hand-edit `Levels.kt` or the `LEVELS` table inside
`docs/index.html` - they are generated, and editing one of them silently desynchronises the
Android and web games.

A level is written as a word list. The wheel is derived from it (the union of the words'
aksharas), which is what guarantees every tile is usable.

Levels are grouped into the five blocks of `curriculum.py`, and that grouping is the primary
ordering: a learner meets plain letters, then one vowel sign at a time, then several signs
together, then conjuncts, then everything mixed. Puzzle difficulty only decides the order
*within* a block. Getting this the other way round - ranking purely by how hard a board is to
solve - is what produced the earlier ordering, which handed out its first vowel sign in level
6 without ever having introduced one, and whose first conjunct was a three-consonant cluster.

Words come from `vocabulary.py`, which is curated for a child. Corpus frequency is still the
floor that rejects invented compounds, but it is no longer the selector: rank by frequency
alone and the game fills with প্রতিষ্ঠান and রাষ্ট্রপতি, which are common in newspapers and
useless to a seven-year-old.
"""
from bangla import (conjunct_tiles, grid_size, layout, split_aksharas, spellable,
                    stray_runs, tiles_for)
from curriculum import (BLOCK_CONJUNCT, BLOCK_FREE, BLOCK_KARS, BLOCK_ONE_KAR, BLOCK_PLAIN,
                        block_for, new_units, teaching_rank, units_in)
from vocabulary import REJECTED, words as pool_words
from wordpool import zipf

# -- the syllabus ------------------------------------------------------------------------
# Each block holds the previous block's material constant and adds one new kind of thing.
# Order inside a block is decided at build time by how much is new, so the order written here
# is only for human readability.

SYLLABUS = {

    # Block 1: letters on their own. No vowel signs, no conjuncts, nothing hanging off
    # anything. Roughly one or two new letters per level, with the earlier ones coming back
    # so they get used rather than met once. These boards stay at three or four words: the
    # thing being learned here is that a tile is a letter and a drag is a word.
    BLOCK_PLAIN: [
        ["জল", "জন", "নল"],
        ["বল", "সব", "বস"],
        ["সব", "রস", "বস"],
        ["কলম", "কম", "কল"],
        ["বদল", "দল", "বল"],
        ["গরম", "কম", "কর", "গম"],
        ["সব", "বই", "বস"],
        ["কলম", "কম", "কল", "আম"],
        ["কলম", "এক", "কম", "কল"],
        ["সব", "বড়", "বস"],
        ["কলম", "কম", "কল", "ফল"],
        ["বদল", "দল", "বল", "দশ"],
        ["মন", "গম", "নগর", "গরম"],

        # The rest of the bare alphabet. These letters are rarer than the ones above, which is
        # why they come last - but a syllabus that stops before them leaves a learner unable
        # to read ওষুধ on a packet or ঋতু in a schoolbook, so they are not optional.
        ["কলম", "অতল", "কম", "কল"],      # অ
        ["অজগর", "নগর", "জন"],           # a python, for a letter that badly needs a picture
        ["বদল", "দল", "বল", "ঈদ"],       # ঈ
        ["ঈগল", "দল", "ঈদ"],
        ["কম", "টক", "উট"],              # উ
        ["ওজন", "জন", "জল", "নল"],       # ও
        ["ধন", "বন", "বল"],              # ধ, so that ঔষধ below has only two new things in it
        ["ঔষধ", "ধন", "নল"],             # ঔ and ষ together - ঔষধ is the only attested
                                         # conjunct-free word that carries ঔ at all
        ["ঋণ", "লবণ", "বল"],             # ঋ and ণ
        ["বড়", "ঝড়", "বন"],            # ঝ
        ["সব", "বস", "যব"],              # য, the bare one rather than the ya-phala
    ],

    # Block 2: one vowel sign per level, in the order of `curriculum.KAR_ORDER`. A level here
    # may reuse plain letters freely but never mixes two signs - the sign is the lesson, and
    # two at once means neither gets learned.
    BLOCK_ONE_KAR: [
        # া, the sign that sits plainly after its letter
        ["কল", "কাল", "কাক"],
        ["লাল", "কল", "কলা"],
        ["কাল", "কান", "নল"],
        ["কমলা", "কম", "কলা"],
        ["লাল", "ফল", "লাফ"],
        ["সকাল", "সব", "বল", "কাল", "বস"],
        ["গান", "কাল", "কান", "নল"],
        ["ভাই", "বই", "ভাত"],
        ["খাতা", "কলা", "খালা"],
        ["নাটক", "আট", "টক"],
        ["থালা", "কমলা", "কম", "কলা"],
        # ি, the first sign written to the left of the letter it belongs to
        ["সবজি", "সব", "বস"],
        ["দিন", "জন", "জল", "নল"],
        ["তিন", "জন", "জল", "নল"],
        ["ঘড়ি", "কর", "ঘর"],
        # ে, also written in front
        ["তেল", "কলম", "কম", "কল"],
        ["আপেল", "আট", "পেট"],
        ["মেঘ", "ঘর", "রস"],
        # ু, written underneath
        ["ঘুম", "কলম", "কম", "কল"],
        ["ফুল", "কলম", "কম", "কল"],
        ["দুই", "বই", "দুধ"],
        ["গরু", "আম", "গম"],
        ["চুল", "বদল", "দল", "বল"],
        # longer words, still one sign: by now া is familiar enough to carry a compound
        ["কলা", "লাগা", "গাছ", "কলাগাছ"],
        ["হাত", "খাত", "পাত", "পাখা", "হাতপাখা"],
        ["জাম", "নাম", "মজা", "নালা", "জানালা"],
        ["বই", "খাই", "খাতা"],
        ["মাছ", "মারা", "রাঙা", "মাছরাঙা"],
        ["পাঠ", "পালা", "পাশা", "পাঠশালা"],
        ["পাড়", "হাড়", "পাহাড়"],
        ["বল", "ফুল", "ফুট", "ফুটবল"],

        # ূ, ৈ, ৃ - the last three signs that a word can carry on its own.
        ["কলম", "কম", "মূল", "কল"],        # ূ
        ["কলম", "কম", "কল", "তৈল"],        # ৈ
        ["কৃষক", "কলম", "কম", "কল"],       # ৃ
        ["ঊষা", "ভাষা", "ভাত"],            # ঊ, which needs a sign to sit beside
        # The nasal marks. They are not vowel signs, but they behave like one - hung on a
        # letter rather than standing beside it - and চাঁদ and বাংলা are too common to leave
        # a learner guessing at.
        ["চাঁদ", "বদল", "দল", "বল"],       # ঁ
        ["কমলা", "বাংলা", "কম", "কলা"],    # ং
        # and the last three letters, which only appear with a sign attached
        ["ডিম", "কম", "কলম"],              # ড
        ["ঢাল", "বল", "বদল", "দল"],        # ঢ
        ["গাঢ়", "গান", "কান"],            # ঢ়
    ],

    # Block 3: several signs in one word, all of them already taught. This is where ordinary
    # Bengali vocabulary opens up, and where compounds start (ফুল + বাগান -> ফুলবাগান).
    BLOCK_KARS: [
        ["কবি", "তাক", "কবিতা"],
        ["মেঘ", "মেলা", "মেঘলা"],
        ["ফুল", "চাল", "চাকু"],
        ["নদী", "পার", "পান", "নদীর"],
        ["মাটি", "পার", "পাটি", "মাটির"],
        ["দিন", "রাত", "দিনরাত"],
        ["দুধ", "ভাত", "দুধভাত"],
        ["হাত", "ঘড়ি", "হাতঘড়ি"],
        ["পড়া", "লেখা", "খাড়া", "পড়ালেখা"],
        ["ঘর", "বাঘ", "ঘড়ি", "বাড়ি", "ঘরবাড়ি"],
        ["ফুল", "গান", "বাগান", "ফুলবাগান"],
        ["তল", "শীত", "কাল", "শীতল", "শীতকাল"],
        ["পর", "বার", "বাপ", "পরি", "পরিবার"],
        ["পাস", "পায়ে", "পায়েস"],
        # ৌ waits until here because every word that carries it carries a second sign too -
        # নৌকা is ৌ and া - so there is no honest way to teach it in the one-sign block.
        ["নৌকা", "কম", "কাক"],
    ],

    # Block 4: joined consonants, one cluster family at a time, in `CONJUNCT_ORDER`. Two
    # consonants before three, and clusters whose parts stay legible (ন্ত, স্ত) before the
    # ligatures that fuse into a shape of their own (ক্ষ, ষ্ট).
    BLOCK_CONJUNCT: [
        ["সব", "বস", "বসন্ত"],              # ন্ত
        ["আগুন", "আনন্দ", "আম"],             # ন্দ
        ["রাস্তা", "ঘাট", "রাস্তাঘাট"],      # স্ত
        ["কলম", "কম", "স্কুল", "কল"],        # স্ক
        ["গরম", "গল্প", "গম"],               # ল্প
        ["কলা", "শিলা", "শিল্প", "শিল্পকলা"],
        ["দিনরাত", "দিন", "রাত", "রান্না"],  # ন্ন
        ["রস", "সর", "রসগোল্লা"],            # ল্ল
        ["বন", "ধন", "বন্ধু"],               # ন্ধ
        ["বালিশ", "শক্ত", "বালি"],           # ক্ত
        ["আপেল", "পেন্সিল", "আট", "পেট"],    # ন্স
        ["বদল", "দল", "বল", "স্বাদ"],        # স্ব
        ["বর্ষাকাল", "বল", "কাল", "বর্ষা"],  # র্ষ
        ["চিঠিপত্র", "ছাত্র", "চিঠি"],       # ত্র
        ["কর", "কক্ষ", "শিক্ষক"],            # ক্ষ
        ["সমুদ্র", "সব", "বস"],              # দ্র
        ["কমলা", "কম", "গ্রাম", "কলা"],      # গ্র
        ["বিল", "লয়", "বিদ্যা", "বিদ্যালয়"],  # দ্য
        ["জন", "দিন", "জন্ম", "জন্মদিন"],    # ন্ম
        # ঐ lands in the conjunct block for the same reason ৌ landed in the last one: every
        # attested word carrying it also carries a cluster. ঐক্য is abstract for a child, and
        # it is still the best of a very short list.
        ["ঐক্য", "বাক্য", "বাটি"],           # ঐ, with ক্য
    ],

    # Block 5: everything taught, mixed, on the fullest boards the phone can hold.
    BLOCK_FREE: [
        ["কলম", "কমলা", "গ্রাম", "লাল"],
        ["সকাল", "সব", "বল", "কাল"],
        ["বাতি", "তিল", "বালতি"],
        ["চার", "কার", "রবি", "চাবি", "চাকা", "বিচার"],
        ["ভালো", "বাসা", "ভাসা", "ভাবা", "ভালোবাসা"],
        ["হাসপাতাল", "পাটি", "পাতাল", "হাতা", "তাল", "পাস"],
    ],
}

# Every level as (declared block, words). The declared block is checked against what the
# words actually contain, so a level cannot drift out of its block unnoticed.
DECLARED = [(block, words) for block in sorted(SYLLABUS) for words in SYLLABUS[block]]

CATALOGUE = [words for _, words in DECLARED]

# Three extra words fill the chest; a full chest pays out and starts again. The chest is
# shared across levels rather than reset each time - with three- and four-tile boards there
# are not always extras to find, so a per-level chest would sit empty and teach the player to
# ignore it.
CHEST_TARGET = 3
CHEST_REWARD = 15

MIN_ZIPF = 2.0          # below this, treat a "word" as invented rather than Bengali
MAX_ROWS, MAX_COLS = 8, 9

# How many pieces of the writing system one level may introduce. Two is a lesson; five is a
# lecture. Levels that exceed it are reported by `check` rather than rejected, because the
# ordering is greedy and can be forced into a jump when a block runs short of gentle options.
MAX_NEW_UNITS = {
    BLOCK_PLAIN: 2, BLOCK_ONE_KAR: 2, BLOCK_KARS: 3, BLOCK_CONJUNCT: 3, BLOCK_FREE: 3,
}

# How many words a board should hold, by block. Word count is the main difficulty dial, so it
# climbs with the syllabus rather than with raw level number - a learner meeting their first
# vowel sign does not also need a seven-word board.
BOARD_TARGET = {
    BLOCK_PLAIN: 3, BLOCK_ONE_KAR: 4, BLOCK_KARS: 5, BLOCK_CONJUNCT: 6, BLOCK_FREE: 7,
}


def difficulty(tiles, words):
    """
    What makes a level hard to solve, weighted. Word count carries the most weight per unit:
    having to find six words from one wheel is what actually makes a board take a while, more
    than any single word being long. Then tiles to scan, the longest word, conjunct tiles, and
    rarity. This orders levels *within* a block; the block itself comes first.
    """
    longest = max(len(split_aksharas(w)) for w in words)
    rarity = sum(max(0.0, 5.5 - zipf(w)) for w in words) / len(words)
    return (2.2 * len(tiles) + 3.4 * len(words) + 2.0 * longest
            + 3.0 * len(conjunct_tiles(tiles)) + 1.6 * rarity)


def validate(words, block=None):
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
        if w in REJECTED:
            problems.append(f'{w} is on the rejection list: {REJECTED[w]}')

    # A level written into one block must not contain something from a later one, or the
    # syllabus is a fiction: this is what stops a stray conjunct landing in the vowel-sign
    # block, where nothing has taught it yet.
    actual = block_for(words)
    if block == BLOCK_FREE:
        # Free play is a placement, not a property of the words: anything already taught may
        # appear, so the only thing to check is that nothing *untaught* has crept in.
        if actual > BLOCK_CONJUNCT:
            problems.append(f'free play cannot introduce block {actual} material')
    elif block is not None and actual != block:
        problems.append(f'declared block {block} but its words need block {actual}')

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
        'block': block if block is not None else actual,
        'teaches': [],         # filled in by ordered_levels, which knows what came before
        'extras': [],          # likewise: extras depend on what has been taught
    }
    return level, problems


def extras_reserve(available):
    """
    How many of a tile set's words to hold back for the chest rather than put on the board.
    The board is the difficulty dial and the chest is the reward, so both need feeding: a
    board that swallowed every word would leave the chest permanently empty.
    """
    if available >= 6:
        return 3
    if available >= 4:
        return 2
    if available >= 2:
        return 1
    return 0


def grow_board(words, candidates, target):
    """
    Adds words to a board until it holds `target` of them, keeping only additions the
    crossword can still take. Common words first, so a bigger board stays fair; the rarest
    are reserved for the chest, where knowing an uncommon word is worth coins.
    """
    reserve = extras_reserve(len(candidates))
    candidates = candidates[:max(0, len(candidates) - reserve)]

    grown = list(words)
    for candidate in candidates:
        if len(grown) >= target:
            break
        if candidate in grown:
            continue
        trial = grown + [candidate]
        placed = layout(trial)
        if not placed:
            continue
        rows, cols = grid_size(placed[0])
        if rows > MAX_ROWS or cols > MAX_COLS:
            continue
        if stray_runs(placed[0], trial):
            continue
        grown = trial
    return grown


def teachable(vocabulary, tiles, words, known):
    """
    Words those tiles can spell that a learner is equipped to read - every piece of the
    writing system in them has already been taught. A bonus word built on an untaught
    conjunct is worse than no bonus word: it is a puzzle the player cannot see the answer to
    even when staring at it.
    """
    found = [w for w in vocabulary
             if w not in words and spellable(w, tiles) and set(units_in([w])) <= known]
    found.sort(key=lambda w: (-zipf(w), w))
    return found


def order_block(group, known):
    """
    Order one block gently: at each step take the level that introduces the least new
    material, breaking ties by where its newest piece sits in the syllabus and then by how
    hard the board is. Greedy rather than sorted, because "how much is new" depends on what
    has already been placed - a level that looks like a big jump from the start of a block can
    be an easy step once its neighbours have been taken. `known` carries in what earlier
    blocks already taught.
    """
    remaining, ordered = list(group), []
    while remaining:
        def cost(level):
            fresh = new_units(level['words'], known)
            hardest = max((teaching_rank(u) for u in fresh), default=(0, 0))
            return (len(fresh), hardest, level['score'])

        pick = min(remaining, key=cost)
        pick['teaches'] = new_units(pick['words'], known)
        known |= set(units_in(pick['words']))
        ordered.append(pick)
        remaining.remove(pick)
    return ordered, known


def ordered_levels():
    """
    Every valid level in teaching order. Returns (levels, failures) so callers can report
    problems rather than silently shipping fewer levels than the catalogue lists.
    """
    levels, failures = [], []
    for block, words in DECLARED:
        level, problems = validate(words, block)
        if problems:
            failures.append((words, problems))
            continue
        levels.append(level)

    # Board words are verified vocabulary too, so they can serve as bonus words elsewhere.
    vocabulary = list(dict.fromkeys(pool_words() + [w for l in levels for w in l['words']]))

    # Blocks in order; inside each, the gentlest step first.
    known, out = set(), []
    for block in sorted({l['block'] for l in levels}):
        group = [l for l in levels if l['block'] == block]
        group.sort(key=lambda l: l['score'])
        ordered, known = order_block(group, known)
        out += ordered
    levels = out

    # Grow each board towards its block's word count, using only words the learner has been
    # taught to read by the time they arrive - so a bigger board never smuggles in a letter
    # the syllabus has not reached.
    taught = set()
    for level in levels:
        taught |= set(units_in(level['words']))
        candidates = [w for w in vocabulary
                      if w not in level['words'] and spellable(w, level['tiles'])
                      and set(units_in([w])) <= taught
                      and block_for(level['words'] + [w]) == level['block']]
        candidates.sort(key=lambda w: -zipf(w))
        grown = grow_board(level['words'], candidates, BOARD_TARGET[level['block']])
        if grown != level['words']:
            placed = layout(grown)
            level['words'] = grown
            level['occupied'] = placed[0]
            level['size'] = grid_size(placed[0])
        level['score'] = difficulty(level['tiles'], level['words'])
        level['extras'] = teachable(vocabulary, level['tiles'], level['words'], taught)

    return levels, failures
