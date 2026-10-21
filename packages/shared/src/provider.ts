import { z } from 'zod';

/** Sites the extension has adapters for. */
export const SourceSiteSchema = z.enum(['cricbuzz', 'crex']);
export type SourceSite = z.infer<typeof SourceSiteSchema>;

/** Where a RawUpdate came from: a scraped site adapter or the built-in manual scorer. */
export const RawSourceSchema = z.enum(['cricbuzz', 'crex', 'manual', 'api']);
export type RawSource = z.infer<typeof RawSourceSchema>;

const oversField = z.object({
  overs: z.number().int().min(0),
  balls: z.number().int().min(0).max(5),
});

/**
 * What an adapter produces from one captured page/response. Every field under `fields` is
 * optional: adapters report what they could parse and list the rest in `missing`.
 */
export const RawUpdateSchema = z.object({
  source: RawSourceSchema,
  matchId: z.string().min(1),
  url: z.string().url(),
  /** Epoch ms when the page data was captured. */
  capturedAt: z.number().int().nonnegative(),
  /** 0-1: fraction of required fields parsed and passing sanity checks. */
  confidence: z.number().min(0).max(1),
  fields: z.object({
    title: z.string().optional(),
    status: z.string().optional(),
    venue: z.string().optional(),
    toss: z.string().optional(),
    teams: z
      .array(z.object({ name: z.string(), short: z.string().optional() }))
      .max(2)
      .default([]),
    innings: z
      .array(
        z
          .object({
            team: z.string(),
            runs: z.number().int().min(0),
            wkts: z.number().int().min(0).max(10),
          })
          .merge(oversField),
      )
      .default([]),
    batters: z
      .array(
        z.object({
          name: z.string(),
          runs: z.number().int().min(0),
          balls: z.number().int().min(0),
          fours: z.number().int().min(0).optional(),
          sixes: z.number().int().min(0).optional(),
          onStrike: z.boolean().optional(),
        }),
      )
      .default([]),
    bowler: z
      .object({
        name: z.string(),
        overs: z.number().int().min(0),
        balls: z.number().int().min(0).max(5).default(0),
        maidens: z.number().int().min(0),
        runs: z.number().int().min(0),
        wkts: z.number().int().min(0).max(10),
      })
      .optional(),
    thisOver: z.array(z.string()).default([]),
    lastBalls: z.array(z.string()).default([]),
    /** The page says the match has not started: the 0-0 innings below is a placeholder, not a score. */
    preMatch: z.boolean().optional(),
    partnership: z
      .object({ runs: z.number().int().min(0), balls: z.number().int().min(0) })
      .optional(),
    target: z.number().int().positive().optional(),
    crr: z.number().min(0).optional(),
    rrr: z.number().min(0).optional(),
    day: z.number().int().min(1).max(5).optional(),
    session: z.string().optional(),
    resultText: z.string().optional(),
    commentaryLast: z.string().optional(),
    /** Sources that know the format (the manual scorer) say so instead of guessing from text. */
    format: z.enum(['T20', 'ODI', 'TEST', 'OTHER']).optional(),
    oversLimit: z.number().int().positive().optional(),
  }),
  /** Names of expected fields the adapter could not find. */
  missing: z.array(z.string()).default([]),
});
export type RawUpdate = z.infer<typeof RawUpdateSchema>;

export const ProviderHealthSchema = z.enum(['connected', 'stale', 'down']);
export type ProviderHealth = z.infer<typeof ProviderHealthSchema>;

export const MatchSummarySchema = z.object({
  matchId: z.string().min(1),
  title: z.string(),
  teams: z.array(z.string()).max(2),
  status: z.string().optional(),
  source: z.string(),
});
export type MatchSummary = z.infer<typeof MatchSummarySchema>;

export type Unsubscribe = () => void;

/** DP-1: every data source (extension, manual, API) implements this. */
export interface MatchProvider {
  id: string;
  listMatches(): Promise<MatchSummary[]>;
  subscribe(matchId: string, cb: (raw: unknown) => void): Unsubscribe;
  snapshot(matchId: string): Promise<unknown>;
  health(): ProviderHealth;
}
