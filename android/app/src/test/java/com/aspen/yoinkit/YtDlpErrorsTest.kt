package com.aspen.yoinkit

import org.junit.Assert.assertEquals
import org.junit.Test

class YtDlpErrorsTest {

    @Test
    fun `instagram login or rate limit error becomes actionable`() {
        val raw = "ERROR: [Instagram] Requested content is not available, rate-limit reached or login required."

        val message = YtDlpErrors.userMessage(raw)

        assertEquals(
            "Instagram requires login or temporarily limited this device. Try again later; cookie login is not supported yet.",
            message
        )
    }

    @Test
    fun `unrelated error remains unchanged`() {
        assertEquals("network timeout", YtDlpErrors.userMessage("network timeout"))
    }

    @Test
    fun `instagram image-only post explains extractor limitation`() {
        val raw = "ERROR: [Instagram] Ddy4dtqFPdQ: No video formats found!"

        val message = YtDlpErrors.userMessage(raw)

        assertEquals(
            "This Instagram post contains images that yt-dlp cannot extract yet. Instagram image posts need a dedicated image engine.",
            message
        )
    }
}
