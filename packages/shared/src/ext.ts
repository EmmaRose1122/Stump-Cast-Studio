import { z } from 'zod';
import { RawUpdateSchema } from './provider';

/** POST /api/ext/pair */
export const PairRequestSchema = z.object({ code: z.string().regex(/^\d{6}$/) });
export const PairResponseSchema = z.object({ token: z.string().min(20) });

export const TabInfoSchema = z.object({
  matchId: z.string().min(1),
  url: z.string().url(),
  /** Epoch ms of the last successful parse in that tab (even if unchanged). */
  lastUpdateAt: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1),
});
export type TabInfo = z.infer<typeof TabInfoSchema>;

export const HeartbeatSchema = z.object({
  type: z.literal('heartbeat'),
  extensionVersion: z.string(),
  selectorsVersion: z.number().int().nonnegative(),
  tabs: z.array(TabInfoSchema).max(20),
});
export type Heartbeat = z.infer<typeof HeartbeatSchema>;

/** Extension -> server (WS /ext after `auth`, or POST /api/ext/ingest). */
export const ExtClientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('auth'), token: z.string().min(1) }),
  z.object({ type: z.literal('ping') }),
  z.object({ type: z.literal('update'), update: RawUpdateSchema }),
  z.object({
    type: z.literal('degraded'),
    site: z.string(),
    url: z.string(),
    confidence: z.number(),
    missing: z.array(z.string()),
    at: z.number(),
  }),
  HeartbeatSchema,
]);
export type ExtClientMessage = z.infer<typeof ExtClientMessageSchema>;

export const ExtCommandSchema = z.discriminatedUnion('command', [
  z.object({ command: z.literal('openMatch'), url: z.string().url() }),
  z.object({ command: z.literal('focusMatch'), matchId: z.string().min(1) }),
  z.object({ command: z.literal('closeMatch'), matchId: z.string().min(1) }),
  z.object({ command: z.literal('reloadSelectors') }),
  z.object({ command: z.literal('killSwitch'), enabled: z.boolean().default(true) }),
]);
export type ExtCommand = z.infer<typeof ExtCommandSchema>;

/** Server -> extension. */
export const ExtServerMessageSchema = z.union([
  z.object({ type: z.literal('authed') }),
  z.object({ type: z.literal('pong') }),
  z.object({ type: z.literal('command') }).and(ExtCommandSchema),
]);
export type ExtServerMessage = z.infer<typeof ExtServerMessageSchema>;

/** Ports the extension probes, in order. Mirrors the server's fallback range. */
export const EXT_PORT_RANGE = { from: 4000, to: 4010 } as const;
