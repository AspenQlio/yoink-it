package com.aspen.yoinkit

import android.os.Environment
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLException
import com.yausername.youtubedl_android.YoutubeDLRequest
import com.yausername.ffmpeg.FFmpeg
import kotlinx.coroutines.*
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

class YoutubeDlModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private val job = SupervisorJob()
    private val moduleScope = CoroutineScope(Dispatchers.IO + job)

    /** Result of the last successful scan, so SAVE does not re-hit the network. */
    @Volatile
    private var lastScan: ImageScan? = null

    private data class ImageScan(
        val url: String,
        val title: String,
        val entries: List<EntryImages>
    )

    override fun getName(): String {
        return "YoutubeDlModule"
    }

    @ReactMethod
    fun initialize(promise: Promise) {
        moduleScope.launch {
            try {
                val youtubeDl = YoutubeDL.getInstance()
                youtubeDl.init(reactApplicationContext)
                val updateWarning = try {
                    youtubeDl.updateYoutubeDL(reactApplicationContext, YoutubeDL.UpdateChannel._NIGHTLY)
                    null
                } catch (e: YoutubeDLException) {
                    e.message ?: "yt-dlp update failed"
                }
                FFmpeg.getInstance().init(reactApplicationContext)
                val result = Arguments.createMap()
                result.putString("version", youtubeDl.versionName(reactApplicationContext))
                if (updateWarning != null) result.putString("updateWarning", updateWarning)
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("INIT_ERROR", "Error initializing YoutubeDL", e)
            }
        }
    }

    @ReactMethod
    fun download(url: String, options: ReadableMap, promise: Promise) {
        moduleScope.launch {
            try {
                val format = if (options.hasKey("format")) options.getString("format") else "mp4"
                val quality = if (options.hasKey("quality")) options.getString("quality") else "high"
                val folder = if (options.hasKey("folder")) options.getString("folder") else "Downloads"

                if (format == "image") {
                    promise.reject(
                        "IMAGE_FORMAT_REQUIRES_SCAN",
                        "The image format is handled by scanImages() and downloadImages()"
                    )
                    return@launch
                }

                val request = YoutubeDLRequest(url)
                request.addOption("--extractor-args", "youtube:player_client=visionos,android_creator,android,tv,web")
                request.addOption("--rm-cache-dir")
                val appDir = resolveOutputDir(folder)
                val selectedItems = if (options.hasKey("items")) options.getArray("items") else null
                val itemIndices = if (selectedItems == null) emptyList() else {
                    (0 until selectedItems.size()).map { selectedItems.getInt(it) }
                }
                val playlistItems = VideoPlaylistSelector.playlistItems(itemIndices)

                if (playlistItems.isNotEmpty()) {
                    request.addOption("--playlist-items", playlistItems)
                    request.addOption("-o", VideoPlaylistSelector.outputTemplate(appDir))
                } else {
                    request.addOption("-o", appDir.absolutePath + "/%(title)s.%(ext)s")
                }

                if (format == "mp3") {
                    request.addOption("-x")
                    request.addOption("--audio-format", "mp3")
                    when (quality) {
                        "high" -> request.addOption("--audio-quality", "0")
                        "medium" -> request.addOption("--audio-quality", "5")
                        "low" -> request.addOption("--audio-quality", "9")
                    }
                } else {
                    when (quality) {
                        "high" -> request.addOption("-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best")
                        "medium" -> request.addOption("-f", "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best")
                        "low" -> request.addOption("-f", "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best")
                    }
                }

                YoutubeDL.getInstance().execute(request) { progress, etaInSeconds, line ->
                    sendProgressEvent(progress, etaInSeconds)
                }

                promise.resolve("Saved successfully to $folder/YoinkIt!")
            } catch (e: Exception) {
                promise.reject("DOWNLOAD_ERROR", YtDlpErrors.userMessage(e.message), e)
            }
        }
    }

    @ReactMethod
    fun analyzeLink(url: String, promise: Promise) {
        moduleScope.launch {
            try {
                val request = YoutubeDLRequest(url)
                request.addOption("--extractor-args", "youtube:player_client=visionos,android_creator,android,tv,web")
                request.addOption("--rm-cache-dir")
                request.addOption("--dump-json")
                request.addOption("--flat-playlist")
                request.addOption("--skip-download")
                request.addOption("--ignore-errors")
                request.addOption("--ignore-no-formats-error")
                request.addOption("--no-warnings")

                var exitCode = 0
                var errMessage = ""
                var output = ""
                try {
                    val response = YoutubeDL.getInstance().execute(request)
                    exitCode = response.exitCode
                    errMessage = response.err
                    output = response.out
                } catch (e: YoutubeDLException) {
                    exitCode = 1
                    errMessage = e.message ?: "yt-dlp failed"
                }

                val lines = output.lines().filter { it.isNotBlank() }
                val jsons = lines.mapNotNull { runCatching { JSONObject(it) }.getOrNull() }

                if (jsons.isEmpty()) {
                    throw IOException(if (errMessage.isNotBlank()) errMessage else "No media found at this URL")
                }

                var isImage = true
                for (json in jsons) {
                    val type = json.optString("_type")
                    val formats = json.optJSONArray("formats")
                    if (type == "url" || (formats != null && formats.length() > 0)) {
                        isImage = false
                        break
                    }
                }

                val title = jsons.firstOrNull()?.optString("title").orEmpty().ifBlank { "yoink" }
                val result = Arguments.createMap()
                result.putString("title", title)
                result.putInt("count", jsons.size)

                if (isImage) {
                    result.putString("type", "image")
                    val entries = Arguments.createArray()
                    val parsed = ImageCandidateSelector.entryImages(jsons)
                    parsed.forEach { entry ->
                        val variants = Arguments.createArray()
                        entry.variants.forEach { candidate ->
                            val descriptor = Arguments.createMap()
                            descriptor.putInt("width", candidate.width)
                            descriptor.putInt("height", candidate.height)
                            descriptor.putString("ext", candidate.ext)
                            variants.pushMap(descriptor)
                        }
                        val payload = Arguments.createMap()
                        payload.putInt("index", entry.index)
                        payload.putArray("variants", variants)
                        entries.pushMap(payload)
                    }
                    result.putArray("entries", entries)
                    lastScan = ImageScan(url, title, parsed)
                } else {
                    result.putString("type", "video")
                    val entries = Arguments.createArray()
                    jsons.forEachIndexed { idx, json ->
                        val index = json.optInt("playlist_index").takeIf { it > 0 } ?: (idx + 1)
                        val slideTitle = json.optString("title").ifBlank { "Slide $index" }
                        val payload = Arguments.createMap()
                        payload.putInt("index", index)
                        payload.putString("title", slideTitle)
                        payload.putInt("duration", json.optInt("duration", 0))
                        entries.pushMap(payload)
                    }
                    result.putArray("entries", entries)
                }

                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("ANALYZE_ERROR", YtDlpErrors.userMessage(e.message), e)
            }
        }
    }

    /**
     * Saves the picked images. Without picks every entry is saved at its best
     * resolution, which keeps the plain save-everything path working.
     */
    @ReactMethod
    fun downloadImages(url: String, options: ReadableMap, promise: Promise) {
        moduleScope.launch {
            try {
                val folder = if (options.hasKey("folder")) options.getString("folder") else "Downloads"
                val scan = lastScan?.takeIf { it.url == url } ?: throw IOException("Images not scanned yet")

                if (scan.entries.isEmpty()) {
                    promise.reject("NO_IMAGES", "This link exposes no image, only video or audio")
                    return@launch
                }

                val picks = if (options.hasKey("picks")) options.getArray("picks") else null
                val targets = resolveTargets(scan, picks)
                if (targets.isEmpty()) {
                    promise.reject("NO_SELECTION", "No image selected")
                    return@launch
                }

                val appDir = resolveOutputDir(folder)
                val saved = ArrayList<String>(targets.size)
                val failures = ArrayList<String>()

                var completed = 0
                targets.forEach { (entry, candidate) ->
                    val target = File(appDir, FileNames.build(scan.title, entry.index, candidate.ext))
                    try {
                        downloadImage(candidate.url, target)
                        saved.add(target.name)
                    } catch (e: Exception) {
                        failures.add("${entry.index}: ${e.message}")
                    }
                    completed++
                    sendProgressEvent((completed.toFloat() / targets.size) * 100f)
                }

                if (saved.isEmpty()) {
                    promise.reject("IMAGE_DOWNLOAD_ERROR", failures.joinToString("; ").ifBlank { "no image could be saved" })
                    return@launch
                }

                val result = Arguments.createMap()
                result.putInt("count", saved.size)
                result.putString("folder", "$folder/YoinkIt")
                result.putArray("files", Arguments.fromList(saved))
                if (failures.isNotEmpty()) result.putString("failed", failures.joinToString("; "))
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("IMAGE_DOWNLOAD_ERROR", YtDlpErrors.userMessage(e.message), e)
            }
        }
    }

    private fun resolveTargets(scan: ImageScan, picks: ReadableArray?): List<Pair<EntryImages, ImageCandidate>> {
        if (picks == null || picks.size() == 0) return scan.entries.map { it to it.best }

        val byIndex = scan.entries.associateBy { it.index }
        val chosen = ArrayList<Pair<EntryImages, ImageCandidate>>()
        for (i in 0 until picks.size()) {
            val pick = picks.getMap(i) ?: continue
            val entry = byIndex[pick.getInt("entry")] ?: continue
            val variant = if (pick.hasKey("variant")) pick.getInt("variant") else 0
            chosen.add(entry to (entry.variants.getOrNull(variant) ?: entry.best))
        }
        return chosen
    }

    private fun downloadImage(url: String, target: File) {
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.connectTimeout = 15000
        connection.readTimeout = 60000
        connection.instanceFollowRedirects = true
        connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 13) yoink-it")
        connection.setRequestProperty("Accept", "image/*,*/*;q=0.8")

        try {
            val status = connection.responseCode
            if (status !in 200..299) throw IOException("HTTP $status")
            connection.inputStream.use { input ->
                target.outputStream().use { output -> input.copyTo(output) }
            }
        } finally {
            connection.disconnect()
        }

        if (!target.exists() || target.length() == 0L) {
            target.delete()
            throw IOException("empty download")
        }
    }

    private fun resolveOutputDir(folder: String?): File {
        val dirType = when (folder) {
            "Music" -> Environment.DIRECTORY_MUSIC
            "Movies" -> Environment.DIRECTORY_MOVIES
            else -> Environment.DIRECTORY_DOWNLOADS
        }
        val baseDir = Environment.getExternalStoragePublicDirectory(dirType)
        return File(baseDir, "YoinkIt").apply {
            if (!exists()) mkdirs()
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    private fun sendProgressEvent(progress: Float, eta: Long = 0L) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("DownloadProgress", Arguments.createMap().apply {
                putDouble("progress", progress.toDouble())
                putDouble("eta", eta.toDouble())
            })
    }
}