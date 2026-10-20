import './style.css';
import './cards.css';
import {
  CardCommandSchema,
  EngineEventSchema,
  LookSchema,
  MatchHistorySchema,
  MatchStateSchema,
  SettingsSchema,
  createSettings,
  deriveStats,
  fixtures,
  getLook,
  type EngineEvent,
  type MatchState,
  type Settings,
} from '@stumpcast/shared';
import { OverlayWsClient } from './client';
import { BoundaryBanner } from './components/BoundaryBanner';
import { DataBadge } from './components/DataBadge';
import { MatchCentre } from './components/MatchCentre';
import { PerformanceStrip } from './components/PerformanceStrip';
import { ScorePop } from './components/ScorePop';
import { BatterCards, BowlerCard } from './components/PlayerCards';
import { ScoreBar } from './components/ScoreBar';
import { StatsTiles } from './components/StatsTiles';
import { ThisBall } from './components/ThisBall';
import { ThisOver } from './components/ThisOver';
import { Watermark } from './components/Watermark';
import { WinProb } from './components/WinProb';
import { UpgradePopup } from './components/UpgradePopup';
import { mountDebug, parseParams } from './debug';
import { CardManager } from './cards/CardManager';
import { CARD_DEFS } from './cards/defs';
import { mountGallery } from './cards/gallery';
import { StreamFrame } from './components/StreamFrame';
import { ResultScreen } from './components/ResultScreen';
import { PreMatchScreen } from './components/PreMatchScreen';
import { applyBackground, applyComposition, applyLayout, applyOnAirScreen, applyTvTheme, createZones } from './layout';
import { bumpAsset } from './assets';
import { OverlayAudio, createBrowserEngine } from './audio';
import { OverlayCommentary } from './commentary';
import { applyLook } from './look';
import { mountStage } from './stage';
import { OverlayStore } from './store';

const params = parseParams(location.search);
const stageEl = document.getElementById('stage')!;
mountStage(stageEl);

const store = new OverlayStore(params.match);
const startLook = (params.look && getLook(params.look)) || store.get().look;
store.setLook(startLook);

const initOverrides: Parameters<typeof createSettings>[0] = {};
if (params.layout) initOverrides.layout = params.layout;
if (params.composition) initOverrides.video = { activeObsLayout: params.composition };
if (params.fixture === 'RESULT') initOverrides.onAirScreen = 'result';
if (Object.keys(initOverrides).length > 0) {
  store.setSettings(createSettings(initOverrides));
}

/** A server settings snapshot must not undo the design-review flags in this page's URL. */
const withUrlOverrides = (s: Settings): Settings => {
  let out = s;
  if (params.layout) out = { ...out, layout: params.layout };
  if (params.composition) {
    out = { ...out, video: { ...out.video, activeObsLayout: params.composition } };
  }
  if (params.fixture === 'RESULT') out = { ...out, onAirScreen: 'result' };
  return out;
};

applyLook(store.get().look);
applyLayout(
  stageEl,
  store.get().settings.layout,
  store.get().settings.cardScale,
  store.get().settings.cardWidth,
  store.get().settings.sideCardScale ?? 1,
);
const initialBg = store.get().settings.video.backgroundImage ?? 'floodlight';
applyBackground(stageEl, initialBg, store.get().settings.video.backgroundDim);
applyComposition(stageEl, store.get().settings.video.activeObsLayout);
applyTvTheme(stageEl, store.get().settings.video.tvTheme);
applyOnAirScreen(stageEl, store.get().settings.onAirScreen);

// ---- components ---------------------------------------------------------------------------

const zones = createZones(stageEl);
const scoreBar = new ScoreBar();
const thisOver = new ThisOver();
const thisBall = new ThisBall();
const matchCentre = new MatchCentre();
const stats = new StatsTiles();
const winProb = new WinProb();
const batters = new BatterCards();
const bowler = new BowlerCard();
const banner = new BoundaryBanner();
const watermark = new Watermark();
const upgradePopup = new UpgradePopup();
const dataBadge = new DataBadge();
const streamFrame = new StreamFrame();
const perfStrip = new PerformanceStrip();
const scorePop = new ScorePop();
const resultScreen = new ResultScreen();
const preMatchScreen = new PreMatchScreen();

