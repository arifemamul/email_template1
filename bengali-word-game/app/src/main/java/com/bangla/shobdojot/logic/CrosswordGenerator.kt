package com.bangla.shobdojot.logic

import com.bangla.shobdojot.model.GridPos
import com.bangla.shobdojot.model.PlacedWord
import com.bangla.shobdojot.model.Puzzle
import kotlin.math.max
import kotlin.math.min

/**
 * Lays a level's words out as a crossword: one word is seeded across the middle and every
 * other word has to hang off a shared akshara, with the usual crossword rule that a new
 * letter may not sit side-on against an unrelated word.
 *
 * Greedy placement is not enough — an early choice can strand a later word — so this
 * backtracks over both the word order and the placement choices. The search is fully
 * deterministic: the same word list always yields the same board, which is what lets the
 * game store hint positions across restarts.
 */
object CrosswordGenerator {

    /** Safety valve so a pathological level can never hang the UI thread. */
    private const val NODE_LIMIT = 200_000

    fun generate(words: List<String>): Puzzle {
        val tokenised = words
            .map { Word(it, BanglaText.splitAksharas(it)) }
            .filter { it.aksharas.isNotEmpty() }
            .sortedWith(compareByDescending<Word> { it.aksharas.size }.thenBy { it.text })

        if (tokenised.isEmpty()) return Puzzle(0, 0, emptyList(), emptyMap())

        // Seed with each word in turn; the first seed that lets every word attach wins.
        for (seedIndex in tokenised.indices) {
            val order = listOf(tokenised[seedIndex]) +
                tokenised.filterIndexed { i, _ -> i != seedIndex }
            val board = Board()
            board.place(order[0], Placement(GridPos(0, 0), horizontal = true))

            val search = Search(order, board)
            if (search.solve(1)) return board.toPuzzle()
        }

        // No fully connected board exists for this word list. Rather than fail, fall back
        // to greedy placement and park the leftovers on their own rows.
        val board = Board()
        for ((index, word) in tokenised.withIndex()) {
            val placement = if (index == 0) {
                Placement(GridPos(0, 0), horizontal = true)
            } else {
                board.candidates(word.aksharas).firstOrNull() ?: board.detachedPlacement()
            }
            board.place(word, placement)
        }
        return board.toPuzzle()
    }

    private data class Word(val text: String, val aksharas: List<String>)

    private data class Placement(val start: GridPos, val horizontal: Boolean)

    private class Search(private val order: List<Word>, private val board: Board) {
        private var nodes = 0

        /** Depth-first placement of `order[index until size]`, undoing dead ends. */
        fun solve(index: Int): Boolean {
            if (index == order.size) return true
            if (++nodes > NODE_LIMIT) return false

            val word = order[index]
            for (placement in board.candidates(word.aksharas)) {
                val undo = board.place(word, placement)
                if (solve(index + 1)) return true
                board.undo(undo)
            }
            return false
        }
    }

    private class Board {
        private val occupied = HashMap<GridPos, String>()
        private val placed = mutableListOf<PlacedWord>()

        class Undo(val addedCells: List<GridPos>)

        fun place(word: Word, placement: Placement): Undo {
            val cells = cellsFor(placement, word.aksharas.size)
            val added = cells.filterNot { occupied.containsKey(it) }
            cells.forEachIndexed { i, pos -> occupied[pos] = word.aksharas[i] }
            placed += PlacedWord(word.text, word.aksharas, cells, placement.horizontal)
            return Undo(added)
        }

        fun undo(undo: Undo) {
            placed.removeAt(placed.lastIndex)
            undo.addedCells.forEach { occupied.remove(it) }
        }

