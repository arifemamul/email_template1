# -*- coding: utf-8 -*-
"""
The level catalogue: the single source both builds are generated from.

Add or edit levels here, then run `python3 tools/build.py check` and, once it is clean,
`python3 tools/build.py build`. Never hand-edit `Levels.kt` or the `LEVELS` table inside
`docs/index.html` - they are generated, and editing one of them silently desynchronises the
Android and web games.

A level is written as a word list. The wheel is derived from it (the union of the words'
aksharas), which is what guarantees every tile is usable.

The game here is an alphabet game: the order is the alphabet, one letter per level, and each
level's board is the words that begin with that letter. `FULL_SYLLABUS` is False to say so.

It was previously a teaching syllabus, grouped into the five blocks of `curriculum.py` - plain
letters, then one vowel sign at a time, then several signs together, then conjuncts, then
everything mixed - with puzzle difficulty deciding the order only *within* a block. That
syllabus was removed, but the machinery for it is still here: blocks, budgets, board targets,
the coverage report, and the checks and tests that are gated behind `FULL_SYLLABUS`. Each
level still declares which block its words belong to, and that claim is still checked; it just
no longer decides where the level sits. Set `FULL_SYLLABUS` back to True and the whole set of
syllabus checks re-arms.

Keeping it costs nothing and the reasoning behind it was expensive: ranking levels purely by
how hard a board is to solve is what produced an ordering that handed out its first vowel sign
in level 6 without ever introducing one, and whose first conjunct was a three-consonant
cluster.

Words come from `vocabulary.py`, which is curated for a child. Corpus frequency is still the
floor that rejects invented compounds, but it is no longer the selector: rank by frequency
alone and the game fills with প্রতিষ্ঠান and রাষ্ট্রপতি, which are common in newspapers and
useless to a seven-year-old.

No word is set as a puzzle twice, and that is enforced: 181 words across 181 board slots. An
earlier catalogue leaned on a handful of easy words - কলম, বল, কল, সব - and reused them across
a dozen tile sets, so a learner spent a good part of the game re-spelling words they already
knew. `SHARED` is the list of deliberate exceptions and is currently empty; a level borrowing
without being listed there fails the check, and so does an entry no level actually borrows.
"""
import json
import pathlib

from bangla import (cluster_layout, conjunct_tiles, grid_size, layout, split_aksharas,
                    spellable, stray_runs, tiles_for, wheel_for)
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
# The alphabet opens with eleven vowels, and not all of them can hold a level of their own.
# অ and ই have a single word each in the whole pool, so they are paired with আ and উ; ঈ, ঊ and ঋ
# have two each, which is exactly enough. ঐ and ঔ have one each and no second spelling to pair
# with, so they get no level at all - ঐক্য and ঔষধ are the only pool words that begin with them,
# and ওষুধ, which is ঔষধ respelled, is the same word and cannot appear on a second board.
# ঙ, ঞ and ণ never begin a Bengali word and are skipped when their turn comes.
#
# Strict alphabet order is therefore impossible for the vowels: ই and ঈ cannot each hold a
# level, so the run is অআ, ইউ, ঈ, ঊ, ঋ, এও rather than one letter per step.
#
# Not every word on a board starts with the level's letter. Some are there to hold the
# crossword together: এক and ওজন share no letter at all, so without কঠিন and জন between them
# there is no board that holds both.
#
# A level cannot take those bridging words from a letter whose own level is still to come. ঢ
# would happily borrow থাকা and থালা, and then থ - which has two words in the pool to start
# with - would have none left.

# -- the levels, read from levels.json ----------------------------------------------------
# The curriculum is data, not code: 118 levels and 478 words with English glosses,
# spoken-corpus counts and per-word caveats, in `levels.json`. A level is keyed on an
# AKSHARA - ক, কা, কু, কে, কো, কাঁ - which is the কার series a Bengali child is taught, rather
# than on a bare letter. Levels of type "letter" hold one letter with mixed signs, for letters
# whose single aksharas have too few words to fill a wheel on their own.
#
# The file's own order puts all 38 mixed-sign levels after all 80 akshara levels, so a player
# would meet ক, then ঘ, then ঝ, and not reach খ or গ until level 82. `LEVEL_ORDER` regroups
# them: base letters in alphabet order, and within a letter the bare akshara first, then the
# kar series, then that letter's mixed-sign levels.

