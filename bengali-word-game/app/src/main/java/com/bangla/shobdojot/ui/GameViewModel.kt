package com.bangla.shobdojot.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import com.bangla.shobdojot.data.GameRepository
import com.bangla.shobdojot.data.Levels
import com.bangla.shobdojot.logic.BanglaText
import com.bangla.shobdojot.logic.Chest
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

    /** A real word the tiles can spell that is not on the board: it fills the chest. */
    EXTRA,

    /** Already credited, on the board or in the chest. */
    ALREADY_FOUND,

    WRONG
}

data class GameUiState(
    val level: Level? = null,
    val puzzle: Puzzle? = null,
    val wheelLetters: List<String> = emptyList(),
    val foundWords: Set<String> = emptySet(),
    val hintedCells: Set<GridPos> = emptySet(),
    val extraWords: Set<String> = emptySet(),
    /** Extra words found across every level; the chest fills from this. */
    val extrasCollected: Int = 0,
    val coins: Int = 0,
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

    /** Slots filled in the current chest, and how many a chest holds. */
    val chestFilled: Int get() = Chest.filled(extrasCollected)
    val chestTarget: Int get() = Chest.TARGET

    /** Extra words this level still has to offer, for a "keep looking" hint. */
    val extrasRemaining: Int
        get() = ((level?.extras ?: emptyList()) - extraWords).size
}

class GameViewModel(application: Application) : AndroidViewModel(application) {

    private val repo = GameRepository(application)

    private val _state = MutableStateFlow(
        GameUiState(coins = repo.coins, unlockedLevel = repo.unlockedLevel)
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
            extraWords = repo.extraWords(levelId).filter { it in level.extras }.toSet(),
            extrasCollected = repo.extrasCollected,
            coins = repo.coins,
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
            word in _state.value.extraWords -> WordResult.ALREADY_FOUND
            word in level.extras -> WordResult.EXTRA
            else -> WordResult.WRONG
        }

        if (result == WordResult.EXTRA) return collectExtra(level, word)
        if (result != WordResult.CORRECT) return result

        val found = _state.value.foundWords + word
        val reward = BanglaText.length(word) * GameRepository.COINS_PER_AKSHARA
        val justCompleted = found.size == level.words.size
        val coins = repo.coins + reward + if (justCompleted) GameRepository.LEVEL_BONUS else 0

        repo.coins = coins
        repo.saveFoundWords(level.id, found)
        if (justCompleted) repo.markCompleted(level.id)

        _state.update {
            it.copy(
                foundWords = found,
                coins = coins,
                completed = justCompleted,
                unlockedLevel = repo.unlockedLevel
            )
        }
        return WordResult.CORRECT
    }

    /**
     * Credits an extra word: it fills the chest rather than the board, and a full chest pays
     * out. The chest total carries across levels.
     */
    private fun collectExtra(level: Level, word: String): WordResult {
        val found = _state.value.extraWords + word
        val before = repo.extrasCollected
        val reward = Chest.rewardFor(before)
        val coins = repo.coins + reward

        repo.extrasCollected = before + 1
        repo.saveExtraWords(level.id, found)
        repo.coins = coins

        _state.update {
            it.copy(extraWords = found, extrasCollected = before + 1, coins = coins)
        }
        return WordResult.EXTRA
    }

    /** Buys one letter: reveals a cell from a word the player has not solved yet. */
    fun useHint(): Boolean {
        val current = _state.value
        val level = current.level ?: return false
        val puzzle = current.puzzle ?: return false
        if (current.coins < GameRepository.HINT_COST) return false

        val revealed = current.revealedCells
        val target = puzzle.words
            .filterNot { it.word in current.foundWords }
            .flatMap { it.cells }
            .firstOrNull { it !in revealed }
            ?: return false

        val coins = repo.coins - GameRepository.HINT_COST
        val hinted = current.hintedCells + target
        repo.coins = coins
        repo.saveHintedCells(level.id, hinted)

        _state.update { it.copy(coins = coins, hintedCells = hinted) }
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
        _state.update { it.copy(coins = repo.coins, unlockedLevel = repo.unlockedLevel) }
    }
}