        /** Every legal placement for [aksharas], best crossings and tightest board first. */
        fun candidates(aksharas: List<String>): List<Placement> {
            val scored = LinkedHashMap<Placement, Pair<Int, Int>>()
            val anchors = occupied.entries.sortedWith(compareBy({ it.key.row }, { it.key.col }))

            for ((anchorPos, anchorLetter) in anchors) {
                for (index in aksharas.indices) {
                    if (aksharas[index] != anchorLetter) continue
                    for (horizontal in listOf(true, false)) {
                        val start = if (horizontal) {
                            GridPos(anchorPos.row, anchorPos.col - index)
                        } else {
                            GridPos(anchorPos.row - index, anchorPos.col)
                        }
                        val placement = Placement(start, horizontal)
                        if (scored.containsKey(placement)) continue
                        val crossings = score(aksharas, placement) ?: continue
                        scored[placement] = crossings to areaWith(cellsFor(placement, aksharas.size))
                    }
                }
            }

            return scored.entries
                .sortedWith(
                    compareByDescending<Map.Entry<Placement, Pair<Int, Int>>> { it.value.first }
                        .thenBy { it.value.second }
                        .thenBy { it.key.start.row }
                        .thenBy { it.key.start.col }
                        .thenBy { !it.key.horizontal }
                )
                .map { it.key }
        }

        /**
         * Crossing count for a legal placement, or null when it is illegal: a letter clash,
         * a word butting straight onto another, no crossing at all, a word lying entirely
         * on top of existing letters, or a new letter touching another word side-on (which
         * would spell a second, unintended word).
         */
        private fun score(aksharas: List<String>, placement: Placement): Int? {
            val dRow = if (placement.horizontal) 0 else 1
            val dCol = if (placement.horizontal) 1 else 0
            val pRow = if (placement.horizontal) 1 else 0
            val pCol = if (placement.horizontal) 0 else 1
            val start = placement.start

            val before = GridPos(start.row - dRow, start.col - dCol)
            val after = GridPos(start.row + dRow * aksharas.size, start.col + dCol * aksharas.size)
            if (occupied.containsKey(before) || occupied.containsKey(after)) return null

            var crossings = 0
            for (i in aksharas.indices) {
                val pos = GridPos(start.row + dRow * i, start.col + dCol * i)
                val existing = occupied[pos]
                if (existing != null) {
                    if (existing != aksharas[i]) return null
                    crossings++
                } else {
                    val sideA = GridPos(pos.row + pRow, pos.col + pCol)
                    val sideB = GridPos(pos.row - pRow, pos.col - pCol)
                    if (occupied.containsKey(sideA) || occupied.containsKey(sideB)) return null
                }
            }

            if (crossings == 0 || crossings == aksharas.size) return null
            return crossings
        }

        private fun areaWith(extra: List<GridPos>): Int {
            var minRow = Int.MAX_VALUE
            var maxRow = Int.MIN_VALUE
            var minCol = Int.MAX_VALUE
            var maxCol = Int.MIN_VALUE
            for (pos in occupied.keys.asSequence() + extra.asSequence()) {
                minRow = min(minRow, pos.row)
                maxRow = max(maxRow, pos.row)
                minCol = min(minCol, pos.col)
                maxCol = max(maxCol, pos.col)
            }
            return (maxRow - minRow + 1) * (maxCol - minCol + 1)
        }

        fun detachedPlacement(): Placement =
            Placement(GridPos(occupied.keys.maxOf { it.row } + 2, occupied.keys.minOf { it.col }), true)

        /** Shifts the board to start at (0, 0) and reports its final size. */
        fun toPuzzle(): Puzzle {
            if (occupied.isEmpty()) return Puzzle(0, 0, emptyList(), emptyMap())

            val minRow = occupied.keys.minOf { it.row }
            val minCol = occupied.keys.minOf { it.col }
            fun shift(pos: GridPos) = GridPos(pos.row - minRow, pos.col - minCol)

            val cellLetters = occupied.mapKeys { shift(it.key) }
            return Puzzle(
                rows = cellLetters.keys.maxOf { it.row } + 1,
                cols = cellLetters.keys.maxOf { it.col } + 1,
                words = placed.map { word -> word.copy(cells = word.cells.map(::shift)) },
                cellLetters = cellLetters
            )
        }

        private fun cellsFor(placement: Placement, length: Int): List<GridPos> =
            (0 until length).map { i ->
                if (placement.horizontal) {
                    GridPos(placement.start.row, placement.start.col + i)
                } else {
                    GridPos(placement.start.row + i, placement.start.col)
                }
            }
    }
}
