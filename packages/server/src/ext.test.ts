import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { RawUpdateSchema, type RawUpdate } from '@stumpcast/shared';
import { buildApp, type StumpCastApp } from './app';
import { loadConfig } from './config';
import { ExtensionProvider, HEARTBEAT_TIMEOUT_MS, STALE_AFTER_MS } from './ext/provider';
import { onAirHeroUpdateToRaw } from './ext/routes';

let dir: string;
const apps: StumpCastApp[] = [];

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stumpcast-ext-'));
});
afterEach(async () => {
  while (apps.length) await apps.pop()!.stop();
  fs.rmSync(dir, { recursive: true, force: true });
});

const update = (matchId: string, runs = 10): RawUpdate =>
  RawUpdateSchema.parse({
    source: 'cricbuzz',
    matchId,
    url: `https://www.example.invalid/${matchId}`,
    capturedAt: 1,
    confidence: 1,
    fields: {
      title: `Match ${matchId}`,
      innings: [{ team: 'A', runs, wkts: 0, overs: 1, balls: 0 }],
    },
  });

const boot = async () => {
  const app = await buildApp(
    loadConfig({}, { dataDir: dir, port: 0, overlayDir: '', adminDir: '' }),
  );
  apps.push(app);
  const port = await app.start();
  const base = `http://127.0.0.1:${port}`;
  const post = (p: string, body: unknown, token?: string) =>
    fetch(base + p, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  const acceptTerms = () => post('/api/ext/terms/accept', {});
  const pair = async () => {
    await acceptTerms();
    const { code } = (await (await post('/api/ext/pair-code', {})).json()) as { code: string };
    const res = await post('/api/ext/pair', { code });
    return { res, code, token: ((await res.json()) as { token?: string }).token };
  };
  return { app, port, post, pair };
};

type Msg = { type: string; command?: string };

const openSocket = (port: number) =>
  new Promise<{ ws: WebSocket; inbox: Msg[] }>((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ext`);
    const inbox: Msg[] = [];
    ws.on('message', (d) => inbox.push(JSON.parse(d.toString()) as Msg));
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

describe('extension pairing and ingest', () => {
  it('requires and persists source-site notice acceptance before issuing a pairing code', async () => {
    const { post, port } = await boot();
    expect((await post('/api/ext/pair-code', {})).status).toBe(428);
    const accepted = (await (await post('/api/ext/terms/accept', {})).json()) as {
      acceptedAt: number;
    };
    expect(accepted.acceptedAt).toBeGreaterThan(0);
    expect(await (await fetch(`http://127.0.0.1:${port}/api/settings`)).json()).toMatchObject({
      sourceTermsAcceptedAt: accepted.acceptedAt,
    });
    expect((await post('/api/ext/pair-code', {})).status).toBe(200);
  });

  it('pairs with a code once, rejecting reuse and malformed codes', async () => {
    const { pair, post } = await boot();
    const first = await pair();
    expect(first.res.status).toBe(200);
    expect(first.token).toBeTruthy();
    expect((await post('/api/ext/pair', { code: first.code })).status).toBe(401);
    expect((await post('/api/ext/pair', { code: 'abc' })).status).toBe(400);
  });

  it('invalidates the code after 5 wrong attempts', async () => {
    const { post } = await boot();
    await post('/api/ext/terms/accept', {});
    const { code } = (await (await post('/api/ext/pair-code', {})).json()) as { code: string };
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      expect((await post('/api/ext/pair', { code: wrong })).status).toBe(401);
    }
    expect((await post('/api/ext/pair', { code })).status).toBe(401);
  });

  it('rejects ingest with a wrong or missing token, accepts a valid one', async () => {
    const { app, pair, post } = await boot();
    const { token } = await pair();
    const msg = { type: 'update', update: update('m1') };
    expect((await post('/api/ext/ingest', msg)).status).toBe(401);
    expect((await post('/api/ext/ingest', msg, 'not-the-token')).status).toBe(401);
    expect((await post('/api/ext/ingest', msg, token)).status).toBe(200);
    expect(await app.extension.snapshot('m1')).toMatchObject({ matchId: 'm1' });
  });

  it('lists two simultaneous matches', async () => {
    const { app, pair, post, port } = await boot();
    const { token } = await pair();
    await post('/api/ext/ingest', { type: 'update', update: update('m1') }, token);
    await post('/api/ext/ingest', { type: 'update', update: update('m2') }, token);
    const list = (await (await fetch(`http://127.0.0.1:${port}/api/ext/matches`)).json()) as {
      matchId: string;
    }[];
    expect(list.map((m) => m.matchId).sort()).toEqual(['m1', 'm2']);
    expect((await app.extension.listMatches()).length).toBe(2);
  });

  it('keeps tokens valid across a server restart', async () => {
    const first = await boot();
    const { token } = await first.pair();
    await first.app.stop();
    apps.pop();
    const second = await boot();
    // A valid token is accepted (200); an unknown one is not.
    const res = await second.post('/api/ext/ingest', { type: 'ping' }, token);
    expect(res.status).toBe(200);
    expect((await second.post('/api/ext/ingest', { type: 'ping' }, 'other')).status).toBe(401);
  });
});

