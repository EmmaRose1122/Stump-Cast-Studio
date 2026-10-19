import { ServerMessageSchema, type Channel, type ServerMessage } from '@stumpcast/shared';

export interface SocketLike {
  readyState: number;
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((e: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
}

export interface ClientTimers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(id: unknown): void;
}

export interface WsClientOptions {
  url: string;
  channels: Channel[];
  onMessage: (msg: ServerMessage) => void;
  onStatus?: (status: 'connecting' | 'open' | 'closed') => void;
  /** Called after every (re)connect; used to re-fetch a full snapshot over HTTP. */
  onOpen?: () => void;
  createSocket?: (url: string) => SocketLike;
  timers?: ClientTimers;
  random?: () => number;
  now?: () => number;
}

export const BACKOFF_BASE_MS = 500;
export const BACKOFF_MAX_MS = 10_000;
const PING_MS = 15_000;
const SILENCE_LIMIT_MS = 40_000;

/** Delay before reconnect attempt `n` (0-based): exponential, capped, +-25% jitter. */
export const backoffDelay = (attempt: number, random: () => number = Math.random): number => {
  const base = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** attempt);
  return Math.round(base * (0.75 + random() * 0.5));
};

/**
 * WebSocket client that never gives up. Listeners keep the last known state, so a dropped
 * connection changes nothing on screen; the stage only updates when new data arrives.
 */
export class OverlayWsClient {
  private socket: SocketLike | null = null;
  private attempt = 0;
  private reconnectTimer: unknown = null;
  private pingTimer: unknown = null;
  private lastMessageAt = 0;
  private stopped = false;

  private readonly timers: ClientTimers;
  private readonly create: (url: string) => SocketLike;
  private readonly random: () => number;
  private readonly now: () => number;

  constructor(private readonly opts: WsClientOptions) {
    this.timers = opts.timers ?? {
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
      setInterval: (fn, ms) => setInterval(fn, ms),
      clearInterval: (id) => clearInterval(id as ReturnType<typeof setInterval>),
    };
    this.create = opts.createSocket ?? ((url) => new WebSocket(url) as unknown as SocketLike);
    this.random = opts.random ?? Math.random;
    this.now = opts.now ?? Date.now;
  }

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer !== null) this.timers.clearTimeout(this.reconnectTimer);
    if (this.pingTimer !== null) this.timers.clearInterval(this.pingTimer);
    this.reconnectTimer = this.pingTimer = null;
    this.socket?.close();
    this.socket = null;
  }

  private connect(): void {
    this.opts.onStatus?.('connecting');
    let socket: SocketLike;
    try {
      socket = this.create(this.opts.url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      this.attempt = 0;
      this.lastMessageAt = this.now();
      socket.send(JSON.stringify({ type: 'subscribe', channels: this.opts.channels }));
      this.opts.onStatus?.('open');
      this.opts.onOpen?.();
      this.startPing();
    };
    socket.onmessage = (e) => {
      this.lastMessageAt = this.now();
      try {
        const parsed = ServerMessageSchema.safeParse(JSON.parse(String(e.data)));
        if (parsed.success) this.opts.onMessage(parsed.data);
      } catch {
        /* ignore malformed frames */
      }
    };
    socket.onerror = () => undefined; // onclose always follows
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      if (this.pingTimer !== null) this.timers.clearInterval(this.pingTimer);
      this.pingTimer = null;
      this.opts.onStatus?.('closed');
      if (!this.stopped) this.scheduleReconnect();
    };
  }

  private startPing(): void {
    if (this.pingTimer !== null) this.timers.clearInterval(this.pingTimer);
    this.pingTimer = this.timers.setInterval(() => {
      const s = this.socket;
      if (!s) return;
      if (this.now() - this.lastMessageAt > SILENCE_LIMIT_MS) {
        s.close(); // dead connection: onclose triggers the reconnect
        return;
      }
      s.send(JSON.stringify({ type: 'ping' }));
    }, PING_MS);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;
    const delay = backoffDelay(this.attempt++, this.random);
    this.reconnectTimer = this.timers.setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.stopped) this.connect();
    }, delay);
  }
}
