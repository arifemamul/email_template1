#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
The engine that turns a list of words into levels.

Not a command. `guide_levels.py` and `vocab_levels.py` are the two callers - one takes the
words the guide already shows, the other a vocabulary list handed in from outside - and the
only thing they do differently is where the words come from and what they are called. Every
rule about what a level may be lives here, once, because a second copy of it would drift and
the drift would not show up until a board reached a phone.

WHAT A LEVEL MAY BE. `catalogue.validate` is asked rather than reimplemented, so nothing
built here can be something the pipeline would refuse:

    two to five words        MIN_WORDS, and five is as many as one letter's run supports
    three to five tiles      MIN_TILES to MAX_TILES - the ring is the difficulty
    two or three aksharas    a single-akshara word is not a puzzle; four is too long a queue
    a connected board        laid out by the same `cluster_layout` the game uses, inside
                             5 x 7, spelling nothing but its own answers
    not already a puzzle     no word is set twice, checked across the whole catalogue

And two constraints that `validate` does not know about, both added after a real level got
past it and was caught four minutes downstream in the browser suite:

    a hideable ring          the wheel is scrambled so no answer is spelled out in ring
                             order, and on a small ring no such arrangement may exist. ঝঞ্ঝা
                             with ঝঞ্ঝাট gives three tiles on which every arrangement spells
                             one of them.
    separable twins          থুতু with থুথু needs two থু tiles on a ring of three, where every
                             pair is adjacent, so the scrambler can never keep the twins apart

HOW WORDS ARE GROUPED. By first akshara, because that is an akshara level's whole teaching
claim - every word on it starts with the same akshara. Where that strands a word, a second
pass takes it with the catalogue's other kind of level: `type: letter`, the weaker claim of
one base letter under any vowel sign, which is how levels-oi.json reaches তৈরি beside তাঁতি.
Greedy within each group and re-scored after every take, because the aim is to place as many
words as possible and a word left over is a word nobody can play.
"""
import collections
import itertools
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from bangla import split_aksharas, wheel_for                         # noqa: E402
from build import ring_can_hide                                      # noqa: E402
from catalogue import (ALL_LEVELS, MAX_TILES, MIN_TILES, MIN_WORDS,   # noqa: E402
                       validate)
from vocabulary import REJECTED                                      # noqa: E402
from wordpool import zipf                                            # noqa: E402

# As many words as one letter's run can hold. Every word on the level begins with the same
# akshara, so they can only ever cross there - and `cluster_layout` allows islands for exactly
# that reason. Five is where the ring cap bites anyway.
MAX_WORDS = 5

# The corpus floor. `check` reports three authored words that sit under it and lets them ship,
# because each was chosen by hand for a reason written down beside it. Nothing a generator
# produces was chosen by hand, so nothing it produces gets that benefit.
FLOOR = 3.0


def twins_can_separate(tiles):
    """
    Can the ring be arranged with no repeated tile beside its own twin?

    A word like থুথু needs two থু tiles, and the scrambler keeps them apart so the wheel does
    not draw the answer. On a ring of n tiles a tile appearing k times can be spread out only
    when k is at most n // 2 - so তু থু থু, three tiles with থু twice, has no arrangement at
    all: every pair on a three-ring is adjacent.
    """
    counts = collections.Counter(tiles)
    return max(counts.values()) <= len(tiles) // 2


def unfit(word, on_board):
    """Why this word cannot be a board word at all, or None. Source-independent reasons only."""
    n = len(split_aksharas(word))
    if word in on_board:
        return 'already a puzzle'
    if n < 2:
        return 'a single akshara'
    if n > 3:
        return f'{n} aksharas'
    if word in REJECTED:
        return f'rejected: {REJECTED[word]}'
    if zipf(word) < FLOOR:
        return f'rarer than the floor of {FLOOR}'
    return None


def score(words):
    """A better level first: more words, commoner words, a smaller ring."""
    return (len(words), sum(zipf(w) for w in words) / len(words), -len(wheel_for(words)))


def levels_for(key, pool, kind='akshara'):
    """Every level one key's words can make, taking the best group each time."""
    left, out = list(pool), []
    while len(left) >= MIN_WORDS:
        best = None
        for size in range(min(MAX_WORDS, len(left)), MIN_WORDS - 1, -1):
            for combo in itertools.combinations(left, size):
                tiles = wheel_for(list(combo))
                if not MIN_TILES <= len(tiles) <= MAX_TILES:
                    continue
                if best and score(combo) <= score(best):
                    continue
                if not ring_can_hide(tiles, list(combo)):
                    continue
                if not twins_can_separate(tiles):
                    continue
                _, problems = validate(list(combo), key=key, kind=kind)
                if not problems:
                    best = list(combo)
            if best:
                break            # a bigger board beats a commoner one; stop at the first size
        if not best:
            break
        out.append(best)
        left = [w for w in left if w not in best]
    return out, left


