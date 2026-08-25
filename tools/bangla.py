# -*- coding: utf-8 -*-
"""
Bengali text handling and crossword placement, mirroring the game's own logic.

These two algorithms exist three times: here, in `logic/BanglaText.kt` +
`logic/CrosswordGenerator.kt` for Android, and in the `<script>` of `docs/index.html` for the
web. That is deliberate - the authoring tools have to reason about levels exactly the way the
game will lay them out, or a level can validate here and break on a phone.

The three copies are kept honest by regenerating both builds from `catalogue.py` and then
diffing the generated boards; see tools/README.md.
"""

import itertools

HASANTA = '্'          # virama: glues the next consonant into a conjunct

# Signs that hang off the preceding consonant rather than standing on their own.
COMBINING = frozenset([
    'ঁ',  # ঁ chandrabindu
    'ং',  # ং anusvara
    'ঃ',  # ঃ visarga
    '়',  # ় nukta
    'া', 'ি', 'ী', 'ু', 'ূ', 'ৃ', 'ৄ',
    'ে', 'ৈ', 'ো', 'ৌ', 'ৗ', 'ৢ', 'ৣ',
    HASANTA,
])


def split_aksharas(word):
    """
    Split a word into aksharas - the letter units a Bengali reader sees, and what the game
    puts on a tile. মাছ is two units (মা + ছ); বন্ধু is two (ব + ন্ধু).
    """
    units, cur, join_next = [], '', False
    for c in word:
        if c.isspace():
            continue
        if c in COMBINING:
            cur += c
            join_next = (c == HASANTA)
        elif join_next:
            cur += c
            join_next = False
        else:
            if cur:
                units.append(cur)
            cur = c
    if cur:
        units.append(cur)
    return units


def spellable(word, tiles):
    """True when `word` can be spelled from `tiles` using each tile at most once."""
    pool = list(tiles)
    for unit in split_aksharas(word):
        if unit not in pool:
            return False
        pool.remove(unit)
    return True


def tiles_for(words):
    """
    The wheel for a level: the union of its words' aksharas, longest word first.
    Deriving tiles this way means every tile is always usable by some word, so a level can
    never ship a letter the player has nothing to do with.
    """
    seen = []
    for w in sorted(words, key=lambda x: -len(split_aksharas(x))):
        for a in split_aksharas(w):
            if a not in seen:
                seen.append(a)
    return seen


def wheel_for(words):
    """
    The wheel for a level, with a tile repeated when a word needs it twice.

    `tiles_for` returns each akshara once, which is right until a word says the same one
    twice: কুকুর is কু + কু + র, and ঘুঘু is ঘু + ঘু. One tile cannot spell those, because a
    tile is used up as the drag passes through it.

    Two tiles can. The alternative - letting a drag re-enter a tile it has already used -
    collides with both gestures the wheel already has: dragging back onto the previous tile
    undoes it, and tapping the last tile again undoes it too, so tapping ঘু twice would mean
    both "double it" and "cancel it". A second tile has no such ambiguity, and ঘু ঘু is a
    clearer thing to ask a child to trace than leaving a tile and coming back to it.

    Order follows `tiles_for`, with each repeat sitting straight after the tile it copies.
    """
    need = {}
    for w in words:
        counts = {}
        for a in split_aksharas(w):
            counts[a] = counts.get(a, 0) + 1
        for a, n in counts.items():
            need[a] = max(need.get(a, 0), n)
    out = []
    for a in tiles_for(words):
        out += [a] * need[a]
    return out


def conjunct_tiles(tiles):
    return [t for t in tiles if HASANTA in t]


# -- crossword placement -----------------------------------------------------------------
# Same rules as CrosswordGenerator.kt: every word after the first must cross an existing
# akshara, may not butt end-to-end against another word, and a new letter may not sit
# side-on against an unrelated word (which would spell something the player cannot solve).

def cells_for(start, horizontal, length):
    r, c = start
    return [(r, c + i) if horizontal else (r + i, c) for i in range(length)]


