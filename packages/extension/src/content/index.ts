// Isolated-world content script (document_start). Runs the adapter and forwards updates.
import { cricbuzzConfig } from '../adapters/cricbuzz';
import { crexConfig } from '../adapters/crex';
import { urlMatches, createAdapter } from '../adapters/engine';
import type { SelectorConfig } from '../adapters/config';
import type { SelectorBundle } from '@stumpcast/shared';
import { TAP_MARKER, isTapMessage, type ContentMessage, type TapConfigEnvelope } from '../messages';
import { createPipeline } from './pipeline';

const DEBOUNCE_MS = 1000;

const start = async () => {
  let activeCustom: SelectorBundle | null = null;
  try {
    const stored = (await chrome.storage.local.get('customSelectors')) as {
      customSelectors?: SelectorBundle;
    };
    activeCustom = stored.customSelectors ?? null;
  } catch {
    // storage not available or error
  }

  const getConfig = (site: 'cricbuzz' | 'crex'): SelectorConfig => {
    if (activeCustom?.selectors?.[site]) {
      return activeCustom.selectors[site] as SelectorConfig;
    }
    return site === 'cricbuzz' ? cricbuzzConfig : crexConfig;
  };

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

  let currentCandidate: { config: SelectorConfig; make: () => ReturnType<typeof createAdapter> } | null = null;
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

  const setupForCandidate = (cand: { config: SelectorConfig; make: () => ReturnType<typeof createAdapter> }) => {
    currentCandidate = cand;
    const currentConfig = cand.config;
    const handle = cand.make();

    console.info(`[StumpCast Studio Connector] Matched ${currentConfig.site} live page: ${location.href}`);

    pipeline = createPipeline({
      site: currentConfig.site,
      adapter: (ctx) => handle.adapter(ctx),
      getDocument: () => document,
      getUrl: () => location.href,
      send: (msg: ContentMessage) => {
        try {
          if (msg.type === 'score-update') {
            console.debug('[StumpCast] Streamed score update:', msg.update.fields.status || msg.update.matchId);
          }
          void chrome.runtime.sendMessage(msg).catch(() => undefined);
        } catch {
          /* extension context invalidated; stop quietly */
        }
      },
    });

    pipeline.setPaused(readingPaused);
    sendTapConfig(readingPaused, currentConfig);

    if (!readingPaused) {
      if (observer) observer.disconnect();
      observer = new MutationObserver(schedule);
      observer.observe(document, { subtree: true, childList: true, characterData: true });
      schedule();

      if (pollInterval === null) {
        pollInterval = setInterval(() => {
          pipeline?.trigger();
        }, 2500);
      }
    }
  };

  const checkUrlChange = () => {
    const href = location.href;
    if (href === lastCheckedHref) return;
    lastCheckedHref = href;

    const cand = getCandidateForUrl(href);
    if (cand) {
      if (!currentCandidate || currentCandidate.config.site !== cand.config.site) {
        setupForCandidate(cand);
      } else {
        pipeline?.trigger();
      }
    }
  };

  // Check URL immediately
  checkUrlChange();

  // Listen for incoming tapped responses from page-world
  window.addEventListener('message', (e: MessageEvent) => {
    if (e.source !== window || !isTapMessage(e.data) || e.data.kind !== 'response') return;
    pipeline?.addTap(e.data.url, e.data.json);
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
      setupForCandidate(currentCandidate);
    }
  };

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.readingPaused) {
        applyPauseState(changes.readingPaused.newValue === true);
      }
      if (changes.customSelectors) {
        activeCustom = (changes.customSelectors.newValue as SelectorBundle) ?? null;
        const cand = getCandidateForUrl(location.href);
        if (cand) setupForCandidate(cand);
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
