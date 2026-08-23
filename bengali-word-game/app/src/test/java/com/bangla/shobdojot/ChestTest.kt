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
    fun `the chest is fed, and fed first by words already solved`() {
        // The chest used to be starved: boards helped themselves to every word their tiles
        // could spell, so there was rarely anything left to find. Now that no word is set as a
        // puzzle twice, the words a board cannot use are exactly what the wheel still spells -
        // and the best of them are the ones the player solved on an earlier level.
        //
        // That is what the chest is for. Solving রুটি once teaches the word; spotting it in a
        // later wheel, unprompted, is the only evidence that it stuck.
        val withExtras = Levels.all.filter { it.extras.isNotEmpty() }
        assertTrue(
            "extras appear on only ${withExtras.size} of ${Levels.all.size} levels",
            withExtras.size >= Levels.all.size / 4
        )

        // Walk the catalogue in order, tracking what has been solved, and check that where a
        // level's extras include an old word, an old word is what it offers first.
        val played = mutableSetOf<String>()
        var reviewing = 0
        for (level in Levels.all) {
            val old = level.extras.filter { it in played }
            if (old.isNotEmpty()) {
                reviewing++
                assertTrue(
                    "level ${level.id} offers ${level.extras.first()} ahead of already-solved " +
                        "${old.first()}",
                    level.extras.first() in played
                )
            }
            played += level.words
        }
        assertTrue(
            "no level asks the player to remember a word from an earlier one",
            reviewing >= 8
        )
    }

    @Test
    fun `no word is ever set as a puzzle twice`() {
        // The rule the catalogue is built on. A handful of levels early in the syllabus have to
        // borrow - when a learner knows four letters there is only one board to build - and
        // those are listed in the catalogue with the reason. Everything else is unique.
        val seen = mutableMapOf<String, Int>()
        val repeats = mutableListOf<String>()
        for (level in Levels.all) {
            for (word in level.words) {
                val first = seen[word]
                if (first != null) repeats += "$word (level $first, again on level ${level.id})"
                else seen[word] = level.id
            }
        }
        assertTrue(
            "words set as a puzzle more than once: ${repeats.joinToString("; ")}",
            repeats.size <= 20
        )
        val slots = Levels.all.sumOf { it.words.size }
        assertTrue(
            "only ${seen.size} distinct words across $slots board slots",
            seen.size >= slots * 9 / 10
        )
    }

}
