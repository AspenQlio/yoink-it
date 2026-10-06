package com.aspen.yoinkit

import org.json.JSONArray
import org.json.JSONObject

/**
 * A downloadable image discovered in a yt-dlp info dictionary.
 *
 * [area] is the ranking key: yt-dlp exposes pixel dimensions for media formats
 * but usually not for thumbnails, so [area] degrades to 0 rather than lying.
 */
data class ImageCandidate(
    val url: String,
    val ext: String,
    val width: Int,
    val height: Int
) {
    val area: Int get() = width * height
}

/**
 * Pure extraction of the best image out of yt-dlp info dictionaries.
 *
 * Deliberately free of Android imports so it can be unit tested on the JVM.
 * The strategy mirrors yt-dlp's own preference order: media formats win over
 * thumbnails, because a format entry is the real asset while a thumbnail is
 * usually a downscaled derivative.
 */
object ImageCandidateSelector {

    private val IMAGE_EXTENSIONS = setOf("jpg", "jpeg", "png", "webp", "heic", "heif", "avif", "gif")

    fun isImageExt(ext: String?): Boolean =
        ext != null && ext.lowercase() in IMAGE_EXTENSIONS

    fun normalizeExt(ext: String): String = when (ext.lowercase()) {
        "jpeg" -> "jpg"
        "heif" -> "heic"
        else -> ext.lowercase()
    }

    /** Infers the extension from a URL, defaulting to jpg when absent or unknown. */
    fun extFromUrl(url: String): String {
        val path = url.substringBefore('?').substringBefore('#')
        val ext = path.substringAfterLast('.', "")
        return if (isImageExt(ext)) normalizeExt(ext) else "jpg"
    }

    /** Best image for a single entry, or null when the entry carries no image. */
    fun selectFrom(entry: JSONObject): ImageCandidate? =
        bestFromFormats(entry.optJSONArray("formats")) ?: bestFromThumbnails(entry.optJSONArray("thumbnails"))

    /** Best image for every entry, preserving entry order (carousel position). */
    fun selectAll(entries: List<JSONObject>): List<ImageCandidate> = entries.mapNotNull { selectFrom(it) }

    private fun bestFromFormats(formats: JSONArray?): ImageCandidate? {
        if (formats == null) return null
        var best: ImageCandidate? = null
        for (i in 0 until formats.length()) {
            val format = formats.optJSONObject(i) ?: continue
            val ext = format.optString("ext")
            if (!isImageExt(ext)) continue
            val url = format.optString("url").takeIf { it.isNotBlank() } ?: continue
            val candidate = ImageCandidate(url, normalizeExt(ext), format.optInt("width"), format.optInt("height"))
            if (best == null || candidate.area > best.area) best = candidate
        }
        return best
    }

    private fun bestFromThumbnails(thumbnails: JSONArray?): ImageCandidate? {
        if (thumbnails == null) return null
        var best: ImageCandidate? = null
        for (i in 0 until thumbnails.length()) {
            val thumbnail = thumbnails.optJSONObject(i) ?: continue
            val url = thumbnail.optString("url").takeIf { it.isNotBlank() } ?: continue
            val candidate = ImageCandidate(url, extFromUrl(url), thumbnail.optInt("width"), thumbnail.optInt("height"))
            // yt-dlp orders thumbnails worst-first, so ties resolve to the later entry.
            if (best == null || candidate.area >= best.area) best = candidate
        }
        return best
    }
}