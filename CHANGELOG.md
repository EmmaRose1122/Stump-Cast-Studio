# StumpCast Studio: Changelog 📝

All notable changes to StumpCast Studio will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.1] - 2026-10-19

### Added
- **WCAG AA Compliance**: Comprehensive contrast token audit ensuring 4.5:1 ratio across dark and light admin themes.
- **Selector Hot-Fix Pipeline**: Ed25519-signed remote selector updates allowing scraper maintenance without requiring desktop app reinstalls.
- **Automatic Audio Mapping**: Configurable event-triggered sound effects for Boundaries (4s & 6s), Wickets, and Batter Milestones with stream latency compensation.
- **OBS WebSocket v5 Role Mapping**: Direct control of OBS scene item transforms, camera presets A–E, and PiP layouts.
- **Virtual Squad Asset Library**: High-performance virtualized grid for managing 400+ player cutout photos and team crests.

### Fixed
- Fixed TypeScript `noUncheckedIndexedAccess` errors in Cricbuzz/Crex normalizers.
- Resolved MediaTrackConstraints type incompatibility in webcam selector.
- Corrected duplicate theme variable declarations in Video tab.
- Hardened Fastify WebSocket connection cleanup during rapid restart cycles.

---

## [1.0.0] - 2026-10-15

### Added
- **Initial General Availability Release**: Complete monorepo release with Server, Overlay, Admin, Desktop, and Chrome Extension.
- **4 Broadcast Layouts**: Arena (with video framing), FullScreen, Ticker Strip, and Classic Top-Left.
- **20+ Broadcast Cards**: Striker Profile, Bowler Spell, Partnership, Wagon Wheel, Manhattan, Worm, Fall of Wickets, Full Scorecard, Toss, DRS Review, and Milestones.
- **Chrome MV3 Scraper**: Zero-extra-network live ball-by-ball tap for Cricbuzz and Crex.
- **Manual Scoring Backup Engine**: Full ball-by-ball scoring with undo stack, extras, and strike rotation.
- **Look System**: Token-based JSON theme engine supporting 8 default looks and `.stumplook` package imports.
