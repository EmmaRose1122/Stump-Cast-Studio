// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { RawUpdateSchema, type RawUpdate } from '@stumpcast/shared';
import {
  Connector,
  HEARTBEAT_MS,
  isAllowedMatchUrl,
  type ConnectorDeps,
  type SocketLike,
} from './connector';
import type { SelectorBundle } from '@stumpcast/shared';
import { signSelectorBundle } from '../../../shared/src/sign';

// ---- fakes --------------------------------------------------------------------------------

class FakeSocket implements SocketLike {
  readyState = 0;
  sent: Record<string, unknown>[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {}
  send(data: string) {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }
  close() {
    this.readyState = 3;
  }
  // test helpers
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  serverSays(msg: unknown) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
  serverClose(code = 1006) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

const makeEnv = (
  opts: {
    livePort?: number;
    store?: Record<string, unknown>;
    selectorsResponse?: () => Response | Promise<Response>;
  } = {},
) => {
  const store: Record<string, unknown> = opts.store ?? {};
  const sockets: FakeSocket[] = [];
  const fetched: { url: string; init?: RequestInit }[] = [];
  const opened: string[] = [];
  const intervals = new Map<number, { fn: () => void; ms: number }>();
  const timeouts = new Map<number, { fn: () => void; ms: number }>();
  let nextId = 1;
  let ingestStatus = 200;
  let t = 1_000_000;

  const deps: ConnectorDeps = {
    storage: {
      get: async (k) => store[k],
      set: async (k, v) => {
        store[k] = v;
      },
      remove: async (k) => {
        delete store[k];
      },
    },
    fetch: async (url, init) => {
      fetched.push({ url, init });
      const m = /127\.0\.0\.1:(\d+)(\/.*)$/.exec(url);
      const port = Number(m?.[1]);
      const path = m?.[2];
      if (port !== opts.livePort) throw new Error('ECONNREFUSED');
      if (path === '/api/health') return Response.json({ ok: true });
      if (path === '/api/ext/selectors') {
        return opts.selectorsResponse ? await opts.selectorsResponse() : new Response('{}', { status: 404 });
      }
      if (path === '/api/ext/pair') {
        const { code } = JSON.parse(String(init?.body)) as { code: string };
        return code === '123456'
          ? Response.json({ token: 'tok-abcdefghijklmnopqrstuvwx' })
          : new Response('{}', { status: 401 });
      }
      if (path === '/api/ext/ingest') return new Response('{}', { status: ingestStatus });
      return new Response('{}', { status: 404 });
    },
    createSocket: (url) => {
      const s = new FakeSocket(url);
      sockets.push(s);
      return s;
    },
    tabs: {
      open: async (u) => {
        opened.push(u);
        return 99;
      },
      focus: async () => undefined,
      close: async () => undefined,
    },
    timers: {
      setInterval: (fn, ms) => {
        intervals.set(nextId, { fn, ms });
        return nextId++;
      },
      clearInterval: (id) => void intervals.delete(id as number),
      setTimeout: (fn, ms) => {
        timeouts.set(nextId, { fn, ms });
        return nextId++;
      },
      clearTimeout: (id) => void timeouts.delete(id as number),
    },
    now: () => t,
    version: '0.0.1',
    selectorsVersion: () => 1,
  };
  return {
    deps,
    store,
    sockets,
    fetched,
    opened,
    intervals,
    timeouts,
    setIngestStatus: (s: number) => (ingestStatus = s),
    advance: (ms: number) => (t += ms),
  };
};

const flush = () => new Promise((r) => setTimeout(r, 0));

const update = (matchId: string): RawUpdate =>
  RawUpdateSchema.parse({
    source: 'cricbuzz',
    matchId,
    url: `https://www.cricbuzz.com/live-cricket-scores/${matchId}`,
    capturedAt: 1,
    confidence: 1,
    fields: { innings: [{ team: 'A', runs: 1, wkts: 0, overs: 0, balls: 1 }] },
  });

const connectAuthed = async (env: ReturnType<typeof makeEnv>, c: Connector) => {
  await c.init();
  await flush();
  const s = env.sockets.at(-1)!;
  s.open();
  s.serverSays({ type: 'authed' });
  await flush();
  return s;
};

// ---- tests --------------------------------------------------------------------------------

describe('Connector pairing and port discovery', () => {
  it('discovers the server on a non-default port and stores the token', async () => {
    const env = makeEnv({ livePort: 4003 });
    const c = new Connector(env.deps);
    expect(await c.pair('123456')).toBe(true);
    expect(env.store.token).toBe('tok-abcdefghijklmnopqrstuvwx');
    expect(env.store.port).toBe(4003);
    expect(env.sockets[0]?.url).toBe('ws://127.0.0.1:4003/ext');
  });

  it('a wrong code does not store a token', async () => {
    const env = makeEnv({ livePort: 4000 });
    const c = new Connector(env.deps);
    expect(await c.pair('000000')).toBe(false);
    expect(env.store.token).toBeUndefined();
  });

  it('fails cleanly when no server is running', async () => {
    const c = new Connector(makeEnv().deps);
    expect(await c.pair('123456')).toBe(false);
  });
});

describe('Connector transport', () => {
  it('authenticates first, then sends updates and heartbeats on the socket', async () => {
    const env = makeEnv({ livePort: 4000, store: { token: 'tok-abcdefghijklmnopqrstuvwx' } });
    const c = new Connector(env.deps);
    const s = await connectAuthed(env, c);
    expect(s.sent[0]).toEqual({ type: 'auth', token: 'tok-abcdefghijklmnopqrstuvwx' });

    await c.onContentMessage({ type: 'score-update', update: update('m1') }, 7);
    expect(s.sent.some((m) => m.type === 'update')).toBe(true);

    const hb = s.sent.find((m) => m.type === 'heartbeat') as { tabs: { matchId: string }[] };
    expect(hb).toBeTruthy();
    // A heartbeat timer fires every 5 s afterwards.
    expect([...env.intervals.values()].some((i) => i.ms === HEARTBEAT_MS)).toBe(true);
  });

  it('falls back to HTTP ingest when the socket is not open', async () => {
    const env = makeEnv({
      livePort: 4000,
      store: { token: 'tok-abcdefghijklmnopqrstuvwx', port: 4000 },
    });
    const c = new Connector(env.deps);
    await c.init(); // socket created but never opened
    await c.onContentMessage({ type: 'score-update', update: update('m1') }, 1);
    const post = env.fetched.find((f) => f.url.endsWith('/api/ext/ingest'));
    expect(post).toBeTruthy();
    expect((post!.init!.headers as Record<string, string>).authorization).toBe(
      'Bearer tok-abcdefghijklmnopqrstuvwx',
    );
  });

  it('reconnects with exponential backoff after the socket drops', async () => {
    const env = makeEnv({ livePort: 4000, store: { token: 'tok-abcdefghijklmnopqrstuvwx' } });
    const c = new Connector(env.deps);
    const s = await connectAuthed(env, c);
    s.serverClose();
    const first = [...env.timeouts.values()].at(-1)!;
    expect(first.ms).toBe(1000);
    first.fn();
    await flush();
    expect(env.sockets).toHaveLength(2);
    env.sockets[1]!.serverClose();
    expect([...env.timeouts.values()].at(-1)!.ms).toBe(2000);
  });

  it('recovers after the service worker is killed (new instance, same storage)', async () => {
    const env = makeEnv({ livePort: 4000, store: { token: 'tok-abcdefghijklmnopqrstuvwx' } });
    await connectAuthed(env, new Connector(env.deps));
    // Worker terminated: all in-memory state lost. A new Connector reuses chrome.storage.
    const reborn = new Connector(env.deps);
    const s = await connectAuthed(env, reborn);
    await reborn.onContentMessage({ type: 'score-update', update: update('m2') }, 3);
    expect(s.sent.some((m) => m.type === 'update')).toBe(true);
  });

  it('forgets the token when the server rejects it (4401 or HTTP 401)', async () => {
    const env = makeEnv({ livePort: 4000, store: { token: 'tok-abcdefghijklmnopqrstuvwx' } });
    const c = new Connector(env.deps);
    const s = await connectAuthed(env, c);
    s.serverClose(4401);
    await flush();
    expect(env.store.token).toBeUndefined();
    expect(c.paired).toBe(false);
  });

  it('ticks keep a tab listed without sending a score', async () => {
    const env = makeEnv({ livePort: 4000, store: { token: 'tok-abcdefghijklmnopqrstuvwx' } });
    const c = new Connector(env.deps);
    const s = await connectAuthed(env, c);
    const before = s.sent.length;
    await c.onContentMessage(
      { type: 'tick', matchId: 'm1', url: 'https://www.cricbuzz.com/x', confidence: 1, at: 1 },
      5,
    );
    expect(s.sent.length).toBe(before);
    expect(c.tabs.map((t) => t.matchId)).toEqual(['m1']);
    c.onTabRemoved(5);
    expect(c.tabs).toEqual([]);
  });
});

describe('Connector commands', () => {
  const cmd = async (c: Connector, s: FakeSocket, body: object) => {
    s.serverSays({ type: 'command', ...body });
    await flush();
  };

  it('opens only https URLs on supported sites', async () => {
    const env = makeEnv({ livePort: 4000, store: { token: 'tok-abcdefghijklmnopqrstuvwx' } });
    const c = new Connector(env.deps);
    const s = await connectAuthed(env, c);
    await cmd(c, s, {
      command: 'openMatch',
      url: 'https://www.cricbuzz.com/live-cricket-scores/1',
    });
    await cmd(c, s, { command: 'openMatch', url: 'https://evil.example/phish' });
    await cmd(c, s, { command: 'openMatch', url: 'http://www.cricbuzz.com/x' });
    expect(env.opened).toEqual(['https://www.cricbuzz.com/live-cricket-scores/1']);
  });

  it('kill switch stops forwarding and persists', async () => {
    const env = makeEnv({ livePort: 4000, store: { token: 'tok-abcdefghijklmnopqrstuvwx' } });
    const c = new Connector(env.deps);
    const s = await connectAuthed(env, c);
    await cmd(c, s, { command: 'killSwitch', enabled: true });
    const before = s.sent.length;
    await c.onContentMessage({ type: 'score-update', update: update('m1') }, 1);
    expect(s.sent.length).toBe(before);
    expect(env.store.killed).toBe(true);
  });

  it('reloadSelectors fetches, verifies and stores valid bundle', async () => {
    const bundle: SelectorBundle = {
      version: 555,
      updatedAt: 1775000000000,
      selectors: {
        cricbuzz: { version: 555, site: 'cricbuzz', urlPatterns: ['test'] },
        crex: { version: 555, site: 'crex', urlPatterns: ['test'] },
      },
    };
    const signed = await signSelectorBundle(bundle);
    const env = makeEnv({
      livePort: 4000,
      store: { token: 'tok-abcdefghijklmnopqrstuvwx' },
      selectorsResponse: () => Response.json(signed),
    });
    const c = new Connector(env.deps);
    await connectAuthed(env, c);
    const ok = await c.reloadSelectors();
    expect(ok).toBe(true);
    expect(env.store.customSelectors).toEqual(bundle);
  });

  it('reloadSelectors rejects a signed bundle whose scraper config is unusable', async () => {
    const bundle: SelectorBundle = {
      version: 556,
      updatedAt: 1775000000000,
      selectors: {
        // valid on its face, but the regex inside would be handed to new RegExp by the adapter
        cricbuzz: { version: 556, site: 'cricbuzz', urlPatterns: ['('] },
      },
    };
    const signed = await signSelectorBundle(bundle);
    const env = makeEnv({
      livePort: 4000,
      store: { token: 'tok-abcdefghijklmnopqrstuvwx' },
      selectorsResponse: () => Response.json(signed),
    });
    const c = new Connector(env.deps);
    await connectAuthed(env, c);
    expect(await c.reloadSelectors()).toBe(false);
    expect(env.store.customSelectors).toBeUndefined();
  });

  it('reloadSelectors rejects tampered bundle and ignores it', async () => {
    const bundle: SelectorBundle = {
      version: 555,
      updatedAt: 1775000000000,
      selectors: {
        cricbuzz: { version: 555, site: 'cricbuzz', urlPatterns: ['test'] },
        crex: { version: 555, site: 'crex', urlPatterns: ['test'] },
      },
    };
    const signed = await signSelectorBundle(bundle);
    const tampered = { ...signed, payload: signed.payload.replace('555', '999') };
    const env = makeEnv({
      livePort: 4000,
      store: { token: 'tok-abcdefghijklmnopqrstuvwx' },
      selectorsResponse: () => Response.json(tampered),
    });
    const c = new Connector(env.deps);
    await connectAuthed(env, c);
    const ok = await c.reloadSelectors();
    expect(ok).toBe(false);
    expect(env.store.customSelectors).toBeUndefined();
  });
});

describe('delivery reliability', () => {
  const healthCalls = (env: ReturnType<typeof makeEnv>) =>
    env.fetched.filter((f) => String(f.url).endsWith('/api/health')).length;
  const ingestCalls = (env: ReturnType<typeof makeEnv>) =>
    env.fetched.filter((f) => String(f.url).endsWith('/api/ext/ingest')).length;

  it('sends a score update once when the socket is open', async () => {
    const env = makeEnv({
      livePort: 4000,
      store: { token: 'tok-abcdefghijklmnopqrstuvwx', port: 4000 },
    });
    const c = new Connector(env.deps);
    const s = await connectAuthed(env, c);

    await c.onContentMessage({ type: 'score-update', update: update('m1') }, 7);

    expect(s.sent.filter((m) => m.type === 'update')).toHaveLength(1);
    expect(ingestCalls(env)).toBe(0);
  });

  it('falls back to HTTP ingest when the socket is not usable', async () => {
    const env = makeEnv({ livePort: 4000, store: { token: 'tok-abcdefghijklmnopqrstuvwx' } });
    const c = new Connector(env.deps);
    await c.init(); // no socket opened/authed

    await c.onContentMessage({ type: 'score-update', update: update('m1') }, 7);
    expect(ingestCalls(env)).toBe(1);
  });

  it('bounds the localhost port sweep when no server is running', async () => {
    const env = makeEnv(); // nothing listening
    const c = new Connector(env.deps);
    await c.init();
    const afterInit = healthCalls(env);
    expect(afterInit).toBeGreaterThan(0);

    for (let i = 0; i < 10; i++) {
      await c.onContentMessage({ type: 'score-update', update: update('m1') }, 7);
    }
    // Same clock: discovery and pairing answers are cached. At most one peer probe (5 ports)
    // may be added — never a fresh 26-call sweep per message.
    expect(healthCalls(env) - afterInit).toBeLessThanOrEqual(5);

    env.advance(16_000);
    await c.onContentMessage({ type: 'score-update', update: update('m1') }, 7);
    expect(healthCalls(env)).toBeGreaterThan(afterInit + 5);
  });

  it('remembers open matches across a service-worker restart', async () => {
    const env = makeEnv({
      livePort: 4000,
      store: { token: 'tok-abcdefghijklmnopqrstuvwx', port: 4000 },
    });
    const c = new Connector(env.deps);
    await c.init();
    await c.onContentMessage({ type: 'score-update', update: update('m1') }, 7);
    await flush();
    expect((env.store.trackedTabs as { matchId: string }[]).map((t) => t.matchId)).toEqual(['m1']);

    // MV3 killed the worker: a fresh Connector must rehydrate the same open-match list.
    const revived = new Connector(env.deps);
    await revived.init();
    expect(revived.tabs.map((t) => t.matchId)).toEqual(['m1']);

    revived.onTabRemoved(7);
    await flush();
    expect(revived.tabs).toEqual([]);
  });
});

describe('isAllowedMatchUrl', () => {
  it('accepts supported sites and rejects lookalikes', () => {
    expect(isAllowedMatchUrl('https://www.cricbuzz.com/live-cricket-scores/1/a')).toBe(true);
    expect(isAllowedMatchUrl('https://crex.com/scoreboard/x')).toBe(true);
    expect(isAllowedMatchUrl('https://cricbuzz.com.evil.example/')).toBe(false);
    expect(isAllowedMatchUrl('javascript:alert(1)')).toBe(false);
  });
});