def catalogue_without(out_path):
    """
    The catalogue as it is without one generator's own output.

    `catalogue.ALL_LEVELS` includes a generated file once it exists, so reading it whole makes
    the generator see its own words as already set and produce nothing the second time. Its ids
    are excluded too, or a re-run would number around itself and drift. Filtered from the
    post-refit levels rather than from the JSON on disk, because refit can drop a word - and a
    word refit dropped is free to be used.
    """
    import json
    mine = set()
    if out_path.exists():
        mine = {lv['id'] for lv in json.loads(out_path.read_text(encoding='utf-8'))['levels']}
    return [lv for lv in ALL_LEVELS if lv['id'] not in mine]


def place(words, out_path, note, spare=()):
    """
    Group `words` - a dict of word -> extra fields for the level entry - into levels.

    Returns (levels, stranded). `note` is called with a word and returns the dict of fields to
    ship beside it, so each caller decides what its own provenance looks like.

    `spare` is a second-class pool: words offered only to rescue what `words` could not place
    on its own. Three passes, in order - by first akshara, by letter, then by letter again with
    the spares thrown in - and the order is the point. A spare may fill a gap but may never
    take a slot from the list that was actually asked for: `score` prefers a commoner word, so
    a single pool would let a spare outrank the word it was meant to help.
    """
    others = catalogue_without(out_path)
    taken = {lv['id'] for lv in others}

    def next_akshara_id(akshara):
        if akshara not in taken:
            taken.add(akshara)
            return akshara
        n = 2
        while f'{akshara}·{n}' in taken:
            n += 1
        taken.add(f'{akshara}·{n}')
        return f'{akshara}·{n}'

    def next_letter_id(letter):
        n = 1
        while f'{letter}-{n}' in taken:
            n += 1
        taken.add(f'{letter}-{n}')
        return f'{letter}-{n}'

    def entry(word):
        return {'w': word, 'split': split_aksharas(word),
                'freq': round(zipf(word), 2), **note(word)}

    by_first = {}
    for word in words:
        by_first.setdefault(split_aksharas(word)[0], []).append(word)

    levels, over = [], {}
    for akshara in sorted(by_first):
        made, left = levels_for(akshara, sorted(by_first[akshara]))
        for group in made:
            levels.append({'id': next_akshara_id(akshara), 'type': 'akshara', 'key': akshara,
                           'words': [entry(w) for w in group]})
        for w in left:
            over.setdefault(akshara[0], []).append(w)

    still = {}
    for letter in sorted(over):
        made, left = levels_for(letter, sorted(over[letter]), kind='letter')
        for group in made:
            levels.append({'id': next_letter_id(letter), 'type': 'letter', 'key': letter,
                           'words': [entry(w) for w in group]})
        for w in left:
            still.setdefault(letter, []).append(w)

    for w in spare:
        still.setdefault(split_aksharas(w)[0][0], []).append(w)

    stranded = {}
    for letter in sorted(still):
        made, left = levels_for(letter, sorted(still[letter]), kind='letter')
        for group in made:
            levels.append({'id': next_letter_id(letter), 'type': 'letter', 'key': letter,
                           'words': [entry(w) for w in group]})
        for w in left:
            stranded[w] = f'the only word left that starts with {letter}'
    return levels, stranded
