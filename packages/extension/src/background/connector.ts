import {
  DEFAULT_SELECTORS_PUBLIC_KEY,
  EXT_PORT_RANGE,
  ExtServerMessageSchema,
  verifySignedSelectorBundle,
  type ExtClientMessage,
  type ExtCommand,
  type SelectorBundle,
  type TabInfo,
} from '@stumpcast/shared';
import { SelectorConfigSchema } from '../adapters/config';
import type { ContentMessage } from '../messages';

export const HEARTBEAT_MS = 5000;
export const PING_MS = 15_000;
const BACKOFF_START_MS = 1000;
const BACKOFF_MAX_MS = 30_000;
/** Only these hosts may be opened by a server command. */
const ALLOWED_HOSTS = [/(^|\.)cricbuzz\.com$/i, /(^|\.)crex\.com$/i, /(^|\.)crex\.live$/i];

export interface SocketLike {
  readyState: number;
  send(data: string): void;
  close(code?: number): void;
  onopen: (() => void) | null;
  onmessage: ((e: { data: unknown }) => void) | null;
  onclose: ((e: { code: number }) => void) | null;
  onerror: (() => void) | null;
}

export interface TabsApi {
  /** Open a match in its own small minimized, pinned, non-discardable window. */
  open(url: string): Promise<number | null>;
  focus(tabId: number): Promise<void>;
  close(tabId: number): Promise<void>;
}

export interface Timers {
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(id: unknown): void;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

export interface ConnectorDeps {
  storage: {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
    remove(key: string): Promise<void>;
  };
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  createSocket(url: string): SocketLike;
  tabs: TabsApi;
  timers: Timers;
  now(): number;
  version: string;
  selectorsVersion(): number;
  /** Called when the server asks for a selector refresh (X5 implements it). */
  onReloadSelectors?: () => void;
}

interface TrackedTab extends TabInfo {
  tabId: number | null;
}

const OPEN = 1;
/** A full localhost port sweep is expensive; do not repeat it more often than this. */
const DISCOVERY_COOLDOWN_MS = 15_000;
/** How often to re-probe for other local Studio instances. */
const PEER_PROBE_MS = 60_000;
/** Heartbeats carry at most this many open matches; the same bound keeps storage small. */
const MAX_TRACKED_TABS = 20;

export class Connector {
  private token: string | null = null;
  private port: number | null = null;
  private socket: SocketLike | null = null;
  private authed = false;
  private heartbeatTimer: unknown = null;
  private pingTimer: unknown = null;
  private reconnectTimer: unknown = null;
  private backoff = BACKOFF_START_MS;
  private killed = false;
  private started = false;
  private activeSelectorsVersion: number | null = null;
  private readonly tracked = new Map<string, TrackedTab>();
  private lastDiscoveryAt: number | null = null;
  private discoveryInFlight: Promise<number | null> | null = null;
  private pairInFlight: Promise<boolean> | null = null;
  private lastPairFailureAt: number | null = null;
  private peerPorts: number[] = [];
  private peerProbeAt: number | null = null;

  constructor(private readonly deps: ConnectorDeps) {}

  // ---- lifecycle --------------------------------------------------------------------------

  /**
   * Safe to call on every service-worker wake-up. The MV3 worker is killed after ~30 s idle, so
   * the open-match list is kept in storage: without it "close match tab"/"focus" find no tab and
   * the heartbeat reports zero open matches while scores keep flowing.
   */
  async init(): Promise<void> {
    if (!this.started) {
      this.started = true;
      this.token = ((await this.deps.storage.get('token')) as string | null) ?? null;
      this.port = ((await this.deps.storage.get('port')) as number | null) ?? null;
      this.killed = ((await this.deps.storage.get('killed')) as boolean | null) ?? false;
      const custom = (await this.deps.storage.get('customSelectors')) as SelectorBundle | undefined;
      if (custom?.version) this.activeSelectorsVersion = custom.version;
      const saved = (await this.deps.storage.get('trackedTabs')) as TrackedTab[] | null;
      if (Array.isArray(saved)) {
        for (const t of saved) {
          if (t && typeof t.matchId === 'string') this.tracked.set(t.matchId, t);
        }
      }
    }
    if (this.token && !this.socket) await this.connect();
    else if (!this.token && !this.killed) await this.autoPair();
  }

