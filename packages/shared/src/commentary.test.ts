import { describe, expect, it } from 'vitest';
import { buildEventCommentary } from './commentary';
import type { EngineEvent } from './event';
import type { MatchState } from './match';

describe('buildEventCommentary', () => {
  const dummyState = {
    id: 'm1',
    batters: [
      { playerId: 'p1', name: 'Babar Azam', runs: 46, balls: 32, fours: 5, sixes: 1, onStrike: true },
      { playerId: 'p2', name: 'Mohammad Rizwan', runs: 30, balls: 24, fours: 3, sixes: 0, onStrike: false },
    ],
    bowler: { playerId: 'b1', name: 'Pat Cummins', overs: { balls: 18 }, runs: 24, wkts: 1 },
    score: { runs: 120, wkts: 1 },
    overs: { balls: 60 },
  } as unknown as MatchState;

  it('generates energetic boundary commentary for FOUR', () => {
    const ev: EngineEvent = {
      id: 'e1',
      matchId: 'm1',
      type: 'FOUR',
      at: new Date().toISOString(),
      payload: { batter: 'Babar Azam' },
    };
    const line = buildEventCommentary(ev, dummyState);
    expect(line).toContain('Babar Azam');
    expect(line).toContain('FOUR');
  });

  it('generates high excitement commentary for SIX', () => {
    const ev: EngineEvent = {
      id: 'e2',
      matchId: 'm1',
      type: 'SIX',
      at: new Date().toISOString(),
      payload: { batter: 'Babar Azam' },
    };
    const line = buildEventCommentary(ev, dummyState);
    expect(line).toContain('Babar Azam');
    expect(line).toContain('SIX');
  });

  it('generates breakthrough commentary for WICKET', () => {
    const ev: EngineEvent = {
      id: 'e3',
      matchId: 'm1',
      type: 'WICKET',
      at: new Date().toISOString(),
      payload: { batter: 'Babar Azam', bowler: 'Pat Cummins', how: 'bowled' },
    };
    const line = buildEventCommentary(ev, dummyState);
    expect(line).toContain('OUT!');
    expect(line).toContain('Babar Azam');
    expect(line).toContain('Pat Cummins');
  });

  it('generates milestone celebration for FIFTY', () => {
    const ev: EngineEvent = {
      id: 'e4',
      matchId: 'm1',
      type: 'FIFTY',
      at: new Date().toISOString(),
      payload: { batter: 'Babar Azam' },
    };
    const line = buildEventCommentary(ev, dummyState);
    expect(line).toContain('Fifty up!');
    expect(line).toContain('Babar Azam');
  });
});
