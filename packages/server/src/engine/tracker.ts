import type { BallEvent, MatchState } from '@stumpcast/shared';

interface InningsStats {
  over: number;
  counted: number;
  balls: number;
  dots: number;
  fours: number;
  sixes: number;
  powerplay?: { runs: number; wkts: number };
  extras: { wide: number; noball: number; bye: number; legbye: number; penalty: number };
  lastWicket?: MatchState['lastWicket'];
  /** Wicket count and crease names as of the last update, to spot who has just walked. */
  wkts: number;
  atCrease: string[];
}

const noExtras = (): InningsStats['extras'] => ({ wide: 0, noball: 0, bye: 0, legbye: 0, penalty: 0 });

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
  /** Best figures seen for each player, so a wicket can be named with its score. */
  private readonly batters = new Map<string, { name: string; runs: number; balls: number }>();

  private key(s: MatchState) {
    return `${s.id}#${s.currentInnings}`;
  }

  private add(st: InningsStats, balls: BallEvent[]) {
    for (const b of balls) {
      // Extras are conceded on every delivery, legal or not, and the score already counts them:
      // this is the split a scorecard line needs and no feed ever sends.
      if (b.extras) st.extras[b.extras.type] += b.extras.runs;
      if (!isLegalBall(b)) continue; // wides/no-balls are not "balls faced" for dot %
      st.balls++;
      if (isDot(b)) st.dots++;
      if (b.runs === 4) st.fours++;
      if (b.runs === 6) st.sixes++;
    }
  }

  /**
   * Who got out, worked out from who is no longer at the crease.
   *
   * The wicket's own `playerOutId` cannot be trusted here: a ball stream is rebuilt from tokens
   * like "W", and the batter id attached to that token is whoever the feed names *now* — after a
   * dismissal that is the incoming batter, so blaming the token would put the new man's name on
   * the chip. A score that went up while a name left the crease is the only evidence that holds
   * for both scraped pages and the manual scorer.
   */
  private noteWickets(st: InningsStats, s: MatchState, balls: BallEvent[]): void {
    if (s.score.wkts <= st.wkts) return;
    const atCrease = new Set(s.batters.map((b) => b.playerId));
    const gone = st.atCrease.filter((id) => !atCrease.has(id));
    const outId = gone[0];
    // A page can show the wicket ball and the same two batters in one update, then swap the man
    // out in the next. Hold the wicket back until there is a name to attach it to: the count is
    // not advanced, so the following update still resolves it.
    if (!outId) return;
    st.wkts = s.score.wkts;
    const seen = this.batters.get(`${s.id}#${outId}`);
    const fell = balls.find((b) => b.wicket);
    st.lastWicket = {
      name: seen?.name ?? outId,
      runs: seen?.runs ?? 0,
      balls: seen?.balls ?? 0,
      // Only a feed that states the dismissal says how; a bare "W" token rebuilds as "other",
      // which is the absence of information rather than a kind of dismissal.
      ...(fell?.wicket && fell.wicket.kind !== 'other' ? { kind: fell.wicket.kind } : {}),
      teamRuns: s.score.runs,
      wkts: s.score.wkts,
      over: fell?.over ?? s.score.overs,
      ball: fell?.ball ?? Math.max(1, s.score.balls),
    };
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
      st = {
        over: ov,
        counted: 0,
        balls: 0,
        dots: 0,
        fours: 0,
        sixes: 0,
        extras: noExtras(),
        wkts: s.score.wkts,
        atCrease: s.batters.map((b) => b.playerId),
      };
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

    // Recorded first: a feed that shows the wicket ball and the dismissed batter in the same
    // update carries his final figures right there, and the next update usually drops him.
    for (const b of s.batters) {
      this.batters.set(`${s.id}#${b.playerId}`, { name: b.name, runs: b.runs, balls: b.balls });
    }

    if (ov === st.over) {
      const fresh = s.thisOver.slice(st.counted);
      this.add(st, fresh);
      st.counted = s.thisOver.length;
    }
    // Outside the over check: a wicket on the last ball of an over is noted in the update that
    // already shows the next over's first ball.
    this.noteWickets(st, s, s.thisOver);

    // Powerplay: first observation at or after 6.0 overs in a T20 (10 in ODI) fixes the split.
    const ppOvers = s.format === 'T20' ? 6 : s.format === 'ODI' ? 10 : 0;
    if (ppOvers > 0 && !st.powerplay && s.score.overs >= ppOvers) {
      st.powerplay = { runs: s.score.runs, wkts: s.score.wkts };
    }

    st.atCrease = s.batters.map((b) => b.playerId);
  }

  /** Forget one match entirely, so a deleted-then-recreated id does not inherit stale counts. */
  remove(matchId: string): void {
    const prefix = `${matchId}#`;
    for (const k of [...this.stats.keys()]) if (k.startsWith(prefix)) this.stats.delete(k);
    for (const k of [...this.batters.keys()]) if (k.startsWith(prefix)) this.batters.delete(k);
  }

  clear(): void {
    this.stats.clear();
    this.batters.clear();
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
    out.extras = { ...st.extras };
    if (st.lastWicket) out.lastWicket = { ...st.lastWicket };
    const ppOvers = s.format === 'T20' ? 6 : s.format === 'ODI' ? 10 : 0;
    if (ppOvers > 0) {
      out.powerplay = st.powerplay
        ? { ...st.powerplay, complete: true }
        : { runs: s.score.runs, wkts: s.score.wkts, complete: false };
    }
    return out;
  }
}
