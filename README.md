# StumpCast Studio 🏏

> **Professional TV-Style Cricket Broadcast Overlays for Streamers**  
> "Your cricket stream, broadcast-quality, in 3 minutes."

StumpCast Studio is a Windows desktop application and local broadcast suite designed for cricket streamers and content creators on YouTube, Twitch, Facebook Live, and local leagues. It ingests live match ball-by-ball data, transforms it through a real-time analytics engine, and renders transparent, 60fps broadcast overlays as an OBS / vMix / Streamlabs Browser Source.

---

## 🌟 Highlights & Features

- **Chrome Extension Data Source (Primary)**: Automatically scrapes scorecards and ball-by-ball updates from Cricbuzz and Crex pages you have open in your browser. Zero extra network calls, zero paywall bypasses.
- **TV Broadcast Overlays (1920×1080)**: Smooth 60 FPS graphics powered by GSAP and vanilla TypeScript. Includes 4 layout configurations (Arena, FullScreen, Ticker, Classic) and 8+ distinctive visual Looks.
- **20+ Broadcast Cards**: Striker Profile, Bowler Spell, Partnership, Wagon Wheel, Match Situation, Manhattan, Worm, Fall of Wickets, Full Scorecard, Toss, DRS Review, and Milestones.
- **Smart Director (Auto-Producer)**: Automatically switches broadcast cards based on match events (e.g. over ends, wickets, boundaries, batter milestones) without requiring manual operator intervention.
- **Sound Effects Rack**: Instant crowd reactions (Cheer, Clap, Four, Horn) and event-triggered audio with sync delay compensation.
- **Camera & Video Scene Control**: Direct OBS WebSocket (v5) integration with layout presets A–E and automatic scene transformations.
- **Offline & Local-First**: Runs entirely on `127.0.0.1`. SQLite-backed match history, undo stack, and encrypted secrets storage.

---

## 🏗️ Architecture & Monorepo Structure

```
stumpcast/
├── packages/
│   ├── shared/      # Zod schemas, TypeScript types, Look token models, fixtures
│   ├── server/      # Fastify, SQLite (better-sqlite3 + drizzle), WebSockets, MatchEngine
│   ├── overlay/     # Transparent 1080p stage (Vite + GSAP + vanilla TS, zero React)
│   ├── admin/       # Studio control room (React 18 + Vite + TailwindCSS + Zustand + Radix UI)
│   ├── extension/   # Chrome MV3 extension for Cricbuzz and Crex live data capture
│   └── desktop/     # Electron shell, system tray, auto-updater, NSIS packaging
├── scripts/         # Fixture checkers, selector signing, asset importers
└── data/            # Local SQLite database, assets, downloaded logos, logs
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: v20 or higher
- **pnpm**: v9 or higher
- **Chrome / Brave / Edge**: For the data provider extension
- **OBS Studio**: v28 or higher (optional, for streaming)

### 1. Installation
```bash
# Clone or navigate to the repository
cd stumpcast

# Install monorepo dependencies
pnpm install
```

### 2. Development Mode
Run all services in development mode simultaneously:
```bash
pnpm dev
```
- **Admin Control Room**: [http://127.0.0.1:4000/admin](http://127.0.0.1:4000/admin)
- **Overlay Browser Source**: [http://127.0.0.1:4000/overlay](http://127.0.0.1:4000/overlay)
- **Server Health Check**: [http://127.0.0.1:4000/api/health](http://127.0.0.1:4000/api/health)

To launch the desktop application (Electron):
```bash
pnpm dev:desktop
```

### 3. Running Tests & Quality Checks
```bash
# Run unit & integration test suite (518 tests)
pnpm test

# Run TypeScript typechecks
pnpm typecheck

# Run ESLint validation
pnpm lint

# Check adapter fixture sanity
pnpm fixtures:check
```

### 4. Production Build
```bash
# Compile all web packages and server bundles
pnpm build

# Build Windows desktop installer (NSIS .exe)
pnpm --filter @stumpcast/desktop package
```

---

## 📖 Documentation Directory

- [User Guide & OBS Setup](USER_GUIDE.md) — Comprehensive streamer manual and OBS browser source configuration.
- [Looks & Theme Authoring Guide](LOOKS_GUIDE.md) — How to design and export custom broadcast `.stumplook` packages.
- [Privacy Policy & Data Security](PRIVACY.md) — Details on local data processing and extension sandboxing.
- [Security Checklist](SECURITY.md) — Security audits, CORS boundaries, and SSRF prevention.
- [Changelog](CHANGELOG.md) — Release notes and version history.
- [Landing Page Marketing Copy](LANDING_PAGE.md) — Product copy and feature overviews.
- [Third-Party Licenses](THIRD_PARTY_LICENSES.md) — Open source attribution and licenses.

---

## 🛡️ License

Copyright © StumpCast Studio. All rights reserved.