  private persistTracked(): void {
    const keep = [...this.tracked.values()]
      .sort((a, b) => b.lastUpdateAt - a.lastUpdateAt)
      .slice(0, MAX_TRACKED_TABS);
    void Promise.resolve(this.deps.storage.set('trackedTabs', keep)).catch(() => undefined);
  }

  get paired(): boolean {
    return this.token !== null;
  }

  get boundPort(): number | null {
    return this.port;
  }

  /**
   * Pair without a code. Concurrent content scripts must share one attempt, and a failed
   * attempt is remembered so a server that is not running is not swept and re-paired every
   * few seconds per tab.
   */
  async autoPair(): Promise<boolean> {
    if (this.token) return true;
    if (this.pairInFlight) return this.pairInFlight;
    const now = this.deps.now();
    if (this.lastPairFailureAt !== null && now - this.lastPairFailureAt < DISCOVERY_COOLDOWN_MS) {
      return false;
    }
    const run = this.tryAutoPair().then((ok) => {
      this.lastPairFailureAt = ok ? null : this.deps.now();
      return ok;
    });
    this.pairInFlight = run;
    try {
      return await run;
    } finally {
      if (this.pairInFlight === run) this.pairInFlight = null;
    }
  }

  private async tryAutoPair(): Promise<boolean> {
    const port = await this.discoverPort();
    if (port === null) return false;
    for (const host of ['127.0.0.1', 'localhost']) {
      try {
        const res = await this.deps.fetch(`http://${host}:${port}/api/ext/auto-pair`, {
          method: 'POST',
        });
        if (res.ok) {
          const body = (await res.json()) as { token?: string };
          if (body.token) {
            this.token = body.token;
            await this.deps.storage.set('token', body.token);
            await this.connect();
            return true;
          }
        }
      } catch {
        /* try next host */
      }
    }
    return false;
  }

