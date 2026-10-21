import type { BallEvent, EngineEvent, EngineEventType, MatchState } from '@stumpcast/shared';
import { oversLimit } from './derive';

const MAX_REMEMBERED_IDS = 5000;
/** A jump bigger than this many legal balls is treated as a re-sync, not live action. */
const MAX_CATCH_UP_BALLS = 18;

const legalBalls = (s: MatchState) => s.score.overs * 6 + s.score.balls;
const isLegal = (b: BallEvent) =>
  !b.extras || (b.extras.type !== 'wide' && b.extras.type !== 'noball');
const isPlaceholder = (id: string) => id.startsWith('unknown-');

/**
 * Turns successive MatchStates into discrete broadcast events.
 *
 * - Idempotent: every event has a deterministic id and is emitted at most once.
 * - The first state seen for a match (and the first after `resync`) is only a baseline.
 * - Batches of several balls are replayed in order using the this-over/last-six token stream,
 *   falling back to score deltas when more balls arrive than the stream can describe.
 */
export class EventDetector {
  private readonly last = new Map<string, MatchState>();
  private readonly seen = new Set<string>();
  private readonly resyncing = new Set<string>();
  /** Illegal deliveries seen inside each legal-ball slot, so each keeps its own event id. */
  private readonly extrasInSlot = new Map<string, number>();

  /** Mark the next state of a match as a baseline (call after a reconnect/snapshot). */
  resync(matchId: string): void {
    this.resyncing.add(matchId);
  }

  /**
   * Drop everything remembered about a match. Called when the operator undoes a ball or the match
   * is deleted: without it, re-scoring the same ball finds its event id already in `seen` and
   * fires nothing at all — the score moves on air while the moment stays silent.
   */
  forget(matchId: string): void {
    const prefix = `${matchId}:`;
    for (const id of [...this.seen]) if (id.startsWith(prefix)) this.seen.delete(id);
    for (const key of [...this.extrasInSlot.keys()]) {
      if (key.startsWith(prefix)) this.extrasInSlot.delete(key);
    }
    this.last.delete(matchId);
    this.resyncing.delete(matchId);
  }

  /** External providers may flag a DRS review; this turns that into a DRS event. */
  drs(state: MatchState, payload: Record<string, unknown> = {}): EngineEvent | null {
    const key = `${state.id}:${state.currentInnings}:DRS:${legalBalls(state)}:${state.score.runs}`;
    return this.make(state, 'DRS', key, payload);
  }