describe('extension websocket', () => {
  it('closes with 4401 when the first message is not a valid auth', async () => {
    const { port } = await boot();
    const { ws } = await openSocket(port);
    const closed = new Promise<number>((r) => ws.on('close', (code) => r(code)));
    ws.send(JSON.stringify({ type: 'auth', token: 'bad' }));
    expect(await closed).toBe(4401);
  });

  it('accepts updates and delivers commands after auth', async () => {
    const { app, port, pair, post } = await boot();
    const { token } = await pair();
    const { ws, inbox } = await openSocket(port);
    ws.send(JSON.stringify({ type: 'auth', token }));
    await waitFor(() => inbox.some((m) => m.type === 'authed'));

    ws.send(JSON.stringify({ type: 'update', update: update('m9', 55) }));
    await waitFor(() => app.extension.status().matches.length === 1);

    ws.send(JSON.stringify({ type: 'ping' }));
    await waitFor(() => inbox.some((m) => m.type === 'pong'));

    const res = await post('/api/ext/command', {
      command: 'openMatch',
      url: 'https://www.example.invalid/m1',
    });
    expect(((await res.json()) as { delivered: boolean }).delivered).toBe(true);
    await waitFor(() => inbox.some((m) => m.type === 'command' && m.command === 'openMatch'));
    ws.close();
  });

  it('a stale socket dying after a reconnect leaves the command channel alive', async () => {
    const { port, pair, post } = await boot();
    const { token } = await pair();
    const authed = async () => {
      const s = await openSocket(port);
      s.ws.send(JSON.stringify({ type: 'auth', token }));
      await waitFor(() => s.inbox.some((m) => m.type === 'authed'));
      return s;
    };
    const older = await authed();
    const newer = await authed(); // the reconnect takes over the channel

    // The old socket's close arrives late. Its handler used to clear the sender regardless of
    // who owned it, silently killing commands for the extension that is actually connected.
    older.ws.close();
    await new Promise((r) => setTimeout(r, 100));

    let delivered = false;
    for (let i = 0; i < 20 && !delivered; i++) {
      const res = await post('/api/ext/command', { command: 'reloadSelectors' });
      delivered = ((await res.json()) as { delivered: boolean }).delivered;
      if (!delivered) await new Promise((r) => setTimeout(r, 25));
    }
    expect(delivered).toBe(true);
    expect(newer.inbox.some((m) => m.type === 'command')).toBe(true);
    expect(older.inbox.some((m) => m.type === 'command')).toBe(false);
    newer.ws.close();
  });
});

