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
        void Promise.resolve().then(readBody).then((text) => {
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
      win.fetch = function patchedFetch(...args) {
        const promise = origFetch.apply(this, args);
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
    }
    const XHR = win.XMLHttpRequest?.prototype;
    if (XHR) {
      const urls = /* @__PURE__ */ new WeakMap();
      const origOpen = XHR.open;
      const origSend = XHR.send;
      XHR.open = function patchedOpen(...args) {
        try {
          urls.set(this, absolute(win, String(args[1])));
        } catch {
        }
        return origOpen.apply(this, args);
      };
      XHR.send = function patchedSend(...args) {
        try {
          this.addEventListener("load", () => {
            const url = urls.get(this);
            if (!url) return;
            if (this.responseType !== "" && this.responseType !== "text") return;
            consider(url, () => this.responseText);
          });
        } catch {
        }
        return origSend.apply(this, args);
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