  observe(next: MatchState): EngineEvent[] {
    const prev = this.last.get(next.id);
    this.last.set(next.id, next);

    if (!prev || this.resyncing.delete(next.id)) return [];

    const out: EngineEvent[] = [];
    const push = (type: EngineEventType, key: string, payload: Record<string, unknown> = {}) => {
      const e = this.make(next, type, key, payload);
      if (e) out.push(e);
    };
    const inn = prev.currentInnings;

    // New innings: close the old one, then baseline the new one (no ball-level events).
    if (next.currentInnings !== prev.currentInnings) {
      if (next.currentInnings > prev.currentInnings) {
        push('INNINGS_END', `${next.id}:${inn}:INNINGS_END`, {
          innings: inn,
          score: prev.score,
          teamId: prev.battingTeamId,
        });
      }
      const prefix = `${next.id}:`;
      for (const k of [...this.extrasInSlot.keys()]) if (k.startsWith(prefix)) this.extrasInSlot.delete(k);
      return out;
    }

    const nBalls = legalBalls(next) - legalBalls(prev);
    const runsDelta = next.score.runs - prev.score.runs;
    if (nBalls < 0 || runsDelta < 0 || nBalls > MAX_CATCH_UP_BALLS) return out; // correction/resync

    const base = legalBalls(prev);
    const newTokens = this.newTokens(prev, next, nBalls);
    const wktDelta = Math.max(0, next.score.wkts - prev.score.wkts);

    // --- ball by ball -----------------------------------------------------------------------
    let pos = base;
    let sub = 0;
    let wicketsEmitted = 0;
    for (const b of newTokens) {
      const before = pos;
      if (isLegal(b)) pos++;
      // Extras share the legal-ball slot they were bowled in. The counter has to live on the
      // instance, not just inside this loop: an over of only wides/no-balls arrives as several
      // separate states, and each one would otherwise restart at 1 and collide on the event id.
      const slot = `${next.id}:${inn}:${pos}`;
      if (pos === before) {
        sub = (this.extrasInSlot.get(slot) ?? 0) + 1;
        this.extrasInSlot.set(slot, sub);
      } else {
        this.extrasInSlot.delete(`${next.id}:${inn}:${before}`);
        sub = 0;
      }
      const at = {
        over: Math.floor((Math.max(pos, 1) - 1) / 6),
        ball: ((Math.max(pos, 1) - 1) % 6) + 1,
        batterId: b.batterId,
      };
      // `runs` is always off the bat, so a no-ball four is still a four; extras are scored separately.
      if (b.runs === 4) push('FOUR', `${next.id}:${inn}:${pos}.${sub}:FOUR`, at);
      else if (b.runs === 6) push('SIX', `${next.id}:${inn}:${pos}.${sub}:SIX`, at);
      if (b.wicket && wicketsEmitted < wktDelta) {
        wicketsEmitted++;
        const n = prev.score.wkts + wicketsEmitted;
        push('WICKET', `${next.id}:${inn}:W${n}`, this.wicketPayload(prev, next, n));
      }
    }
    // Wickets the token stream could not place (run outs shown differently, large batches).
    for (; wicketsEmitted < wktDelta; wicketsEmitted++) {
      const n = prev.score.wkts + wicketsEmitted + 1;
      push('WICKET', `${next.id}:${inn}:W${n}`, this.wicketPayload(prev, next, n));
    }

    // `lastBalls` carries at most 6 tokens, but a stalled feed may deliver up to
    // MAX_CATCH_UP_BALLS legal balls in one update. Those boundaries would vanish silently
    // (wickets survive the fallback above), so recover them from the batters' counters.
    if (nBalls > newTokens.filter(isLegal).length) {
      const at = base + nBalls;
      const where = {
        over: Math.floor((Math.max(at, 1) - 1) / 6),
        ball: ((Math.max(at, 1) - 1) % 6) + 1,
      };
      for (const nb of next.batters) {
        const pb = prev.batters.find((b) => b.playerId === nb.playerId);
        if (!pb || isPlaceholder(nb.playerId)) continue;
        for (let k = pb.fours + 1; k <= nb.fours; k++)
          push('FOUR', `${next.id}:${inn}:B${nb.playerId}:F${k}`, { ...where, batterId: nb.playerId });
        for (let k = pb.sixes + 1; k <= nb.sixes; k++)
          push('SIX', `${next.id}:${inn}:B${nb.playerId}:S${k}`, { ...where, batterId: nb.playerId });
      }
    }

    // --- individual milestones -------------------------------------------------------------
    for (const nb of next.batters) {
      const pb = prev.batters.find((b) => b.playerId === nb.playerId);
      if (!pb || isPlaceholder(nb.playerId)) continue;
      const k = `${next.id}:${inn}:${nb.playerId}`;
      if (pb.runs < 50 && nb.runs >= 50)
        push('FIFTY', `${k}:FIFTY`, { name: nb.name, runs: nb.runs, balls: nb.balls });
      if (pb.runs < 100 && nb.runs >= 100)
        push('HUNDRED', `${k}:HUNDRED`, { name: nb.name, runs: nb.runs, balls: nb.balls });
      for (const m of [150, 200, 250, 300]) {
        if (pb.runs < m && nb.runs >= m)
          push('MILESTONE', `${k}:BAT${m}`, { kind: 'batter', name: nb.name, runs: nb.runs });
      }
    }

    // --- team / partnership milestones ------------------------------------------------------
    const step = next.format === 'TEST' ? 100 : 50;
    for (
      let m = Math.floor(prev.score.runs / step) * step + step;
      m <= next.score.runs;
      m += step
    ) {
      push('MILESTONE', `${next.id}:${inn}:TEAM${m}`, {
        kind: 'team',
        runs: m,
        teamId: next.battingTeamId,
      });
    }
    for (const m of [50, 100, 150, 200]) {
      if (prev.partnership.runs < m && next.partnership.runs >= m) {
        push('MILESTONE', `${next.id}:${inn}:P${m}:${next.score.wkts}`, {
          kind: 'partnership',
          runs: next.partnership.runs,
        });
      }
    }

    // --- new batter -----------------------------------------------------------------------
    if (wktDelta > 0) {
      for (const nb of next.batters) {
        const known = prev.batters.some((b) => b.playerId === nb.playerId);
        if (!known && !isPlaceholder(nb.playerId)) {
          push('NEW_BATTER', `${next.id}:${inn}:NB:${nb.playerId}`, {
            playerId: nb.playerId,
            name: nb.name,
          });
        }
      }
    }

    // --- overs ----------------------------------------------------------------------------
    const completedBefore = Math.floor(base / 6);
    const completedAfter = Math.floor(legalBalls(next) / 6);
    for (let o = completedBefore + 1; o <= completedAfter; o++) {
      push('OVER_END', `${next.id}:${inn}:OVER${o}`, { over: o, score: next.score });
    }

    // --- innings / session / day end --------------------------------------------------------
    const limit = next.oversLimit ?? oversLimit(next.format);
    const allOut = next.score.wkts >= 10 && prev.score.wkts < 10;
    const oversUp = limit !== undefined && legalBalls(next) >= limit * 6 && base < limit * 6;
    const targetHit = next.runsNeeded === 0 && prev.runsNeeded !== 0 && next.target !== undefined;
    const breakNow = next.status === 'innings_break' && prev.status !== 'innings_break';
    if (allOut || oversUp || targetHit || breakNow) {
      push('INNINGS_END', `${next.id}:${inn}:INNINGS_END`, {
        innings: inn,
        score: next.score,
        teamId: next.battingTeamId,
      });
    }
    if (next.format === 'TEST' && next.status === 'break' && prev.status !== 'break') {
      if (next.session === 'evening') {
        push('DAY_END', `${next.id}:DAY${next.day ?? 0}`, { day: next.day });
      } else {
        push('SESSION_END', `${next.id}:DAY${next.day ?? 0}:${next.session ?? 'session'}`, {
          day: next.day,
          session: next.session,
        });
      }
    }

    return out;
  }

