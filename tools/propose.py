# -*- coding: utf-8 -*-
"""
Authoring aid: propose tile sets for a given stage of the syllabus.

The catalogue is hand-picked, and this is what it is picked *from*. Given a block of the
syllabus it searches the curated vocabulary for tile sets that spell three or more words,
use every tile, and lay out as a legal crossword - then prints them for a person to choose
between. It never writes a level.

    python3 tools/propose.py 1              plain letters
    python3 tools/propose.py 2 --kar া      one vowel sign, that sign
    python3 tools/propose.py 4 --new ন্ত    conjuncts, introducing that cluster
    python3 tools/propose.py 3 --theme food

Only tile sets whose words *all* belong to the requested block are offered, which is the
whole point: a block-2 level containing a stray second vowel sign is not a block-2 level.
"""
import itertools
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))

from bangla import grid_size, layout, spellable, split_aksharas, stray_runs   # noqa: E402
from curriculum import (BLOCK_CONJUNCT, BLOCKS, block_for, conjuncts_in,       # noqa: E402
                        kars_in)
from vocabulary import words as pool_words                                    # noqa: E402
from wordpool import zipf                                                     # noqa: E402

MAX_ROWS, MAX_COLS = 8, 9
MIN_WORDS = 3


def eligible(vocabulary, block, kar=None, cluster=None):
    """
    Words a level in this block may use. Block 2 levels take one vowel sign, so a word is
    eligible only if every sign it carries is that one; block 4 levels are anchored on a
    single new cluster.
    """
    out = []
    for w in vocabulary:
        if block_for([w]) > block:
            continue                                   # needs something not taught yet
        signs = {s for _, s in kars_in([w])}
        if kar is not None and not signs <= {kar}:
            continue
        clusters = {s for _, s in conjuncts_in([w])}
        if block == BLOCK_CONJUNCT and cluster is not None and not clusters <= {cluster}:
            continue
        out.append(w)
    return out


def placeable(words):
    """Does this word list lay out as a legal board? Returns the board, or None."""
    placed = layout(words)
    if not placed:
        return None
    rows, cols = grid_size(placed[0])
    if rows > MAX_ROWS or cols > MAX_COLS:
        return None
    if stray_runs(placed[0], words):
        return None
    return placed[0]


def neighbours(vocabulary):
    """
    Which aksharas share a word with which. A tile set only makes a crossword if its tiles
    actually co-occur in real words, so this is the map the search walks instead of trying
    every combination of every akshara - which is the difference between seconds and hours.
    """
    near = {}
    for word in vocabulary:
        aksharas = split_aksharas(word)
        for a in aksharas:
            near.setdefault(a, set()).update(aksharas)
    return near


def propose(vocabulary, block, sizes=(3, 4), kar=None, cluster=None):
    """
    Tile sets of `sizes` tiles that spell at least three eligible words, use every tile, and
    place legally, wordiest first - a wordier set gives the catalogue more room to grow a
    board later.

    Each candidate grows out of a seed word, so every set offered is guaranteed to spell at
    least that word. When a sign or cluster is named, only words carrying it seed the search:
    the point of a block-2 level is to put one vowel sign in front of the learner, and a set
    that never uses it is useless for authoring even though it is legal for the block.
    """
    usable = eligible(vocabulary, block, kar, cluster)
    target = kar or cluster
    seeds = [w for w in usable if target is None or target in w]
    near = neighbours(usable)

    seen, out = set(), []
    for seed in seeds:
        core = split_aksharas(seed)
        pool = sorted(set().union(*(near[a] for a in core)) - set(core))
        for size in sizes:
            spare = size - len(core)
            if spare < 0:
                continue
            for extra in itertools.combinations(pool, spare):
                tiles = sorted(set(core) | set(extra))
                if len(tiles) != size:
                    continue
                signature = frozenset(tiles)
                if signature in seen:
                    continue
                seen.add(signature)

                found = [w for w in usable if spellable(w, tiles)]
                if len(found) < MIN_WORDS:
                    continue
                if {a for w in found for a in split_aksharas(w)} != set(tiles):
                    continue                           # a tile no word can spend
                found.sort(key=lambda w: (-len(split_aksharas(w)), -zipf(w), w))
                if placeable(found[:6]) is None:
                    continue
                out.append((tiles, found))

    out.sort(key=lambda t: (len(t[0]), -len(t[1]), t[1]))
    return out


def main(argv):
    if not argv or not argv[0].isdigit() or int(argv[0]) not in BLOCKS:
        print(__doc__)
        return 2

    block = int(argv[0])
    kar = cluster = theme = None
    for i, arg in enumerate(argv):
        if arg == '--kar' and i + 1 < len(argv):
            kar = argv[i + 1]
        if arg == '--new' and i + 1 < len(argv):
            cluster = argv[i + 1]
        if arg == '--theme' and i + 1 < len(argv):
            theme = argv[i + 1]

    vocabulary = pool_words(theme) if theme else pool_words()
    # The later blocks need wider boards: a conjunct word plus enough companions to cross it
    # rarely fits in three tiles.
    sizes = (3, 4, 5) if block >= BLOCK_CONJUNCT else (3, 4)
    found = propose(vocabulary, block, sizes=sizes, kar=kar, cluster=cluster)

    info = BLOCKS[block]
    extra = f", sign {kar}" if kar else (f", cluster {cluster}" if cluster else '')
    print(f'block {block}: {info["name"]}{extra} - {info["goal"]}')
    print(f'{len(found)} placeable tile sets from {len(vocabulary)} pooled words\n')
    for tiles, words in found:
        print(f'  {len(tiles)} tiles [{" ".join(tiles)}]  '
              f'{len(words)} words: {" ".join(words)}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
