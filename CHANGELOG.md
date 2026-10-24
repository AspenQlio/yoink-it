# Changelog

All notable changes to YoinkIt are recorded here before they are grouped into a release.

## Unreleased

### Added
- Added official Persona-styled application icon with dynamic comic shards and halftone dots across all Android mipmap densities and assets.
- Integrated `lucide-react-native` vector icons across navigation tabs, search/scan triggers, batch selectors, action buttons, queue management, and download history.
- Added public Spotify metadata resolver via official oEmbed and open metadata, allowing single-track downloads without requiring Spotify developer API keys.
- Added direct YouTube fallback for free-text search queries when Spotify credentials are not configured.
- Added default download directory selector in Settings with persistent storage (`Downloads`, `Music`, `Movies`, `Pictures`).
- Expanded supported sources list to include SoundCloud, Bandcamp, Reddit, Twitch, Vimeo, Facebook, Pinterest, and 1000+ direct web media sites.
- Added in-app explanations for X/Twitter proxy, cookies.txt authentication, and Spotify API configuration.
- Added interactive command bar with explicit `[SCAN LINK]` / `[SEARCH SPOTIFY]` button, inline `[×]` clear button, and real-time platform tag indicator.
- Added platform detection chips and supported sources banner (`YOUTUBE`, `SPOTIFY`, `INSTAGRAM`, `X`, `TIKTOK`).
- Added cyber-terminal media preview card with platform badge, framed thumbnail preview, and duration formatted as `mm:ss`.
- Added batch selection controls (`[ALL]`, `[NONE]`, `[INVERT]`) for playlists and image carousels.
- Added dual action workflow: instant single-tap `[YOINK NOW]` alongside `[+ ADD TO QUEUE]`.
- Added visual ASCII progress bar (`[████████░░░░]`) with live ETA and smooth progress track for queue downloads.
- Added per-job queue controls: `[RETRY]` for failed downloads and `[×]` to remove individual jobs.
- Added prominent `[START EXTRACTION]` button when pending jobs are in queue.
- Added tactile haptic vibration feedback on Android for button taps, selection toggles, and completion.
- Added multi-line terminal console log with timestamps and a blinking terminal cursor effect.
- Added `[RE-YOINK]` quick action on history items to reload past downloads.
- Added Home, History, and Settings tabs without introducing a navigation dependency.
- Added a local download history with source URLs, completion dates, titles, and available thumbnails.
- Added native `cookies.txt` authentication for `yt-dlp`, stored in the app's private document directory.
- Added editable Spotify and X proxy credentials in Settings with live integration status indicators.

### Added
- Integrated image thumbnail previews directly into each carousel item in the selection list, making it clear which image is being selected before downloading.
- Automated media scanning broadcast (`MediaScannerConnection`) for newly downloaded videos and photos, ensuring immediate indexing into the system gallery.

### Changed
- Updated queue status badge states: `[DOWN]` changed to `[YOINKING IT]` and `[DONE]` changed to `[YOINK!]`.
- Reordered extraction layout: multi-item selection (`ITEMS` / `TRACKS` / `IMAGES`) now renders prominently above `FORMAT` and `QUALITY` selection rows.
- Removed corner diagonal accent from all buttons (`PersonaButton`), delivering pure, clean Persona tactile cards with hard offset shadows.
- Refactored Persona-style buttons (`PersonaButton`) with solid hard offset shadows, tactile pressed feedback, and strict mobile flex bounds to eliminate Android layout stretching.
- Compacted `SYSTEM // READY` log panel with crisp white monospace text, high contrast timestamps, and tighter vertical bounds.
- Adopted Aspen's Portfolio Persona design system, replacing the old ocean-blue terminal aesthetic with a tactical operator dossier palette: Deep Space Blue (`#003049`), Navy (`#002337`), Brick Red (`#C1121F`), Molten Lava (`#780000`), Steel Blue (`#669BBC`), and Papaya Whip (`#FDF0D5`).
- Redesigned header with tactical dossier version badge (`DOSSIER v1.2`) and operator subtitle (`ASPEN // MEDIA EXTRACTION SYSTEM`).
- Updated status bar, segment buttons, input prompt, action buttons, progress bars, and console log to use high-contrast Persona styling with hard offset borders.
- Improved contrast and readability for text placeholders using Azure Muted (`#84A9CB`).
- X/Twitter extraction can now use either the configured API proxy or the user's own Netscape-format cookies.
- Runtime credentials and authentication preferences now persist locally instead of requiring a rebuild after every change.

## [5.0.0] - 2026-10-07

### Added
- Universal Music Search: The app now supports free-text search for songs (e.g., "Mac Miller Stay") resolving directly via the Spotify API.
- Support for Spotify tracks, albums, and playlists by extracting metadata and mapping it to high-quality audio downloads.
- Introduced a new "Pale Azure" (`#68C7EC`) and "Rich Black" (`#000F0F`) aesthetic, replacing the pure monochrome UI.

### Changed
- Replaced the "SLIDES" hardcoded text with dynamic labels ("TRACKS", "IMAGES", "MEDIA") depending on the content type.
- Updated the embedded Kotlin bridge to bypass YouTube's recent `HTTP Error 403 / SABR` streaming blocks by spoofing Smart TV and Creator clients.

### Fixed
- Fixed dead or expired short links (including `tt.site`) leaving the screen without download options: empty extractor results are now rejected with an actionable error, and `SYSTEM_LOG` displays the newest error instead of stale entries.
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
