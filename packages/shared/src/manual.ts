import { z } from 'zod';
import { WicketSchema } from './ball';

/** Setup for a manually scored match (B1). */
export const ManualSetupSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  format: z.enum(['T20', 'ODI', 'TEST', 'OTHER']).default('T20'),
  /** Overs per innings; defaults to 20 (T20) / 50 (ODI), none for Tests. */
  overs: z.number().int().min(1).max(100).optional(),
  venue: z.string().max(120).optional(),
  teams: z
    .tuple([
      z.object({
        name: z.string().min(1).max(60),
        short: z.string().min(1).max(5).optional(),
        players: z.array(z.string().min(1).max(60)).min(2).max(15),
      }),
      z.object({
        name: z.string().min(1).max(60),
        short: z.string().min(1).max(5).optional(),
        players: z.array(z.string().min(1).max(60)).min(2).max(15),
      }),
    ])
    .refine(([a, b]) => a.name.toLowerCase() !== b.name.toLowerCase(), {
      message: 'Team names must differ',
    }),
});
export type ManualSetup = z.infer<typeof ManualSetupSchema>;

const extras = z.object({
  type: z.enum(['wide', 'noball', 'bye', 'legbye']),
  /** Total extra runs for the delivery (a wide that was run for 2 is `runs: 3`). */
  runs: z.number().int().min(1).max(10),
});

/** Every scoring action. The command log is the single source of truth (undo pops it). */
export const ManualCommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ball'),
    /** Runs off the bat (0-6). Byes and leg byes are extras, not bat runs. */
    runs: z.number().int().min(0).max(6).default(0),
    extras: extras.optional(),
    wicket: z
      .object({
        kind: WicketSchema.shape.kind,
        /** Defaults to the striker. A run out may dismiss the non-striker. */
        playerOutId: z.string().optional(),
        newBatterId: z.string().optional(),
      })
      .optional(),
  }),
  z.object({ type: z.literal('new-over'), bowlerId: z.string().min(1) }),
  z.object({
    type: z.literal('set-batter'),
    slot: z.enum(['striker', 'nonStriker']),
    playerId: z.string().min(1),
  }),
  z.object({ type: z.literal('set-bowler'), playerId: z.string().min(1) }),
  z.object({ type: z.literal('end-innings'), declared: z.boolean().default(false) }),
  z.object({
    type: z.literal('set-toss'),
    winnerTeamId: z.string().min(1),
    decision: z.enum(['bat', 'bowl']),
  }),
  z.object({ type: z.literal('set-result'), text: z.string().min(1).max(160) }),
]);
export type ManualCommand = z.infer<typeof ManualCommandSchema>;
