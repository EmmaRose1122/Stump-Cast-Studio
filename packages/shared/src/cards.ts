import { z } from 'zod';

/** Payload of the `cards` channel. The director and the operator both produce these. */
export const CardCommandSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('show'),
    cardId: z.string().min(1),
    /** 0 means sticky until hidden. */
    durationSec: z.number().min(0).max(600).default(8),
    source: z.enum(['director', 'operator']).default('operator'),
    data: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({ action: z.literal('hide'), cardId: z.string().optional() }),
  z.object({ action: z.literal('asset-updated'), id: z.string().min(1) }),
]);
export type CardCommand = z.infer<typeof CardCommandSchema>;