def score_placement(occupied, aksharas, start, horizontal):
    """Crossings for a legal placement, or None when the placement is illegal."""
    d = (0, 1) if horizontal else (1, 0)
    perp = (1, 0) if horizontal else (0, 1)
    r, c = start
    n = len(aksharas)

    if (r - d[0], c - d[1]) in occupied or (r + d[0] * n, c + d[1] * n) in occupied:
        return None

    crossings = 0
    for i, a in enumerate(aksharas):
        pos = (r + d[0] * i, c + d[1] * i)
        existing = occupied.get(pos)
        if existing is not None:
            if existing != a:
                return None
            crossings += 1
        elif ((pos[0] + perp[0], pos[1] + perp[1]) in occupied
              or (pos[0] - perp[0], pos[1] - perp[1]) in occupied):
            return None

    if crossings == 0 or crossings == n:
        return None
    return crossings


def _extent(occupied, extra):
    """(rows, rows * cols) of the board once `extra` is added."""
    points = list(occupied.keys()) + list(extra)
    rows = [p[0] for p in points]
    cols = [p[1] for p in points]
    height = max(rows) - min(rows) + 1
    return height, height * (max(cols) - min(cols) + 1)


def candidates(occupied, aksharas):
    """
    Legal placements, most crossings first, then shallowest board. Rows outrank total area
    because the board sits above the letter wheel on a portrait screen: vertical space is
    what runs out, so a wide, shallow board keeps cells big enough to read.
    """
    scored = {}
    for anchor, letter in sorted(occupied.items()):
        for index, a in enumerate(aksharas):
            if a != letter:
                continue
            for horizontal in (True, False):
                start = ((anchor[0], anchor[1] - index) if horizontal
                         else (anchor[0] - index, anchor[1]))
                key = (start, horizontal)
                if key in scored:
                    continue
                crossings = score_placement(occupied, aksharas, start, horizontal)
                if crossings is None:
                    continue
                rows, area = _extent(occupied, cells_for(start, horizontal, len(aksharas)))
                scored[key] = (crossings, rows, area)

    return [k for k, _ in sorted(
        scored.items(),
        key=lambda kv: (-kv[1][0], kv[1][1], kv[1][2], kv[0][0][0], kv[0][0][1], not kv[0][1]))]


NODE_LIMIT = 60_000


def layout(words):
    """
    Lay the words out as a connected crossword, backtracking over both word order and
    placement. Returns (occupied, placed) or None when no arrangement exists.

    Greedy placement is not enough: an early choice can strand a later word. Some word sets
    have no arrangement at all: only two words can pass through one cell, so three words whose
    only shared letter is the same akshara cannot all be placed. চার / কার / চাবি / চাকা fails
    that way - চার, চাবি and চাকা meet only at চা.
    """
    tokens = sorted(((w, split_aksharas(w)) for w in words),
                    key=lambda t: (-len(t[1]), t[0]))
    if not tokens:
        return None

    for seed in range(len(tokens)):
        order = [tokens[seed]] + [t for i, t in enumerate(tokens) if i != seed]
        occupied, placed = {}, []
        first_word, first_aks = order[0]
        for i, a in enumerate(first_aks):
            occupied[(0, i)] = a
        placed.append((first_word, cells_for((0, 0), True, len(first_aks))))
        nodes = [0]

        def solve(index):
            if index == len(order):
                return True
            nodes[0] += 1
            if nodes[0] > NODE_LIMIT:
                return False
            word, aksharas = order[index]
            for start, horizontal in candidates(occupied, aksharas):
                cells = cells_for(start, horizontal, len(aksharas))
                added = [c for c in cells if c not in occupied]
                for i, pos in enumerate(cells):
                    occupied[pos] = aksharas[i]
                placed.append((word, cells))
                if solve(index + 1):
                    return True
                placed.pop()
                for c in added:
                    del occupied[c]
            return False

        if solve(1):
            return occupied, placed
    return None


