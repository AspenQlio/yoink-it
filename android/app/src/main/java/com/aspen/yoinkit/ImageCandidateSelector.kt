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
 * Every resolution offered for one carousel position.
 *
 * [variants] is ordered best first: the order is the contract, not a detail, since
 * callers index into it to trade quality for size and index 0 must stay the best.
 */
data class EntryImages(
    val index: Int,
    val variants: List<ImageCandidate>
) {
    val best: ImageCandidate get() = variants.first()
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
    fun selectFrom(entry: JSONObject): ImageCandidate? = variantsFrom(entry).firstOrNull()

    /** Best image for every entry, preserving entry order (carousel position). */
    fun selectAll(entries: List<JSONObject>): List<ImageCandidate> = entries.mapNotNull { selectFrom(it) }

    /**
     * Every resolution offered for one entry, best first.
     *
     * Formats are listed before thumbnails because a format is the real asset and a
     * thumbnail is a derivative of it, so the original wins even when a thumbnail
     * carries more pixels. Thumbnails still follow as smaller alternatives, which is
     * what gives the user a resolution choice on posts that expose a single format.
     */
    fun variantsFrom(entry: JSONObject): List<ImageCandidate> {
        val formats = imageFormats(entry.optJSONArray("formats")).sortedByDescending { it.area }
        // yt-dlp orders thumbnails worst first, so reversing lets the later entry win ties.
        val thumbnails = thumbnailCandidates(entry.optJSONArray("thumbnails"))
            .reversed()
            .sortedByDescending { it.area }
        val seen = HashSet<String>()
        return (formats + thumbnails).filter { seen.add(it.url) }
    }

    /** Carousel indexes are the original entry positions, so gaps appear for video-only entries. */
    fun entryImages(entries: List<JSONObject>): List<EntryImages> =
        entries.mapIndexedNotNull { position, entry ->
            variantsFrom(entry).takeIf { it.isNotEmpty() }?.let { EntryImages(position + 1, it) }
        }

    private fun imageFormats(formats: JSONArray?): List<ImageCandidate> {
        if (formats == null) return emptyList()
        val candidates = ArrayList<ImageCandidate>()
        for (i in 0 until formats.length()) {
            val format = formats.optJSONObject(i) ?: continue
            val ext = format.optString("ext")
            if (!isImageExt(ext)) continue
            val url = format.optString("url").takeIf { it.isNotBlank() } ?: continue
            candidates.add(
                ImageCandidate(url, normalizeExt(ext), format.optInt("width"), format.optInt("height"))
            )
        }
        return candidates
    }

    private fun thumbnailCandidates(thumbnails: JSONArray?): List<ImageCandidate> {
        if (thumbnails == null) return emptyList()
        val candidates = ArrayList<ImageCandidate>()
        for (i in 0 until thumbnails.length()) {
            val thumbnail = thumbnails.optJSONObject(i) ?: continue
            val url = thumbnail.optString("url").takeIf { it.isNotBlank() } ?: continue
            candidates.add(
                ImageCandidate(url, extFromUrl(url), thumbnail.optInt("width"), thumbnail.optInt("height"))
            )
        }
        return candidates
    }
}