describe('OnAirHero /ingest protocol', () => {
  it('keeps the ball history whatever the scraper calls the list', () => {
    const base = {
      matchId: '4242',
      innings: [{ team: 'PAK', runs: 120, wickets: 2, overs: '12.3' }],
      batters: [{ name: 'Ali Raza', runs: 40, balls: 30, fours: 4, isStriker: true }],
      bowler: { name: 'Zain Q', overs: '4.2', runs: 30, wickets: 1 },
    };
    const mixed = ['0', '0', '1', '4', '0'];
    // 12.3 means three balls into the over, so the current over is the tail of a mixed list.
    const expected = ['1', '4', '0'];

    for (const key of ['recentBalls', 'lastBalls']) {
      const raw = onAirHeroUpdateToRaw({ ...base, [key]: mixed });
      expect(raw, key).not.toBeNull();
      expect(raw!.fields.lastBalls, key).toEqual(mixed);
      expect(raw!.fields.thisOver, key).toEqual(expected);
    }

    // A list a scraper names as the current over is taken at its word, never re-sliced.
    const named = onAirHeroUpdateToRaw({ ...base, thisOver: mixed });
    expect(named!.fields.thisOver).toEqual(mixed);
  });

  it('reads a payload that names the current over and the last six separately', () => {
    const raw = onAirHeroUpdateToRaw({
      matchId: '4343',
      innings: [{ team: 'IND', runs: 40, wickets: 1, overs: '4.2' }],
      batters: [{ name: 'Surya', runs: 20, balls: 15, fours: 3, isStriker: true }],
      thisOver: ['4', '1'],
      lastBalls: ['0', '0', '1', '4', '1', '2'],
    });
    expect(raw).not.toBeNull();
    expect(raw!.fields.thisOver).toEqual(['4', '1']);
    expect(raw!.fields.lastBalls).toEqual(['0', '0', '1', '4', '1', '2']);
  });

  it('connects to /ingest and handles hello, match_meta and match_update', async () => {
    const { app, port } = await boot();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ingest`);
    const inbox: any[] = [];
    ws.on('message', (d) => inbox.push(JSON.parse(d.toString())));
    await new Promise((resolve) => ws.on('open', resolve));

    ws.send(JSON.stringify({ type: 'hello', payload: { version: '1.2.0' } }));
    await waitFor(() => inbox.some((m) => m.type === 'hello_ack'));
    expect(inbox.some((m) => m.type === 'request_meta')).toBe(true);

    ws.send(
      JSON.stringify({
        type: 'match_meta',
        payload: { matchId: '12345', title: 'Oman vs Nepal', url: 'https://cricbuzz.com/12345' },
      }),
    );
    await waitFor(() => inbox.some((m) => m.type === 'meta_ack'));
    expect(inbox.some((m) => m.type === 'on_air')).toBe(true);

    ws.send(
      JSON.stringify({
        type: 'match_update',
        payload: {
          matchId: '12345',
          title: 'Oman vs Nepal, 1st Match',
          innings: [{ teamCode: 'NEP', runs: 280, wickets: 10, overs: 50 }],
          batting: { teamCode: 'OMAN', runs: 30, wickets: 0, overs: 8.4 },
          batters: [
            { name: 'Hasnain Ul Wahab *', runs: 13, balls: 23, fours: 2, sixes: 0, isStriker: true },
          ],
          bowler: { name: 'Lalit Rajbanshi *', overs: 0.4, maidens: 0, runs: 3, wickets: 0 },
          recentBalls: ['2', '0', '0', '1'],
        },
      }),
    );

    await waitFor(() => app.extension.status().matches.some((m) => m.matchId === '12345'));
    expect(app.extension.status().health).toBe('connected');
    ws.close();
  });

  it('accepts zero-friction HTTP POST /ingest updates', async () => {
    const { app, port } = await boot();
    const res = await fetch(`http://127.0.0.1:${port}/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        matchId: '99999',
        title: 'India vs Pakistan',
        innings: [{ teamCode: 'IND', runs: 180, wickets: 4, overs: 20 }],
      }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; matchId: string };
    expect(data.ok).toBe(true);
    expect(data.matchId).toBe('99999');
    expect(app.extension.status().matches.some((m) => m.matchId === '99999')).toBe(true);
  });
});

describe('ExtensionProvider health', () => {
  const hb = (tabs: { matchId: string; lastUpdateAt: number }[]) => ({
    type: 'heartbeat' as const,
    extensionVersion: '0.0.1',
    selectorsVersion: 1,
    tabs: tabs.map((t) => ({
      matchId: t.matchId,
      url: 'https://www.example.invalid/x',
      lastUpdateAt: t.lastUpdateAt,
      confidence: 1,
    })),
  });

  it('is down without heartbeats, connected with fresh ones, stale when a tab goes quiet', () => {
    let t = 1_000_000;
    const p = new ExtensionProvider(() => t);
    expect(p.health()).toBe('down');

    p.recordHeartbeat(hb([{ matchId: 'm1', lastUpdateAt: t }]));
    expect(p.health()).toBe('connected');

    t += STALE_AFTER_MS + 1;
    p.recordHeartbeat(hb([{ matchId: 'm1', lastUpdateAt: t - STALE_AFTER_MS - 1 }]));
    expect(p.health()).toBe('stale');
    expect(p.matchHealth('m1')).toBe('stale');

    t += HEARTBEAT_TIMEOUT_MS + 1;
    expect(p.health()).toBe('down');
  });

  it('a fresh update clears stale for that match', () => {
    const t = 5_000_000;
    const p = new ExtensionProvider(() => t);
    p.recordHeartbeat(hb([{ matchId: 'm1', lastUpdateAt: t - 60_000 }]));
    expect(p.health()).toBe('stale');
    p.ingest(update('m1'));
    expect(p.matchHealth('m1')).toBe('connected');
  });

  it('notifies subscribers until they unsubscribe', () => {
    const p = new ExtensionProvider();
    const seen: unknown[] = [];
    const off = p.subscribe('m1', (r) => seen.push(r));
    p.ingest(update('m1'));
    off();
    p.ingest(update('m1', 20));
    expect(seen).toHaveLength(1);
  });
});

