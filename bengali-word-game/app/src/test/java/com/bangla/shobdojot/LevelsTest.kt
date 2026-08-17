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
    fun `the first levels stay gentle`() {
        // A hard level at the front would meet the player before they know what a tile is.
        for (level in Levels.all.take(8)) {
            assertTrue("level ${level.id} opens with ${level.letters.size} tiles",
                level.letters.size <= 4)
            val longest = level.words.maxOf { BanglaText.length(it) }
            assertTrue("level ${level.id} opens with a $longest-akshara word", longest <= 3)
            assertTrue(
                "level ${level.id} opens with a conjunct tile",
                level.letters.none { it.contains('\u09CD') }
            )
        }
    }

    @Test
    fun `difficulty ramps rather than jumping about`() {
        // Tile count is the coarsest difficulty dial; it should never fall far as ids rise.
        val tiles = Levels.all.map { it.letters.size }
        for (i in 1 until tiles.size) {
            assertTrue(
                "level ${i + 1} drops to ${tiles[i]} tiles from ${tiles[i - 1]}",
                tiles[i] >= tiles[i - 1] - 1
            )
        }
        assertTrue("the last level should be one of the biggest", tiles.last() >= tiles.max() - 1)
    }

    @Test
    fun `the catalogue is big enough to be worth playing`() {
        assertTrue("only ${Levels.count} levels", Levels.count >= 60)
        val words = Levels.all.flatMap { it.words }.toSet()
        assertTrue("only ${words.size} distinct words", words.size >= 150)
        val conjunctLevels = Levels.all.count { lv -> lv.letters.any { it.contains('\u09CD') } }
        assertTrue("only $conjunctLevels levels use conjunct tiles", conjunctLevels >= 10)
    }
}
