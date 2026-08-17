package com.bangla.shobdojot.data

import android.content.Context
import android.content.SharedPreferences
import com.bangla.shobdojot.model.GridPos

/**
 * Player progress, kept in SharedPreferences. Small enough that a key/value store is the
 * right tool — coins, how far the player has unlocked, and per-level progress so leaving
 * a half-solved board and coming back does not throw the work away.
 */
class GameRepository(context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("shobdojot", Context.MODE_PRIVATE)

    var coins: Int
        get() = prefs.getInt(KEY_COINS, STARTING_COINS)
        set(value) = prefs.edit().putInt(KEY_COINS, value.coerceAtLeast(0)).apply()

    /** Highest level the player may open; levels above this stay locked. */
    var unlockedLevel: Int
        get() = prefs.getInt(KEY_UNLOCKED, 1).coerceIn(1, Levels.count)
        set(value) = prefs.edit().putInt(KEY_UNLOCKED, value.coerceIn(1, Levels.count)).apply()

    fun isCompleted(levelId: Int): Boolean = prefs.getBoolean(completedKey(levelId), false)

    fun markCompleted(levelId: Int) {
        prefs.edit().putBoolean(completedKey(levelId), true).apply()
        if (levelId + 1 > unlockedLevel) unlockedLevel = levelId + 1
    }

    /** Extra words found on a level, so none is ever credited twice. */
    fun extraWords(levelId: Int): Set<String> =
        prefs.getStringSet(extrasKey(levelId), emptySet())!!.toSet()

    fun saveExtraWords(levelId: Int, words: Set<String>) {
        prefs.edit().putStringSet(extrasKey(levelId), words).apply()
    }

    /** Total extra words found across every level; the chest fills from this. */
    var extrasCollected: Int
        get() = prefs.getInt(KEY_EXTRAS, 0)
        set(value) = prefs.edit().putInt(KEY_EXTRAS, value.coerceAtLeast(0)).apply()

    fun foundWords(levelId: Int): Set<String> =
        prefs.getStringSet(foundKey(levelId), emptySet())!!.toSet()

    fun saveFoundWords(levelId: Int, words: Set<String>) {
        prefs.edit().putStringSet(foundKey(levelId), words).apply()
    }

    /**
     * Hinted cells survive a restart because [com.bangla.shobdojot.logic.CrosswordGenerator]
     * is deterministic — the same level always lays out on the same coordinates.
     */
    fun hintedCells(levelId: Int): Set<GridPos> =
        prefs.getStringSet(hintKey(levelId), emptySet())!!
            .mapNotNull { encoded ->
                val parts = encoded.split(',')
                val row = parts.getOrNull(0)?.toIntOrNull()
                val col = parts.getOrNull(1)?.toIntOrNull()
                if (row != null && col != null) GridPos(row, col) else null
            }
            .toSet()

    fun saveHintedCells(levelId: Int, cells: Set<GridPos>) {
        prefs.edit()
            .putStringSet(hintKey(levelId), cells.map { "${it.row},${it.col}" }.toSet())
            .apply()
    }

    fun resetLevelProgress(levelId: Int) {
        // The chest total is deliberately left alone: it is earned across the whole game.
        prefs.edit().remove(foundKey(levelId)).remove(hintKey(levelId)).apply()
    }

    fun resetAll() = prefs.edit().clear().apply()

    private fun completedKey(levelId: Int) = "completed_$levelId"
    private fun foundKey(levelId: Int) = "found_$levelId"
    private fun hintKey(levelId: Int) = "hints_$levelId"
    private fun extrasKey(levelId: Int) = "extras_$levelId"

    companion object {
        const val STARTING_COINS = 120
        const val HINT_COST = 25
        const val COINS_PER_AKSHARA = 5
        const val LEVEL_BONUS = 30
        private const val KEY_COINS = "coins"
        private const val KEY_UNLOCKED = "unlocked"
        private const val KEY_EXTRAS = "extras_collected"
    }
}
