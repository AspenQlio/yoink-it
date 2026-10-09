package com.aspen.yoinkit

import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

class VideoPlaylistSelectorTest {

    @Test
    fun `playlist json exposes all nine slides in original order`() {
        val entries = (1..9).joinToString(",") { index ->
            """{"playlist_index":$index,"title":"Slide $index","duration":${index * 10}}"""
        }

        val result = VideoPlaylistSelector.entriesFrom("""{"_type":"playlist","entries":[$entries]}""")

        assertEquals(9, result.size)
        assertEquals(VideoPlaylistEntry(1, "Slide 1", 10), result.first())
        assertEquals(VideoPlaylistEntry(9, "Slide 9", 90), result.last())
    }

    @Test
    fun `single video becomes one selectable slide`() {
        val result = VideoPlaylistSelector.entriesFrom("""{"title":"Only video","duration":42}""")

        assertEquals(listOf(VideoPlaylistEntry(1, "Only video", 42)), result)
    }

    @Test
    fun `selected slides become sorted unique playlist items`() {
        assertEquals("2,9", VideoPlaylistSelector.playlistItems(listOf(9, 2, 2, 0)))
    }

    @Test
    fun `carousel output includes original playlist index`() {
        val directory = File("/tmp/YoinkIt")

        val output = VideoPlaylistSelector.outputTemplate(directory)

        assertEquals("/tmp/YoinkIt/%(playlist_index)02d_%(title)s.%(ext)s", output)
    }
}
