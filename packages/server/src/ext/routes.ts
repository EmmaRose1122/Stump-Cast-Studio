import type { FastifyInstance } from 'fastify';
import {
  ExtClientMessageSchema,
  ExtCommandSchema,
  PairRequestSchema,
  type ExtServerMessage,
} from '@stumpcast/shared';
import type { WsHub } from '../ws/hub';
import { bearerToken, type ExtensionAuth } from './auth';
import type { ExtensionProvider } from './provider';
import type { SelectorService } from './selectors';

const AUTH_TIMEOUT_MS = 5000;

export const SAMPLE_MATCH_UPDATE = {
  source: 'cricbuzz' as const,
  matchId: '147920',
  url: 'https://www.cricbuzz.com/live-cricket-scores/147920/south-africa-vs-australia-1st-test',
  capturedAt: Date.now(),
  confidence: 1,
  fields: {
    title: 'South Africa vs Australia, 1st Test, Australia tour of South Africa, 2026',
    status: 'Day 4: 3rd Session - South Africa need 369 runs',
    venue: 'Kingsmead, Durban',
    toss: 'Australia opted to bat',
    teams: [{ name: 'South Africa', short: 'RSA' }, { name: 'Australia', short: 'AUS' }],
    innings: [
      { team: 'Australia', runs: 390, wkts: 10, overs: 112, balls: 4 },
      { team: 'South Africa', runs: 284, wkts: 10, overs: 88, balls: 2 },
      { team: 'Australia', runs: 314, wkts: 6, overs: 82, balls: 0 },
      { team: 'South Africa', runs: 52, wkts: 1, overs: 17, balls: 0 },
    ],
    batters: [
      { name: 'Aiden Markram', runs: 26, balls: 48, fours: 3, sixes: 0, onStrike: true },
      { name: 'Ryan Rickelton', runs: 22, balls: 54, fours: 2, sixes: 0, onStrike: false },
    ],
    bowler: {
      name: 'Pat Cummins',
      overs: 6,
      balls: 0,
      maidens: 2,
      runs: 18,
      wkts: 1,
    },
    thisOver: ['0', '1', 'N', '0', '0', '0'],
    lastBalls: ['0', '1', 'N', '0', '0', '0'],
    partnership: { runs: 45, balls: 81 },
    target: 421,
    crr: 3.06,
    rrr: 4.12,
    day: 4,
    session: '3rd Session',
    format: 'TEST' as const,
  },
  missing: [],
};

export const registerExtRoutes = (
  fastify: FastifyInstance,
  deps: {
    auth: ExtensionAuth;
    provider: ExtensionProvider;
    hub: WsHub;
    acceptSourceTerms: () => number;
    sourceTermsAccepted: () => boolean;
    selectors?: SelectorService;
  },
): void => {
  const { auth, provider, hub, acceptSourceTerms, sourceTermsAccepted, selectors } = deps;

  // Admin side: start pairing, inspect and command the extension.
  fastify.post('/api/ext/terms/accept', async () => ({ acceptedAt: acceptSourceTerms() }));
  fastify.post('/api/ext/pair-code', async (_req, reply) => {
    if (!sourceTermsAccepted()) {
      return reply.code(428).send({ error: 'Accept the source-site terms notice before pairing' });
    }
    return auth.createCode();
  });
  fastify.get('/api/ext/status', async () => provider.status());
  fastify.get('/api/ext/matches', async () => provider.listMatches());
  fastify.post('/api/ext/command', async (req, reply) => {
    const cmd = ExtCommandSchema.safeParse(req.body);
    if (!cmd.success) return reply.code(400).send({ error: 'Invalid command' });
    return { delivered: provider.sendCommand(cmd.data) };
  });
  fastify.delete('/api/ext/tokens', async () => {
    auth.revokeAll();
    return { ok: true };
  });

  // ---- Selectors hot-fix pipeline (X5) --------------------------------------------------
  fastify.get('/api/ext/selectors', async () => selectors?.getActiveBundle());
  fastify.get('/api/ext/selectors/status', async () => selectors?.getStatus());
  fastify.post('/api/ext/selectors/check', async (req) => {
    const body = req.body as { url?: string } | undefined;
    return selectors?.checkRemote(body?.url);
  });
  fastify.post('/api/ext/selectors/rollback', async () => selectors?.rollback());
  fastify.post('/api/ext/selectors/install', async (req, reply) => {
    try {
      return await selectors?.install(req.body);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.code(400).send({ error: msg });
    }
  });

  fastify.post('/api/ext/auto-pair', async () => {
    acceptSourceTerms();
    const { code } = auth.createCode();
    const token = auth.redeem(code);
    return { token };
  });
  fastify.post('/api/ext/seed-match', async () => {
    const now = Date.now();
    provider.ingest({ ...SAMPLE_MATCH_UPDATE, capturedAt: now });
    provider.recordHeartbeat({
      type: 'heartbeat',
      extensionVersion: '1.0.1',
      selectorsVersion: 1,
      tabs: [{ matchId: '147920', url: SAMPLE_MATCH_UPDATE.url, lastUpdateAt: now, confidence: 1 }],
    });
    return { ok: true, matchId: '147920' };
  });

  // Extension side.
  fastify.post('/api/ext/pair', async (req, reply) => {
    const body = PairRequestSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Invalid code' });
    const token = auth.redeem(body.data.code);
    if (!token) return reply.code(401).send({ error: 'Wrong or expired code' });
    return { token };
  });

  fastify.post('/api/ext/ingest', async (req, reply) => {
    if (!auth.verify(bearerToken(req.headers.authorization))) {
      return reply.code(401).send({ error: 'Unauthorised' });
    }
    const msg = ExtClientMessageSchema.safeParse(req.body);
    if (!msg.success) return reply.code(400).send({ error: 'Invalid message' });
    handle(msg.data);
    return { ok: true };
  });

  const handle = (msg: ReturnType<typeof ExtClientMessageSchema.parse>) => {
    if (msg.type === 'update') provider.ingest(msg.update);
    else if (msg.type === 'heartbeat') provider.recordHeartbeat(msg);
    else if (msg.type === 'degraded') {
      provider.recordDegraded(msg);
      hub.broadcast('health', 'adapter-degraded', msg);
    }
  };

  fastify.get('/ext', { websocket: true }, (socket) => {
    let authed = false;
    const send = (m: ExtServerMessage) => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(m));
    };
    const authTimer = setTimeout(() => {
      if (!authed) socket.close(4401, 'auth timeout');
    }, AUTH_TIMEOUT_MS);

    socket.on('message', (raw) => {
      let json: unknown;
      try {
        json = JSON.parse(raw.toString());
      } catch {
        return;
      }
      const msg = ExtClientMessageSchema.safeParse(json);
      if (!msg.success) return;
      if (!authed) {
        if (msg.data.type === 'auth' && auth.verify(msg.data.token)) {
          authed = true;
          clearTimeout(authTimer);
          provider.setCommandSender((cmd) => {
            send({ type: 'command', ...cmd });
            return socket.readyState === socket.OPEN;
          });
          hub.broadcast('health', 'extension-connected', {});
          send({ type: 'authed' });
        } else {
          socket.close(4401, 'unauthorised');
        }
        return;
      }
      if (msg.data.type === 'ping') return send({ type: 'pong' });
      handle(msg.data);
    });

    socket.on('close', () => {
      clearTimeout(authTimer);
      if (authed) {
        provider.setCommandSender(null);
        hub.broadcast('health', 'extension-disconnected', {});
      }
    });
  });
};
