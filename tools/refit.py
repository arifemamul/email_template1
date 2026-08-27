#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cut every level down to a five-letter wheel.

    python3 tools/refit.py            print what it would do, change nothing
    python3 tools/refit.py --write    write tools/levels-refit.json

The player is a child who has just learned the alphabet. Every extra letter on the ring is
another thing to rule out before the first one can be picked, so the ring is the difficulty,
not the words. Five is the cap.

Getting there without throwing away the vocabulary rests on one change: a level may hold TWO
words. It used to need three - a rule inherited from a version of this game that was a
teaching syllabus rather than alphabet practice. Two words that cross at a shared letter is a
whole puzzle, and for a beginner it is arguably the right size of one. It is also what makes
five reachable:

    words per level    smallest wheel that fits every word
    three or more      seven (a hard six costs 34 words and loses ঔ entirely)
    two or more        five  (costs two words: কাঠবিড়ালি and রেলগাড়ি)

So each level is partitioned - into as many small levels as its words need, not just two - and
every part must come in at five letters or fewer. A letter may carry as many levels as it
takes; ক already carries fifteen.

Choosing between candidate partitions, in this order:
  - keep the most of the level's original words;
  - keep the most aksharas that appear on no other board, because losing the game's only
    হো word means হো is no longer taught anywhere - a curriculum hole, not just a lost word;
  - then the fewest parts, so a level is not atomised when it did not need to be;
  - then the smallest wheels.

