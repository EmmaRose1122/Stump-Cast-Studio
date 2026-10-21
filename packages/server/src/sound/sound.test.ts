import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import { fixtures, type EngineEvent } from '@stumpcast/shared';
import { buildApp, type StumpCastApp } from '../app';
import { loadConfig } from '../config';
import { sniffAudio } from './SoundService';
import { CommentaryService } from './CommentaryService';
import { SAMPLE_RATE, SAMPLE_SOUNDS, encodeWav } from './wav';

const tone = (seconds = 0.2) => {
  const s = new Float32Array(Math.floor(SAMPLE_RATE * seconds));
  for (let i = 0; i < s.length; i++) s[i] = Math.sin((i / SAMPLE_RATE) * 2 * Math.PI * 440) * 0.3;
  return encodeWav(s);
};

describe('audio helpers', () => {
  it('writes a valid PCM WAV header', () => {
    const w = encodeWav(new Float32Array(SAMPLE_RATE)); // 1 second
    expect(w.toString('ascii', 0, 4)).toBe('RIFF');
    expect(w.toString('ascii', 8, 12)).toBe('WAVE');
    expect(w.readUInt32LE(24)).toBe(SAMPLE_RATE);
    expect(w.readUInt32LE(40)).toBe(SAMPLE_RATE * 2);
    expect(w.length).toBe(44 + SAMPLE_RATE * 2);
  });

  it('generates three audible, non-clipping placeholder sounds', () => {
    expect(SAMPLE_SOUNDS).toHaveLength(3);
    for (const s of SAMPLE_SOUNDS) {
      const samples = s.build();
      expect(samples.length).toBeGreaterThan(SAMPLE_RATE * 0.3);
      const peak = samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
      expect(peak).toBeGreaterThan(0.1);
      expect(peak).toBeLessThanOrEqual(1.5); // mixed parts stay inside the encoder's clamp
    }
  });

  it('identifies containers from their bytes, not their names', () => {
    expect(sniffAudio(tone())).toBe('wav');
    expect(sniffAudio(Buffer.from('OggS\0\0\0\0\0\0\0\0'))).toBe('ogg');
    expect(sniffAudio(Buffer.from('ID3\x04\0\0\0\0\0\0\0\0'))).toBe('mp3');
    expect(sniffAudio(Buffer.from([0xff, 0xfb, 0x90, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe('mp3');
    expect(sniffAudio(Buffer.from('<html>hello world</html>'))).toBeNull();
    expect(sniffAudio(Buffer.alloc(4))).toBeNull();
  });
});

describe('sound HTTP API', () => {
  let app: StumpCastApp | null = null;
  let dir = '';
  afterEach(async () => {
    await app?.stop();
    app = null;
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });

  const boot = async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-sound-'));
    app = await buildApp(loadConfig({}, { dataDir: dir, port: 0, overlayDir: '', adminDir: '' }));
    const port = await app.start();
    const base = `http://127.0.0.1:${port}`;
    const json = (method: string, p: string, body?: unknown) =>
      fetch(base + p, {
        method,
        headers: body === undefined ? undefined : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    const upload = (fields: Record<string, string>, bytes: Buffer, name = 'a.wav') => {
      const form = new FormData();
      for (const [k, v] of Object.entries(fields)) form.append(k, v);
      form.append('file', new Blob([new Uint8Array(bytes)]), name);
      return fetch(`${base}/api/sounds`, { method: 'POST', body: form });
    };
    const listen = async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      const got: {
        channel?: string;
        payload?: { action?: string; id?: string; ids?: string[] };
      }[] = [];
      await new Promise((r) => ws.on('open', r));
      ws.on('message', (d) => got.push(JSON.parse(d.toString())));
      ws.send(JSON.stringify({ type: 'subscribe', channels: ['sound'] }));
      await new Promise((r) => setTimeout(r, 50));
      return { ws, got };
    };
    return { base, port, json, upload, listen };
  };

  const wait = (ms = 80) => new Promise((r) => setTimeout(r, ms));

  it('adds a sound, serves it, and rejects non-audio, empty and oversize files', async () => {
    const { upload, base } = await boot();
    const ok = await upload({ title: 'Big Cheer', includeInLoop: 'true', volume: '0.6' }, tone());
    expect(ok.status).toBe(200);
    const slot = (await ok.json()) as {
      id: string;
      file: string;
      includeInLoop: boolean;
      volume: number;
    };
    expect(slot).toMatchObject({ id: 'big-cheer', includeInLoop: true, volume: 0.6 });
    const file = await fetch(`${base}/assets/${slot.file}`);
    expect(file.status).toBe(200);

    expect((await upload({ title: 'Not audio' }, Buffer.from('<html></html>'))).status).toBe(400);
    expect((await upload({ title: 'Empty' }, Buffer.alloc(0))).status).toBe(400);
    expect(
      (await upload({ title: 'Huge' }, Buffer.concat([tone(), Buffer.alloc(11 * 1024 * 1024)])))
        .status,
    ).toBe(413);
  });

  it('caps the rack at ten and reports capacity', async () => {
    const { upload, json } = await boot();
    for (let i = 1; i <= 10; i++) {
      expect((await upload({ title: `Track ${i}` }, tone())).status).toBe(200);
    }
    const eleventh = await upload({ title: 'Track 11' }, tone());
    expect(eleventh.status).toBe(409);
    const list = (await (await json('GET', '/api/sounds')).json()) as {
      slots: unknown[];
      max: number;
    };
    expect(list.slots).toHaveLength(10);
    expect(list.max).toBe(10);
  });

  it('installs the three sample sounds once', async () => {
    const { json } = await boot();
    const first = (await (await json('POST', '/api/sounds/samples')).json()) as {
      added: unknown[];
      slots: unknown[];
    };
    expect(first.added).toHaveLength(3);
    const again = (await (await json('POST', '/api/sounds/samples')).json()) as {
      added: unknown[];
      slots: unknown[];
    };
    expect(again.added).toHaveLength(0);
    expect(again.slots).toHaveLength(3);
  });

  it('plays instantly and controls the loop, only looping flagged slots', async () => {
    const { upload, json, listen } = await boot();
    const { ws, got } = await listen();
    await upload({ title: 'Crowd', includeInLoop: 'true' }, tone());
    await upload({ title: 'Horn' }, tone());

    expect((await json('POST', '/api/sound/play/horn')).status).toBe(200);
    expect((await json('POST', '/api/sound/play/nope')).status).toBe(404);
    await wait();
    expect(got.some((m) => m.payload?.action === 'play' && m.payload.id === 'horn')).toBe(true);

    const start = await json('POST', '/api/sound/loop/start');
    expect(((await start.json()) as { loopRunning: boolean }).loopRunning).toBe(true);
    await wait();
    expect(got.find((m) => m.payload?.action === 'loop-start')!.payload!.ids).toEqual(['crowd']);

    await json('POST', '/api/sound/stop-all');
    await wait();
    expect(got.some((m) => m.payload?.action === 'stop-all')).toBe(true);
    const list = (await (await json('GET', '/api/sounds')).json()) as { loopRunning: boolean };
    expect(list.loopRunning).toBe(false);
    ws.close();
  });

  it('refuses to start a loop when nothing is flagged', async () => {
    const { upload, json } = await boot();
    await upload({ title: 'Horn' }, tone());
    const res = await json('POST', '/api/sound/loop/start');
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/Include in loop/);
  });

  it('sets and persists the master volume', async () => {
    const { json } = await boot();
    const res = await json('PUT', '/api/sound/master-volume', { volume: 0.35 });
    expect(((await res.json()) as { master: number }).master).toBe(0.35);
    expect((await json('PUT', '/api/sound/master-volume', { volume: 2 })).status).toBe(400);
    const s = (await (await json('GET', '/api/settings')).json()) as {
      sounds: { masterVolume: number };
    };
    expect(s.sounds.masterVolume).toBe(0.35);
  });

  it('maps automatic sounds, validates slot ids and clears a mapping on delete', async () => {
    const { upload, json } = await boot();
    await upload({ title: 'Four Cheer' }, tone());
    const bad = await json('PUT', '/api/sound/auto', { four: 'nope' });
    expect(bad.status).toBe(400);
    const ok = await json('PUT', '/api/sound/auto', { four: 'four-cheer' });
    expect(((await ok.json()) as { auto: { four: string } }).auto.four).toBe('four-cheer');

    const del = await json('DELETE', '/api/sounds/four-cheer');
    expect(((await del.json()) as { auto: { four: string | null } }).auto.four).toBeNull();
  });

  it('plays the mapped sound when a FOUR is detected', async () => {
    const { upload, json, listen, base } = await boot();
    const { ws, got } = await listen();
    await upload({ title: 'Four Cheer' }, tone());
    await json('PUT', '/api/sound/auto', { four: 'four-cheer' });

    const names = (p: string) => Array.from({ length: 11 }, (_, i) => `${p} Player ${i + 1}`);
    const created = await json('POST', '/api/manual/matches', {
      format: 'T20',
      teams: [
        { name: 'Reds', players: names('Reds') },
        { name: 'Blues', players: names('Blues') },
      ],
    });
    const m = (await created.json()) as { id: string };
    const c = (type: string, body: unknown) => json('POST', `/api/manual/${m.id}/${type}`, body);
    await c('set-batter', { slot: 'striker', playerId: 'reds-player-1' });
    await c('set-batter', { slot: 'nonStriker', playerId: 'reds-player-2' });
    await c('set-bowler', { playerId: 'blues-player-11' });
    await c('ball', { runs: 1 });
    await c('ball', { runs: 4 });
    await wait(150);
    expect(got.some((x) => x.payload?.action === 'play' && x.payload.id === 'four-cheer')).toBe(
      true,
    );
    void base;
    ws.close();
  });
});

describe('CommentaryService language & AI narration', () => {
  const ev = (type: string): EngineEvent =>
    ({ id: 'e1', matchId: 'm1', type, at: '2026-01-01T00:00:00.000Z', payload: {} }) as EngineEvent;

  it('writes Hindi by default and Urdu when configured', () => {
    const c = new CommentaryService();
    const hi = c.onEvent(ev('FOUR'), fixtures.t20);
    expect(hi?.text).toMatch(/[ऀ-ॿ]/);
    expect(hi?.lang).toBe('hi');

    c.updateConfig({ language: 'ur' });
    const ur = c.onEvent(ev('FOUR'), fixtures.t20);
    expect(ur?.text).toMatch(/[؀-ۿ]/);
    expect(ur?.lang).toBe('ur');
  });

  it('uses the model line when it answers', async () => {
    const c = new CommentaryService();
    c.setGenerator(async () => 'मॉडल की लाइन — यह असली टिप्पणी है।');
    const item = await c.onEventAsync(ev('SIX'), fixtures.t20);
    expect(item?.text).toBe('मॉडल की लाइन — यह असली टिप्पणी है।');
  });

  it('keeps the phrasebook line when the model fails, so the voice is never silent', async () => {
    const c = new CommentaryService();
    c.setGenerator(async () => {
      throw new Error('offline');
    });
    const item = await c.onEventAsync(ev('SIX'), fixtures.t20);
    expect(item?.text).toMatch(/[ऀ-ॿ]/);
    expect(item?.text.length).toBeGreaterThan(8);
  });

  it('does not claim AI narration without a key', () => {
    const c = new CommentaryService();
    c.setGenerator(async () => 'x');
    expect(c.aiActive).toBe(true);
    c.setGenerator(async () => 'x', () => false);
    expect(c.aiActive).toBe(false);
    c.updateConfig({ ai: false });
    expect(c.aiActive).toBe(false);
  });

  it('ignores the model when AI is switched off', async () => {
    const c = new CommentaryService({ ai: false });
    const gen = vi.fn(async () => 'should not be used');
    c.setGenerator(gen);
    const item = await c.onEventAsync(ev('FOUR'), fixtures.t20);
    expect(gen).not.toHaveBeenCalled();
    expect(item?.text).not.toBe('should not be used');
  });

  it('fills the gaps between events with a ball line, and never repeats one', async () => {
    let t = 10_000; // past the minimum gap from the service's zeroed clock
    const c = new CommentaryService({}, () => t);
    const first = await c.onBallAsync(fixtures.t20);
    expect(first?.text).toMatch(/[ऀ-ॿ]/);
    expect(await c.onBallAsync(fixtures.t20)).toBeNull(); // same delivery, no repeat
    t += 10_000;
    const moved = { ...fixtures.t20, score: { runs: 105, wkts: 2, overs: 12, balls: 1 } };
    expect((await c.onBallAsync(moved))?.text).toBeTruthy();
  });
});
