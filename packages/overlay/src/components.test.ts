// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  ALL_LOOKS,
  FREE_LOOKS,
  PRO_LOOKS,
  createBall,
  deriveStats,
  fixtures,
  graphiteTeal,
  OBS_LAYOUT_PRESETS,
  type EngineEvent,
} from '@stumpcast/shared';
import { BannerQueue, type BannerItem } from './bannerQueue';
import { ScoreBar } from './components/ScoreBar';
import { StatsTiles } from './components/StatsTiles';
import { ThisOver } from './components/ThisOver';
import { MatchCentre } from './components/MatchCentre';
import { ThisBall } from './components/ThisBall';
import { WinProb } from './components/WinProb';
import { Watermark } from './components/Watermark';
import { BatterCards, BowlerCard } from './components/PlayerCards';
import { ballChip, situationText } from './format';
import { applyLayout, createZones } from './layout';

const mount = <T extends { mount(stage: HTMLElement, look: typeof graphiteTeal): void }>(c: T) => {
  const stage = document.createElement('div');
  c.mount(stage, graphiteTeal);
  return stage;
};

const t20 = deriveStats(fixtures.t20);
const test = deriveStats(fixtures.test);
const result = deriveStats(fixtures.result);

describe('Looks', () => {
  it('has 8 valid looks: 2 free, 6 pro, unique ids', () => {
    expect(ALL_LOOKS).toHaveLength(8);
    expect(FREE_LOOKS).toHaveLength(2);
    expect(PRO_LOOKS).toHaveLength(6);
    expect(new Set(ALL_LOOKS.map((l) => l.id)).size).toBe(8);
  });

  it('each look differs in shape, entrance and boundary style', () => {
    for (const key of [
      (l: (typeof ALL_LOOKS)[number]) => l.tokens.scoreBarShape,
      (l: (typeof ALL_LOOKS)[number]) => l.motion.entrance,
      (l: (typeof ALL_LOOKS)[number]) => l.layoutVariant.boundaryStyle,
      (l: (typeof ALL_LOOKS)[number]) => l.tokens.colors.accent,
    ]) {
      expect(new Set(ALL_LOOKS.map(key)).size).toBe(8);
    }
    // Both score positions and both card styles are used.
    expect(new Set(ALL_LOOKS.map((l) => l.layoutVariant.scorePosition))).toEqual(
      new Set(['top', 'bottom']),
    );
    expect(new Set(ALL_LOOKS.map((l) => l.layoutVariant.playerCardStyle))).toEqual(
      new Set(['cutout', 'badge']),
    );
  });
});

describe('ScoreBar', () => {
  it('shows batting team, score, overs, situation and rates (first innings)', () => {
    const bar = new ScoreBar();
    const stage = mount(bar);
    bar.update(t20);
    const text = stage.textContent!;
    expect(text).toContain('RSA');
    expect(text).toContain('98-2');
    expect(text).toContain('11.3');
    expect(text).toContain('Projected 170');
    expect(text).toContain('CRR 8.52');
    expect(stage.querySelector('.sb-rrr')!.hasAttribute('hidden')).toBe(true);
  });

  it('shows need/target and RRR in a chase', () => {
    const chase = deriveStats({
      ...fixtures.t20,
      currentInnings: 2,
      target: 160,
      innings: [
        fixtures.t20.innings[0]!,
        {
          ...fixtures.t20.innings[0]!,
          number: 2,
          score: { runs: 100, wkts: 3, overs: 12, balls: 0 },
        },
      ],
      score: { runs: 100, wkts: 3, overs: 12, balls: 0 },
    });
    const bar = new ScoreBar();
    const stage = mount(bar);
    bar.update(chase);
    expect(stage.textContent).toContain('Need 60 off 48');
    expect(stage.textContent).toContain('RRR 7.50');
  });

  it('shows the result text for a finished match and no RRR', () => {
    const bar = new ScoreBar();
    const stage = mount(bar);
    bar.update(result);
    expect(stage.textContent).toContain('Pakistan won by 6 wickets');
    expect(stage.querySelector('.sb-rrr')!.hasAttribute('hidden')).toBe(true);
  });

  it('shows Test day, session and lead', () => {
    expect(situationText(test)).toBe('Day 4 · Afternoon · Lead by 264');
  });

  it('shows previous innings totals beside the corresponding team', () => {
    const batting = test.teams.find((team) => team.id === test.battingTeamId)!;
    const bowling = test.teams.find((team) => team.id !== batting.id)!;
    const state = {
      ...test,
      currentInnings: 4,
      innings: [
        { number: 1, battingTeamId: batting.id, score: { runs: 284, wkts: 10, overs: 90, balls: 0 }, declared: false, allOut: true },
        { number: 2, battingTeamId: bowling.id, score: { runs: 390, wkts: 10, overs: 120, balls: 0 }, declared: false, allOut: true },
        { number: 3, battingTeamId: bowling.id, score: { runs: 314, wkts: 6, overs: 80, balls: 0 }, declared: false, allOut: false },
        { number: 4, battingTeamId: batting.id, score: test.score, declared: false, allOut: false },
      ],
    };
    const bar = new ScoreBar();
    const stage = mount(bar);
    bar.update(state);
    expect(stage.querySelector('.sb-bat .sb-history')?.textContent).toBe('284-10');
    expect(stage.querySelector('.sb-bowl .sb-history')?.textContent).toBe('390-10 & 314-6');
  });
});