describe('engine wiring', () => {
  it('turns an ingested update into a MatchState on /api/state and the state channel', async () => {
    const { app, port, pair, post } = await boot();
    const { token } = await pair();
    const got: unknown[] = [];
    const sub = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await new Promise((r) => sub.on('open', r));
    sub.on('message', (d) => got.push(JSON.parse(d.toString())));
    sub.send(JSON.stringify({ type: 'subscribe', channels: ['state'] }));
    await waitFor(() => got.length > 0);

    await post('/api/ext/ingest', { type: 'update', update: update('m1', 42) }, token);
    await waitFor(() => got.length > 1);
    expect(got.at(-1)).toMatchObject({
      type: 'message',
      channel: 'state',
      payload: { id: 'm1', score: { runs: 42 } },
    });
    const state = await (await fetch(`http://127.0.0.1:${port}/api/state/m1`)).json();
    expect(state).toMatchObject({ id: 'm1', score: { runs: 42 } });
    expect((await fetch(`http://127.0.0.1:${port}/api/state/nope`)).status).toBe(404);
    expect(app.engine.allStates()).toHaveLength(1);
    sub.close();
  });
});

describe('event wiring', () => {
  it('publishes and stores a FOUR once, and skips events after a reconnect snapshot', async () => {
    const { app, port, pair, post } = await boot();
    const { token } = await pair();
    const mk = (runs: number, balls: number, last: string[]): RawUpdate =>
      RawUpdateSchema.parse({
        source: 'cricbuzz',
        matchId: 'm1',
        url: 'https://www.example.invalid/m1',
        capturedAt: 1,
        confidence: 1,
        fields: {
          title: 'A v B T20',
          innings: [{ team: 'A', runs, wkts: 0, overs: 2, balls }],
          lastBalls: last,
          thisOver: last,
        },
      });
    const send = (u: RawUpdate) => post('/api/ext/ingest', { type: 'update', update: u }, token);

    await send(mk(10, 1, ['1']));
    await send(mk(14, 2, ['1', '4']));
    await send(mk(14, 2, ['1', '4'])); // duplicate delivery
    let events = (await (await fetch(`http://127.0.0.1:${port}/api/events`)).json()) as {
      type: string;
    }[];
    expect(events.map((e) => e.type)).toEqual(['FOUR']);

    // Reconnect: next state is a baseline even though it contains a six.
    const { ws, inbox } = await openSocket(port);
    ws.send(JSON.stringify({ type: 'auth', token }));
    await waitFor(() => inbox.some((m) => m.type === 'authed'));
    await send(mk(20, 3, ['1', '4', '6']));
    events = (await (await fetch(`http://127.0.0.1:${port}/api/events`)).json()) as {
      type: string;
    }[];
    expect(events.map((e) => e.type)).toEqual(['FOUR']);
    expect(app.engine.getState('m1')?.score.runs).toBe(20);
    ws.close();
  });

  it('writes one commentary line per event, not one per audience', async () => {
    const { port, pair, post } = await boot();
    const { token } = await pair();
    const base = `http://127.0.0.1:${port}`;
    const mk = (runs: number, balls: number, last: string[]): RawUpdate =>
      RawUpdateSchema.parse({
        source: 'cricbuzz',
        matchId: 'm1',
        url: 'https://www.example.invalid/m1',
        capturedAt: 1,
        confidence: 1,
        fields: {
          title: 'A v B T20',
          innings: [{ team: 'A', runs, wkts: 0, overs: 2, balls }],
          lastBalls: last,
          thisOver: last,
        },
      });

    await post('/api/ext/ingest', { type: 'update', update: mk(10, 1, ['1']) }, token);
    await post('/api/ext/ingest', { type: 'update', update: mk(14, 2, ['1', '4']) }, token);

    const status = (await (await fetch(`${base}/api/commentary/status`)).json()) as {
      history: { eventType?: string }[];
    };
    expect(status.history.filter((h) => h.eventType === 'FOUR')).toHaveLength(1);
  });
});

