package com.aspen.yoinkit

import org.junit.Assert.assertTrue
import org.junit.Test

class VideoFormatSelectorTest {

    @Test
    fun `format sort prioritizes h264 video and m4a aac audio`() {
        assertTrue(VideoFormatSelector.FORMAT_SORT.contains("vcodec:h264"))
        assertTrue(VideoFormatSelector.FORMAT_SORT.contains("acodec:m4a"))
    }

    @Test
    fun `high quality prioritizes avc1 and avc codecs before generic mp4`() {
        val format = VideoFormatSelector.formatFor("high")
        assertTrue(format.contains("bestvideo[vcodec^=avc1][ext=mp4]+bestaudio[ext=m4a]"))
        assertTrue(format.contains("bestvideo[vcodec^=avc]+bestaudio[ext=m4a]"))
    }

    @Test
    fun `medium quality enforces 720p maximum height with avc priority`() {
        val format = VideoFormatSelector.formatFor("medium")
        assertTrue(format.contains("height<=720"))
        assertTrue(format.contains("vcodec^=avc1"))
    }

    @Test
    fun `low quality enforces 480p maximum height with avc priority`() {
        val format = VideoFormatSelector.formatFor("low")
        assertTrue(format.contains("height<=480"))
        assertTrue(format.contains("vcodec^=avc1"))
    }
}
