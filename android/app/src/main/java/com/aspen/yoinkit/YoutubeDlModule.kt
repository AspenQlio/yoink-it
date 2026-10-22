package com.aspen.yoinkit

import android.os.Environment
import com.facebook.react.bridge.*
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLException
import com.yausername.youtubedl_android.YoutubeDLRequest
import com.yausername.ffmpeg.FFmpeg
import kotlinx.coroutines.*
import java.io.File

class YoutubeDlModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private val job = SupervisorJob()
    private val moduleScope = CoroutineScope(Dispatchers.IO + job)

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

                val request = YoutubeDLRequest(url)

                val dirType = when (folder) {
                    "Music" -> Environment.DIRECTORY_MUSIC
                    "Movies" -> Environment.DIRECTORY_MOVIES
                    else -> Environment.DIRECTORY_DOWNLOADS
                }
                val baseDir = Environment.getExternalStoragePublicDirectory(dirType)
                val appDir = File(baseDir, "YoinkIt")
                if (!appDir.exists()) appDir.mkdirs()

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
}
