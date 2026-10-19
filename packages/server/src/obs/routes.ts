import type { FastifyInstance } from 'fastify';
import { LayoutPresetIdSchema, OBS_LAYOUT_PRESETS, SettingsSchema } from '@stumpcast/shared';
import type { Settings } from '@stumpcast/shared';
import { z } from 'zod';
import type { OBSLink } from './OBSLink';

const RoleMapSchema = z.object({
  matchVideo: z.string().max(255),
  cam1: z.string().max(255),
  cam2: z.string().max(255),
});

export const registerObsRoutes = (
  fastify: FastifyInstance,
  deps: {
    obs: OBSLink;
    getSettings: () => Settings;
    saveSettings: (settings: Settings) => void;
  },
): void => {
  const { obs, getSettings, saveSettings } = deps;

  fastify.get('/api/obs/status', async () => obs.status);
  fastify.get('/api/obs/layouts', async () => OBS_LAYOUT_PRESETS);
  fastify.post('/api/obs/connect', async (req, reply) => {
    const body = z
      .object({ host: z.string().min(1).max(255), port: z.number().int().min(1).max(65535), password: z.string().max(512).optional() })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Enter a valid OBS host, port, and password' });
    try {
      const status = await obs.connect(body.data.host, body.data.port, body.data.password);
      const current = getSettings();
      saveSettings({ ...current, video: { ...current.video, obsHost: body.data.host, obsPort: body.data.port } });
      return status;
    } catch (err) {
      return reply.code(502).send({ error: err instanceof Error ? err.message : 'Could not connect to OBS', status: obs.status });
    }
  });
  fastify.post('/api/obs/disconnect', async () => obs.disconnect());
  fastify.get('/api/obs/scenes', async (_req, reply) => {
    try {
      return await obs.listScenes();
    } catch (err) {
      return reply.code(409).send({ error: err instanceof Error ? err.message : 'OBS is unavailable' });
    }
  });
  fastify.get('/api/obs/sources', async (_req, reply) => {
    try {
      return await obs.listSources();
    } catch (err) {
      return reply.code(409).send({ error: err instanceof Error ? err.message : 'OBS is unavailable' });
    }
  });
  fastify.put('/api/obs/map', async (req, reply) => {
    const body = RoleMapSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Invalid OBS role map' });
    const current = getSettings();
    const next = SettingsSchema.parse({ ...current, video: { ...current.video, obsMap: body.data } });
    saveSettings(next);
    return next.video.obsMap;
  });
  fastify.post('/api/obs/scene', async (req, reply) => {
    const body = z.object({ sceneName: z.string().min(1).max(255) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Choose an OBS scene' });
    try {
      await obs.setScene(body.data.sceneName);
      const current = getSettings();
      saveSettings({ ...current, video: { ...current.video, obsScene: body.data.sceneName } });
      return { ok: true, scene: body.data.sceneName };
    } catch (err) {
      return reply.code(409).send({ error: err instanceof Error ? err.message : 'Could not change scene' });
    }
  });
  fastify.post('/api/obs/layout', async (req, reply) => {
    const body = z.object({ layoutId: LayoutPresetIdSchema, sceneName: z.string().max(255).optional() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Choose a valid layout' });
    const settings = getSettings();
    try {
      const result = await obs.applyLayout(body.data.layoutId, settings.video.obsMap, body.data.sceneName);
      saveSettings({ ...settings, video: { ...settings.video, activeObsLayout: body.data.layoutId, obsScene: body.data.sceneName ?? settings.video.obsScene } });
      return result;
    } catch (err) {
      return reply.code(409).send({ error: err instanceof Error ? err.message : 'Could not apply OBS layout' });
    }
  });
};