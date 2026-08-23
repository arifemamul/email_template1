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

SYLLABUS = {

    # Block 1: letters on their own. No vowel signs, no conjuncts, nothing hanging off
    # anything. One or two new letters per level, with the earlier ones coming back so they
    # get used rather than met once. Boards stay at three or four words: the thing being
    # learned here is that a tile is a letter and a drag is a word.
    #
    # Ten levels, which is the whole game for now. There were 104, running through all five
    # blocks to free play and covering every letter and sign in the language; they were deleted
    # on purpose while the way a level works is reworked. They are in the history rather than
    # commented out here: `git show d102737:tools/catalogue.py` has all of them, along with the
    # `SHARED` entries and the checks that went with them.
    BLOCK_PLAIN: [
        ["কলম", "কম", "কল"],             # ল, ক, ম - the first three letters of the game
        ["কলম", "কম", "কল", "আম"],       # আ
        ["কলম", "এক", "কম", "কল"],       # এ
        ["ফল", "কমল", "ফলক"],            # ফ
        ["কলম", "অতল", "কম", "কল"],      # অ, ত
        ["বদল", "দল", "বল"],             # ব, দ
        ["ঈদ", "কদম", "দম"],             # ঈ
        ["সব", "বস", "বক"],              # স
        ["সব", "বই", "বস"],              # ই
        ["কর", "সকল", "সরল"],            # র
    ],
}

# Every level as (declared block, words). The declared block is checked against what the
# words actually contain, so a level cannot drift out of its block unnoticed.
DECLARED = [(block, words) for block in sorted(SYLLABUS) for words in SYLLABUS[block]]

CATALOGUE = [words for _, words in DECLARED]

# Every word the syllabus was authored around. Boards grow into the pool, and this is what
# growth may not touch: a common word swallowed by a level in block 2 is a word missing from
# the block-4 level that was built on it, and since no word is set twice, that level would
# have nothing left to teach its cluster with.
AUTHORED = {w for _, words in DECLARED for w in words}

# A word is set as a puzzle once. Four levels break that rule, and every one of them is a
# level introducing a letter early enough that there is nothing else to build a board from -
# so these are the words they have to borrow, with what makes each one unavoidable. The check
# below fails on any repeat that is not listed here, and on any entry here that no level
# actually needs, which is the only thing that keeps the list honest in both directions.
SHARED = {
    'কলম': 'the opening level teaches ল, ক and ম, and কলম, কম and কল are every word those '
            'three letters spell. The three levels that add one more letter to them - আ, এ '
            'and অ - have nothing else to cross the new letter with, because at that point in '
            'the syllabus there is nothing else the learner can read',
    'কম': 'same three letters, same three levels',
    'কল': 'same three letters, same three levels',
    'সব': 'ব and স are taught two levels before ই, and সব and বস are the only words a learner '
           'who knows ল ক ম ব দ র স can read that will cross বই',
    'বস': 'same, and for the same level',
}

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
    BLOCK_PLAIN: 3, BLOCK_ONE_KAR: 3, BLOCK_KARS: 4, BLOCK_CONJUNCT: 5, BLOCK_FREE: 6,
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
    Fills a board out to `target` words, taking each candidate only if the crossword still
    lays out legally. The authored words go on first and are never dropped; the rest are
    commonest first, so a bigger board stays fair.

    A candidate the wheel has no tile for brings its own, up to `max_tiles`, so a board can
    grow past what its authored words happened to spell. The authored words themselves are
    never dropped and never counted against the cap.

    A word the board could not take goes back in the queue rather than being discarded,
    because whether it fits depends on what is already down: কর shares no letter with ঘড়ি but
    crosses ঘর happily, so one pass in the wrong order would lose it.
    """
    board, queue = [], list(dict.fromkeys(list(seed) + list(candidates)))
    while queue:
        rest = []
        for word in queue:
            if len(board) >= target and word not in seed:
                break
            trial = board + [word]
            if max_tiles and word not in seed and len(tiles_for(trial)) > max_tiles:
                continue
            if len(trial) > 1 and placeable(trial) is None:
                rest.append(word)
                continue
            board = trial
        if len(rest) == len(queue):
            break                        # a whole pass over the queue added nothing
        queue = rest
    return board


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


def spans_syllabus(levels):
    """
    Whether the catalogue runs the whole way through the teaching order rather than stopping
    part-way. Several checks only mean something about a finished syllabus - that it reaches
    every letter, that boards get fuller as it advances - and this is what tells them whether
    they are looking at one. Derived from the levels rather than declared, so the checks come
    back by themselves as soon as the later blocks do.
    """
    return {l['block'] for l in levels} == set(BLOCKS)


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

    # Board words are verified vocabulary too, so a level can grow into a word another level was
    # authored around - it just cannot take one another level has already set.
    vocabulary = list(dict.fromkeys(pool_words() + [w for l in levels for w in l['words']]))

    # Blocks in order; inside each, the gentlest step first.
    known, out = set(), []
    for block in sorted({l['block'] for l in levels}):
        group = [l for l in levels if l['block'] == block]
        group.sort(key=lambda l: l['score'])
        ordered, known = order_block(group, known)
        out += ordered
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

    # Fill the boards out, fullest blocks first. Free play is meant to be the fullest board in
    # the game and it sits at the end of the syllabus, so if the levels took their turn in
    # teaching order it would be picking over what twenty blocks of vowel signs left behind.
    claimed = set(AUTHORED)
    for level in sorted(levels, key=lambda l: -l['block']):
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
