import { z } from 'zod';
import { BallEventSchema } from './ball';
import { TeamSchema } from './team';

export const MatchFormatSchema = z.enum(['T20', 'ODI', 'TEST', 'OTHER']);
export const MatchStatusSchema = z.enum(['pre', 'live', 'break', 'innings_break', 'result']);

export const ScoreSchema = z.object({
  runs: z.number().int().min(0),
  wkts: z.number().int().min(0).max(10),
  overs: z.number().int().min(0),
  balls: z.number().int().min(0).max(5),
});
export type Score = z.infer<typeof ScoreSchema>;

export const InningsSchema = z.object({
  number: z.number().int().min(1),
  battingTeamId: z.string().min(1),
  score: ScoreSchema,
  declared: z.boolean().default(false),
  allOut: z.boolean().default(false),
});
export type Innings = z.infer<typeof InningsSchema>;

export const BatterSchema = z.object({
  playerId: z.string().min(1),
  name: z.string().min(1),
  runs: z.number().int().min(0),
  balls: z.number().int().min(0),
  fours: z.number().int().min(0),
  sixes: z.number().int().min(0),
  onStrike: z.boolean(),
});
export type Batter = z.infer<typeof BatterSchema>;

export const BowlerSchema = z.object({
  playerId: z.string().min(1),
  name: z.string().min(1),
  overs: z.number().int().min(0),
  balls: z.number().int().min(0).max(5),
  maidens: z.number().int().min(0),
  runs: z.number().int().min(0),
  wkts: z.number().int().min(0).max(10),
});
export type Bowler = z.infer<typeof BowlerSchema>;

export const TossSchema = z.object({
  winnerTeamId: z.string().min(1),
  decision: z.enum(['bat', 'bowl']),
});

export const MatchStateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  format: MatchFormatSchema,
  status: MatchStatusSchema,
  venue: z.string().optional(),
  toss: TossSchema.optional(),
  teams: z.tuple([TeamSchema, TeamSchema]),
  innings: z.array(InningsSchema),
  /** 1-based innings number; 0 before the match starts. */
  currentInnings: z.number().int().min(0),
  battingTeamId: z.string().min(1),
  score: ScoreSchema,
  target: z.number().int().positive().optional(),
  batters: z.tuple([BatterSchema, BatterSchema]),
  bowler: BowlerSchema,
  lastBalls: z.array(BallEventSchema).max(6),
  thisOver: z.array(BallEventSchema),
  partnership: z.object({ runs: z.number().int().min(0), balls: z.number().int().min(0) }),
  crr: z.number().min(0),
  rrr: z.number().min(0).optional(),
  projected: z.number().int().min(0).optional(),
  /** Projected total if the scoring rate rises by 2 an over. */
  projectedPlus2: z.number().int().min(0).optional(),
  /** Estimate only. teamA/teamB follow `teams` order. Absent for Tests (see engine docs). */
  winProb: z
    .object({ teamA: z.number().min(0).max(1), teamB: z.number().min(0).max(1) })
    .optional(),
  wicketsLeft: z.number().int().min(0).max(10).optional(),
  /** Legal balls remaining in a limited-overs innings. */
  ballsLeft: z.number().int().min(0).optional(),
  runsNeeded: z.number().int().min(0).optional(),
  /** Runs ahead (+) or behind (-) in a Test. */
  lead: z.number().int().optional(),
  powerplay: z
    .object({
      runs: z.number().int().min(0),
      wkts: z.number().int().min(0).max(10),
      complete: z.boolean(),
    })
    .optional(),
  /** Share of observed balls that were dots (0-100). Based on `ballsObserved`, not all balls. */
  dotBallPct: z.number().min(0).max(100).optional(),
  boundaries: z
    .object({ fours: z.number().int().min(0), sixes: z.number().int().min(0) })
    .optional(),
  ballsObserved: z.number().int().min(0).optional(),
  /** Overs per innings when it differs from the format default (e.g. a 10-over match). */
  oversLimit: z.number().int().positive().optional(),
  day: z.number().int().min(1).max(5).optional(),
  session: z.enum(['morning', 'afternoon', 'evening']).optional(),
  result: z.string().optional(),
  updatedAt: z.string().datetime(),
});
export type MatchState = z.infer<typeof MatchStateSchema>;

/** Overs as a decimal for rate maths: 11 overs 3 balls -> 11.5. */
export const oversDecimal = (s: Pick<Score, 'overs' | 'balls'>): number => s.overs + s.balls / 6;

/** Current run rate; 0 when no balls have been bowled (never NaN/Infinity). */
export const runRate = (s: Score): number => {
  const o = oversDecimal(s);
  return o === 0 ? 0 : Math.round((s.runs / o) * 100) / 100;
};

export type MatchFormat = z.infer<typeof MatchFormatSchema>;
export type MatchStatus = z.infer<typeof MatchStatusSchema>;
