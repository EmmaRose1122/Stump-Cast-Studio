import './fonts.css';
import './style.css';
import './cards.css';
import {
  CardCommandSchema,
  EngineEventSchema,
  LookSchema,
  MatchHistorySchema,
  MatchStateSchema,
  SettingsSchema,
  DEFAULT_LOOK,
  createSettings,
  deriveStats,
  fixtures,
  getLook,
  type EngineEvent,
  type Look,
  type MatchState,
  type Settings,
} from '@stumpcast/shared';
import { OverlayWsClient } from './client';
import { BoundaryBanner } from './components/BoundaryBanner';
import { DataBadge } from './components/DataBadge';
import { MatchCentre } from './components/MatchCentre';
import { ExtrasRail } from './components/ExtrasRail';
import { ProjectedScore } from './components/ProjectedScore';
import { WinPredictor } from './components/WinPredictor';
import { ScorePop } from './components/ScorePop';
import { BatterCards, BowlerCard } from './components/PlayerCards';
import { ScoreBar } from './components/ScoreBar';
import { StatsTiles } from './components/StatsTiles';
import { ThisBall } from './components/ThisBall';
import { ThisOver } from './components/ThisOver';
import { Watermark } from './components/Watermark';
import { WinProb } from './components/WinProb';
import { UpgradePopup } from './components/UpgradePopup';
import { mountDebug, parseParams, type OverlayParams } from './debug';
import { CardManager } from './cards/CardManager';
import { CARD_DEFS } from './cards/defs';
import { mountGallery } from './cards/gallery';
import { StreamFrame } from './components/StreamFrame';
import { ResultScreen } from './components/ResultScreen';
import { PreMatchScreen } from './components/PreMatchScreen';
import {
  applyBackground,
  applyComposition,
  applyLayout,
  applyOnAirScreen,
  applyTvTheme,
  createZones,
  type LayoutName,
} from './layout';
import { bumpAsset } from './assets';
import { OverlayAudio, createBrowserEngine } from './audio';
import { OverlayCommentary } from './commentary';
import { applyLook } from './look';
import { mountStage } from './stage';
import { OverlayStore } from './store';

/** The demo match a `?fixture=` review URL draws. `test` splits on `?resolution` for the DRS card. */
const fixtureFor = (p: OverlayParams): MatchState | null => {
  if (!p.fixture) return null;
  const f = p.fixture.toLowerCase();
  if (f === 'rsa' || f === 'rsa-aus' || (f === 'test' && p.resolution)) return fixtures.rsaVsAus;
  if (f === 'test') return fixtures.test;
  if (f === 'result') return fixtures.result;
  return fixtures.t20;
};

const params = parseParams(location.search);
const stageEl = document.getElementById('stage')!;
mountStage(stageEl);

// A pinned fixture is pinned the same way `?match=` pins a live match: the operator's
// `onStreamMatchId` in the settings snapshot used to walk straight over it, so every design
// review and gallery preview silently rendered whatever match the studio happened to be on.
const fixtureState = fixtureFor(params);
const store = new OverlayStore(params.match ?? fixtureState?.id ?? null);

/**
 * Whether this render may actually *run* a look.
 *
 * A Pro look is fine in a design-review frame (`?preview=1`, which is what the look gallery opens)
 * because that frame exists to show what the look looks like. It must never be enough on the bare
 * broadcast URL: `?look=` is a review flag, not a licence, and that URL is literally what OBS has
 * loaded. Without this an unlicensed channel could paste `?look=k01` into OBS and go on air with a
 * paid look while the admin correctly showed it locked.
 */
const canRunLook = (look: { plan?: string } | undefined): boolean => {
  if (!look) return false;
  if (params.preview) return true;
  return look.plan !== 'pro' || store.get().licensed;
};

const startLook =
  (params.look && canRunLook(getLook(params.look)) && getLook(params.look)) || store.get().look;
store.setLook(startLook);

/** If a licence disappears, a Pro look must not stay on air because the URL asked for it. */
const enforceLookLicence = (licensed: boolean): void => {
  if (licensed || params.preview) return;
  const current = store.get().look;
  if (current.plan !== 'pro') return;
  const free = getLook(DEFAULT_LOOK.id);
  if (free) store.setLook(free);
};

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
  // `?look=` pins the Look for design review and the admin's per-look gallery previews. Without
  // this the first settings snapshot (or a `layout/settings` push) reverts `theme` to whatever the
  // operator has on air, so every card in the gallery renders the same look.
  if (params.look && canRunLook(getLook(params.look))) out = { ...out, theme: params.look };
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
/**
 * Arena puts the striker, non-striker and bowler in one photo band under the video window, the way
 * every reference broadcast does. The two components still own their own DOM, so they are moved
 * into this host rather than duplicated - one player-card implementation for every layout, which is
 * what lets a look's `playerCardStyle` behave identically in arena and fullscreen.
 */
