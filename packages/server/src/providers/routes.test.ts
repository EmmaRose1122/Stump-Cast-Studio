import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp, type StumpCastApp } from '../app';
import { loadConfig } from '../config';

let dir: string;
const apps: StumpCastApp[] = [];

const makeApp = async (overrides = {}) => {
  const app = await buildApp(
    loadConfig({}, { dataDir: dir, port: 0, overlayDir: '', adminDir: '', ...overrides }),
  );
  apps.push(app);
  return app;
};

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stumpcast-api-test-'));
});

afterEach(async () => {
  while (apps.length) await apps.pop()!.stop();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('ApiProvider HTTP routes', () => {
  it('GET /api/provider/api/status returns initial status', async () => {
    const app = await makeApp();
    const port = await app.start();

    const res = await fetch(`http://127.0.0.1:${port}/api/provider/api/status`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      health: 'down',
      activeMatchId: null,
      hasKey: false,
    });
  });

  it('POST /api/provider/api/key saves key securely and updates status', async () => {
    const app = await makeApp();
    const port = await app.start();

    const res = await fetch(`http://127.0.0.1:${port}/api/provider/api/key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'test-secret-key-12345' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ success: true, hasKey: true });

    // Status now reflects hasKey: true
    const statusRes = await fetch(`http://127.0.0.1:${port}/api/provider/api/status`);
    const statusBody = (await statusRes.json()) as { hasKey: boolean; activeMatchId: string | null };
    expect(statusBody.hasKey).toBe(true);
  });

  it('POST /api/provider/api/subscribe rejects missing matchId and accepts valid matchId', async () => {
    const app = await makeApp();
    const port = await app.start();

    const bad = await fetch(`http://127.0.0.1:${port}/api/provider/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(bad.status).toBe(400);

    const good = await fetch(`http://127.0.0.1:${port}/api/provider/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId: 'match-999' }),
    });
    expect(good.status).toBe(200);
    const goodBody = await good.json();
    expect(goodBody).toMatchObject({ success: true, matchId: 'match-999', subscribed: true });

    const statusRes = await fetch(`http://127.0.0.1:${port}/api/provider/api/status`);
    const statusBody = (await statusRes.json()) as { hasKey: boolean; activeMatchId: string | null };
    expect(statusBody.activeMatchId).toBe('match-999');

    // Unsubscribe works
    const unsubs = await fetch(`http://127.0.0.1:${port}/api/provider/api/unsubscribe`, {
      method: 'POST',
    });
    expect(unsubs.status).toBe(200);
  });
});
