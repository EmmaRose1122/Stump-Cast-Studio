import type { BallEvent, MatchState } from '@stumpcast/shared';

export const oversText = (s: Pick<MatchState['score'], 'overs' | 'balls'>): string =>
  `${s.overs}.${s.balls}`;

export const scoreText = (s: MatchState['score']): string => `${s.runs}-${s.wkts}`;

export const battingTeam = (s: MatchState) =>
  s.teams.find((t) => t.id === s.battingTeamId) ?? s.teams[0];

export const bowlingTeam = (s: MatchState) => {
  const b = battingTeam(s);
  return s.teams.find((t) => t.id !== b.id) ?? s.teams[1];
};

const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

/** One short line describing the match situation, or null when there is nothing to say. */
export const situationText = (s: MatchState): string | null => {
  if (s.status === 'result' && s.result) return s.result;
  if (s.runsNeeded !== undefined && s.target !== undefined) {
    if (s.runsNeeded === 0) return `${battingTeam(s).short} have reached the target`;
    // A feed can report a chase with no balls left; "Need 1 off 0" is not a situation, it is a bug.
    if (s.ballsLeft === undefined || s.ballsLeft === 0) {
      return `${battingTeam(s).short} need ${s.runsNeeded} to reach ${s.target}`;
    }
    return `Need ${s.runsNeeded} off ${s.ballsLeft}`;
  }
  if (s.format === 'TEST') {
    const day = s.day !== undefined ? `Day ${s.day}` : null;
    const session = s.session ? cap(s.session) : null;
    const lead =
      s.lead === undefined
        ? null
        : s.lead >= 0
          ? `Lead by ${s.lead}`
          : `Trail by ${Math.abs(s.lead)}`;
    return [day, session, lead].filter(Boolean).join(' · ') || null;
  }
  if (s.projected !== undefined) return `Projected ${s.projected}`;
  return null;
};

export interface BallChip {
  label: string;
  /** dot | run | four | six | wicket | extra */
  kind: string;
}

/** Display model for one delivery in the this-over strip. */
export const ballChip = (b: BallEvent): BallChip => {
  if (b.wicket) return { label: 'W', kind: 'wicket' };
  if (b.extras) {
    const short = { wide: 'wd', noball: 'nb', bye: 'b', legbye: 'lb', penalty: 'p' }[b.extras.type];
    return { label: b.extras.runs > 1 ? `${b.extras.runs}${short}` : short, kind: 'extra' };
  }
  if (b.runs === 0) return { label: '•', kind: 'dot' };
  if (b.runs === 4) return { label: '4', kind: 'four' };
  if (b.runs === 6) return { label: '6', kind: 'six' };
  return { label: String(b.runs), kind: 'run' };
};

export const pct = (n: number): string => `${Math.round(n * 100)}%`;

/** Strike rate, or an em dash before a batter has faced a ball (never a fabricated 0.0). */
export const strikeRate = (runs: number, balls: number): string =>
  balls > 0 ? ((runs / balls) * 100).toFixed(1) : '—';

/** Economy rate off the bowler's part-overs; an em dash until they have bowled one. */
export const economyRate = (runs: number, overs: number, balls: number): string => {
  const o = overs + balls / 6;
  return o > 0 ? (runs / o).toFixed(2) : '—';
};