const playerBand = document.createElement('div');
playerBand.className = 'c-player-band';
playerBand.dataset.component = 'PlayerBand';
stageEl.append(playerBand);
const placePlayers = (layout: LayoutName, look: Look): void => {
  playerBand.dataset.playerOrder = look.layoutVariant.playerOrder;
  if (layout === 'arena') {
    playerBand.append(batters.element, bowler.element);
  } else {
    zones.left.append(batters.element);
    zones.right.append(bowler.element);
  }
};
/**
 * Arena's middle keeps the video between the side rails; each Pro look chooses which rail holds
 * stats and which holds ball-by-ball context. Components are re-parented, never duplicated.
 */
function placeArenaPanels(layout: LayoutName, look: Look): void {
  if (layout === 'arena') {
    const statsPanels = [stats.element, projected.element, extras.element, winPredictor.element];
    const matchPanels = [thisBall.element, matchCentre.element, thisOver.element];
    const statsOnLeft = look.layoutVariant.middleLayout.startsWith('left-stats');
    zones.left.append(...(statsOnLeft ? statsPanels : matchPanels));
    zones.right.append(...(statsOnLeft ? matchPanels : statsPanels));
  } else {
    zones.left.append(matchCentre.element);
    zones.right.append(
      thisBall.element,
      thisOver.element,
      stats.element,
      projected.element,
      extras.element,
      winPredictor.element,
    );
  }
}
const scoreBar = new ScoreBar();
const thisOver = new ThisOver();
const thisBall = new ThisBall();
const matchCentre = new MatchCentre();
const stats = new StatsTiles();
const projected = new ProjectedScore();
const extras = new ExtrasRail();
const winProb = new WinProb();
const winPredictor = new WinPredictor();
const batters = new BatterCards();
const bowler = new BowlerCard();
const banner = new BoundaryBanner();
const watermark = new Watermark();
const upgradePopup = new UpgradePopup();
const dataBadge = new DataBadge();
const streamFrame = new StreamFrame();
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
projected.mount(zones.right, look);
extras.mount(zones.right, look);
winProb.mount(zones.bottom, look);
winPredictor.mount(zones.left, look);
banner.mount(zones.top, look);
watermark.mount(stageEl, look);
upgradePopup.mount(stageEl, look);
dataBadge.mount(stageEl, look);
streamFrame.mount(stageEl, look);
streamFrame.setCameraMode(store.get().settings.video.cameraMode);
scorePop.mount(stageEl, look);
// The ball-by-ball pop-up owns the same band as the player cards, so whichever is not on air steps
// aside rather than stacking text on top of the score.
scorePop.onVisibility = (visible) => {
  playerBand.classList.toggle('is-suppressed', visible);
};
resultScreen.mount(stageEl, look);
preMatchScreen.mount(stageEl, look);
placePlayers(store.get().settings.layout, store.get().look);
placeArenaPanels(store.get().settings.layout, store.get().look);

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
  projected,
  extras,
  winProb,
  winPredictor,
  batters,
  bowler,
  banner,
  watermark,
  upgradePopup,
  dataBadge,
  streamFrame,
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

/**
 * Free-tier marks on air.
 *
 * The upgrade ad runs on the audience feed on purpose: a nudge only the operator can see converts
 * nobody. What it must not do is blackout the picture, so it is a compact lower-third with no
 * dimming backdrop (see `.c-upgrade-popup`). A paid channel loses all of it, and the look gallery
 * does too — it opens one `?preview=1&look=` frame per look, and an ad in all of them hides the
 * thing being reviewed. A bare `?look=` review URL still shows the ad, because that frame is meant
 * to be the real feed.
 */
const applyLicenceState = (licensed: boolean) => {
  document.documentElement.dataset.licensed = licensed ? '1' : '0';
  watermark.setVisible(!licensed);
  if (licensed || (params.preview && params.look)) upgradePopup.stop();
  else upgradePopup.start();
};

