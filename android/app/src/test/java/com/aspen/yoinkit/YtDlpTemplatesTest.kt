package com.aspen.yoinkit

import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

class YtDlpTemplatesTest {

    @Test
    fun `scan output uses yt-dlp zero padding syntax`() {
        val cacheDirectory = File("/tmp/yoink_scan")

        val output = YtDlpTemplates.scanOutput(cacheDirectory)

        assertEquals("/tmp/yoink_scan/%(autonumber)02d.%(ext)s", output)
    }
}
