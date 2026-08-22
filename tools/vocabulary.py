# -*- coding: utf-8 -*-
"""
The word pool for a learner, grouped by theme.

Why this replaces frequency ranking as the selector: `wordpool.py` measures how often a word
appears in Bengali text, and the text it was trained on is adult prose. Rank by it and the
game fills up with প্রতিষ্ঠান (institution, zipf 5.41), সংবাদপত্র (newspaper, 4.73),
রাষ্ট্রপতি (president, 4.86) and মহানগর (metropolis, 4.63) - all genuinely common, none of
them words a seven-year-old needs. Frequency stays as the floor that catches invented
compounds; what a level is *built from* comes from here.

Every word below is concrete enough to draw, or is a number, colour or everyday action - the
test being whether a picture could replace the translation, since a picture works the same
in an English, Arabic or Japanese-speaking household.

A few entries are here because the syllabus needs them rather than because a child would
reach for them: ঔষধ and ঐক্য are the only attested, conjunct-free words that carry ঔ and ঐ,
and the alphabet is not finished without those letters. Where there was a choice the concrete
word won - উট for উ over উপর, ঈদ for ঈ over ঈশ্বর, অজগর for অ over অনেক.

Themes are not decoration. They group the recording and illustration work, they let a parent
pick a set ("do the animals one"), and words from one theme make the best extras for another
level in the same theme.
"""

# -- themed word pool --------------------------------------------------------------------
# Each word here is attested (checked against corpus frequency, see `check_pool`) and spells
# out of distinct aksharas, so a letter wheel can hold it.

THEMES = {
    'numbers': """
        এক দুই তিন চার পাঁচ ছয় সাত আট নয় দশ
    """,
    'animals': """
        গরু ছাগল বিড়াল পাখি হাতি সাপ মুরগি ব্যাঙ হরিণ বানর ঘোড়া ময়ূর ইঁদুর মাছি
        মাছ বাঘ কাক মাছরাঙা প্রজাপতি অজগর ঈগল উট মৌমাছি ষাঁড়
    """,
    'food': """
        ভাত রুটি ডিম দুধ আম কলা রুটি চিনি লবণ তেল পানি জল মাখন সবজি ফল আপেল কমলা
        পেয়ারা নারকেল মিষ্টি রস গম টক রসগোল্লা দুধভাত বিস্কুট স্বাদ
        যব ডাল ডালিম মূলা তৈল
    """,
    'body': """
        হাত চোখ কান মাথা মুখ দাঁত চুল পেট আঙুল গলা হাঁটু কাঁধ নখ হৃদয়
    """,
    'home': """
        ঘর বই কলম খাতা জুতো জামা ছাতা বালিশ চাদর থালা বাটি চামচ দরজা জানালা বিছানা
        আয়না সাবান তোয়ালে চেয়ার টেবিল ঘড়ি হাতঘড়ি চাবি বালতি ঘরবাড়ি বাড়ি
        বাক্স কম্বল চশমা পাখা ঢোল ঝুড়ি ঔষধ ওষুধ গৃহ
    """,
    'nature': """
        গাছ ফুল পাতা নদী চাঁদ আকাশ মেঘ বৃষ্টি রোদ মাঠ পুকুর সমুদ্র বাতাস আগুন বালি
        পাথর পাহাড় বন ঝড় বরফ তারা মেঘলা কলাগাছ ফুলবাগান বাগান চন্দ্র
        সূর্য ঝরনা ঢেউ পৃথিবী ঢাল
    """,
    # মা and পা are one akshara each, so a wheel cannot make a puzzle of them - they belong
    # in the reading material, not the board.
    'people': """
        ভাই বোন খালা ছেলে মেয়ে শিশু বন্ধু পরিবার জন মানুষ কৃষক সৈনিক
    """,
    'colours': """
        লাল নীল সবুজ কালো সাদা হলুদ বেগুনি গোলাপি রঙ গাঢ় বাংলা
    """,
    'school': """
        স্কুল পেন্সিল ছাত্র শেখা ছুটি খেলা গল্প ছবি কবিতা পড়া লেখা পড়ালেখা নাটক
        বিদ্যালয় পাঠশালা শিক্ষক নৃত্য চিঠি চিঠিপত্র ভাষা বাক্য ঋণ
    """,
    'getting about': """
        গাড়ি সাইকেল নৌকা বিমান ট্রেন পথ রাস্তা সড়ক শহর নগর বাজার দৌড় লাফ
        গ্রাম রাস্তাঘাট
    """,
    'doing': """
        হাসি কাঁদা ঘুম রান্না গান বল কল নল দল বস কর বদল
    """,
    'describing': """
        বড় কম গরম নরম শীতল লাল ভালোবাসা সব শক্ত আনন্দ স্বপ্ন অন্ধকার লবণ
        দূর মূল অতল মৃদু তৈরি ওজন ঐক্য যত
    """,
    'directions': """
        উত্তর দক্ষিণ পশ্চিম পূর্ব
    """,
    'time': """
        দিন রাত সকাল শীত বর্ষা কাল দিনরাত শীতকাল বর্ষাকাল বসন্ত জন্মদিন সন্ধ্যা
        ঈদ ঋতু মৌসুম বৈশাখ পৌষ ঊষা বৈঠক
    """,
}