// Every audience asks, not just the operator's preview: an OBS browser source that reloads
// mid-broadcast would otherwise show the free-tier mark to a paid channel until the next licence
// event happens to arrive.
try {
  const res = await fetch(`${location.origin}/api/licence`);
  if (res.ok) {
    const data = (await res.json()) as { licensed: boolean };
    store.setLicensed(data.licensed);
    applyLicenceState(data.licensed);
    // `?look=` may have been honoured optimistically before this answer arrived.
    enforceLookLicence(data.licensed);
  }
} catch {
  /* offline */
}

store.subscribe((s, prev) => {
  if (s.licensed !== prev.licensed) {
    applyLicenceState(s.licensed);
    enforceLookLicence(s.licensed);
  }
});

// Render on every change. The DOM is only ever updated in place, so a lost connection or a
// missing match leaves the last picture on screen instead of blanking it.
store.subscribe((s, prev) => {
  if (s.look !== prev.look) {
    applyLook(s.look);
    for (const c of components) c.setLook(s.look);
    placePlayers(s.settings.layout, s.look);
    placeArenaPanels(s.settings.layout, s.look);
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
    placePlayers(s.settings.layout, s.look);
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
    placeArenaPanels(s.settings.layout, s.look);
    syncOnAirScreen(s);
  }
  const match = store.current();
  const before = prev.matchId ? prev.matches[prev.matchId] : undefined;
  if (match && match !== before) {
    // The ambience loops have to know when the match has actually stopped: a finished score
    // that still pulses reads as a fake live feed.
    stageEl.dataset.status = match.status;
    for (const c of components) c.update(match);
    cards.updateMatch(match);
    syncOnAirScreen(s);
  }
});

if (params.debug) mountDebug(store);

// Audio plays in the OBS browser source only. Every preview surface — the admin Preview and
// pop-out windows, the look gallery, the resolution tester, fixture renders — is a real browser
// tab, and constructing the engine there preloaded the whole sound library on WebSocket connect.
// A download manager on the operator's PC turns those ungestured mp3 GETs into "Save As" dialogs,
// so previews now load no audio at all. The Sounds page is where audio is auditioned.
const audio =
  params.preview || params.fixture || params.look || params.gallery || params.debug
    ? null
    : new OverlayAudio(createBrowserEngine(), location.origin);
if (audio) {
  // Normal browsers hold audio until a click; OBS does not need this.
  // In preview mode, we also need an unlock button for browsers.
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

if (fixtureState) {
  const base = fixtureState;
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

// Commentary audio should ONLY play on:
// 1. The Full Resolution / Broadcast Preview window (?preview=1&resolution=1)
// 2. The Pop-out overlay window (window.self === window.top)
// 3. The OBS Browser source overlay (window.self === window.top)
//
// Commentary audio must NEVER play in background admin dashboard frames (e.g. LookPreview cards on
// Graphics page, ProLooksModal, Setup iframe, or design QA gallery), which was causing duplicate
// speech, echo, and distorted comb-filtering.
const isDashboardFrame =
  typeof window !== 'undefined' && window.self !== window.top && !params.resolution;
const isLookOrGallery = Boolean(params.look && !params.resolution) || params.gallery;
const commMuted = Boolean(params.commMute) || isDashboardFrame || isLookOrGallery;

// Same origin as the overlay page, which is what the API proxy and the packaged app both serve.
const commentary = new OverlayCommentary({ audioBase: location.origin });
if (commMuted) {
  commentary.setEnabled(false);
}

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
      if (!commMuted) {
        commentary.handle(msg.payload);
      }
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
    } else if (msg.channel === 'licence') {
      const data = msg.payload as { licensed?: boolean } | null;
      if (data?.licensed !== undefined) {
        store.setLicensed(data.licensed);
      }
    } else if (msg.channel === 'layout') {
      if (msg.event === 'settings') {
        const s = SettingsSchema.safeParse(msg.payload);
        if (s.success) {
          const effective = withUrlOverrides(s.data);
          store.setSettings(effective);
          // Read the theme back off the URL-pinned settings, never the raw payload, or a live
          // settings push would undo `?look=` for every gallery preview.
          if (effective.theme) {
            const l = getLook(effective.theme);
            if (l && canRunLook(l) && l.id !== store.get().look.id) store.setLook(l);
          }
        }
      } else if (msg.event === 'look') {
        const l = LookSchema.safeParse(msg.payload);
        if (l.success && !params.look && canRunLook(l.data)) store.setLook(l.data);
      }
    }
  },
});
client.start();

// Design-QA page: replaces the live overlay with every card against the fixtures.
if (params.gallery) mountGallery(stageEl, store.get().look);
