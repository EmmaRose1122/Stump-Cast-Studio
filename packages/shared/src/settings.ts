import { z } from 'zod';
import { EngineEventTypeSchema } from './event';
import { LayoutPresetIdSchema, OBS_LAYOUT_IDS } from './layouts';

export const CardIdSchema = z.string().min(1);

/** An engine event, or one of the two batter-score triggers the Director listens for. */
export const DirectorTriggerSchema = z.union([
  EngineEventTypeSchema,
  z.literal('BATTER_40'),
  z.literal('BATTER_90'),
]);
export type DirectorTrigger = z.infer<typeof DirectorTriggerSchema>;

export const DirectorRuleSchema = z.object({
  on: DirectorTriggerSchema,
  card: CardIdSchema,
  durationSec: z.number().min(1).max(60).default(8),
  cooldownSec: z.number().min(0).max(600).default(30),
  priority: z.number().int().default(0),
});
export type DirectorRule = z.infer<typeof DirectorRuleSchema>;

/** Card ids are lowercase slugs; they match the overlay's card registry. */
export const CardSlugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/);

/**
 * Smart-mode rules. `on` is an EngineEventType or one of BATTER_40 / BATTER_90 (a batter
 * crossing that score). A higher `priority` wins when several cards are waiting.
 */
export const DEFAULT_DIRECTOR_RULES: DirectorRule[] = [
  { on: 'OVER_END', card: 'manhattan', durationSec: 8, cooldownSec: 30, priority: 1 },
  { on: 'WICKET', card: 'bowler-spell', durationSec: 8, cooldownSec: 20, priority: 3 },
  { on: 'BATTER_40', card: 'striker-profile', durationSec: 8, cooldownSec: 60, priority: 2 },
  { on: 'BATTER_90', card: 'striker-profile', durationSec: 8, cooldownSec: 60, priority: 2 },
  { on: 'NEW_BATTER', card: 'striker-profile', durationSec: 6, cooldownSec: 20, priority: 2 },
  { on: 'MILESTONE', card: 'milestone', durationSec: 8, cooldownSec: 20, priority: 4 },
  { on: 'INNINGS_END', card: 'full-scorecard', durationSec: 12, cooldownSec: 60, priority: 5 },
];

export const DEFAULT_CAROUSEL_CARDS = [
  'manhattan',
  'striker-profile',
  'bowler-spell',
  'partnership',
];

export const SettingsSchema = z.object({
  syncDelaySec: z.number().min(0).max(60).default(0),
  /** Seconds without fresh data before the watchdog warns (error at twice this). */
  watchdogSec: z.number().min(5).max(600).default(30),
  /** Show a small "Data delayed" badge on the overlay while the watchdog is raised. */
  dataDelayedBadge: z.boolean().default(false),
  /** Match shown on the overlay (DP-6). Null means the first/most recent one. */
  onStreamMatchId: z.string().nullable().default(null),
  /** True once the first-run wizard has been finished (it can be reopened from Help). */
  setupComplete: z.boolean().default(false),
  /** Server timestamp when the operator accepted responsibility for source-site terms. */
  sourceTermsAcceptedAt: z.number().int().positive().nullable().default(null),
  cardScale: z.number().min(0.8).max(2).default(1),
  sideCardScale: z.number().min(0.8).max(2).default(1),
  cardWidth: z.enum(['narrow', 'normal', 'wide']).default('normal'),
  layout: z.enum(['arena', 'fullscreen', 'ticker', 'classic']).default('arena'),
  onAirScreen: z.enum(['auto', 'pre', 'live', 'innings_break', 'break', 'result']).default('auto'),
  theme: z.string().default('ink-gold'),
  video: z
    .object({
      sourceMode: z.enum(['off', 'obs', 'capture', 'stream', 'embed']).default('off'),
      sourceUrl: z.string().max(2048).default(''),
      activeObsLayout: LayoutPresetIdSchema.default('A'),
      sceneRotation: z.boolean().default(false),
      rotationSec: z.number().int().min(5).max(600).default(90),
      rotationLayouts: z.array(LayoutPresetIdSchema).default([...OBS_LAYOUT_IDS]),
      cameraMode: z.enum(['none', 'one', 'two']).default('none'),
      camerasOnBreaks: z.boolean().default(true),
      alignmentGuides: z.boolean().default(false),
      obsHost: z.string().max(255).default('127.0.0.1'),
      obsPort: z.number().int().min(1).max(65535).default(4455),
      obsScene: z.string().max(255).default(''),
      tvTheme: z.string().default('star-sports'),
      backgroundImage: z.string().max(2048).nullable().default(null),
      backgroundDim: z.number().min(0).max(0.8).default(0.3),
      obsMap: z.object({ matchVideo: z.string().max(255).default(''), cam1: z.string().max(255).default(''), cam2: z.string().max(255).default('') }).default({}),
    })
    .default({}),
  director: z
    .object({
      mode: z.enum(['smart', 'carousel', 'manual']).default('manual'),
      rules: z.array(DirectorRuleSchema).default(DEFAULT_DIRECTOR_RULES),
      carousel: z
        .object({
          cards: z.array(CardSlugSchema).min(1).max(20).default(DEFAULT_CAROUSEL_CARDS),
          intervalSec: z.number().min(5).max(120).default(15),
        })
        .default({}),
    })
    .default({}),
  preMatch: z
    .object({
      scene: z.enum(['auto', 'clock', 'toss', 'squad1', 'squad2']).default('auto'),
      clockSec: z.number().int().min(5).max(600).default(90),
      tossSec: z.number().int().min(5).max(600).default(45),
      squad1Sec: z.number().int().min(5).max(600).default(120),
      squad2Sec: z.number().int().min(5).max(600).default(90),
      matchLengthOvers: z.number().int().min(1).max(100).nullable().default(null),
      venue: z.string().max(255).default(''),
    })
    .default({}),
  sounds: z
    .object({
      masterVolume: z.number().min(0).max(1).default(0.8),
      autoCelebrations: z.boolean().default(true),
      auto: z
        .object({
          four: z.string().nullable().default(null),
          six: z.string().nullable().default(null),
          wicket: z.string().nullable().default(null),
          milestone: z.string().nullable().default(null),
        })
        .default({}),
    })
    .default({}),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const createSettings = (overrides: z.input<typeof SettingsSchema> = {}): Settings =>
  SettingsSchema.parse(overrides);