# Two files, kept apart on purpose. `levels.json` is the uploaded curriculum, exactly as it
# arrived. `levels-extra.json` fills five of the nine letters it does not reach - ঋ, ঠ, ঢ, য, ষ
# - four of which had a level in the letter-per-level game this replaced. Keeping them separate
# means it stays clear which levels came from where.
HERE = pathlib.Path(__file__).resolve().parent
_DATA = json.loads((HERE / 'levels.json').read_text(encoding='utf-8'))
_EXTRA = json.loads((HERE / 'levels-extra.json').read_text(encoding='utf-8'))
# And levels built from the words vocabulary.py had left unused - 320 of its 541 were idle
# once the akshara curriculum replaced the letter-per-level game. A '·2' id is a second level
# for an akshara that already has one, and sits straight after it.
_POOL = json.loads((HERE / 'levels-pool.json').read_text(encoding='utf-8'))
# And ঈ ঊ ঐ ঔ, which nothing else could reach: between them the other three files held six
# word-initial words for the four letters, where a level needs three each.
_VOWELS = json.loads((HERE / 'levels-vowels.json').read_text(encoding='utf-8'))
_AUTHORED = _DATA['levels'] + _EXTRA['levels'] + _POOL['levels'] + _VOWELS['levels']

# And what the 7-tile wheel forced. 22 levels were built when a wheel held 8; most of them
# divide into two smaller levels rather than losing a word, and a letter may carry as many
# levels as it needs. Generated by tools/refit.py, applied here so levels.json stays exactly
# as it arrived and it is always clear which change came from where.
_REFIT = json.loads((HERE / 'levels-refit.json').read_text(encoding='utf-8'))['fixes']
_BORROW = json.loads((HERE / 'levels-borrow.json').read_text(encoding='utf-8'))['allow']


def _apply_refit(authored):
    """
    The authored levels with the wheel cap applied.

    A level that was split keeps its own id for the first group and takes the next free `·N`
    for the second, so the two sit together wherever the letter does. A borrowed word arrives
    with the gloss written for it in levels-borrow.json - the pool it comes from has none, and
    a word with no gloss is a word no illustrator can draw.
    """
    used = {lv['id'] for lv in authored}

    def next_id(base):
        stem = base.split('·')[0]
        n = 2
        while f'{stem}·{n}' in used:
            n += 1
        used.add(f'{stem}·{n}')
        return f'{stem}·{n}'

    def entry(level, word):
        for w in level['words']:
            if w['w'] == word:
                return dict(w)
        borrowed = _BORROW[word]
        out = {'w': word, 'split': split_aksharas(word), 'en': borrowed['en'], 'freq': 0}
        if borrowed.get('flag'):
            out['flag'] = borrowed['flag']
        return out

    out = []
    for level in authored:
        fix = _REFIT.get(level['id'])
        if not fix:
            out.append(level)
            continue
        for i, group in enumerate(fix['groups']):
            part = dict(level)
            part['words'] = [entry(level, w) for w in group]
            if i:
                part['id'] = next_id(level['id'])
            out.append(part)
    return out


ALL_LEVELS = _apply_refit(_AUTHORED)

ALPHABET_ORDER = list("অআইঈউঊঋএঐওঔকখগঘঙচছজঝঞটঠডঢণতথদধনপফবভমযরলশষসহ")
KAR_SERIES = ['', 'া', 'ি', 'ী', 'ু', 'ূ', 'ৃ', 'ে', 'ৈ', 'ো', 'ৌ']


# ঐ and ঔ go to the very end rather than into the vowel run where the alphabet puts them.
# Measured over all 156 levels, they are the two hardest in the game: ঐ is ঐক্য, ঐতিহ্য, ঐশী
# and ঐচ্ছিক across three conjuncts, ঔ is ঔষধি, ঔদ্ধত্য and ঔজ্জ্বল্য across four. In alphabet
# order they land at levels 11 and 13, which puts the hardest and most abstract material in the
# game in front of a child who has met nine levels.
#
# That is not bad authoring, it is the language: word-initial ঐ and ঔ in Bengali are almost
# entirely abstract Sanskritic nouns, and there is nothing concrete to put there instead. So
# they become what they are - completeness levels, at the end, for a player who wants the whole
# alphabet - and the vowel run reads অ আ ই ঈ উ ঊ ঋ এ ও, which is the standard order with the
# two rarest left out.
LAST = ('ঐ', 'ঔ')


