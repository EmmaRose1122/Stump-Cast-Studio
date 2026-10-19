import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { MatchEngine } from '../engine/MatchEngine';
import type { ApiProvider } from './ApiProvider';

export function registerApiProviderRoutes(
  fastify: FastifyInstance,
  apiProvider: ApiProvider,
  engine: MatchEngine,
): void {
  let unsubscribeActive: (() => void) | null = null;

  fastify.get('/api/provider/api/status', async () => {
    return {
      health: apiProvider.health(),
      activeMatchId: apiProvider.getActiveMatchId(),
      hasKey: Boolean(apiProvider.getApiKey()),
      lastDataAt: apiProvider.lastDataAt(),
    };
  });

  fastify.post('/api/provider/api/key', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({ key: z.string().min(1).max(256) }).safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'Valid API key is required' });
    }
    apiProvider.setApiKey(body.data.key);
    return {
      success: true,
      health: apiProvider.health(),
      hasKey: true,
    };
  });

  fastify.get('/api/provider/api/matches', async () => {
    const matches = await apiProvider.listMatches();
    return { matches };
  });

  fastify.post('/api/provider/api/subscribe', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({ matchId: z.string().min(1) }).safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'matchId is required' });
    }
    const matchId = body.data.matchId;

    if (unsubscribeActive) {
      unsubscribeActive();
      unsubscribeActive = null;
    }

    unsubscribeActive = apiProvider.subscribe(matchId, (update) => {
      if (update && typeof update === 'object') {
        engine.process(update as Parameters<MatchEngine['process']>[0]);
      }
    });

    const initial = await apiProvider.pollNow();
    return {
      success: true,
      matchId,
      subscribed: true,
      initialSnapshot: initial ? true : false,
    };
  });

  fastify.post('/api/provider/api/poll', async () => {
    const update = await apiProvider.pollNow();
    return {
      success: true,
      updateReceived: Boolean(update),
      health: apiProvider.health(),
    };
  });

  fastify.post('/api/provider/api/unsubscribe', async () => {
    if (unsubscribeActive) {
      unsubscribeActive();
      unsubscribeActive = null;
    }
    return { success: true };
  });
}
