# StumpCast Studio: Security Architecture & Checklist 🛡️

Security and stability are fundamental to StumpCast Studio. Because the app integrates with OBS, local browser sources, and browser extensions, strict security boundaries are enforced across all monorepo layers.

---

## 1. Security Architecture & Threat Model

### 1.1 Localhost & Network Isolation
- **Loopback Default:** The server binds strictly to `127.0.0.1`. It never listens on `0.0.0.0` unless explicitly started with `STUMPCAST_LAN=1`.
- **CORS Protection:** All API and WebSocket routes validate `Origin` headers, allowing only `127.0.0.1`, `localhost`, and internal Electron/extension origins.
- **Extension Ingest Authentication:** Endpoints `/api/ext/ingest` and `/ext` require a valid Bearer token issued during single-use 6-digit pairing. Re-used or invalid pairing codes are rate-limited and locked after 5 failed attempts.

### 1.2 Electron Process Isolation
- **`contextIsolation: true`**: Renderers (Admin and Overlay) cannot access Node.js APIs directly.
- **`nodeIntegration: false`**: Eliminates remote code execution risks from web views.
- **Strict Preload Bridge**: IPC handlers only expose allowlisted functions (`getVersion`, `openExternal`, `selectFile`, `getSecret`, `setSecret`).
- **External URL Allowlist**: Links opened via `shell.openExternal` are restricted to HTTPS protocols and allowlisted domains (`stumpcast.app`, `github.com`).

### 1.3 Server-Side Request Forgery (SSRF) Protection
When downloading player photos or team logos via URL (`POST /api/assets/url`):
- Private IP addresses (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.0.0/16`) are blocked.
- Loopback, link-local, and IPv6 site-local addresses are rejected prior to HTTP execution.
- Maximum download sizes are capped at 5 MB to prevent resource exhaustion attacks.

### 1.4 Path Traversal Defense
- File serving for assets, sounds, and `.stumplook` archives resolves canonical absolute paths and validates that they reside within the designated `data/assets/` folder.
- Dot-dot (`../`) sequences and null bytes are rejected at the parameter validation layer using Zod schemas.

---

## 2. Hardening & Verification Checklist

- [x] **No hardcoded secrets:** Ed25519 selector signing keys and license server private keys are loaded from environment variables or encrypted file storage.
- [x] **Input Validation:** Every payload across REST and WebSocket channels is strictly validated by Zod schemas.
- [x] **Rate Limiting:** Asset uploads, pairing code submissions, and selector hot-fixes are protected by sliding-window rate limiters.
- [x] **CSP (Content Security Policy):** Admin and overlay web interfaces enforce strict `script-src 'self'` and `img-src 'self' data: blob:` policies.
- [x] **Memory Stability:** GSAP timelines and WebSocket listeners in the overlay runtime are systematically garbage-collected to ensure 60fps performance across 12+ hour broadcast soak tests.

---

## 3. Reporting Vulnerabilities

If you identify a potential security vulnerability in StumpCast Studio, please submit a report directly to `security@stumpcast.app` or open a confidential security advisory on GitHub.
