import type { RawUpdate, SourceSite } from '@stumpcast/shared';
import type { Adapter, TapResponse } from '../adapter';
import type { ContentMessage } from '../messages';
import { MIN_CONFIDENCE } from '../adapters/engine';

export interface PipelineOptions {
  site: SourceSite;
  adapter: Adapter;
  getDocument: () => Document;
  getUrl: () => string;
  send: (msg: ContentMessage) => void;
  now?: () => number;
  /** Max 2 updates/second by default. */
  minIntervalMs?: number;
  /** How many distinct tapped URLs to remember. */
  maxTaps?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
}

const TICK_INTERVAL_MS = 5000;

/** Stable signature of an update ignoring capture time, for de-duplication. */
const signature = (u: RawUpdate): string =>
  JSON.stringify({ id: u.matchId, f: u.fields, c: u.confidence });

/**
 * Runs the adapter on demand, drops duplicates, rate-limits and reports degradation.
 * `trigger()` is cheap to call often (tap response, DOM mutation).
 */
export const createPipeline = (opts: PipelineOptions) => {
  const now = opts.now ?? Date.now;
  const minInterval = opts.minIntervalMs ?? 500;
  const maxTaps = opts.maxTaps ?? 20;
  const setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));

  const taps = new Map<string, unknown>();
  let lastSig = '';
  let lastTickAt = -Infinity;
  let lastSentAt = -Infinity;
  let pending: RawUpdate | null = null;
  let timer: unknown = null;
  let paused = false;
  let degraded = false;

  const flush = () => {
    timer = null;
    if (!pending || paused) return;
    const update = pending;
    pending = null;
    lastSentAt = now();
    opts.send({ type: 'score-update', update });
  };

  const run = () => {
    if (paused) return;
    const tapList: TapResponse[] = [...taps].map(([url, json]) => ({ url, json }));
    let update: RawUpdate;
    try {
      update = opts.adapter({
        site: opts.site,
        url: opts.getUrl(),
        document: opts.getDocument(),
        taps: tapList,
        now: now(),
      });
    } catch {
      return; // adapters should not throw; never let it reach the page
    }

    if (update.confidence < MIN_CONFIDENCE) {
      if (!degraded) {
        degraded = true; // report once per degraded episode, not on every mutation
        opts.send({
          type: 'adapter-degraded',
          site: opts.site,
          url: update.url,
          confidence: update.confidence,
          missing: update.missing,
          at: now(),
        });
      }
      return;
    }
    degraded = false;

    const sig = signature(update);
    if (sig === lastSig) {
      // Unchanged score: still tell the background the tab is alive (at most every 5 s).
      if (now() - lastTickAt >= TICK_INTERVAL_MS) {
        lastTickAt = now();
        opts.send({
          type: 'tick',
          matchId: update.matchId,
          url: update.url,
          confidence: update.confidence,
          at: now(),
        });
      }
      return;
    }
    lastSig = sig;
    lastTickAt = now();
    pending = update; // newest wins while waiting for the rate limit

    const wait = lastSentAt + minInterval - now();
    if (wait <= 0) {
      if (timer !== null) clearTimer(timer);
      flush();
    } else if (timer === null) {
      timer = setTimer(flush, wait);
    }
  };

  return {
    /** A JSON response the page fetched. Re-keyed by URL so only the latest is used. */
    addTap(url: string, json: unknown) {
      taps.delete(url);
      taps.set(url, json);
      while (taps.size > maxTaps) taps.delete(taps.keys().next().value as string);
      run();
    },
    trigger: run,
    setAdapter(adapter: Adapter) {
      opts.adapter = adapter;
    },
    setPaused(value: boolean) {
      paused = value;
      if (value) {
        pending = null;
        if (timer !== null) clearTimer(timer);
        timer = null;
      }
    },
  };
};
