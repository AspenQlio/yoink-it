package com.aspen.yoinkit

internal object YtDlpErrors {
    private const val INSTAGRAM_AUTH_MESSAGE =
        "Instagram requires login or temporarily limited this device. Try again later; cookie login is not supported yet."
    private const val INSTAGRAM_IMAGE_MESSAGE =
        "This Instagram post contains images that yt-dlp cannot extract yet. Instagram image posts need a dedicated image engine."
    private const val INVALID_LINK_MESSAGE =
        "This link is invalid, expired, or no longer exposes downloadable media. Copy a new share link and try again."

    fun userMessage(raw: String?): String {
        val message = raw?.trim().orEmpty().ifBlank { "yt-dlp failed" }
        val normalized = message.lowercase()
        val isInstagramAuthFailure = "instagram" in normalized && (
            "login required" in normalized ||
                "rate-limit reached" in normalized ||
                "locked behind the login page" in normalized
            )
        val isInstagramImageFailure = "instagram" in normalized && "no video formats found" in normalized
        val isInvalidOrExpiredLink =
            "404 not found" in normalized ||
                "unsupported url" in normalized ||
                "no downloadable media found" in normalized
        return when {
            isInstagramAuthFailure -> INSTAGRAM_AUTH_MESSAGE
            isInstagramImageFailure -> INSTAGRAM_IMAGE_MESSAGE
            isInvalidOrExpiredLink -> INVALID_LINK_MESSAGE
            else -> message
        }
    }
}
