import { z } from 'zod';

export const EngineEventTypeSchema = z.enum([
  'FOUR',
  'SIX',
  'WICKET',
  'FIFTY',
  'HUNDRED',
  'OVER_END',
  'INNINGS_END',
  'SESSION_END',
  'DAY_END',
  'NEW_BATTER',
  'MILESTONE',
  'DRS',
]);
export type EngineEventType = z.infer<typeof EngineEventTypeSchema>;

export const EngineEventSchema = z.object({
  /** Deterministic id (match + innings + over + ball + type) so detection is idempotent. */
  id: z.string().min(1),
  matchId: z.string().min(1),
  type: EngineEventTypeSchema,
  at: z.string().datetime(),
  payload: z.record(z.string(), z.unknown()).default({}),
});
export type EngineEvent = z.infer<typeof EngineEventSchema>;
