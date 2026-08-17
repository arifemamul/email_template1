package com.bangla.shobdojot

import com.bangla.shobdojot.data.Levels
import com.bangla.shobdojot.logic.BanglaText
import com.bangla.shobdojot.logic.CrosswordGenerator
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Content checks for every shipped level. A level that fails here is unplayable — the
 * player would see tiles that spell nothing, or a board with a word floating off on its
 * own — so this runs over the whole catalogue rather than a sample.
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
    fun `the first five levels are the smallest in the game`() {
        // They exist to teach the drag and the idea that a tile is a letter unit. Three plain
        // consonants, three short words, nothing else to look at.
        for (level in Levels.all.take(5)) {
            assertEquals("level ${level.id} tile count", 3, level.letters.size)
            assertEquals("level ${level.id} word count", 3, level.words.size)
            val longest = level.words.maxOf { BanglaText.length(it) }
            assertTrue("level ${level.id} has a $longest-akshara word", longest <= 3)
            assertTrue(
                "level ${level.id} opens with a conjunct tile",
                level.letters.none { it.contains('\u09CD') }
            )
        }
    }

    @Test
    fun `difficulty climbs across the game`() {
        // Word count is the main dial — finding six words from one wheel is what makes a
        // board take a while — so the ramp is asserted on the trend rather than level to
        // level, which wobbles by design as several factors trade off.
        val thirds = Levels.all.chunked((Levels.count + 2) / 3)
        val tiles = thirds.map { third -> third.map { it.letters.size }.average() }
        val words = thirds.map { third -> third.map { it.words.size }.average() }

        assertTrue("mean tiles per third: $tiles", tiles[0] < tiles[1] && tiles[1] < tiles[2])
        assertTrue("mean words per third: $words", words[0] < words[1] && words[1] < words[2])
    }

    @Test
    fun `no level lurches away from its neighbours`() {
        for (i in 1 until Levels.count) {
            val drop = Levels.all[i].words.size - Levels.all[i - 1].words.size
            assertTrue(
                "level ${i + 1} asks for $drop fewer words than level $i",
                drop >= -2
            )
        }
    }

    @Test
    fun `the last level is one of the biggest`() {
        val last = Levels.all.last()
        assertTrue("last level has ${last.letters.size} tiles", last.letters.size >= 5)
        assertTrue("last level has ${last.words.size} words", last.words.size >= 6)
    }

    @Test
    fun `the catalogue is big enough to be worth playing`() {
        assertTrue("only ${Levels.count} levels", Levels.count >= 70)
        val words = Levels.all.flatMap { it.words }.toSet()
        assertTrue("only ${words.size} distinct words", words.size >= 150)
        val conjunctLevels = Levels.all.count { lv -> lv.letters.any { it.contains('\u09CD') } }
        assertTrue("only $conjunctLevels levels use conjunct tiles", conjunctLevels >= 10)
    }
}
