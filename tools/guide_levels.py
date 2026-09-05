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
    common enough to meet    at or above the corpus floor the game's own words sit at

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
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

# Every rule about what a level may be lives in levelgen.py, which both generators share.
from levelgen import FLOOR, catalogue_without, place, unfit        # noqa: E402
from wordpool import zipf                                          # noqa: E402

OUT = HERE / 'levels-guide.json'
GLOSSES = HERE / 'guide-glosses.json'

# As many words as one first-akshara run can hold. Every word on the level begins with the same
# akshara, so they can only ever cross there - and `cluster_layout` allows islands for exactly
# that reason. Five is where the ring cap bites anyway.
MAX_WORDS = 5

# The corpus floor. `check` reports three authored words that sit under it and lets them ship,
# because each was chosen by hand for a reason written down beside it. Nothing here was chosen
# by hand, so nothing here gets that benefit: a word under the floor is refused outright.
#
# It costs seven words, all of them genuinely drawable - বল্গা a rein, শৃগাল a jackal, বহ্নি
# fire, মাণিক্য a ruby, কুঞ্জ a bower, পালঙ্ক a bedstead, ধূপ incense. Drawable is not the same
# as met: a child who has never heard বল্গা learns nothing from spelling it, and the picture
# only teaches them what a rein is, which is a vocabulary lesson this game is not for.
FLOOR = 3.0


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
    """Why this word cannot be a board word, or None. The picture rule is the guide's own."""
    if word not in picture and word not in on_board:
        return 'no picture can show it'
    return unfit(word, on_board)


def build():
    where, gloss, picture = guide_words()
    on_board = {w['w'] for lv in catalogue_without(OUT) for w in lv['words']}

    eligible, left_out = {}, {}
    for word, section in where.items():
        why = refused(word, on_board, picture)
        if why:
            if word not in on_board:
                left_out[word] = why
        else:
            eligible[word] = section

    levels, stranded = place(
        eligible, OUT,
        lambda w: {'en': gloss.get(w, ''), 'flag': picture[w], 'from': where[w]})
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

    rarest = sorted(placed, key=zipf)[:6]
    print(f'\nfloor: nothing under {FLOOR}, and the rarest placed are')
    for w in rarest:
        print(f'        {w:14} {zipf(w):.2f}')

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
