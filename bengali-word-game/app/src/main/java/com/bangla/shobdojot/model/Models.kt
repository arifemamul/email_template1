package com.bangla.shobdojot.model

/** A cell coordinate in the crossword grid. */
data class GridPos(val row: Int, val col: Int)

/**
 * One level's content: the tiles on the wheel, the words hidden in the grid, and the extra
 * words those same tiles can spell without being on the board. Finding an extra fills the
 * chest rather than the grid.
 *
 * [block] is the stage of the syllabus this level belongs to - 1 plain letters, 2 one vowel
 * sign, 3 several signs, 4 conjuncts, 5 free play - and levels ship in that order.
 *
 * [teaches] is what this level introduces that no earlier level used: a letter, a vowel sign
 * or a conjunct cluster. Empty means the level is review, which most of them are by design -
 * a piece of the writing system met once and never seen again has not been learned.
 */
data class Level(
    val id: Int,
    val letters: List<String>,
    val words: List<String>,
    val block: Int = 1,
    val teaches: List<String> = emptyList(),
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
