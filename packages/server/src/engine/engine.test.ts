import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  RawUpdateSchema,
  createMatchState,
  fixtures,
  type MatchState,
  type RawUpdate,
} from '@stumpcast/shared';
import { openDatabase, schema } from '../db';
import { rawToBaseState, tokensToBalls } from './adapt';
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
    // Projection blends CRR with the par rate and scales by wickets in hand:
    // 8.52 * (8/10)^0.4 * 8.5 overs + 98 = 164.2 -> 164.
    expect(s.projected).toBe(164);
    expect(s.projectedPlus2).toBe(181); // (7.79 + 2) * 8.5 + 98
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
    // Canonical codes, not a slice of the name: the crest file is `team-ind`, and `team-india`
    // would silently render nothing (or another country's flag).
    expect(s.teams.map((t) => t.id)).toEqual(['team-ind', 'team-aus']);
    expect(s.teams.map((t) => t.short)).toEqual(['IND', 'AUS']);
    expect(s.teams.map((t) => t.logoAssetId)).toEqual(['team-ind', 'team-aus']);
    expect(s.battingTeamId).toBe('team-ind');
    expect(s.batters[0].name).toBe('—');
    expect(s.thisOver).toHaveLength(3);
    expect(s.thisOver[2]?.wicket).toBeTruthy();
  });

  it('keeps a scraped crest for a side with no canonical team code', () => {
    const s = rawToBaseState(
      raw({
        teams: [
          { name: 'India A', logoUrl: 'https://cricketvectors.akamaized.net/Teams/6S.png' },
          { name: 'Wakanda XI' },
        ],
        innings: [inn('India A', 10, 0, 1)],
      }),
      '2026-01-01T00:00:00.000Z',
    );
    expect(s.teams[0]).toMatchObject({ id: 'team-india-a', logoAssetId: 'team-india-a' });
    expect(s.teams[1].logoAssetId).toBeUndefined();
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

  it('keeps an adapter-invented 0-0 out of the live column', () => {
    const s = rawToBaseState(
      raw({
        status: 'Match starts at 1:30 PM',
        innings: [inn('Pakistan', 0, 0, 0)],
        preMatch: true,
      }),
      '2026-01-01T00:00:00.000Z',
    );
    expect(s.status).toBe('pre');
    expect(s.score.runs).toBe(0);
  });

  it('matches an innings to its team by identity, not by the order the names arrived in', () => {
    // The header lists the fixture order ("England" first), the innings rows use short codes and
    // start with whoever batted first — positional pairing silently mislabels the scores.
    const s = rawToBaseState(
      raw({
        title: 'England vs Pakistan, 2nd Match',
        teams: [{ name: 'England' }, { name: 'Pakistan' }],
        innings: [inn('PAK', 302, 9, 50), inn('ENG', 197, 6, 35, 0)],
      }),
      '2026-01-01T00:00:00.000Z',
    );
    expect(s.innings.map((i) => [i.battingTeamId, i.score.runs])).toEqual([
      ['team-pak', 302],
      ['team-eng', 197],
    ]);
    expect(s.battingTeamId).toBe('team-eng');
    expect(s.target).toBeUndefined();
  });

  it('deduplicates duplicate innings for the same team in limited-overs matches and prevents target/need in 1st innings', () => {
    const s = rawToBaseState(
      raw({
        title: 'Pakistan vs England, 4th Match, Pakistan ODI Tri-Series, 2026',
        format: 'ODI',
        teams: [{ name: 'England' }, { name: 'Pakistan' }],
        innings: [
          inn('England', 125, 4, 23, 1),
          inn('England', 125, 4, 23, 1), // duplicate read
        ],
        target: 126, // erroneous target reported by feed
      }),
      '2026-01-01T00:00:00.000Z',
    );
    expect(s.innings).toHaveLength(1);
    expect(s.currentInnings).toBe(1);
    expect(s.battingTeamId).toBe('team-eng');
    expect(s.target).toBeUndefined();
    expect(s.rrr).toBeUndefined();

    const derived = deriveStats(s);
    expect(derived.target).toBeUndefined();
    expect(derived.runsNeeded).toBeUndefined();
    expect(derived.rrr).toBeUndefined();
    expect(derived.projected).toBeGreaterThan(0);
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

  it('a rejected update cannot pollute the ball-by-ball statistics', () => {
    const e = new MatchEngine();
    const feed = (runs: number, balls: number, thisOver: string[]) =>
      e.process(
        raw({
          title: 'IND v AUS T20',
          innings: [inn('India', runs, 0, 0, balls)],
          thisOver,
          lastBalls: thisOver,
        }),
      );
    expect(feed(0, 1, ['.'])!.ballsObserved).toBe(1);

    const bad = raw({
      title: 'IND v AUS T20',
      innings: [inn('India', 14, 0, 0, 4)],
      thisOver: ['.', '4', '6', '4'],
      lastBalls: ['.', '4', '6', '4'],
    });
    (bad.fields.innings![0] as { wkts: number }).wkts = 11;
    expect(e.process(bad)).toBeNull();

    // The four discarded balls must not have been counted by the tracker.
    expect(feed(0, 2, ['.', '4'])!.ballsObserved).toBe(2);
  });

  it('deleting a match forgets its tracked balls, so a reused id starts clean', () => {
    const e = new MatchEngine();
    const feed = (runs: number, balls: number, thisOver: string[]) =>
      e.process(
        raw({
          title: 'IND v AUS T20',
          innings: [inn('India', runs, 0, 0, balls)],
          thisOver,
          lastBalls: thisOver,
        }),
      )!;
    feed(0, 1, ['.']);
    expect(feed(4, 2, ['.', '4']).ballsObserved).toBe(2);
    expect(feed(10, 3, ['.', '4', '6']).ballsObserved).toBe(3);

    e.deleteMatch('m1');
    expect(feed(0, 1, ['.']).ballsObserved).toBe(1);
  });

  it('splits a no-ball total into bat runs and the penalty run', () => {
    expect(tokensToBalls(['nb', '5nb', '2wd', '1lb'], 3, 'a-1', 'b-1')).toMatchObject([
      { runs: 0, extras: { type: 'noball', runs: 1 } },
      { runs: 4, extras: { type: 'noball', runs: 1 } },
      { runs: 0, extras: { type: 'wide', runs: 2 } },
      { runs: 0, extras: { type: 'legbye', runs: 1 } },
    ]);
  });

  it('caps runs a token implies, so a fat no-ball cannot throw the schema', () => {
    // A manual no-ball of 6 bat runs plus 10 extras is a legal command but a "16nb" token, and
    // 15 runs off the bat is not representable: the ball part is capped and the rest stays extra
    // so the delivery still totals what the operator scored.
    expect(tokensToBalls(['16nb', '99w1'], 3, 'a-1', 'b-1')).toMatchObject([
      { runs: 7, extras: { type: 'noball', runs: 9 } },
      { runs: 7, wicket: { playerOutId: 'a-1' } },
    ]);
    expect(() => tokensToBalls(['16nb'], 3, 'a-1', 'b-1')).not.toThrow();
  });

  it('keeps both facts of a wicket glued to the runs scored off it', () => {
    // Cricbuzz writes the ball that dismissed Atkinson as "W1" — out, single completed. Reading it
    // as a number lost the wicket and showed a dot ball on air.
    expect(tokensToBalls(['W', 'W1', '4W'], 8, 'a-1', 'b-1')).toMatchObject([
      { runs: 0, wicket: { playerOutId: 'a-1' } },
      { runs: 1, wicket: { playerOutId: 'a-1' } },
      { runs: 4, wicket: { playerOutId: 'a-1' } },
    ]);
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

  it('keeps the snapshot table bounded instead of growing for every delivery', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stumpcast-engine-'));
    tmp.push(dir);
    const { db, sqlite } = openDatabase(dir);
    // A long-running install: several hundred deliveries already stored for two matches.
    const seed = ['m1', 'm2'].flatMap((matchId) =>
      Array.from({ length: 650 }, (_, i) => ({
        matchId,
        state: { id: matchId },
        createdAt: i,
      })),
    );
    db.insert(schema.snapshots).values(seed).run();

    const e = new MatchEngine({ db });
    for (let i = 1; i <= 100; i++) e.process(raw({ innings: [inn('India', i + 1, 0, 1)] }));

    const count = (id: string) =>
      db.select().from(schema.snapshots).all().filter((r) => r.matchId === id).length;
    // The window holds the recent history the trackers replay, not the whole season.
    expect(count('m1')).toBe(600);
    expect(count('m2')).toBe(650); // another match's history is untouched
    sqlite.close();
  });

  it('rejects states that fail validation instead of publishing them', () => {
    const e = new MatchEngine();
    // 11 wickets is impossible; the raw schema allows up to 10 so build a bad one via override.
    const bad = raw({ innings: [inn('India', 10, 0, 1)] });
    (bad.fields.innings[0] as { wkts: number }).wkts = 11;
    expect(e.process(bad)).toBeNull();
  });

  it('a throwing subscriber does not skip the other listeners or fail the ingest', () => {
    const e = new MatchEngine();
    const seen: string[] = [];
    e.subscribe(() => {
      throw new Error('director blew up');
    });
    e.subscribe((s) => seen.push(s.id));
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const state = e.process(raw({ title: 'IND v AUS T20', innings: [inn('India', 10, 0, 1)] }));

    expect(state).not.toBeNull();
    expect(seen).toEqual(['m1']);
    expect(err).toHaveBeenCalledOnce();
    err.mockRestore();
  });
});
