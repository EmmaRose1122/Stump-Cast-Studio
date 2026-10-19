import { z } from 'zod';

export const MAX_SOUND_SLOTS = 10;

/** One sound slot as the admin and overlay see it. */
export const SoundSlotSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(60),
  /** Path under /assets, e.g. sounds/four-cheer.wav */
  file: z.string().min(1),
  includeInLoop: z.boolean(),
  volume: z.number().min(0).max(1),
});
export type SoundSlot = z.infer<typeof SoundSlotSchema>;

/** Payload of the `sound` channel. */
export const SoundCommandSchema = z.discriminatedUnion('action', [
  /** Fire one slot immediately. */
  z.object({
    action: z.literal('play'),
    id: z.string().min(1),
    volume: z.number().min(0).max(1).optional(),
  }),
  /** Start looping the given slots (those flagged `includeInLoop`). */
  z.object({ action: z.literal('loop-start'), ids: z.array(z.string()).max(MAX_SOUND_SLOTS) }),
  z.object({ action: z.literal('loop-stop') }),
  z.object({ action: z.literal('stop-all') }),
  z.object({ action: z.literal('master'), volume: z.number().min(0).max(1) }),
  /** The library changed: refetch the slot list and re-decode. */
  z.object({ action: z.literal('library-updated') }),
]);
export type SoundCommand = z.infer<typeof SoundCommandSchema>;

/** Event types that can trigger an automatic sound, and the settings key each one uses. */
export const AUTO_SOUND_FOR_EVENT: Record<string, 'four' | 'six' | 'wicket' | 'milestone'> = {
  FOUR: 'four',
  SIX: 'six',
  WICKET: 'wicket',
  FIFTY: 'milestone',
  HUNDRED: 'milestone',
  MILESTONE: 'milestone',
};
