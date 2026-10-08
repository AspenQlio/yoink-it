package com.aspen.yoinkit

/**
 * Filename construction for saved images. Pure Kotlin so it stays unit testable.
 */
object FileNames {

    // Path separators, Windows-illegal characters and control codes.
    private val ILLEGAL = Regex("[\\\\/:*?\"<>|\\u0000-\\u001F]")

    fun sanitize(raw: String, fallback: String = "yoink", maxLength: Int = 60): String {
        val cleaned = ILLEGAL.replace(raw, " ")
            .replace(Regex("\\s+"), " ")
            .trim()
            .trim('.')
        if (cleaned.isBlank()) return fallback
        return if (cleaned.length <= maxLength) cleaned else cleaned.take(maxLength).trim()
    }

    fun build(title: String, index: Int, ext: String): String {
        val safeExt = if (ImageCandidateSelector.isImageExt(ext)) {
            ImageCandidateSelector.normalizeExt(ext)
        } else {
            "jpg"
        }
        return "${sanitize(title)}_${index.toString().padStart(2, '0')}.$safeExt"
    }
}