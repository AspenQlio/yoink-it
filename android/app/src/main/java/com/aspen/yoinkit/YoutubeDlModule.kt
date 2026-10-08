package com.aspen.yoinkit

import android.os.Environment
import com.facebook.react.bridge.*
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
        val images: List<ImageCandidate>
    )

    override fun getName(): String {
        return "YoutubeDlModule"
    }

    @ReactMethod
    fun initialize(promise: Promise) {
        moduleScope.launch {
            try {
                YoutubeDL.getInstance().init(reactApplicationContext)
                FFmpeg.getInstance().init(reactApplicationContext)
                promise.resolve("Engine Initialized")
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
                val appDir = resolveOutputDir(folder)

                request.addOption("-o", appDir.absolutePath + "/%(title)s.%(ext)s")

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

                YoutubeDL.getInstance().execute(request) { progress, etaInSeconds, line -> }

                promise.resolve("Saved successfully to $folder/YoinkIt!")
            } catch (e: Exception) {
                promise.reject("DOWNLOAD_ERROR", e.message, e)
            }
        }
    }

    /**
     * Inspects a link and reports every image yt-dlp can see, without downloading.
     *
     * yt-dlp is asked to write one info json per media entry, which is the only
     * way to see carousel items: the typed VideoInfo model has no entries list.
     */
    @ReactMethod
    fun scanImages(url: String, promise: Promise) {
        moduleScope.launch {
            try {
                val scan = runScan(url)
                lastScan = scan

                val images = Arguments.createArray()
                scan.images.forEachIndexed { position, candidate ->
                    val entry = Arguments.createMap()
                    entry.putInt("index", position + 1)
                    entry.putInt("width", candidate.width)
                    entry.putInt("height", candidate.height)
                    entry.putString("ext", candidate.ext)
                    images.pushMap(entry)
                }

                val result = Arguments.createMap()
                result.putString("title", scan.title)
                result.putInt("count", scan.images.size)
                result.putArray("images", images)
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("SCAN_ERROR", e.message ?: "Scan failed", e)
            }
        }
    }

    /** Saves every image found by the scan, each at its highest available resolution. */
    @ReactMethod
    fun downloadImages(url: String, options: ReadableMap, promise: Promise) {
        moduleScope.launch {
            try {
                val folder = if (options.hasKey("folder")) options.getString("folder") else "Downloads"
                val scan = lastScan?.takeIf { it.url == url } ?: runScan(url).also { lastScan = it }

                if (scan.images.isEmpty()) {
                    promise.reject("NO_IMAGES", "This link exposes no image, only video or audio")
                    return@launch
                }

                val appDir = resolveOutputDir(folder)
                val saved = ArrayList<String>(scan.images.size)
                val failures = ArrayList<String>()

                scan.images.forEachIndexed { position, candidate ->
                    val target = File(appDir, FileNames.build(scan.title, position + 1, candidate.ext))
                    try {
                        downloadImage(candidate.url, target)
                        saved.add(target.name)
                    } catch (e: Exception) {
                        failures.add("${position + 1}: ${e.message}")
                    }
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
                promise.reject("IMAGE_DOWNLOAD_ERROR", e.message ?: "Download failed", e)
            }
        }
    }

    private fun runScan(url: String): ImageScan {
        val workDir = File(reactApplicationContext.cacheDir, "yoink_scan").apply {
            deleteRecursively()
            mkdirs()
        }

        try {
            val request = YoutubeDLRequest(url)
            // autonumber keeps carousel entries in separate files even when they share an id.
            request.addOption("-o", File(workDir, "%(autonumber)0>2d.%(ext)s").absolutePath)
            request.addOption("--skip-download")
            request.addOption("--write-info-json")
            request.addOption("--no-clean-info-json")
            request.addOption("--no-warnings")
            // Carousels are a playlist, so entries must not be flattened away.
            request.addOption("--ignore-errors")

            val response = YoutubeDL.getInstance().execute(request)

            val entries = workDir.listFiles { file -> file.name.endsWith(".info.json") }
                ?.sortedBy { it.name }
                ?.mapNotNull { file -> runCatching { JSONObject(file.readText()) }.getOrNull() }
                .orEmpty()

            val images = ImageCandidateSelector.selectAll(entries)
            val title = entries.firstOrNull()?.optString("title").orEmpty()
                .ifBlank { "yoink" }

            if (images.isEmpty() && response.exitCode != 0) {
                throw IOException("yt-dlp exited with code ${response.exitCode}: ${response.err.take(300)}")
            }

            return ImageScan(url, title, images)
        } finally {
            workDir.deleteRecursively()
        }
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
}