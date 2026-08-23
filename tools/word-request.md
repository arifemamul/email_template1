# Asking another chat for Bengali words

Paste the prompt below into a fresh chat. It is written to produce something that drops into
`tools/vocabulary.py` with minimal editing, and to head off the two ways this request usually
goes wrong: getting common *newspaper* Bengali instead of words a child knows, and getting
words that are individually fine but cannot share a letter wheel.

Do not paste the result straight into `vocabulary.py`. Run it through the checks first — see
"After you get the list" at the bottom.

---

## The prompt

> I am building a Bengali word puzzle for children learning to read. I need a vocabulary list
> organised by the letter each word starts with.
>
> **How the game works, because it constrains the words.** Bengali is not one letter per
> character. The word মাছ is three code points but a reader sees two letter units — মা and ছ.
> These units (aksharas) are the atoms of the game: one akshara per tile. A level is named
> after a letter and its board is a small crossword made only of words that start with that
> letter. The wheel of tiles for a level is exactly the set of distinct aksharas in its words,
> and it can hold at most 7. So the words for one letter must **share aksharas with each
> other**, or the wheel overflows and the level cannot be built.
>
> Example of what works: কলম, কমল, কল, কম, কলা, কমলা — six words, four distinct tiles
> (ক, ল, ম, লা). Example of what does not: কবুতর, কচ্ছপ, কাঠবিড়ালি — three words, fifteen
> tiles, no level possible.
>
> **What I need for each letter.** Bengali words that:
>
> 1. Are real, current, everyday Bengali — not Sanskritised, not literary, not newspaper
>    register. Assume the reader is a seven-year-old in a Bengali-speaking household.
> 2. Are **concrete**: name something you could draw or photograph, or are a number, a colour,
>    or an everyday action. The test is whether a picture could replace the translation.
> 3. Are **2 to 4 aksharas long**. Two and three are most useful. Five is too long for a board.
> 4. Are dictionary base forms — no verb inflections (দিচ্ছিলাম), no case endings, no plurals.
> 5. Share aksharas with the other words you list for the same letter, as much as possible.
>
> **Format.** One block per letter. For each word give the word, its akshara split, and a
> one-or-two-word English gloss, like this:
>
> ```
> ক
>   কলম    ক + ল + ম      pen
>   কমলা   ক + ম + লা     orange (fruit)
>   কচু    ক + চু         taro
> ```
>
> Give me **at least 8 words per letter** where the language allows it, and say so explicitly
> when it does not — some letters genuinely have very few word-initial options and I would
> rather know that than be given padding.
>
> **Letters I need most**, because my current list is almost empty for these. The number in
> brackets is how many I have:
>
> - অ (4), ই (2), ঈ (2), ঊ (2), ঋ (3), এ (1), ঐ (1), ও (3), ঔ (1)
> - ড (4), ষ (3)
>
> For these especially: list **everything** that exists, including words that are only
> marginally child-friendly, and mark which ones are a stretch. If a letter has only one or
> two word-initial words in the whole language, tell me that plainly.
>
> **Letters to skip:** ঙ, ঞ, ণ, ড়, ঢ়, য় — no Bengali word begins with these.
>
> Then cover the rest of the alphabet: আ ক খ গ ঘ চ ছ জ ঝ ট ঠ ঢ ত থ দ ধ ন প ফ ব ভ ম য র ল শ স হ.
>
> **Do not invent compounds.** If you are unsure a word is really used, mark it uncertain
> rather than dropping it — I will check every word against corpus frequency data and I would
> rather review a flagged word than miss a real one.
>
> **Two spellings of the same word count as one word** and I can only use one, so if you list
> both (ওষুধ / ঔষধ, তেল / তৈল) say that they are the same word.

---

## After you get the list

The list is candidates, not vocabulary. Every word still has to pass what is already here:

1. **Frequency floor.** `tools/wordpool.py` checks each word against `wordfreq`'s Bengali data
   and rejects anything under zipf 2.0. This is what catches invented compounds — it has
   caught several already.
2. **`python3 tools/build.py discover WORD`** reports whether one word is attested, how it
   splits into aksharas, and which levels could use it.
3. **Add to a theme in `tools/vocabulary.py`**, not to a flat list — the themes group the
   illustration and recording work, and words in one theme make the best bridging words for
   another level in the same theme.
4. **Record the rejects.** `vocabulary.py` has a `REJECTED` dict with a written reason per
   word. When a plausible-looking word is turned down, put it there with why, so the same
   word does not get proposed again in six months.
5. **`python3 tools/build.py check`** must pass before `build`. It enforces the rules a word
   list cannot see on its own: no word on two boards, every level actually about its declared
   letter, and no level stealing a word that a later letter's level needs.

What is genuinely scarce is worth knowing before you ask: the pool has 541 words and only 181
are on boards, so words in general are not the bottleneck. The bottleneck is words for the
rare vowels, and words that share aksharas with each other. A hundred more animal names would
not add a single level; four more ঐ words would add one.
