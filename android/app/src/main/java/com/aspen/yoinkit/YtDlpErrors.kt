package com.aspen.yoinkit

internal object YtDlpErrors {
    private const val INSTAGRAM_AUTH_MESSAGE =
        "Instagram requires login or temporarily limited this device. Try again later; cookie login is not supported yet."
    private const val INSTAGRAM_IMAGE_MESSAGE =
        "This Instagram post contains images that yt-dlp cannot extract yet. Instagram image posts need a dedicated image engine."

    fun userMessage(raw: String?): String {
        val message = raw?.trim().orEmpty().ifBlank { "yt-dlp failed" }
        val normalized = message.lowercase()
        val isInstagramAuthFailure = "instagram" in normalized && (
            "login required" in normalized ||
                "rate-limit reached" in normalized ||
                "locked behind the login page" in normalized
            )
        val isInstagramImageFailure = "instagram" in normalized && "no video formats found" in normalized
        return when {
            isInstagramAuthFailure -> INSTAGRAM_AUTH_MESSAGE
            isInstagramImageFailure -> INSTAGRAM_IMAGE_MESSAGE
            else -> message
        }
    }
}
