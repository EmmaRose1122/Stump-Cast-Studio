import { z } from 'zod';

export const CHANNELS = [
  'state',
  'events',
  'cards',
  'sound',
  'layout',
  'health',
  'licence',
  'commentary',
] as const;
export const ChannelSchema = z.enum(CHANNELS);
export type Channel = z.infer<typeof ChannelSchema>;

/** Client -> server. */
export const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('subscribe'), channels: z.array(ChannelSchema).min(1) }),
  z.object({ type: z.literal('unsubscribe'), channels: z.array(ChannelSchema).min(1) }),
  z.object({ type: z.literal('ping') }),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

/** Server -> client. `ack` and `pong` are control messages; everything else is a channel payload. */
export const ServerMessageSchema = z.union([
  z.object({ type: z.literal('ack'), channels: z.array(ChannelSchema) }),
  z.object({ type: z.literal('pong') }),
  z.object({ type: z.literal('error'), message: z.string() }),
  z.object({
    type: z.literal('message'),
    channel: ChannelSchema,
    event: z.string().min(1),
    payload: z.unknown(),
    ts: z.number(),
  }),
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;