  // ---- helpers ----------------------------------------------------------------------------

  private make(
    s: MatchState,
    type: EngineEventType,
    key: string,
    payload: Record<string, unknown>,
  ): EngineEvent | null {
    const id = `${key}`;
    if (this.seen.has(id)) return null;
    this.seen.add(id);
    if (this.seen.size > MAX_REMEMBERED_IDS) {
      const first = this.seen.values().next().value as string;
      this.seen.delete(first);
    }
    return { id, matchId: s.id, type, at: s.updatedAt, payload };
  }

  /** The balls (legal and extras) that arrived between two states, oldest first. */
  private newTokens(prev: MatchState, next: MatchState, legalDelta: number): BallEvent[] {
    if (legalDelta === 0 && next.score.runs === prev.score.runs) return [];
    const tail = next.lastBalls;
    // Smallest suffix of the stream that contains exactly `legalDelta` legal balls.
    for (let k = Math.max(1, legalDelta); k <= tail.length; k++) {
      const slice = tail.slice(tail.length - k);
      if (slice.filter(isLegal).length === legalDelta) {
        return slice;
      }
    }
    return legalDelta > tail.length ? [] : tail;
  }

  private wicketPayload(prev: MatchState, next: MatchState, n: number): Record<string, unknown> {
    const out = prev.batters.find((b) => !next.batters.some((x) => x.playerId === b.playerId));
    return {
      wickets: n,
      score: next.score,
      bowlerId: next.bowler.playerId,
      bowler: next.bowler.name,
      outPlayerId: out?.playerId,
      out: out?.name,
      outRuns: out?.runs,
      outBalls: out?.balls,
    };
  }
}
