// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { AudioEngine, type AudioContextLike } from '@stumpcast/shared';
import { OverlayAudio, type SoundOverview } from './audio';

const fakeEngine = () => {
  const log: string[] = [];
  const ctx: AudioContextLike = {
    currentTime: 0,
    state: 'running',
    destination: {},
    resume: async () => undefined,
    createGain: () => ({
      gain: {
        value: 1,
        setValueAtTime: () => undefined,
        linearRampToValueAtTime: () => undefined,
      },
      connect: () => undefined,
      disconnect: () => undefined,
    }),
    createBufferSource: () => ({
      buffer: null,
      loop: false,
      connect: () => undefined,
      disconnect: () => undefined,
      start() {
        log.push(this.loop ? 'loop' : 'shot');
      },
      stop: () => undefined,
      onended: null,
    }),
    createDynamicsCompressor: () => ({
      threshold: { value: 0 },
      knee: { value: 0 },
      ratio: { value: 0 },
      attack: { value: 0 },
      release: { value: 0 },
      connect: () => undefined,
    }),
    decodeAudioData: async () => ({}),
  };
  const engine = new AudioEngine({
    createContext: () => ctx,
    fetchBytes: async () => new ArrayBuffer(4),
  });
  return { engine, log };
};

const overview = (over: Partial<SoundOverview> = {}): SoundOverview => ({
  slots: [
    { id: 'cheer', title: 'Cheer', file: 'sounds/cheer.wav', includeInLoop: true, volume: 1 },
    { id: 'horn', title: 'Horn', file: 'sounds/horn.wav', includeInLoop: false, volume: 1 },
  ],
  master: 0.5,
  loopRunning: false,
  ...over,
});

describe('OverlayAudio', () => {
  it('loads the library and plays a sound command', async () => {
    const { engine, log } = fakeEngine();
    const a = new OverlayAudio(engine, 'http://x', async () => overview());
    await a.sync();
    expect(engine.loaded.sort()).toEqual(['cheer', 'horn']);
    expect(engine.masterLevel).toBe(0.5);
    await a.handle({ action: 'play', id: 'horn' });
    expect(log).toEqual(['shot']);
  });

  it('restores a running loop after a reconnect', async () => {
    const { engine, log } = fakeEngine();
    const a = new OverlayAudio(engine, 'http://x', async () => overview({ loopRunning: true }));
    await a.sync();
    expect(log).toEqual(['loop']);
    expect(engine.loopCount).toBe(1);
  });

  it('stops a loop that the server says is no longer running', async () => {
    const { engine } = fakeEngine();
    let running = true;
    const a = new OverlayAudio(engine, 'http://x', async () => overview({ loopRunning: running }));
    await a.sync();
    expect(engine.loopCount).toBe(1);
    running = false;
    await a.sync();
    expect(engine.loopCount).toBe(0);
  });

  it('reloads on library-updated and ignores garbage payloads', async () => {
    const { engine } = fakeEngine();
    let slots = overview().slots;
    const a = new OverlayAudio(engine, 'http://x', async () => overview({ slots }));
    await a.sync();
    slots = [slots[0]!];
    await a.handle({ action: 'library-updated' });
    expect(engine.loaded).toEqual(['cheer']);
    await expect(a.handle({ action: 'explode' })).resolves.toBeUndefined();
    await expect(a.handle(null)).resolves.toBeUndefined();
  });

  it('survives an unreachable server', async () => {
    const { engine } = fakeEngine();
    const a = new OverlayAudio(engine, 'http://x', async () => undefined);
    await expect(a.sync()).resolves.toBeUndefined();
    expect(engine.loaded).toEqual([]);
  });
});
