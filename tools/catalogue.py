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

Only the first block is written here at the moment. The other four were removed while the way
a level works is reworked, so the machinery below - blocks, budgets, board targets, the
coverage report - is sized for a syllabus that is coming back rather than for the ten levels
that are here now.

Words come from `vocabulary.py`, which is curated for a child. Corpus frequency is still the
floor that rejects invented compounds, but it is no longer the selector: rank by frequency
alone and the game fills with প্রতিষ্ঠান and রাষ্ট্রপতি, which are common in newspapers and
useless to a seven-year-old.

No word is set as a puzzle twice. An earlier catalogue leaned on a handful of easy words -
কলম, বল, কল, সব - and reused them across a dozen tile sets, so a learner spent a good part of
the game re-spelling words they already knew. Four levels here have to borrow anyway - see
`SHARED` - because a learner who knows three letters has exactly one board available to them.
"""
from bangla import (conjunct_tiles, grid_size, layout, split_aksharas, spellable,
                    stray_runs, tiles_for)
from curriculum import (BLOCK_CONJUNCT, BLOCK_FREE, BLOCK_KARS, BLOCK_ONE_KAR, BLOCK_PLAIN,
                        BLOCKS,
                        block_for, new_units, teaching_rank, units_in)
from vocabulary import REJECTED, words as pool_words
from wordpool import zipf

# -- the syllabus ------------------------------------------------------------------------
# Each block holds the previous block's material constant and adds one new kind of thing.
# Order inside a block is decided at build time by how much is new, so the order written here
# is only for human readability.

# The levels, in the order they are played. An alphabet game: each level is named after a
# letter, and the words on its board are the words that start with that letter.
#
# Written as a list rather than grouped by block, because here the order is the alphabet and
# nothing else. Each entry declares its letter and the block its words belong to, both of which
# are checked against what the words actually contain - but the block no longer decides where a
# level sits. See `ordered_levels`.
#
# The alphabet opens with eleven vowels, and a vowel level cannot be built one letter at a
# time: ঊ, এ and ঐ have a single word each in the whole pool. So the vowels that begin words
# are paired up into the first three levels and the consonants follow one at a time. ঙ, ঞ and ণ
# never begin a Bengali word and are skipped when their turn comes.
#
# Not every word on a board starts with the level's letter. Some are there to hold the
# crossword together: এক and ওজন share no letter at all, so without কঠিন and জন between them
# there is no board that holds both.
#
# A level cannot take those bridging words from a letter whose own level is still to come. ঢ
# would happily borrow থাকা and থালা, and then থ - which has two words in the pool to start
# with - would have none left.

SYLLABUS = [
    # -- the vowels that start words, two to a level ------------------------------------
    ("অআ", BLOCK_ONE_KAR,  ["আজ", "আনারস", "অজগর", "আনা", "রস"]),
    ("ইউ", BLOCK_CONJUNCT, ["উট", "ইঁদুর", "উত্তর", "দুই"]),
    ("এও", BLOCK_KARS,     ["এক", "ওজন", "কঠিন", "জন", "ওঠা"]),

    # -- then the consonants, one at a time, in alphabet order ---------------------------
    ("ক",  BLOCK_KARS,     ["কলম", "কবুতর", "কমলা", "কমল", "কম", "কর", "কল", "কলা"]),
    ("খ",  BLOCK_KARS,     ["খালা", "খাবার", "খেলা", "খবর", "বলা"]),
    ("গ",  BLOCK_ONE_KAR,  ["গরম", "গাছ", "গাজর", "গম", "নগর", "গান"]),
    ("ঘ",  BLOCK_CONJUNCT, ["ঘরবাড়ি", "ঘর", "ঘণ্টা", "ঘড়ি", "ঘট", "বাঘ", "ঘাট", "বাড়ি"]),
    # ঙ begins no word
    ("চ",  BLOCK_KARS,     ["চুল", "চালক", "চামচ", "চক", "কচু", "চমক"]),
    ("ছ",  BLOCK_ONE_KAR,  ["ছাতা", "ছাগল", "ঈগল", "ঈদ", "ছাদ", "লতা", "ছায়া"]),
    ("জ",  BLOCK_KARS,     ["জাহাজ", "জামা", "জগত", "হাত", "হাতি"]),
    ("ঝ",  BLOCK_KARS,     ["ঝড়", "ঝলক", "ঝাল", "কবিতা", "বিল"]),
    # ঞ begins no word
    ("ট",  BLOCK_KARS,     ["টিকিট", "টমেটো", "টিয়া", "মেয়ে"]),
    ("ঠ",  BLOCK_KARS,     ["ঠিকানা", "ঠিক", "বৈঠক", "শোনা"]),
    ("ড",  BLOCK_KARS,     ["ডিম", "ডালিম", "ডাল", "বিড়াল"]),
    ("ঢ",  BLOCK_KARS,     ["ঢোল", "ঢাল", "ঢোকা", "ঢালা", "বাংলা"]),
    # ণ begins no word
    ("ত",  BLOCK_KARS,     ["তৈরি", "তরকারি", "তরল", "তেল", "কাল"]),
    ("থ",  BLOCK_ONE_KAR,  ["থাকা", "থালা", "পাঠশালা", "মাঠ"]),
    ("দ",  BLOCK_KARS,     ["দিনরাত", "দুধভাত", "দিন", "দুধ", "রাত", "ভাত"]),
    ("ধ",  BLOCK_KARS,     ["ধরা", "ধনী", "পায়রা", "ধোপা"]),
    ("ন",  BLOCK_CONJUNCT, ["নয়", "নম্বর", "নজর", "নকল", "নল", "কম্বল", "জল"]),

    # -- প onwards ----------------------------------------------------------------------
    ("প",  BLOCK_CONJUNCT, ["পেন্সিল", "পলক", "পটল", "পেট", "টক"]),
    ("ফ",  BLOCK_KARS,     ["ফড়িং", "ফসল", "ফলক", "ফল", "ফুল", "সফল", "কফি"]),
    ("ব",  BLOCK_CONJUNCT, ["বন", "বর্ষাকাল", "বিমান", "বিকাল", "বল", "বর্ষা", "কান"]),
    ("ভ",  BLOCK_KARS,     ["ভাই", "ভাষা", "কড়াই", "ভালুক", "ভাঙা"]),
    ("ম",  BLOCK_KARS,     ["মধু", "মৌসুম", "মৌমাছি", "মাছি", "মাসি"]),
    ("য",  BLOCK_CONJUNCT, ["যন্ত্র", "যত", "গণিত", "বগল", "যব"]),
    ("র",  BLOCK_CONJUNCT, ["রঙ", "রান্নাঘর", "রাবার", "রান্না", "রথ"]),
    ("ল",  BLOCK_KARS,     ["লাঠি", "লাল", "বদল", "দল", "লবণ", "নদ"]),
    ("শ",  BLOCK_KARS,     ["শিয়াল", "শীতকাল", "শীতল", "শিশু", "শীত"]),
    # ষ and স share a level for the same reason the vowels do: ষাঁড় and ষোল are the only two
    # words in the pool that begin with ষ, and they share no letter with each other or with
    # ষষ্ঠ, so no board can be built from them alone. Word-initial ষ is rare in Bengali - it
    # lives inside words, in clusters like ষ্ট and ষ্ঠ.
    ("ষস", BLOCK_KARS,     ["ষাঁড়", "ষোল", "সকল", "সড়ক", "কলস", "সকাল"]),
    # হ, the last letter, and the smallest board in the game. Four is the ceiling: every pair of
    # হ words in the pool was tried as an anchor and nothing bigger will lay out. The হ words
    # fall into four groups by their first akshara - হ, হা, হাঁ, হৃ - and only two words from any
    # one group can cross at the akshara they share.
    ("হ",  BLOCK_KARS,     ["হাসি", "হাতঘড়ি", "হাঁড়ি", "হাঁস"]),
    # ড়, ঢ় and য় begin no Bengali word, so there is nothing after this.
]

# Every level as (letters, declared block, words). Both declarations are checked against what
# the words actually contain: the block, so a level cannot drift out of it unnoticed, and the
# letters, so a level named after ছ cannot quietly become a level about something else.
DECLARED = list(SYLLABUS)

CATALOGUE = [words for _, _, words in DECLARED]

# Every word the catalogue was authored around. Boards grow into the pool, and this is what
# growth may not touch: a word swallowed by an early level is a word missing from the later
# level that was built on it, and since no word is set twice, that level would have nothing
# left to make a board from.
AUTHORED = {w for _, _, words in DECLARED for w in words}

# Words a board is allowed to reuse from an earlier board, with the reason. Empty, and worth
# keeping empty: fifty-nine board words out of a five-hundred-word pool leaves no level short
# of options. It was not empty when the catalogue was a hundred levels long - the opening
# levels there had three letters to build from and no choice but to borrow - so this comes
# back if the syllabus does. `check` fails on any repeat that is not listed here, and on any
# entry here that no level actually borrows.
SHARED = {}

# Whether this catalogue is the complete teaching syllabus, or a short game cut out of one.
# Several checks only mean something about the complete thing - that it reaches every letter,
# that no level introduces more than a couple of new pieces at a time - and they are reported
# rather than enforced while this is False.
#
# Stated rather than worked out from the levels. The obvious guess - "does it use all five
# blocks?" - is wrong for exactly the catalogue that exists now: ten levels reaching into the
# conjunct block are not a syllabus, and a tenth level of free play would flip the guess
# without changing that. Set this to True when the levels are written to teach again.
FULL_SYLLABUS = False

MIN_ZIPF = 2.0          # below this, treat a "word" as invented rather than Bengali
MAX_ROWS, MAX_COLS = 8, 9

# The widest wheel worth drawing. A board grows by taking on words, and a word it has no tile
# for brings its own - so this is what stops a level from ending up with a wheel too crowded to
# drag across on a phone.
MAX_TILES = 7

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
    BLOCK_PLAIN: 5, BLOCK_ONE_KAR: 6, BLOCK_KARS: 6, BLOCK_CONJUNCT: 8, BLOCK_FREE: 8,
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
    }
    return level, problems


def placeable(words):
    """The board these words make, or None if they will not make a legal one."""
    placed = layout(words)
    if not placed:
        return None
    rows, cols = grid_size(placed[0])
    if rows > MAX_ROWS or cols > MAX_COLS:
        return None
    if stray_runs(placed[0], words):
        return None
    return placed[0]


def grow_board(seed, candidates, target, max_tiles=None):
    """
    Fills a board out to `target` words, taking each candidate only if the crossword still lays
    out legally. A candidate the wheel has no tile for brings its own, up to `max_tiles`, so a
    board can grow past what its authored words happened to spell.

    The authored words are laid down first and as a whole - `validate` has already proved they
    make a board - and are never dropped. They used to go into the same queue as the
    candidates, which lost them: a level authored as উট ইঁদুর উত্তর দুই came out as
    উট উত্তর আট টগর আসা, because ইঁদুর shares no letter with উট and so went to the back of the
    queue, and by the time it came round again the board had spent its tiles on filler and had
    no room for it. An alphabet level for ই that contains no ই is worse than a small one.

    A candidate the board could not take goes back in the queue rather than being discarded,
    because whether it fits depends on what is already down: কর shares no letter with ঘড়ি but
    crosses ঘর happily, so one pass in the wrong order would lose it.
    """
    board = list(seed)
    if len(board) > 1 and placeable(board) is None:
        return board                     # validate should have caught this; do no harm
    queue = [w for w in dict.fromkeys(candidates) if w not in board]
    while queue and len(board) < target:
        rest = []
        for word in queue:
            trial = board + [word]
            if max_tiles and len(tiles_for(trial)) > max_tiles:
                continue
            if placeable(trial) is None:
                rest.append(word)
                continue
            board = trial
            if len(board) >= target:
                break
        if len(rest) == len(queue):
            break                        # a whole pass over the queue added nothing
        queue = rest
    return board


def order_block(group, known, keep_order=False):
    """
    Order one block gently: at each step take the level that introduces the least new
    material, breaking ties by where its newest piece sits in the syllabus and then by how
    hard the board is. Greedy rather than sorted, because "how much is new" depends on what
    has already been placed - a level that looks like a big jump from the start of a block can
    be an easy step once its neighbours have been taken. `known` carries in what earlier
    blocks already taught.

    With `keep_order` the levels stay in the order they were written and this only works out
    what each one is the first to use, which is what an alphabet game wants: the order is
    already decided, by the alphabet.
    """
    if keep_order:
        ordered = list(group)
        for level in ordered:
            level['teaches'] = new_units(level['words'], known)
            known |= set(units_in(level['words']))
        return ordered, known

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
    for letters, block, words in DECLARED:
        level, problems = validate(words, block)
        if problems:
            failures.append((words, problems))
            continue
        level['letters'] = letters
        levels.append(level)

    # Board words are verified vocabulary too, so a level can grow into a word another level was
    # authored around - it just cannot take one another level has already set.
    vocabulary = list(dict.fromkeys(pool_words() + [w for l in levels for w in l['words']]))

    # Where the levels sit. A syllabus is ordered by block - plain letters, then one vowel
    # sign, then several, then conjuncts - with puzzle difficulty deciding only the order
    # inside a block. An alphabet game is ordered by the alphabet, which is the order it is
    # written in, and sorting by block would scatter it: ক lands in block 3 and গ in block 2,
    # so ক would be played second.
    known, out = set(), []
    if FULL_SYLLABUS:
        for block in sorted({l['block'] for l in levels}):
            group = [l for l in levels if l['block'] == block]
            group.sort(key=lambda l: l['score'])
            ordered, known = order_block(group, known)
            out += ordered
    else:
        out, known = order_block(levels, known, keep_order=True)
    levels = out

    # No word is a puzzle twice. That rule is what decides the rest: a board grows only into
    # words no other level has claimed, so no level can help itself to the same handful of
    # common words the level before it used.

    # What a learner can read by the time they reach each level. Growth only ever adds words
    # made of units the level's own authored words have already introduced, so this is fixed
    # before any board grows and does not shift as they do.
    taught_by, seen = {}, set()
    for level in levels:
        seen |= set(units_in(level['words']))
        taught_by[id(level)] = set(seen)

    # Fill the boards out, fullest blocks first - and only for a syllabus. An alphabet level is
    # the list of words that start with its letter, and growing it from the pool would pad it
    # with words that do not: গ's board is গরম গাছ গাজর গম গান because those are the গ words,
    # not because six was the target.
    #
    # Fullest blocks first because free play is meant to be the fullest board in Free play is meant to be the fullest board in
    # the game and sits at the end of the syllabus, so if the levels took their turn in
    # teaching order it would be picking over what twenty blocks of vowel signs left behind.
    claimed = set(AUTHORED)
    for level in (sorted(levels, key=lambda l: -l['block']) if FULL_SYLLABUS else []):
        candidates = [w for w in vocabulary
                      if w not in claimed and set(units_in([w])) <= taught_by[id(level)]
                      and block_for(level['words'] + [w]) == level['block']]
        # Fewest new tiles first, then commonest: a word the wheel can already spell costs the
        # player nothing, while one that brings two tiles of its own makes every other word on
        # the board harder to find.
        candidates.sort(key=lambda w: (len(set(split_aksharas(w)) - set(level['tiles'])),
                                       -zipf(w)))
        grown = grow_board(level['words'], candidates, BOARD_TARGET[level['block']], MAX_TILES)
        if len(grown) > len(level['words']):
            level['words'] = grown
            level['tiles'] = tiles_for(grown)
            level['occupied'] = placeable(grown)
            level['size'] = grid_size(level['occupied'])
            level['score'] = difficulty(level['tiles'], grown)
        claimed |= set(grown)

    # Then walk the syllabus in order, which is what decides which level is teaching what and
    # holds the no-repeat rule to account.
    played, taught, out = set(), set(), []
    for level in levels:
        unlisted = [w for w in level['words'] if w in played and w not in SHARED]
        if unlisted:
            failures.append((level['words'],
                             [f'{w} is already a board word on an earlier level and is not in '
                              f'SHARED' for w in unlisted]))
            continue
        known_before = set(taught)
        taught |= set(units_in(level['words']))
        level['teaches'] = new_units(level['words'], known_before)
        played |= set(level['words'])
        out.append(level)

    return out, failures
