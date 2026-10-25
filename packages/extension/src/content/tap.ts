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
      let body: Promise<string> | string;
      try {
        // Read in the same tick: a site's own load handler may clear the response right after us.
        body = readBody();
      } catch {
        return;
      }
      void Promise.resolve(body)
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

  // fetch. Crex (and other Angular sites) install their own zone wrapper after document_start,
  // which replaces ours. Hold the property so a later assignment is wrapped too, and fall back to
  // the function that was native at install time if a wrapper calls window.fetch from inside itself.
  const origFetch = win.fetch;
  if (typeof origFetch === 'function') {
    let currentFetch = origFetch;
    let installedFetch: typeof origFetch;
    let insideFetch = 0;
    const wrapFetch = (fetchFn: typeof origFetch) => function patchedFetch(
      this: unknown,
      ...args: never[]
    ) {
      if (insideFetch > 0) return origFetch.apply(this, args);
      insideFetch += 1;
      let promise: Promise<Response>;
      try {
        promise = fetchFn.apply(this, args);
      } finally {
        insideFetch -= 1;
      }
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
    } as typeof origFetch;
    installedFetch = wrapFetch(currentFetch);
    try {
      Object.defineProperty(win, 'fetch', {
        configurable: true,
        enumerable: true,
        get: () => installedFetch,
        set: (next: typeof origFetch) => {
          if (typeof next !== 'function' || next === installedFetch) return;
          currentFetch = next;
          installedFetch = wrapFetch(currentFetch);
        },
      });
    } catch {
      win.fetch = installedFetch;
    }
  }

  // XMLHttpRequest. The listener is attached in open(), before the site registers its own: Angular
  // handles `load` first if ours is late and may reset the request, so a load-only tap reads an empty
  // response. readystatechange fires before load and still has the body.
  const XHR = win.XMLHttpRequest?.prototype;
  if (XHR) {
    interface XhrState {
      url: string;
      reported: boolean;
    }
    const states = new WeakMap<XMLHttpRequest, XhrState>();
    const observed = new WeakSet<XMLHttpRequest>();
    const observe = (xhr: XMLHttpRequest, url: string) => {
      states.set(xhr, { url, reported: false });
      if (observed.has(xhr)) return;
      observed.add(xhr);
      const capture = () => {
        const state = states.get(xhr);
        if (!state || state.reported || xhr.readyState !== 4) return;
        state.reported = true;
        if (xhr.responseType === 'json') {
          consider(state.url, () => xhr.response == null ? '' : JSON.stringify(xhr.response));
        } else if (xhr.responseType === '' || xhr.responseType === 'text') {
          consider(state.url, () => xhr.responseText);
        }
      };
      xhr.addEventListener('readystatechange', capture);
      xhr.addEventListener('load', capture);
    };
    const origOpen = XHR.open;
    XHR.open = function patchedOpen(this: XMLHttpRequest, ...args: unknown[]) {
      try {
        observe(this, absolute(win, String(args[1])));
      } catch {
        /* ignore */
      }
      return (origOpen as (...a: unknown[]) => void).apply(this, args);
    } as typeof XHR.open;
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
