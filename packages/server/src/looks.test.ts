import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { ALL_LOOKS, ALL_PRO_LOOKS, graphiteTeal } from '@stumpcast/shared';
import { buildApp, type StumpCastApp } from './app';
import { loadConfig } from './config';

let app: StumpCastApp | null = null;
let dir = '';

afterEach(async () => {
  await app?.stop();
  app = null;
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
  dir = '';
});

const boot = async (licensed = false) => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-looks-'));
  app = await buildApp(
    loadConfig({}, { dataDir: dir, port: 0, overlayDir: '', adminDir: '', licensed }),
  );
  const port = await app.start();
  const base = `http://127.0.0.1:${port}`;
  const send = (method: string, p: string, body?: unknown) =>
    fetch(base + p, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  return { base, port, send };
};

interface Listing {
  id: string;
  plan: string;
  locked: boolean;
  active: boolean;
  builtin: boolean;
}

describe('looks API', () => {
  it('lists every shipped look, locking the Pro ones when unlicensed', async () => {
    const { send } = await boot(false);
    const body = (await (await send('GET', '/api/looks')).json()) as {
      licensed: boolean;
      looks: Listing[];
    };
    const proPack = ALL_PRO_LOOKS.filter((l) => !ALL_LOOKS.some((b) => b.id === l.id));
    expect(body.licensed).toBe(false);
    expect(body.looks).toHaveLength(ALL_LOOKS.length + proPack.length);
    expect(body.looks.filter((l) => l.locked)).toHaveLength(ALL_PRO_LOOKS.length);
    expect(body.looks.find((l) => l.active)!.id).toBe('ink-gold');
    // The Graphics picker used to see only the 8 built-ins, so a studio could not apply the
    // Pro packs from there at all.
    const pl2 = body.looks.filter((l) => l.id.startsWith('p2-'));
    expect(pl2).toHaveLength(23);
    expect(pl2.every((l) => l.builtin && l.locked && l.plan === 'pro')).toBe(true);
  });

  it('activates a Pro Look 2 design for a licensed studio and refuses to delete it', async () => {
    const { send } = await boot(true);
    expect((await send('POST', '/api/looks/activate', { id: 'p2-k01' })).status).toBe(200);
    const active = (await (await send('GET', '/api/looks/active')).json()) as { id: string };
    expect(active.id).toBe('p2-k01');
    expect((await send('DELETE', '/api/looks/p2-k01')).status).toBe(403);
  });

  it('refuses a Pro look even when the client asks for a preview', async () => {
    // The preview escape hatch let a free studio select a Pro look into its own preview window,
    // which is the selection the paid tier exists to gate. There is no preview path now.
    const { send } = await boot(false);
    const res = await send('POST', '/api/looks/activate', { id: 'midnight-glass', preview: true });
    expect(res.status).toBe(403);
    const settings = (await (await send('GET', '/api/settings')).json()) as { theme: string };
    expect(settings.theme).not.toBe('midnight-glass');
  });

  it('marks Pro looks locked in the catalog while unlicensed', async () => {
    const { send } = await boot(false);
    const body = (await (await send('GET', '/api/looks/catalog')).json()) as {
      licensed: boolean;
      catalog: { id: string; plan: string; locked: boolean }[];
    };
    expect(body.licensed).toBe(false);
    expect(body.catalog).toHaveLength(ALL_PRO_LOOKS.length);
    expect(new Set(body.catalog.map((look) => look.id)).size).toBe(ALL_PRO_LOOKS.length);
    expect(body.catalog.every((l) => l.plan !== 'pro' || l.locked)).toBe(true);
  });

  it('activates a free look, persists it and broadcasts to overlays', async () => {
    const { send, port, base } = await boot(false);
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const got: { channel?: string; event?: string; payload?: { id?: string } }[] = [];
    await new Promise((r) => ws.on('open', r));
    ws.on('message', (d) => got.push(JSON.parse(d.toString())));
    ws.send(JSON.stringify({ type: 'subscribe', channels: ['layout'] }));
    await new Promise((r) => setTimeout(r, 50));

    const res = await send('POST', '/api/looks/activate', { id: 'coral-dusk' });
    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 100));
    expect(got.some((m) => m.event === 'look' && m.payload?.id === 'coral-dusk')).toBe(true);

    const active = (await (await fetch(`${base}/api/looks/active`)).json()) as { id: string };
    expect(active.id).toBe('coral-dusk');
    ws.close();
  });

  it('rejects a Pro look when unlicensed and allows it when licensed', async () => {
    const locked = await boot(false);
    const denied = await locked.send('POST', '/api/looks/activate', { id: 'ember' });
    expect(denied.status).toBe(403);
    expect(((await denied.json()) as { error: string }).error).toMatch(/Pro/);
    await app!.stop();
    app = null;

    const open = await boot(true);
    expect((await open.send('POST', '/api/looks/activate', { id: 'ember' })).status).toBe(200);
  });

  it('404s for an unknown look', async () => {
    const { send } = await boot();
    expect((await send('POST', '/api/looks/activate', { id: 'nope' })).status).toBe(404);
  });

  it('imports a valid custom look, lists it and can activate then remove it', async () => {
    const { send } = await boot(false);
    const custom = {
      ...graphiteTeal,
      id: 'my-club',
      name: 'My Club',
      plan: 'free',
      tokens: {
        ...graphiteTeal.tokens,
        colors: { ...graphiteTeal.tokens.colors, accent: '#FF00AA' },
      },
    };
    const imp = await send('POST', '/api/looks/import', custom);
    expect(imp.status).toBe(200);

    const list = (await (await send('GET', '/api/looks')).json()) as { looks: Listing[] };
    const mine = list.looks.find((l) => l.id === 'my-club')!;
    expect(mine).toMatchObject({ builtin: false, locked: false });

    expect((await send('POST', '/api/looks/activate', { id: 'my-club' })).status).toBe(200);
    expect((await send('DELETE', '/api/looks/my-club')).status).toBe(200);

    // Removing the active look falls back to the default.
    const active = (await (await send('GET', '/api/looks/active')).json()) as { id: string };
    expect(active.id).toBe('ink-gold');
  });

  it('rejects unknown fields, bad colours, oversized and built-in ids', async () => {
    const { send } = await boot();
    const base = { ...graphiteTeal, id: 'custom-one', name: 'Custom' };

    const extra = await send('POST', '/api/looks/import', { ...base, script: 'alert(1)' });
    expect(extra.status).toBe(400);
    expect(((await extra.json()) as { error: string }).error).toMatch(/Unknown field/);

    const badColour = await send('POST', '/api/looks/import', {
      ...base,
      tokens: { ...base.tokens, colors: { accent: 'red' } },
    });
    expect(badColour.status).toBe(400);

    const huge = await send('POST', '/api/looks/import', {
      ...base,
      tokens: { ...base.tokens, shadows: { big: 'x'.repeat(30_000) } },
    });
    expect(huge.status).toBe(400);

    const builtin = await send('POST', '/api/looks/import', { ...base, id: 'ember' });
    expect(builtin.status).toBe(409);

    const badId = await send('POST', '/api/looks/import', { ...base, id: 'Has Spaces!' });
    expect(badId.status).toBe(400);
  });

  it('refuses to remove a built-in look', async () => {
    const { send } = await boot();
    expect((await send('DELETE', '/api/looks/graphite-teal')).status).toBe(403);
  });
});
