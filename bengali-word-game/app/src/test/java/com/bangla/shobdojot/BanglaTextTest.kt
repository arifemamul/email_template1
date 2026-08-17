package com.bangla.shobdojot

import com.bangla.shobdojot.logic.BanglaText
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BanglaTextTest {

    @Test
    fun `plain consonants are one akshara each`() {
        assertEquals(listOf("ক", "ম", "ল"), BanglaText.splitAksharas("কমল"))
    }

    @Test
    fun `vowel signs stay attached to their consonant`() {
        assertEquals(listOf("মা", "ছ"), BanglaText.splitAksharas("মাছ"))
        assertEquals(listOf("দা", "না"), BanglaText.splitAksharas("দানা"))
        assertEquals(listOf("বি", "দে", "শ"), BanglaText.splitAksharas("বিদেশ"))
    }

    @Test
    fun `hasanta glues a conjunct into a single akshara`() {
        assertEquals(listOf("ব", "ন্ধু"), BanglaText.splitAksharas("বন্ধু"))
        assertEquals(listOf("রা", "স্তা"), BanglaText.splitAksharas("রাস্তা"))
        assertEquals(listOf("বৃ", "ষ্টি"), BanglaText.splitAksharas("বৃষ্টি"))
    }

    @Test
    fun `anusvara rides along with the letter before it`() {
        assertEquals(listOf("বাং", "লা"), BanglaText.splitAksharas("বাংলা"))
    }

    @Test
    fun `letters with nukta plus a vowel sign form one unit`() {
        assertEquals(listOf("বা", "ড়ি"), BanglaText.splitAksharas("বাড়ি"))
    }

    @Test
    fun `independent vowels stand alone`() {
        assertEquals(listOf("আ", "ম", "রা"), BanglaText.splitAksharas("আমরা"))
        assertEquals(listOf("ব", "ই"), BanglaText.splitAksharas("বই"))
    }

    @Test
    fun `spellable respects the one-use-per-tile rule`() {
        val tiles = listOf("ক", "ম", "ল")
        assertTrue(BanglaText.isSpellableFrom("কমল", tiles))
        assertTrue(BanglaText.isSpellableFrom("কম", tiles))
        assertFalse(BanglaText.isSpellableFrom("কককক", tiles))
        assertFalse(BanglaText.isSpellableFrom("মলম", tiles)) // ম is only on the wheel once
    }

    @Test
    fun `numbers render in Bengali digits`() {
        assertEquals("০", BanglaText.digits(0))
        assertEquals("২৫", BanglaText.digits(25))
        assertEquals("১২০", BanglaText.digits(120))
    }

    @Test
    fun `empty input yields no aksharas`() {
        assertEquals(emptyList<String>(), BanglaText.splitAksharas(""))
        assertEquals(0, BanglaText.length(""))
    }
}
