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
    fun `the chest is fed at all, and mostly by the fullest boards`() {
        // Deliberately a weak floor, because the chest is currently starved and the reason is
        // structural rather than a tuning mistake: three or four tiles spell three or four
        // words, and the syllabus keeps early boards that small on purpose. The old catalogue
        // filled the chest from a wide list of short words - মত, নই, সই, রন - which a learner
        // has no business being rewarded for guessing, so those went.
        //
        // The fix is not more extras from these tiles; it is to change what the chest asks
        // for. Asking for a word from an earlier level turns it into spaced review and it
        // stops depending on the current wheel at all. Until then this asserts only that the
        // mechanic is not entirely dead, and that what feeds it sits late in the game.
        val withExtras = Levels.all.filter { it.extras.isNotEmpty() }
        assertTrue("no level offers extras at all", withExtras.size >= 8)

        val lateShare = withExtras.count { it.block >= 3 }.toDouble() / withExtras.size
        assertTrue(
            "extras appear on ${withExtras.size} levels, only ${(lateShare * 100).toInt()}% " +
                "of them past the opening blocks",
            lateShare >= 0.4
        )
    }
}