const look = store.get().look;
scoreBar.mount(zones.main, look);
matchCentre.mount(zones.left, look);
batters.mount(zones.left, look);
thisBall.mount(zones.right, look);
thisOver.mount(zones.right, look);
bowler.mount(zones.right, look);
stats.mount(zones.right, look);
winProb.mount(zones.bottom, look);
if (store.get().settings.layout === 'arena') {
  zones.right.append(winProb.element);
}
banner.mount(zones.top, look);
watermark.mount(stageEl, look);
upgradePopup.mount(stageEl, look);
dataBadge.mount(stageEl, look);
streamFrame.mount(stageEl, look);
streamFrame.setCameraMode(store.get().settings.video.cameraMode);
perfStrip.mount(stageEl, look);
scorePop.mount(stageEl, look);
scorePop.onVisibility = (visible) => perfStrip.setSuppressed(visible);
resultScreen.mount(stageEl, look);
preMatchScreen.mount(stageEl, look);

const cards = new CardManager(zones.card, look, CARD_DEFS, {
  fetchHistory: async (id) => {
    try {
      const res = await fetch(`${location.origin}/api/match/${encodeURIComponent(id)}/history`);
      if (!res.ok) return undefined;
      const parsed = MatchHistorySchema.safeParse(await res.json());
      return parsed.success ? parsed.data : undefined;
    } catch {
      return undefined;
    }
  },
});
const components = [
  scoreBar,
  matchCentre,
  thisBall,
  thisOver,
  stats,
  winProb,
  batters,
  bowler,
  banner,
  watermark,
  upgradePopup,
  dataBadge,
  streamFrame,
  perfStrip,
  scorePop,
  resultScreen,
  preMatchScreen,
];

const syncOnAirScreen = (s: typeof store extends { get(): infer G } ? G : never) => {
  const match = s.matchId ? s.matches[s.matchId] : undefined;
  let effective = s.settings.onAirScreen;
  if (effective === 'auto') {
    if (match?.status === 'result') effective = 'result';
    else if (match?.status === 'pre') effective = 'pre';
    else effective = 'live';
  }
  stageEl.dataset.activeScreen = effective;
  document.documentElement.dataset.activeScreen = effective;

  if (effective === 'result') {
    if (!resultScreen.isVisible) resultScreen.show();
    preMatchScreen.hide();
  } else if (effective === 'pre') {
    if (!preMatchScreen.isVisible) preMatchScreen.show();
    resultScreen.hide();
  } else {
    resultScreen.hide();
    preMatchScreen.hide();
  }
};

syncOnAirScreen(store.get());

const applyLicenceState = (licensed: boolean) => {
  watermark.setVisible(!licensed);
  if (licensed) upgradePopup.stop();
  else upgradePopup.start();
};

if (params.preview) {
  try {
    const res = await fetch(`${location.origin}/api/licence`);
    if (res.ok) {
      const data = (await res.json()) as { licensed: boolean };
      store.setLicensed(data.licensed);
      applyLicenceState(data.licensed);
    }
  } catch { /* offline */ }
}

store.subscribe((s, prev) => {
  if (s.licensed !== prev.licensed) applyLicenceState(s.licensed);
});

