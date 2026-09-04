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

The opening block of the syllabus - plain letters, no vowel signs at all - is the hardest to
feed, and the reason is the writing system rather than the curation. Almost everything concrete
a child names carries a sign: গাছ, ফুল, মাছ, চাঁদ, বাড়ি. What is left sign-free skews Sanskritic
and abstract, so words like সরল (simple), সকল (all) and জগত (world) earn a place there that they
would not earn anywhere else in the pool.

Themes are not decoration. They group the recording and illustration work, they let a parent
pick a set ("do the animals one"), and words from one theme make the best extras for another
level in the same theme.
"""

# -- themed word pool --------------------------------------------------------------------
# Each word here is attested (checked against corpus frequency, see `check_pool`) and spells
# out of distinct aksharas, so a letter wheel can hold it.

THEMES = {
    'numbers': """
        এক দুই তিন চার পাঁচ ছয় সাত আট নয় দশ ষোল ষষ্ঠ ঊনিশ
    """,
    'animals': """
        গরু ছাগল বিড়াল পাখি হাতি সাপ মুরগি ব্যাঙ হরিণ বানর ঘোড়া ময়ূর ইঁদুর মাছি মাছ বাঘ কাক
        মাছরাঙা প্রজাপতি অজগর ঈগল উট মৌমাছি ষাঁড় কুমির কচ্ছপ খরগোশ ভালুক শিয়াল বাঁদর বাছুর
        কাঠবিড়ালি মশা পিঁপড়া মাকড়সা কবুতর পায়রা টিয়া কোকিল শালিক চিল বক হাঁস ফড়িং ভেড়া
    """,
    'food': """
        ভাত রুটি ডিম দুধ আম কলা রুটি চিনি লবণ তেল পানি জল মাখন সবজি ফল আপেল কমলা পেয়ারা নারকেল
        মিষ্টি রস গম টক রসগোল্লা দুধভাত বিস্কুট স্বাদ যব ডাল ডালিম মূলা মাংস আটা মধু দই
        পেঁয়াজ রসুন আদা মরিচ তরকারি খাবার নাশতা আনারস পেঁপে তরমুজ আঙুর লিচু বেগুন আলু টমেটো
        গাজর শিম কচু লাউ কুমড়া মিছরি কফি শরবত পিঠা মটর পটল ধান
    """,
    'body': """
        হাত চোখ কান মাথা মুখ দাঁত চুল পেট আঙুল গলা হাঁটু কাঁধ নখ হৃদয় ঠোঁট জিভ কপাল ভুরু গাল
        ঘাড় বুক পিঠ কোমর থুতনি বগল দম পলক
    """,
    'home': """
        ঘর বই কলম খাতা জুতো জামা ছাতা বালিশ চাদর থালা বাটি চামচ দরজা জানালা বিছানা আয়না সাবান
        তোয়ালে চেয়ার টেবিল ঘড়ি হাতঘড়ি চাবি বালতি ঘরবাড়ি বাড়ি বাক্স কম্বল চশমা পাখা ঢোল
        ঝুড়ি ঔষধ ওষুধ গৃহ ছাদ দেয়াল মেঝে সিঁড়ি উঠান বারান্দা রান্নাঘর গোসল কলসি বাসন হাঁড়ি
        কড়াই খুন্তি ঝাড়ু বোতল কাঁচি সুতো দোলনা তালা পর্দা আলমারি টুপি মোজা শাড়ি গামছা রুমাল
        ভবন কলস ঘট মহল পশম রতন ঠিকানা থলি ঢাকনা ঝোলা যন্ত্র ফিতা লাঠি
    """,
    'nature': """
        গাছ ফুল পাতা নদী চাঁদ আকাশ মেঘ বৃষ্টি রোদ মাঠ পুকুর সমুদ্র বাতাস আগুন বালি পাথর পাহাড়
        বন ঝড় বরফ তারা মেঘলা কলাগাছ ফুলবাগান বাগান চন্দ্র সূর্য ঝরনা ঢেউ পৃথিবী ঢাল শিকড় বীজ
        কুঁড়ি কাঁটা লতা ঘাস কুয়াশা সাগর দ্বীপ মরু বিল খাল ঝিল কাদা ধুলা ছায়া আলো গ্রহ মৌচাক
        কমল কদম টগর নদ ফসল তরল ধোঁয়া
    """,
    # মা and পা are one akshara each, so a wheel cannot make a puzzle of them - they belong
    # in the reading material, not the board.
    'people': """
        ভাই বোন খালা ছেলে মেয়ে শিশু বন্ধু পরিবার জন মানুষ কৃষক সৈনিক দাদি নানি মাসি নাতি জেলে
        রাখাল মালি ধোপা কামার কুমার তাঁতি ডাক্তার নার্স চালক দর্জি রাজা রানি সাধু ছাত্রী শিল্পী
        গায়ক লেখক ঋষি
    """,
    'colours': """
        লাল নীল সবুজ কালো সাদা হলুদ বেগুনি গোলাপি রঙ গাঢ় বাংলা
    """,
    'school': """
        স্কুল পেন্সিল ছাত্র শেখা ছুটি খেলা গল্প ছবি কবিতা পড়া লেখা পড়ালেখা নাটক বিদ্যালয়
        পাঠশালা শিক্ষক নৃত্য চিঠি চিঠিপত্র ভাষা বাক্য ঋণ বোর্ড চক ব্যাগ রাবার পাঠ পরীক্ষা নম্বর
        প্রশ্ন শব্দ বানান গণিত ইতিহাস ভূগোল বিজ্ঞান ক্লাস খবর হরফ ফলক জগত যোগ
    """,
    'getting about': """
        গাড়ি সাইকেল নৌকা বিমান ট্রেন পথ রাস্তা সড়ক শহর নগর বাজার দৌড় লাফ গ্রাম রাস্তাঘাট
        রিকশা বাস লঞ্চ জাহাজ হেলিকপ্টার ঘাট সেতু বন্দর স্টেশন টিকিট যাত্রা ভ্রমণ হাঁটা রথ
    """,
    'doing': """
        হাসি কাঁদা ঘুম রান্না গান বল কল নল দল বস কর বদল ওঠা বসা চলা দেখা শোনা বলা ধরা ছাড়া
        দেওয়া নেওয়া আনা যাওয়া আসা করা রাখা তোলা ফেলা খোলা বন্ধ ভাঙা গড়া কাটা সেলাই আঁকা
        নাচা গাওয়া লাফানো সাঁতার রাগ নকল চমক ঝলক হজম নজর ঠেলা থাকা থামা ঢালা ঢোকা টানা ঝাঁপ
        ভাঁজ
    """,
    'describing': """
        বড় কম গরম নরম শীতল লাল ভালোবাসা সব শক্ত আনন্দ স্বপ্ন অন্ধকার লবণ দূর মূল অতল মৃদু তৈরি
        ওজন ঐক্য যত ছোট লম্বা মোটা চিকন ভারী হালকা উঁচু নিচু চওড়া সরু পুরনো সুন্দর পরিষ্কার
        নোংরা খালি ভরা তিতা ঝাল সহজ কঠিন দ্রুত ধীর চুপ ঠান্ডা উষ্ণ সকল সফল সরল অলস সমতল রকম আসল
        ঘন নগদ ঠিক ধনী ফাঁকা
    """,
    'directions': """
        উত্তর দক্ষিণ পশ্চিম পূর্ব
    """,
    'time': """
        দিন রাত সকাল শীত বর্ষা কাল দিনরাত শীতকাল বর্ষাকাল বসন্ত জন্মদিন সন্ধ্যা ঈদ ঋতু মৌসুম
        বৈশাখ পৌষ ঊষা বৈঠক সপ্তাহ মাস বছর ঘণ্টা মিনিট আজ গতকাল ভোর দুপুর বিকাল মাঝরাত সময়
        তারিখ আষাঢ়
    """,
}

# Words the frequency pool offers that this game will not use, and why. Kept as a written
# record so the next person curating does not have to rediscover each judgement.
REJECTED = {
    'ষোলো': 'sixteen - the same word as ষোল, spelled twice',
    'ষড়যন্ত্র': 'conspiracy - adult subject',
    'যদি': 'if - a conjunction, nothing to picture',
    'শালা': 'brother-in-law, and an insult in the same breath - not a word to set as a puzzle',
    # two spellings of one word
    'তৈল': 'oil - the formal spelling of তেল, and a board holding both asks a learner to tell '
            'apart two words that are the same word',
    # letters the alphabet game needs but not at any price
    'ঠাকুর': 'a deity, or an honorific - too loaded for a reading game, and ঠিক and ঠিকানা '
              'carry ঠ without it',
    'ঠাঁই': 'shelter, in the abstract sense - no picture',
    'থমকে': 'having stopped short - an inflected adverb',
    'ধরন': 'manner, way - abstract',
    # From the school vocabulary list in tools/word-list-school.json. Every one is a word a
    # Bengali child hears, and none of them is a word a picture can replace - which is this
    # game's rule for a board word, because the reward for spelling one is recognising the
    # thing. They were set for one commit and taken out again.
    'অনেক': 'many - a quantity, nothing to picture',
    'ইচ্ছা': 'a wish - abstract',
    'একতা': 'unity - abstract',
    'ঈশ্বর': 'God - and no picture of it belongs in a reading game',
    'ঈশান': 'the northeast - a direction, and a rare one to say',
    'মহৎ': 'noble - a judgement, not a thing',
    'যাদু': 'magic - a picture of a wand is read as a wand',
    'দুঃখ': 'sadness - a sad face is read as sad, not as the noun',
    'নিঃস্ব': 'destitute - abstract, and a heavy sense for a child',
    'হঠাৎ': 'suddenly - an adverb',
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
    # inflected forms: the word is fine, this shape of it is grammar
    'মাঠে': 'in the field - locative of মাঠ',
    'ছুটির': 'of the holiday - genitive of ছুটি',
    'রাতে': 'at night - locative of রাত',
    'জোরে': 'loudly - locative of জোর',
    'কালকে': 'colloquial oblique of কাল',
    # formal registers of a word already in the pool
    'মিষ্টান্ন': 'confectionery - মিষ্টি says it plainly',
    'নক্ষত্র': 'star - তারা says it plainly',
    'অধ্যায়': 'chapter - formal, and পাঠ is the word a child hears',
    # school machinery rather than school vocabulary
    'ভর্তি': 'admission - a process, not a thing',
    'বৃত্তি': 'scholarship - same',
    'হাজিরা': 'attendance register - same',
    'উত্তরপত্র': 'answer script - same',
    # too rare a referent, or unkind
    'আকাশগঙ্গা': 'the Milky Way - beautiful, but nothing to point at',
    'বজ্র': 'thunderbolt - formal; ঝড় carries the weather',
    'হাওর': 'a wetland of north-east Bangladesh - regional',
    'শতাব্দী': 'century - no picture',
    'যুগ': 'era - same',
    'কুৎসিত': 'ugly - not a word to teach a child to use',
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
