package com.bangla.shobdojot.model

/** A cell coordinate in the crossword grid. */
data class GridPos(val row: Int, val col: Int)

/**
 * One level's content: the tiles on the wheel, the words hidden in the grid, and the extra
 * words those same tiles can spell without being on the board. Finding an extra fills the
 * chest rather than the grid.
 */
data class Level(
    val id: Int,
    val letters: List<String>,
    val words: List<String>,
    val extras: List<String> = emptyList()
)

/** A word after the generator has decided where it sits on the board. */
data class PlacedWord(
    val word: String,
    val aksharas: List<String>,
    val cells: List<GridPos>,
    val horizontal: Boolean
)

/** A laid-out board: grid size, where each word sits, and what letter each cell holds. */
data class Puzzle(
    val rows: Int,
    val cols: Int,
    val words: List<PlacedWord>,
    val cellLetters: Map<GridPos, String>
)