// Render on every change. The DOM is only ever updated in place, so a lost connection or a
// missing match leaves the last picture on screen instead of blanking it.
store.subscribe((s, prev) => {
  if (s.look !== prev.look) {
    applyLook(s.look);
    for (const c of components) c.setLook(s.look);
  }
  if (s.look !== prev.look) cards.setLook(s.look);
  if (s.active !== prev.active) cards.apply(s.active);
  if (s.settings !== prev.settings) {
    applyLayout(
      stageEl,
      s.settings.layout,
      s.settings.cardScale,
      s.settings.cardWidth,
      s.settings.sideCardScale ?? 1,
    );
    const updatedBg = s.settings.video.backgroundImage ?? 'floodlight';
    applyBackground(stageEl, updatedBg, s.settings.video.backgroundDim);
    applyComposition(stageEl, s.settings.video.activeObsLayout);
    applyTvTheme(stageEl, s.settings.video.tvTheme);
    applyOnAirScreen(stageEl, s.settings.onAirScreen);
    streamFrame.setCameraMode(s.settings.video.cameraMode);
    preMatchScreen.setScene(s.settings.preMatch?.scene ?? 'auto');
    if (s.settings.layout === 'arena') {
      zones.right.append(winProb.element);
    } else {
      zones.bottom.append(winProb.element);
    }
    syncOnAirScreen(s);
  }
  const match = store.current();
  const before = prev.matchId ? prev.matches[prev.matchId] : undefined;
  if (match && match !== before) {
    for (const c of components) c.update(match);
    cards.updateMatch(match);
    syncOnAirScreen(s);
  }
});

if (params.debug) mountDebug(store);

// Audio plays in the OBS browser source. The admin's embedded preview stays silent so the
// operator never hears every sound twice.
const audio =
  params.preview || params.fixture
    ? null
    : new OverlayAudio(createBrowserEngine(), location.origin);
if (audio && params.debug) {
  // Normal browsers hold audio until a click; OBS does not need this.
  const btn = document.createElement('button');
  btn.textContent = 'Click to enable audio';
  btn.className = 'audio-unlock';
  btn.hidden = true;
  btn.addEventListener('click', () => {
    void audio.unlock().then(() => (btn.hidden = !audio.needsUnlock));
  });
  document.body.append(btn);
  setInterval(() => {
    btn.hidden = !audio.needsUnlock;
  }, 1000);
}

// Watchdog alarm (health channel). The badge needs both the alarm and the setting enabled.
let alarmRaised = false;
const syncBadge = () => dataBadge.setVisible(alarmRaised && store.get().settings.dataDelayedBadge);
store.subscribe((s, prev) => {
  if (s.settings.dataDelayedBadge !== prev.settings.dataDelayedBadge) syncBadge();
});

const onEvent = (e: EngineEvent) => {
  banner.handleEvent(e);
};

// ---- data ---------------------------------------------------------------------------------

const origin = location.origin;

const bootstrap = async () => {
  // Full snapshot over HTTP after every (re)connect so nothing missed while offline is lost.
  try {
    const [stateRes, settingsRes] = await Promise.all([
      fetch(`${origin}/api/state${params.preview ? '?preview=1' : ''}`),
      fetch(`${origin}/api/settings`),
    ]);
    if (stateRes.ok) {
      const list = (await stateRes.json()) as unknown[];
      store.setMatches(
        list.flatMap((m) => {
          const r = MatchStateSchema.safeParse(m);
          return r.success ? [r.data] : [];
        }),
      );
    }
    // The look the operator activated (custom looks are not in the bundle).
    if (!params.look) {
      try {
        const res = await fetch(`${origin}/api/looks/active`);
        if (res.ok) {
          const l = LookSchema.safeParse(await res.json());
          if (l.success && l.data.id !== store.get().look.id) store.setLook(l.data);
        }
      } catch {
        /* optional */
      }
    }
    // A card that is already on air (reload, OBS source refresh) must come back too.
    try {
      const dir = await fetch(`${origin}/api/director`);
      if (dir.ok) {
        const d = (await dir.json()) as {
          onAir?: { cardId?: string; source?: 'director' | 'operator' } | null;
        };
        if (d.onAir?.cardId && !store.get().active) {
          store.applyCard({
            action: 'show',
            cardId: d.onAir.cardId,
            durationSec: 15,
            source: d.onAir.source ?? 'operator',
          });
        }
      }
    } catch {
      /* optional */
    }
    if (settingsRes.ok) {
      const s = SettingsSchema.safeParse(await settingsRes.json());
      if (s.success) store.setSettings(withUrlOverrides(s.data));
    }
    // The watchdog broadcasts only when the level *changes*, so a page that loads or reconnects
    // during an alarm would otherwise never show the badge the condition is already warning about.
    try {
      const res = await fetch(`${origin}/api/alarm`);
      if (res.ok) {
        const a = (await res.json()) as { level?: string };
        alarmRaised = a.level === 'warn' || a.level === 'error';
        syncBadge();
      }
    } catch {
      /* optional */
    }
  } catch {
    /* offline: keep what we have */
  }
};

