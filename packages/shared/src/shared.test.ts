import { describe, expect, it } from 'vitest';
import {
  BallEventSchema,
  EngineEventSchema,
  LookSchema,
  MatchStateSchema,
  ScoreSchema,
  battingWinProb,
  createMatchState,
  createPlayer,
  createSettings,
  createTeam,
  fixtures,
  runRate,
  slug,
  teamId,
} from './index';

describe('fixtures', () => {
  for (const [name, fx] of Object.entries(fixtures)) {
    it(`${name} validates against MatchStateSchema`, () => {
      expect(() => MatchStateSchema.parse(fx)).not.toThrow();
    });
  }

  it('cover live T20, Test day 4 and a result', () => {
    expect(fixtures.t20.format).toBe('T20');
    expect(fixtures.test.format).toBe('TEST');
    expect(fixtures.test.day).toBe(4);
    expect(fixtures.result.status).toBe('result');
  });
});

describe('schemas', () => {
  it('rejects balls > 5 in a score', () => {
    expect(ScoreSchema.safeParse({ runs: 1, wkts: 0, overs: 1, balls: 6 }).success).toBe(false);
  });

  it('rejects wickets > 10', () => {
    expect(ScoreSchema.safeParse({ runs: 1, wkts: 11, overs: 1, balls: 0 }).success).toBe(false);
  });

  it('accepts a wicket ball', () => {
    expect(
      BallEventSchema.safeParse({
        over: 3,
        ball: 2,
        runs: 0,
        wicket: { kind: 'bowled', playerOutId: 'x' },
        batterId: 'x',
        bowlerId: 'y',
      }).success,
    ).toBe(true);
  });

  it('rejects runs credited to a bowled/lbw/stumped/hit-wicket batter', () => {
    const ball = { over: 3, ball: 2, batterId: 'x', bowlerId: 'y' };
    expect(
      BallEventSchema.safeParse({
        ...ball,
        runs: 4,
        wicket: { kind: 'bowled', playerOutId: 'x' },
      }).success,
    ).toBe(false);
    expect(
      BallEventSchema.safeParse({
        ...ball,
        runs: 4,
        wicket: { kind: 'caught', playerOutId: 'x' },
      }).success,
    ).toBe(true);
    // 6 off the bat plus overthrows is legal, so the ceiling stays at 7.
    expect(BallEventSchema.safeParse({ ...ball, runs: 7 }).success).toBe(true);
    expect(BallEventSchema.safeParse({ ...ball, runs: 8 }).success).toBe(false);
  });

  it('requires the two win probabilities to be one number split in two', () => {
    const base = { ...fixtures.test, winProb: { teamA: 0.34, teamB: 0.36 } };
    expect(MatchStateSchema.safeParse(base).success).toBe(false);
    expect(
      MatchStateSchema.safeParse({ ...base, winProb: { teamA: 0.34, teamB: 0.66 } }).success,
    ).toBe(true);
  });

  it('sizes a first-innings projection against the innings actually being played', () => {
    // A 10-over game projected at 82 is on par; it must not be judged against a T20 165.
    const tenOvers = {
      ...fixtures.t20,
      format: 'OTHER' as const,
      oversLimit: 10,
      target: undefined,
      runsNeeded: undefined,
      projected: 82,
      ballsLeft: 60,
      wicketsLeft: 5,
    };
    expect(battingWinProb(tenOvers)).toBeGreaterThan(0.4);
  });

  it('validates an engine event and defaults payload', () => {
    const e = EngineEventSchema.parse({
      id: 'm1-1-3-2-WICKET',
      matchId: 'm1',
      type: 'WICKET',
      at: '2026-01-01T00:00:00.000Z',
    });
    expect(e.payload).toEqual({});
  });

  it('rejects an unknown event type', () => {
    const r = EngineEventSchema.safeParse({
      id: 'a',
      matchId: 'm',
      type: 'NOPE',
      at: '2026-01-01T00:00:00.000Z',
    });
    expect(r.success).toBe(false);
  });

  it('parses a Look and defaults plan to free', () => {
    const look = LookSchema.parse({
      id: 'graphite-teal',
      name: 'Graphite Teal',
      tokens: {
        colors: { bg: '#0E1116', accent: '#19D3C5' },
        fonts: { heading: 'Space Grotesk', body: 'Inter', numbers: 'Barlow Condensed' },
        scoreBarShape: 'flat',
      },
      layoutVariant: {
        scorePosition: 'top',
        playerCardStyle: 'badge',
        boundaryStyle: 'edge-flash',
      },
      motion: { entrance: 'fade' },
    });
    expect(look.plan).toBe('free');
    expect(look.layoutVariant.middleLayout).toBe('left-stats');
    expect(look.layoutVariant.playerOrder).toBe('striker-left');
  });
});

describe('factories and helpers', () => {
  it('createSettings fills defaults', () => {
    const s = createSettings();
    expect(s.syncDelaySec).toBe(0);
    expect(s.director.mode).toBe('manual');
  });

  it('createSettings rejects out-of-range delay', () => {
    expect(() => createSettings({ syncDelaySec: 61 })).toThrow();
  });

  it('createMatchState derives crr from score', () => {
    const s = createMatchState({ score: { runs: 60, wkts: 1, overs: 6, balls: 0 } });
    expect(s.crr).toBe(10);
  });

  it('runRate is 0 (not NaN) before a ball is bowled', () => {
    expect(runRate({ runs: 0, wkts: 0, overs: 0, balls: 0 })).toBe(0);
  });

  it('slug and id rules follow the PRD', () => {
    expect(slug('Aiden Markram')).toBe('aiden-markram');
    expect(teamId('RSA')).toBe('team-rsa');
    expect(createPlayer({ name: 'Aiden Markram', teamId: 'team-rsa' }).id).toBe('aiden-markram');
    expect(createTeam({ name: 'South Africa', short: 'RSA' }).id).toBe('team-rsa');
  });
});