Every word must still start with the level's akshara (or its letter, for a `letter` level),
so a fix can never quietly change what a level teaches.
"""
import itertools
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))

from bangla import cluster_layout, split_aksharas, wheel_for        # noqa: E402
from build import ring_can_hide                                     # noqa: E402
from catalogue import _AUTHORED, GLOSS, MAX_ROWS, MAX_COLS          # noqa: E402
import vocabulary                                                   # noqa: E402

CAP = 5          # letters on the ring, hard
FLOOR = 3        # fewer than three and there is nothing to choose between

# Two words that cross is a puzzle. Three was the old minimum and it is what forced big rings:
# a third word on a level whose words share only their first letter brings all of its own
# letters with it.
MIN_WORDS = 2

# A borrowed word may only come from the vetted list. The pool is a bare word list with no
# glosses, and the curriculum's test is that a picture could replace the gloss - so letting the
# solver reach into it freely would put unglossed adjectives on children's boards to satisfy a
# tile count. levels-borrow.json is that list, with a written reason for every refusal.
_BORROW = json.loads((pathlib.Path(__file__).parent / 'levels-borrow.json')
                     .read_text(encoding='utf-8'))
ALLOWED = _BORROW['allow']

# Searching every subset of every ordering is exponential; these keep it to seconds. No level
# has more than 7 words, and borrowing more than 4 pool words would be rewriting the level
# rather than repairing it.
MAX_BORROW = 4


def board_fits(words):
    occupied, _, _ = cluster_layout(words, max_rows=MAX_ROWS, max_cols=MAX_COLS)
    rows = max(r for r, _ in occupied) + 1
    cols = max(c for _, c in occupied) + 1
    return rows <= MAX_ROWS and cols <= MAX_COLS


def legal(words):
    """A word list that could ship as a level: wheel, board, and the ring not being the answer."""
    if len(words) < MIN_WORDS or len(set(words)) != len(words):
        return False
    tiles = wheel_for(words)
    if not FLOOR <= len(tiles) <= CAP:
        return False
    # A three-tile ring holding a three-letter word IS that word: three rotations either way
    # covers all six orders, so no arrangement hides it. `check` rejects such a level, and a
    # small ring is exactly where it starts happening, so the solver has to know about it too.
    if not ring_can_hide(tiles, words):
        return False
    try:
        return board_fits(words)
    except Exception:
        return False


def belongs(word, level):
    """Whether a word may go on this level at all - the teaching claim, unchanged."""
    first = split_aksharas(word)[0]
    key = level['id'].split('·')[0].split('-')[0]
    return first == key if level['type'] == 'akshara' else first[0] == key[0]


def unique_aksharas(levels):
    """Aksharas that only one board in the whole game carries."""
    seen = {}
    for lv in levels:
        for w in lv['words']:
            for a in split_aksharas(w['w']):
                seen[a] = seen.get(a, 0) + 1
    return {a for a, n in seen.items() if n == 1}


def partitions(items, min_size):
    """Every way to split a list into groups of at least `min_size`, smallest count first."""
    def walk(rest, groups):
        if not rest:
            yield groups
            return
        head, tail = rest[0], rest[1:]
        for i, g in enumerate(groups):                       # put it with an existing group
            yield from walk(tail, groups[:i] + [g + [head]] + groups[i + 1:])
        yield from walk(tail, groups + [[head]])             # or start a new one
    seen = set()
    for groups in walk(list(items), []):
        if any(len(g) < min_size for g in groups):
            continue
        fingerprint = tuple(sorted(tuple(sorted(g)) for g in groups))
        if fingerprint in seen:
            continue
        seen.add(fingerprint)
        yield [list(g) for g in groups]


def solve(level, borrowable, precious):
    """
    The best way to cut one level into parts that each fit a five-letter ring.

    Returns (score, groups, lost words, holed aksharas). Every group is a level in its own
    right; a level that already fits comes back as a single group unchanged.
    """
    original = [w['w'] for w in level['words']]
    pool = [w for w in borrowable if belongs(w, level) and w in ALLOWED]

    def loss(kept):
        gone = [w for w in original if w not in kept]
        holed = {a for w in gone for a in split_aksharas(w)} & precious
        holed -= {a for w in kept for a in split_aksharas(w)}
        return len(gone), len(holed), gone, holed

    best = None
    for borrow in range(0, min(MAX_BORROW, len(pool)) + 1):
        for extra in itertools.combinations(pool, borrow):
            words = original + list(extra)
            # Dropping is a last resort, so try to place every word first and give up one at a
            # time only when the whole set will not go.
            for keep_n in range(len(words), MIN_WORDS - 1, -1):
                found = False
                for keep in itertools.combinations(words, keep_n):
                    for groups in partitions(keep, MIN_WORDS):
                        if not all(legal(g) for g in groups):
                            continue
                        found = True
                        gone, holed, lost, holes = loss(set(keep))
                        score = (gone, holed, len(groups),
                                 sum(len(wheel_for(g)) for g in groups), borrow)
                        if best is None or score < best[0]:
                            best = (score, groups, lost, holes)
                if found:
                    break        # no need to drop more words than this
        if best and best[0][0] == 0 and best[0][1] == 0:
            break                # nothing lost; borrowing more cannot improve on that
    return best


def main(write=False):
    precious = unique_aksharas(_AUTHORED)
    on_board = {w['w'] for lv in _AUTHORED for w in lv['words']}
    borrowable = [w for w in vocabulary.words() if w not in on_board]

    over = [lv for lv in _AUTHORED if len(wheel_for([w['w'] for w in lv['words']])) > CAP]
    print(f'{len(over)} of {len(_AUTHORED)} levels are over the {CAP}-letter cap\n')

    fixes, lost_words, holes, claimed = {}, [], set(), set()
    for lv in over:
        original = [w['w'] for w in lv['words']]
        free = [w for w in borrowable if w not in claimed]
        result = solve(lv, free, precious)
        if result is None:
            print(f'  {lv["id"]:8s} NO LEGAL FIX')
            continue
        _, groups, lost, holed = result
        for g in groups:
            for w in g:
                if w not in original:
                    claimed.add(w)
        fixes[lv['id']] = {'kind': 'split' if len(groups) > 1 else 'one',
                           'groups': groups, 'lost': lost}
        lost_words += lost
        holes |= holed
        borrowed = [w for g in groups for w in g if w not in original]
        print(f'  {lv["id"]:8s} into {len(groups)}')
        for g in groups:
            print(f'{"":13s}{" ".join(g):40s} [{len(wheel_for(g))} letters]')
        if borrowed:
            print(f'{"":13s}borrowed from the pool: {" ".join(borrowed)}')
        if lost:
            print(f'{"":13s}LOST: {" ".join(lost)}')

    print(f'\nwords lost: {len(lost_words)}')
    for w in lost_words:
        print(f'   {w:16s} {GLOSS.get(w, "")}')
    print(f'aksharas no longer taught anywhere: {" ".join(sorted(holes)) or "none"}')

    if write:
        out = pathlib.Path(__file__).parent / 'levels-refit.json'
        out.write_text(json.dumps({
            'name': 'What the 7-tile wheel cap forced, level by level',
            'WHY_THIS_FILE_EXISTS': [
                'The wheel came down from 8 tiles to 7 and 22 levels were over it. Rather than',
                'editing levels.json - which is kept exactly as it arrived, so it stays clear',
                'which levels came from where - the changes live here and catalogue.py applies',
                'them on load. Generated by tools/refit.py; re-run it to regenerate.',
            ],
            'fixes': fixes,
        }, ensure_ascii=False, indent=1), encoding='utf-8')
        print(f'\nwrote {out.relative_to(out.parent.parent)}')
    return 0


if __name__ == '__main__':
    sys.exit(main('--write' in sys.argv))
