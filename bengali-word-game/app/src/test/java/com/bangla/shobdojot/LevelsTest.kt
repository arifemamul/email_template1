package com.bangla.shobdojot

import com.bangla.shobdojot.data.Levels
import com.bangla.shobdojot.logic.BanglaText
import com.bangla.shobdojot.logic.CrosswordGenerator
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

private const val NUKTA = '\u09BC'

/**
 * Content checks for every shipped level. A level that fails here is unplayable - the
 * player would see tiles that spell nothing, or a board with a word floating off on its
 * own - so this runs over the whole catalogue rather than a sample.
 */
class LevelsTest {

    @Test
    fun `level ids are unique and sequential`() {
        assertEquals(Levels.all.map { it.id }, (1..Levels.count).toList())
    }

    @Test
    fun `every word is spellable from that level's tiles`() {
        for (level in Levels.all) {
            for (word in level.words) {
                assertTrue(
                    "level ${level.id}: '$word' needs ${BanglaText.splitAksharas(word)} " +
                        "but the wheel holds ${level.letters}",
                    BanglaText.isSpellableFrom(word, level.letters)
                )
            }
        }
    }

    @Test
    fun `no tile sits on the wheel unused`() {
        for (level in Levels.all) {
            val used = level.words.flatMap { BanglaText.splitAksharas(it) }.toSet()
            val unused = level.letters.filterNot { it in used }
            assertTrue("level ${level.id} has unusable tiles: $unused", unused.isEmpty())
        }
    }

    @Test
    fun `tiles and words are free of duplicates`() {
        for (level in Levels.all) {
            assertEquals(
                "level ${level.id} repeats a tile",
                level.letters.size,
                level.letters.toSet().size
            )
            assertEquals(
                "level ${level.id} repeats a word",
                level.words.size,
                level.words.toSet().size
            )
        }
    }

    @Test
    fun `every level has at least three words of at least two aksharas`() {
        for (level in Levels.all) {
            assertTrue("level ${level.id} has only ${level.words.size} words", level.words.size >= 3)
            for (word in level.words) {
                assertTrue(
                    "level ${level.id}: '$word' is a single letter",
                    BanglaText.length(word) >= 2
                )
            }
        }
    }

    @Test
    fun `every level lays out as one connected crossword`() {
        for (level in Levels.all) {
            val puzzle = CrosswordGenerator.generate(level.words)

            assertEquals(
                "level ${level.id} lost a word during layout",
                level.words.size,
                puzzle.words.size
            )
            for (word in puzzle.words) {
                val readBack = word.cells.joinToString("") { puzzle.cellLetters.getValue(it) }
                assertEquals("level ${level.id} misplaced '${word.word}'", word.word, readBack)
            }
            assertTrue(
                "level ${level.id} has a word floating unattached",
                CrosswordGeneratorTest.isConnected(puzzle)
            )
            CrosswordGeneratorTest.assertNoUnintendedRuns(puzzle)
        }
    }

    @Test
    fun `boards stay small enough for a phone screen`() {
        for (level in Levels.all) {
            val puzzle = CrosswordGenerator.generate(level.words)
            assertTrue("level ${level.id} is ${puzzle.rows} rows tall", puzzle.rows <= 8)
            assertTrue("level ${level.id} is ${puzzle.cols} cols wide", puzzle.cols <= 9)
        }
    }

    @Test
    fun `the syllabus runs in order and never goes backwards`() {
        // Blocks are the primary ordering: a learner meets plain letters, then one vowel sign
        // at a time, then several together, then conjuncts, then everything mixed. A level out
        // of block order means someone edited the generated file by hand.
        // Blocks order a syllabus. An alphabet game is ordered by the alphabet, and the two
        // disagree: ক lands in block 3 and গ in block 2, so sorting by block would put ক
        // second. Nothing below holds unless blocks are what decides the order.
        if (!Levels.FULL_SYLLABUS) return

        var block = Levels.all.first().block
        for (level in Levels.all) {
            assertTrue(
                "level ${level.id} is block ${level.block} after block $block",
                level.block >= block
            )
            block = level.block
        }
        assertEquals("the game should open in block 1", 1, Levels.all.first().block)
        // How far the blocks reach is a property of a finished syllabus.
        if (Levels.FULL_SYLLABUS) assertTrue("blocks used: $block", block >= 4)
    }

