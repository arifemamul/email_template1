#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Refit every level to a 7-tile wheel.

    python3 tools/refit.py            print what it would do, change nothing
    python3 tools/refit.py --write    write tools/levels-refit.json

The wheel cap came down from 8 to 7 and 22 levels were over it. This works out what to do
with each one, so the answer is a rule applied evenly rather than 22 hand-made decisions.

What it may do to an over-cap level, in order of preference:

  1. SPLIT it into two legal levels. Nothing is lost - the letter simply gets another level,
     which is allowed: a letter already carries anywhere from one to nine.
  2. SPLIT it with help, borrowing words for the same letter that are in the vocabulary pool
     and on no board yet, when the level's own words will not divide.
  3. SWAP a word out for a pool word, when the level cannot divide at all.
  4. DROP a word, when nothing in the pool fits.

Choosing between candidate fixes, in this order:
  - keep the most of the level's original words;
  - keep the most aksharas that appear on no other board, because losing the game's only
    হো word means হো is no longer taught anywhere - a curriculum hole, not just a lost word;
  - prefer two levels over one, then the evener division, then the smaller wheels.

Every word must still start with the level's akshara (or its letter, for a `letter` level),
so a fix can never quietly change what a level teaches.
"""
import itertools
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))

from bangla import cluster_layout, split_aksharas, wheel_for        # noqa: E402
from catalogue import ALL_LEVELS, GLOSS, MAX_ROWS, MAX_COLS         # noqa: E402
import vocabulary                                                   # noqa: E402

CAP = 7          # the new ceiling
FLOOR = 3        # and the floor, which nothing was under already
MIN_WORDS = 3

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
    """A word list that could ship as a level, wheel and board both."""
    if len(words) < MIN_WORDS or len(set(words)) != len(words):
        return False
    if not FLOOR <= len(wheel_for(words)) <= CAP:
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


def solve(level, borrowable, precious):
    """
    The best fix for one over-cap level, as (kind, [word lists], lost words).

    `precious` is the set of aksharas carried by exactly one board, so dropping a word that
    holds one is scored as the real loss it is.
    """
    original = [w['w'] for w in level['words']]
    pool = [w for w in borrowable if belongs(w, level) and w in ALLOWED]

    def loss(kept):
        gone = [w for w in original if w not in kept]
        holed = {a for w in gone for a in split_aksharas(w)} & precious
        # Only a hole if no kept word puts the akshara back.
        holed -= {a for w in kept for a in split_aksharas(w)}
        return len(gone), len(holed), gone, holed

    best = None
    for borrow in range(0, min(MAX_BORROW, len(pool)) + 1):
        for extra in itertools.combinations(pool, borrow):
            words = original + list(extra)
            # Two levels, every original word placed somewhere.
            for size in range(MIN_WORDS, len(words) - MIN_WORDS + 1):
                for a in itertools.combinations(words, size):
                    b = [w for w in words if w not in a]
                    if not (legal(list(a)) and legal(b)):
                        continue
                    kept = set(a) | set(b)
                    gone, holed, lost, holes = loss(kept)
                    score = (gone, holed, 0, abs(len(a) - len(b)),
                             len(wheel_for(list(a))) + len(wheel_for(b)), borrow)
                    if best is None or score < best[0]:
                        best = (score, 'split', [list(a), b], lost, holes)
            # Or one level, which means giving something up.
            for size in range(len(words), MIN_WORDS - 1, -1):
                for a in itertools.combinations(words, size):
                    if not legal(list(a)):
                        continue
                    gone, holed, lost, holes = loss(set(a))
                    score = (gone, holed, 1, 0, len(wheel_for(list(a))), borrow)
                    if best is None or score < best[0]:
                        best = (score, 'one', [list(a)], lost, holes)
        if best and best[0][0] == 0 and best[0][1] == 0:
            break        # nothing lost; borrowing more cannot improve on that
    return best


def main(write=False):
    precious = unique_aksharas(ALL_LEVELS)
    on_board = {w['w'] for lv in ALL_LEVELS for w in lv['words']}
    borrowable = [w for w in vocabulary.words() if w not in on_board]

    over = [lv for lv in ALL_LEVELS if len(wheel_for([w['w'] for w in lv['words']])) > CAP]
    print(f'{len(over)} of {len(ALL_LEVELS)} levels are over the {CAP}-tile cap\n')

    fixes, lost_words, holes, claimed = {}, [], set(), set()
    for lv in over:
        original = [w['w'] for w in lv['words']]
        free = [w for w in borrowable if w not in claimed]
        result = solve(lv, free, precious)
        if result is None:
            print(f'  {lv["id"]:8s} NO LEGAL FIX')
            continue
        _, kind, groups, lost, holed = result
        for g in groups:
            for w in g:
                if w not in original:
                    claimed.add(w)
        fixes[lv['id']] = {'kind': kind, 'groups': groups, 'lost': lost}
        lost_words += lost
        holes |= holed
        tag = 'split' if kind == 'split' else 'one level'
        borrowed = [w for g in groups for w in g if w not in original]
        print(f'  {lv["id"]:8s} {tag}')
        for g in groups:
            print(f'{"":13s}{" ".join(g):46s} [{len(wheel_for(g))}t]')
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