# Words the frequency pool offers that this game will not use, and why. Kept as a written
# record so the next person curating does not have to rediscover each judgement.
REJECTED = {
    # newspaper register: common in adult prose, meaningless to a child
    'প্রতিষ্ঠান': 'institution - adult register',
    'সংবাদপত্র': 'newspaper - adult register',
    'রাষ্ট্রপতি': 'president - adult register',
    'প্রজাতন্ত্র': 'republic - adult register',
    'স্বাধীনতা': 'independence - abstract',
    'মুক্তিযুদ্ধ': 'the Liberation War - heavy subject, not a puzzle',
    'মহানগর': 'metropolis - adult register',
    'প্রতিষ্ঠা': 'establishment - abstract',
    'সবরকম': 'all kinds - abstract',
    'মানানসই': 'matching - abstract adjective',
    'বিকাশ': 'development - abstract',
    'পরিবেশ': 'environment - abstract',
    'বাতিল': 'cancelled - abstract',
    'প্রজাতি': 'species - technical',
    # proper nouns: a puzzle should not turn on knowing a name
    'রবীন্দ্রনাথ': 'a person',
    'কমলাপুর': 'a railway station in Dhaka',
    'বাংলাদেশ': 'a country - fine as content, but not a spelling target for a beginner',
    'কলকাতা': 'a city - same',
    'বাংলাভাষা': 'compound of two proper-ish nouns',
    # events a child has no picture for
    'চন্দ্রগ্রহণ': 'lunar eclipse - too rare a referent',
    'সূর্যগ্রহণ': 'solar eclipse - same',
    'বিমানবন্দর': 'airport - long, and the parts do not help',
    # adult-only or unpleasant senses
    'মদ': 'liquor',
    'বদ': 'wicked',
    'খল': 'villain',
    'ছল': 'deceit',
    'হত': 'killed',
    'বধ': 'slaying',
    'লাশ': 'corpse',
    'মল': 'excrement',
    # grammar, not vocabulary
    'করেছেন': 'verb inflection',
    'হয়ত': 'particle',
    'যতই': 'particle',
    'তম': 'ordinal suffix',
    # transliterations and initials the frequency list is full of
    'আউট': 'English "out"',
    'ডট': 'English "dot"',
    'এম': 'a letter name',
    'এস': 'a letter name',
}


def words(*themes):
    """The pool, or just the named themes. Order is stable so builds are reproducible."""
    chosen = THEMES if not themes else {t: THEMES[t] for t in themes}
    out = []
    for text in chosen.values():
        for w in text.split():
            if w not in out:
                out.append(w)
    return out


def theme_of(word):
    """Which theme a word was curated under, for grouping recording and illustration work."""
    for name, text in THEMES.items():
        if word in text.split():
            return name
    return None


def check_pool(min_zipf=2.0):
    """
    Every pooled word has to be real Bengali and spellable from distinct tiles. Returns a list
    of (word, problem); empty means the pool is clean.
    """
    from bangla import split_aksharas
    from wordpool import zipf

    problems = []
    for word in words():
        aksharas = split_aksharas(word)
        if ''.join(aksharas) != word:
            problems.append((word, 'does not round-trip through akshara splitting'))
        if len(aksharas) < 2:
            problems.append((word, 'is a single akshara'))
        if len(set(aksharas)) != len(aksharas):
            problems.append((word, f'repeats an akshara {aksharas}'))
        z = zipf(word)
        if z < min_zipf:
            problems.append((word, f'unattested in Bengali text (zipf {z:.2f})'))
        if word in REJECTED:
            problems.append((word, f'is in REJECTED: {REJECTED[word]}'))
    return problems
