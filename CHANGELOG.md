# Changelog

All notable changes to YoinkIt are recorded here before they are grouped into a release.

## Unreleased

## [4.0.0] - 2026-10-04

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
