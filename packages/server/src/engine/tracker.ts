import type { BallEvent, MatchState } from '@stumpcast/shared';

interface InningsStats {
  over: number;
  counted: number;
  balls: number;
  dots: number;
  fours: number;
  sixes: number;
  powerplay?: { runs: number; wkts: number };
}

const isDot = (b: BallEvent) => b.runs === 0 && !b.extras && !b.wicket;
const isLegalBall = (b: BallEvent) =>
  !b.extras || (b.extras.type !== 'wide' && b.extras.type !== 'noball');

/**
 * Accumulates statistics that no single snapshot contains (dot-ball %, boundaries, powerplay)
 * by watching the ball stream (this over + last six) across updates. It only knows about balls
 * it actually observed, so it reports `ballsObserved`; if the feed skips overs the figures are
 * approximate and `gaps` is incremented.
 */
export class BallTracker {
  private readonly stats = new Map<string, InningsStats>();

  private key(s: MatchState) {
    return `${s.id}#${s.currentInnings}`;
  }

  private add(st: InningsStats, balls: BallEvent[]) {
    for (const b of balls) {
      if (!isLegalBall(b)) continue; // wides/no-balls are not "balls faced" for dot %
      st.balls++;
      if (isDot(b)) st.dots++;
      if (b.runs === 4) st.fours++;
      if (b.runs === 6) st.sixes++;
    }
  }

  observe(s: MatchState): void {
    if (s.currentInnings === 0) return;
    const k = this.key(s);
    // Feeds often keep showing the finished over until the first ball of the next one.
    const ov =
      s.score.balls === 0 && s.thisOver.length > 0 && s.score.overs > 0
        ? s.score.overs - 1
        : s.score.overs;
    let st = this.stats.get(k);
    if (!st) {
      st = { over: ov, counted: 0, balls: 0, dots: 0, fours: 0, sixes: 0 };
      this.stats.set(k, st);
    }

    if (ov > st.over) {
      // The over(s) we were watching finished. Its tail is the front of lastBalls.
      const finishedLen = Math.max(0, s.lastBalls.length - s.thisOver.length);
      if (ov === st.over + 1) {
        // Balls of the finished over we never saw: at most the 6 legal balls minus those counted.
        const prevTail = s.lastBalls.slice(0, finishedLen);
        const unseenN = Math.min(finishedLen, Math.max(0, 6 - st.counted));
        this.add(st, prevTail.slice(prevTail.length - unseenN));
      }
      st.over = ov;
      st.counted = 0;
    }

    if (ov === st.over) {
      const fresh = s.thisOver.slice(st.counted);
      this.add(st, fresh);
      st.counted = s.thisOver.length;
    }

    // Powerplay: first observation at or after 6.0 overs in a T20 (10 in ODI) fixes the split.
    const ppOvers = s.format === 'T20' ? 6 : s.format === 'ODI' ? 10 : 0;
    if (ppOvers > 0 && !st.powerplay && s.score.overs >= ppOvers) {
      st.powerplay = { runs: s.score.runs, wkts: s.score.wkts };
    }
  }

  /** Forget one match entirely, so a deleted-then-recreated id does not inherit stale counts. */
  remove(matchId: string): void {
    const prefix = `${matchId}#`;
    for (const k of [...this.stats.keys()]) if (k.startsWith(prefix)) this.stats.delete(k);
  }

  clear(): void {
    this.stats.clear();
  }

  /** Number of innings still being tracked (for leak tests). */
  get size(): number {
    return this.stats.size;
  }

  apply(s: MatchState): MatchState {
    const st = this.stats.get(this.key(s));
    if (!st) return s;
    const out: MatchState = { ...s };
    out.ballsObserved = st.balls;
    if (st.balls > 0) out.dotBallPct = Math.round((st.dots / st.balls) * 1000) / 10;
    out.boundaries = { fours: st.fours, sixes: st.sixes };
    const ppOvers = s.format === 'T20' ? 6 : s.format === 'ODI' ? 10 : 0;
    if (ppOvers > 0) {
      out.powerplay = st.powerplay
        ? { ...st.powerplay, complete: true }
        : { runs: s.score.runs, wkts: s.score.wkts, complete: false };
    }
    return out;
  }
}
