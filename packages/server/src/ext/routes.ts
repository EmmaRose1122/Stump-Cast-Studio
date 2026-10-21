import type { FastifyInstance } from 'fastify';
import {
  ExtClientMessageSchema,
  ExtCommandSchema,
  PairRequestSchema,
  type ExtServerMessage,
  type RawUpdate,
} from '@stumpcast/shared';
import type { WsHub } from '../ws/hub';
import { bearerToken, type ExtensionAuth } from './auth';
import type { ExtensionProvider } from './provider';
import type { SelectorService } from './selectors';

const AUTH_TIMEOUT_MS = 5000;

/** The scraped page URL carries the real match id when the payload itself forgot it. */
const idFromUrl = (url: unknown): string => {
  if (typeof url !== 'string') return '';
  const m = /(?:live-cricket-scores\/|\/match\/)(\d{3,})/i.exec(url);
  return m?.[1] ?? '';
};

/**
 * Converts an OnAirHero scrape into a RawUpdate. `null` means "this is not a score": a payload
 * with no match identity or no scored content used to become a `live` 0-0 match and wipe whatever
 * was on air.
 */
export function onAirHeroUpdateToRaw(payload: any): RawUpdate | null {
  const matchId = String(payload.matchId ?? payload.id ?? payload.match_id ?? '').trim() || idFromUrl(payload.url);
  if (!matchId || matchId === 'live') return null;
  const source: 'cricbuzz' | 'crex' =
    payload.source === 'crex' || matchId.startsWith('crex_') ? 'crex' : 'cricbuzz';
  const url =
    payload.url && /^https?:\/\//i.test(payload.url)
      ? payload.url
      : source === 'crex'
      ? `https://crex.com/match/${matchId}`
      : `https://www.cricbuzz.com/live-cricket-scores/${matchId}`;

  const parseOvers = (val: unknown): { overs: number; balls: number } => {
    if (val == null) return { overs: 0, balls: 0 };
    const parts = String(val).split('.');
    const overs = Math.max(0, parseInt(parts[0] ?? '0', 10) || 0);
    const balls = Math.min(5, Math.max(0, parts[1] ? parseInt(parts[1], 10) || 0 : 0));
    return { overs, balls };
  };

  const inningsRaw: any[] = Array.isArray(payload.innings) ? payload.innings : [];
  const innings = inningsRaw.map((inn) => {
    const { overs, balls } = parseOvers(inn.overs);
    const wktsRaw = inn.wickets ?? inn.wkts;
    const wkts =
      wktsRaw != null ? Math.min(10, Math.max(0, parseInt(wktsRaw, 10) || 0)) : inn.declared ? 0 : 10;
    return {
      team: String(inn.teamCode || inn.team || 'Team').trim(),
      runs: Math.max(0, parseInt(inn.runs, 10) || 0),
      wkts,
      overs,
      balls,
    };
  });

  if (innings.length === 0 && payload.batting) {
    const { overs, balls } = parseOvers(payload.batting.overs);
    innings.push({
      team: String(payload.batting.teamCode || payload.batting.team || 'Batting').trim(),
      runs: Math.max(0, parseInt(payload.batting.runs, 10) || 0),
      wkts: Math.min(10, Math.max(0, parseInt(payload.batting.wickets ?? payload.batting.wkts, 10) || 0)),
      overs,
      balls,
    });
  }

  const battersRaw: any[] = Array.isArray(payload.batters) ? payload.batters : [];
  const batters = battersRaw.map((b) => {
    const rawName = String(b.name || '');
    const cleanName = rawName.replace(/\s*\*\s*$/, '').trim();
    const onStrike = Boolean(b.isStriker ?? b.onStrike ?? rawName.includes('*'));
    return {
      name: cleanName || 'Batter',
      runs: Math.max(0, parseInt(b.runs, 10) || 0),
      balls: Math.max(0, parseInt(b.balls, 10) || 0),
      fours: Math.max(0, parseInt(b.fours, 10) || 0),
      sixes: Math.max(0, parseInt(b.sixes, 10) || 0),
      onStrike,
    };
  });

  let bowler: RawUpdate['fields']['bowler'] | undefined = undefined;
  if (payload.bowler && payload.bowler.name) {
    const { overs, balls } = parseOvers(payload.bowler.overs);
    const rawBowlerName = String(payload.bowler.name || '');
    const cleanBowlerName = rawBowlerName.replace(/\s*\*\s*$/, '').trim();
    bowler = {
      name: cleanBowlerName || 'Bowler',
      overs,
      balls,
      maidens: Math.max(0, parseInt(payload.bowler.maidens, 10) || 0),
      runs: Math.max(0, parseInt(payload.bowler.runs, 10) || 0),
      wkts: Math.min(10, Math.max(0, parseInt(payload.bowler.wickets ?? payload.bowler.wkts, 10) || 0)),
    };
  }

  let teams: Array<{ name: string; short?: string }> = [];
  if (Array.isArray(payload.teams) && payload.teams.length > 0) {
    teams = payload.teams.slice(0, 2).map((t: any) =>
      typeof t === 'string'
        ? { name: t, short: t.slice(0, 4).toUpperCase() }
        : { name: t.name || t.teamCode || 'Team', short: t.short || t.teamCode },
    );
  } else if (payload.title) {
    const m = String(payload.title).match(
      /^([A-Za-z0-9][A-Za-z0-9 .&'-]*?)\s+vs\.?\s+([A-Za-z0-9][A-Za-z0-9 .&'-]*?)(?:,|$)/i,
    );
    if (m && m[1] && m[2]) {
      teams = [
        { name: m[1].trim(), short: m[1].trim().slice(0, 4).toUpperCase() },
        { name: m[2].trim(), short: m[2].trim().slice(0, 4).toUpperCase() },
      ];
    }
  }
  if (teams.length === 0 && innings.length > 0) {
    const uniqueTeams = Array.from(new Set(innings.map((i) => i.team)));
    teams = uniqueTeams.slice(0, 2).map((t) => ({ name: t, short: t.slice(0, 4).toUpperCase() }));
  }

  // Scrapers spell the ball list differently and /ingest is an open door, so a key mismatch must
  // not silently cost the ball history: the ball-by-ball popup and the last-six rail both die
  // without it.
  const ballTokens = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((b: any) => String(b).trim()).filter(Boolean) : [];

  const recentBalls = ballTokens(
    payload.recentBalls ?? payload.recentOvers ?? payload.lastBalls ?? payload.thisOver,
  );
  const ballsThisOver = innings.at(-1)?.balls ?? 0;
  // A mixed "recent overs" list ends with the balls of the over in progress; `balls` is 0 right
  // after an over ends, and then the whole list is that over.
  const fromMixedList = ballsThisOver > 0 ? recentBalls.slice(-ballsThisOver) : recentBalls;
  const thisOverTokens = ballTokens(payload.thisOver);
  const lastBallsTokens = ballTokens(payload.lastBalls);

  let partnership: { runs: number; balls: number } | undefined = undefined;
  const pData = payload.stats?.partnership || payload.partnership;
  if (pData && (pData.runs != null || pData.balls != null)) {
    partnership = {
      runs: Math.max(0, parseInt(pData.runs, 10) || 0),
      balls: Math.max(0, parseInt(pData.balls, 10) || 0),
    };
  }

  const crr = payload.batting?.runRate ?? payload.crr;
  const target = payload.target ? parseInt(payload.target, 10) : undefined;

  const rawFormat = String(payload.format || payload.series || payload.title || '').toUpperCase();
  let format: 'T20' | 'ODI' | 'TEST' | undefined = undefined;
  if (rawFormat.includes('T20') || rawFormat.includes('TWENTY20')) format = 'T20';
  else if (rawFormat.includes('ODI') || rawFormat.includes('ONE DAY')) format = 'ODI';
  else if (rawFormat.includes('TEST')) format = 'TEST';

  const commentaryLast =
    payload.commentary?.text ||
    (typeof payload.commentary === 'string' ? payload.commentary : undefined);

  // Nothing scored at all: an empty innings list would publish a 0-0 pre-match state over a live game.
  const hasScore =
    innings.length > 0 ||
    batters.length > 0 ||
    Boolean(bowler) ||
    Boolean(payload.batting) ||
    Boolean(payload.innings) ||
    teams.length > 0;
  if (!hasScore) return null;

  return {
    source,
    matchId,
    url,
    capturedAt: Date.now(),
    confidence: 1,
    fields: {
      title: payload.title || undefined,
      status: payload.statusText || payload.status || undefined,
      venue: payload.venue || undefined,
      toss: payload.toss || undefined,
      teams,
      innings,
      batters,
      bowler,
      thisOver: thisOverTokens.length > 0 ? thisOverTokens : fromMixedList,
      lastBalls: lastBallsTokens.length > 0 ? lastBallsTokens : recentBalls,
      partnership,
      target: target && !isNaN(target) ? target : undefined,
      crr: crr != null && !isNaN(Number(crr)) ? Number(crr) : undefined,
      rrr: payload.rrr != null && !isNaN(Number(payload.rrr)) ? Number(payload.rrr) : undefined,
      day: payload.day != null ? parseInt(payload.day, 10) : undefined,
      session: payload.session || undefined,
      resultText: payload.resultText || undefined,
      commentaryLast: commentaryLast || undefined,
      format,
    },
    missing: [],
  };
}

