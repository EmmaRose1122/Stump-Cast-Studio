import { BallEventSchema, type BallEvent } from './ball';
import { MatchStateSchema, runRate, type MatchState } from './match';

export const createBall = (input: Partial<BallEvent> = {}): BallEvent =>
  BallEventSchema.parse({
    over: 0,
    ball: 1,
    runs: 0,
    batterId: 'batter',
    bowlerId: 'bowler',
    ...input,
  });

/** Build a valid MatchState; `crr` is derived from `score` unless overridden. */
export const createMatchState = (overrides: Partial<MatchState> = {}): MatchState => {
  const score = overrides.score ?? { runs: 0, wkts: 0, overs: 0, balls: 0 };
  return MatchStateSchema.parse({
    id: 'match-1',
    title: 'Team A vs Team B',
    format: 'T20',
    status: 'pre',
    teams: [
      { id: 'team-a', name: 'Team A', short: 'TMA', color: '#19D3C5' },
      { id: 'team-b', name: 'Team B', short: 'TMB', color: '#FF6B57' },
    ],
    innings: [],
    currentInnings: 0,
    battingTeamId: 'team-a',
    score,
    batters: [
      {
        playerId: 'a-1',
        name: 'Opener One',
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        onStrike: true,
      },
      {
        playerId: 'a-2',
        name: 'Opener Two',
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        onStrike: false,
      },
    ],
    bowler: {
      playerId: 'b-1',
      name: 'Bowler One',
      overs: 0,
      balls: 0,
      maidens: 0,
      runs: 0,
      wkts: 0,
    },
    lastBalls: [],
    thisOver: [],
    partnership: { runs: 0, balls: 0 },
    crr: runRate(score),
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  });
};