if (params.fixture) {
  const f = params.fixture.toLowerCase();
  const base: MatchState =
    f === 'rsa' || f === 'rsa-aus' || (f === 'test' && params.resolution)
      ? fixtures.rsaVsAus
      : f === 'test'
        ? fixtures.test
        : f === 'result'
          ? fixtures.result
          : fixtures.t20;
  store.setConnection('open');
  store.setMatch(deriveStats(base));
  if (params.event) {
    const type = params.event;
    setTimeout(
      () =>
        onEvent({
          id: `demo-${type}`,
          matchId: base.id,
          type,
          at: new Date().toISOString(),
          payload:
            type === 'WICKET' ? { out: 'Heinrich Klaasen', outRuns: 12, bowler: 'S Afridi' } : {},
        }),
      300,
    );
  }
}

const proto = location.protocol === 'https:' ? 'wss' : 'ws';
const commentary = new OverlayCommentary();

const client = new OverlayWsClient({
  url: `${proto}://${location.host}/ws${params.preview ? '?preview=1' : ''}`,
  channels: ['state', 'events', 'cards', 'layout', 'health', 'sound', 'commentary', 'licence'],
  onStatus: (s) => store.setConnection(s),
  onOpen: () => {
    void bootstrap();
    void audio?.sync();
  },
  onMessage: (msg) => {
    if (msg.type !== 'message') return;
    if (msg.channel === 'commentary') {
      commentary.handle(msg.payload);
    } else if (msg.channel === 'state') {
      if (!params.fixture) {
        const m = MatchStateSchema.safeParse(msg.payload);
        if (m.success) store.setMatch(m.data);
      }
    } else if (msg.channel === 'events') {
      const e = EngineEventSchema.safeParse(msg.payload);
      if (e.success) onEvent(e.data);
    } else if (msg.channel === 'health') {
      if (msg.event === 'alarm') {
        const level = (msg.payload as { level?: string } | null)?.level;
        alarmRaised = level === 'warn' || level === 'error';
        syncBadge();
      }
    } else if (msg.channel === 'sound') {
      void audio?.handle(msg.payload);
    } else if (msg.channel === 'cards') {
      const c = CardCommandSchema.safeParse(msg.payload);
      if (c.success) {
        if (c.data.action === 'asset-updated') {
          bumpAsset(c.data.id);
          const m = store.current();
          if (m) {
            for (const comp of components) comp.update(m);
            cards.updateMatch(m);
          }
        } else store.applyCard(c.data);
      }
    } else     if (msg.channel === 'licence') {
      const data = msg.payload as { licensed?: boolean } | null;
      if (data?.licensed !== undefined) {
        store.setLicensed(data.licensed);
      }
    } else if (msg.channel === 'layout') {
      if (msg.event === 'settings') {
        const s = SettingsSchema.safeParse(msg.payload);
        if (s.success) {
          store.setSettings(withUrlOverrides(s.data));
          if (s.data.theme) {
            const l = getLook(s.data.theme);
            if (l && l.id !== store.get().look.id) store.setLook(l);
          }
        }
      } else if (msg.event === 'look') {
        const l = LookSchema.safeParse(msg.payload);
        if (l.success) store.setLook(l.data);
      }
    }
  },
});
client.start();

// Design-QA page: replaces the live overlay with every card against the fixtures.
if (params.gallery) mountGallery(stageEl, store.get().look);
