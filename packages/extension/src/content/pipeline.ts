import type { RawUpdate, SourceSite } from '@stumpcast/shared';
import type { Adapter, TapResponse } from '../adapter';
import type { ContentMessage } from '../messages';
import { MIN_CONFIDENCE } from '../adapters/engine';

export interface PipelineOptions {
  /** Only used to fill the adapter input; adapters read their own config's site. */
  site: SourceSite;
  adapter: Adapter;
  getDocument: () => Document;
  getUrl: () => string;
  /**
   * Hand the message to the background. Returning a rejected promise (service worker restart,
   * invalidated extension context) makes the pipeline retry the update instead of filtering it
   * as a duplicate forever.
   */
  send: (msg: ContentMessage) => void | Promise<void>;
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
 * A squads page carries no score, so it can never reach the confidence bar — but the line-up on it
 * is real information about a match the studio already has. The server treats an update like this
 * as a patch (it cannot move a score), so it is worth shipping even though it is not a score.
 */
const carriesSquad = (u: RawUpdate): boolean =>
  u.fields.teams.some((t) => (t.squad?.length ?? 0) > 0);

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

  const sendQuiet = (msg: ContentMessage): void => {
    // Heartbeat-style messages are best-effort: a failure must not surface as an unhandled
    // rejection, and there is nothing to retry.
    try {
      void Promise.resolve(opts.send(msg)).catch(() => undefined);
    } catch {
      /* ignore */
    }
  };

  const flush = () => {
    timer = null;
    if (!pending || paused) return;
    const update = pending;
    pending = null;
    lastSentAt = now();
    deliver(update);
  };

  const deliver = (update: RawUpdate) => {
    let result: void | Promise<void>;
    try {
      result = opts.send({ type: 'score-update', update });
    } catch {
      result = Promise.reject(undefined);
    }
    if (!(result instanceof Promise)) return;
    void result.catch(() => {
      // The background never took this update. Forget the de-duplication signature and put it
      // back in the queue, otherwise the ball is lost until the score changes again.
      if (signature(update) === lastSig) lastSig = '';
      pending = pending ?? update;
      if (timer === null) timer = setTimer(flush, minInterval);
    });
  };

  const run = () => {
    if (paused) return;
    // Newest first: the adapter keeps the first value it sees for each field, so the most
    // recent response must be the one that writes it.
    const tapList: TapResponse[] = [...taps].reverse().map(([url, json]) => ({ url, json }));
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

    if (update.confidence < MIN_CONFIDENCE && !carriesSquad(update)) {
      if (!degraded) {
        degraded = true; // report once per degraded episode, not on every mutation
        sendQuiet({
          type: 'adapter-degraded',
          // The site the adapter actually ran as, not the one this document first matched:
          // navigating from one supported site to another keeps the same pipeline.
          site: update.source,
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
        sendQuiet({
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
    /**
     * Forget the de-duplication state and any queued update without dropping the tapped
     * responses. Used when the rules change under the pipeline (selector reload, resume) so the
     * current score is read again by the new rules.
     */
    reset() {
      lastSig = '';
      degraded = false;
      pending = null;
      if (timer !== null) clearTimer(timer);
      timer = null;
    },
    /** Forget every response the page fetched (used when the tab navigates to another match). */
    clearTaps() {
      taps.clear();
    },
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
