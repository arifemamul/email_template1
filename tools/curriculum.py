# -*- coding: utf-8 -*-
"""
The teaching order: which pieces of the Bengali writing system a level introduces, and in
what sequence a learner should meet them.

This exists because puzzle difficulty and teaching order are not the same thing. Ranking
levels by how hard they are to solve (tile count, word count, word rarity) produces a good
puzzle ramp and a bad syllabus: it will hand a learner the vowel sign for the first time in
level 6 without ever having said what a vowel sign is, and its first conjunct will be
whichever one happened to fall there.

So a level is placed by what it *teaches* first, and only then by how hard it is. The unit of
teaching is smaller than an akshara: মা is the consonant ম plus the sign া, and a learner who
knows both can read মা without being taught it. That is what makes a syllabus possible at
all - a few dozen units unlock thousands of aksharas.
"""
from bangla import HASANTA, split_aksharas

# Vowel signs (kars). These hang off a consonant and change its vowel: ম -> মা, মি, মু.
KARS = {
    'া': 'aa', 'ি': 'i', 'ী': 'ii', 'ু': 'u', 'ূ': 'uu', 'ৃ': 'ri',
    'ে': 'e', 'ৈ': 'oi', 'ো': 'o', 'ৌ': 'ou', 'ৗ': 'ou-long',
}

# Nasal and breath marks, which behave like a sign rather than a letter.
NASALS = {'ঁ': 'chandrabindu', 'ং': 'anusvara', 'ঃ': 'visarga'}

# Independent vowel letters, used when a word starts with a vowel sound: আম, এক, ইঁদুর.
VOWELS = set('অআইঈউঊঋএঐওঔ')

# The order a learner meets the letters themselves. Ranked by how much work each one does in
# the curated vocabulary, so the letters that unlock the most words come first - a learner who
# knows ল, ব, র, ন can already read dozens of words, while ঝ and ষ open almost nothing. The
# nukta letters (ড়, ঢ়, য়) sit behind their plain counterparts, since they are the plain
# letter plus a dot and read as a different sound.
CONSONANT_ORDER = [
    'ল', 'ব', 'র', 'ন', 'ক', 'ম', 'ত', 'প', 'দ', 'স', 'গ', 'চ', 'শ', 'ছ', 'খ', 'ট', 'জ',
    'ঘ', 'হ', 'ফ', 'ভ', 'থ', 'ঠ', 'ণ', 'ধ', 'ঙ', 'ড', 'ঝ', 'ষ', 'ড়', 'য়', 'ঢ', 'ঢ়',
    'য', 'ঞ',
]

# Independent vowels in the order a Bengali primer teaches them, which is also the order they
# are recited in - a learner will have heard this sequence long before they can read it.
VOWEL_ORDER = ['অ', 'আ', 'ই', 'ঈ', 'উ', 'ঊ', 'ঋ', 'এ', 'ঐ', 'ও', 'ঔ']

# The order a learner meets the vowel signs. Frequency first, with the signs that sit plainly
# after the consonant (া) before the ones that sit in front of it (ি, ে) or wrap around it
# (ো, ৌ), because a sign written to the left of its own consonant is the first thing that
# genuinely confuses a reader used to the Latin alphabet.
KAR_ORDER = ['া', 'ি', 'ে', 'ু', 'ী', 'ো', 'ূ', 'ৈ', 'ৌ', 'ৃ', 'ৗ']