def cluster_layout(words, max_rows=8, max_cols=9):
    """
    Lay the words out allowing the board to be more than one island.

    `layout` above insists on a single connected crossword, and that rules out most of the
    curriculum. A level keyed on an akshara has every word starting with it - কাক কাঠ কান কাচ
    কাপ - so the only cell any two of them can share is the key, and a cell takes at most two
    words. Six such words cannot connect, and 73 of the 118 levels share exactly one akshara.

    So words cross wherever they share a letter, and a word that can cross nothing starts a
    new island two rows below, which leaves the blank row that keeps the two from reading as
    one. Fewest islands wins, then the shallowest board, then the smallest - the board sits
    above the wheel on a portrait screen, so height is what runs out.

    Deterministic, and simple enough to be reimplemented exactly in the page: no randomness,
    just each word taken as the starting one in turn and the best result kept. Returns
    (occupied, placed, islands).
    """
    tokens = sorted(((w, split_aksharas(w)) for w in words),
                    key=lambda t: (-len(t[1]), t[0]))
    if not tokens:
        return None

    # Every ordering of the words, not a handful of them. The order words are placed in
    # decides the shape, and a heuristic misses good shapes: two orderings left বা at six rows
    # by six when a 3x6 board exists for the same seven words - and because a box is sized for
    # the largest board in the game, that one level was costing every level a smaller box.
    #
    # No level has more than seven words, so this is at most 5040 arrangements, and it runs at
    # build time rather than in the page: the boards are emitted into the page ready-made.
    best = None
    for order in itertools.permutations(tokens):
        occupied, placed = {}, []
        islands = 1
        first_word, first_aks = order[0]
        for i, a in enumerate(first_aks):
            occupied[(0, i)] = a
        placed.append((first_word, cells_for((0, 0), True, len(first_aks))))

        for word, aksharas in order[1:]:
            spots = candidates(occupied, aksharas)
            # Prefer a crossing that keeps the board inside its limits. `candidates` ranks by
            # crossings first, which is right for a tight board and wrong for a sprawling one.
            if spots:
                inside = []
                for at, horiz in spots:
                    rows_, area_ = _extent(occupied, cells_for(at, horiz, len(aksharas)))
                    cols_ = area_ // rows_ if rows_ else 0
                    if rows_ <= max_rows and cols_ <= max_cols:
                        inside.append((at, horiz))
                spots = inside or spots
            if spots:
                start, horizontal = spots[0]
            else:
                # A new island goes below the board or beside it, whichever leaves it
                # shallower, with two rows or columns clear so the gap keeps the islands from
                # reading as one word.
                low = (max(p[0] for p in occupied) + 2, min(p[1] for p in occupied))
                side = (min(p[0] for p in occupied), max(p[1] for p in occupied) + 2)
                options = []
                for at in (low, side):
                    rows_, area_ = _extent(occupied, cells_for(at, True, len(aksharas)))
                    cols_ = area_ // rows_ if rows_ else 0
                    over = (rows_ > max_rows) + (cols_ > max_cols)
                    options.append(((over, rows_, area_, at[0], at[1]), at))
                start, horizontal = min(options)[1], True
                islands += 1
            cells = cells_for(start, horizontal, len(aksharas))
            for i, pos in enumerate(cells):
                occupied[pos] = aksharas[i]
            placed.append((word, cells))

        rows, cols = grid_size(occupied)
        if stray_runs(occupied, [w for w, _ in order]):
            continue
        # Inside the limits first - the largest board sets the box size for every level. Then
        # rows, because the board sits above the wheel and height is the scarce direction.
        over = max(0, rows - max_rows) + max(0, cols - max_cols)
        rank = (over, rows, islands, rows * cols, tuple(w for w, _ in order))
        if best is None or rank < best[0]:
            best = (rank, occupied, placed, islands)

    if best is None:
        return None

    _, occupied, placed, islands = best
    min_r = min(p[0] for p in occupied)
    min_c = min(p[1] for p in occupied)
    if (min_r, min_c) != (0, 0):
        occupied = {(r - min_r, c - min_c): a for (r, c), a in occupied.items()}
        placed = [(w, [(r - min_r, c - min_c) for r, c in cells]) for w, cells in placed]
    return occupied, placed, islands


