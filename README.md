# YOINK-IT // Android Port

> An aggressively minimalist, monochromatic mobile video/audio extractor for Android powered by React Native, Kotlin bridges, and yt-dlp.

This application is an unofficial port inspired by the [yoinks](https://github.com/pablostanley/yoinks) CLI by Pablo Stanley. It provides a terminal-flow aesthetic directly on your mobile device, allowing zero-config media extraction from over 1800+ sites with pure monochromatic styling.

## Features

- **Universal Music Search:** Type a song name (e.g. "Mac Miller Stay") to instantly search Spotify and extract original FLAC/MP3 files.
- **Zero-Config Extraction:** Paste a URL, execute, and enjoy.
- **Multi-Platform Support:** Works with Spotify, YouTube, X (Twitter), Instagram, Threads, TikTok, and more.
- **Format Control:** Extract MP4 (Video) or MP3/Audio.
- **Quality Engine:** Toggle between MAX, MID, and LOW outputs to save bandwidth.
- **Native Routing:** Save directly to Android's native `Downloads`, `Music`, or `Movies` directories.
- **Pale Azure Aesthetic:** A beautiful monochromatic UI blending Rich Black (`#000F0F`) and Pale Azure (`#68C7EC`).

## Architecture

This app bypasses the need for NodeJS/Chaquopy by utilizing a custom Kotlin bridge connected to [youtubedl-android](https://github.com/junkfood02/youtubedl-android). It bundles native C++ `ffmpeg` and Python `yt-dlp` directly into the APK for robust media processing.

## Tech Stack

- **Frontend:** React Native
- **Native Integration:** Kotlin Bridge
- **Media Engine:** yt-dlp, ffmpeg (C++ via JNI)

## Getting Started

### Prerequisites

- An Android device (allow "Install from unknown sources").

### Installation

1. Go to the **Releases** tab on this repository.
2. Download the latest `Yoink-OpenCode-vX.X.apk`.
3. Install the APK on your Android device.


### Spotify Search Setup (For Developers)

If you are compiling this app from source, you need to provide Spotify API credentials for the universal search to work:

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Create an App and get your `Client ID` and `Client Secret`.
3. Create a `.env` file in the root of the project:
```env
EXPO_PUBLIC_SPOTIFY_CLIENT_ID=your_client_id_here
EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET=your_client_secret_here
```
4. Build the app as usual.

## Usage

1. Open the application on your Android device.
2. Paste the media URL into the input field.
3. Select your desired format (MP4/MP3) and quality (MAX/MID/LOW).
4. Execute the extraction. The file will be saved directly to your native directories.

## License

This project is licensed under the MIT License. (All credit for the original concept and branding goes to Pablo Stanley).