# Conjunct clusters, easiest first. Two consonants before three; within that, the ones whose
# parts stay recognisable (ন্ত, স্ত, ন্দ) before the ligatures that fuse into a new shape
# (ক্ষ, জ্ঞ, ষ্ট), because the second kind has to be learned as its own symbol.
CONJUNCT_ORDER = [
    # two consonants, parts still legible
    'ন্ত', 'ন্দ', 'স্ত', 'স্ক', 'ট্র', 'ল্প', 'ম্ব', 'ন্ন', 'ল্ল', 'ন্ধ', 'ক্ত', 'ত্ত', 'দ্ধ',
    'ন্স', 'ক্স', 'প্ন', 'শ্চ', 'স্ব',
    # the reph: a র written as a hook above the letter that follows it
    'র্ব', 'র্ষ', 'র্য',
    # ligatures that fuse into a shape of their own
    'ত্র', 'ষ্ট', 'ষ্ঠ', 'ক্ষ', 'দ্র', 'গ্র', 'প্র', 'গ্ধ',
    # the ya-phala: a য hung off the back of its consonant
    'ত্য', 'ব্য', 'দ্য',
    'ন্ম', 'জ্ঞ', 'হ্ম',
    # three consonants
    'ন্দ্র', 'ষ্ট্র', 'ন্ত্র', 'ন্ধ্য', 'ক্ত্র',
]


# Three pieces of the script the syllabus deliberately does not teach, with the reason. Kept
# here so a coverage check can tell a considered omission from an oversight, which is the only
# difference between the two that anyone can see from the outside.
NOT_TAUGHT = {
    'ৗ': 'not a sign of its own in modern Bengali - ৌ is the composed form, and ৗ survives '
         'only in legacy decompositions',
    'ঃ': 'visarga, which appears in a handful of Sanskritic words. The reachable ones are '
         'দুঃখ (sorrow) and অতঃপর (thereafter) - one too bleak for a child, the other too '
         'formal, and neither placeable in a three-word crossword',
    'ঞ': 'never stands alone in a modern Bengali word - it appears only inside clusters like '
         'ঞ্চ and ঞ্জ, so there is no word to teach it with',
}


def strip_signs(akshara):
    """The consonant or vowel skeleton of an akshara, with its vowel and nasal marks removed."""
    return ''.join(c for c in akshara if c not in KARS and c not in NASALS)


def units(akshara):
    """
    The teaching units an akshara is built from, as (kind, symbol) pairs. মা is a consonant
    and a sign; ন্ধু is a conjunct and a sign; আ is a vowel on its own.

    A learner who has met every unit in an akshara can read that akshara, which is why the
    syllabus tracks units rather than the ~500 akshara shapes they combine into.
    """
    found = []
    skeleton = strip_signs(akshara)

    if HASANTA in skeleton:
        found.append(('conjunct', skeleton))
    elif skeleton and skeleton[0] in VOWELS:
        found.append(('vowel', skeleton[0]))
    elif skeleton:
        found.append(('consonant', skeleton))

    for c in akshara:
        if c in KARS:
            found.append(('kar', c))
        elif c in NASALS:
            found.append(('nasal', c))
    return found


def units_in(words):
    """Every teaching unit a word list needs, deduplicated."""
    seen = []
    for word in words:
        for akshara in split_aksharas(word):
            for unit in units(akshara):
                if unit not in seen:
                    seen.append(unit)
    return seen


def kars_in(words):
    return [u for u in units_in(words) if u[0] == 'kar']


def conjuncts_in(words):
    return [u for u in units_in(words) if u[0] == 'conjunct']


REPH = 'র্'
YA_PHALA = '\u09cd\u09af'   # hasanta + য


def family(cluster):
    """
    The thing a learner is actually being taught. র্ষ and র্য are not two clusters to
    memorise - they are one mark, the reph, sitting over two different letters. Same for the
    য hung off the back of ব্য and দ্য. Teaching those once beats teaching them per cluster.
    """
    if cluster.startswith(REPH):
        return 'reph'
    if cluster.endswith(YA_PHALA):
        return 'ya-phala'
    return cluster


def unit_label(unit):
    """How a unit is named to a learner: the sign itself plus what it is called."""
    kind, symbol = unit
    if kind == 'kar':
        return f'{symbol} ({KARS[symbol]}-kar)'
    if kind == 'nasal':
        return f'{symbol} ({NASALS[symbol]})'
    if kind == 'conjunct':
        group = family(symbol)
        return f'{symbol} ({group})' if group != symbol else f'{symbol} (conjunct)'
    if kind == 'vowel':
        return f'{symbol} (vowel)'
    return symbol


