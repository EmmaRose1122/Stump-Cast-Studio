import { oversDecimal, runRate, type MatchFormat, type MatchState } from './match';

/** Overs per innings for limited-overs formats; undefined for Tests/unknown. */
export const oversLimit = (format: MatchFormat): number | undefined =>
  format === 'T20' ? 20 : format === 'ODI' ? 50 : undefined;

const round = (n: number, dp = 2): number => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

/** Divide without ever producing NaN or Infinity. */
export const safeDiv = (a: number, b: number): number => {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return 0;
  const r = a / b;
  return Number.isFinite(r) ? r : 0;
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const logistic = (z: number) => 1 / (1 + Math.exp(-z));

/** Typical first-innings par and per-over scoring rate used by the win-probability estimate. */
const PAR: Record<'T20' | 'ODI', { total: number; rate: number }> = {
  T20: { total: 165, rate: 8.2 },
  ODI: { total: 270, rate: 5.4 },
};

/**
 * Probability (0-1) that the BATTING side wins, as a calibrated cricket logistic estimate:
 *
 * Chasing (second innings):
 * Models the required run rate (RRR) against realistic achievable scoring tempo based on wickets
 * in hand and balls remaining. Batting teams with wickets in hand accelerate in the death overs.
 *
 * Setting a total (first innings):
 * Projected score vs format par total, scaled by remaining overs and wickets in hand.
 *
 * Returns undefined for Tests/unknown formats where win probability is not modelled.
 */
export const battingWinProb = (s: MatchState): number | undefined => {
  const limit = s.oversLimit ?? oversLimit(s.format);
  if (limit === undefined || s.ballsLeft === undefined || s.wicketsLeft === undefined) {
    return undefined;
  }

  // Pre-match or start of 1st innings with 0 balls bowled: 50/50 balance
  if (
    s.status === 'pre' ||
    (s.currentInnings <= 1 && s.score.overs === 0 && s.score.balls === 0 && s.score.runs === 0)
  ) {
    return 0.5;
  }

  const par = limit >= 40 ? PAR.ODI : PAR.T20;
  // Par for the innings actually being played: a 10-over game is not measured against 165.
  const parTotal = Math.round(par.rate * limit);

  // ---- Chasing (Second Innings) ----
  if (s.target !== undefined && s.runsNeeded !== undefined) {
    if (s.runsNeeded <= 0) return 1;
    if (s.ballsLeft === 0 || s.wicketsLeft === 0) return 0;

    const oversLeft = s.ballsLeft / 6;
    const rrr = safeDiv(s.runsNeeded, s.ballsLeft) * 6;

    // Resource factor based on wickets in hand (power curve: 7 wkts is ~85% capability)
    const resource = Math.pow(clamp(s.wicketsLeft, 0, 10) / 10, 0.45);

    // Death overs acceleration: teams with wickets can accelerate in final overs
    const deathBoost = limit <= 25 && oversLeft <= 6 ? 1.12 : 1.0;

    // Aggression allowance: batting teams adapt their tempo when chasing with wickets in hand
    const aggression = Math.min(1.5, Math.max(0, (s.wicketsLeft - 3) / 10));
    const targetTempo = (par.rate + aggression * 1.6) * deathBoost;

    // Achievable run rate benchmark
    const achievableRate = targetTempo * (0.4 + 0.6 * resource);

    // Run rate gap: how achievable is the required rate?
    const rateGap = achievableRate - rrr;
    const runDiff = rateGap * oversLeft;

    // Uncertainty sigma: variance is proportional to balls left
    const sigma = 10 + 0.22 * s.ballsLeft;
    const z = runDiff / sigma;
    return round(clamp(logistic(z), 0.005, 0.995), 3);
  }

  // ---- Setting a Total (First Innings) ----
  if (s.projected === undefined) return undefined;
  if (s.ballsLeft === 0 || s.wicketsLeft === 0) {
    const sigma = 18;
    return round(clamp(logistic((s.score.runs - parTotal) / sigma), 0.01, 0.99), 3);
  }
  const sigma = 20 + 0.15 * s.ballsLeft;
  return round(clamp(logistic((s.projected - parTotal) / sigma), 0.02, 0.98), 3);
};

/** Pure derived statistics from a base state (no history needed). */
export const deriveStats = (base: MatchState): MatchState => {
  const s: MatchState = { ...base };
  s.crr = runRate(s.score);
  const limit = s.oversLimit ?? oversLimit(s.format);
  s.wicketsLeft = clamp(10 - s.score.wkts, 0, 10);

  if (limit !== undefined) {
    const bowled = s.score.overs * 6 + s.score.balls;
    s.ballsLeft = Math.max(0, limit * 6 - bowled);

    // Target: provider value, else first-innings total + 1 when chasing.
    if (s.target === undefined && s.currentInnings === 2 && s.innings[0]) {
      s.target = s.innings[0].score.runs + 1;
    }
    if (s.target !== undefined) {
      s.runsNeeded = Math.max(0, s.target - s.score.runs);
      s.rrr = s.ballsLeft > 0 ? round(safeDiv(s.runsNeeded, s.ballsLeft) * 6) : undefined;
      if (s.runsNeeded === 0) s.rrr = 0;
    }

    if (s.currentInnings === 1 || s.target === undefined) {
      const oversLeft = s.ballsLeft / 6;
      if (s.ballsLeft === 0 || s.wicketsLeft === 0) {
        s.projected = s.score.runs;
        s.projectedPlus2 = s.score.runs;
      } else if (s.score.overs === 0 && s.score.balls === 0 && s.score.runs === 0) {
        const par = limit >= 40 ? PAR.ODI : PAR.T20;
        const parTotal = Math.round(par.rate * limit);
        s.projected = parTotal;
        s.projectedPlus2 = parTotal + Math.round(2 * limit);
      } else {
        s.projected = Math.round(s.score.runs + s.crr * oversLeft);
        s.projectedPlus2 = Math.round(s.score.runs + (s.crr + 2) * oversLeft);
      }
    }
  }

  // Test lead/trail from innings totals of the batting side vs the rest.
  if (s.format === 'TEST' && s.innings.length > 0) {
    let mine = 0;
    let theirs = 0;
    for (const inn of s.innings) {
      if (inn.battingTeamId === s.battingTeamId) mine += inn.score.runs;
      else theirs += inn.score.runs;
    }
    s.lead = mine - theirs;
  }

  // Completed match: winner gets 100%, loser 0%
  if (s.status === 'result' && s.teams.length >= 2) {
    const res = (s.result ?? '').toLowerCase();
    const tA = s.teams[0];
    const tB = s.teams[1];
    const aWon = res.includes(tA.name.toLowerCase()) || res.includes(tA.short.toLowerCase());
    const bWon = res.includes(tB.name.toLowerCase()) || res.includes(tB.short.toLowerCase());
    if (aWon && !bWon) {
      s.winProb = { teamA: 1, teamB: 0 };
      return s;
    }
    if (bWon && !aWon) {
      s.winProb = { teamA: 0, teamB: 1 };
      return s;
    }
    if (res.includes('tied') || res.includes('draw') || res.includes('no result')) {
      s.winProb = { teamA: 0.5, teamB: 0.5 };
      return s;
    }
  }

  const p = battingWinProb(s);
  if (p !== undefined) {
    const batId = s.battingTeamId ?? s.teams[0].id;
    const battingIsA = batId === s.teams[0].id;
    // Round one side only, so the pair can never display as 51/50 or 99%.
    const a = round(battingIsA ? p : 1 - p, 3);
    s.winProb = { teamA: a, teamB: round(1 - a, 3) };
  } else if (!base.winProb) {
    delete s.winProb;
  }

  // Keep `oversDecimal` referenced for consumers deriving their own rates.
  void oversDecimal;
  return s;
};
