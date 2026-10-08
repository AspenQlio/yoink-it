# YOINK-IT // Android Port

> ⚠️ **UNOFFICIAL PORT:** This application is heavily inspired by and based on the awesome [yoinks](https://github.com/pablostanley/yoinks) CLI by Pablo Stanley. All credit for the original concept, branding, and terminal-flow goes to him.

An aggressively minimalist, monochromatic mobile video/audio extractor for Android. Powered by React Native, Kotlin bridges, and `yt-dlp`.

## // FEATURES
* **Zero-Config:** Paste a URL, execute, enjoy.
* **Multi-Platform:** Supports YouTube, X (Twitter), Instagram, Threads, TikTok, and 1800+ sites.
* **Format Control:** Extract MP4 (Video) or MP3 (Audio).
* **Quality Engine:** Toggle between MAX, MID, and LOW outputs to save bandwidth.
* **Native Routing:** Save directly to Android's native `Downloads`, `Music`, or `Movies` directories.
* **Terminal Aesthetic:** Pure OpenCode monochromatic UI (`#000000` & `#FFFFFF`).

## // INSTALLATION
1. Go to the **Releases** tab on this repository.
2. Download the latest `Yoink-OpenCode-vX.X.apk`.
3. Install on your Android device (accept "Install from unknown sources" if prompted).

## // UNDER THE HOOD
This app bypasses the need for NodeJS/Chaquopy by utilizing a custom Kotlin bridge connected to [youtubedl-android](https://github.com/junkfood02/youtubedl-android), bundling native C++ `ffmpeg` and Python `yt-dlp` directly into the APK.

## // LICENSE
MIT License. See `LICENSE` for more information.
