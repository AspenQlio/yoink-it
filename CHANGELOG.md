# Changelog

All notable changes to YoinkIt are recorded here before they are grouped into a release.

## Unreleased

## [5.0.0] - 2026-10-07

### Added
- Universal Music Search: The app now supports free-text search for songs (e.g., "Mac Miller Stay") resolving directly via the Spotify API.
- Support for Spotify tracks, albums, and playlists by extracting metadata and mapping it to high-quality audio downloads.
- Introduced a new "Pale Azure" (`#68C7EC`) and "Rich Black" (`#000F0F`) aesthetic, replacing the pure monochrome UI.

### Changed
- Replaced the "SLIDES" hardcoded text with dynamic labels ("TRACKS", "IMAGES", "MEDIA") depending on the content type.
- Updated the embedded Kotlin bridge to bypass YouTube's recent `HTTP Error 403 / SABR` streaming blocks by spoofing Smart TV and Creator clients.

### Fixed
- Fixed a major `[Errno 1] Operation not permitted` crash on Android 11+ by properly injecting `MANAGE_EXTERNAL_STORAGE` and explicit R/W permissions into the AndroidManifest.
- Prevented the "success" message from being instantly wiped off the screen when downloads finish.


## [4.0.0] - 2026-10-04

### Added
- Real-time download progress bar in the console box for both videos and images.
- Replaced generic "SAVE" and "EXECUTE" button texts with application-branded "YOINK".

### Added
- Intelligent auto-scan: pasting a URL automatically detects the media type (image, video, or playlist) and reveals the appropriate format/quality options.

### Changed
- Cleaned up the UI: the format and quality selectors are now hidden until a link is successfully analyzed.
- Consolidated network requests: the application now extracts all necessary metadata in a single pass instead of scanning separately for images and videos.

### Fixed

- Scan multi-video links before downloading, let the user choose carousel slides, and include each original slide index in its filename to prevent overwrites.
- Use a valid yt-dlp autonumber template when scanning image carousels.
- Fix Instagram image carousel extraction by ignoring missing video formats
- Replace raw Instagram login, rate-limit, and missing-format failures with concise user-facing errors.

### Added

- Let the user choose which carousel images to save and select an available resolution for each image.

### Changed

- Refresh yt-dlp from its stable channel during app initialization, while retaining the bundled engine when an update is unavailable.
- Rename output destinations to `DOWNLOADS`, `MUSIC`, and `MOVIES`.