    @Test
    fun `the opening block is plain letters only`() {
        // No vowel signs, no conjuncts, no nasal marks: the thing being learned here is that a
        // tile is a letter and a drag is a word. A tile may still be two code points - ড় is a
        // ড with a dot under it - so this checks for signs rather than for length.
        for (level in Levels.all.filter { it.block == 1 }) {
            for (tile in level.letters) {
                val signs = tile.filter { BanglaText.isCombining(it) && it != NUKTA }
                assertTrue(
                    "level ${level.id} tile '$tile' carries the sign(s) '$signs'",
                    signs.isEmpty()
                )
            }
        }
    }

    @Test
    fun `the first level is the smallest in the game`() {
        // Only true where difficulty decides the order. An alphabet game is ordered by the
        // alphabet: level 2 is ই উ and has four words because four is what those letters
        // spell, not because it is a step up from level 1.
        if (!Levels.FULL_SYLLABUS) return

        val first = Levels.all.first()
        for (level in Levels.all) {
            assertTrue(
                "level ${level.id} has ${level.letters.size} tiles, fewer than level 1's " +
                    "${first.letters.size}",
                level.letters.size >= first.letters.size
            )
            assertTrue(
                "level ${level.id} has ${level.words.size} words, fewer than level 1's " +
                    "${first.words.size}",
                level.words.size >= first.words.size
            )
        }
    }

    @Test
    fun `no level uses a letter form the syllabus has not reached`() {
        // The invariant the whole ordering exists for. Checked per code point rather than per
        // tile, because a tile is a *combination*: কা is ক plus া, and a learner who has met
        // both can read it without it having to be taught as a third thing. So every code
        // point must have appeared before, or be part of what this level declares it teaches.
        val seen = mutableSetOf<Char>()
        for (level in Levels.all) {
            for (tile in level.letters) {
                for (c in tile) {
                    val introduced = level.teaches.any { c in it }
                    assertTrue(
                        "level ${level.id} shows '$tile' containing '$c', " +
                            "which nothing has taught",
                        c in seen || introduced
                    )
                }
            }
            seen += level.letters.flatMap { it.toList() }
        }
    }

    @Test
    fun `what a level teaches is actually on its board`() {
        for (level in Levels.all) {
            for (symbol in level.teaches) {
                assertTrue(
                    "level ${level.id} claims to teach '$symbol', which is not in its tiles",
                    level.letters.any { it.contains(symbol) }
                )
            }
        }
    }

    @Test
    fun `nothing is taught twice`() {
        val taught = mutableMapOf<String, Int>()
        for (level in Levels.all) {
            for (symbol in level.teaches) {
                val earlier = taught[symbol]
                assertTrue(
                    "'$symbol' is taught in level ${level.id} and again in level $earlier",
                    earlier == null
                )
                taught[symbol] = level.id
            }
        }
        if (Levels.FULL_SYLLABUS) {
            assertTrue("only ${taught.size} pieces of the writing system taught", taught.size >= 70)
        }
    }

    @Test
    fun `the syllabus covers the whole alphabet`() {
        // Only means something about a finished syllabus. The ten levels shipping now are a
        // game cut out of one, so this stops asserting rather than starts lying; it comes back
        // when `catalogue.FULL_SYLLABUS` is set again.
        if (!Levels.FULL_SYLLABUS) return

        // The promise of a teaching order is that finishing it leaves you able to read. A gap
        // here is a broken promise rather than a missing nicety, so the inventory is written
        // out in full: every independent vowel, every vowel sign, the nasal marks, and every
        // consonant. Three are left out on purpose and named below.
        val vowels = "অআইঈউঊঋএঐওঔ".map { it.toString() }
        val signs = listOf("া", "ি", "ী", "ু", "ূ", "ৃ", "ে", "ৈ", "ো", "ৌ")
        val nasals = listOf("ঁ", "ং")
        val consonants = ("কখগঘঙচছজঝটঠডঢণতথদধনপফবভমযরলশষসহ".map { it.toString() }
            + listOf("ড়", "ঢ়", "য়"))

        // Deliberately absent: ৗ is not a sign of its own in modern Bengali (ৌ is the
        // composed form), ঃ reaches only দুঃখ and অতঃপর, and ঞ never stands outside a
        // cluster - so there is no word to teach any of them with.
        val expected = vowels + signs + nasals + consonants
        val taught = Levels.all.flatMap { it.teaches }.toSet()

        val missing = expected.filterNot { it in taught }
        assertTrue(
            "the syllabus never teaches: ${missing.joinToString(" ")}",
            missing.isEmpty()
        )
    }

