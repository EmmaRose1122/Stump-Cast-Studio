// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  buildHistory,
  deriveStats,
  fixtures,
  graphiteTeal,
  type MatchHistory,
  type MatchState,
} from '@stumpcast/shared';
import { CardManager, CardView } from './cards/CardManager';
import { CARD_DEFS, getCardDef } from './cards/defs';
import { mountGallery, sampleHistory } from './cards/gallery';

const t20 = deriveStats(fixtures.t20);
const test = deriveStats(fixtures.test);
const result = deriveStats(fixtures.result);

const textOf = (def: string, s: MatchState, history?: MatchHistory) => {
  const nodes = getCardDef(def)!.render(s, { history });
  return nodes.map((n) => n.textContent).join(' | ');
};

describe('card definitions', () => {
  it('has unique ids covering the director defaults', () => {
    const ids = CARD_DEFS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of [
      'manhattan',
      'bowler-spell',
      'striker-profile',
      'milestone',
      'full-scorecard',
    ]) {
      expect(ids).toContain(id);
    }
  });

  it.each(CARD_DEFS.map((c) => [c.id] as const))(
    '%s renders for every fixture without NaN',
    (id) => {
      for (const s of [t20, test, result]) {
        const out = textOf(id, s, sampleHistory(s));
        expect(out).not.toMatch(/NaN|Infinity|undefined/);
      }
    },
  );

  it('striker profile shows strike rate and the next milestone', () => {
    const out = textOf('striker-profile', t20);
    expect(out).toContain('Aiden Markram');
    expect(out).toContain('146.4'); // 41 off 28
    expect(out).toContain('9 to reach 50');
  });

  it('bowler spell shows figures and economy', () => {
    const out = textOf('bowler-spell', t20);
    expect(out).toContain('Shaheen Afridi');
    expect(out).toContain('8.40'); // 21 off 2.5 overs
  });

  it('chase gauge handles a chase, a non-chase and a finished chase', () => {
    const chase = deriveStats({
      ...fixtures.t20,
      currentInnings: 2,
      target: 160,
      innings: [fixtures.t20.innings[0]!, fixtures.t20.innings[0]!],
      score: { runs: 100, wkts: 3, overs: 12, balls: 0 },
    });
    expect(textOf('chase-gauge', chase)).toContain('60');
    expect(textOf('chase-gauge', chase)).toContain('Target 160');
    expect(textOf('chase-gauge', t20)).toContain('Projected');
    expect(textOf('chase-gauge', result)).toContain('Target reached');
  });

  it('win probability explains itself and hides for Tests', () => {
    expect(textOf('win-probability', t20)).toMatch(/\d+%/);
    expect(textOf('win-probability', test)).toContain('No win-probability estimate');
  });

  it('wagon wheel is honest about missing shot data', () => {
    expect(textOf('wagon-wheel', t20)).toContain('not available');
  });

  it('never renders player names as HTML', () => {
    const evil = {
      ...t20,
      batters: [{ ...t20.batters[0], name: '<img src=x onerror=alert(1)>' }, t20.batters[1]],
    } as MatchState;
    const nodes = getCardDef('striker-profile')!.render(evil, {});
    const host = document.createElement('div');
    host.append(...nodes);
    expect(host.querySelector('img')).toBeNull();
    expect(host.textContent).toContain('<img src=x');
  });

  it('shows empty states before data exists', () => {
    const blank = deriveStats({
      ...fixtures.t20,
      batters: [
        { ...fixtures.t20.batters[0], name: '—' },
        { ...fixtures.t20.batters[1], name: '—' },
      ],
    });
    expect(textOf('striker-profile', blank)).toContain('Waiting for the batters');
    expect(textOf('manhattan', t20)).toContain('once an over is complete');
  });
});

describe('analytic charts', () => {
  it('manhattan draws a bar per over with wicket markers', () => {
    const view = new CardView(getCardDef('manhattan')!);
    const stage = document.createElement('div');
    view.mount(stage, graphiteTeal);
    view.history = sampleHistory(t20);
    view.update(t20);
    expect(stage.querySelectorAll('.cd-rect')).toHaveLength(11);
    expect(stage.querySelectorAll('.cd-wicket').length).toBeGreaterThan(0);
  });

  it('worm draws a line per innings', () => {
    const out = getCardDef('worm')!.render(t20, { history: sampleHistory(t20) });
    const host = document.createElement('div');
    host.append(...out);
    expect(host.querySelectorAll('path.cd-line')).toHaveLength(2);
  });

  it('fall of wickets lists each wicket', () => {
    const out = textOf('fall-of-wickets', t20, sampleHistory(t20));
    expect(out).toContain('23-1');
    expect(out).toContain('57-2');
  });
});

