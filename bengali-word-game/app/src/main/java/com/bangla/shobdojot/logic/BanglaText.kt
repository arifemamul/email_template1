package com.bangla.shobdojot.logic

/**
 * Bengali text is not one-character-per-letter: "মাছ" is written with four code points
 * (ম, া, ছ ... plus possible signs) but a reader sees two letter units - "মা" and "ছ".
 * Those units are called aksharas, and they are what the player actually drags around
 * in this game, so every tile and every grid cell holds one akshara.
 */
object BanglaText {

    private const val HASANTA = '্' // virama: glues the next consonant into a conjunct

    /** Signs that hang off the preceding consonant instead of standing on their own. */
    private val COMBINING = setOf(
        'ঁ', // ঁ chandrabindu
        'ং', // ং anusvara
        'ঃ', // ঃ visarga
        '়', // ় nukta
        'া', // া
        'ি', // ি
        'ী', // ী
        'ু', // ু
        'ূ', // ূ
        'ৃ', // ৃ
        'ৄ', // ৄ
        'ে', // ে
        'ৈ', // ৈ
        'ো', // ো
        'ৌ', // ৌ
        'ৗ', // ৗ
        'ৢ', // ৢ
        'ৣ', // ৣ
        HASANTA
    )

    fun isCombining(c: Char): Boolean = c in COMBINING

    /**
     * Splits a word into aksharas. A new unit starts at a base character, unless the
     * previous unit ended with a hasanta - then the two consonants form one conjunct.
     */
    fun splitAksharas(word: String): List<String> {
        val units = mutableListOf<String>()
        val current = StringBuilder()
        var joinNext = false

        for (c in word) {
            when {
                c.isWhitespace() -> continue

                isCombining(c) -> {
                    // A stray sign with nothing before it still gets kept, not dropped.
                    current.append(c)
                    joinNext = c == HASANTA
                }

                joinNext -> {
                    current.append(c)
                    joinNext = false
                }

                else -> {
                    if (current.isNotEmpty()) {
                        units += current.toString()
                        current.setLength(0)
                    }
                    current.append(c)
                }
            }
        }
        if (current.isNotEmpty()) units += current.toString()
        return units
    }

    /** Number of letter units the player has to spell out for [word]. */
    fun length(word: String): Int = splitAksharas(word).size

    private val DIGITS = charArrayOf('০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯')

    /** Renders a number in Bengali numerals, so the HUD reads ২৫ rather than 25. */
    fun digits(value: Int): String {
        if (value < 0) return "-" + digits(-value)
        return value.toString().map { c -> if (c.isDigit()) DIGITS[c - '0'] else c }.joinToString("")
    }

    /**
     * True when [word] can be spelled from [tiles] using each tile at most once -
     * the rule the letter wheel enforces while the player drags.
     */
    fun isSpellableFrom(word: String, tiles: List<String>): Boolean {
        val pool = tiles.toMutableList()
        for (unit in splitAksharas(word)) {
            if (!pool.remove(unit)) return false
        }
        return true
    }
}