describe('ThisOver', () => {
  it('renders a chip per ball with kinds, and updates in place', () => {
    const c = new ThisOver();
    const stage = mount(c);
    c.update({
      ...t20,
      thisOver: [1, 0, 4, 6].map((r, i) => createBall({ ball: i + 1, runs: r })),
    });
    const kinds = [...stage.querySelectorAll('.to-ball')].map((e) => e.className);
    expect(kinds).toHaveLength(4);
    expect(kinds[1]).toContain('to-dot');
    expect(kinds[2]).toContain('to-four');
    expect(kinds[3]).toContain('to-six');
    expect(kinds[3]).toContain('to-latest');
  });

  it('maps wickets and extras', () => {
    expect(ballChip(createBall({ wicket: { kind: 'bowled', playerOutId: 'x' } }))).toEqual({
      label: 'W',
      kind: 'wicket',
    });
    expect(ballChip(createBall({ extras: { type: 'wide', runs: 1 } }))).toEqual({
      label: 'wd',
      kind: 'extra',
    });
    expect(ballChip(createBall({ extras: { type: 'noball', runs: 3 } })).label).toBe('3nb');
  });
});

describe('MatchCentre / ThisBall', () => {
  it('shows match context, toss, last six deliveries and current delivery outcome', () => {
    const centre = new MatchCentre();
    const centreStage = mount(centre);
    const state = {
      ...t20,
      toss: { winnerTeamId: t20.teams[0].id, decision: 'bat' as const },
      lastBalls: [createBall({ ball: 1, runs: 0 }), createBall({ ball: 2, runs: 4 })],
    };
    centre.update(state);
    expect(centreStage.textContent).toContain(t20.title);
    expect(centreStage.textContent).toContain(`${t20.teams[0].name} (bat)`);
    expect(centreStage.querySelectorAll('.mc-ball')).toHaveLength(2);
    expect(centreStage.querySelector('.mc-four')?.textContent).toBe('4');

    const ball = new ThisBall();
    const ballStage = mount(ball);
    ball.update(state);
    expect(ballStage.querySelector('.tb-value')?.textContent).toBe('4');
    expect(ballStage.querySelector('.tb-detail')?.textContent).toBe('FOUR');
    ball.update({ ...state, lastBalls: [createBall({ ball: 1, runs: 0, wicket: { kind: 'bowled', playerOutId: 'p1' } })] });
    expect(ballStage.querySelector('.tb-detail')?.textContent).toBe('WICKET');
  });
});

describe('StatsTiles / WinProb / PlayerCards / Watermark', () => {
  it('builds the right tiles', () => {
    expect(StatsTiles.tiles(t20).map((t) => t.label)).toEqual([
      'CRR',
      'PARTNERSHIP',
      'PROJECTED',
      'WICKETS LEFT',
    ]);
    expect(StatsTiles.tiles(test).some((t) => t.label === 'LEAD')).toBe(true);
    expect(StatsTiles.tiles(result).some((t) => t.label === 'TARGET')).toBe(true);
  });

  it('updates tiles in place', () => {
    const c = new StatsTiles();
    const stage = mount(c);
    c.update(t20);
    const first = stage.querySelector('.st-tile');
    c.update(deriveStats({ ...fixtures.t20, score: { ...fixtures.t20.score, runs: 120 } }));
    expect(stage.querySelector('.st-tile')).toBe(first);
  });

  it('shows win probability and hides it when there is no estimate', () => {
    const c = new WinProb();
    const stage = mount(c);
    c.update(t20);
    expect(stage.querySelector('.c-winprob')!.hasAttribute('hidden')).toBe(false);
    expect(stage.textContent).toMatch(/\d+%/);
    c.update(test);
    expect(stage.querySelector('.c-winprob')!.hasAttribute('hidden')).toBe(true);
  });

  it('renders batters with the striker marked, and the bowler figures', () => {
    const b = new BatterCards();
    const s1 = mount(b);
    b.update(t20);
    expect(s1.querySelectorAll('.pc-card')).toHaveLength(2);
    expect(s1.querySelector('.pc-strike .pc-name')!.textContent).toContain('Aiden Markram');
    expect(s1.textContent).toContain('41 (28)');

    const w = new BowlerCard();
    const s2 = mount(w);
    w.update(t20);
    expect(s2.textContent).toContain('1-21');
    expect(s2.textContent).toContain('2.3 ov');
  });

  it('handles very long names without breaking the DOM structure', () => {
    const b = new BatterCards();
    const stage = mount(b);
    const long = 'Abdullah Ahmadzai Khan Mohammadzai';
    b.update({ ...t20, batters: [{ ...t20.batters[0], name: long }, t20.batters[1]] });
    expect(stage.querySelector('.pc-name')!.textContent).toContain(long);
  });

  it('watermark can be hidden once licensed', () => {
    const w = new Watermark();
    const stage = mount(w);
    expect(stage.textContent).toContain('StumpCast');
    w.setVisible(false);
    expect(stage.querySelector('.c-watermark')!.hasAttribute('hidden')).toBe(true);
  });
});

