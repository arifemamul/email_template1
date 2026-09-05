#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cut every level down to a five-letter wheel and a three-akshara word.

    python3 tools/refit.py            print what it would do, change nothing
    python3 tools/refit.py --write    write tools/levels-refit.json

The player is a child who has just learned the alphabet, and two separate things make a level
hard for them:

    the ring    how much there is to choose from before the first tile can be picked
    the word    how long the answer is, and so how many chances there are to go wrong

Both are capped, and they are not the same limit. A five-letter ring holding চকলেট - চ+ক+লে+ট,
four of the five tiles in one word - is barely a puzzle: there is almost nothing to rule out,
just a long queue to type. So no word may run past three aksharas, and no ring past five
letters. Neither cap can be traded for the other.

Reaching five on the ring rests on one earlier change: a level may hold TWO words. It used to
need three - a rule inherited from a version of this game that was a teaching syllabus rather
than alphabet practice. Two words that cross at a shared letter is a whole puzzle, and for a
beginner it is arguably the right size of one. It is also what made five reachable at all:

    words per level    smallest wheel that fits every word
    three or more      seven (a hard six costs 34 words and loses ঔ entirely)
    two or more        five

The three-akshara cap costs 21 words outright, because a word that long cannot be shortened -
it can only be dropped. চকলেট, খরগোশ, ফুটবল, নারকেল, মাকড়সা and 16 others went that way. The
alphabet did not suffer for it: all 57 units are still taught.

Each level is partitioned - into as many small levels as its words need, not just two - and
every part must come in under both caps. A letter may carry as many levels as it takes.

Choosing between candidate partitions, in this order:
  - keep the most of the level's original words;
  - keep the most aksharas that appear on no other board, because losing the game's only
    হো word means হো is no longer taught anywhere - a curriculum hole, not just a lost word;
  - then the fewest parts, so a level is not atomised when it did not need to be;
  - then the smallest wheels.

Every word must still start with the level's akshara (or its letter, for a `letter` level),
so a fix can never quietly change what a level teaches.
"""
import functools
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

# And no word longer than three aksharas - three tiles to place, so three chances to be wrong.
# This is a separate limit from the ring and it binds differently: the ring is how much there
# is to choose from, this is how long the answer is. চকলেট is four tiles on a four-letter ring,
# which is not a puzzle so much as a queue.
MAX_AKSHARAS = 3

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


@functools.lru_cache(maxsize=None)
def board_fits(words):
    occupied, _, _ = cluster_layout(list(words), max_rows=MAX_ROWS, max_cols=MAX_COLS)
    rows = max(r for r, _ in occupied) + 1
    cols = max(c for _, c in occupied) + 1
    return rows <= MAX_ROWS and cols <= MAX_COLS


# Cached because the same handful of word groups come back over and over. The partition search
# reaches the group {আট, আঠা} from every ordering that puts those two together, and each visit
# used to re-run `cluster_layout` - a real board placer, not a cheap test. Memoising it is what
# takes a seven-word level from minutes to milliseconds.
@functools.lru_cache(maxsize=None)
def _legal(words, cap):
    """A word list that could ship as a level: wheel, board, and the ring not being the answer."""
    if len(words) < MIN_WORDS or len(set(words)) != len(words):
        return False
    if any(len(split_aksharas(w)) > MAX_AKSHARAS for w in words):
        return False
    tiles = wheel_for(list(words))
    if not FLOOR <= len(tiles) <= cap:
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


def legal(words, cap=CAP):
    """A word list that could ship as a level. Order does not matter, so the key is sorted."""
    return _legal(tuple(sorted(words)), cap)


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


@functools.lru_cache(maxsize=None)
def _wheel_size(words):
    return len(wheel_for(list(words)))


def partitions(items, min_size, cap=CAP):
    """
    Every way to split a list into groups of at least `min_size`, smallest count first.

    Pruned on the wheel, which is what makes this usable. The number of partitions of n items
    is the Bell number - 115,975 for ten - and once the word-length rule pulled seven-word
    levels into the solver's caseload, generating them all and filtering afterwards took minutes
    per level. A group's wheel only ever grows as words are added to it, so a group already
    over the cap can be abandoned rather than completed: that is a sound prune, not a heuristic,
    and it collapses the tree to something that runs in milliseconds.
    """
    def walk(rest, groups):
        if not rest:
            yield groups
            return
        head, tail = rest[0], rest[1:]
        for i, g in enumerate(groups):                       # put it with an existing group
            grown = g + [head]
            if _wheel_size(tuple(sorted(grown))) > cap:
                continue
            yield from walk(tail, groups[:i] + [grown] + groups[i + 1:])
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


def solve(level, borrowable, precious, cap=CAP):
    """
    The best way to cut one level into parts that each fit a `cap`-letter ring.

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
                    for groups in partitions(keep, MIN_WORDS, cap):
                        if not all(legal(g, cap) for g in groups):
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

    def needs_work(lv):
        words = [w['w'] for w in lv['words']]
        return (len(wheel_for(words)) > CAP
                or any(len(split_aksharas(w)) > MAX_AKSHARAS for w in words))

    over = [lv for lv in _AUTHORED if needs_work(lv)]
    print(f'{len(over)} of {len(_AUTHORED)} levels need work: a ring over {CAP} letters, '
          f'or a word over {MAX_AKSHARAS} aksharas\n')

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
            'name': 'What the wheel cap and the word-length cap forced, level by level',
            'WHY_THIS_FILE_EXISTS': [
                'Two limits shape a level: at most five letters on the ring, and no word longer',
                'than three aksharas. Levels that break either are repaired here rather than in',
                'levels.json - which is kept exactly as it arrived, so it stays clear which',
                'levels came from where - and catalogue.py applies these on load.',
                '',
                'Generated by tools/refit.py; re-run it to regenerate. Do not hand-edit.',
            ],
            'fixes': fixes,
        }, ensure_ascii=False, indent=1), encoding='utf-8')
        print(f'\nwrote {out.relative_to(out.parent.parent)}')
    return 0


if __name__ == '__main__':
    sys.exit(main('--write' in sys.argv))
