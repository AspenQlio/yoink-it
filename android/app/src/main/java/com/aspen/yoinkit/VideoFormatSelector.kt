package com.aspen.yoinkit

/**
 * Generates yt-dlp format selection strings and sorting rules optimized for
 * mobile and social media compatibility (specifically Instagram Stories/Reels,
 * WhatsApp Status, and Android MediaCodec decoders).
 *
 * Instagram Stories hardware video decoders fail to render AV1 (av01) or VP9 (vp09)
 * video streams on Android, causing a black screen during story creation.
 * These selectors guarantee H.264 (AVC) video and AAC audio are prioritized,
 * with fallback to recoding if the source only provides non-AVC formats.
 */
object VideoFormatSelector {

    const val FORMAT_SORT = "vcodec:h264,res,acodec:m4a"

    fun formatFor(quality: String?): String = when (quality) {
        "low" -> "bestvideo[height<=480][vcodec^=avc1][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=480][vcodec^=avc]+bestaudio[ext=m4a]/bestvideo[height<=480][vcodec^=avc]+bestaudio/best[height<=480][vcodec^=avc]/bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best"
        "medium" -> "bestvideo[height<=720][vcodec^=avc1][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720][vcodec^=avc]+bestaudio[ext=m4a]/bestvideo[height<=720][vcodec^=avc]+bestaudio/best[height<=720][vcodec^=avc]/bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best"
        else -> "bestvideo[vcodec^=avc1][ext=mp4]+bestaudio[ext=m4a]/bestvideo[vcodec^=avc]+bestaudio[ext=m4a]/bestvideo[vcodec^=avc]+bestaudio/best[vcodec^=avc]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"
    }
}