describe('layouts', () => {
  it('defines ten valid OBS presets with normalized source rectangles', () => {
    expect(OBS_LAYOUT_PRESETS.map((preset) => preset.id)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);
    for (const preset of OBS_LAYOUT_PRESETS) {
      for (const rect of Object.values(preset.roles)) {
        expect(rect!.x).toBeGreaterThanOrEqual(0);
        expect(rect!.y).toBeGreaterThanOrEqual(0);
        expect(rect!.x + rect!.width).toBeLessThanOrEqual(1);
        expect(rect!.y + rect!.height).toBeLessThanOrEqual(1);
      }
    }
  });

  it('creates zones and switches layout via data attribute only', () => {
    const stage = document.createElement('div');
    const zones = createZones(stage);
    expect(Object.keys(zones).sort()).toEqual(['bottom', 'card', 'left', 'main', 'right', 'top']);
    applyLayout(stage, 'arena', 1.2);
    expect(stage.dataset.layout).toBe('arena');
    expect(stage.style.getPropertyValue('--card-scale')).toBe('1.2');
    const before = stage.children.length;
    applyLayout(stage, 'ticker');
    expect(stage.children.length).toBe(before); // no DOM rebuild
  });
});

describe('BannerQueue', () => {
  const ev = (id: string, type: EngineEvent['type']): EngineEvent => ({
    id,
    matchId: 'm',
    type,
    at: '2026-01-01T00:00:00.000Z',
    payload: {},
  });

  const make = (now = () => 0) => {
    const played: BannerItem[] = [];
    const finishers: (() => void)[] = [];
    const q = new BannerQueue((item, done) => {
      played.push(item);
      finishers.push(done);
    }, now);
    return { q, played, finish: () => finishers.shift()?.() };
  };

  it('plays one at a time, in order', () => {
    const { q, played, finish } = make();
    q.enqueue(ev('a', 'FOUR'));
    q.enqueue(ev('b', 'SIX'));
    q.enqueue(ev('c', 'WICKET'));
    expect(played.map((p) => p.id)).toEqual(['a']);
    finish();
    expect(played.map((p) => p.id)).toEqual(['a', 'b']);
    finish();
    finish();
    expect(played.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('ignores duplicates and non-banner events', () => {
    const { q, played } = make();
    expect(q.enqueue(ev('a', 'FOUR'))).toBe(true);
    expect(q.enqueue(ev('a', 'FOUR'))).toBe(false);
    expect(q.enqueue(ev('o', 'OVER_END'))).toBe(false);
    expect(played).toHaveLength(1);
  });

  it('keeps a wicket when the queue overflows, dropping boundaries first', () => {
    const { q, played, finish } = make();
    q.enqueue(ev('first', 'FOUR')); // playing
    q.enqueue(ev('w', 'WICKET'));
    for (let i = 0; i < 6; i++) q.enqueue(ev(`f${i}`, 'FOUR'));
    expect(q.pending.length).toBeLessThanOrEqual(4);
    expect(q.pending.some((p) => p.id === 'w')).toBe(true);
    finish();
    expect(played.at(-1)!.id).toBe('w');
  });

  it('drops items that went stale while waiting', () => {
    let t = 0;
    const { q, played, finish } = make(() => t);
    q.enqueue(ev('a', 'FOUR'));
    q.enqueue(ev('b', 'SIX'));
    t = 20_000;
    finish();
    expect(played.map((p) => p.id)).toEqual(['a']);
  });
});
