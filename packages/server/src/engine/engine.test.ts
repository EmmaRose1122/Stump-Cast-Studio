import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  RawUpdateSchema,
  createMatchState,
  fixtures,
  type MatchState,
  type RawUpdate,
} from '@stumpcast/shared';
import { openDatabase, schema } from '../db';
import { rawToBaseState } from './adapt';
import { battingWinProb, deriveStats, safeDiv } from './derive';
import { MatchEngine } from './MatchEngine';

type Fields = Partial<RawUpdate['fields']>;

const raw = (fields: Fields, matchId = 'm1'): RawUpdate =>
  RawUpdateSchema.parse({
    source: 'cricbuzz',
    matchId,
    url: `https://www.example.invalid/${matchId}`,
    capturedAt: 1,
    confidence: 1,
    fields: { teams: [{ name: 'India' }, { name: 'Australia' }], ...fields },
    missing: [],
  });

const inn = (team: string, runs: number, wkts: number, overs: number, balls = 0) => ({
  team,
  runs,
  wkts,
  overs,
  balls,
});

/** Walk any value and report the first NaN/Infinity path. */
const badNumber = (v: unknown, p = '$'): string | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? null : p;
  if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      const r = badNumber(x, `${p}.${k}`);
      if (r) return r;
    }
  }
  return null;
};

describe('deriveStats on the shared fixtures (hand-calculated)', () => {
  it('T20 mid-innings: 98/2 after 11.3', () => {
    const s = deriveStats(fixtures.t20);
    expect(s.crr).toBe(8.52); // 98 / 11.5
    expect(s.ballsLeft).toBe(51); // 120 - 69
    expect(s.wicketsLeft).toBe(8);
    expect(s.projected).toBe(170); // 98 + 8.52 * 8.5
    expect(s.projectedPlus2).toBe(187); // 98 + 10.52 * 8.5
    expect(s.rrr).toBeUndefined();
  });

  it('Test day 4: lead is batting side total minus the other side', () => {
    const s = deriveStats(fixtures.test);
    expect(s.lead).toBe(264); // (312 + 241) - 289
    expect(s.ballsLeft).toBeUndefined();
    expect(s.winProb).toBeUndefined();
  });

  it('completed chase: nothing needed, rrr 0, batting side certain', () => {
    const s = deriveStats(fixtures.result);
    expect(s.runsNeeded).toBe(0);
    expect(s.rrr).toBe(0);
    expect(s.winProb).toEqual({ teamA: 0, teamB: 1 }); // PAK is teams[1]
  });
});

