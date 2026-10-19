import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

// Windows keeps files open that sharp has read by path; the tests read buffers instead.
sharp.cache(false);
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { buildApp, type StumpCastApp } from '../app';
import { loadConfig } from '../config';
import { openDatabase } from '../db';
import { AssetError, AssetService, assetIdFor } from './AssetService';
import { FetchBlockedError, isPrivateAddress, safeFetchImage } from './safeFetch';

const png = (w = 300, h = 400, color = { r: 200, g: 40, b: 40 }) =>
  sharp({ create: { width: w, height: h, channels: 3, background: color } })
    .png()
    .toBuffer();

describe('isPrivateAddress', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '::1',
    '::',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    '::ffff:10.0.0.1',
    'not-an-ip',
  ])('blocks %s', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each(['8.8.8.8', '1.1.1.1', '172.15.0.1', '172.32.0.1', '2606:4700:4700::1111'])(
    'allows %s',
    (ip) => {
      expect(isPrivateAddress(ip)).toBe(false);
    },
  );
});

describe('safeFetchImage (SSRF)', () => {
  it.each([
    'http://127.0.0.1:4000/api/settings',
    'http://localhost/x.png',
    'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.5/a.png',
    'http://[::1]/a.png',
    'http://192.168.0.1/a.png',
    'file:///etc/passwd',
    'ftp://example.com/a.png',
    'http://user:pass@example.com/a.png',
    'not a url',
  ])('refuses %s', async (url) => {
    await expect(safeFetchImage(url)).rejects.toBeInstanceOf(FetchBlockedError);
  });
});

