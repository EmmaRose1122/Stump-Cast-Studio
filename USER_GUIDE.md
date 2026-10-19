# StumpCast Studio: Streamer User Guide 🎙️

Welcome to **StumpCast Studio**! This guide walks you through setting up broadcast-grade cricket graphics in OBS Studio, pairing the Chrome extension for real-time live match scores, and operating the director during your live stream.

---

## 📋 Table of Contents
1. [System Requirements](#1-system-requirements)
2. [First-Time Setup (3-Minute Quickstart)](#2-first-time-setup-3-minute-quickstart)
3. [Chrome Extension Setup & Live Data Pairing](#3-chrome-extension-setup--live-data-pairing)
4. [Configuring OBS Studio (Browser Source)](#4-configuring-obs-studio-browser-source)
5. [Operating the Studio Control Room](#5-operating-the-studio-control-room)
   - [Live Scoring & Manual Backup](#live-scoring--manual-backup)
   - [Quick Graphics & Broadcast Cards](#quick-graphics--broadcast-cards)
   - [Smart Director (Auto-Producer)](#smart-director-auto-producer)
   - [Audio Rack & Crowd Reactions](#audio-rack--crowd-reactions)
6. [Managing Themes & Pro Looks](#6-managing-themes--pro-looks)
7. [Troubleshooting & FAQs](#7-troubleshooting--faqs)

---

## 1. System Requirements

- **Operating System:** Windows 10 (64-bit) or Windows 11.
- **Broadcasting Software:** OBS Studio 28.0+, Streamlabs Desktop, or vMix.
- **Browser:** Google Chrome, Brave, or Microsoft Edge.
- **Hardware:** Intel Core i5 or AMD Ryzen 5 processor, 8 GB RAM, GPU with hardware acceleration.

---

## 2. First-Time Setup (3-Minute Quickstart)

1. **Launch StumpCast Studio**: Run `StumpCast-Studio-Setup.exe` or start the local server with `pnpm dev`.
2. **Open the Control Room**: Navigate to `http://127.0.0.1:4000/admin` (or the desktop app window).
3. **Setup Wizard**: On your first launch, the 4-step wizard guides you through:
   - Installing the Chrome extension.
   - Pairing your first live cricket match.
   - Verifying the overlay canvas in the live preview.
   - Adding the Browser Source into OBS Studio.

---

## 3. Chrome Extension Setup & Live Data Pairing

StumpCast uses a Chrome extension to capture real-time live ball-by-ball updates directly from Cricbuzz or Crex match pages you have open.

### Installing the Extension:
1. Open Google Chrome and enter `chrome://extensions` in the address bar.
2. Toggle on **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select the `stumpcast/extension` folder.
4. The extension icon will appear in your Chrome toolbar.

### Pairing with StumpCast Studio:
1. In StumpCast Studio Admin, go to **Chrome Extension** (or the Setup Wizard).
2. Accept the **First-Run Source Terms Notice**.
3. Copy the 6-digit pairing code (or click **⚡ 1-Click Auto Connect** in the extension options page).
4. Paste the code into the extension popup/options window and click **Pair**.
5. Once paired, open any live match on **Cricbuzz** (`cricbuzz.com/live-cricket-scores/...`) or **Crex** (`crex.live/...`).
6. The match automatically appears under **Your Matches** in the StumpCast Studio Live tab! Click **SHOW ON OVERLAY** to bring it live.

---

## 4. Configuring OBS Studio (Browser Source)

StumpCast delivers transparent, 60fps graphics as a native web page.

### Adding the Overlay to OBS:
1. In OBS Studio, go to the **Sources** dock and click the **`+`** (Add) button.
2. Select **Browser** and name the source `StumpCast Scoreboard`.
3. In the properties window, configure the following settings:
   - **URL:** `http://127.0.0.1:4000/overlay/`
   - **Width:** `1920`
   - **Height:** `1080`
   - **FPS:** `60`
   - **Custom CSS:** *(Leave empty)*
   - **Shutdown source when not visible:** Unchecked (keeps WebSocket connection alive)
   - **Refresh browser when scene becomes active:** Unchecked
4. Click **OK**.
5. Position the browser source at coordinates `(0, 0)` so it spans your entire 1080p canvas.

> 💡 **Tip:** If your video feed has a delay (e.g. YouTube stream lag), navigate to **Settings > Sync Delay** in StumpCast Studio and set the delay buffer between 0 and 60 seconds to synchronize overlays perfectly with your video feed!

---

## 5. Operating the Studio Control Room

### Live Scoring & Manual Backup
If no live feed is available (such as for local tournaments, school matches, or village cricket):
1. Click **Live Tab > Score Manually**.
2. Create your match with team names, 11-player squads, match format (T20, ODI, Test), and total overs.
3. Use keyboard number shortcuts `0` through `6` to score balls.
4. Press `W` for Wicket, `X` for Wide, `N` for No Ball, and `U` for instant Undo.
5. All calculations (CRR, RRR, partnerships, player scores) update instantly in real time.

### Quick Graphics & Broadcast Cards
Trigger full-screen and lower-third graphics with single-click buttons:
- **STRIKER**: Shows current striker's runs, balls, strike rate, and boundary split.
- **BOWLER**: Highlights bowling spell, wickets, maidens, runs, and economy.
- **PARTNERSHIP**: Dynamic dual-player contribution bar.
- **WAGON WHEEL**: 8-sector SVG visualizer showing distribution of 4s and 6s.
- **SITUATION**: Match phase, target, balls remaining, lead/trail for Test matches.
- **SCORECARD**: Comprehensive team batting and bowling summary card.

### Smart Director (Auto-Producer)
Don't want to click buttons while commentating? Enable the **Smart Director**:
- Automatically presents the **Manhattan chart** at the end of every over.
- Displays the **Bowler Spell** immediately after a wicket falls.
- Triggers celebratory **Milestone Cards** when a batter reaches 50 or 100 runs.
- Queues animations cleanly without interrupting boundary flashes.

### Audio Rack & Crowd Reactions
Enhance stream immersion using the built-in sound engine:
- Click instant crowd reactions: **Cheer**, **Clap**, **Four Fanfare**, or **Horn**.
- Map custom sound files (MP3/WAV) to slot triggers.
- Automatically fire boundary audio synchronized with the visual sync delay.

---

## 6. Managing Themes & Pro Looks

StumpCast features original, broadcast-grade themes:
- **Free Looks**: Graphite Teal, Coral Dusk.
- **Pro TV Looks**: Midnight Glass, Sandstone, Pitch Green, Ink & Gold, Aqua Mono, Ember, Orange & Blue Broadcast, Star Sports Premier.
- **Layout Variations**:
  - **Arena**: Full scoreboard with side video/cam boxes.
  - **FullScreen**: High-impact stadium broadcast graphics.
  - **Ticker**: Minimalist lower-third ticker for screen real-estate.
  - **Classic**: Compact top-left broadcaster card.

To switch looks, navigate to the **Graphics Tab**, click any look thumbnail, and select **Activate**. The overlay updates live without refreshing OBS!

---

## 7. Troubleshooting & FAQs

### The overlay is blank in OBS:
1. Verify the StumpCast server is running by opening `http://127.0.0.1:4000/api/health` in your browser.
2. Check that the Browser Source URL is exactly `http://127.0.0.1:4000/overlay/`.
3. Right-click the Browser Source in OBS and click **Interact** or **Refresh cache of current page**.

### Extension shows "Waiting for live match":
1. Ensure the match tab on Cricbuzz or Crex is fully loaded in your browser.
2. Check that the extension options page reports `Paired with StumpCast Studio`.
3. If Cricbuzz updated their page DOM, click **Settings > Data Source > Check for Selector Updates** to pull the latest signed selector bundle without updating the extension!
