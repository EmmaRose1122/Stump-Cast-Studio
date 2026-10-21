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

  it('handles /api/ai/keys GET, POST, and DELETE for gemini, cricket and openai', async () => {
    const app = await makeApp();
    const port = await app.start();

    // 1. Initial status has no keys
    const initRes = await fetch(`http://127.0.0.1:${port}/api/ai/keys`);
    expect(initRes.status).toBe(200);
    const initBody = await initRes.json();
    expect(initBody).toEqual({
      gemini: { hasKey: false },
      openai: { hasKey: false },
      cricket: { hasKey: false },
    });

    // 2. Save Gemini key
    const postGemini = await fetch(`http://127.0.0.1:${port}/api/ai/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'gemini', key: 'AIzaSyTest123456789' }),
    });
    expect(postGemini.status).toBe(200);
    const postGeminiBody = await postGemini.json();
    expect(postGeminiBody).toMatchObject({ ok: true, provider: 'gemini', hasKey: true });

    // 3. Status reflects Gemini key
    const statusRes = await fetch(`http://127.0.0.1:${port}/api/ai/keys`);
    const statusBody = (await statusRes.json()) as { gemini: { hasKey: boolean } };
    expect(statusBody.gemini.hasKey).toBe(true);

    // 4. Save Cricket key via /api/ai/keys
    const postCricket = await fetch(`http://127.0.0.1:${port}/api/ai/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'cricket', key: 'cricapi-valid-key-999' }),
    });
    expect(postCricket.status).toBe(200);

    // Provider status also reflects hasKey: true
    const providerRes = await fetch(`http://127.0.0.1:${port}/api/provider/api/status`);
    const providerBody = (await providerRes.json()) as { hasKey: boolean };
    expect(providerBody.hasKey).toBe(true);

    // 5. Delete Gemini key
    const delRes = await fetch(`http://127.0.0.1:${port}/api/ai/keys/gemini`, {
      method: 'DELETE',
    });
    expect(delRes.status).toBe(200);
    const delBody = await delRes.json();
    expect(delBody).toMatchObject({ ok: true, provider: 'gemini', hasKey: false });

    // Status reflects deletion
    const finalRes = await fetch(`http://127.0.0.1:${port}/api/ai/keys`);
    const finalBody = (await finalRes.json()) as { gemini: { hasKey: boolean } };
    expect(finalBody.gemini.hasKey).toBe(false);
  });
});
