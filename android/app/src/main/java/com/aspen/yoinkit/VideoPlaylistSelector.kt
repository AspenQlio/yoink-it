package com.aspen.yoinkit

import org.json.JSONObject
import java.io.File

data class VideoPlaylistEntry(
    val index: Int,
    val title: String,
    val durationSeconds: Int
)

object VideoPlaylistSelector {
    fun entriesFrom(json: String): List<VideoPlaylistEntry> {
        val root = JSONObject(json)
        val entries = root.optJSONArray("entries")
        if (entries == null) return listOf(entryFrom(root, 1))

        return (0 until entries.length()).mapNotNull { position ->
            entries.optJSONObject(position)?.let { entryFrom(it, position + 1) }
        }
    }

    fun playlistItems(indices: List<Int>): String =
        indices.asSequence().filter { it > 0 }.distinct().sorted().joinToString(",")

    fun outputTemplate(directory: File): String =
        File(directory, "%(playlist_index)02d_%(title)s.%(ext)s").absolutePath

    private fun entryFrom(entry: JSONObject, fallbackIndex: Int): VideoPlaylistEntry {
        val index = entry.optInt("playlist_index").takeIf { it > 0 } ?: fallbackIndex
        val title = entry.optString("title").ifBlank { "Slide $index" }
        return VideoPlaylistEntry(index, title, entry.optInt("duration"))
    }
}
