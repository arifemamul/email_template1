package com.bangla.shobdojot.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import com.bangla.shobdojot.data.GameRepository
import com.bangla.shobdojot.data.Levels
import com.bangla.shobdojot.logic.CrosswordGenerator
import com.bangla.shobdojot.model.GridPos
import com.bangla.shobdojot.model.Level
import com.bangla.shobdojot.model.Puzzle
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

/** What happened to the word the player just released the wheel on. */
enum class WordResult {
    /** A word on the board: it fills the grid. */
    CORRECT,

    /** Already credited. */
    ALREADY_FOUND,

    WRONG
}

data class GameUiState(
    val level: Level? = null,
    val puzzle: Puzzle? = null,
    val wheelLetters: List<String> = emptyList(),
    val foundWords: Set<String> = emptySet(),
    val hintedCells: Set<GridPos> = emptySet(),
    val unlockedLevel: Int = 1,
    val completed: Boolean = false
) {
    /** Cells the player has earned the right to see: solved words plus bought hints. */
    val revealedCells: Set<GridPos>
        get() {
            val puzzle = puzzle ?: return hintedCells
            val solved = puzzle.words
                .filter { it.word in foundWords }
                .flatMap { it.cells }
            return solved.toSet() + hintedCells
        }

    val totalWords: Int get() = level?.words?.size ?: 0
}

class GameViewModel(application: Application) : AndroidViewModel(application) {

    private val repo = GameRepository(application)

    private val _state = MutableStateFlow(
        GameUiState(unlockedLevel = repo.unlockedLevel)
    )
    val state: StateFlow<GameUiState> = _state.asStateFlow()

    fun isCompleted(levelId: Int) = repo.isCompleted(levelId)

    fun loadLevel(levelId: Int) {
        val level = Levels.byId(levelId) ?: return
        val puzzle = CrosswordGenerator.generate(level.words)
        val found = repo.foundWords(levelId).filter { it in level.words }.toSet()

        _state.value = GameUiState(
            level = level,
            puzzle = puzzle,
            wheelLetters = level.letters,
            foundWords = found,
            hintedCells = repo.hintedCells(levelId).filter { it in puzzle.cellLetters }.toSet(),
            unlockedLevel = repo.unlockedLevel,
            completed = found.size == level.words.size
        )
    }

    /** Handles the word the player traced on the wheel and reports how it went. */
    fun submitWord(word: String): WordResult {
        val level = _state.value.level ?: return WordResult.WRONG

        val result = when {
            word in _state.value.foundWords -> WordResult.ALREADY_FOUND
            word in level.words -> WordResult.CORRECT
            else -> WordResult.WRONG
        }

        if (result != WordResult.CORRECT) return result

        val found = _state.value.foundWords + word
        val justCompleted = found.size == level.words.size

        repo.saveFoundWords(level.id, found)
        if (justCompleted) repo.markCompleted(level.id)

        _state.update {
            it.copy(
                foundWords = found,
                completed = justCompleted,
                unlockedLevel = repo.unlockedLevel
            )
        }
        return WordResult.CORRECT
    }

    /**
     * Reveals one letter from a word the player has not solved yet. Free, and as many times as
     * they like: there is no score in this game, so there is nothing for a hint to cost.
     */
    fun useHint(): Boolean {
        val current = _state.value
        val level = current.level ?: return false
        val puzzle = current.puzzle ?: return false

        val revealed = current.revealedCells
        val target = puzzle.words
            .filterNot { it.word in current.foundWords }
            .flatMap { it.cells }
            .firstOrNull { it !in revealed }
            ?: return false

        val hinted = current.hintedCells + target
        repo.saveHintedCells(level.id, hinted)

        _state.update { it.copy(hintedCells = hinted) }
        return true
    }

    /** Rotates the wheel tiles; purely cosmetic, and never costs the player anything. */
    fun shuffleWheel() {
        _state.update { it.copy(wheelLetters = it.wheelLetters.shuffled()) }
    }

    fun nextLevelId(): Int? {
        val current = _state.value.level?.id ?: return null
        return if (current < Levels.count) current + 1 else null
    }

    fun replayLevel() {
        val level = _state.value.level ?: return
        repo.resetLevelProgress(level.id)
        loadLevel(level.id)
    }

    fun refreshProgress() {
        _state.update { it.copy(unlockedLevel = repo.unlockedLevel) }
    }
}