def teaching_order(level):
    """Where a level sits: base letter, then its own akshara series, then its mixed-sign ones."""
    key = level['id']
    base = key[0]
    if key in LAST:
        return (len(ALPHABET_ORDER) + 1, LAST.index(key), 0, 0, 0, key)
    letter = ALPHABET_ORDER.index(base) if base in ALPHABET_ORDER else len(ALPHABET_ORDER)
    if level['type'] == 'letter':
        return (letter, 2, int(key.split('-')[1]), 0, key)
    # A second level for the same akshara is marked '·2' and belongs immediately after the
    # first: it is more practice on that step of the কার series, not a new step.
    akshara, _, repeat = key.partition('·')
    again = int(repeat) if repeat else 1
    rest = akshara[1:]
    nasal = 1 if 'ঁ' in rest else 0
    kar = rest.replace('ঁ', '')
    return (letter, 1, nasal, KAR_SERIES.index(kar) if kar in KAR_SERIES else 99, again, key)


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


VOWELS = set('অআইঈউঊঋএঐওঔ')


def base_letter(level):
    """The consonant or vowel a level belongs to: কা·2, ক-1 and ক all belong to ক."""
    return level['id'].split('·')[0].split('-')[0][0]


def alphabetic(levels):
    """
    The order the levels are played: the বর্ণমালা, straight through.

    স্বরবর্ণ first - অ আ ই ঈ উ ঊ ঋ এ ঐ ও ঔ - then ব্যঞ্জনবর্ণ, ক to হ, which is the order a
    child recites and the order this game now teaches. Every level for a letter sits together,
    and a letter may carry as many as it needs: ক has nine, ঋ has one.

    Within a letter, the bare akshara leads and the কার series follows in the order of the
    vowels themselves - ক কা কি কী কু কূ কৃ কে কৈ কো কৌ, the বারোখড়ি as a primer prints it -
    with a `·N` second level straight after the one it doubles. Not curriculum.KAR_ORDER, which
    is the order the signs are best *introduced* (া ি ে ু ...) and belongs to the teaching
    syllabus this replaced; in an alphabet game the signs run in the alphabet's own order.

    This replaces an ordering by rounds, which was measurably kinder: it correlated +0.53 with
    difficulty against alphabet order's -0.11, because ক carries the most familiar words in the
    game and also the most of them. Alphabet order opens gently and then does not climb much.
    The two vowel levels at the front, ঐ and ঔ, are the hardest content in the game arriving
    eleventh and thirteenth - word-initial ঐ and ঔ in Bengali are almost entirely abstract
    nouns under heavy conjuncts, and there is no concrete alternative in the language.

    That was weighed and the alphabet won: a child looking for ম finds it where ম belongs, and
    an alphabet game whose levels are not in alphabet order is asking a lot of a beginner.
    """
    def place(letter):
        return ALPHABET_ORDER.index(letter) if letter in ALPHABET_ORDER else len(ALPHABET_ORDER)

    # The vowel signs in the order of the vowels they write: আ ই ঈ উ ঊ ঋ এ ঐ ও ঔ.
    signs_in_order = 'ািীুূৃেৈোৌ' 

    def within(level):
        """The bare akshara, then its কার series, then the doubles of each."""
        stem, _, double = level['id'].partition('·')
        stem = stem.split('-')[0]
        signs = [a for a in stem[1:] if a in signs_in_order]
        kar = signs_in_order.index(signs[0]) if signs else -1
        return (kar, len(stem), stem, int(double or 1), level['id'])

    vowels = [lv for lv in levels if base_letter(lv) in VOWELS]
    consonants = [lv for lv in levels if base_letter(lv) not in VOWELS]
    key = lambda lv: (place(base_letter(lv)),) + within(lv)
    return sorted(vowels, key=key) + sorted(consonants, key=key)


SYLLABUS = [
    (lv['id'], lv['type'], [w['w'] for w in lv['words']])
    for lv in alphabetic(ALL_LEVELS)
]

