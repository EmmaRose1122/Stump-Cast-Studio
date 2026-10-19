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

export const BallEventSchema = z.object({
  over: z.number().int().min(0),
  ball: z.number().int().min(1),
  runs: z.number().int().min(0).max(7),
  extras: ExtraSchema.optional(),
  wicket: WicketSchema.optional(),
  batterId: z.string().min(1),
  bowlerId: z.string().min(1),
});
export type BallEvent = z.infer<typeof BallEventSchema>;
