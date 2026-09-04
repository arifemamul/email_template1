#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Set the words from the school vocabulary list that the game does not already have.

    python3 tools/vocab_levels.py            print what it would do, change nothing
    python3 tools/vocab_levels.py --write    write tools/levels-vocab.json

tools/word-list-school.json holds the list as it arrived: at least four words for each letter
of the alphabet, the vocabulary taught in Classes 1-3, each with its English meaning. Roughly
half of it was already on a board - which is the answer to "are these in the game?" for those
- and this places what was not.

These words need no picture rule and get none. The guide's words did, because they were chosen
to illustrate a form and most of them cannot be drawn; this list was chosen for children by
someone teaching them, and it reads that way - ঘোড়া, ঘড়ি, ব্যাঙ, চশমা, জাহাজ, ঝুড়ি, বিড়াল,
ময়ূর, সিংহ, গাড়ি, পাহাড়. Ten of its words could not be drawn either - অনেক, ইচ্ছা,
একতা, ঈশ্বর, ঈশান, মহৎ, যাদু, দুঃখ, নিঃস্ব, হঠাৎ - and they were set for one commit before
going into REJECTED in tools/vocabulary.py, which is where a word goes to stop being a puzzle
from any source at all. Nothing here has to know about them.

It also picks up the leftovers. guide_levels.py places its words by first akshara and then by
letter, and thirteen drawable ones still end up alone under their whole letter - গণ্ডার, চক্র,
জীবাশ্ম, মুঠো, তীর. This list runs after it and reaches letters that one could not, so those
thirteen are offered here too and most of them find a partner at last: গণ্ডার with গাড়ি, তীর
with তাঁবু, সহস্র with সিংহ. Nothing is set twice - a word already on a board is excluded by the
same rule that excludes the school list's own duplicates.

Everything else about what a level may be is levelgen.py's, shared with guide_levels.py.
"""
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from levelgen import catalogue_without, place, unfit                 # noqa: E402
from wordpool import zipf                                            # noqa: E402

LIST = HERE / 'word-list-school.json'
GUIDE_GLOSSES = HERE / 'guide-glosses.json'
OUT = HERE / 'levels-vocab.json'

def build():
    listed = json.loads(LIST.read_text(encoding='utf-8'))['words']
    guide = json.loads(GUIDE_GLOSSES.read_text(encoding='utf-8'))
    on_board = {w['w'] for lv in catalogue_without(OUT) for w in lv['words']}

    already = {w: en for w, en in listed.items() if w in on_board}
    eligible, left_out, source = {}, {}, {}
    for word, en in listed.items():
        if word in on_board:
            continue
        why = unfit(word, on_board)
        if why:
            left_out[word] = why
        else:
            eligible[word] = en
            source[word] = 'school list'

    # The drawable guide words guide_levels.py could not place, offered as spares: they may
    # fill a gap the school list leaves but never take a slot from it. See levelgen.place.
    spare = {}
    for word in guide['pictures']:
        if word in on_board or word in eligible or unfit(word, on_board):
            continue
        spare[word] = guide['glosses'].get(word, '')
        source[word] = 'guide'

    def note(word):
        out = {'en': eligible.get(word) or spare.get(word, ''), 'from': source[word]}
        drawing = guide['pictures'].get(word)
        if drawing:
            out['flag'] = drawing
        return out

    levels, stranded = place(eligible, OUT, note, spare=sorted(spare))
    return listed, already, eligible, levels, left_out, stranded, source


def main(argv):
    listed, already, eligible, levels, left_out, stranded, source = build()
    placed = [w['w'] for lv in levels for w in lv['words']]

    from collections import Counter
    print(f'{len(listed)} words on the school list')
    print(f'  {len(already)} were already on a board')
    print(f'  {sum(1 for w in eligible if source[w] == "school list")} of the rest could be set, '
          f'plus {sum(1 for w in source.values() if w == "guide")} spare leftovers '
          f'from the guide')
    print(f'  {len(levels)} levels place {len(placed)}: '
          + ', '.join(f'{k} {v}' for k, v in
                      Counter(source[w] for w in placed).most_common()))

    print('\nboard sizes:', dict(sorted(Counter(len(lv['words']) for lv in levels).items())))
    print('kinds:', dict(Counter(lv['type'] for lv in levels)))

    print(f'\nleft out: {len(left_out)} cannot be board words, {len(stranded)} have no partner')
    for why, n in Counter(left_out.values()).most_common(8):
        print(f'   {why[:44]:46} {n}')
    if stranded:
        print('   ' + ' '.join(sorted(stranded)))

    if '--write' in argv:
        OUT.write_text(json.dumps({
            'name': 'Levels from the school vocabulary list',
            'WHY_THIS_FILE_EXISTS':
                'tools/word-list-school.json arrived as a list of words a primary-school child '
                'is taught, four per letter. Half were already puzzles; these are the levels '
                'built from the rest. Generated by tools/vocab_levels.py.',
            'NO_PICTURE_RULE_HERE':
                'guide_levels.py sets only words a picture can show, because the guide\'s words '
                'were chosen to illustrate a form. This list was chosen for children and needs '
                'no such filter. The ten abstractions it did contain - অনেক, ইচ্ছা, একতা, '
                'ঈশ্বর, ঈশান, মহৎ, যাদু, দুঃখ, নিঃস্ব, হঠাৎ - are in REJECTED in '
                'tools/vocabulary.py, which refuses a word from every source at once.',
            'counts': {'levels': len(levels), 'words': len(placed),
                       'already_a_puzzle': len(already),
                       'left_out': len(left_out) + len(stranded)},
            'levels': levels,
            'left_out': dict(sorted({**left_out, **stranded}.items())),
        }, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
        print(f'\nwrote {OUT.relative_to(HERE.parent)}')
    else:
        print('\nnothing written; pass --write')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
