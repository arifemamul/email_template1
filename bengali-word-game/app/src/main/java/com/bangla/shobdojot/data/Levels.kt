package com.bangla.shobdojot.data

import com.bangla.shobdojot.model.Level

/**
 * Level content. Each `letters` entry is one akshara — the unit that sits on a wheel tile
 * and fills one grid cell — and every word must be spellable from those tiles using each
 * tile at most once. Words also have to form a connected crossword; a set like
 * (বন, ধন, বধ, বনধ) where every word crosses every other cannot be laid out on a grid.
 *
 * `LevelsTest` checks all of that, so run it after editing this file.
 */
object Levels {

    val all: List<Level> = listOf(
        // Three tiles: plain consonants, which carry their own inherent vowel.
        Level(1, listOf("ক", "ম", "ল"), listOf("কম", "কল", "মল", "কমল")),
        Level(2, listOf("ব", "ন", "ধ"), listOf("বন", "ধন", "বধ")),
        Level(3, listOf("প", "থ", "র"), listOf("পথ", "পর", "রথ")),
        Level(4, listOf("না", "ম", "দা"), listOf("নাম", "দাম", "দানা")),

        // Four tiles.
        Level(5, listOf("জ", "ল", "ম", "ন"), listOf("জল", "জন", "মন", "নল")),
        Level(6, listOf("গা", "ছ", "ন", "মা"), listOf("গান", "গাছ", "মান", "মাছ")),
        Level(7, listOf("রা", "ত", "না", "ম"), listOf("রাত", "নাম", "রাম")),
        Level(8, listOf("ক", "ল", "ম", "লা"), listOf("কল", "কলা", "কলম")),
        Level(9, listOf("তা", "রা", "ম", "ন"), listOf("মন", "তান", "তারা")),
        Level(10, listOf("চা", "বি", "কা", "র"), listOf("চার", "কার", "চাবি")),
        Level(11, listOf("ফু", "ল", "কু", "চা"), listOf("ফুল", "চাল", "চাকু")),
        Level(12, listOf("সা", "গ", "র", "ন"), listOf("সার", "নগর", "সাগর")),
        Level(13, listOf("বা", "তা", "স", "র"), listOf("বাস", "তার", "বাতাস")),
        Level(14, listOf("আ", "ম", "রা", "ত"), listOf("আম", "রাত", "আমরা")),
        Level(15, listOf("ন", "দী", "র", "পা"), listOf("নদী", "পার", "নদীর")),
        Level(16, listOf("মা", "টি", "র", "পা"), listOf("মাটি", "পার", "মাটির")),
        Level(17, listOf("চা", "ম", "চ", "কা"), listOf("কাচ", "চাকা", "চামচ")),
        Level(18, listOf("জা", "না", "লা", "ম"), listOf("জাম", "নাম", "জানালা")),
        Level(19, listOf("দে", "শ", "বি", "কা"), listOf("দেশ", "বিদেশ", "বিকাশ")),

        // Compound words: two everyday words that join into a third.
        Level(20, listOf("দি", "ন", "রা", "ত"), listOf("দিন", "রাত", "দিনরাত")),
        Level(21, listOf("দু", "ধ", "ভা", "ত"), listOf("দুধ", "ভাত", "দুধভাত")),
        Level(22, listOf("ব", "ই", "খা", "তা"), listOf("বই", "খাতা", "বইখাতা")),
        Level(23, listOf("হা", "ত", "পা", "খা"), listOf("হাত", "পাখা", "হাতপাখা")),
        Level(24, listOf("হা", "ত", "ঘ", "ড়ি"), listOf("হাত", "ঘড়ি", "হাতঘড়ি")),
        Level(25, listOf("ক", "লা", "গা", "ছ"), listOf("কলা", "গাছ", "কলাগাছ")),
        Level(26, listOf("প", "ড়া", "লে", "খা"), listOf("পড়া", "লেখা", "পড়ালেখা")),
        Level(27, listOf("ঘ", "র", "বা", "ড়ি"), listOf("ঘর", "বাঘ", "বাড়ি", "ঘরবাড়ি")),

        // Conjuncts: ন্ধু, স্তা and ষ্টি are each a single tile.
        Level(28, listOf("ব", "ন", "ধ", "ন্ধু"), listOf("বন", "ধন", "বন্ধু")),
        Level(29, listOf("শি", "শু", "পা", "ঠ"), listOf("শিশু", "পাঠ", "শিশুপাঠ")),
        Level(30, listOf("রা", "স্তা", "ঘা", "ট"), listOf("রাস্তা", "ঘাট", "রাস্তাঘাট")),

        // Five tiles.
        Level(31, listOf("ফু", "ল", "বা", "গা", "ন"), listOf("ফুল", "গান", "বাগান", "ফুলবাগান"))
    )

    val count: Int get() = all.size

    fun byId(id: Int): Level? = all.firstOrNull { it.id == id }
}
