import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { MAX_SOUND_SLOTS, type Settings, type SoundCommand } from '@stumpcast/shared';
import type { WsHub } from '../ws/hub';
import { MAX_SOUND_BYTES, SoundError, type SoundService } from './SoundService';

const truthy = (v: unknown): boolean => v === true || v === 'true' || v === '1' || v === 'on';
const AUTO_KEYS = ['four', 'six', 'wicket', 'milestone'] as const;

export const registerSoundRoutes = (
  fastify: FastifyInstance,
  deps: {
    sounds: SoundService;
    hub: WsHub;
    getSettings: () => Settings;
    saveSettings: (s: Settings) => void;
  },
) => {
  const { sounds, hub } = deps;
  let loopRunning = false;

  const send = (cmd: SoundCommand) => hub.broadcast('sound', 'command', cmd);
  const fail = (reply: FastifyReply, err: unknown) => {
    if (err instanceof SoundError) return reply.code(err.status).send({ error: err.message });
    throw err;
  };

  const overview = () => {
    const s = deps.getSettings();
    return {
      slots: sounds.list(),
      max: MAX_SOUND_SLOTS,
      master: s.sounds.masterVolume,
      auto: s.sounds.auto,
      loopRunning,
    };
  };

  fastify.get('/api/sounds', async () => overview());

  /** Fields (title, includeInLoop, volume) must precede the file in the multipart body. */
  fastify.post('/api/sounds', async (req, reply) => {
    if (!req.isMultipart()) return reply.code(400).send({ error: 'Send a multipart form' });
    const part = await req.file({ limits: { fileSize: MAX_SOUND_BYTES } });
    if (!part) return reply.code(400).send({ error: 'No file was uploaded' });
    const field = (n: string) => {
      const f = part.fields[n] as { value?: unknown } | undefined;
      return typeof f?.value === 'string' ? f.value : undefined;
    };
    try {
      const bytes = await part.toBuffer();
      if (part.file.truncated) throw new SoundError('That file is too large', 413);
      const volume = field('volume') !== undefined ? Number(field('volume')) : undefined;
      const slot = sounds.add({
        title: field('title') ?? part.filename.replace(/\.[^.]+$/, ''),
        bytes,
        includeInLoop: truthy(field('includeInLoop')),
        volume: Number.isFinite(volume) ? volume : undefined,
      });
      send({ action: 'library-updated' });
      return slot;
    } catch (err) {
      return fail(reply, err);
    }
  });

  fastify.post('/api/sounds/samples', async (_req, reply) => {
    try {
      const added = sounds.addSamples();
      if (added.length > 0) send({ action: 'library-updated' });
      return { added, ...overview() };
    } catch (err) {
      return fail(reply, err);
    }
  });

  fastify.put<{ Params: { id: string } }>('/api/sounds/:id', async (req, reply) => {
    const body = z
      .object({
        title: z.string().min(1).max(60).optional(),
        includeInLoop: z.boolean().optional(),
        volume: z.number().min(0).max(1).optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Invalid sound settings' });
    try {
      const slot = sounds.update(req.params.id, body.data);
      send({ action: 'library-updated' });
      return slot;
    } catch (err) {
      return fail(reply, err);
    }
  });

  fastify.delete<{ Params: { id: string } }>('/api/sounds/:id', async (req, reply) => {
    try {
      sounds.remove(req.params.id);
      // Clear automatic mappings that pointed at the removed slot.
      const s = deps.getSettings();
      const auto = { ...s.sounds.auto };
      let changed = false;
      for (const k of AUTO_KEYS) {
        if (auto[k] === req.params.id) {
          auto[k] = null;
          changed = true;
        }
      }
      if (changed) deps.saveSettings({ ...s, sounds: { ...s.sounds, auto } });
      send({ action: 'library-updated' });
      return overview();
    } catch (err) {
      return fail(reply, err);
    }
  });

  // ---- live control -----------------------------------------------------------------------

  fastify.post<{ Params: { id: string } }>('/api/sound/play/:id', async (req, reply) => {
    if (!sounds.get(req.params.id)) return reply.code(404).send({ error: 'Unknown sound' });
    send({ action: 'play', id: req.params.id });
    return { ok: true };
  });

  fastify.post('/api/sound/loop/start', async (_req, reply) => {
    const ids = sounds.loopIds();
    if (ids.length === 0) {
      return reply.code(400).send({ error: 'Tick "Include in loop" on at least one sound first' });
    }
    loopRunning = true;
    send({ action: 'loop-start', ids });
    return overview();
  });

  fastify.post('/api/sound/loop/stop', async () => {
    loopRunning = false;
    send({ action: 'loop-stop' });
    return overview();
  });

  fastify.post('/api/sound/stop-all', async () => {
    loopRunning = false;
    send({ action: 'stop-all' });
    return overview();
  });

  fastify.put('/api/sound/master-volume', async (req, reply) => {
    const body = z.object({ volume: z.number().min(0).max(1) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'volume must be between 0 and 1' });
    const s = deps.getSettings();
    deps.saveSettings({ ...s, sounds: { ...s.sounds, masterVolume: body.data.volume } });
    send({ action: 'master', volume: body.data.volume });
    return overview();
  });

  fastify.put('/api/sound/auto', async (req, reply) => {
    const body = z
      .object({
        four: z.string().nullable().optional(),
        six: z.string().nullable().optional(),
        wicket: z.string().nullable().optional(),
        milestone: z.string().nullable().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Invalid mapping' });
    for (const id of Object.values(body.data)) {
      if (id && !sounds.get(id)) return reply.code(400).send({ error: `Unknown sound: ${id}` });
    }
    const s = deps.getSettings();
    deps.saveSettings({
      ...s,
      sounds: { ...s.sounds, auto: { ...s.sounds.auto, ...body.data } },
    });
    return overview();
  });

  return {
    /** Called for each released event: plays the mapped slot, if any. */
    autoFor(eventType: string, mapping: Settings['sounds']['auto']): string | null {
      const key = (
        {
          FOUR: 'four',
          SIX: 'six',
          WICKET: 'wicket',
          FIFTY: 'milestone',
          HUNDRED: 'milestone',
          MILESTONE: 'milestone',
        } as Record<string, (typeof AUTO_KEYS)[number]>
      )[eventType];
      if (!key) return null;
      const id = mapping[key];
      if (!id || !sounds.get(id)) return null;
      send({ action: 'play', id });
      return id;
    },
  };
};