  async pair(code: string): Promise<boolean> {
    const port = await this.discoverPort();
    if (port === null) return false;
    for (const host of ['127.0.0.1', 'localhost']) {
      try {
        const res = await this.deps.fetch(`http://${host}:${port}/api/ext/pair`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        if (res.ok) {
          const body = (await res.json()) as { token?: string };
          if (body.token) {
            this.token = body.token;
            await this.deps.storage.set('token', body.token);
            await this.connect();
            return true;
          }
        }
      } catch {
        /* try next host */
      }
    }
    return false;
  }

  async unpair(): Promise<void> {
    this.token = null;
    await this.deps.storage.remove('token');
    this.teardown(true);
    if (!this.killed) {
      void this.autoPair();
    }
  }

  // ---- messages from content scripts ------------------------------------------------------

  private track(info: TrackedTab): void {
    this.tracked.set(info.matchId, info);
    this.persistTracked();
  }

  async onContentMessage(msg: ContentMessage, tabId: number | null): Promise<void> {
    if (this.killed) return;
    if (!this.token) {
      await this.autoPair();
    }
    const now = this.deps.now();
    if (msg.type === 'score-update') {
      const u = msg.update;
      this.track({
        matchId: u.matchId,
        url: u.url,
        lastUpdateAt: now,
        confidence: u.confidence,
        tabId,
      });
      await this.send({ type: 'update', update: u });
    } else if (msg.type === 'tick') {
      this.track({
        matchId: msg.matchId,
        url: msg.url,
        lastUpdateAt: now,
        confidence: msg.confidence,
        tabId,
      });
    } else {
      let matchId = 'live-tab';
      try {
        const p = new URL(msg.url).pathname.replace(/^\/+|\/+$/g, '').replace(/\//g, '-');
        if (p) matchId = p;
      } catch {
        // ignore
      }
      this.track({
        matchId,
        url: msg.url,
        lastUpdateAt: now,
        confidence: msg.confidence,
        tabId,
      });
      await this.send({
        type: 'degraded',
        site: msg.site,
        url: msg.url,
        confidence: msg.confidence,
        missing: msg.missing,
        at: msg.at,
      });
    }
  }

  /** Tab closed by the user: stop reporting it so the server can mark it gone. */
  onTabRemoved(tabId: number): void {
    let changed = false;
    for (const [id, t] of this.tracked)
      if (t.tabId === tabId) {
        this.tracked.delete(id);
        changed = true;
      }
    if (changed) this.persistTracked();
  }

  get tabs(): TabInfo[] {
    return [...this.tracked.values()]
      .slice(0, MAX_TRACKED_TABS)
      .map(({ tabId: _tabId, ...t }) => t);
  }

  // ---- transport --------------------------------------------------------------------------

  private peerTokens = new Map<number, string>();

  private async ensurePeerToken(p: number): Promise<string | null> {
    if (this.peerTokens.has(p)) return this.peerTokens.get(p)!;
    try {
      const res = await this.deps.fetch(`http://127.0.0.1:${p}/api/ext/auto-pair`, {
        method: 'POST',
      });
      if (res.ok) {
        const body = (await res.json()) as { token?: string };
        if (body.token) {
          this.peerTokens.set(p, body.token);
          return body.token;
        }
      }
    } catch {
      /* peer port unavailable */
    }
    return null;
  }

  private async send(msg: ExtClientMessage): Promise<void> {
    let sentWs = false;
    if (this.socket && this.socket.readyState === OPEN && this.authed) {
      try {
        this.socket.send(JSON.stringify(msg));
        sentWs = true;
      } catch {
        sentWs = false;
      }
    }
    // HTTP is the fallback only. Sending an update over the socket *and* by POST made the
    // server process the same ball twice per tick.
    if (!sentWs) await this.postIngest(msg);

    // Replicate to other local Studio instances, but only to peers that answered the last
    // probe: hammering two fixed ports for every ball wasted work when they were not there.
    for (const p of await this.livePeers()) {
      try {
        const token = await this.ensurePeerToken(p);
        if (token) {
          void this.deps
            .fetch(`http://127.0.0.1:${p}/api/ext/ingest`, {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(msg),
            })
            .catch(() => undefined);
        }
      } catch {
        /* peer unreachable */
      }
    }
  }

  /** Other Studio instances on this machine, refreshed at most every PEER_PROBE_MS. */
  private async livePeers(): Promise<number[]> {
    const now = this.deps.now();
    if (this.peerProbeAt !== null && now - this.peerProbeAt < PEER_PROBE_MS) return this.peerPorts;
    const candidates = [4000, 4001, 4002, 4003, 4004].filter((p) => p !== this.port);
    const alive: number[] = [];
    for (const p of candidates) {
      try {
        const res = await this.deps.fetch(`http://127.0.0.1:${p}/api/health`);
        if (res.ok) alive.push(p);
      } catch {
        /* not running */
      }
    }
    this.peerPorts = alive;
    this.peerProbeAt = now;
    return alive;
  }

  private async postIngest(msg: ExtClientMessage): Promise<void> {
    if (!this.token) {
      await this.autoPair();
      if (!this.token) return;
    }
    const port = this.port ?? (await this.discoverPort());
    if (port === null) return;
    try {
      const res = await this.deps.fetch(`http://127.0.0.1:${port}/api/ext/ingest`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(msg),
      });
      if (res.status === 401) {
        // Token revoked server-side. Drop it directly: unpair() re-enters autoPair itself, which
        // stacked a second pairing attempt on top of the one below.
        this.token = null;
        await this.deps.storage.remove('token');
        this.teardown(true);
        this.lastPairFailureAt = null;
        const rePaired = await this.autoPair();
        if (rePaired && this.token) {
          await this.deps.fetch(`http://127.0.0.1:${port}/api/ext/ingest`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${this.token}`,
            },
            body: JSON.stringify(msg),
          }).catch(() => undefined);
        }
      }
    } catch {
      /* server not reachable; the reconnect loop will recover */
    }
  }

  async setPort(targetPort: number): Promise<boolean> {
    this.port = targetPort;
    await this.deps.storage.set('port', targetPort);
    this.token = null;
    await this.deps.storage.remove('token');
    this.teardown(true);
    return await this.autoPair();
  }

  async detectActivePorts(): Promise<number[]> {
    const list = [4000, 4001, 4002, 4003, 4004, 5175];
    const found: number[] = [];
    for (const p of list) {
      try {
        const res = await this.deps.fetch(`http://127.0.0.1:${p}/api/health`);
        if (res.ok) found.push(p);
      } catch {
        /* port not active */
      }
    }
    return found;
  }

  /** Cached port first, then 4002, 4000..4010 and dev ports. Verifies via GET /api/health. */
  private async discoverPort(): Promise<number | null> {
    if (this.discoveryInFlight) return this.discoveryInFlight;
    const now = this.deps.now();
    if (this.lastDiscoveryAt !== null && now - this.lastDiscoveryAt < DISCOVERY_COOLDOWN_MS) {
      return this.port;
    }
    const run = this.sweepPort().then((port) => {
      this.lastDiscoveryAt = this.deps.now();
      return port;
    });
    this.discoveryInFlight = run;
    try {
      return await run;
    } finally {
      if (this.discoveryInFlight === run) this.discoveryInFlight = null;
    }
  }

  private async sweepPort(): Promise<number | null> {
    const candidates: number[] = [];
    if (this.port !== null) candidates.push(this.port);
    for (const p of [4002, 4000, 4001, 4003, 4004, 5175, 5174]) {
      if (!candidates.includes(p)) candidates.push(p);
    }
    for (let p = EXT_PORT_RANGE.from; p <= EXT_PORT_RANGE.to; p++) {
      if (!candidates.includes(p)) candidates.push(p);
    }
    for (const port of candidates) {
      for (const host of ['127.0.0.1', 'localhost']) {
        try {
          const res = await this.deps.fetch(`http://${host}:${port}/api/health`);
          if (res.ok) {
            const body = (await res.json()) as { ok?: boolean; port?: number };
            if (body.ok) {
              const actualPort = typeof body.port === 'number' && body.port > 0 ? body.port : port;
              this.port = actualPort;
              await this.deps.storage.set('port', actualPort);
              return actualPort;
            }
          }
        } catch {
          /* try next */
        }
      }
    }
    return null;
  }

  private async connect(): Promise<void> {
    if (!this.token || this.socket) return;
    const port = await this.discoverPort();
    if (port === null) return this.scheduleReconnect();

    const socket = this.deps.createSocket(`ws://127.0.0.1:${port}/ext`);
    this.socket = socket;
    this.authed = false;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'auth', token: this.token }));
    };
    socket.onmessage = (e) => this.onServerMessage(e.data);
    socket.onerror = () => undefined; // onclose follows and handles recovery
    socket.onclose = (e) => {
      const wasThis = this.socket === socket;
      if (!wasThis) return;
      this.teardown(false);
      if (e.code === 4401) {
        void this.unpair(); // server no longer accepts our token
        return;
      }
      this.scheduleReconnect();
    };
  }

