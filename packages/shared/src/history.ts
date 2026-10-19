import { z } from 'zod';
import type { MatchState } from './match';

export const OverStatSchema = z.object({
  over: z.number().int().min(1),
  runs: z.number().int().min(0),
  wkts: z.number().int().min(0),
  /** True when the over was reconstructed from a gap in the feed. */
  approximate: z.boolean().default(false),
});

export const FallOfWicketSchema = z.object({
  wkts: z.number().int().min(1),
  runs: z.number().int().min(0),
  overs: z.number().int().min(0),
  balls: z.number().int().min(0).max(5),
  out: z.string().optional(),
});

export const InningsHistorySchema = z.object({
  number: z.number().int().min(1),
  battingTeamId: z.string(),
  overs: z.array(OverStatSchema),
  fow: z.array(FallOfWicketSchema),
  /** Runs at the end of each completed over (index 0 = after over 1). Drives the worm. */
  cumulative: z.array(z.number().int().min(0)),
});
export type InningsHistory = z.infer<typeof InningsHistorySchema>;

export const MatchHistorySchema = z.object({
  matchId: z.string(),
  innings: z.array(InningsHistorySchema),
});
export type MatchHistory = z.infer<typeof MatchHistorySchema>;

interface Acc {
  battingTeamId: string;
  /** exact[o] = (runs, wkts) when exactly o overs had been bowled. */
  exact: Map<number, { runs: number; wkts: number }>;
  last: { balls: number; runs: number; wkts: number };
  fow: InningsHistory['fow'];
  prevBatters: string[];
  prevWkts: number;
}

/**
 * Rebuild per-over and fall-of-wicket history from the stored state snapshots. Snapshots are
 * only written when something changed, so an over that was never seen at its boundary is
 * merged into the next one and flagged `approximate`.
 */
export const buildHistory = (matchId: string, states: MatchState[]): MatchHistory => {
  const byInnings = new Map<number, Acc>();

  for (const s of states) {
    if (s.currentInnings === 0) continue;
    let a = byInnings.get(s.currentInnings);
    if (!a) {
      a = {
        battingTeamId: s.battingTeamId,
        exact: new Map(),
        last: { balls: 0, runs: 0, wkts: 0 },
        fow: [],
        prevBatters: s.batters.map((b) => b.name),
        prevWkts: s.score.wkts,
      };
      byInnings.set(s.currentInnings, a);
    }
    const balls = s.score.overs * 6 + s.score.balls;
    if (s.score.balls === 0 && s.score.overs > 0) {
      a.exact.set(s.score.overs, { runs: s.score.runs, wkts: s.score.wkts });
    }
    a.last = { balls, runs: s.score.runs, wkts: s.score.wkts };

    if (s.score.wkts > a.prevWkts) {
      const names = new Set(s.batters.map((b) => b.name));
      const out = a.prevBatters.find((n) => !names.has(n) && n !== '—');
      for (let w = a.prevWkts + 1; w <= s.score.wkts; w++) {
        a.fow.push({
          wkts: w,
          runs: s.score.runs,
          overs: s.score.overs,
          balls: s.score.balls,
          out: w === s.score.wkts ? out : undefined,
        });
      }
    }
    a.prevWkts = s.score.wkts;
    a.prevBatters = s.batters.map((b) => b.name);
  }

  const innings: InningsHistory[] = [];
  for (const [number, a] of [...byInnings].sort((x, y) => x[0] - y[0])) {
    const completed = Math.floor(a.last.balls / 6);
    const overs: InningsHistory['overs'] = [];
    const cumulative: number[] = [];
    let prevRuns = 0;
    let prevWkts = 0;
    let gap = false;
    for (let o = 1; o <= completed; o++) {
      const e = a.exact.get(o);
      if (!e) {
        gap = true;
        continue;
      }
      overs.push({ over: o, runs: e.runs - prevRuns, wkts: e.wkts - prevWkts, approximate: gap });
      cumulative.push(e.runs);
      prevRuns = e.runs;
      prevWkts = e.wkts;
      gap = false;
    }
    innings.push({
      number,
      battingTeamId: a.battingTeamId,
      overs,
      fow: a.fow,
      cumulative,
    });
  }
  return { matchId, innings };
};
