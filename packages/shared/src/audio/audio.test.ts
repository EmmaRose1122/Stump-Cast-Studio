import { describe, expect, it } from 'vitest';
import {
  AudioEngine,
  STOP_FADE_SEC,
  type AudioContextLike,
  type GainNodeLike,
  type SourceLike,
} from './AudioEngine';

const makeContext = (state: AudioContextLike['state'] = 'running') => {
  const sources: (SourceLike & { started: number; stopped: number[] })[] = [];
  const gains: GainNodeLike[] = [];
  const ramps: { v: number; t: number }[] = [];
  let time = 10;
  const ctx: AudioContextLike & { sink?: string } = {
    get currentTime() {
      return time;
    },
    state,
    destination: {},
    resume: async () => {
      (ctx as { state: string }).state = 'running';
    },
    createGain: () => {
      const g: GainNodeLike = {
        gain: {
          value: 1,
          setValueAtTime: (v) => void (g.gain.value = v),
          linearRampToValueAtTime: (v, t) => void ramps.push({ v, t }),
        },
        connect: () => undefined,
        disconnect: () => undefined,
      };
      gains.push(g);
      return g;
    },
    createBufferSource: () => {
      const s = {
        buffer: null,
        loop: false,
        started: 0,
        stopped: [] as number[],
        onended: null as (() => void) | null,
        connect: () => undefined,
        disconnect: () => undefined,
        start() {
          this.started++;
        },
        stop(when?: number) {
          this.stopped.push(when ?? 0);
        },
      };
      sources.push(s);
      return s;
    },
    createDynamicsCompressor: () => ({
      threshold: { value: 0 },
      knee: { value: 0 },
      ratio: { value: 0 },
      attack: { value: 0 },
      release: { value: 0 },
      connect: () => undefined,
    }),
    decodeAudioData: async (b) => ({ decoded: (b as ArrayBuffer).byteLength }),
    setSinkId: async (id) => {
      ctx.sink = id;
    },
  };
  return { ctx, sources, gains, ramps, advance: (s: number) => (time += s) };
};

const engineWith = async (n = 3, state: AudioContextLike['state'] = 'running') => {
  const env = makeContext(state);
  const engine = new AudioEngine({
    createContext: () => env.ctx,
    fetchBytes: async (url) => {
      if (url.includes('broken')) throw new Error('404');
      return new ArrayBuffer(8);
    },
  });
  const ids = Array.from({ length: n }, (_, i) => `s${i + 1}`);
  await engine.preload(ids.map((id) => ({ id, url: `/assets/sounds/${id}.wav`, volume: 0.5 })));
  return { engine, env, ids };
};

describe('AudioEngine', () => {
  it('preloads, reports failures without blocking the rest', async () => {
    const env = makeContext();
    const engine = new AudioEngine({
      createContext: () => env.ctx,
      fetchBytes: async (url) => {
        if (url.includes('broken')) throw new Error('404');
        return new ArrayBuffer(4);
      },
    });
    const r = await engine.preload([
      { id: 'ok', url: '/a.wav' },
      { id: 'bad', url: '/broken.wav' },
    ]);
    expect(r).toEqual({ loaded: ['ok'], failed: ['bad'] });
    expect(engine.play('bad')).toBe(false);
    expect(engine.play('ok')).toBe(true);
  });

  it('plays one-shots through a per-slot gain', async () => {
    const { engine, env } = await engineWith();
    expect(engine.play('s1')).toBe(true);
    expect(env.sources).toHaveLength(1);
    expect(env.sources[0]!.started).toBe(1);
    expect(env.sources[0]!.loop).toBe(false);
    expect(engine.play('missing')).toBe(false);
  });

  it('loops several tracks at once and replaces the previous loop', async () => {
    const { engine, env } = await engineWith(4);
    expect(engine.startLoop(['s1', 's2', 's3'])).toBe(3);
    expect(env.sources.filter((s) => s.loop)).toHaveLength(3);
    engine.startLoop(['s4']);
    expect(engine.loopCount).toBe(1);
    expect(env.sources.filter((s) => s.stopped.length > 0)).toHaveLength(3);
  });

  it('never runs more than ten loop tracks', async () => {
    const { engine } = await engineWith(12);
    const ids = Array.from({ length: 12 }, (_, i) => `s${i + 1}`);
    expect(engine.startLoop(ids)).toBe(10);
  });

  it('stop-all fades quickly, stops everything and restores the master level', async () => {
    const { engine, env } = await engineWith(3);
    engine.setMaster(0.7);
    engine.startLoop(['s1', 's2']);
    engine.play('s3');
    env.ramps.length = 0;
    engine.stopAll();
    expect(env.ramps[0]).toEqual({ v: 0, t: 10 + STOP_FADE_SEC });
    expect(STOP_FADE_SEC).toBeLessThanOrEqual(0.1); // well inside the 100 ms requirement
    expect(engine.loopCount).toBe(0);
    expect(env.sources.every((s) => s.stopped.length > 0)).toBe(true);
    // The level is back for the next sound (scheduled just after the fade).
    expect(engine.masterLevel).toBe(0.7);
  });

  it('clamps the master volume', async () => {
    const { engine } = await engineWith();
    engine.setMaster(4);
    expect(engine.masterLevel).toBe(1);
    engine.setMaster(-1);
    expect(engine.masterLevel).toBe(0);
  });

  it('handles channel commands', async () => {
    const { engine, env } = await engineWith(3);
    engine.handle({ action: 'play', id: 's1' });
    engine.handle({ action: 'loop-start', ids: ['s2', 's3'] });
    expect(engine.loopCount).toBe(2);
    engine.handle({ action: 'loop-stop' });
    expect(engine.loopCount).toBe(0);
    engine.handle({ action: 'master', volume: 0.3 });
    expect(engine.masterLevel).toBe(0.3);
    engine.handle({ action: 'stop-all' });
    expect(env.sources.length).toBeGreaterThan(0);
  });

  it('reports a suspended context and unlocks it on a gesture', async () => {
    const { engine } = await engineWith(1, 'suspended');
    expect(engine.needsUnlock).toBe(true);
    await engine.unlock();
    expect(engine.needsUnlock).toBe(false);
  });

  it('routes to an output device when the browser supports it', async () => {
    const { engine, env } = await engineWith(1);
    expect(await engine.setSink('headphones')).toBe(true);
    expect(env.ctx.sink).toBe('headphones');
  });

  it('drops buffers for slots that were deleted on the next preload', async () => {
    const { engine } = await engineWith(3);
    await engine.preload([{ id: 's1', url: '/a.wav' }]);
    expect(engine.loaded).toEqual(['s1']);
  });
});
