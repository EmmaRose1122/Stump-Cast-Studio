// Isolated-world content script (document_start). Runs the adapter and forwards updates.
import { cricbuzzConfig } from '../adapters/cricbuzz';
import { crexConfig } from '../adapters/crex';
import { urlMatches, createAdapter } from '../adapters/engine';
import { SelectorConfigSchema, type SelectorConfig } from '../adapters/config';
import type { SelectorBundle } from '@stumpcast/shared';
import { TAP_MARKER, isTapMessage, type ContentMessage, type TapConfigEnvelope } from '../messages';
import { createPipeline } from './pipeline';
import { attachPictures } from './pictures';

const DEBOUNCE_MS = 1000;
type Site = 'cricbuzz' | 'crex';

const start = async () => {
  let bundle: SelectorBundle | null = null;
  try {
    const stored = (await chrome.storage.local.get('customSelectors')) as {
      customSelectors?: SelectorBundle;
    };
    bundle = stored.customSelectors ?? null;
  } catch {
    // storage not available or error
  }

  // A signature proves who wrote the bundle, not that its config is safe to hand to querySelector
  // and RegExp, so every remote site config is parsed before use and dropped if it fails.
  let customConfigs: Partial<Record<Site, SelectorConfig>> = {};

  const applyBundle = (next: SelectorBundle | null) => {
    bundle = next;
    const parsed: Partial<Record<Site, SelectorConfig>> = {};
    for (const site of ['cricbuzz', 'crex'] as Site[]) {
      const raw = next?.selectors?.[site];
      if (!raw) continue;
      try {
        parsed[site] = SelectorConfigSchema.parse(raw);
      } catch {
        console.warn(`[StumpCast Studio Connector] Ignoring invalid ${site} selectors from the remote bundle`);
      }
    }
    customConfigs = parsed;
  };
  applyBundle(bundle);

  const getConfig = (site: Site): SelectorConfig =>
    customConfigs[site] ?? (site === 'cricbuzz' ? cricbuzzConfig : crexConfig);

  const getCandidateForUrl = (href: string): {
    config: SelectorConfig;
    make: () => ReturnType<typeof createAdapter>;
  } | null => {
    const cb = getConfig('cricbuzz');
    if (urlMatches(cb, href)) return { config: cb, make: () => createAdapter(cb) };
    const cx = getConfig('crex');
    if (urlMatches(cx, href)) return { config: cx, make: () => createAdapter(cx) };
    return null;
  };

  type Candidate = { config: SelectorConfig; make: () => ReturnType<typeof createAdapter> };

  let currentCandidate: Candidate | null = null;
  let handle: ReturnType<typeof createAdapter> | null = null;
  let pipeline: ReturnType<typeof createPipeline> | null = null;
  let observer: MutationObserver | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let readingPaused = false;
  let lastCheckedHref = '';

  const schedule = () => {
    if (timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      pipeline?.trigger();
    }, DEBOUNCE_MS);
  };

  const sendTapConfig = (paused: boolean, config: SelectorConfig) => {
    const cfg: TapConfigEnvelope = {
      marker: TAP_MARKER,
      kind: 'config',
      urlRegexes: paused ? [] : config.jsonTaps.map((t) => t.urlRegex),
    };
    window.postMessage(cfg, '*');
  };

  /** One pipeline per document: it owns the de-duplication state and the tapped responses. */
  const ensurePipeline = (site: SelectorConfig['site']) => {
    if (pipeline) return;
    pipeline = createPipeline({
      site,
      // Resolved through `handle` so a selector reload or resume swaps the rules without
      // throwing away this document's state (and without leaving an orphaned timer behind).
      adapter: (ctx) => handle!.adapter(ctx),
      getDocument: () => document,
      getUrl: () => location.href,
      send: (msg: ContentMessage) => {
        if (msg.type === 'score-update') {
          // Last chance to look at the live DOM: the crests and faces the page is showing right now
          // travel with the score, so a new team or batter is on air with its picture.
          attachPictures(msg.update, document, location.href);
          console.debug('[StumpCast] Streamed score update:', msg.update.fields.status || msg.update.matchId);
        }
        // Rejection is meaningful: the pipeline retries the update instead of losing the ball.
        return chrome.runtime.sendMessage(msg);
      },
    });
  };

  const applyCandidate = (cand: Candidate) => {
    currentCandidate = cand;
    handle = cand.make();
    ensurePipeline(cand.config.site);

    console.info(`[StumpCast Studio Connector] Matched ${cand.config.site} live page: ${location.href}`);

    // New rules see the same page: forget the last signature so the current score is reported
    // again, but keep the tapped responses and the pipeline itself.
    pipeline!.reset();
    pipeline!.setPaused(readingPaused);
    sendTapConfig(readingPaused, cand.config);

    if (!readingPaused) startObserving();
  };

  const startObserving = () => {
    if (observer) observer.disconnect();
    observer = new MutationObserver(schedule);
    observer.observe(document, { subtree: true, childList: true, characterData: true });
    schedule();

    if (pollInterval === null) {
      pollInterval = setInterval(() => {
        pipeline?.trigger();
      }, 2500);
    }
  };

  const checkUrlChange = () => {
    const href = location.href;
    if (href === lastCheckedHref) return;
    lastCheckedHref = href;
    // Tapped JSON from the previous match would otherwise keep answering for this one.
    pipeline?.clearTaps();

    const cand = getCandidateForUrl(href);
    if (cand) {
      if (!currentCandidate || currentCandidate.config.site !== cand.config.site) {
        applyCandidate(cand);
      } else {
        pipeline?.trigger();
      }
    }
  };

  // Check URL immediately
  checkUrlChange();

  // Listen for incoming tapped responses from page-world. Filtering happens here, in the
  // isolated world, so page-authored messages cannot reach the adapter unchecked.
  window.addEventListener('message', (e: MessageEvent) => {
    if (e.source !== window || e.origin !== location.origin) return;
    if (!isTapMessage(e.data) || e.data.kind !== 'response') return;
    const config = currentCandidate?.config;
    if (!config) return;
    let url: string;
    try {
      url = new URL(e.data.url, location.href).href;
    } catch {
      return;
    }
    const tapped = config.jsonTaps.some((tap) => {
      try {
        return new RegExp(tap.urlRegex).test(url);
      } catch {
        return false;
      }
    });
    if (!tapped || typeof e.data.json !== 'object' || e.data.json === null) return;
    pipeline?.addTap(url, e.data.json);
  });

  const applyPauseState = (paused: boolean) => {
    readingPaused = paused;
    if (pipeline && currentCandidate) {
      pipeline.setPaused(paused);
      sendTapConfig(paused, currentCandidate.config);
    }
    if (paused) {
      observer?.disconnect();
      if (timer !== null) clearTimeout(timer);
      timer = null;
      if (pollInterval !== null) clearInterval(pollInterval);
      pollInterval = null;
    } else if (currentCandidate) {
      // Resuming re-arms observation only. Rebuilding the adapter here used to reset the
      // "runs never go backwards" memory and re-emit the current score as if it were new.
      startObserving();
    }
  };

  chrome.runtime.onMessage.addListener((msg: unknown) => {
    if ((msg as { type?: string })?.type !== 'data-cleared') return;
    applyBundle(null);
    applyPauseState(false);
    const cand = getCandidateForUrl(location.href);
    if (cand) applyCandidate(cand);
    pipeline?.clearTaps();
    pipeline?.reset();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.readingPaused) {
        applyPauseState(changes.readingPaused.newValue === true);
      }
      if (changes.customSelectors) {
        applyBundle((changes.customSelectors.newValue as SelectorBundle) ?? null);
        const cand = getCandidateForUrl(location.href);
        if (cand) applyCandidate(cand);
      }
    }
  });

  void chrome.storage.local
    .get('readingPaused')
    .then(({ readingPaused: rp }) => applyPauseState(rp === true))
    .catch(() => applyPauseState(false));

  // SPA navigation hooks
  window.addEventListener('popstate', checkUrlChange);
  window.addEventListener('hashchange', checkUrlChange);
  setInterval(checkUrlChange, 1500);

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    schedule();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      checkUrlChange();
      schedule();
    });
    window.addEventListener('load', () => {
      checkUrlChange();
      schedule();
    });
  }
};

try {
  void start();
} catch {
  /* never throw into the page */
}
