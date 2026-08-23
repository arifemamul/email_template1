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

No word is set as a puzzle twice. The earlier catalogue leaned on a handful of easy words -
কলম, বল, কল, সব, রুটি - and reused them across a dozen tile sets, so a learner spent a good
part of the game re-spelling words they already knew. The rule that forbids it is what forced
the pool up past five hundred words, and what pays for the chest: a word you solved on level 3
appearing in the wheel on level 40 is a bonus word, and spotting it is the only evidence the
word stuck. Nine early levels have to borrow anyway - see `SHARED` - because a learner who
knows four letters has exactly one board available to them.

The rule costs board size. Boards used to grow to seven words by leaning on the same common
words everywhere; now the whole catalogue has to come out of one pool without repeats, so they
run three to five. Difficulty climbs through tile count, word length and conjuncts instead.
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
        ["সব", "বস", "বক"],
        ["কর", "সকল", "সরল"],
        ["কলম", "কম", "কল"],
        ["বদল", "দল", "বল"],
        ["বরফ", "তরল", "বগল"],
        ["সব", "বই", "বস"],
        ["কলম", "কম", "কল", "আম"],
        ["কলম", "এক", "কম", "কল"],
        ["সড়ক", "অলস", "কলস"],
        ["ফল", "কমল", "ফলক"],
        ["দশ", "নগদ", "নদ"],
        ["মন", "নগর", "নরম"],

        # The rest of the bare alphabet. These letters are rarer than the ones above, which is
        # why they come last - but a syllabus that stops before them leaves a learner unable
        # to read ওষুধ on a packet or ঋতু in a schoolbook, so they are not optional.
        ["কলম", "অতল", "কম", "কল"],      # অ
        ["ঈদ", "কদম", "দম"],       # ঈ
        ["গরম", "রকম", "গম"],
        ["উট", "মটর", "টগর"],              # উ
        ["ওজন", "নজর", "আজ"],       # ও
        ["ধন", "বন", "বল"],              # ধ, so that ঔষধ below has only two new things in it
        ["ঔষধ", "ধন", "নল"],             # ঔ and ষ together - ঔষধ is the only attested
                                         # conjunct-free word that carries ঔ at all
        ["ঋণ", "লবণ", "বল"],             # ঋ and ণ
        ["ঝলক", "নকল", "ঝড়"],            # ঝ
        ["যত", "জগত", "যব"],              # য, the bare one rather than the ya-phala
    ],

    # Block 2: one vowel sign per level, in the order of `curriculum.KAR_ORDER`. A level here
    # may reuse plain letters freely but never mixes two signs - the sign is the lesson, and
    # two at once means neither gets learned.
    BLOCK_ONE_KAR: [
        # া, the sign that sits plainly after its letter
        ["গতকাল", "ঈগল", "লতা"],
        ["করা", "তারা", "কলা", "তালা"],
        ["সাদা", "সাত", "কাদা"],
        ["দরজা", "কামার", "জামা"],
        ["সকাল", "কাটা", "ঝাল"],
        ["অজগর", "সাগর", "গাজর"],
        ["সমতল", "মাস", "মশা"],
        ["ভাই", "ভাত", "দই"],
        ["নাশতা", "ছাতা", "ছাদ"],
        ["বাতাস", "বাগান", "বাসন"],
        ["মাথা", "মাখন", "নখ"],
        # ি, the first sign written to the left of the letter it belongs to
        ["বিল", "সফল", "ফসল"],
        ["বছর", "খবর", "ছবি"],
        ["ভবন", "সবজি", "জিভ"],
        ["ঘর", "বানর", "ঘন", "বাঘ"],
        # ে, also written in front
        ["খাবার", "বানান", "রতন"],
        ["আপেল", "আট", "পেট"],
        ["লেখক", "ছেলে", "টক"],
        # ু, written underneath
        ["পশম", "পথ", "ঘুম"],
        ["দুপুর", "পুকুর", "দুই"],
        ["আঙুল", "আসল", "আঙুর", "রস"],
        ["সহজ", "সবুজ", "বুক"],
        ["চুল", "পলক", "কচু", "চুপ"],
        # longer words, still one sign: by now া is familiar enough to carry a compound
        ["লাগা", "গাছ", "কলাগাছ"],
        ["পাথর", "রঙ", "পাখা", "রথ"],
        ["নাটক", "কমলা", "লাউ"],
        ["রাখা", "রাখাল", "রাগ", "খাল"],
        ["মাছ", "মারা", "মাছরাঙা", "রাঙা"],
        ["পাঠ", "পালা", "পাঠশালা", "পাশা"],
        ["পাড়", "হাড়", "পাহাড়"],
        ["শরবত", "শহর", "হাত"],

        # ূ, ৈ, ৃ - the last three signs that a word can carry on its own.
        ["মূল", "মহল", "হজম"],        # ূ
        ["বৈঠক", "চমক", "চক"],        # ৈ
        ["কৃষক", "কলম", "কম", "কল"],       # ৃ
        ["ঊষা", "ভাষা", "ভাত"],            # ঊ, which needs a sign to sit beside
        # The nasal marks. They are not vowel signs, but they behave like one - hung on a
        # letter rather than standing beside it - and চাঁদ and বাংলা are too common to leave
        # a learner guessing at.
        ["কাঁটা", "আটা", "কাঁদা", "আদা"],       # ঁ
        ["বাংলা", "খালা", "খাতা"],    # ং
        # and the last three letters, which only appear with a sign attached
        ["ডাল", "লাল", "লাফ"],              # ড
        ["ঢাল", "কাল", "কাক"],        # ঢ
        ["গাঢ়", "গান", "কান"],            # ঢ়
    ],

    # Block 3: several signs in one word, all of them already taught. This is where ordinary
    # Bengali vocabulary opens up, and where compounds start (ফুল + বাগান -> ফুলবাগান).
    BLOCK_KARS: [
        ["পড়ালেখা", "লেখা", "পড়া", "খালি", "লিচু"],
        ["ইতিহাস", "হাতি", "হাঁস", "হাঁড়ি"],
        ["ঘরবাড়ি", "বাড়ি", "গাড়ি", "ঘড়ি", "কুঁড়ি"],
        ["নদী", "পান", "নদীর", "পার"],
        ["আলমারি", "তৈরি", "তৈল", "ঝিল"],
        ["কপাল", "পানি", "চিল", "চিনি"],
        ["মেঘলা", "খেলা", "মেঘ", "মেঝে"],
        ["বিছানা", "চাবি", "নাতি", "নাচা"],
        ["পরিবার", "বাছুর", "ছুটি"],
        ["ধরা", "রানি", "কাঁধ"],
        ["ফুলবাগান", "বালতি", "ফুল", "তিতা"],
        ["সময়", "ডিম", "সরু", "মরু"],
        ["কাঠবিড়ালি", "বিকাল", "বিড়াল", "আঁকা"],
        ["পাস", "পায়ে", "পায়েস"],
        # ৌ waits until here because every word that carries it carries a second sign too -
        # নৌকা is ৌ and া - so there is no honest way to teach it in the one-sign block.
        ["মৌমাছি", "মাঠ", "মাছি", "মালি"],
    ],

    # Block 4: joined consonants, one cluster family at a time, in `CONJUNCT_ORDER`. Two
    # consonants before three, and clusters whose parts stay legible (ন্ত, স্ত) before the
    # ligatures that fuse into a shape of their own (ক্ষ, ষ্ট).
    BLOCK_CONJUNCT: [
        ["বসন্ত", "বড়", "ঘাস", "ঘাড়"],              # ন্ত
        ["বারান্দা", "বাজার", "রাবার", "রাজা"],             # ন্দ
        ["রাস্তা", "রাস্তাঘাট", "ঘাট"],      # স্ত
        ["স্কুল", "শীতল", "শীত"],        # স্ক
        ["গল্প", "গড়া", "ছাড়া"],               # ল্প
        ["সুন্দর", "আনন্দ", "রসুন"],
        ["দিনরাত", "দিন", "রাত", "রান্না"],  # ন্ন
        ["রসগোল্লা", "আনারস", "আনা"],            # ল্ল
        ["বন্ধ", "বলা", "গলা"],               # ন্ধ
        ["বালিশ", "শক্ত", "বালি"],           # ক্ত
        ["পেন্সিল", "গাল", "পেঁপে"],    # ন্স
        ["স্বাদ", "চাদর", "চার"],        # স্ব
        ["বর্ষাকাল", "বর্ষা", "বসা", "আসা"],  # র্ষ
        ["চিঠিপত্র", "ছাত্র", "চিঠি"],       # ত্র
        ["শিক্ষক", "শিকড়", "কফি"],            # ক্ষ
        ["সমুদ্র", "বাস", "মুখ"],              # দ্র
        ["গ্রাম", "মধু", "ধুলা"],      # গ্র
        ["লয়", "বিদ্যালয়", "বিদ্যা"],  # দ্য
        ["জন্মদিন", "তিন", "বীজ"],    # ন্ম
        # ঐ lands in the conjunct block for the same reason ৌ landed in the last one: every
        # attested word carrying it also carries a cluster. ঐক্য is abstract for a child, and
        # it is still the best of a very short list.
        ["ঐক্য", "বাক্য", "বাটি"],           # ঐ, with ক্য
    ],

    # Block 5: everything taught, mixed, on the fullest boards the phone can hold.
    BLOCK_FREE: [
        ["দেওয়া", "গাওয়া", "দেখা"],
        ["মানুষ", "মাসি", "পৌষ"],
        ["আকাশ", "কালো", "আলো", "নৌকা"],
        ["কঠিন", "গায়ক", "নয়"],
        ["যাওয়া", "ওঠা", "ছায়া"],
        ["মিনিট", "নিচু", "ঘট"],
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

# A word is set as a puzzle once. Nine levels break that rule, and every one of them is a
# level introducing a letter that Bengali barely uses - so these are the words they have to
# borrow, with what makes each one unavoidable. The check below fails on any repeat that is
# not listed here, which is the only thing that keeps the list from quietly growing.
SHARED = {
    'কলম': 'the opening level teaches ল, ক and ম, and কলম, কম and কল are every word those '
            'three letters spell. The four levels that add one more letter to them - আ, এ, অ '
            'and ৃ - have nothing else to cross the new letter with, because at that point in '
            'the syllabus there is nothing else the learner can read',
    'কম': 'same three letters, same four levels',
    'কল': 'same three letters, same four levels',
    'সব': 'ব and স are taught two levels before ই, and সব and বস are the only words a learner '
           'who knows ল ক ম ব দ র স can read that will cross বই',
    'বস': 'same, and for the same level',
    'বল': 'the level that teaches ধ has ধন to work with, and the one that teaches ঋ and ণ has '
           'ঋণ and লবণ; neither cluster of letters spells a third word without বল',
    'ধন': 'ঔষধ is the only attested conjunct-free Bengali word carrying ঔ, and ধন and নল are '
           'the only two words already taught that cross it',
    'নল': 'same, and for the same level',
    'ভাত': 'ঊষা is the only word a beginner can read that carries ঊ, and ভাষা is the only '
            'word that crosses it - which leaves ভাত as the third',
}

# Three extra words fill the chest; a full chest pays out and starts again. The chest is
# shared across levels rather than reset each time - with three- and four-tile boards there
# are not always extras to find, so a per-level chest would sit empty and teach the player to
# ignore it.
CHEST_TARGET = 3
CHEST_REWARD = 15

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
        'extras': [],          # likewise: extras depend on what has been taught
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


def teachable(vocabulary, tiles, words, known, played=()):
    """
    Words those tiles can spell that a learner is equipped to read - every piece of the
    writing system in them has already been taught. A bonus word built on an untaught
    conjunct is worse than no bonus word: it is a puzzle the player cannot see the answer to
    even when staring at it.

    Words the player has already solved on an earlier board come first. No word is set as a
    puzzle twice, so the only way to meet রুটি again after solving it is to spot it in a later
    wheel - and that is worth paying for, because remembering a word is the thing the game is
    actually for.
    """
    found = [w for w in vocabulary
             if w not in words and spellable(w, tiles) and set(units_in([w])) <= known]
    found.sort(key=lambda w: (w not in played, -zipf(w), w))
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

    # No word is a puzzle twice. That rule is what decides the rest: a board grows only into
    # words no other level has claimed, and a word the player has already solved turns up in
    # later wheels as a bonus instead - which is how the chest gets fed now that boards cannot
    # help themselves to the same handful of common words over and over.

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

    # Then walk the syllabus in order, which is what decides who is teaching what and which
    # words are old enough to be worth coins.
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
        level['extras'] = teachable(vocabulary, level['tiles'], level['words'], taught, played)
        played |= set(level['words'])
        out.append(level)

    return out, failures