describe('AssetService', () => {
  let dir: string;
  let sqlite: ReturnType<typeof openDatabase>['sqlite'];
  let svc: AssetService;
  let t = 1_000;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-assets-'));
    const opened = openDatabase(dir);
    sqlite = opened.sqlite;
    svc = new AssetService(
      opened.db,
      dir,
      async (url) => {
        if (url.includes('bad')) throw new Error('boom');
        return { buffer: await png(), contentType: 'image/png' };
      },
      () => ++t,
    );
  });

  afterEach(() => {
    sqlite.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('syncFromDisk registers loose images once and ignores bad names', async () => {
    const webp = await sharp(await png()).webp().toBuffer();
    fs.writeFileSync(path.join(svc.root, 'teams', 'team-nep.webp'), webp);
    fs.writeFileSync(path.join(svc.root, 'players', 'some-player.webp'), webp);
    fs.writeFileSync(path.join(svc.root, 'teams', 'Bad Name.webp'), webp);
    fs.writeFileSync(path.join(svc.root, 'teams', 'team-x.svg'), '<svg/>');
    expect(svc.syncFromDisk()).toEqual({ added: 2 });
    expect(svc.get('team-nep')).toMatchObject({ type: 'team', file: 'teams/team-nep.webp' });
    expect(svc.get('some-player')?.type).toBe('player');
    expect(svc.list({ type: 'team', q: 'nep' }).total).toBe(1);
    expect(svc.syncFromDisk()).toEqual({ added: 0 }); // idempotent
  });

  it('builds ids with the PRD rules', () => {
    expect(assetIdFor('player', { name: 'Aiden Markram' })).toBe('aiden-markram');
    expect(assetIdFor('team', { short: 'RSA' })).toBe('team-rsa');
    expect(() => assetIdFor('player', { name: '   ' })).toThrow(AssetError);
  });

  it('stores a player as a 512x512 WebP and PNG, cropped from the top', async () => {
    const { asset, replaced } = await svc.saveImage({
      type: 'player',
      id: 'aiden-markram',
      buffer: await png(300, 600),
      rightsConfirmed: true,
    });
    expect(replaced).toBe(false);
    expect(asset.file).toBe('players/aiden-markram.webp');
    const meta = await sharp(fs.readFileSync(path.join(svc.root, asset.file))).metadata();
    expect([meta.width, meta.height, meta.format]).toEqual([512, 512, 'webp']);
    const pngMeta = await sharp(fs.readFileSync(path.join(svc.root, asset.png))).metadata();
    expect([pngMeta.width, pngMeta.height, pngMeta.format]).toEqual([512, 512, 'png']);
  });

  it('fits a team crest into 256x256 with transparency', async () => {
    const { asset } = await svc.saveImage({
      type: 'team',
      id: 'team-rsa',
      buffer: await png(400, 200),
      rightsConfirmed: true,
    });
    const meta = await sharp(fs.readFileSync(path.join(svc.root, asset.file))).metadata();
    expect([meta.width, meta.height]).toEqual([256, 256]);
  });

  it('requires the rights confirmation and records it', async () => {
    await expect(
      svc.saveImage({ type: 'player', id: 'a', buffer: await png(), rightsConfirmed: false }),
    ).rejects.toThrow(/rights/);
    const { asset } = await svc.saveImage({
      type: 'player',
      id: 'a',
      buffer: await png(),
      rightsConfirmed: true,
    });
    expect(svc.get(asset.id)!.rightsConfirmed).toBe(true);
  });

  it('replaces an asset with the same id and reports it', async () => {
    const first = { type: 'player' as const, id: 'a', buffer: await png(), rightsConfirmed: true };
    await svc.saveImage(first);
    const again = await svc.saveImage(first);
    expect(again.replaced).toBe(true);
    expect(svc.list().total).toBe(1);
  });

  it('refuses an id that already belongs to a different type', async () => {
    await svc.saveImage({ type: 'player', id: 'x', buffer: await png(), rightsConfirmed: true });
    await expect(
      svc.saveImage({ type: 'team', id: 'x', buffer: await png(), rightsConfirmed: true }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('rejects garbage, empty, oversized and unsafe SVG files', async () => {
    const base = { type: 'player' as const, id: 'a', rightsConfirmed: true };
    await expect(svc.saveImage({ ...base, buffer: Buffer.from('not an image') })).rejects.toThrow(
      AssetError,
    );
    await expect(svc.saveImage({ ...base, buffer: Buffer.alloc(0) })).rejects.toThrow(/empty/);
    await expect(
      svc.saveImage({ ...base, buffer: Buffer.alloc(9 * 1024 * 1024) }),
    ).rejects.toMatchObject({ status: 413 });
    await expect(
      svc.saveImage({
        ...base,
        buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>x()</script></svg>'),
      }),
    ).rejects.toThrow(/SVG/);
    await expect(
      svc.saveImage({
        ...base,
        buffer: Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg"><image href="file:///etc/passwd"/></svg>',
        ),
      }),
    ).rejects.toThrow(/SVG/);
  });

  it('accepts a plain SVG', async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#19D3C5"/></svg>';
    const { asset } = await svc.saveImage({
      type: 'team',
      id: 'team-svg',
      buffer: Buffer.from(svg),
      rightsConfirmed: true,
    });
    expect(fs.existsSync(path.join(svc.root, asset.file))).toBe(true);
  });

  it('imports from a URL via the injected fetcher and reports failures plainly', async () => {
    const ok = await svc.importUrl({
      type: 'player',
      id: 'b',
      url: 'https://example.com/b.png',
      rightsConfirmed: true,
    });
    expect(ok.asset.id).toBe('b');
    await expect(
      svc.importUrl({
        type: 'player',
        id: 'c',
        url: 'https://example.com/bad',
        rightsConfirmed: true,
      }),
    ).rejects.toThrow(/boom/);
    await expect(
      svc.importUrl({
        type: 'player',
        id: 'c',
        url: 'https://example.com/c.png',
        rightsConfirmed: false,
      }),
    ).rejects.toThrow(/rights/);
  });

  it('searches, filters, sorts and paginates', async () => {
    for (const id of ['alpha-one', 'alpha-two', 'bravo', '50%-off']) {
      await svc.saveImage({
        type: 'player',
        id: id.replace('%', ''),
        buffer: await png(),
        rightsConfirmed: true,
      });
    }
    await svc.saveImage({
      type: 'team',
      id: 'team-alp',
      buffer: await png(),
      rightsConfirmed: true,
    });

    expect(svc.list({ q: 'alpha' }).total).toBe(2);
    expect(svc.list({ type: 'team' }).items.map((i) => i.id)).toEqual(['team-alp']);
    expect(svc.list({ sort: 'name' }).items.map((i) => i.id)[0]).toBe('50-off');
    const p2 = svc.list({ pageSize: 2, page: 2, sort: 'name' });
    expect(p2.items).toHaveLength(2);
    expect(p2.total).toBe(5);
    // A literal percent sign in a search matches nothing rather than everything.
    expect(svc.list({ q: '%' }).total).toBe(0);
    expect(svc.list({ q: '_' }).total).toBe(0);
  });

  it('deletes files and rows', async () => {
    const { asset } = await svc.saveImage({
      type: 'player',
      id: 'gone',
      buffer: await png(),
      rightsConfirmed: true,
    });
    svc.delete('gone');
    expect(fs.existsSync(path.join(svc.root, asset.file))).toBe(false);
    expect(svc.get('gone')).toBeUndefined();
    expect(() => svc.delete('gone')).toThrow(/Unknown/);
  });

  it('reports players and crests that are still missing', async () => {
    await svc.saveImage({
      type: 'player',
      id: 'has-photo',
      buffer: await png(),
      rightsConfirmed: true,
    });
    const m = svc.missing({
      players: [
        { id: 'has-photo', name: 'Has Photo' },
        { id: 'no-photo', name: 'No Photo' },
        { id: 'no-photo', name: 'No Photo' },
        { id: 'unknown-bowler', name: '—' },
      ],
      teams: [{ id: 'team-reds', short: 'RED', name: 'Reds' }],
    });
    expect(m.players.map((p) => p.id)).toEqual(['no-photo']);
    expect(m.teams.map((t) => t.assetId)).toEqual(['team-red']);
  });
});

describe('assets HTTP API', () => {
  let app: StumpCastApp | null = null;
  let dir = '';
  afterEach(async () => {
    await app?.stop();
    app = null;
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });

  const boot = async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-assets-http-'));
    app = await buildApp(loadConfig({}, { dataDir: dir, port: 0, overlayDir: '', adminDir: '' }));
    const port = await app.start();
    return { port, base: `http://127.0.0.1:${port}` };
  };

  const upload = async (
    base: string,
    fields: Record<string, string>,
    bytes: Buffer,
    filename = 'p.png',
  ) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v); // fields before the file
    form.append('file', new Blob([new Uint8Array(bytes)], { type: 'image/png' }), filename);
    return fetch(`${base}/api/assets`, { method: 'POST', body: form });
  };

  it('uploads, serves the file, lists, hot-swaps and deletes', async () => {
    const { base, port } = await boot();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const got: { payload?: { action?: string; id?: string } }[] = [];
    await new Promise((r) => ws.on('open', r));
    ws.on('message', (d) => got.push(JSON.parse(d.toString())));
    ws.send(JSON.stringify({ type: 'subscribe', channels: ['cards'] }));
    await new Promise((r) => setTimeout(r, 50));

    const res = await upload(
      base,
      { type: 'player', name: 'Aiden Markram', rightsConfirmed: 'true' },
      await png(),
    );
    expect(res.status).toBe(200);
    const asset = (await res.json()) as { id: string; file: string };
    expect(asset.id).toBe('aiden-markram');

    const file = await fetch(`${base}/assets/${asset.file}`);
    expect(file.status).toBe(200);
    expect(file.headers.get('content-type')).toContain('image/webp');

    await new Promise((r) => setTimeout(r, 100));
    expect(
      got.some((m) => m.payload?.action === 'asset-updated' && m.payload.id === asset.id),
    ).toBe(true);

    const list = (await (await fetch(`${base}/api/assets?type=player&q=aiden`)).json()) as {
      total: number;
    };
    expect(list.total).toBe(1);

    expect((await fetch(`${base}/api/assets/aiden-markram`, { method: 'DELETE' })).status).toBe(
      200,
    );
    expect((await fetch(`${base}/assets/${asset.file}`)).status).toBe(404);
    ws.close();
  });

  it('rejects uploads without rights confirmation, with a bad type or a non-image', async () => {
    const { base } = await boot();
    const noRights = await upload(base, { type: 'player', name: 'A B' }, await png());
    expect(noRights.status).toBe(400);
    expect(((await noRights.json()) as { error: string }).error).toMatch(/rights/);

    const badType = await upload(
      base,
      { type: 'sound', name: 'A', rightsConfirmed: 'true' },
      await png(),
    );
    expect(badType.status).toBe(400);

    const notImage = await upload(
      base,
      { type: 'player', name: 'A B', rightsConfirmed: 'true' },
      Buffer.from('hello'),
    );
    expect(notImage.status).toBe(400);
  });

  it('blocks URL imports that point at internal addresses', async () => {
    const { base } = await boot();
    const res = await fetch(`${base}/api/assets/url`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'player',
        name: 'Evil',
        url: `${base}/api/settings`,
        rightsConfirmed: true,
      }),
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/not allowed|Blocked/);
  });

  it('lists the missing photos for a manual match squad', async () => {
    const { base } = await boot();
    const names = (p: string) => Array.from({ length: 11 }, (_, i) => `${p} Player ${i + 1}`);
    const created = await fetch(`${base}/api/manual/matches`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        format: 'T20',
        teams: [
          { name: 'Reds', short: 'RED', players: names('Reds') },
          { name: 'Blues', short: 'BLU', players: names('Blues') },
        ],
      }),
    });
    const m = (await created.json()) as { id: string };

    await upload(
      base,
      { type: 'player', name: 'Reds Player 1', rightsConfirmed: 'true' },
      await png(),
    );
    const missing = (await (await fetch(`${base}/api/assets/missing?matchId=${m.id}`)).json()) as {
      players: { id: string }[];
      teams: { assetId: string }[];
    };
    expect(missing.players).toHaveLength(21);
    expect(missing.players.some((p) => p.id === 'reds-player-1')).toBe(false);
    expect(missing.teams.map((t) => t.assetId).sort()).toEqual(['team-blu', 'team-red']);

    expect((await fetch(`${base}/api/assets/missing?matchId=nope`)).status).toBe(404);
    expect((await fetch(`${base}/api/assets/missing`)).status).toBe(400);
  });
});