describe('sync delay and watchdog over HTTP/WS', () => {
  const mk = (runs: number, balls: number): RawUpdate =>
    RawUpdateSchema.parse({
      source: 'cricbuzz',
      matchId: 'm1',
      url: 'https://www.example.invalid/m1',
      capturedAt: 1,
      confidence: 1,
      fields: { title: 'A v B T20', innings: [{ team: 'A', runs, wkts: 0, overs: 3, balls }] },
    });

  it('preview sockets get data at once; live sockets and /api/state wait for the delay', async () => {
    const { app, port, pair, post } = await boot();
    const { token } = await pair();
    const base = `http://127.0.0.1:${port}`;
    const put = await fetch(`${base}/api/settings/sync-delay`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ syncDelaySec: 1 }),
    });
    expect(((await put.json()) as { syncDelaySec: number }).syncDelaySec).toBe(1);

    const open = (q: string) =>
      new Promise<{ ws: WebSocket; got: unknown[] }>((resolve) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/ws${q}`);
        const got: unknown[] = [];
        ws.on('message', (d) => got.push(JSON.parse(d.toString())));
        ws.on('open', () => {
          ws.send(JSON.stringify({ type: 'subscribe', channels: ['state'] }));
          resolve({ ws, got });
        });
      });
    const live = await open('');
    const preview = await open('?preview=1');
    await waitFor(() => live.got.length > 0 && preview.got.length > 0); // acks

    await post('/api/ext/ingest', { type: 'update', update: mk(10, 1) }, token);
    await waitFor(() => preview.got.length > 1, 500);
    expect(live.got).toHaveLength(1); // only the ack so far
    expect(await (await fetch(`${base}/api/state`)).json()).toEqual([]);
    expect(((await (await fetch(`${base}/api/state?preview=1`)).json()) as unknown[]).length).toBe(
      1,
    );

    await waitFor(() => live.got.length > 1, 3000);
    expect(((await (await fetch(`${base}/api/state`)).json()) as unknown[]).length).toBe(1);
    expect(app.delay.delaySec).toBe(1);
    live.ws.close();
    preview.ws.close();
  });

  it('deleting matches discards what is still waiting on the broadcast delay', async () => {
    const { app, port, pair, post } = await boot();
    const { token } = await pair();
    const base = `http://127.0.0.1:${port}`;
    await fetch(`${base}/api/settings/sync-delay`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ syncDelaySec: 1 }),
    });

    await post('/api/ext/ingest', { type: 'update', update: mk(10, 1) }, token);
    expect(app.delay.size).toBe(1);

    await fetch(`${base}/api/matches`, { method: 'DELETE' });
    expect(app.delay.size).toBe(0);

    // The old queue entry used to fire here and bring the wiped match back on air.
    await new Promise((r) => setTimeout(r, 1400));
    expect(await (await fetch(`${base}/api/state`)).json()).toEqual([]);
    expect(await (await fetch(`${base}/api/events`)).json()).toEqual([]);
  });

  it('deleting one match keeps another match still in the delay queue', async () => {
    const { app, port, pair, post } = await boot();
    const { token } = await pair();
    const base = `http://127.0.0.1:${port}`;
    await fetch(`${base}/api/settings/sync-delay`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ syncDelaySec: 1 }),
    });

    const other = (id: string): RawUpdate =>
      RawUpdateSchema.parse({
        source: 'cricbuzz',
        matchId: id,
        url: `https://www.example.invalid/${id}`,
        capturedAt: 1,
        confidence: 1,
        fields: { title: `Match ${id}`, innings: [{ team: 'A', runs: 8, wkts: 0, overs: 1, balls: 0 }] },
      });
    await post('/api/ext/ingest', { type: 'update', update: mk(10, 1) }, token);
    await post('/api/ext/ingest', { type: 'update', update: other('m2') }, token);
    expect(app.delay.size).toBe(2);

    await fetch(`${base}/api/matches/m1`, { method: 'DELETE' });
    expect(app.delay.size).toBe(1);
    await new Promise((r) => setTimeout(r, 1400));
    const live = (await (await fetch(`${base}/api/state`)).json()) as { id: string }[];
    expect(live.map((s) => s.id)).toEqual(['m2']);
  });

  it('rejects an out-of-range delay', async () => {
    const { port } = await boot();
    const res = await fetch(`http://127.0.0.1:${port}/api/settings/sync-delay`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ syncDelaySec: 120 }),
    });
    expect(res.status).toBe(400);
  });

  it('exposes and mutes the alarm', async () => {
    const { port, post } = await boot();
    const base = `http://127.0.0.1:${port}`;
    const a = (await (await fetch(`${base}/api/alarm`)).json()) as {
      level: string;
      muted: boolean;
    };
    expect(a).toMatchObject({ level: 'ok', muted: false });
    const m = (await (await post('/api/alarm/mute', { minutes: 10 })).json()) as { muted: boolean };
    expect(m.muted).toBe(true);
    const u = (await (await fetch(`${base}/api/alarm/mute`, { method: 'DELETE' })).json()) as {
      muted: boolean;
    };
    expect(u.muted).toBe(false);
  });
});

