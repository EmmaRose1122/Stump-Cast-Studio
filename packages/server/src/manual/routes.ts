import type { FastifyInstance, FastifyReply } from 'fastify';
import { ManualCommandSchema, ManualSetupSchema } from '@stumpcast/shared';
import { ManualError } from './ManualMatch';
import type { ManualProvider } from './ManualProvider';

const COMMANDS = [
  'ball',
  'new-over',
  'set-batter',
  'set-bowler',
  'end-innings',
  'set-toss',
  'set-result',
] as const;

export const registerManualRoutes = (
  fastify: FastifyInstance,
  provider: ManualProvider,
  /** Full teardown of everything a match touched, including what is on air. */
  purge: (matchId: string) => void = (id) => void provider.delete(id),
): void => {
  const fail = (reply: FastifyReply, err: unknown) => {
    if (err instanceof ManualError) return reply.code(400).send({ error: err.message });
    throw err;
  };

  const detail = (id: string) => {
    const m = provider.get(id)!;
    return {
      ...m.describe(),
      commandCount: provider.commandCount(id),
      setup: m.setup,
      players: m.teams.map((t, i) => ({ teamId: m.teamIdOf(i as 0 | 1), players: t })),
    };
  };

  fastify.get('/api/manual/matches', async () =>
    provider.list().map((m) => ({
      id: m.id,
      title: m.title,
      format: m.setup.format,
      result: m.result,
      commandCount: provider.commandCount(m.id),
    })),
  );

  fastify.post('/api/manual/matches', async (req, reply) => {
    const setup = ManualSetupSchema.safeParse(req.body);
    if (!setup.success) {
      return reply.code(400).send({ error: 'Invalid match setup', issues: setup.error.issues });
    }
    const match = provider.create(setup.data);
    return detail(match.id);
  });

  fastify.get<{ Params: { id: string } }>('/api/manual/:id', async (req, reply) => {
    if (!provider.get(req.params.id)) return reply.code(404).send({ error: 'Unknown match' });
    return detail(req.params.id);
  });

  fastify.delete<{ Params: { id: string } }>('/api/manual/:id', async (req, reply) => {
    if (!provider.get(req.params.id)) return reply.code(404).send({ error: 'Unknown match' });
    purge(req.params.id);
    return { ok: true };
  });

  fastify.post<{ Params: { id: string } }>('/api/manual/:id/undo', async (req, reply) => {
    if (!provider.get(req.params.id)) return reply.code(404).send({ error: 'Unknown match' });
    try {
      provider.undo(req.params.id);
      return detail(req.params.id);
    } catch (err) {
      return fail(reply, err);
    }
  });

  for (const type of COMMANDS) {
    fastify.post<{ Params: { id: string } }>(`/api/manual/:id/${type}`, async (req, reply) => {
      if (!provider.get(req.params.id)) return reply.code(404).send({ error: 'Unknown match' });
      const parsed = ManualCommandSchema.safeParse({
        ...((req.body as object | null) ?? {}),
        type,
      });
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid command', issues: parsed.error.issues });
      }
      try {
        provider.command(req.params.id, parsed.data);
        return detail(req.params.id);
      } catch (err) {
        return fail(reply, err);
      }
    });
  }
};
