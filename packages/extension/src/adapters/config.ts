import { z } from 'zod';
import { SourceSiteSchema } from '@stumpcast/shared';

/**
 * Flat field ids a selector config may populate. The engine assembles them into a RawUpdate.
 * `inn1..inn4` are per-innings totals (used by Tests); `score`/`overs`/`battingTeam` describe the
 * current innings and are used when no `innN.*` fields are mapped.
 */
const innings = (n: number) => [`inn${n}.team`, `inn${n}.score`, `inn${n}.overs`] as const;

export const FIELD_KEYS = [
  'title',
  'status',
  'venue',
  'toss',
  'resultText',
  'commentaryLast',
  'team1',
  'team2',
  'battingTeam',
  'score',
  'overs',
  ...innings(1),
  ...innings(2),
  ...innings(3),
  ...innings(4),
  'batter1.name',
  'batter1.runs',
  'batter1.balls',
  'batter1.fours',
  'batter1.sixes',
  'batter2.name',
  'batter2.runs',
  'batter2.balls',
  'batter2.fours',
  'batter2.sixes',
  'bowler.name',
  'bowler.overs',
  'bowler.maidens',
  'bowler.runs',
  'bowler.wkts',
  'thisOver',
  'lastBalls',
  'partnership',
  'target',
  'crr',
  'rrr',
  'day',
  'session',
] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];

const FieldKeySchema = z.enum(FIELD_KEYS);
export const TRANSFORMS = ['trim', 'lower', 'upper', 'number', 'digits'] as const;

const regexString = z.string().refine((s) => {
  try {
    new RegExp(s);
    return true;
  } catch {
    return false;
  }
}, 'invalid regular expression');

export const DomRuleSchema = z.object({
  /** Tried in order; the first element with a non-empty value wins. */
  selectors: z.array(z.string().min(1)).min(1),
  /** Read this attribute instead of textContent. */
  attr: z.string().optional(),
  /** Applied to the text; group 1 is used when present, otherwise the whole match. */
  regex: regexString.optional(),
  transform: z.enum(TRANSFORMS).optional(),
});
export type DomRule = z.infer<typeof DomRuleSchema>;

export const JsonTapSchema = z.object({
  /** Matched against the URL of responses the page itself fetched. */
  urlRegex: regexString,
  /** field -> path such as `$.score.runs` or `data.innings[0].overs`. */
  map: z.record(FieldKeySchema, z.string().min(1)),
});

export const SelectorConfigSchema = z.object({
  version: z.number().int().positive(),
  site: SourceSiteSchema,
  urlPatterns: z.array(regexString),
  /** Regex on the page URL; group 1 becomes the matchId. Falls back to the URL path. */
  matchIdRegex: regexString.optional(),
  jsonTaps: z.array(JsonTapSchema).default([]),
  dom: z.record(FieldKeySchema, DomRuleSchema).default({}),
  /** Fields that must parse (and pass sanity checks) for full confidence. */
  minConfidenceFields: z.array(FieldKeySchema).default([]),
});
export type SelectorConfig = z.infer<typeof SelectorConfigSchema>;
