import type { RawUpdate } from '@stumpcast/shared';

/** Marker on window.postMessage envelopes between the page-world tap and the content script. */
export const TAP_MARKER = 'stumpcast-tap';

/** Page world -> content script: a JSON response the page already fetched. */
export interface TapEnvelope {
  marker: typeof TAP_MARKER;
  kind: 'response';
  url: string;
  json: unknown;
}

/** Content script -> page world: which response URLs are worth forwarding. */
export interface TapConfigEnvelope {
  marker: typeof TAP_MARKER;
  kind: 'config';
  urlRegexes: string[];
}

export type TapMessage = TapEnvelope | TapConfigEnvelope;

export const isTapMessage = (v: unknown): v is TapMessage =>
  typeof v === 'object' &&
  v !== null &&
  (v as { marker?: unknown }).marker === TAP_MARKER &&
  ['response', 'config'].includes((v as { kind?: string }).kind ?? '');

/** Content script -> background service worker (chrome.runtime.sendMessage). */
export type ContentMessage =
  | { type: 'score-update'; update: RawUpdate }
  /** Parsed fine but nothing changed; keeps the tab marked alive for stale detection. */
  | { type: 'tick'; matchId: string; url: string; confidence: number; at: number }
  | {
      type: 'adapter-degraded';
      site: string;
      url: string;
      confidence: number;
      missing: string[];
      at: number;
    };