def teaching_rank(unit):
    """
    Where a unit sits in the syllabus: letters first, then vowel signs, then nasal marks, then
    conjuncts. Anything not on the lists sorts last within its kind, so an unplanned letter or
    cluster cannot slip in early just because no one thought about it.
    """
    kind, symbol = unit
    if kind == 'consonant':
        order = (CONSONANT_ORDER.index(symbol) if symbol in CONSONANT_ORDER
                 else len(CONSONANT_ORDER))
        return (0, order)
    if kind == 'vowel':
        order = VOWEL_ORDER.index(symbol) if symbol in VOWEL_ORDER else len(VOWEL_ORDER)
        return (0, order)
    if kind == 'kar':
        order = KAR_ORDER.index(symbol) if symbol in KAR_ORDER else len(KAR_ORDER)
        return (1, order)
    if kind == 'nasal':
        return (2, 0)
    order = CONJUNCT_ORDER.index(symbol) if symbol in CONJUNCT_ORDER else len(CONJUNCT_ORDER)
    return (3, order)


# -- blocks ------------------------------------------------------------------------------
# The syllabus in five stages. Each one holds the previous stage's material constant and adds
# exactly one new kind of thing, so a learner is never asked to absorb two novelties at once.

BLOCK_PLAIN, BLOCK_ONE_KAR, BLOCK_KARS, BLOCK_CONJUNCT, BLOCK_FREE = 1, 2, 3, 4, 5

BLOCKS = {
    BLOCK_PLAIN: {
        'name': 'plain letters',
        'bn': 'শুধু অক্ষর',
        'goal': 'consonants and independent vowels on their own, no signs at all',
    },
    BLOCK_ONE_KAR: {
        'name': 'one vowel sign',
        'bn': 'একটি কার',
        'goal': 'a single vowel sign per level, introduced one at a time in KAR_ORDER',
    },
    BLOCK_KARS: {
        'name': 'vowel signs together',
        'bn': 'একসাথে কার',
        'goal': 'several signs in one word, all of them already taught',
    },
    BLOCK_CONJUNCT: {
        'name': 'conjuncts',
        'bn': 'যুক্তাক্ষর',
        'goal': 'joined consonants, one cluster family at a time',
    },
    BLOCK_FREE: {
        'name': 'free play',
        'bn': 'মুক্ত খেলা',
        'goal': 'everything taught, mixed, longest words and fullest boards',
    },
}


def alphabet():
    """
    Everything a syllabus has to teach before a learner can read ordinary Bengali, as
    (kind, symbol) pairs - independent vowels, vowel signs, nasal marks and letters, less the
    documented exclusions. Conjuncts are not in here: there are hundreds and no learner needs
    all of them, so they are covered by teaching the common families in order instead.
    """
    units = ([('vowel', v) for v in VOWEL_ORDER]
             + [('kar', k) for k in KAR_ORDER]
             + [('nasal', n) for n in NASALS]
             + [('consonant', c) for c in CONSONANT_ORDER])
    return [(kind, sym) for kind, sym in units if sym not in NOT_TAUGHT]


def block_for(words):
    """
    Which stage a word list belongs to, decided by the hardest thing it contains. A level is
    only as gentle as its most demanding word.
    """
    if conjuncts_in(words):
        return BLOCK_CONJUNCT
    distinct_kars = {symbol for _, symbol in kars_in(words)}
    if not distinct_kars:
        return BLOCK_PLAIN
    if len(distinct_kars) == 1:
        return BLOCK_ONE_KAR
    return BLOCK_KARS


def hardest_unit(words):
    """The unit that decides a level's placement - the last one in teaching order."""
    return max(units_in(words), key=teaching_rank)


def new_units(words, known):
    """
    Units this level introduces, given what a learner already knows. Returned in teaching
    order so the first entry is the one worth putting on a "new letter" card.
    """
    fresh = [u for u in units_in(words) if u not in known]
    return sorted(fresh, key=teaching_rank)
