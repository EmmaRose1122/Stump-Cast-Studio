import { describe, expect, it } from 'vitest';
import { createBall, createMatchState, type BallEvent, type MatchState } from '@stumpcast/shared';
import { EventDetector } from './EventDetector';

/** Ball token shorthand: number = runs off the bat, 'W' = wicket, '.' = dot, 'wd' = wide. */
const tok = (t: string | number, i: number): BallEvent => {
  const base = { over: 0, ball: i + 1, batterId: 'a-1', bowlerId: 'b-1' };
  if (t === 'W') return createBall({ ...base, wicket: { kind: 'bowled', playerOutId: 'a-1' } });
  if (t === 'wd') return createBall({ ...base, extras: { type: 'wide', runs: 1 } });
  return createBall({ ...base, runs: t === '.' ? 0 : Number(t) });
};

interface Opts {
  runs: number;
  wkts?: number;
  overs: number;
  balls: number;
  last?: (string | number)[];
  innings?: number;
  format?: MatchState['format'];
  batters?: [number, number];
  partnership?: number;
  ids?: [string, string];
  /** Boundary counters for the striker, used by the catch-up fallback. */
  fours?: number;
  sixes?: number;
  status?: MatchState['status'];
  session?: MatchState['session'];
  day?: number;
}

const st = (o: Opts): MatchState => {
  const ids = o.ids ?? ['a-1', 'a-2'];
  const score = { runs: o.runs, wkts: o.wkts ?? 0, overs: o.overs, balls: o.balls };
  const b = o.batters ?? [0, 0];
  return createMatchState({
    id: 'm1',
    format: o.format ?? 'T20',
    status: o.status ?? 'live',
    currentInnings: o.innings ?? 1,
    score,
    innings: [
      { number: o.innings ?? 1, battingTeamId: 'team-a', score, declared: false, allOut: false },
    ],
    batters: [
      { playerId: ids[0], name: ids[0], runs: b[0], balls: 10, fours: o.fours ?? 0, sixes: o.sixes ?? 0, onStrike: true },
      {
        playerId: ids[1],
        name: ids[1],
        runs: b[1],
        balls: 10,
        fours: 0,
        sixes: 0,
        onStrike: false,
      },
    ],
    lastBalls: (o.last ?? []).slice(-6).map(tok),
    partnership: { runs: o.partnership ?? 0, balls: 0 },
    day: o.day,
    session: o.session,
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
};

const types = (e: { type: string }[]) => e.map((x) => x.type);

const run = (...states: MatchState[]) => {
  const d = new EventDetector();
  return { d, out: states.map((s) => d.observe(s)) };
};

describe('EventDetector basics', () => {
  it('emits nothing for the first state (initial load)', () => {
    const { out } = run(st({ runs: 40, overs: 5, balls: 0, last: [4, 4, 6] }));
    expect(out[0]).toEqual([]);
  });

  it('detects a four and does not repeat it when the same state arrives again', () => {
    const a = st({ runs: 20, overs: 2, balls: 3, last: [1, '.', 1] });
    const b = st({ runs: 24, overs: 2, balls: 4, last: [1, '.', 1, 4] });
    const { d, out } = run(a, b);
    expect(types(out[1]!)).toEqual(['FOUR']);
    expect(out[1]![0]!.id).toBe('m1:1:16.0:FOUR');
    expect(d.observe(b)).toEqual([]);
    expect(d.observe(a)).toEqual([]); // a correction back, nothing new
    expect(d.observe(b)).toEqual([]); // and forward again: id already seen
  });

  it('detects a six', () => {
    const { out } = run(
      st({ runs: 20, overs: 2, balls: 3, last: [1, '.', 1] }),
      st({ runs: 26, overs: 2, balls: 4, last: [1, '.', 1, 6] }),
    );
    expect(types(out[1]!)).toEqual(['SIX']);
  });

  it('does not treat wides or byes as boundaries', () => {
    const { out } = run(
      st({ runs: 20, overs: 2, balls: 3, last: [1, '.', 1] }),
      st({ runs: 21, overs: 2, balls: 3, last: [1, '.', 1, 'wd'] }),
    );
    expect(out[1]).toEqual([]);
  });

  it('detects a wicket and the incoming batter, with who was dismissed', () => {
    const { out } = run(
      st({ runs: 30, wkts: 1, overs: 4, balls: 1, last: [1, '.'], batters: [12, 5] }),
      st({
        runs: 30,
        wkts: 2,
        overs: 4,
        balls: 2,
        last: [1, '.', 'W'],
        ids: ['a-3', 'a-2'],
        batters: [0, 5],
      }),
    );
    expect(types(out[1]!)).toEqual(['WICKET', 'NEW_BATTER']);
    expect(out[1]![0]!.payload).toMatchObject({ wickets: 2, outPlayerId: 'a-1' });
    expect(out[1]![1]!.payload).toMatchObject({ playerId: 'a-3' });
  });

  it('does not announce a new batter without a wicket', () => {
    const { out } = run(
      st({ runs: 30, overs: 4, balls: 1, ids: ['a-1', 'a-2'] }),
      st({ runs: 30, overs: 4, balls: 1, ids: ['a-1', 'a-9'] }),
    );
    expect(out[1]).toEqual([]);
  });
});

describe('batches, overs and milestones', () => {
  it('replays several balls from one update in order', () => {
    const { out } = run(
      st({ runs: 30, wkts: 1, overs: 4, balls: 0, last: ['.', 1, 1, '.', 1, 1] }),
      st({ runs: 40, wkts: 2, overs: 4, balls: 3, last: ['.', 1, 4, 6, 'W', 0] }),
    );
    // 3 new balls: 4, 6, W.. last three are 6, W, 0? Stream suffix of 3 legal balls = [6, W, 0].
    expect(types(out[1]!)).toContain('SIX');
    expect(types(out[1]!)).toContain('WICKET');
    expect(types(out[1]!).indexOf('SIX')).toBeLessThan(types(out[1]!).indexOf('WICKET'));
  });

  it('recovers boundaries from a catch-up batch the 6-ball token stream cannot describe', () => {
    const { out } = run(
      st({ runs: 30, overs: 4, balls: 0, last: ['.', 1, 1, '.', 1, 1] }),
      // 10 legal balls in one update (a stalled feed): more tokens than lastBalls can hold.
      st({ runs: 68, overs: 5, balls: 4, last: [1, 4, 0, 6, 1, 0], fours: 2, sixes: 1 }),
    );
    const kinds = types(out[1]!);
    expect(kinds.filter((t) => t === 'FOUR')).toHaveLength(2);
    expect(kinds.filter((t) => t === 'SIX')).toHaveLength(1);
    const four = out[1]!.find((e) => e.type === 'FOUR')!;
    expect(four.payload).toMatchObject({ batterId: 'a-1', over: 5, ball: 4 });
  });

  it('does not double-count a boundary the token stream already described', () => {
    const { out } = run(
      st({ runs: 30, overs: 4, balls: 3, last: ['.', 1, 1] }),
      st({ runs: 34, overs: 4, balls: 4, last: ['.', 1, 1, 4], fours: 1 }),
    );
    expect(types(out[1]!).filter((t) => t === 'FOUR')).toHaveLength(1);
  });

  it('emits OVER_END when an over completes, once per over crossed', () => {
    const { out } = run(
      st({ runs: 40, overs: 4, balls: 5, last: [1, 1, 1, 1, 1] }),
      st({ runs: 41, overs: 5, balls: 0, last: [1, 1, 1, 1, 1, 1] }),
    );
    expect(out[1]!.filter((e) => e.type === 'OVER_END')).toHaveLength(1);
    expect(out[1]!.find((e) => e.type === 'OVER_END')!.payload).toMatchObject({ over: 5 });
  });

  it('detects fifty and hundred for a batter exactly once', () => {
    const { d, out } = run(
      st({ runs: 70, overs: 8, balls: 0, batters: [48, 10], last: [1] }),
      st({ runs: 72, overs: 8, balls: 1, batters: [50, 10], last: [1, 2] }),
      st({ runs: 74, overs: 8, balls: 2, batters: [52, 10], last: [1, 2, 2] }),
      st({ runs: 104, overs: 9, balls: 0, batters: [100, 10], last: [4, 4, 4, 4, 4, 4] }),
    );
    expect(types(out[1]!)).toContain('FIFTY');
    expect(types(out[2]!)).not.toContain('FIFTY');
    expect(types(out[3]!)).toContain('HUNDRED');
    expect(d.observe(st({ runs: 104, overs: 9, balls: 0, batters: [100, 10] }))).toEqual([]);
  });

  it('flags team milestones every 50 in limited overs and every 100 in Tests', () => {
    const t20 = run(
      st({ runs: 48, overs: 6, balls: 0, last: [1] }),
      st({ runs: 51, overs: 6, balls: 1, last: [1, 3] }),
    );
    const m = t20.out[1]!.find((e) => e.type === 'MILESTONE')!;
    expect(m.payload).toMatchObject({ kind: 'team', runs: 50 });

    const test = run(
      st({ runs: 148, overs: 40, balls: 0, format: 'TEST', last: [1] }),
      st({ runs: 151, overs: 40, balls: 1, format: 'TEST', last: [1, 3] }),
    );
    expect(test.out[1]!.some((e) => e.type === 'MILESTONE')).toBe(false);
    const hundred = run(
      st({ runs: 98, overs: 30, balls: 0, format: 'TEST', last: [1] }),
      st({ runs: 101, overs: 30, balls: 1, format: 'TEST', last: [1, 3] }),
    );
    expect(hundred.out[1]!.find((e) => e.type === 'MILESTONE')!.payload).toMatchObject({
      runs: 100,
    });
  });

  it('flags a partnership milestone', () => {
    const { out } = run(
      st({ runs: 60, overs: 7, balls: 0, partnership: 48, last: [1] }),
      st({ runs: 62, overs: 7, balls: 1, partnership: 50, last: [1, 2] }),
    );
    expect(out[1]!.find((e) => e.type === 'MILESTONE')!.payload).toMatchObject({
      kind: 'partnership',
    });
  });
});

describe('innings, sessions and resync', () => {
  it('ends an innings when all out', () => {
    const { out } = run(
      st({ runs: 120, wkts: 9, overs: 17, balls: 0, last: [1] }),
      st({ runs: 120, wkts: 10, overs: 17, balls: 1, last: [1, 'W'] }),
    );
    expect(types(out[1]!)).toContain('INNINGS_END');
  });

  it('ends an innings when the overs run out, and when a new innings starts', () => {
    const over = run(
      st({ runs: 150, wkts: 5, overs: 19, balls: 5, last: [1] }),
      st({ runs: 151, wkts: 5, overs: 20, balls: 0, last: [1, 1] }),
    );
    expect(types(over.out[1]!)).toContain('INNINGS_END');

    const next = run(
      st({ runs: 151, wkts: 5, overs: 20, balls: 0, innings: 1 }),
      st({ runs: 0, overs: 0, balls: 0, innings: 2 }),
    );
    expect(types(next.out[1]!)).toEqual(['INNINGS_END']);
  });

  it('emits INNINGS_END once even if several triggers fire', () => {
    const { d } = run(st({ runs: 120, wkts: 9, overs: 19, balls: 5, last: [1] }));
    const a = d.observe(st({ runs: 121, wkts: 10, overs: 20, balls: 0, last: [1, 'W'] }));
    expect(a.filter((e) => e.type === 'INNINGS_END')).toHaveLength(1);
  });

  it('marks session end and day end in a Test', () => {
    const lunch = run(
      st({ runs: 100, overs: 30, balls: 0, format: 'TEST', day: 2, status: 'live' }),
      st({
        runs: 100,
        overs: 30,
        balls: 0,
        format: 'TEST',
        day: 2,
        status: 'break',
        session: 'morning',
      }),
    );
    expect(types(lunch.out[1]!)).toEqual(['SESSION_END']);
    const stumps = run(
      st({ runs: 250, overs: 80, balls: 0, format: 'TEST', day: 2, status: 'live' }),
      st({
        runs: 250,
        overs: 80,
        balls: 0,
        format: 'TEST',
        day: 2,
        status: 'break',
        session: 'evening',
      }),
    );
    expect(types(stumps.out[1]!)).toEqual(['DAY_END']);
  });

  it('treats the first state after resync() as a baseline', () => {
    const d = new EventDetector();
    d.observe(st({ runs: 20, overs: 2, balls: 0, last: [1] }));
    d.resync('m1');
    expect(d.observe(st({ runs: 60, overs: 6, balls: 0, last: [4, 4, 4, 6, 6, 1] }))).toEqual([]);
    const next = d.observe(st({ runs: 64, overs: 6, balls: 1, last: [4, 4, 6, 6, 1, 4] }));
    expect(types(next)).toEqual(['FOUR']);
  });

  it('ignores huge catch-up jumps and score corrections', () => {
    const { out } = run(
      st({ runs: 20, overs: 2, balls: 0, last: [1] }),
      st({ runs: 150, overs: 15, balls: 0, last: [4, 6, 4, 6, 4, 6] }),
      st({ runs: 140, overs: 15, balls: 0, last: [4, 6, 4, 6, 4, 6] }),
    );
    expect(out[1]).toEqual([]);
    expect(out[2]).toEqual([]);
  });

  it('exposes DRS for providers that flag reviews', () => {
    const d = new EventDetector();
    const s = st({ runs: 20, overs: 2, balls: 0 });
    expect(d.drs(s, { by: 'IND' })!.type).toBe('DRS');
    expect(d.drs(s, { by: 'IND' })).toBeNull(); // same moment, no duplicate
  });

  it('credits a boundary hit off a no-ball', () => {
    const fourNb = createBall({
      over: 0,
      ball: 1,
      batterId: 'a-1',
      bowlerId: 'b-1',
      runs: 4,
      extras: { type: 'noball', runs: 1 },
    });
    const d = new EventDetector();
    d.observe(st({ runs: 0, overs: 0, balls: 0, last: [] }));
    const next = { ...st({ runs: 5, overs: 0, balls: 0, last: [] }), lastBalls: [fourNb] };
    expect(types(d.observe(next))).toContain('FOUR');
  });

  it('emits every boundary when two extras share one legal-ball slot', () => {
    const nb = (n: number) =>
      createBall({
        over: 0,
        ball: n,
        batterId: 'a-1',
        bowlerId: 'b-1',
        runs: 4,
        extras: { type: 'noball', runs: 1 },
      });
    const d = new EventDetector();
    d.observe(st({ runs: 0, overs: 0, balls: 0, last: [] }));
    const first = { ...st({ runs: 5, overs: 0, balls: 0, last: [] }), lastBalls: [nb(1)] };
    const second = { ...st({ runs: 10, overs: 0, balls: 0, last: [] }), lastBalls: [nb(1), nb(2)] };
    expect(types(d.observe(first))).toContain('FOUR');
    expect(types(d.observe(second))).toContain('FOUR');
  });
});
