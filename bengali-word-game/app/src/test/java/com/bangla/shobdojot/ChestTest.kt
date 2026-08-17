package com.bangla.shobdojot

import com.bangla.shobdojot.data.Levels
import com.bangla.shobdojot.logic.BanglaText
import com.bangla.shobdojot.logic.Chest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ChestTest {

    @Test
    fun `a chest fills in three and then starts again`() {
        assertEquals(0, Chest.filled(0))
        assertEquals(1, Chest.filled(1))
        assertEquals(2, Chest.filled(2))
        assertEquals(0, Chest.filled(3))
        assertEquals(1, Chest.filled(4))
    }

    @Test
    fun `only every third extra word pays out`() {
        val payouts = (0 until 9).map { Chest.rewardFor(it) }
        assertEquals(
            listOf(0, 0, Chest.REWARD, 0, 0, Chest.REWARD, 0, 0, Chest.REWARD),
            payouts
        )
    }

    @Test
    fun `payouts never drift from the running total`() {
        var paid = 0
        for (collected in 0 until 40) {
            paid += Chest.rewardFor(collected)
            assertEquals(
                "after ${collected + 1} extras",
                Chest.totalReward(collected + 1),
                paid
            )
        }
    }

    @Test
    fun `a full chest is announced exactly once per three words`() {
        val completions = (1..30).count { Chest.completesChest(it) }
        assertEquals(10, completions)
    }

    @Test
    fun `extra words are spellable from their level's tiles`() {
        for (level in Levels.all) {
            for (extra in level.extras) {
                assertTrue(
                    "level ${level.id}: extra '$extra' needs ${BanglaText.splitAksharas(extra)} " +
                        "but the wheel holds ${level.letters}",
                    BanglaText.isSpellableFrom(extra, level.letters)
                )
            }
        }
    }

    @Test
    fun `an extra word is never also on the board`() {
        for (level in Levels.all) {
            val clash = level.extras.filter { it in level.words }
            assertTrue("level ${level.id} lists $clash as both a word and an extra", clash.isEmpty())
            assertEquals(
                "level ${level.id} repeats an extra",
                level.extras.size,
                level.extras.toSet().size
            )
        }
    }

    @Test
    fun `enough levels offer extras for the chest to be worth showing`() {
        val withExtras = Levels.all.count { it.extras.isNotEmpty() }
        val slots = Levels.all.sumOf { it.extras.size }
        assertTrue("only $withExtras levels offer extras", withExtras >= 20)
        assertTrue("only $slots extra words in the whole game", slots >= 50)
    }
}
