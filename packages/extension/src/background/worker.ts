// MV3 service worker: wires chrome.* APIs into the Connector.
import { cricbuzzConfig } from '../adapters/cricbuzz';
import type { ContentMessage } from '../messages';
import { Connector, type SocketLike, type TabsApi } from './connector';

const chromeTabs: TabsApi = {
  async open(url) {
    // A dedicated small minimized window: background tabs throttle timers, minimized windows
    // keep running. Pinned and non-discardable so Chrome does not freeze or evict the tab.
    const win = await chrome.windows.create({
      url,
      state: 'minimized',
      focused: false,
      type: 'normal',
    });
    const tab = win?.tabs?.[0];
    if (tab?.id == null) return null;
    await chrome.tabs.update(tab.id, { pinned: true, autoDiscardable: false });
    return tab.id;
  },
  async focus(tabId) {
    const tab = await chrome.tabs.get(tabId);
    await chrome.tabs.update(tabId, { active: true });
    if (tab.windowId != null) await chrome.windows.update(tab.windowId, { focused: true });
  },
  async close(tabId) {
    await chrome.tabs.remove(tabId);
  },
};

const connector = new Connector({
  storage: {
    async get(key) {
      return (await chrome.storage.local.get(key))[key];
    },
    async set(key, value) {
      await chrome.storage.local.set({ [key]: value });
    },
    async remove(key) {
      await chrome.storage.local.remove(key);
    },
    async clear() {
      await chrome.storage.local.clear();
    },
  },
  fetch: (url, init) => fetch(url, init),
  createSocket: (url) => new WebSocket(url) as unknown as SocketLike,
  tabs: chromeTabs,
  timers: {
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: (id) => clearInterval(id as ReturnType<typeof setInterval>),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
  },
  now: () => Date.now(),
  version: chrome.runtime.getManifest().version,
  selectorsVersion: () => cricbuzzConfig.version,
});

void connector.init();

// MV3 workers are suspended when idle; an alarm wakes us and re-establishes the socket.
void chrome.alarms.create('keepalive', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === 'keepalive') void connector.ensureConnected();
});
chrome.runtime.onStartup.addListener(() => void connector.init());
chrome.runtime.onInstalled.addListener(() => void connector.init());
// Toolbar button: opens the options page, where pairing and status live.
chrome.action.onClicked.addListener(() => void chrome.runtime.openOptionsPage());
chrome.tabs.onRemoved.addListener((tabId) => connector.onTabRemoved(tabId));

chrome.runtime.onMessage.addListener((msg: unknown, sender, sendResponse) => {
  const m = msg as { type?: string; code?: string };
  // Options-page pairing request (X8 builds the UI).
  if (m.type === 'pair' && typeof m.code === 'string') {
    void connector.pair(m.code).then((ok) => sendResponse({ ok }));
    return true;
  }
  if (m.type === 'auto-pair') {
    void connector.autoPair().then((ok) => sendResponse({ ok }));
    return true;
  }
  if (m.type === 'unpair') {
    void connector.unpair().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (m.type === 'set-port' && typeof (msg as { port?: number }).port === 'number') {
    void connector.setPort((msg as { port: number }).port).then((ok) => sendResponse({ ok, port: connector.boundPort }));
    return true;
  }
  if (m.type === 'detect-ports') {
    void connector.detectActivePorts().then((ports) => sendResponse({ ports }));
    return true;
  }
  if (m.type === 'clear-data') {
    void connector
      .clearData()
      .then(async () => {
        const tabs = await chrome.tabs.query({});
        await Promise.all(
          tabs.map((tab) =>
            tab.id == null
              ? Promise.resolve()
              : chrome.tabs.sendMessage(tab.id, { type: 'data-cleared' }).catch(() => undefined),
          ),
        );
        sendResponse({ ok: true });
      })
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  if (m.type === 'status') {
    void Promise.all([
      chrome.storage.local.get('readingPaused'),
      connector.detectActivePorts(),
    ]).then(([{ readingPaused }, detectedPorts]) =>
      sendResponse({
        paired: connector.paired,
        tabs: connector.tabs,
        readingPaused: readingPaused === true,
        port: connector.boundPort,
        detectedPorts,
      }),
    );
    return true;
  }
  if (['score-update', 'tick', 'adapter-degraded'].includes(m.type ?? '')) {
    void connector
      .init()
      .then(() => connector.onContentMessage(msg as ContentMessage, sender.tab?.id ?? null))
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  return false;
});
