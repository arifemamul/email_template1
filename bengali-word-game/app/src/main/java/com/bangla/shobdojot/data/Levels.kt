package com.bangla.shobdojot.data

import com.bangla.shobdojot.model.Level

/**
 * Level content, ordered by difficulty: tile count, word count, how long the longest word
 * is, whether conjunct tiles appear, and how common the words are.
 *
 * Every word is attested in real Bengali text (checked against corpus frequency data) and
 * hand-picked — frequency lists happily offer verb inflections and word fragments, which
 * make poor puzzles. Each `letters` entry is one akshara: the unit that sits on a wheel tile
 * and fills one grid cell.
 *
 * Two rules constrain what can go here, and `LevelsTest` enforces both:
 *  - a word must be spellable from the tiles using each tile at most once, and every tile
 *    must be used by some word, so the wheel never holds a letter the player cannot spend;
 *  - the words must form a connected crossword. A set where every word crosses every other
 *    — বন / ধন / বধ / বনধ — is a triangle, and no grid can hold it.
 */
object Levels {

    val all: List<Level> = listOf(
        // Easiest first: three tiles, short everyday words.
        Level(1, listOf("ক", "ম", "ল"), listOf("কম", "কল", "কমল", "কলম")),
        Level(2, listOf("ব", "ন", "ধ"), listOf("বন", "ধন", "বধ")),
        Level(3, listOf("প", "থ", "র"), listOf("পথ", "পর", "রথ")),
        Level(4, listOf("না", "ম", "দা"), listOf("নাম", "দাম", "দানা")),
        Level(5, listOf("রা", "ত", "না", "ম"), listOf("রাত", "নাম", "রাম")),
        Level(6, listOf("ক", "বি", "তা"), listOf("কবি", "তাক", "কবিতা")),
        Level(7, listOf("না", "ট", "ক"), listOf("নাক", "টক", "নাটক")),
        Level(8, listOf("ম", "ন", "তা", "রা"), listOf("মন", "তান", "তারা")),
        Level(9, listOf("ব", "ই", "খা", "তা"), listOf("বই", "খাই", "খাতা")),
        Level(10, listOf("ফু", "ল", "চা", "কু"), listOf("ফুল", "চাল", "চাকু")),
        Level(11, listOf("পা", "হা", "ড়"), listOf("পাড়", "হাড়", "পাহাড়")),
        Level(12, listOf("পা", "য়ে", "স"), listOf("পাস", "পায়ে", "পায়েস")),
        Level(13, listOf("মে", "ঘ", "লা"), listOf("মেঘ", "মেলা", "মেঘলা")),
        Level(14, listOf("গা", "ন", "ছ", "মা"), listOf("গান", "গাছ", "মান", "মাছ")),
        Level(15, listOf("জ", "ল", "ন", "ম"), listOf("জল", "জন", "মন", "নল")),
        Level(16, listOf("বা", "ল", "তি"), listOf("বাতি", "তিল", "বালতি", "বাতিল")),
        Level(17, listOf("ন", "গ", "র", "সা"), listOf("সার", "নগর", "সাগর")),

        // The first level with a conjunct tile: ন্ত is one letter unit, one tile.
        Level(18, listOf("ব", "স", "ন্ত"), listOf("সব", "বস", "বসন্ত")),
        Level(19, listOf("ব", "ন", "ধ", "ন্ধু"), listOf("বন", "ধন", "বন্ধু")),
        Level(20, listOf("ন", "দী", "র", "পা"), listOf("নদী", "পার", "পান", "নদীর")),
        Level(21, listOf("বাং", "লা", "দে", "শ"), listOf("বাংলা", "দেশ", "বাংলাদেশ")),
        Level(22, listOf("আ", "ম", "রা", "ত"), listOf("আম", "রাত", "আমরা", "আরাম")),
        Level(23, listOf("চা", "ম", "চ", "কা"), listOf("কাচ", "চাকা", "চামচ")),
        Level(24, listOf("বি", "দে", "শ", "কা"), listOf("দেশ", "বিশ", "বিদেশ", "বিকাশ")),
        Level(25, listOf("মা", "টি", "র", "পা"), listOf("মাটি", "পার", "পাটি", "মাটির")),
        Level(26, listOf("প", "রি", "বে", "শ"), listOf("বেশ", "পরি", "পরিবেশ")),
        Level(27, listOf("দি", "ন", "রা", "ত"), listOf("দিন", "রাত", "দিনরাত")),
        Level(28, listOf("বাং", "লা", "ভা", "ষা"), listOf("বাংলা", "ভাষা", "বাংলাভাষা")),
        Level(29, listOf("শি", "ক্ষ", "ক", "র"), listOf("কর", "কক্ষ", "শিক্ষক")),
        Level(30, listOf("ফু", "ট", "ব", "ল"), listOf("বল", "ফুল", "ফুট", "ফুটবল")),
        Level(31, listOf("হা", "ত", "ঘ", "ড়ি"), listOf("হাত", "ঘড়ি", "হাতঘড়ি")),
        Level(32, listOf("জা", "না", "লা", "ম"), listOf("জাম", "নাম", "মজা", "নালা", "জানালা")),
        Level(33, listOf("প", "ড়া", "লে", "খা"), listOf("পড়া", "লেখা", "খাড়া", "পড়ালেখা")),
        Level(34, listOf("দু", "ধ", "ভা", "ত"), listOf("দুধ", "ভাত", "দুধভাত")),
        Level(35, listOf("বা", "তা", "স", "র"), listOf("বাস", "তার", "বার", "রস", "তাস", "বাতাস")),
        Level(36, listOf("বি", "চা", "র", "কা"), listOf("চার", "কার", "রবি", "চাবি", "চাকা", "বিচার")),
        Level(37, listOf("মা", "ছ", "রা", "ঙা"), listOf("মাছ", "মারা", "রাঙা", "মাছরাঙা")),
        Level(38, listOf("ক", "ল", "ম", "লা"), listOf("কল", "কলা", "কলম", "কমল", "লাল", "কমলা")),
        Level(39, listOf("প", "রি", "বা", "র"), listOf("পর", "বার", "বাপ", "পরি", "পরিবার")),
        Level(40, listOf("ক", "লা", "গা", "ছ"), listOf("কলা", "লাগা", "গাছ", "কলাগাছ")),
        Level(41, listOf("পা", "ঠ", "শা", "লা"), listOf("পাঠ", "পালা", "পাশা", "পাঠশালা")),
        Level(42, listOf("রা", "ষ্ট্র", "প", "তি"), listOf("পরা", "রাষ্ট্র", "রাষ্ট্রপতি")),
        Level(43, listOf("ঘ", "র", "বা", "ড়ি"), listOf("ঘর", "বাঘ", "ঘড়ি", "বাড়ি", "ঘরবাড়ি")),
        Level(44, listOf("ভা", "লো", "বা", "সা"), listOf("ভালো", "বাসা", "ভাসা", "ভাবা", "ভালোবাসা")),
        Level(45, listOf("স্বা", "ধী", "ন", "তা"), listOf("তান", "স্বাধীন", "স্বাধীনতা")),
        Level(46, listOf("রা", "স্তা", "ঘা", "ট"), listOf("রাস্তা", "ঘাট", "রাস্তাঘাট")),
        Level(47, listOf("জ", "ন্ম", "দি", "ন"), listOf("জন", "দিন", "জন্ম", "জন্মদিন")),
        Level(48, listOf("শী", "ত", "কা", "ল"), listOf("তল", "শীত", "কাল", "শীতল", "শীতকাল")),
        Level(49, listOf("হা", "ত", "পা", "খা"), listOf("হাত", "খাত", "পাত", "পাখা", "হাতপাখা")),
        Level(50, listOf("র", "স", "গো", "ল্লা"), listOf("রস", "সর", "রসগোল্লা")),
        Level(51, listOf("ক", "ল", "কা", "তা"), listOf("কল", "কাক", "তাল", "লতা", "কাল", "কলকাতা")),
        Level(52, listOf("শি", "ল্প", "ক", "লা"), listOf("কলা", "শিলা", "শিল্প", "শিল্পকলা")),
        Level(53, listOf("চি", "ঠি", "প", "ত্র"), listOf("চিঠি", "পত্র", "চিত্র", "চিঠিপত্র")),
        Level(54, listOf("বি", "দ্যা", "ল", "য়"), listOf("বিল", "লয়", "বিদ্যা", "বিদ্যালয়")),
        Level(55, listOf("প্র", "জা", "প", "তি"), listOf("প্রতি", "জাতি", "প্রজা", "প্রজাতি", "প্রজাপতি")),
        Level(56, listOf("প্র", "তি", "ষ্ঠা", "ন"), listOf("প্রতি", "তিন", "প্রতিষ্ঠা", "প্রতিষ্ঠান")),
        Level(57, listOf("ব", "র্ষা", "কা", "ল"), listOf("বল", "বকা", "কাল", "বর্ষা", "বর্ষাকাল")),

        // The first five-tile board. Six-tile boards close out the game.
        Level(58, listOf("ফু", "ল", "বা", "গা", "ন"), listOf("ফুল", "গান", "বাগান", "ফুলবাগান")),
        Level(59, listOf("মু", "ক্তি", "যু", "দ্ধ"), listOf("মুক্তি", "যুদ্ধ", "যুক্তি", "মুক্তিযুদ্ধ")),
        Level(60, listOf("প্র", "জা", "ত", "ন্ত্র"), listOf("জাত", "প্রজা", "তন্ত্র", "প্রজাতন্ত্র")),
        Level(61, listOf("হা", "স", "পা", "তা", "ল"), listOf("পাতা", "তাল", "হাল", "পাস", "পাতাল", "হাসপাতাল")),
        Level(62, listOf("সং", "বা", "দ", "প", "ত্র"), listOf("বাদ", "পদ", "পত্র", "সংবাদ", "সংবাদপত্র")),
        Level(63, listOf("র", "বী", "ন্দ্র", "না", "থ"), listOf("বীর", "রথ", "নাথ", "রবীন্দ্র", "রবীন্দ্রনাথ")),
        Level(64, listOf("চ", "ন্দ্র", "গ্র", "হ", "ণ"), listOf("গ্রহ", "গ্রহণ", "চন্দ্র", "চন্দ্রগ্রহণ")),
        Level(65, listOf("সূ", "র্য", "গ্র", "হ", "ণ"), listOf("গ্রহ", "গ্রহণ", "সূর্য", "সূর্যগ্রহণ")),
        Level(66, listOf("বি", "মা", "ন", "ব", "ন্দ", "র"), listOf("বন", "মান", "মানব", "বিমান", "বন্দর", "বিমানবন্দর"))
    )

    val count: Int get() = all.size

    fun byId(id: Int): Level? = all.firstOrNull { it.id == id }
}
