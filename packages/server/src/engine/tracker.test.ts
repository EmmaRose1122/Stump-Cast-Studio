import { describe, expect, it } from 'vitest';
import { fixtures, type BallEvent, type MatchState } from '@stumpcast/shared';
import { BallTracker } from './tracker';

const state = (over: Partial<MatchState>): MatchState => ({ ...fixtures.t20, ...over });

const batter = (name: string, runs: number, balls: number): MatchState['batters'][number] => ({
  playerId: name.toLowerCase().replace(/\s+/g, '-'),
  name,
  runs,
  balls,
  fours: 0,
  sixes: 0,
  onStrike: true,
});

const ball = (over: number, num: number, extra: Partial<BallEvent> = {}): BallEvent => ({
  over,
  ball: num,
  runs: 0,
  batterId: 'lhuan-dre-pretorius',
  bowlerId: 'adam-zampa',
  ...extra,
});

const apply = (t: BallTracker, s: MatchState) => t.apply(s);

describe('BallTracker extras and dismissals', () => {
  it('splits the extras the innings gave away, because the feed never does', () => {
    const t = new BallTracker();
    t.observe(
      state({
        score: { runs: 11, wkts: 0, overs: 0, balls: 3 },
        thisOver: [
          ball(0, 1, { extras: { type: 'wide', runs: 1 } }),
          ball(0, 1, { extras: { type: 'noball', runs: 1 }, runs: 4 }),
          ball(0, 2, { extras: { type: 'legbye', runs: 2 } }),
        ],
        lastBalls: [],
      }),
    );
    const out = apply(t, state({ score: { runs: 11, wkts: 0, overs: 0, balls: 3 }, thisOver: [], lastBalls: [] }));
    expect(out.extras).toEqual({ wide: 1, noball: 1, bye: 0, legbye: 2, penalty: 0 });
    // A wide and a no-ball are not deliveries faced, so the dot-rate denominator is untouched.
    expect(out.ballsObserved).toBe(1);
  });

  it('names the last wicket with the figures the batter had when they fell', () => {
    const t = new BallTracker();
    // The feed shows him at 10 off 10 for the previous delivery...
    t.observe(
      state({
        batters: [batter('Lhuan-dre Pretorius', 10, 10), batter('Dewald Brevis', 0, 0)],
        score: { runs: 183, wkts: 3, overs: 16, balls: 0 },
        thisOver: [],
        lastBalls: [],
      }),
    );
    // ...then he is gone, and only the ball that took him says so.
    t.observe(
      state({
        batters: [batter('Dewald Brevis', 0, 0), batter('Tristan Stubbs', 0, 0)],
        score: { runs: 184, wkts: 4, overs: 16, balls: 1 },
        thisOver: [ball(16, 1, { wicket: { kind: 'bowled', playerOutId: 'lhuan-dre-pretorius' } })],
        lastBalls: [],
      }),
    );
    
    const out = apply(t, state({ score: { runs: 184, wkts: 4, overs: 16, balls: 1 } }));
    expect(out.lastWicket).toMatchObject({
      name: 'Lhuan-dre Pretorius',
      runs: 10,
      balls: 10,
      kind: 'bowled',
      teamRuns: 184,
      wkts: 4,
      over: 16,
      ball: 1,
    });
  });

  it('waits for the page to swap the batter out, then keeps naming him', () => {
    const t = new BallTracker();
    // Update 1: nobody is out yet.
    t.observe(
      state({
        batters: [batter('Ryan Rickelton', 14, 10), batter('Aiden Markram', 0, 0)],
        score: { runs: 33, wkts: 0, overs: 3, balls: 3 },
        thisOver: [],
        lastBalls: [],
      }),
    );
    // Update 2: the wicket ball arrives while the page still lists the man who has just got out.
    t.observe(
      state({
        batters: [batter('Ryan Rickelton', 14, 11), batter('Aiden Markram', 0, 0)],
        score: { runs: 34, wkts: 1, overs: 3, balls: 3 },
        thisOver: [ball(3, 4, { wicket: { kind: 'caught', playerOutId: 'ryan-rickelton' } })],
        lastBalls: [],
      }),
    );
    const notYet = apply(t, state({ score: { runs: 34, wkts: 1, overs: 3, balls: 3 } }));
    expect(notYet.lastWicket).toBeUndefined(); // no name guessed while both are still on the page

    // Update 3: he is gone and Pretorius walks in.
    t.observe(
      state({
        batters: [batter('Aiden Markram', 2, 1), batter('Lhuan-dre Pretorius', 0, 0)],
        score: { runs: 35, wkts: 1, overs: 3, balls: 4 },
        thisOver: [
          ball(3, 4, { wicket: { kind: 'caught', playerOutId: 'ryan-rickelton' } }),
          ball(3, 5, { runs: 1 }),
        ],
        lastBalls: [],
      }),
    );
    const later = state({ score: { runs: 40, wkts: 1, overs: 4, balls: 2 } });
    const out = apply(t, later);
    expect(out.lastWicket).toMatchObject({ name: 'Ryan Rickelton', runs: 14, balls: 11, wkts: 1 });

    t.remove(String(fixtures.t20.id));
    expect(apply(t, later).lastWicket).toBeUndefined();
  });
});
