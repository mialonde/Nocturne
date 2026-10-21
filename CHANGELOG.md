# Changelog

All notable changes to NOCTURNE are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project uses [semantic versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Recorded ambience.** Six ambience tracks now play open-licensed field
  recordings (rain, distant thunder, wind, ocean, forest, fireplace). The
  procedural bed keeps playing until the recording has been downloaded, and
  stays in place when the file cannot be loaded.
- **Sample pipeline.** `npm run samples:fetch` downloads the curated sources
  and writes a licence lock file; `npm run samples:prepare` trims, loops,
  normalises and encodes them. The manifest and the notices are generated.
- **Audio credits.** The interface lists every recording with its author and
  licence under Settings → Audio credits, and `THIRD_PARTY_NOTICES.md` holds
  the full table.
- **Screen wake lock.** The display stays awake while the room plays.
- **Media session.** The room appears in the operating system media session
  with artwork and transport controls, which also keeps the audio alive when
  the screen is locked.
- **Installable application.** A web manifest, application icons and an
  offline worker. The ambience recordings are cached after the first use.
- **Continuous integration.** Type check, tests and build run on every push
  and pull request.

### Changed

- The soundscape profile no longer sits in its own card. It follows the panel
  typography, and the category row wraps instead of scrolling, so every
  category stays reachable.

## [1.0.0]

### Added

- Generative 3D environment with five atmospheres and the 6D Consciousness
  Simulator.
- Two independent sound sources: ambient bed and binaural tone pair.
- Breath guide, editable sessions with local storage and `.nocturne.json`
  import and export.
- Studio panel that records the scene and the master bus as a native WebM
  file.
- Six interface languages: English, Turkish, Russian, Arabic, Japanese and
  Simplified Chinese.