describe('chase maths', () => {
  const chase = (overrides: Partial<MatchState>) =>
    deriveStats(
      createMatchState({
        format: 'T20',
        status: 'live',
        currentInnings: 2,
        innings: [
          {
            number: 1,
            battingTeamId: 'team-b',
            score: { runs: 159, wkts: 8, overs: 20, balls: 0 },
            declared: false,
            allOut: false,
          },
          {
            number: 2,
            battingTeamId: 'team-a',
            score: { runs: 100, wkts: 3, overs: 12, balls: 0 },
            declared: false,
            allOut: false,
          },
        ],
        battingTeamId: 'team-a',
        score: { runs: 100, wkts: 3, overs: 12, balls: 0 },
        ...overrides,
      }),
    );

  it('derives target, runs needed and required rate', () => {
    const s = chase({});
    expect(s.target).toBe(160);
    expect(s.runsNeeded).toBe(60);
    expect(s.ballsLeft).toBe(48);
    expect(s.rrr).toBe(7.5);
  });

  it('prefers a provider-supplied target', () => {
    expect(chase({ target: 150 }).runsNeeded).toBe(50);
  });

  it('win probability falls as the required rate rises and as wickets fall', () => {
    const easy = battingWinProb(chase({ target: 130 }))!;
    const hard = battingWinProb(chase({ target: 200 }))!;
    const wkts = battingWinProb(chase({ score: { runs: 100, wkts: 9, overs: 12, balls: 0 } }))!;
    expect(easy).toBeGreaterThan(hard);
    expect(wkts).toBeLessThan(battingWinProb(chase({}))!);
    for (const p of [easy, hard, wkts]) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  it('teamA and teamB sum to 1', () => {
    const s = chase({});
    expect(s.winProb!.teamA + s.winProb!.teamB).toBeCloseTo(1, 5);
  });

  it('safeDiv never returns NaN or Infinity', () => {
    expect(safeDiv(5, 0)).toBe(0);
    expect(safeDiv(Number.NaN, 2)).toBe(0);
    expect(safeDiv(1, 4)).toBe(0.25);
  });
});

describe('rawToBaseState', () => {
  it('maps teams, innings and flags; uses placeholders instead of inventing data', () => {
    const s = rawToBaseState(
      raw({
        title: 'IND v AUS, 2nd T20I',
        innings: [inn('India', 180, 5, 20)],
        thisOver: ['1', '.', 'W'],
      }),
      '2026-01-01T00:00:00.000Z',
    );
    expect(s.format).toBe('T20');
    expect(s.teams.map((t) => t.id)).toEqual(['team-india', 'team-australia']);
    expect(s.battingTeamId).toBe('team-india');
    expect(s.batters[0].name).toBe('—');
    expect(s.thisOver).toHaveLength(3);
    expect(s.thisOver[2]?.wicket).toBeTruthy();
  });

  it.each([
    ['Day 4: Stumps - India need 319 runs', 'break'],
    ['India won by 6 wickets', 'result'],
    ['Innings Break', 'innings_break'],
    ['Live', 'live'],
  ])('status %j -> %s', (status, expected) => {
    const s = rawToBaseState(
      raw({ status, innings: [inn('India', 10, 0, 1)] }),
      '2026-01-01T00:00:00.000Z',
    );
    expect(s.status).toBe(expected);
  });

  it('is pre-match with no innings', () => {
    expect(
      rawToBaseState(raw({ status: 'Match starts at 7pm' }), '2026-01-01T00:00:00.000Z').status,
    ).toBe('pre');
  });
});

describe('MatchEngine', () => {
  const tmp: string[] = [];
  afterEach(() => {
    while (tmp.length) fs.rmSync(tmp.pop()!, { recursive: true, force: true });
  });

  it('emits on change only and keeps immutable state', () => {
    const emitted: MatchState[] = [];
    const e = new MatchEngine({ onState: (s) => emitted.push(s) });
    const base = { title: 'IND v AUS T20', innings: [inn('India', 50, 1, 6)] };
    const first = e.process(raw(base));
    expect(first).not.toBeNull();
    expect(e.process(raw(base))).toBeNull(); // identical
    expect(e.process(raw({ ...base, innings: [inn('India', 54, 1, 6, 1)] }))).not.toBeNull();
    expect(emitted).toHaveLength(2);
    expect(() => {
      (first as MatchState).score.runs = 999;
    }).toThrow();
  });

  it('never produces NaN or Infinity, even for an empty update', () => {
    const e = new MatchEngine();
    const s = e.process(raw({}))!;
    expect(s).not.toBeNull();
    expect(badNumber(s)).toBeNull();
    for (const f of Object.values(fixtures)) expect(badNumber(deriveStats(f))).toBeNull();
  });

  it('accumulates dot-ball %, boundaries and powerplay across updates', () => {
    const e = new MatchEngine();
    const t = (thisOver: string[], runs: number, overs: number, balls: number) =>
      e.process(
        raw({
          title: 'IND v AUS T20',
          innings: [inn('India', runs, 0, overs, balls)],
          thisOver,
          lastBalls: thisOver,
        }),
      )!;
    t(['.'], 0, 0, 1);
    t(['.', '4'], 4, 0, 2);
    const s = t(['.', '4', '6'], 10, 0, 3);
    expect(s.ballsObserved).toBe(3);
    expect(s.dotBallPct).toBe(33.3);
    expect(s.boundaries).toEqual({ fours: 1, sixes: 1 });
    expect(s.powerplay).toEqual({ runs: 10, wkts: 0, complete: false });

    const after = e.process(
      raw({
        title: 'IND v AUS T20',
        innings: [inn('India', 52, 1, 6, 0)],
        thisOver: [],
        lastBalls: [],
      }),
    )!;
    expect(after.powerplay).toEqual({ runs: 52, wkts: 1, complete: true });
  });

  it('does not double count a finished over that the feed keeps displaying', () => {
    const e = new MatchEngine();
    const six = ['1', '.', '1', '.', '4', '1'];
    const feed = (thisOver: string[], overs: number, balls: number) =>
      e.process(
        raw({
          title: 'IND v AUS T20',
          innings: [inn('India', 10 + overs, 0, overs, balls)],
          thisOver,
          lastBalls: thisOver,
        }),
      )!;
    feed(six.slice(0, 5), 0, 5);
    const done = feed(six, 1, 0); // over complete, still showing its six balls
    expect(done.ballsObserved).toBe(6);
    const next = feed(['.'], 1, 1);
    expect(next.ballsObserved).toBe(7);
  });

  it('persists a match row and one snapshot per change', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stumpcast-engine-'));
    tmp.push(dir);
    const { db, sqlite } = openDatabase(dir);
    const e = new MatchEngine({ db });
    const f = { title: 'IND v AUS T20', innings: [inn('India', 10, 0, 1)] };
    e.process(raw(f));
    e.process(raw(f));
    e.process(raw({ ...f, innings: [inn('India', 14, 0, 1, 1)] }));
    expect(db.select().from(schema.matches).all()).toHaveLength(1);
    expect(db.select().from(schema.snapshots).all()).toHaveLength(2);
    sqlite.close();
  });

  it('rejects states that fail validation instead of publishing them', () => {
    const e = new MatchEngine();
    // 11 wickets is impossible; the raw schema allows up to 10 so build a bad one via override.
    const bad = raw({ innings: [inn('India', 10, 0, 1)] });
    (bad.fields.innings[0] as { wkts: number }).wkts = 11;
    expect(e.process(bad)).toBeNull();
  });
});
