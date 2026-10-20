import { describe, expect, it } from 'vitest';
import { DelayBuffer, type Scheduler } from './DelayBuffer';
import { Watchdog, type Alarm } from './Watchdog';

/** Deterministic clock + timers. */
const fakeClock = () => {
  let t = 1_000_000;
  let nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const sched: Scheduler = {
    now: () => t,
    setTimeout: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { at: t + ms, fn });
      return id;
    },
    clearTimeout: (id) => void timers.delete(id as number),
  };
  const advance = (ms: number) => {
    const end = t + ms;
    for (;;) {
      const due = [...timers.entries()]
        .filter(([, v]) => v.at <= end)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      t = due[1].at;
      timers.delete(due[0]);
      due[1].fn();
    }
    t = end;
  };
  return { sched, advance, timers: () => timers.size, now: () => t };
};

describe('DelayBuffer', () => {
  it('is a synchronous pass-through at 0 seconds', () => {
    const c = fakeClock();
    const out: number[] = [];
    const b = new DelayBuffer<number>((v) => out.push(v), 0, c.sched);
    b.push(1);
    b.push(2);
    expect(out).toEqual([1, 2]);
    expect(c.timers()).toBe(0);
  });

  it('releases in order after the delay', () => {
    const c = fakeClock();
    const out: number[] = [];
    const b = new DelayBuffer<number>((v) => out.push(v), 5, c.sched);
    b.push(1);
    c.advance(2000);
    b.push(2);
    c.advance(2999);
    expect(out).toEqual([]);
    c.advance(1);
    expect(out).toEqual([1]);
    c.advance(2000);
    expect(out).toEqual([1, 2]);
  });

  it('a shorter delay releases what is now due, in order, without loss', () => {
    const c = fakeClock();
    const out: number[] = [];
    const b = new DelayBuffer<number>((v) => out.push(v), 30, c.sched);
    b.push(1);
    c.advance(1000);
    b.push(2);
    c.advance(1000);
    b.push(3);
    b.setDelay(1); // 1 and 2 are older than 1 s; 3 is brand new
    expect(out).toEqual([1, 2]);
    c.advance(1000);
    expect(out).toEqual([1, 2, 3]);
  });

  it('a longer delay holds back entries that were already due', () => {
    const c = fakeClock();
    const out: number[] = [];
    const b = new DelayBuffer<number>((v) => out.push(v), 2, c.sched);
    b.push(1);
    c.advance(1500);
    b.setDelay(10);
    c.advance(5000);
    expect(out).toEqual([]);
    c.advance(3500);
    expect(out).toEqual([1]);
  });

  it('going back to 0 flushes the backlog in order, then passes through', () => {
    const c = fakeClock();
    const out: number[] = [];
    const b = new DelayBuffer<number>((v) => out.push(v), 20, c.sched);
    [1, 2, 3].forEach((n) => b.push(n));
    b.setDelay(0);
    expect(out).toEqual([1, 2, 3]);
    b.push(4);
    expect(out).toEqual([1, 2, 3, 4]);
    expect(c.timers()).toBe(0);
  });

  it('never reorders when 0 s follows a non-empty queue', () => {
    const c = fakeClock();
    const out: number[] = [];
    const b = new DelayBuffer<number>((v) => out.push(v), 10, c.sched);
    b.push(1);
    b.setDelay(0); // flushes 1
    b.push(2);
    expect(out).toEqual([1, 2]);
  });

  it('clamps to 0-60 and flush releases everything', () => {
    const c = fakeClock();
    const out: number[] = [];
    const b = new DelayBuffer<number>((v) => out.push(v), 999, c.sched);
    expect(b.delaySec).toBe(60);
    b.setDelay(-5);
    expect(b.delaySec).toBe(0);
    b.setDelay(30);
    b.push(1);
    b.push(2);
    b.flush();
    expect(out).toEqual([1, 2]);
    expect(b.size).toBe(0);
  });
});

describe('Watchdog', () => {
  const setup = (opts: { health?: 'connected' | 'down'; lastAgoSec?: number | null } = {}) => {
    const c = fakeClock();
    const state = {
      health: opts.health ?? 'connected',
      last: opts.lastAgoSec === null ? null : c.now() - (opts.lastAgoSec ?? 0) * 1000,
      obs: null as boolean | null,
    };
    const alarms: Alarm[] = [];
    const w = new Watchdog(
      {
        providerHealth: () => state.health as 'connected' | 'down',
        lastDataAt: () => state.last,
        obsConnected: () => state.obs,
      },
      (a) => alarms.push(a),
      { sched: c.sched },
    );
    return { c, state, alarms, w };
  };

  it('stays ok with fresh data and with no data ever seen', () => {
    const { w } = setup({ lastAgoSec: 1 });
    expect(w.check().level).toBe('ok');
    const none = setup({ lastAgoSec: null, health: 'down' });
    expect(none.w.check().level).toBe('ok'); // nothing expected yet
  });

  it('warns at the threshold, errors at twice it, and recovers', () => {
    const { w, c, state, alarms } = setup({ lastAgoSec: 0 });
    c.advance(31_000);
    expect(w.check()).toMatchObject({ level: 'warn', code: 'DATA_STALE' });
    c.advance(30_000);
    expect(w.check()).toMatchObject({ level: 'error', code: 'DATA_STALE' });
    state.last = c.now(); // fresh data arrives
    expect(w.check().level).toBe('ok');
    expect(alarms.map((a) => a.level)).toEqual(['warn', 'error', 'ok']);
  });

  it('reports a down provider as an error with an actionable message', () => {
    const { w } = setup({ lastAgoSec: 5, health: 'down' });
    const a = w.check();
    expect(a).toMatchObject({ level: 'error', code: 'PROVIDER_DOWN' });
    expect(a.message).toMatch(/extension/i);
  });

  it('does not repeat an unchanged alarm', () => {
    const { w, c, alarms } = setup({ lastAgoSec: 0 });
    c.advance(31_000);
    w.check();
    w.check();
    w.check();
    expect(alarms).toHaveLength(1);
  });

  it('mutes with an expiry but keeps reporting the condition', () => {
    const { w, c, alarms } = setup({ lastAgoSec: 0 });
    c.advance(31_000);
    w.check();
    w.mute(5);
    expect(w.alarm.muted).toBe(true);
    expect(w.alarm.level).toBe('warn');
    expect(alarms.at(-1)!.muted).toBe(true);
    c.advance(5 * 60_000 + 1);
    expect(w.alarm.muted).toBe(false);
  });

  it('flags a disconnected OBS and honours a custom threshold', () => {
    const { w, state, c } = setup({ lastAgoSec: 0 });
    state.obs = false;
    expect(w.check()).toMatchObject({ level: 'warn', code: 'OBS_DISCONNECTED' });
    state.obs = null;
    w.setStaleSec(10);
    c.advance(11_000);
    expect(w.check()).toMatchObject({ code: 'DATA_STALE', level: 'warn' });
  });

  it('a second start() replaces the first timer instead of stacking another chain', () => {
    const c = fakeClock();
    const w = new Watchdog(
      { providerHealth: () => 'connected', lastDataAt: () => c.now() },
      () => undefined,
      { sched: c.sched },
    );
    w.start(10_000);
    w.start(10_000); // settings applied twice at boot must not leave an orphan poller
    expect(c.timers()).toBe(1);
    c.advance(10_000);
    expect(c.timers()).toBe(1);
    w.stop();
    expect(c.timers()).toBe(0);
  });
});