  private onServerMessage(data: unknown): void {
    let json: unknown;
    try {
      json = JSON.parse(String(data));
    } catch {
      return;
    }
    const msg = ExtServerMessageSchema.safeParse(json);
    if (!msg.success) return;
    if (msg.data.type === 'authed') {
      this.authed = true;
      this.backoff = BACKOFF_START_MS;
      this.startTimers();
      this.sendHeartbeat();
    } else if (msg.data.type === 'command') {
      // A tab that is already gone makes close/focus reject; that must not surface as an
      // unhandled rejection inside the service worker.
      void this.handleCommand(msg.data as unknown as ExtCommand).catch((err: unknown) =>
        console.warn('[StumpCast] command failed', err),
      );
    }
  }

  private startTimers(): void {
    this.stopTimers();
    this.heartbeatTimer = this.deps.timers.setInterval(() => this.sendHeartbeat(), HEARTBEAT_MS);
    this.pingTimer = this.deps.timers.setInterval(() => {
      if (this.socket?.readyState === OPEN) this.socket.send(JSON.stringify({ type: 'ping' }));
    }, PING_MS);
  }

  private stopTimers(): void {
    if (this.heartbeatTimer !== null) this.deps.timers.clearInterval(this.heartbeatTimer);
    if (this.pingTimer !== null) this.deps.timers.clearInterval(this.pingTimer);
    this.heartbeatTimer = this.pingTimer = null;
  }

