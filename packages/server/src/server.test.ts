import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { ServerMessageSchema, type ServerMessage } from '@stumpcast/shared';
import { buildApp, type StumpCastApp } from './app';
import { loadConfig } from './config';

let dir: string;
const apps: StumpCastApp[] = [];

const makeApp = async (overrides = {}) => {
  const app = await buildApp(
    loadConfig({}, { dataDir: dir, port: 0, overlayDir: '', adminDir: '', ...overrides }),
  );
  apps.push(app);
  return app;
};

const connect = (port: number) =>
  new Promise<{ ws: WebSocket; inbox: ServerMessage[] }>((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const inbox: ServerMessage[] = [];
    ws.on('message', (d) => inbox.push(ServerMessageSchema.parse(JSON.parse(d.toString()))));
    ws.on('open', () => resolve({ ws, inbox }));
    ws.on('error', reject);
  });

const waitFor = async (cond: () => boolean, ms = 2000) => {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 10));
  }
};

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stumpcast-test-'));
});

afterEach(async () => {
  while (apps.length) await apps.pop()!.stop();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('server', () => {
  it('GET /api/health returns JSON with the bound port', async () => {
    const app = await makeApp();
    const port = await app.start();
    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, port });
  });

  it('delivers a broadcast to two subscribed WS clients only', async () => {
    const app = await makeApp();
    const port = await app.start();
    const a = await connect(port);
    const b = await connect(port);
    const c = await connect(port);
    a.ws.send(JSON.stringify({ type: 'subscribe', channels: ['state'] }));
    b.ws.send(JSON.stringify({ type: 'subscribe', channels: ['state', 'events'] }));
    c.ws.send(JSON.stringify({ type: 'subscribe', channels: ['events'] }));
    await waitFor(() => [a, b, c].every((x) => x.inbox.some((m) => m.type === 'ack')));

    expect(app.hub.broadcast('state', 'test', { n: 1 })).toBe(2);
    await waitFor(() => a.inbox.length > 1 && b.inbox.length > 1);
    expect(a.inbox.at(-1)).toMatchObject({ type: 'message', channel: 'state', payload: { n: 1 } });
    expect(c.inbox).toHaveLength(1);
    [a, b, c].forEach((x) => x.ws.close());
  });

  it('rejects malformed WS messages without dropping the socket', async () => {
    const app = await makeApp();
    const { ws, inbox } = await connect(await app.start());
    ws.send('not json');
    ws.send(JSON.stringify({ type: 'subscribe', channels: ['nope'] }));
    await waitFor(() => inbox.length === 2);
    expect(inbox.every((m) => m.type === 'error')).toBe(true);
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  it('persists settings across restart and validates input', async () => {
    const first = await makeApp();
    const p1 = await first.start();
    const put = await fetch(`http://127.0.0.1:${p1}/api/settings`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ syncDelaySec: 12, layout: 'ticker' }),
    });
    expect(put.status).toBe(200);
    const bad = await fetch(`http://127.0.0.1:${p1}/api/settings`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ syncDelaySec: 999 }),
    });
    expect(bad.status).toBe(400);
    await first.stop();
    apps.pop();

    const second = await makeApp();
    const p2 = await second.start();
    const got = await (await fetch(`http://127.0.0.1:${p2}/api/settings`)).json();
    expect(got).toMatchObject({ syncDelaySec: 12, layout: 'ticker' });
  });

  it('falls back to the next port when the preferred one is busy', async () => {
    const blocker = net.createServer();
    await new Promise<void>((r) => blocker.listen(0, '127.0.0.1', r));
    const busy = (blocker.address() as net.AddressInfo).port;
    const app = await makeApp({ port: busy });
    const port = await app.start();
    expect(port).not.toBe(busy);
    expect(port).toBeGreaterThan(busy);
    const body = (await (await fetch(`http://127.0.0.1:${port}/api/health`)).json()) as {
      port: number;
    };
    expect(body.port).toBe(port);
    await new Promise((r) => blocker.close(r));
  });
});
