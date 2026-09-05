package com.bangla.shobdojot

import com.bangla.shobdojot.logic.CrosswordGenerator
import com.bangla.shobdojot.model.GridPos
import com.bangla.shobdojot.model.Puzzle
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CrosswordGeneratorTest {

    @Test
    fun `every word reads back off the board`() {
        val puzzle = CrosswordGenerator.generate(listOf("কম", "কল", "মল", "কমল"))
        assertEquals(4, puzzle.words.size)
        for (word in puzzle.words) {
            val readBack = word.cells.joinToString("") { puzzle.cellLetters.getValue(it) }
            assertEquals(word.word, readBack)
        }
    }

    @Test
    fun `board is a single connected shape`() {
        val puzzle = CrosswordGenerator.generate(listOf("দিন", "রাত", "দিনরাত"))
        assertTrue(isConnected(puzzle))
    }

    @Test
    fun `no cell falls outside the reported grid size`() {
        val puzzle = CrosswordGenerator.generate(listOf("ফুল", "গান", "বাগান", "ফুলবাগান"))
        for (pos in puzzle.cellLetters.keys) {
            assertTrue(pos.row in 0 until puzzle.rows)
            assertTrue(pos.col in 0 until puzzle.cols)
        }
    }

    @Test
    fun `words never lie flush alongside each other`() {
        // Two words running side by side would spell unintended vertical words.
        val puzzle = CrosswordGenerator.generate(listOf("চার", "কার", "চাবি"))
        assertNoUnintendedRuns(puzzle)
    }

    @Test
    fun `layout is deterministic across runs`() {
        val words = listOf("সার", "নগর", "সাগর")
        val first = CrosswordGenerator.generate(words)
        val second = CrosswordGenerator.generate(words)
        assertEquals(first.cellLetters, second.cellLetters)
        assertEquals(first.words.map { it.cells }, second.words.map { it.cells })
    }

    @Test
    fun `a single word lays out on one row`() {
        val puzzle = CrosswordGenerator.generate(listOf("মাছ"))
        assertEquals(1, puzzle.rows)
        assertEquals(2, puzzle.cols)
    }

    @Test
    fun `an empty word list produces an empty board`() {
        val puzzle = CrosswordGenerator.generate(emptyList())
        assertEquals(0, puzzle.rows)
        assertEquals(0, puzzle.cols)
    }

    companion object {

        fun isConnected(puzzle: Puzzle): Boolean {
            val cells = puzzle.cellLetters.keys
            if (cells.isEmpty()) return true
            val seen = mutableSetOf(cells.first())
            val queue = ArrayDeque(listOf(cells.first()))
            while (queue.isNotEmpty()) {
                val pos = queue.removeFirst()
                val neighbours = listOf(
                    GridPos(pos.row + 1, pos.col), GridPos(pos.row - 1, pos.col),
                    GridPos(pos.row, pos.col + 1), GridPos(pos.row, pos.col - 1)
                )
                for (next in neighbours) {
                    if (next in cells && seen.add(next)) queue.addLast(next)
                }
            }
            return seen.size == cells.size
        }

        /**
         * Every horizontal and vertical run of two or more filled cells must be one of the
         * level's words - anything else is an accidental word the player cannot solve.
         * A lone filled cell is fine: it is the middle of a word running the other way.
         */
        fun assertNoUnintendedRuns(puzzle: Puzzle) {
            val expected = puzzle.words.map { it.word }.toSet()
            val runs = mutableListOf<List<String>>()

            fun collect(outer: Int, inner: Int, cellAt: (Int, Int) -> String?) {
                for (a in 0 until outer) {
                    var current = mutableListOf<String>()
                    for (b in 0..inner) {
                        val letter = if (b < inner) cellAt(a, b) else null
                        if (letter == null) {
                            if (current.size >= 2) runs += current
                            current = mutableListOf()
                        } else {
                            current += letter
                        }
                    }
                }
            }

            collect(puzzle.rows, puzzle.cols) { row, col -> puzzle.cellLetters[GridPos(row, col)] }
            collect(puzzle.cols, puzzle.rows) { col, row -> puzzle.cellLetters[GridPos(row, col)] }

            val stray = runs.map { it.joinToString("") }.filter { it !in expected }
            assertTrue("unintended words on the board: $stray", stray.isEmpty())
        }
    }
}
