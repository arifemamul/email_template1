#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Turn the guide's own words into levels.

    python3 tools/guide_levels.py            print what it would do, change nothing
    python3 tools/guide_levels.py --write    write tools/levels-guide.json

The app shows a child far more Bengali than it lets them play. Beside the 609 words on boards
there are another 614 in the guide: the শব্দ গড়া sums out of a printed primer, the words listed
under each কার, one for every ফলা form and every যুক্তবর্ণ, and the বারোখড়ি's fillers. A child
reads those, and then cannot spell any of them. This makes levels out of the ones that fit.

WHAT "FITS" MEANS. Exactly what `catalogue.validate` already means by it, so nothing here can
invent a level the rest of the pipeline would refuse:

    two to five words        MIN_WORDS, and five is as many as one first-akshara run supports
    three to five tiles      MIN_TILES to MAX_TILES - the ring is the difficulty
    two or three aksharas    a single-akshara word is not a puzzle; four is too long a queue
    all from one akshara     an akshara level's whole teaching claim is that its words share
                             their first akshara. Where that strands a word - বীজ is the only
                             drawable বী word in the guide - the catalogue's other kind of
                             level takes it: `type: letter` makes the weaker claim of the same
                             base letter under any vowel sign, which is how levels-oi.json
                             reaches তৈরি beside তাঁতি. So: akshara levels first, then a
                             letter level over whatever they left
    a connected board        laid out by the same `cluster_layout` the game uses, inside
                             5 x 7, spelling nothing but its own words
    not already a puzzle     no word is set twice, which is checked for the whole catalogue

AND A PICTURE HAS TO BE ABLE TO SHOW IT. That is tools/vocabulary.py's rule for a board word -
"a word a picture could replace - concrete, or a number or colour" - and it is the one the
guide's words fail, because they were chosen to ILLUSTRATE A FORM instead: the যুক্তবর্ণ table
needs an example of ম্ল whether or not anything can be drawn for অম্ল. So a word is set only
if guide-glosses.json names the picture for it, and that string ships as the level's `flag`,
which is what an illustrator reads. Of the 587 words that fit mechanically, 102 pass this.

It is the strictest of the filters by a long way and it is the right one: without it the game
gains 419 words of which two thirds are অবস্থা, নিষ্ঠা, বিভাজ্য and স্নাতক - real Bengali, in
a game whose whole reward is recognising the thing you just spelled.

