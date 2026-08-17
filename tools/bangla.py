# -*- coding: utf-8 -*-
"""
Bengali text handling and crossword placement, mirroring the game's own logic.

These two algorithms exist three times: here, in `logic/BanglaText.kt` +
`logic/CrosswordGenerator.kt` for Android, and in the `<script>` of `docs/index.html` for the
web. That is deliberate — the authoring tools have to reason about levels exactly the way the
game will lay them out, or a level can validate here and break on a phone.

The three copies are kept honest by regenerating both builds from `catalogue.py` and then
diffing the generated boards; see tools/README.md.
"""

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
    Split a word into aksharas — the letter units a Bengali reader sees, and what the game
    puts on a tile. মাছ is two units (মা · ছ); বন্ধু is two (ব · ন্ধু).
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


def conjunct_tiles(tiles):
    return [t for t in tiles if HASANTA in t]


# ── crossword placement ─────────────────────────────────────────────────────────────────
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
    that way — চার, চাবি and চাকা meet only at চা.
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


def grid_size(occupied):
    rows = [p[0] for p in occupied]
    cols = [p[1] for p in occupied]
    return max(rows) - min(rows) + 1, max(cols) - min(cols) + 1


def render(occupied):
    """The board as text, for eyeballing a level in a terminal."""
    min_r, max_r = min(p[0] for p in occupied), max(p[0] for p in occupied)
    min_c, max_c = min(p[1] for p in occupied), max(p[1] for p in occupied)
    return '\n'.join(
        ' '.join(occupied.get((r, c), '·').ljust(2) for c in range(min_c, max_c + 1))
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
    print('bangla.py self-test:', 'FAILED' if bad else 'ok')
    raise SystemExit(1 if bad else 0)
