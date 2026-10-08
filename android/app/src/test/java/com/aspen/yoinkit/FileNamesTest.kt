package com.aspen.yoinkit

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class FileNamesTest {

    @Test
    fun `strips characters that are illegal on Android storage`() {
        assertEquals("my photo 2026", FileNames.sanitize("my/photo:2026?"))
    }

    @Test
    fun `collapses whitespace runs and trims edges`() {
        assertEquals("a b c", FileNames.sanitize("  a   b \n c  "))
    }

    @Test
    fun `trims leading and trailing dots`() {
        assertEquals("hidden", FileNames.sanitize("..hidden.."))
    }

    @Test
    fun `blank titles fall back to a safe default`() {
        assertEquals("yoink", FileNames.sanitize("   "))
        assertEquals("post", FileNames.sanitize("", fallback = "post"))
    }

    @Test
    fun `long titles are truncated to the limit`() {
        val sanitized = FileNames.sanitize("x".repeat(120), maxLength = 60)

        assertEquals(60, sanitized.length)
        assertTrue(sanitized.all { it == 'x' })
    }

    @Test
    fun `build appends a zero padded index and normalized extension`() {
        assertEquals("my_photo_01.jpg", FileNames.build("my_photo", 1, "jpeg"))
        assertEquals("my_photo_12.webp", FileNames.build("my_photo", 12, "WEBP"))
    }

    @Test
    fun `build refuses a non image extension`() {
        assertEquals("clip_01.jpg", FileNames.build("clip", 1, "mp4"))
    }
}