GLOSS = {w['w']: w['en'] for lv in ALL_LEVELS for w in lv['words']}
CAVEAT = {w['w']: w['flag'] for lv in ALL_LEVELS for w in lv['words'] if w.get('flag')}

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

# What the placer aims for. These are the shape it tries to keep a board inside, and with both
# orderings and cap-aware crossings every one of the 118 lands within 4 rows and 8 columns. The
# numbers matter for more than fitting: a box is sized for the largest board in the game, so
# the widest and tallest board decides how big a box can be on every level. Loosening either
# one costs every level a smaller box.
MAX_ROWS, MAX_COLS = 5, 7

# The widest wheel worth drawing, and it came down from 8. Eight tiles on a 360px phone leaves
# each one small enough that a drag catches its neighbour, and a ring of eight puts two tiles
# adjacent for every word of three. A board grows by taking on words, and a word it has no tile
# for brings its own - so this is what stops a level from ending up with a wheel too crowded to
# drag across. tools/refit.py is what brought the 22 levels built for eight down to seven.
MAX_TILES = 7

# And the narrowest. Three tiles is the least that makes a puzzle: two tiles spell one word and
# there is nothing to choose between.
MIN_TILES = 3

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


def validate(words, block=None, key=None, kind=None):
    """Everything that has to be true before a level can ship. Returns (level, problems)."""
    problems = []
    tiles = wheel_for(words)

    if len(words) != len(set(words)):
        problems.append('repeats a word')
    if len(words) < 3:
        problems.append(f'only {len(words)} words; a level needs at least 3')
    if not MIN_TILES <= len(tiles) <= MAX_TILES:
        problems.append(f'wheel of {len(tiles)} tiles, outside the '
                        f'{MIN_TILES} to {MAX_TILES} a wheel holds')

    # A level is named after an akshara, and every word on it has to start with that
    # akshara - that is the whole teaching claim. A 'letter' level makes the weaker claim:
    # same letter, any vowel sign.
    if key:
        if kind == 'akshara':
            akshara = key.split('·')[0]
            off = [w for w in words if split_aksharas(w)[0] != akshara]
            if off:
                problems.append(f'{akshara} level, but {" ".join(off)} '
                                f'do not start with {akshara}')
        else:
            base = key.split('-')[0]
            off = [w for w in words if split_aksharas(w)[0][0] != base]
            if off:
                problems.append(f'{base} level, but {" ".join(off)} do not start with {base}')

    for w in words:
        aksharas = split_aksharas(w)
        # Frequency was the gate that caught invented compounds when words were chosen by
        # corpus rank. These are hand-curated with glosses, so it reports instead: three of
        # the 478 sit under the old floor - নিমকি, ডেগ, নেভা - all real, all rare in the
        # subtitle corpus the numbers come from. See the `thin:` line in the report.
        if len(aksharas) < 2:
            problems.append(f'{w} is a single akshara')
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

    # Islands allowed: an akshara-keyed level has every word starting with the same
    # akshara, so at most two of them can ever connect. See `cluster_layout`.
    placed = cluster_layout(words, max_rows=MAX_ROWS, max_cols=MAX_COLS)
    if not placed:
        problems.append('the words cannot be placed at all')
        return None, problems

    occupied, words_placed, islands = placed
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
        'placed': words_placed,
        'size': (rows, cols),
        'score': difficulty(tiles, words),
        'block': block if block is not None else actual,
        'islands': islands,
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
    for key, kind, words in DECLARED:
        level, problems = validate(words, None, key=key, kind=kind)
        if problems:
            failures.append((words, problems))
            continue
        level['letters'] = key
        level['kind'] = kind
        levels.append(level)

    # Board words are verified vocabulary too, so a level can grow into a word another level was
    # authored around - it just cannot take one another level has already set.
    vocabulary = list(dict.fromkeys(pool_words() + [w for l in levels for w in l['words']]))

    # Where the levels sit. A syllabus is ordered by block - plain letters, then one vowel
    # sign, then several, then conjuncts - with puzzle difficulty deciding only the order
    # inside a block. An alphabet game is ordered by the alphabet, which is the order it is
    # written in, and sorting by block would scatter it: ক lands in block 3 and গ in block 2,
    # so ক would be played second.
    # Order is decided by `teaching_order` when SYLLABUS is built, so nothing re-sorts here.
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
