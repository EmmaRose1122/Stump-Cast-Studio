import multipart from '@fastify/multipart';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { WsHub } from '../ws/hub';
import {
  AssetError,
  MAX_UPLOAD_BYTES,
  assetIdFor,
  type AssetService,
  type AssetType,
} from './AssetService';

const TypeSchema = z.enum(['player', 'team', 'background']);

const truthy = (v: unknown): boolean => v === true || v === 'true' || v === '1' || v === 'on';

export interface MissingSource {
  players: { id: string; name: string; teamId?: string }[];
  teams: { id: string; short: string; name: string }[];
}

export const registerAssetRoutes = async (
  fastify: FastifyInstance,
  deps: {
    assets: AssetService;
    hub: WsHub;
    /** Squad and teams for a match (manual squads, or the players seen in a live state). */
    missingSource: (matchId: string) => MissingSource | undefined;
  },
): Promise<void> => {
  const { assets, hub } = deps;

  await fastify.register(multipart, {
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 10, fieldSize: 2048 },
  });

  const fail = (reply: FastifyReply, err: unknown) => {
    if (err instanceof AssetError) return reply.code(err.status).send({ error: err.message });
    throw err;
  };

  const announce = (id: string) => hub.broadcast('cards', 'asset', { action: 'asset-updated', id });

  /** Add default or hand-copied images that are on disk but missing from the library. */
  fastify.post('/api/assets/sync', async () => assets.syncFromDisk());

  /** Fields must be sent before the file part in the multipart body. */
  fastify.post('/api/assets', async (req, reply) => {
    if (!req.isMultipart()) return reply.code(400).send({ error: 'Send a multipart form' });
    const part = await req.file();
    if (!part) return reply.code(400).send({ error: 'No file was uploaded' });

    const field = (n: string) => {
      const f = part.fields[n] as { value?: unknown } | undefined;
      return typeof f?.value === 'string' ? f.value : undefined;
    };
    const type = TypeSchema.safeParse(field('type'));
    if (!type.success)
      return reply.code(400).send({ error: 'type must be player, team or background' });

    try {
      const id = assetIdFor(type.data as AssetType, { name: field('name'), short: field('short') });
      const buffer = await part.toBuffer();
      if (part.file.truncated) throw new AssetError('That image is too large', 413);
      const { asset, replaced } = await assets.saveImage({
        type: type.data,
        id,
        buffer,
        rightsConfirmed: truthy(field('rightsConfirmed')),
      });
      announce(asset.id);
      return { ...asset, replaced };
    } catch (err) {
      return fail(reply, err);
    }
  });

  fastify.post('/api/assets/url', async (req, reply) => {
    const body = z
      .object({
        type: TypeSchema,
        url: z.string().url().max(2000),
        name: z.string().max(80).optional(),
        short: z.string().max(10).optional(),
        rightsConfirmed: z.unknown(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Invalid request' });
    try {
      const id = assetIdFor(body.data.type, { name: body.data.name, short: body.data.short });
      const { asset, replaced } = await assets.importUrl({
        type: body.data.type,
        id,
        url: body.data.url,
        rightsConfirmed: truthy(body.data.rightsConfirmed),
      });
      announce(asset.id);
      return { ...asset, replaced };
    } catch (err) {
      return fail(reply, err);
    }
  });

  fastify.get<{
    Querystring: { type?: string; q?: string; page?: string; pageSize?: string; sort?: string };
  }>('/api/assets', async (req, reply) => {
    const q = z
      .object({
        type: TypeSchema.optional(),
        q: z.string().max(80).optional(),
        page: z.coerce.number().int().min(1).optional(),
        pageSize: z.coerce.number().int().min(1).max(200).optional(),
        sort: z.enum(['newest', 'oldest', 'name']).optional(),
      })
      .safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: 'Invalid query' });
    return assets.list(q.data);
  });

  fastify.get<{ Querystring: { matchId?: string } }>('/api/assets/missing', async (req, reply) => {
    const id = req.query.matchId;
    if (!id) return reply.code(400).send({ error: 'matchId is required' });
    const source = deps.missingSource(id);
    if (!source) return reply.code(404).send({ error: 'Unknown match' });
    return assets.missing(source);
  });

  fastify.delete<{ Params: { id: string } }>('/api/assets/:id', async (req, reply) => {
    try {
      assets.delete(req.params.id);
      announce(req.params.id);
      return { ok: true };
    } catch (err) {
      return fail(reply, err);
    }
  });
};
