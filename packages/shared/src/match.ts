import { z } from 'zod';
import { BallEventSchema, WicketSchema } from './ball';
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

/** Best batting figures seen anywhere in a match, accumulated from the snapshots. */
export const BattingFigureSchema = z.object({
  playerId: z.string().min(1),
  name: z.string().min(1),
  runs: z.number().int().min(0),
  balls: z.number().int().min(0),
  fours: z.number().int().min(0),
  sixes: z.number().int().min(0),
  innings: z.number().int().min(1),
});
export type BattingFigure = z.infer<typeof BattingFigureSchema>;

/** Best bowling figures seen anywhere in a match, accumulated from the snapshots. */
export const BowlingFigureSchema = z.object({
  playerId: z.string().min(1),
  name: z.string().min(1),
  overs: z.number().int().min(0),
  balls: z.number().int().min(0).max(5),
  maidens: z.number().int().min(0),
  runs: z.number().int().min(0),
  wkts: z.number().int().min(0).max(10),
  innings: z.number().int().min(1),
});
export type BowlingFigure = z.infer<typeof BowlingFigureSchema>;

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
  /** Estimate only. teamA/teamB follow `teams` order and are the two halves of one number. Absent for Tests (see engine docs). */
  winProb: z
    .object({ teamA: z.number().min(0).max(1), teamB: z.number().min(0).max(1) })
    .refine((p) => Math.abs(p.teamA + p.teamB - 1) <= 0.002, 'win probabilities must sum to 1')
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
  /**
   * Extras given away this innings, split by type. The score already includes them; this is the
   * breakdown a scorecard line (`7 (b 0, lb 3, w 4, nb 0, p 0)`) needs and a feed never sends.
   */
  extras: z
    .object({
      wide: z.number().int().min(0),
      noball: z.number().int().min(0),
      bye: z.number().int().min(0),
      legbye: z.number().int().min(0),
      penalty: z.number().int().min(0),
    })
    .optional(),
  /**
   * The wicket the commentary is still talking about. A broadcast that never shows who just fell
   * looks like a scoreboard that forgot to update, so the last dismissal stays on the bar until
   * the next one. Figures are the best the feed showed for that batter before they got out.
   */
  lastWicket: z
    .object({
      name: z.string().min(1),
      runs: z.number().int().min(0),
      balls: z.number().int().min(0),
      /** Only when the feed said how; ball-by-ball tokens usually do not. */
      kind: WicketSchema.shape.kind.optional(),
      /** Team score and delivery when it fell. */
      teamRuns: z.number().int().min(0),
      wkts: z.number().int().min(0).max(10),
      over: z.number().int().min(0),
      ball: z.number().int().min(1),
    })
    .optional(),
  /**
   * The feed only publishes the pair at the crease and the bowler running in, so these are the
   * best figures seen anywhere in the match. Absent when the snapshots carried no player rows.
   */
  topBatters: z.array(BattingFigureSchema).optional(),
  topBowlers: z.array(BowlingFigureSchema).optional(),
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