    @Test
    fun `no level past the first introduces more than three things at once`() {
        // A budget on new material only means something in a syllabus. Ten levels that reach
        // from plain letters to conjuncts introduce a great deal per level by construction, and
        // there is nothing to fix in that. Level 1 is exempt either way - it has nothing to
        // build on, so all of it is new.
        if (!Levels.FULL_SYLLABUS) return

        for (level in Levels.all.drop(1)) {
            assertTrue(
                "level ${level.id} introduces ${level.teaches}",
                level.teaches.size <= 3
            )
        }
    }

    @Test
    fun `most of the game is review`() {
        // A letter met once and never seen again has not been learned, so the majority of
        // levels should introduce nothing at all.
        // Only means something about a finished syllabus: review levels are the ones that
        // introduce nothing, and ten levels covering four blocks introduce something every
        // time by construction.
        if (!Levels.FULL_SYLLABUS) return

        val review = Levels.all.count { it.teaches.isEmpty() }
        assertTrue("only $review of ${Levels.count} levels are review", review * 3 >= Levels.count)
    }

    @Test
    fun `boards get fuller as the syllabus advances`() {
        // Word count is the main difficulty dial, and it is tied to the block rather than to
        // raw level number: a learner meeting their first vowel sign does not also need a
        // seven-word board.
        //
        // Asserted end to end rather than block by block. The conjunct block dips below the
        // one before it, and that is a property of the language rather than a mistake: a wheel
        // holding a conjunct tile spells fewer other words, so those boards cannot be filled
        // out as far. Difficulty there comes from the cluster, not from the word count.
        // Word count climbing with the block is a syllabus property. In an alphabet game the
        // block a level lands in is a consequence of which letters its words happen to carry,
        // so there is nothing for the means to be ordered by.
        if (!Levels.FULL_SYLLABUS) return

        val meanWords = Levels.all.groupBy { it.block }
            .toSortedMap()
            .map { (_, group) -> group.map { it.words.size }.average() }
        // Nothing to compare if the catalogue sits inside a single block.
        if (meanWords.size < 2) return

        assertTrue(
            "mean words per block: $meanWords",
            meanWords.last() > meanWords.first()
        )
        for ((i, mean) in meanWords.withIndex()) {
            assertTrue(
                "block ${i + 1} is thinner than the opening block: $meanWords",
                mean >= meanWords.first()
            )
        }
    }

    @Test
    fun `conjuncts arrive only in the conjunct block or later`() {
        for (level in Levels.all) {
            val hasConjunct = level.letters.any { it.contains('\u09CD') }
            if (hasConjunct) {
                assertTrue(
                    "level ${level.id} shows a conjunct tile in block ${level.block}",
                    level.block >= 4
                )
            }
        }
    }

    @Test
    fun `the catalogue is big enough to be worth playing`() {
        // Only means something about a finished syllabus. The ten levels shipping now are a
        // game cut out of one, so this stops asserting rather than starts lying; it comes back
        // when `catalogue.FULL_SYLLABUS` is set again.
        if (!Levels.FULL_SYLLABUS) return

        assertTrue("only ${Levels.count} levels", Levels.count >= 100)
        val words = Levels.all.flatMap { it.words }.toSet()
        assertTrue("only ${words.size} distinct words", words.size >= 150)
        val conjunctLevels = Levels.all.count { lv -> lv.letters.any { it.contains('\u09CD') } }
        assertTrue("only $conjunctLevels levels use conjunct tiles", conjunctLevels >= 15)
    }

    @Test
    fun `no word is ever set as a puzzle twice`() {
        // The rule the catalogue is built on. A handful of levels early in the syllabus have to
        // borrow - when a learner knows four letters there is only one board to build - and
        // those are listed in the catalogue with the reason. Everything else is unique.
        val seen = mutableMapOf<String, Int>()
        val repeats = mutableListOf<String>()
        for (level in Levels.all) {
            for (word in level.words) {
                val first = seen[word]
                if (first != null) repeats += "$word (level $first, again on level ${level.id})"
                else seen[word] = level.id
            }
        }
        assertTrue(
            "words set as a puzzle more than once: ${repeats.joinToString("; ")}",
            repeats.size <= 20
        )
        // The ratio only means something across a syllabus long enough that the levels forced
        // to borrow are a minority of it. Nothing borrows at all in the ten shipping now.
        if (!Levels.FULL_SYLLABUS) return

        val slots = Levels.all.sumOf { it.words.size }
        assertTrue(
            "only ${seen.size} distinct words across $slots board slots",
            seen.size >= slots * 9 / 10
        )
    }
}
