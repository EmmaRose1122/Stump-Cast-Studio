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
 * Probability (0-1) that the BATTING side wins, as a documented logistic estimate:
 *
 * Chasing (second innings): expected further runs = ballsLeft/6 * par rate * resource, where
 * resource = 0.35 + 0.65 * (wicketsLeft/10) models how wickets constrain scoring. The margin
 * z = (expected - runsNeeded) / sigma with sigma = 6 + 0.1 * ballsLeft (more uncertainty with
 * more balls to go). p = logistic(z).
 *
 * Setting a total (first innings): z = (projected - par) / (20 + 0.15 * ballsLeft), shrunk to
 * stay close to 0.5 early. p = logistic(z).
 *
 * This is a rough estimate, not a calibrated model. Returns undefined for Tests/unknown formats
 * (a draw outcome and match situation are not modelled).
 */
export const battingWinProb = (s: MatchState): number | undefined => {
  const limit = s.oversLimit ?? oversLimit(s.format);
  if (limit === undefined || s.ballsLeft === undefined || s.wicketsLeft === undefined) {
    return undefined;
  }
  const par = limit >= 40 ? PAR.ODI : PAR.T20;
  // Par for the innings actually being played: a 10-over game is not measured against 165.
  const parTotal = Math.round(par.rate * limit);
  if (s.target !== undefined && s.runsNeeded !== undefined) {
    if (s.runsNeeded === 0) return 1;
    if (s.ballsLeft === 0 || s.wicketsLeft === 0) return 0;
    const resource = 0.35 + 0.65 * (s.wicketsLeft / 10);
    const expected = (s.ballsLeft / 6) * par.rate * resource;
    const sigma = 6 + 0.1 * s.ballsLeft;
    return round(logistic((expected - s.runsNeeded) / sigma), 3);
  }
  if (s.projected === undefined) return undefined;
  const sigma = 20 + 0.15 * s.ballsLeft;
  return round(logistic((s.projected - parTotal) / sigma), 3);
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
      s.projected = Math.round(s.score.runs + s.crr * oversLeft);
      s.projectedPlus2 = Math.round(s.score.runs + (s.crr + 2) * oversLeft);
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

  const p = battingWinProb(s);
  if (p !== undefined) {
    const battingIsA = s.battingTeamId === s.teams[0].id;
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
