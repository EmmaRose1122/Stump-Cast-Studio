import { describe, expect, it } from 'vitest';
import { deriveStats, fixtures, type MatchState } from '@stumpcast/shared';
import { PlayerTracker } from './players';

const state = (over: Partial<MatchState>, innings = 1): MatchState => ({
  ...fixtures.t20,
  currentInnings: innings,
  ...over,
});

const batter = (
  name: string,
  runs: number,
  balls: number,
  onStrike: boolean,
  fours = 0,
  sixes = 0,
): MatchState['batters'][0] => ({
  playerId: name.toLowerCase().replace(/\s+/g, '-'),
  name,
  runs,
  balls,
  fours,
  sixes,
  onStrike,
});

const bowler = (
  name: string,
  wkts: number,
  runs: number,
  overs: number,
  balls = 0,
  maidens = 0,
): MatchState['bowler'] => ({
  playerId: name.toLowerCase().replace(/\s+/g, '-'),
  name,
  overs,
  balls,
  maidens,
  runs,
  wkts,
});

describe('PlayerTracker', () => {
  it('keeps the figures of a batter who has left the crease', () => {
    const t = new PlayerTracker();
    t.observe(state({ batters: [batter('Arif Butt', 12, 14, true), batter('Kashif', 3, 4, false)] }));
    // The next ball: Arif is out and Shahid comes in. The pair on air no longer carries Arif.
    t.observe(state({ batters: [batter('Kashif', 3, 4, true), batter('Shahid', 0, 0, false)] }));

    const out = t.apply(state({ batters: [batter('Kashif', 3, 4, true), batter('Shahid', 0, 0, false)] }));
    expect(out.topBatters?.map((b) => b.name)).toEqual(['Arif Butt', 'Kashif']);
    expect(out.topBatters?.[0]).toMatchObject({ runs: 12, balls: 14 });
  });

  it('ranks by runs and never lists a batter who never faced', () => {
    const t = new PlayerTracker();
    t.observe(state({ batters: [batter('A', 20, 24, true, 2, 0), batter('B', 0, 0, false)] }));
    const out = t.apply(state({ batters: [batter('A', 20, 24, true, 2, 0), batter('B', 0, 0, false)] }));
    expect(out.topBatters?.map((b) => b.name)).toEqual(['A']);
  });

  it('accumulates bowlers across spells and ranks by wickets then runs', () => {
    const t = new PlayerTracker();
    t.observe(state({ batters: [batter('A', 1, 1, true), batter('B', 0, 0, false)], bowler: bowler('Raza', 1, 18, 3, 4, 1) }));
    t.observe(state({ batters: [batter('A', 1, 1, true), batter('B', 0, 0, false)], bowler: bowler('Nadeem', 2, 9, 2, 0) }));
    const out = t.apply(state({ batters: [batter('A', 1, 1, true), batter('B', 0, 0, false)], bowler: bowler('Nadeem', 2, 9, 2, 0) }));
    expect(out.topBowlers?.map((b) => b.name)).toEqual(['Nadeem', 'Raza']);
    expect(out.topBowlers?.[0]).toMatchObject({ wkts: 2, runs: 9, overs: 2, balls: 0 });
  });

  it('starts a fresh scorecard per innings so a name is not carried across', () => {
    const t = new PlayerTracker();
    t.observe(state({ batters: [batter('A', 60, 40, true), batter('B', 5, 6, false)] }, 1));
    t.observe(state({ batters: [batter('A', 2, 3, true), batter('C', 0, 0, false)] }, 2));
    const out = t.apply(state({ batters: [batter('A', 2, 3, true), batter('C', 0, 0, false)] }, 2));
    // A's best innings is the 60 from innings one, not the 2 from innings two.
    expect(out.topBatters?.map((b) => `${b.name} ${b.runs} i${b.innings}`)).toEqual([
      'A 60 i1',
      'B 5 i1',
    ]);
  });

  it('omits the fields entirely when the feed carried no player rows', () => {
    const t = new PlayerTracker();
    const placeholder: MatchState = {
      ...fixtures.t20,
      batters: [
        { playerId: 'unknown-batter-1', name: '—', runs: 0, balls: 0, fours: 0, sixes: 0, onStrike: false },
        { playerId: 'unknown-batter-2', name: '—', runs: 0, balls: 0, fours: 0, sixes: 0, onStrike: false },
      ],
      bowler: { playerId: 'unknown-bowler', name: '—', overs: 0, balls: 0, maidens: 0, runs: 0, wkts: 0 },
    };
    t.observe(placeholder);
    const out = t.apply(placeholder);
    expect(out.topBatters).toBeUndefined();
    expect(out.topBowlers).toBeUndefined();
  });

  it('takes the latest snapshot of a batter at the crease', () => {
    const t = new PlayerTracker();
    t.observe(state({ batters: [batter('A', 5, 5, true), batter('B', 0, 0, false)] }));
    t.observe(state({ batters: [batter('A', 9, 6, true), batter('B', 0, 0, false)] }));
    const out = t.apply(state({ batters: [batter('A', 9, 6, true), batter('B', 0, 0, false)] }));
    expect(out.topBatters?.[0]).toMatchObject({ runs: 9, balls: 6 });
  });

  it('forgets a deleted match so a reused id inherits nothing', () => {
    const t = new PlayerTracker();
    t.observe(state({ batters: [batter('A', 40, 30, true), batter('B', 1, 1, false)] }));
    expect(t.size).toBe(1);
    t.remove(fixtures.t20.id);
    expect(t.size).toBe(0);
  });

  it('leaves a live state publishable through deriveStats', () => {
    const t = new PlayerTracker();
    t.observe(state({ batters: [batter('A', 40, 30, true), batter('B', 1, 1, false)] }));
    const out = deriveStats(t.apply(fixtures.t20));
    expect(out.topBatters).toHaveLength(2);
    expect(out.topBatters?.[0]).toMatchObject({ name: 'A', runs: 40, balls: 30 });
  });
});
