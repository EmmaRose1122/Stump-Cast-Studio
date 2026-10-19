import { TAP_MARKER, isTapMessage, type TapEnvelope } from '../messages';

/** Skip bodies larger than this; live-score payloads are small. */
const MAX_BODY_CHARS = 1_000_000;
/** Responses seen before the config arrives (document_start race) are kept, newest last. */
const MAX_BUFFERED = 20;

/** The subset of `window` the tap needs; lets tests pass a fake. */
export interface TapWindow {
  fetch?: (...args: never[]) => Promise<Response>;
  XMLHttpRequest?: { prototype: XMLHttpRequest } & object;
  location: { href: string };
  postMessage(message: unknown, targetOrigin: string): void;
  addEventListener(type: 'message', listener: (e: MessageEvent) => void): void;
}

const absolute = (win: TapWindow, url: string): string => {
  try {
    return new URL(url, win.location.href).href;
  } catch {
    return url;
  }
};

/**
 * Observe responses to requests the page already makes. This never issues a request of its
 * own, never alters arguments, responses, headers or timing, and swallows its own errors so
 * the page cannot be broken by it. Runs in the page's MAIN world.
 */
export const installTap = (win: TapWindow): void => {
  let regexes: RegExp[] | null = null; // null until the content script sends its config
  const buffered: TapEnvelope[] = [];

  const emit = (env: TapEnvelope) => win.postMessage(env, '*');

  const consider = (url: string, readBody: () => Promise<string> | string) => {
    const handle = (matches: boolean) => {
      if (!matches) return;
      void Promise.resolve()
        .then(readBody)
        .then((text) => {
          if (typeof text !== 'string' || text.length === 0 || text.length > MAX_BODY_CHARS) return;
          let parsed: unknown;
          try {
            parsed = JSON.parse(text);
          } catch {
            return;
          }
          const env: TapEnvelope = {
            marker: TAP_MARKER,
            kind: 'response',
            url,
            json: parsed,
          };
          if (regexes) emit(env);
          else {
            buffered.push(env);
            if (buffered.length > MAX_BUFFERED) buffered.shift();
          }
        })
        .catch(() => undefined); // not JSON, body used, etc.: ignore
    };
    // Before config arrives we cannot filter, so read optimistically (bounded buffer).
    handle(regexes === null ? true : regexes.some((r) => r.test(url)));
  };

  // fetch
  const origFetch = win.fetch;
  if (typeof origFetch === 'function') {
    win.fetch = function patchedFetch(this: unknown, ...args: never[]) {
      const promise = (origFetch as (...a: never[]) => Promise<Response>).apply(this, args);
      try {
        const first = args[0] as unknown;
        const raw =
          typeof first === 'string'
            ? first
            : first instanceof URL
              ? first.href
              : ((first as { url?: string } | undefined)?.url ?? '');
        const url = absolute(win, raw);
        void promise
          .then((res) => {
            const copy = res.clone(); // clone so the page's own read is unaffected
            consider(url, () => copy.text());
          })
          .catch(() => undefined);
      } catch {
        /* never break the page */
      }
      return promise;
    } as typeof win.fetch;
  }

  // XMLHttpRequest
  const XHR = win.XMLHttpRequest?.prototype;
  if (XHR) {
    const urls = new WeakMap<object, string>();
    const origOpen = XHR.open;
    const origSend = XHR.send;
    XHR.open = function patchedOpen(this: XMLHttpRequest, ...args: unknown[]) {
      try {
        urls.set(this, absolute(win, String(args[1])));
      } catch {
        /* ignore */
      }
      return (origOpen as (...a: unknown[]) => void).apply(this, args);
    } as typeof XHR.open;
    XHR.send = function patchedSend(this: XMLHttpRequest, ...args: unknown[]) {
      try {
        this.addEventListener('load', () => {
          const url = urls.get(this);
          if (!url) return;
          if (this.responseType !== '' && this.responseType !== 'text') return;
          consider(url, () => this.responseText);
        });
      } catch {
        /* ignore */
      }
      return (origSend as (...a: unknown[]) => void).apply(this, args);
    } as typeof XHR.send;
  }

  // Config from the isolated-world content script.
  win.addEventListener('message', (e: MessageEvent) => {
    const data = e.data as unknown;
    if (!isTapMessage(data) || data.kind !== 'config') return;
    const next: RegExp[] = [];
    for (const src of data.urlRegexes) {
      try {
        next.push(new RegExp(src));
      } catch {
        /* skip invalid pattern */
      }
    }
    regexes = next;
    for (const env of buffered.splice(0)) {
      if (next.some((r) => r.test(env.url))) emit(env);
    }
  });
};
