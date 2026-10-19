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

  constructor(private readonly deps: ConnectorDeps) {}

  // ---- lifecycle --------------------------------------------------------------------------

  /** Safe to call on every service-worker wake-up. */
  async init(): Promise<void> {
    if (!this.started) {
      this.started = true;
      this.token = ((await this.deps.storage.get('token')) as string | null) ?? null;
      this.port = ((await this.deps.storage.get('port')) as number | null) ?? null;
      this.killed = ((await this.deps.storage.get('killed')) as boolean | null) ?? false;
      const custom = (await this.deps.storage.get('customSelectors')) as SelectorBundle | undefined;
      if (custom?.version) this.activeSelectorsVersion = custom.version;
    }
    if (this.token && !this.socket) await this.connect();
    else if (!this.token && !this.killed) await this.autoPair();
  }

  get paired(): boolean {
    return this.token !== null;
  }

  get boundPort(): number | null {
    return this.port;
  }

  async autoPair(): Promise<boolean> {
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

  async onContentMessage(msg: ContentMessage, tabId: number | null): Promise<void> {
    if (this.killed) return;
    if (!this.token) {
      await this.autoPair();
    }
    const now = this.deps.now();
    if (msg.type === 'score-update') {
      const u = msg.update;
      this.tracked.set(u.matchId, {
        matchId: u.matchId,
        url: u.url,
        lastUpdateAt: now,
        confidence: u.confidence,
        tabId,
      });
      await this.send({ type: 'update', update: u });
    } else if (msg.type === 'tick') {
      this.tracked.set(msg.matchId, {
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
      this.tracked.set(matchId, {
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
    for (const [id, t] of this.tracked) if (t.tabId === tabId) this.tracked.delete(id);
  }

  get tabs(): TabInfo[] {
    return [...this.tracked.values()].map(({ tabId: _tabId, ...t }) => t);
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
    if (this.socket && this.socket.readyState === OPEN && this.authed) {
      this.socket.send(JSON.stringify(msg));
    } else {
      await this.postIngest(msg); // WebSocket unavailable: fall back to HTTP
    }

    // Replicate to other active local Studio instances (e.g. if both 4000 and 4002 are running)
    const activePorts = [4000, 4002].filter((p) => p !== this.port);
    for (const p of activePorts) {
      try {
        const token = await this.ensurePeerToken(p);
        if (token) {
          void this.deps.fetch(`http://127.0.0.1:${p}/api/ext/ingest`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(msg),
          }).catch(() => undefined);
        }
      } catch {
        /* peer unreachable */
      }
    }
  }

  private async postIngest(msg: ExtClientMessage): Promise<void> {
    if (!this.token) return;
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
      if (res.status === 401) await this.unpair(); // token revoked server-side
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
      void this.handleCommand(msg.data as unknown as ExtCommand);
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
        if (t?.tabId != null) await this.deps.tabs.close(t.tabId);
        this.tracked.delete(cmd.matchId);
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