describe('cards and director over HTTP', () => {
  it('POST /api/cards/:id/show broadcasts a card command and hide clears it', async () => {
    const { port, post } = await boot();
    const got: { channel?: string; payload?: { action?: string; cardId?: string } }[] = [];
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await new Promise((r) => ws.on('open', r));
    ws.on('message', (d) => got.push(JSON.parse(d.toString())));
    ws.send(JSON.stringify({ type: 'subscribe', channels: ['cards'] }));
    await waitFor(() => got.length > 0);

    const res = await post('/api/cards/manhattan/show', { durationSec: 0 });
    expect(res.status).toBe(200);
    await waitFor(() => got.some((m) => m.payload?.action === 'show'));
    expect(got.find((m) => m.payload?.action === 'show')!.payload).toMatchObject({
      cardId: 'manhattan',
      source: 'operator',
    });

    await post('/api/cards/hide', {});
    await waitFor(() => got.some((m) => m.payload?.action === 'hide'));
    ws.close();
  });

  it('rejects an invalid card id', async () => {
    const { post } = await boot();
    expect((await post('/api/cards/Not%20Valid!/show', {})).status).toBe(400);
  });

  it('exposes and updates the director, persisting the mode', async () => {
    const first = await boot();
    const base = `http://127.0.0.1:${first.port}`;
    const initial = (await (await fetch(`${base}/api/director`)).json()) as {
      config: { mode: string; rules: unknown[] };
    };
    expect(initial.config.mode).toBe('manual');
    expect(initial.config.rules.length).toBeGreaterThan(0); // sensible defaults

    const put = await fetch(`${base}/api/director`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'smart' }),
    });
    expect(((await put.json()) as { mode: string }).mode).toBe('smart');

    const bad = await fetch(`${base}/api/director`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'chaotic' }),
    });
    expect(bad.status).toBe(400);

    await first.app.stop();
    apps.pop();
    const second = await boot();
    const again = (await (await fetch(`http://127.0.0.1:${second.port}/api/director`)).json()) as {
      config: { mode: string };
    };
    expect(again.config.mode).toBe('smart');
  });

  it('a released FOUR/OVER_END event drives a card in smart mode', async () => {
    const { app, port, pair, post } = await boot();
    const { token } = await pair();
    await fetch(`http://127.0.0.1:${port}/api/director`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'smart' }),
    });
    const mk = (runs: number, overs: number, balls: number, last: string[]): RawUpdate =>
      RawUpdateSchema.parse({
        source: 'cricbuzz',
        matchId: 'm1',
        url: 'https://www.example.invalid/m1',
        capturedAt: 1,
        confidence: 1,
        fields: {
          title: 'A v B T20',
          innings: [{ team: 'A', runs, wkts: 0, overs, balls }],
          lastBalls: last,
          thisOver: last,
        },
      });
    const send = (u: RawUpdate) => post('/api/ext/ingest', { type: 'update', update: u }, token);
    await send(mk(20, 2, 5, ['1', '1', '1', '1', '1']));
    await send(mk(21, 3, 0, ['1', '1', '1', '1', '1', '1']));
    await waitFor(() => app.director.state.onAir !== null || app.director.state.queued.length > 0);
    const s = app.director.state;
    expect([s.onAir?.cardId, ...s.queued]).toContain('manhattan');
  });
});
