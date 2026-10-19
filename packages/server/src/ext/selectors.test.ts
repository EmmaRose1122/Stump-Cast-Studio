import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SELECTORS_PUBLIC_KEY,
  verifySignedSelectorBundle,
  type SelectorBundle,
} from '@stumpcast/shared';
import { signSelectorBundle } from '../../../shared/src/sign';
import { buildApp, type StumpCastApp } from '../app';
import { loadConfig } from '../config';

let dir: string;
const apps: StumpCastApp[] = [];

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stumpcast-selectors-'));
});
afterEach(async () => {
  while (apps.length) await apps.pop()!.stop();
  fs.rmSync(dir, { recursive: true, force: true });
});

const boot = async () => {
  const app = await buildApp(
    loadConfig({}, { dataDir: dir, port: 0, overlayDir: '', adminDir: '' }),
  );
  apps.push(app);
  const port = await app.start();
  const base = `http://127.0.0.1:${port}`;
  return { app, port, base };
};

describe('Selectors API (/api/ext/selectors)', () => {
  const sampleUpdateBundle: SelectorBundle = {
    version: 999,
    updatedAt: 1776000000000,
    selectors: {
      cricbuzz: {
        version: 999,
        site: 'cricbuzz',
        urlPatterns: ['^https://www\\.cricbuzz\\.com/live-cricket-scores/\\d+'],
        dom: {
          title: { selectors: ['.new-cricbuzz-title'] },
        },
      },
      crex: {
        version: 999,
        site: 'crex',
        urlPatterns: ['^https://crex\\.live/scoreboard/\\d+'],
        dom: {
          title: { selectors: ['.new-crex-title'] },
        },
      },
    },
  };

  it('GET /api/ext/selectors returns a valid signed bundle', async () => {
    const { base } = await boot();
    const res = await fetch(`${base}/api/ext/selectors`);
    expect(res.ok).toBe(true);
    const signed = await res.json();
    const verified = await verifySignedSelectorBundle(signed, DEFAULT_SELECTORS_PUBLIC_KEY);
    expect(verified.valid).toBe(true);
    expect(verified.bundle?.selectors.cricbuzz).toBeDefined();
  });

  it('GET /api/ext/selectors/status returns current status', async () => {
    const { base } = await boot();
    const res = await fetch(`${base}/api/ext/selectors/status`);
    expect(res.ok).toBe(true);
    const status = (await res.json()) as { source: string; version: number };
    expect(status.source).toBe('bundled');
    expect(status.version).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/ext/selectors/install applies a valid signed bundle', async () => {
    const { base } = await boot();
    const signed = await signSelectorBundle(sampleUpdateBundle);

    const installRes = await fetch(`${base}/api/ext/selectors/install`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(signed),
    });
    expect(installRes.ok).toBe(true);
    const installData = (await installRes.json()) as { version: number };
    expect(installData.version).toBe(999);

    // Verify GET /api/ext/selectors now returns version 999
    const getRes = await fetch(`${base}/api/ext/selectors`);
    const current = (await getRes.json()) as { version: number };
    expect(current.version).toBe(999);

    // Verify status says remote
    const statusRes = await fetch(`${base}/api/ext/selectors/status`);
    const status = (await statusRes.json()) as { source: string; version: number };
    expect(status.version).toBe(999);
    expect(status.source).toBe('remote');
  });

  it('POST /api/ext/selectors/install rejects a tampered bundle', async () => {
    const { base } = await boot();
    const signed = await signSelectorBundle(sampleUpdateBundle);
    const tampered = { ...signed, payload: signed.payload.replace('.new-cricbuzz-title', '.bad') };

    const installRes = await fetch(`${base}/api/ext/selectors/install`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(tampered),
    });
    expect(installRes.status).toBe(400);

    // Ensure state remained untouched
    const statusRes = await fetch(`${base}/api/ext/selectors/status`);
    const status = (await statusRes.json()) as { source: string; version: number };
    expect(status.source).toBe('bundled');
    expect(status.version).not.toBe(999);
  });

  it('POST /api/ext/selectors/rollback reverts back to bundled config', async () => {
    const { base } = await boot();
    const signed = await signSelectorBundle(sampleUpdateBundle);

    await fetch(`${base}/api/ext/selectors/install`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(signed),
    });

    const rollbackRes = await fetch(`${base}/api/ext/selectors/rollback`, {
      method: 'POST',
    });
    expect(rollbackRes.ok).toBe(true);

    const statusRes = await fetch(`${base}/api/ext/selectors/status`);
    const status = (await statusRes.json()) as { source: string; version: number };
    expect(status.source).toBe('bundled');
    expect(status.version).not.toBe(999);
  });
});
