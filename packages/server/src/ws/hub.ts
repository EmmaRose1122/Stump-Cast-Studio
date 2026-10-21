import type { WebSocket } from 'ws';
import {
  ClientMessageSchema,
  ServerMessageSchema,
  type Channel,
  type ServerMessage,
} from '@stumpcast/shared';

/**
 * Who receives a broadcast. `live` sockets (OBS overlays) get the sync-delayed feed; `preview`
 * sockets (the admin's mini preview, connected with `?preview=1`) get data immediately.
 */
export type Audience = 'all' | 'live' | 'preview';

interface Client {
  channels: Set<Channel>;
  preview: boolean;
}

/** Tracks WebSocket clients and the channels each one subscribed to. */
export class WsHub {
  private readonly clients = new Map<WebSocket, Client>();

  get size(): number {
    return this.clients.size;
  }

  /** Who is actually on air: an OBS source, not the operator's own preview. */
  get liveSize(): number {
    let n = 0;
    for (const client of this.clients.values()) if (!client.preview) n++;
    return n;
  }

  add(socket: WebSocket, opts: { preview?: boolean } = {}): void {
    this.clients.set(socket, { channels: new Set(), preview: opts.preview ?? false });
    socket.on('message', (raw) => this.onMessage(socket, raw.toString()));
    socket.on('close', () => this.clients.delete(socket));
    socket.on('error', () => this.clients.delete(socket));
  }

  /** Validate and send a channel message to every matching subscriber. Returns delivery count. */
  broadcast(channel: Channel, event: string, payload: unknown, audience: Audience = 'all'): number {
    const msg = ServerMessageSchema.parse({
      type: 'message',
      channel,
      event,
      payload,
      ts: Date.now(),
    });
    const data = JSON.stringify(msg);
    let sent = 0;
    const entries = [...this.clients.entries()];
    for (const [socket, client] of entries) {
      if (audience === 'live' && client.preview) continue;
      if (audience === 'preview' && !client.preview) continue;
      if (client.channels.has(channel) && socket.readyState === socket.OPEN) {
        socket.send(data);
        sent++;
      }
    }
    return sent;
  }

  closeAll(): void {
    for (const socket of this.clients.keys()) socket.close(1001, 'server shutting down');
    this.clients.clear();
  }

  private send(socket: WebSocket, msg: ServerMessage): void {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg));
  }

  private onMessage(socket: WebSocket, raw: string): void {
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return this.send(socket, { type: 'error', message: 'Invalid JSON' });
    }
    const parsed = ClientMessageSchema.safeParse(json);
    if (!parsed.success) return this.send(socket, { type: 'error', message: 'Invalid message' });

    const client = this.clients.get(socket);
    if (!client) return;
    const msg = parsed.data;
    if (msg.type === 'ping') return this.send(socket, { type: 'pong' });
    for (const c of msg.channels) {
      if (msg.type === 'subscribe') client.channels.add(c);
      else client.channels.delete(c);
    }
    this.send(socket, { type: 'ack', channels: [...client.channels] });
  }
}