The words that do not fit are left where they are. They stay in the guide, which is what they
were for.
"""
import collections
import itertools
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from bangla import split_aksharas, wheel_for                       # noqa: E402
# The wheel is scrambled so no answer is spelled out in ring order, and on a small ring no
# such arrangement may exist. That is a shipping constraint like any other - `check` refuses a
# level that fails it - so it is asked here rather than discovered later: a three-tile level
# holding ঝঞ্ঝা and ঝঞ্ঝাট was the one this caught.
from build import ring_can_hide                                    # noqa: E402
from catalogue import (ALL_LEVELS, MAX_TILES, MIN_TILES, MIN_WORDS,  # noqa: E402
                       validate)
from vocabulary import REJECTED                                    # noqa: E402
from wordpool import zipf                                          # noqa: E402

OUT = HERE / 'levels-guide.json'
GLOSSES = HERE / 'guide-glosses.json'

# As many words as one first-akshara run can hold. Every word on the level begins with the same
# akshara, so they can only ever cross there - and `cluster_layout` allows islands for exactly
# that reason. Five is where the ring cap bites anyway.
MAX_WORDS = 5

# Three is the game's own floor for a board word (`thin:` in the check report lists the three
# authored words that sit under it). Nothing is dropped for being under it - a rare word is
# still a real one - but the report leads with them.
THIN = 3.0


def guide_words():
    """Every word the guide shows, with the section it appears in."""
    primer = json.loads((HERE / 'primer.json').read_text(encoding='utf-8'))
    kar = json.loads((HERE / 'kar-words.json').read_text(encoding='utf-8'))

    # English, and written by hand: every board word in this catalogue carries a gloss,
    # because it is what an illustrator draws from. primer.json has none at all, and
    # kar-words.json glosses in Bengali because the table it feeds is Bengali - so neither can
    # supply this. See guide-glosses.json.
    written = (json.loads(GLOSSES.read_text(encoding='utf-8'))
               if GLOSSES.exists() else {'glosses': {}, 'pictures': {}})
    gloss, picture = written['glosses'], written.get('pictures', {})
    where = {}
    for parts in primer['no_kar']['two'] + primer['no_kar']['three']:
        where.setdefault(''.join(parts), 'শব্দ গড়া')
    for words in primer['by_kar'].values():
        for w in words:
            where.setdefault(w, 'কার')
    for row in primer['phala']['list']:
        for w in row.get('words', []):
            where.setdefault(w, 'ফলা')
    for row in primer['jukto']['rows']:
        for w in row.get('words', []):
            where.setdefault(w, 'যুক্তবর্ণ')
    for entry in kar['words'].values():
        where.setdefault(entry['w'], 'বারোখড়ি')
    return where, gloss, picture


def refused(word, on_board, picture):
    """Why this word cannot be a board word, or None."""
    n = len(split_aksharas(word))
    if word in on_board:
        return 'already a puzzle'
    if word not in picture:
        return 'no picture can show it'
    if n < 2:
        return 'a single akshara'
    if n > 3:
        return f'{n} aksharas'
    if word in REJECTED:
        return f'rejected: {REJECTED[word]}'
    return None


def twins_can_separate(tiles):
    """
    Can the ring be arranged with no repeated tile beside its own twin?

    A word like থুথু needs two থু tiles, and the scrambler keeps them apart so the wheel does
    not draw the answer. On a ring of n tiles a tile appearing k times can be spread out only
    when k is at most n // 2 - so তু থু থু, three tiles with থু twice, has no arrangement at
    all: every pair on a three-ring is adjacent. That level reached the built page and only
    `wheeltest` caught it, which is a check that runs four minutes after this one could have.
    """
    counts = collections.Counter(tiles)
    return max(counts.values()) <= len(tiles) // 2


def score(words):
    """A better level first: more words, commoner words, a smaller ring."""
    return (len(words), sum(zipf(w) for w in words) / len(words), -len(wheel_for(words)))


def levels_for(key, pool, kind='akshara'):
    """
    Every level one akshara's words can make, taking the best group each time.

    Greedy, and re-scored after each take rather than partitioned once: the aim is to place as
    many words as possible, and a word left over is a word that stays unplayable. Combinations
    are capped at five from a pool that can run to thirty, which is what keeps this from
    becoming a search - the ring cap rejects almost all of them anyway.
    """
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


def existing():
    """
    The catalogue as it is without this file's own output.

    `catalogue.ALL_LEVELS` includes levels-guide.json once it exists, so reading it whole makes
    the generator see its own words as already set and produce nothing the second time. Its ids
    are excluded too, or a re-run would number around itself and drift. Filtered from the
    post-refit levels rather than from the JSON on disk, because refit can drop a word - and a
    word refit dropped is free to be used here.
    """
    mine = set()
    if OUT.exists():
        mine = {lv['id'] for lv in json.loads(OUT.read_text(encoding='utf-8'))['levels']}
    return [lv for lv in ALL_LEVELS if lv['id'] not in mine]


def build():
    where, gloss, picture = guide_words()
    others = existing()
    on_board = {w['w'] for lv in others for w in lv['words']}
    taken = {lv['id'] for lv in others}

    eligible, left_out = {}, {}
    for word, section in where.items():
        why = refused(word, on_board, picture)
        if why:
            if word not in on_board:
                left_out[word] = why
        else:
            eligible[word] = section

    by_first = {}
    for word in eligible:
        by_first.setdefault(split_aksharas(word)[0], []).append(word)

    def next_id(akshara):
        if akshara not in taken:
            taken.add(akshara)
            return akshara
        n = 2
        while f'{akshara}·{n}' in taken:
            n += 1
        taken.add(f'{akshara}·{n}')
        return f'{akshara}·{n}'

    def entry(word):
        return {'w': word, 'split': split_aksharas(word), 'en': gloss.get(word, ''),
                'freq': round(zipf(word), 2), 'flag': picture[word], 'from': where[word]}

    levels, over = [], {}
    for akshara in sorted(by_first):
        made, left = levels_for(akshara, sorted(by_first[akshara]))
        for words in made:
            levels.append({'id': next_id(akshara), 'type': 'akshara', 'key': akshara,
                           'words': [entry(w) for w in words]})
        for w in left:
            over.setdefault(akshara[0], []).append(w)

    # Second pass, over what the first left behind: same base letter, any vowel sign. বীজ is
    # the only drawable বী word in the guide and would be stranded by itself; as a ব level it
    # sits beside বৃষ্টি and বৈঠা.
    def next_letter_id(letter):
        n = 1
        while f'{letter}-{n}' in taken:
            n += 1
        taken.add(f'{letter}-{n}')
        return f'{letter}-{n}'

    stranded = {}
    for letter in sorted(over):
        made, left = levels_for(letter, sorted(over[letter]), kind='letter')
        for words in made:
            levels.append({'id': next_letter_id(letter), 'type': 'letter', 'key': letter,
                           'words': [entry(w) for w in words]})
        for w in left:
            stranded[w] = ('the only word left that a picture can show and that starts with '
                           f'{letter}')
    return levels, eligible, left_out, stranded, gloss


def main(argv):
    levels, eligible, left_out, stranded, gloss = build()  # noqa: F841
    placed = [w['w'] for lv in levels for w in lv['words']]

    print(f'{len(eligible)} of the guide\'s words could be board words; '
          f'{len(levels)} levels place {len(placed)} of them\n')

    from collections import Counter
    print('by section:', dict(Counter(w['from'] for lv in levels for w in lv['words'])))
    print('board sizes:', dict(sorted(Counter(len(lv['words']) for lv in levels).items())))
    print(f'\nwithout a gloss: {sum(1 for w in placed if not gloss.get(w))} of {len(placed)}')

    thin = sorted((w for w in placed if zipf(w) < THIN), key=zipf)
    print(f'\nthin: {len(thin)} placed words are rarer than {THIN} in the corpus. A word that '
          f'fits is not\n      the same as a word worth setting - read these before shipping:')
    for w in thin[:20]:
        print(f'        {w:14} {zipf(w):.2f}')
    if len(thin) > 20:
        print(f'        ... and {len(thin) - 20} more')

    print(f'\nleft where they are: {len(left_out)} cannot be board words, '
          f'{len(stranded)} have no partner')
    for why, n in Counter(left_out.values()).most_common(6):
        print(f'   {why[:44]:46} {n}')

    if '--write' in argv:
        OUT.write_text(json.dumps({
            'name': 'Levels built from the words the guide already shows',
            'WHY_THIS_FILE_EXISTS':
                'The app showed 614 Bengali words it would not let a child spell: the শব্দ গড়া '
                'sums, the words under each কার, one per ফলা and যুক্তবর্ণ form, and the '
                'বারোখড়ি fillers. Generated by tools/guide_levels.py, which places every one '
                'of them that satisfies catalogue.validate and leaves the rest in the guide.',
            'READ_THE_THIN_LIST':
                'These words were chosen to illustrate a form, not to be a puzzle. The '
                'generator ranks by corpus frequency and reports the rarest it placed; a word '
                'that is real and legal can still be wrong for a five-year-old. Move any such '
                'word into REJECTED in tools/vocabulary.py and re-run with --write.',
            'counts': {'levels': len(levels), 'words': len(placed),
                       'left_in_the_guide': len(left_out) + len(stranded)},
            'levels': levels,
            'left_in_the_guide': dict(sorted({**left_out, **stranded}.items())),
        }, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
        print(f'\nwrote {OUT.relative_to(HERE.parent)}')
    else:
        print('\nnothing written; pass --write')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