export const SAMPLE_MATCH_UPDATE = {
  source: 'cricbuzz' as const,
  // Deliberately not a real-looking match number: the demo fixture must never collide with, or
  // get mistaken for, a scraped match.
  matchId: 'demo-seed-match',
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
  fastify.post('/api/ext/selectors/check', async () => selectors?.checkRemote());
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
      tabs: [
        {
          matchId: SAMPLE_MATCH_UPDATE.matchId,
          url: SAMPLE_MATCH_UPDATE.url,
          lastUpdateAt: now,
          confidence: 1,
        },
      ],
    });
    return { ok: true, matchId: SAMPLE_MATCH_UPDATE.matchId };
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
    const token = bearerToken(req.headers.authorization);
    if (!token || !auth.verify(token)) {
      return reply.code(401).send({ error: 'Unauthorised' });
    }
    const msg = ExtClientMessageSchema.safeParse(req.body);
    if (!msg.success) return reply.code(400).send({ error: 'Invalid message' });
    handle(msg.data);
    return { ok: true };
  });

  // Zero-friction OnAirHero extension HTTP POST ingest
  fastify.post('/ingest', async (req, reply) => {
    const body: any = req.body;
    if (!body) return reply.code(400).send({ error: 'Empty body' });
    const payload = body.payload || body;
    try {
      const raw = onAirHeroUpdateToRaw(payload);
      if (!raw) {
        return reply
          .code(400)
          .send({ error: 'Not a score update: needs a match id (or match URL) and some scored data' });
      }
      provider.ingest(raw);
      provider.recordHeartbeat({
        type: 'heartbeat',
        extensionVersion: '1.2.0',
        selectorsVersion: 1,
        tabs: [
          {
            matchId: raw.matchId,
            url: raw.url,
            lastUpdateAt: Date.now(),
            confidence: 1,
          },
        ],
      });
      return { ok: true, matchId: raw.matchId };
    } catch (err: any) {
      return reply.code(400).send({ error: err?.message || 'Invalid payload' });
    }
  });

  // Zero-friction OnAirHero extension WebSocket ingest (cricstream-ingest/1)
  fastify.get('/ingest', { websocket: true }, (socket) => {
    hub.broadcast('health', 'extension-connected', {});
    provider.recordHeartbeat({
      type: 'heartbeat',
      extensionVersion: '1.2.0',
      selectorsVersion: 1,
      tabs: [],
    });

    const sendMsg = (type: string, payload?: any) => {
      if (socket.readyState === socket.OPEN) {
        socket.send(
          JSON.stringify({
            protocol: 'cricstream-ingest/1',
            type,
            payload,
            timestamp: Date.now(),
          }),
        );
      }
    };

    provider.setCommandSender((cmd) => {
      sendMsg(cmd.command, cmd);
      return socket.readyState === socket.OPEN;
    }, socket);

    socket.on('message', (raw) => {
      let json: any;
      try {
        json = JSON.parse(raw.toString());
      } catch {
        return;
      }

      const msgType = json.type;
      const payload = json.payload || json;

      if (msgType === 'hello') {
        sendMsg('hello_ack', { ok: true });
        sendMsg('request_meta');
        hub.broadcast('health', 'extension-connected', {});
        provider.recordHeartbeat({
          type: 'heartbeat',
          extensionVersion: payload.version || '1.2.0',
          selectorsVersion: 1,
          tabs: [],
        });
      } else if (msgType === 'match_meta') {
        const mId = payload.matchId ? String(payload.matchId) : null;
        if (mId) {
          sendMsg('meta_ack', { matchId: mId });
          sendMsg('on_air', { matchId: mId, url: payload.url });
          provider.recordHeartbeat({
            type: 'heartbeat',
            extensionVersion: '1.2.0',
            selectorsVersion: 1,
            tabs: [
              {
                matchId: mId,
                url: payload.url || `https://www.cricbuzz.com/live-cricket-scores/${mId}`,
                lastUpdateAt: Date.now(),
                confidence: 1,
              },
            ],
          });
        }
      } else if (msgType === 'match_update') {
        try {
          const rawUpdate = onAirHeroUpdateToRaw(payload);
          if (rawUpdate) {
            provider.ingest(rawUpdate);
            provider.recordHeartbeat({
              type: 'heartbeat',
              extensionVersion: '1.2.0',
              selectorsVersion: 1,
              tabs: [
                {
                  matchId: rawUpdate.matchId,
                  url: rawUpdate.url,
                  lastUpdateAt: Date.now(),
                  confidence: 1,
                },
              ],
            });
          } else {
            sendMsg('update_rejected', { reason: 'no match id or no scored content' });
          }
        } catch {
          // Ignore transient parsing drops
        }
      } else if (msgType === 'ping') {
        sendMsg('pong');
      }
    });

    socket.on('close', () => {
      provider.releaseCommandSender(socket);
      hub.broadcast('health', 'extension-disconnected', {});
    });
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
          }, socket);
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
        provider.releaseCommandSender(socket);
        hub.broadcast('health', 'extension-disconnected', {});
      }
    });
  });
};
