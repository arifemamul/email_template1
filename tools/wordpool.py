# -*- coding: utf-8 -*-
"""
The candidate word pool, drawn from Bengali corpus frequency data.

Why this exists: it is very easy to invent a Bengali compound that reads plausibly and does
not occur in real text. Two such words (বইখাতা, শিশুপাঠ) shipped in an early draft of this
game before this check existed.

The pool is a filter for authoring, never an author. Frequency data alone suggests verb
inflections (করেছেন) and word fragments, which make poor puzzles, so every word that ships is
picked by hand from what this offers.
"""
import pathlib
import pickle

from wordfreq import top_n_list, zipf_frequency

from bangla import split_aksharas, spellable

BENGALI = frozenset(chr(c) for c in range(0x0980, 0x09FF + 1))
CACHE = pathlib.Path(__file__).parent / '.wordpool-cache.pkl'


def is_attested(word, floor=2.0):
    """
    Does this word occur in real Bengali text? `floor` is a Zipf frequency: 2.0 is roughly
    "rare but real", 5.0 is everyday. Below 2.0 treat a word as invented.
    """
    return zipf_frequency(word, 'bn') >= floor


def zipf(word):
    return zipf_frequency(word, 'bn')


def build_pool(min_zipf=2.4, max_aksharas=5, scan=200_000):
    """
    Attested Bengali words a letter wheel can actually spell: 2-`max_aksharas` units, no
    repeated akshara (a tile is only available once), Bengali characters only.
    """
    pool = {}
    for word in top_n_list('bn', scan):
        if not word or any(ch not in BENGALI for ch in word):
            continue                                  # no Latin, digits or punctuation
        aksharas = split_aksharas(word)
        if ''.join(aksharas) != word:
            continue                                  # round-trip guard on odd sequences
        if not 2 <= len(aksharas) <= max_aksharas:
            continue
        if len(set(aksharas)) != len(aksharas):
            continue                                  # cannot spell it from distinct tiles
        z = zipf_frequency(word, 'bn')
        if z < min_zipf:
            continue
        pool[word] = z
    return pool


def cached_pool(**kwargs):
    """Pool building takes a minute or so; keep it on disk between runs."""
    if CACHE.exists():
        try:
            return pickle.loads(CACHE.read_bytes())
        except Exception:
            pass                                      # a stale cache is not worth a crash
    pool = build_pool(**kwargs)
    CACHE.write_bytes(pickle.dumps(pool))
    return pool


def words_from_tiles(pool, tiles, min_zipf=0.0):
    """Every pooled word those tiles can spell, longest and most common first."""
    return sorted(
        (w for w, z in pool.items() if z >= min_zipf and spellable(w, tiles)),
        key=lambda w: (-len(split_aksharas(w)), -pool[w], w))


def discover(spine, floor=3.2):
    """
    Authoring aid: given a candidate spine word, what else can its tiles spell?
    Print the options and pick the ones that are real, ordinary words by hand.
    """
    aksharas = split_aksharas(spine)
    z = zipf(spine)
    if z < 2.0:
        return f'{spine}: unattested (zipf {z:.2f}) - do not use'
    if len(set(aksharas)) != len(aksharas):
        return f'{spine}: repeats an akshara {aksharas} - cannot be spelled from distinct tiles'

    options = [w for w in words_from_tiles(cached_pool(), aksharas, floor) if w != spine]
    head = f'{spine} ({z:.1f})  {len(aksharas)} tiles: {" ".join(aksharas)}'
    if not options:
        return head + '\n   (its tiles spell nothing else attested)'
    return head + '\n   ' + '  '.join(f'{w}({zipf(w):.1f})' for w in options[:24])