describe('history builder', () => {
  const at = (runs: number, wkts: number, overs: number, balls: number, names: [string, string]) =>
    ({
      ...fixtures.t20,
      currentInnings: 1,
      score: { runs, wkts, overs, balls },
      batters: [
        { ...fixtures.t20.batters[0], name: names[0] },
        { ...fixtures.t20.batters[1], name: names[1] },
      ],
    }) as MatchState;

  it('derives runs per over and fall of wickets from snapshots', () => {
    const h = buildHistory('m', [
      at(0, 0, 0, 0, ['A', 'B']),
      at(8, 0, 1, 0, ['A', 'B']),
      at(9, 1, 1, 1, ['C', 'B']),
      at(20, 1, 2, 0, ['C', 'B']),
    ]);
    const inn = h.innings[0]!;
    expect(inn.overs.map((o) => o.runs)).toEqual([8, 12]);
    expect(inn.overs.map((o) => o.wkts)).toEqual([0, 1]);
    expect(inn.cumulative).toEqual([8, 20]);
    expect(inn.fow).toEqual([{ wkts: 1, runs: 9, overs: 1, balls: 1, out: 'A' }]);
  });

  it('flags an over reconstructed from a gap', () => {
    const h = buildHistory('m', [at(8, 0, 1, 0, ['A', 'B']), at(30, 0, 3, 0, ['A', 'B'])]);
    const inn = h.innings[0]!;
    expect(inn.overs.map((o) => o.over)).toEqual([1, 3]);
    expect(inn.overs[1]).toMatchObject({ runs: 22, approximate: true });
  });
});

describe('CardManager', () => {
  const setup = (fetchHistory?: (id: string) => Promise<MatchHistory | undefined>) => {
    const zone = document.createElement('div');
    const timers: { fn: () => void; ms: number; id: number }[] = [];
    let id = 1;
    const m = new CardManager(zone, graphiteTeal, CARD_DEFS, {
      fetchHistory,
      setTimer: (fn, ms) => {
        timers.push({ fn, ms, id: id++ });
        return id - 1;
      },
      clearTimer: (x) => {
        const i = timers.findIndex((t) => t.id === x);
        if (i >= 0) timers.splice(i, 1);
      },
    });
    return { m, zone, timers };
  };

  it('shows a card, replaces it, and hides on null', () => {
    const { m } = setup();
    m.updateMatch(t20);
    m.apply({ cardId: 'bowler-spell', durationSec: 8, source: 'director' });
    expect(m.activeId).toBe('bowler-spell');
    m.apply({ cardId: 'partnership', durationSec: 8, source: 'operator' });
    expect(m.activeId).toBe('partnership');
    m.apply(null);
    expect(m.activeId).toBeNull();
  });

  it('ignores unknown card ids and keeps what is on air, including its hide timer', () => {
    const { m, timers } = setup();
    m.updateMatch(t20);
    m.apply({ cardId: 'partnership', durationSec: 8, source: 'director' });
    m.apply({ cardId: 'does-not-exist', durationSec: 8, source: 'director' });
    expect(m.activeId).toBe('partnership');
    // The bail-out must not strand the card: the timer armed before it is still live.
    expect(timers).toHaveLength(1);
    timers[0]!.fn();
    expect(m.activeId).toBeNull();
  });

  it('swallows a history fetch that rejects', async () => {
    const { m } = setup(async () => {
      throw new Error('boom');
    });
    m.updateMatch(t20);
    m.apply({ cardId: 'manhattan', durationSec: 8, source: 'director' });
    await Promise.resolve();
    await Promise.resolve();
    expect(m.activeId).toBe('manhattan');
  });

  it('follows the score while on air', () => {
    const { m, zone } = setup();
    m.updateMatch(t20);
    m.apply({ cardId: 'bowler-spell', durationSec: 0, source: 'operator' });
    const before = zone.querySelector('[data-card="bowler-spell"]')!.textContent;
    m.updateMatch({ ...t20, bowler: { ...t20.bowler, wkts: 3 } });
    expect(zone.querySelector('[data-card="bowler-spell"]')!.textContent).not.toBe(before);
  });

  it('has a safety timer so a lost hide cannot strand a card', () => {
    const { m, timers } = setup();
    m.updateMatch(t20);
    m.apply({ cardId: 'partnership', durationSec: 8, source: 'director' });
    expect(timers).toHaveLength(1);
    expect(timers[0]!.ms).toBe(11_000);
    timers[0]!.fn();
    expect(m.activeId).toBeNull();
  });

  it('a sticky card (0 s) has no timer', () => {
    const { m, timers } = setup();
    m.updateMatch(t20);
    m.apply({ cardId: 'partnership', durationSec: 0, source: 'operator' });
    expect(timers).toHaveLength(0);
  });

  it('fetches history for analytic cards and redraws', async () => {
    const fetchHistory = vi.fn(async () => sampleHistory(t20));
    const { m, zone } = setup(fetchHistory);
    m.updateMatch(t20);
    m.apply({ cardId: 'manhattan', durationSec: 8, source: 'director' });
    expect(fetchHistory).toHaveBeenCalledWith(t20.id);
    await Promise.resolve();
    await Promise.resolve();
    expect(zone.querySelectorAll('.cd-rect').length).toBeGreaterThan(0);
  });
});

describe('gallery', () => {
  it('renders every card for every fixture, including long names', () => {
    const host = document.createElement('div');
    mountGallery(host, graphiteTeal);
    expect(host.querySelectorAll('.c-card')).toHaveLength(CARD_DEFS.length * 4);
    expect(host.textContent).toContain('Abdullah Ahmadzai Khan Mohammadzai');
  });
});
