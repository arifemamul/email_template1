package com.bangla.shobdojot.logic

/**
 * The extra-words chest.
 *
 * An extra word is one the level's tiles can spell that is not on the board. Finding one
 * fills the chest rather than the grid; a full chest pays coins and starts again.
 *
 * The chest is shared across levels rather than reset with each one. Three- and four-tile
 * boards do not always have extras to find, and a chest that sits permanently empty teaches
 * the player to ignore it.
 */
object Chest {

    const val TARGET = 3
    const val REWARD = 15

    /** How many of the current chest's slots are filled, 0 until [TARGET] - 1. */
    fun filled(collected: Int): Int = if (collected <= 0) 0 else collected % TARGET

    /** Whether collecting the nth extra word completes a chest. */
    fun completesChest(collected: Int): Boolean = collected > 0 && collected % TARGET == 0

    /** Coins owed for reaching [collected] total extras, counting every full chest. */
    fun totalReward(collected: Int): Int = (collected / TARGET) * REWARD

    /** Coins paid out by the extra word that took the total from [before] to [before] + 1. */
    fun rewardFor(before: Int): Int =
        totalReward(before + 1) - totalReward(before)
}
