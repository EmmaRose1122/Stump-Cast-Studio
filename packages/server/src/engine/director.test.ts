import { describe, expect, it } from 'vitest';
import {
  createMatchState,
  createSettings,
  type CardCommand,
  type EngineEvent,
} from '@stumpcast/shared';
import type { Scheduler } from './DelayBuffer';
import { ANIMATION_LOCK_MS, Director, QUEUE_TTL_MS } from './Director';

const clock = () => {
  let t = 10_000_000;
  let id = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const sched: Scheduler = {
    now: () => t,
    setTimeout: (fn, ms) => {
      const k = id++;
      timers.set(k, { at: t + ms, fn });
      return k;
    },
    clearTimeout: (k) => void timers.delete(k as number),
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
  return { sched, advance };
};

const ev = (type: EngineEvent['type'], id = `${type}-${Math.random()}`): EngineEvent => ({
  id,
  matchId: 'm1',
  type,
  at: '2026-01-01T00:00:00.000Z',
  payload: {},
});

const setup = (mode: 'smart' | 'carousel' | 'manual', patch: Record<string, unknown> = {}) => {
  const c = clock();
  const cmds: CardCommand[] = [];
  const cfg = createSettings({ director: { mode, ...patch } }).director;
  const d = new Director((cmd) => cmds.push(cmd), cfg, c.sched);
  const shows = () => cmds.flatMap((x) => (x.action === 'show' ? [`${x.source}:${x.cardId}`] : []));
  return { c, d, cmds, shows };
};

describe('Director: manual and operator', () => {
  it('does nothing automatically in manual mode', () => {
    const { d, shows } = setup('manual');
    d.onEvent(ev('OVER_END'));
    d.onEvent(ev('WICKET'));
    expect(shows()).toEqual([]);
  });

  it('operator show works in any mode and hides after its duration', () => {
    const { d, c, cmds } = setup('manual');
    d.show('full-scorecard', 5);
    expect(cmds[0]).toMatchObject({ action: 'show', cardId: 'full-scorecard', source: 'operator' });
    c.advance(4999);
    expect(cmds).toHaveLength(1);
    c.advance(1);
    expect(cmds[1]).toEqual({ action: 'hide', cardId: 'full-scorecard' });
  });

  it('a sticky card (0 s) stays until hidden', () => {
    const { d, c, cmds } = setup('manual');
    d.show('partnership', 0);
    c.advance(120_000);
    expect(cmds).toHaveLength(1);
    d.hide();
    expect(cmds[1]).toMatchObject({ action: 'hide', cardId: 'partnership' });
  });
});

describe('Director: smart mode', () => {
  it('shows the rule card for an event and removes it after its duration', () => {
    const { d, c, cmds, shows } = setup('smart');
    d.onEvent(ev('OVER_END'));
    expect(shows()).toEqual(['director:manhattan']);
    c.advance(8000);
    expect(cmds.at(-1)).toEqual({ action: 'hide', cardId: 'manhattan' });
  });

  it('never starts a card during a boundary animation, then shows it when the lock ends', () => {
    const { d, c, shows } = setup('smart');
    d.onEvent(ev('WICKET'));
    // The WICKET rule itself must wait for the banner.
    expect(shows()).toEqual([]);
    c.advance(ANIMATION_LOCK_MS.WICKET - 1);
    expect(shows()).toEqual([]);
    c.advance(10);
    expect(shows()).toEqual(['director:bowler-spell']);
  });

  it('queues cards that arrive during a lock and plays the highest priority first', () => {
    const { d, c, shows } = setup('smart');
    d.onEvent(ev('SIX')); // lock, no six rule
    d.onEvent(ev('OVER_END')); // priority 1
    d.onEvent(ev('MILESTONE')); // priority 4
    expect(shows()).toEqual([]);
    c.advance(ANIMATION_LOCK_MS.SIX + 50);
    expect(shows()[0]).toBe('director:milestone');
    c.advance(8000); // milestone ends, manhattan follows
    expect(shows()).toEqual(['director:milestone', 'director:manhattan']);
  });

  it('respects the cooldown per rule', () => {
    const { d, c, shows } = setup('smart');
    d.onEvent(ev('OVER_END'));
    c.advance(9000);
    d.onEvent(ev('OVER_END')); // 9 s later: inside the 30 s cooldown
    expect(shows()).toEqual(['director:manhattan']);
    c.advance(25_000);
    d.onEvent(ev('OVER_END'));
    expect(shows()).toHaveLength(2);
  });

  it('a higher-priority card replaces a lower one on air', () => {
    const { d, shows } = setup('smart');
    d.onEvent(ev('OVER_END')); // manhattan, priority 1, on air
    d.onEvent(ev('MILESTONE')); // priority 4 takes over
    expect(shows()).toEqual(['director:manhattan', 'director:milestone']);
  });

  it('a lower-priority card waits for the one on air', () => {
    const { d, c, shows } = setup('smart');
    d.onEvent(ev('INNINGS_END')); // priority 5, 12 s
    d.onEvent(ev('OVER_END')); // priority 1 must wait
    expect(shows()).toEqual(['director:full-scorecard']);
    c.advance(12_500);
    expect(shows()).toEqual(['director:full-scorecard', 'director:manhattan']);
  });

  it('drops queued cards that went stale', () => {
    const { d, c, shows } = setup('smart');
    d.show('full-scorecard', 0); // sticky operator card blocks the director
    d.onEvent(ev('OVER_END'));
    c.advance(QUEUE_TTL_MS + 1000);
    d.hide();
    c.advance(1000);
    expect(shows()).toEqual(['operator:full-scorecard']);
  });

  it('never overrides an operator card', () => {
    const { d, shows } = setup('smart');
    d.show('worm', 20);
    d.onEvent(ev('MILESTONE'));
    expect(shows()).toEqual(['operator:worm']);
  });

  it('fires striker-profile when a batter reaches 40 and 90, not on first sight', () => {
    const { d, shows } = setup('smart');
    const mk = (runs: number) =>
      createMatchState({
        id: 'm1',
        currentInnings: 1,
        batters: [
          { playerId: 'a', name: 'A', runs, balls: 30, fours: 0, sixes: 0, onStrike: true },
          { playerId: 'b', name: 'B', runs: 5, balls: 8, fours: 0, sixes: 0, onStrike: false },
        ],
      });
    d.onState(mk(41)); // baseline only
    expect(shows()).toEqual([]);
    d.onState(mk(38));
    d.onState(mk(42));
    expect(shows()).toEqual(['director:striker-profile']);
  });

  it('fires the new-batter and milestone rules', () => {
    const { d, shows } = setup('smart');
    d.onEvent(ev('NEW_BATTER'));
    expect(shows()).toEqual(['director:striker-profile']);
  });
});

describe('Director: mode switching and carousel', () => {
  it('switching to manual mid-card lets it finish and clears the queue', () => {
    const { d, c, cmds, shows } = setup('smart');
    d.onEvent(ev('INNINGS_END')); // on air
    d.onEvent(ev('OVER_END')); // queued
    d.setConfig(createSettings({ director: { mode: 'manual' } }).director);
    c.advance(11_000);
    expect(cmds.at(-1)).toMatchObject({ action: 'show', cardId: 'full-scorecard' }); // still up
    c.advance(1500);
    expect(cmds.at(-1)).toEqual({ action: 'hide', cardId: 'full-scorecard' });
    expect(shows()).toEqual(['director:full-scorecard']); // queued manhattan was dropped
  });

  it('carousel cycles the chosen cards on its interval', () => {
    const { c, shows } = setup('carousel', {
      carousel: { cards: ['manhattan', 'worm'], intervalSec: 10 },
    });
    c.advance(10_000);
    c.advance(10_000);
    c.advance(10_000);
    expect(shows()).toEqual(['director:manhattan', 'director:worm', 'director:manhattan']);
  });

  it('carousel pauses while a banner animates and stops when switched to manual', () => {
    const { d, c, shows } = setup('carousel', {
      carousel: { cards: ['manhattan'], intervalSec: 10 },
    });
    c.advance(9000);
    d.onEvent(ev('FOUR')); // locks for 2.3 s, over the carousel tick at 10 s
    c.advance(1500);
    expect(shows()).toEqual([]);
    c.advance(10_000);
    expect(shows().length).toBe(1);
    d.setConfig(createSettings({ director: { mode: 'manual' } }).director);
    c.advance(60_000);
    expect(shows().length).toBe(1);
  });

  it('reports state for the admin', () => {
    const { d } = setup('smart');
    d.onEvent(ev('INNINGS_END'));
    d.onEvent(ev('OVER_END'));
    expect(d.state).toMatchObject({
      mode: 'smart',
      onAir: { cardId: 'full-scorecard' },
      queued: ['manhattan'],
    });
  });
});
