import { z } from 'zod';

export const ExtraSchema = z.object({
  type: z.enum(['wide', 'noball', 'bye', 'legbye', 'penalty']),
  runs: z.number().int().min(0),
});

export const WicketSchema = z.object({
  kind: z.enum([
    'bowled',
    'caught',
    'lbw',
    'runout',
    'stumped',
    'hitwicket',
    'retired',
    'obstructing',
    'other',
  ]),
  playerOutId: z.string().min(1),
});

/** Kinds that end the delivery with the batter credited no runs off the bat. */
const NO_RUN_WICKETS = ['bowled', 'lbw', 'stumped', 'hitwicket'];

export const BallEventSchema = z
  .object({
    over: z.number().int().min(0),
    ball: z.number().int().min(1),
    /** Runs off the bat. Above 6 only with overthrows; extras are a separate field. */
    runs: z.number().int().min(0).max(7),
    extras: ExtraSchema.optional(),
    wicket: WicketSchema.optional(),
    batterId: z.string().min(1),
    bowlerId: z.string().min(1),
  })
  .refine(
    (b) => !(b.wicket && NO_RUN_WICKETS.includes(b.wicket.kind) && b.runs > 0),
    'a batter out bowled/lbw/stumped/hit wicket cannot be credited runs',
  );
export type BallEvent = z.infer<typeof BallEventSchema>;
