# StumpCast Studio: Privacy & Data Security Policy 🔒

Last Updated: October 2026

StumpCast Studio is designed with a **privacy-first, local-first architecture**. We believe that your broadcast operations, streaming setup, and spectator data belong exclusively to you.

---

## 1. Core Principles

- **Zero Cloud Tracking:** StumpCast Studio does not track user behavior, stream metrics, or viewers. There is no telemetry, analytics SDK, or ad tracking in the desktop application, overlay runtime, or admin panel.
- **Local-First Execution:** The Fastify server binds strictly to the loopback interface (`127.0.0.1`) by default. Broadcast graphics are delivered directly from your machine to your local instance of OBS Studio.
- **Encrypted Local Storage:** Third-party credentials, custom API keys, and offline license tokens are encrypted on Windows using Electron's native `safeStorage` (DPAPI).

---

## 2. Chrome Extension & Source Data

StumpCast Studio provides an optional Chrome Extension (`@stumpcast/extension`) for scraping live cricket data. Its data practices are strictly bounded:

1. **User-Initiated Only:** The extension only reads match pages that you manually open in your own browser tabs (e.g. on Cricbuzz or Crex).
2. **Zero Secondary Requests:** The extension never initiates background network requests to third-party cricket portals, never crawls match databases, and never circumvents paywalls, captchas, or anti-bot measures.
3. **Loopback Streaming Only:** Parsed scorecard data (`RawUpdate`) is sent exclusively over WebSocket or HTTP to your local StumpCast Studio server (`http://127.0.0.1:4000`). No score data is ever relayed to external cloud servers.
4. **First-Run Notice:** All users must acknowledge responsibility for adhering to source websites' terms of service before the extension will issue a pairing token.

---

## 3. Licensing & Network Calls

The only outbound network requests StumpCast Studio ever makes are:
- **Offline License Verification:** A periodic check against the licensing authority to refresh token signatures (with a 14-day offline grace period).
- **Selector Hot-Fixes:** Checking for signed selector updates (`STUMPCAST_SELECTORS_URL`) to maintain scraper compatibility when websites update their DOM layout.
- **Auto-Updates:** Checking GitHub Releases or configured update channels for official desktop app installer updates.

---

## 4. User Rights & Data Deletion

All matches, ball-by-ball events, custom team logos, player cutouts, and settings are stored locally in your SQLite database located at:
- **Windows:** `%APPDATA%\StumpCast\data\`

To completely erase all StumpCast data, simply delete this directory or use the **Backup & Reset** option in **Settings > Data Management**.
