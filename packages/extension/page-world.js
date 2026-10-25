"use strict";
(() => {
  // src/messages.ts
  var TAP_MARKER = "stumpcast-tap";
  var isTapMessage = (v) => typeof v === "object" && v !== null && v.marker === TAP_MARKER && ["response", "config"].includes(v.kind ?? "");

  // src/content/tap.ts
  var MAX_BODY_CHARS = 1e6;
  var MAX_BUFFERED = 20;
  var absolute = (win, url) => {
    try {
      return new URL(url, win.location.href).href;
    } catch {
      return url;
    }
  };
  var installTap = (win) => {
    let regexes = null;
    const buffered = [];
    const emit = (env) => win.postMessage(env, "*");
    const consider = (url, readBody) => {
      const handle = (matches) => {
        if (!matches) return;
        let body;
        try {
          body = readBody();
        } catch {
          return;
        }
        void Promise.resolve(body).then((text) => {
          if (typeof text !== "string" || text.length === 0 || text.length > MAX_BODY_CHARS) return;
          let parsed;
          try {
            parsed = JSON.parse(text);
          } catch {
            return;
          }
          const env = {
            marker: TAP_MARKER,
            kind: "response",
            url,
            json: parsed
          };
          if (regexes) emit(env);
          else {
            buffered.push(env);
            if (buffered.length > MAX_BUFFERED) buffered.shift();
          }
        }).catch(() => void 0);
      };
      handle(regexes === null ? true : regexes.some((r) => r.test(url)));
    };
    const origFetch = win.fetch;
    if (typeof origFetch === "function") {
      let currentFetch = origFetch;
      let installedFetch;
      let insideFetch = 0;
      const wrapFetch = (fetchFn) => function patchedFetch(...args) {
        if (insideFetch > 0) return origFetch.apply(this, args);
        insideFetch += 1;
        let promise;
        try {
          promise = fetchFn.apply(this, args);
        } finally {
          insideFetch -= 1;
        }
        try {
          const first = args[0];
          const raw = typeof first === "string" ? first : first instanceof URL ? first.href : first?.url ?? "";
          const url = absolute(win, raw);
          void promise.then((res) => {
            const copy = res.clone();
            consider(url, () => copy.text());
          }).catch(() => void 0);
        } catch {
        }
        return promise;
      };
      installedFetch = wrapFetch(currentFetch);
      try {
        Object.defineProperty(win, "fetch", {
          configurable: true,
          enumerable: true,
          get: () => installedFetch,
          set: (next) => {
            if (typeof next !== "function" || next === installedFetch) return;
            currentFetch = next;
            installedFetch = wrapFetch(currentFetch);
          }
        });
      } catch {
        win.fetch = installedFetch;
      }
    }
    const XHR = win.XMLHttpRequest?.prototype;
    if (XHR) {
      const states = /* @__PURE__ */ new WeakMap();
      const observed = /* @__PURE__ */ new WeakSet();
      const observe = (xhr, url) => {
        states.set(xhr, { url, reported: false });
        if (observed.has(xhr)) return;
        observed.add(xhr);
        const capture = () => {
          const state = states.get(xhr);
          if (!state || state.reported || xhr.readyState !== 4) return;
          state.reported = true;
          if (xhr.responseType === "json") {
            consider(state.url, () => xhr.response == null ? "" : JSON.stringify(xhr.response));
          } else if (xhr.responseType === "" || xhr.responseType === "text") {
            consider(state.url, () => xhr.responseText);
          }
        };
        xhr.addEventListener("readystatechange", capture);
        xhr.addEventListener("load", capture);
      };
      const origOpen = XHR.open;
      XHR.open = function patchedOpen(...args) {
        try {
          observe(this, absolute(win, String(args[1])));
        } catch {
        }
        return origOpen.apply(this, args);
      };
    }
    win.addEventListener("message", (e) => {
      const data = e.data;
      if (!isTapMessage(data) || data.kind !== "config") return;
      const next = [];
      for (const src of data.urlRegexes) {
        try {
          next.push(new RegExp(src));
        } catch {
        }
      }
      regexes = next;
      for (const env of buffered.splice(0)) {
        if (next.some((r) => r.test(env.url))) emit(env);
      }
    });
  };

  // src/content/page-world.ts
  installTap(window);
})();