  private sendHeartbeat(): void {
    if (this.killed) return;
    void this.send({
      type: 'heartbeat',
      extensionVersion: this.deps.version,
      selectorsVersion: this.activeSelectorsVersion ?? this.deps.selectorsVersion(),
      tabs: this.tabs,
    });
  }

  async reloadSelectors(): Promise<boolean> {
    const port = await this.discoverPort();
    if (port === null) return false;
    for (const host of ['127.0.0.1', 'localhost']) {
      try {
        const res = await this.deps.fetch(`http://${host}:${port}/api/ext/selectors`);
        if (!res.ok) continue;
        const json = await res.json();
        const verified = await verifySignedSelectorBundle(json, DEFAULT_SELECTORS_PUBLIC_KEY);
        if (!verified.valid || !verified.bundle) {
          return false;
        }
        // A signature only proves who wrote the bundle, not that its scraper config is usable.
        for (const [site, config] of Object.entries(verified.bundle.selectors)) {
          if (site !== 'cricbuzz' && site !== 'crex') return false;
          try {
            SelectorConfigSchema.parse(config);
          } catch {
            return false;
          }
        }
        this.activeSelectorsVersion = verified.bundle.version;
        await this.deps.storage.set('customSelectors', verified.bundle);
        this.deps.onReloadSelectors?.();
        return true;
      } catch {
        // try next host
      }
    }
    return false;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null || this.killed) return;
    const delay = this.backoff;
    this.backoff = Math.min(this.backoff * 2, BACKOFF_MAX_MS);
    // The server may have moved to another port; let the next attempt sweep for real.
    this.lastDiscoveryAt = null;
    this.peerProbeAt = null;
    this.reconnectTimer = this.deps.timers.setTimeout(() => {
      this.reconnectTimer = null;
      if (this.token) {
        void this.connect();
      } else {
        void this.autoPair();
      }
    }, delay);
  }

  private teardown(closeSocket: boolean): void {
    this.stopTimers();
    if (this.reconnectTimer !== null && closeSocket) {
      this.deps.timers.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const s = this.socket;
    this.socket = null;
    this.authed = false;
    if (s && closeSocket) {
      s.onclose = null;
      s.close();
    }
  }

  /** Keep-alive hook (chrome.alarms): reconnect if the socket silently died. */
  async ensureConnected(): Promise<void> {
    await this.init();
    if (this.killed) return;
    if (this.token && (!this.socket || this.socket.readyState > OPEN)) {
      this.teardown(false);
      await this.connect();
    } else if (!this.token) {
      await this.autoPair();
    }
  }

  // ---- commands ---------------------------------------------------------------------------

  private async handleCommand(cmd: ExtCommand): Promise<void> {
    switch (cmd.command) {
      case 'openMatch': {
        if (this.killed || !isAllowedMatchUrl(cmd.url)) return;
        await this.deps.tabs.open(cmd.url);
        return;
      }
      case 'focusMatch': {
        const t = this.tracked.get(cmd.matchId);
        if (t?.tabId != null) await this.deps.tabs.focus(t.tabId);
        return;
      }
      case 'closeMatch': {
        const t = this.tracked.get(cmd.matchId);
        try {
          if (t?.tabId != null) await this.deps.tabs.close(t.tabId);
        } finally {
          // Even if the tab was already closed, stop tracking it — and write that down, or a
          // service-worker restart brings the ghost tab back into the admin's match list.
          this.tracked.delete(cmd.matchId);
          this.persistTracked();
        }
        return;
      }
      case 'reloadSelectors':
        await this.reloadSelectors();
        return;
      case 'killSwitch':
        this.killed = cmd.enabled;
        await this.deps.storage.set('killed', cmd.enabled);
        return;
    }
  }
}

/** https only, and only the supported source sites; never an arbitrary URL from the server. */
export const isAllowedMatchUrl = (raw: string): boolean => {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && ALLOWED_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
};
