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
  /**
   * Pictures the page already shows. Each is read with `attr: 'src'`, and the server files the
   * first one it sees for a team or player into the asset store — that is how a new team's crest
   * and a new batter's photo appear on air without anyone uploading them.
   */
  'team1.logo',
  'team2.logo',
  'batter1.photo',
  'batter2.photo',
  'bowler.photo',
  /**
   * A whole announced line-up. One field per side; the value is a JSON array of
   * `{ name, role, captain, keeper, imageUrl }` read by a `domLists` rule, because a squad is a
   * list of rows and every other field this engine reads is a single value.
   */
  'team1.squad',
  'team2.squad',
  'partnership',
  'target',
  'crr',
  'rrr',
  'day',
  'session',
  'format',
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
  /**
   * Text that must appear on the element's preceding sibling (or its container's leading
   * children). Sites reuse one class for both the "This Over" and "Recent" ball strips, so the
   * label is the only thing that tells them apart.
   */
  label: z.string().min(1).optional(),
});
export type DomRule = z.infer<typeof DomRuleSchema>;

/**
 * Reads a repeated block of rows — a Playing XI — into a JSON array.
 *
 * A squad is not one value, so it cannot go through `dom`. Instead the rule anchors on a heading
 * the page itself writes ("playing XI"), takes one column per side, and reads the same handful of
 * relative selectors off every row. Anchoring on the heading's words rather than on a positional
 * path is what keeps it alive when the site reorders or restyles the page: the words are the
 * contract with the reader, the classes are not.
 */
export const DomListRuleSchema = z.object({
  /** Heading text (whitespace/case-insensitive, whole) that identifies the block. */
  heading: z.string().min(1),
  /** Heading is looked for among these tags. Defaults to h1-h4. */
  headingSelectors: z.array(z.string().min(1)).default(['h1', 'h2', 'h3', 'h4']),
  /** The block is the heading's parent element, narrowed to this selector if given. */
  scope: z.string().optional(),
  /** Columns inside the block; column `index` is this field's team. */
  column: z.string().min(1),
  index: z.number().int().min(0),
  /** One row inside the column. */
  item: z.string().min(1),
  /** Relative to a row. `name` is required; the rest are optional extras. */
  name: z.string().min(1),
  role: z.string().optional(),
  /** Text like "(C)" / "(WK)". Absent means neither. */
  marker: z.string().optional(),
  image: z.string().optional(),
  /** Attribute holding the picture. */
  attr: z.string().default('src'),
});
export type DomListRule = z.infer<typeof DomListRuleSchema>;

export const JsonTapSchema = z.object({  /** Matched against the URL of responses the page itself fetched. */
  urlRegex: regexString,
  /**
   * field -> path such as `$.score.runs` or `data.innings[0].overs`.
   *
   * A value containing `${…}` is a template instead of a single path: sites split what the engine
   * parses as one value across several keys (`teamScore` + `teamWkts` -> "197/6"), so a template
   * composes them. It resolves only when every placeholder resolves to a non-empty value.
   */
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
  /** Line-ups: one rule per side, each producing a JSON array under its field. */
  domLists: z.record(FieldKeySchema, DomListRuleSchema).default({}),
  /** Fields that must parse (and pass sanity checks) for full confidence. */
  minConfidenceFields: z.array(FieldKeySchema).default([]),
  /** Optional page-specific variants (live, scorecard, squads, etc.) */
  pageVariants: z.record(z.object({
    urlPattern: regexString,
    jsonTaps: z.array(JsonTapSchema).default([]),
    dom: z.record(FieldKeySchema, DomRuleSchema).default({}),
    domLists: z.record(FieldKeySchema, DomListRuleSchema).default({}),
    minConfidenceFields: z.array(FieldKeySchema).default([]),
  })).optional(),
});
export type SelectorConfig = z.infer<typeof SelectorConfigSchema>;