def grid_size(occupied):
    rows = [p[0] for p in occupied]
    cols = [p[1] for p in occupied]
    return max(rows) - min(rows) + 1, max(cols) - min(cols) + 1


def render(occupied):
    """The board as text, for eyeballing a level in a terminal."""
    min_r, max_r = min(p[0] for p in occupied), max(p[0] for p in occupied)
    min_c, max_c = min(p[1] for p in occupied), max(p[1] for p in occupied)
    return '\n'.join(
        ' '.join(occupied.get((r, c), '.').ljust(2) for c in range(min_c, max_c + 1))
        for r in range(min_r, max_r + 1))


def stray_runs(occupied, expected):
    """
    Horizontal and vertical runs of two or more cells that are not one of the level's words.
    Any such run is a word on the board the player has no way to solve.
    """
    rows = [p[0] for p in occupied]
    cols = [p[1] for p in occupied]
    min_r, max_r, min_c, max_c = min(rows), max(rows), min(cols), max(cols)
    runs = []

    def sweep(outer, inner, at):
        for a in outer:
            current = []
            for b in list(inner) + [None]:
                letter = None if b is None else at(a, b)
                if letter is None:
                    if len(current) >= 2:
                        runs.append(''.join(current))
                    current = []
                else:
                    current.append(letter)

    sweep(range(min_r, max_r + 1), range(min_c, max_c + 1),
          lambda r, c: occupied.get((r, c)))
    sweep(range(min_c, max_c + 1), range(min_r, max_r + 1),
          lambda c, r: occupied.get((r, c)))
    return [r for r in runs if r not in set(expected)]


if __name__ == '__main__':
    # Self-test: the akshara cases that matter, and one board.
    cases = [
        ('কমল', ['ক', 'ম', 'ল']),
        ('মাছ', ['মা', 'ছ']),
        ('বিদেশ', ['বি', 'দে', 'শ']),
        ('বন্ধু', ['ব', 'ন্ধু']),
        ('রাস্তা', ['রা', 'স্তা']),
        ('বাংলা', ['বাং', 'লা']),
        ('বাড়ি', ['বা', 'ড়ি']),
        ('আমরা', ['আ', 'ম', 'রা']),
    ]
    bad = [(w, got) for w, want in cases if (got := split_aksharas(w)) != want]
    for w, got in bad:
        print(f'FAIL {w} -> {got}')
    words = ['গ্রহ', 'গ্রহণ', 'চন্দ্র', 'চন্দ্রগ্রহণ']
    got = layout(words)
    if not got:
        print('FAIL could not lay out', ' '.join(words))
        bad.append(('layout', None))
    else:
        print(render(got[0]))

    # An akshara-keyed level: every word starts with কা, so no three of them can connect and
    # `layout` has nothing to return. `cluster_layout` places them all as crossing pairs.
    keyed = ['কাক', 'কাঠ', 'কান', 'কাচ', 'কাপ', 'কাঠি']
    if layout(keyed) is not None:
        print('FAIL layout should not connect six words sharing only কা')
        bad.append(('layout-keyed', None))
    occupied, placed, islands = cluster_layout(keyed)
    rows, cols = grid_size(occupied)
    strays = stray_runs(occupied, keyed)
    print()
    print(render(occupied))
    print(f'{islands} islands, {rows}x{cols}')
    if len(placed) != len(keyed):
        print(f'FAIL cluster_layout placed {len(placed)} of {len(keyed)} words')
        bad.append(('cluster-count', None))
    if strays:
        print(f'FAIL cluster_layout left stray words: {strays}')
        bad.append(('cluster-stray', None))
    if min(p[0] for p in occupied) or min(p[1] for p in occupied):
        print('FAIL cluster_layout did not shift the board to the origin')
        bad.append(('cluster-origin', None))
    if cluster_layout(keyed)[0] != occupied:
        print('FAIL cluster_layout is not deterministic')
        bad.append(('cluster-determinism', None))

    print('bangla.py self-test:', 'FAILED' if bad else 'ok')
    raise SystemExit(1 if bad else 0)
