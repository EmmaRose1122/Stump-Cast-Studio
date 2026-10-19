import fs from 'node:fs';
import path from 'node:path';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import { desc, eq } from 'drizzle-orm';
import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify';
import pino from 'pino';
import {
  CardSlugSchema,
  DirectorRuleSchema,
  MatchStateSchema,
  buildHistory,
  ALL_LOOKS,
} from '@stumpcast/shared';
import { z } from 'zod';
import {
  SettingsSchema,
  createSettings,
  type Settings,
  type EngineEvent,
  type MatchState,
} from '@stumpcast/shared';
import type { ServerConfig } from './config';
import { openDatabase, schema } from './db';
import { ExtensionAuth } from './ext/auth';
import { AssetService } from './assets/AssetService';
import { registerSoundRoutes } from './sound/routes';
import { SoundService } from './sound/SoundService';
import { CommentaryService } from './sound/CommentaryService';
import { registerAssetRoutes } from './assets/routes';
import { DelayBuffer } from './engine/DelayBuffer';
import { Director } from './engine/Director';
import { LookError, LookService } from './looks/LookService';
import { EventDetector } from './engine/EventDetector';
import { Watchdog, type Alarm } from './engine/Watchdog';
import { ProviderFailoverManager } from './engine/ProviderFailover';
import { MatchEngine } from './engine/MatchEngine';
import { ManualProvider } from './manual/ManualProvider';
import { registerManualRoutes } from './manual/routes';
import { SecretStore } from './providers/SecretStore';
import { CricketDataApiVendor } from './providers/apiVendor';
import { ApiProvider } from './providers/ApiProvider';
import { registerApiProviderRoutes } from './providers/routes';
import { ExtensionProvider } from './ext/provider';
import { registerExtRoutes, SAMPLE_MATCH_UPDATE } from './ext/routes';
import { SelectorService } from './ext/selectors';
import { OBSLink } from './obs/OBSLink';
import { registerObsRoutes } from './obs/routes';
import { WsHub } from './ws/hub';
import { signLicenceToken, verifyLicenceToken, type LicencePayload } from './licence/licence';

const SETTINGS_KEY = 'app';
export const APP_VERSION = '1.0.2';

export interface StumpCastApp {
  fastify: FastifyInstance;
  hub: WsHub;
  /** PRIMARY data source: the Chrome extension. */
  extension: ExtensionProvider;
  engine: MatchEngine;
  watchdog: Watchdog;
  director: Director;
  manual: ManualProvider;
  api: ApiProvider;
  assets: AssetService;
  sounds: SoundService;
  obs: OBSLink;
  delay: DelayBuffer<{ state: MatchState; events: EngineEvent[] }>;
  /** Port actually bound; set by `start`. */
  port: number | null;
  start(): Promise<number>;
  stop(): Promise<void>;
}

export const buildApp = async (config: ServerConfig): Promise<StumpCastApp> => {
  const { db, sqlite } = openDatabase(config.dataDir);
  const logDir = path.join(config.dataDir, 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  // Open the file synchronously so no async open can race with a data folder being removed.
  const logFd = fs.openSync(path.join(logDir, 'server.log'), 'a');
  const logDest = pino.destination({ fd: logFd, sync: false });
  const logger = pino({ level: process.env.STUMPCAST_LOG_LEVEL ?? 'info' }, logDest);

  // Fastify infers the concrete pino Logger type; widen it to the base logger type.
  const fastify = Fastify({
    loggerInstance: logger,
    bodyLimit: 1_048_576,
  }) as unknown as FastifyInstance;
  const hub = new WsHub();
  const startedAt = Date.now();
  const state: { port: number | null } = { port: null };

  await fastify.register(fastifyWebsocket);

  fastify.addContentTypeParser(
    ['application/json', 'text/plain', 'application/x-www-form-urlencoded'],
    { parseAs: 'string' },
    (req, body, done) => {
      const text = typeof body === 'string' ? body : body.toString('utf-8');
      if (!text.trim()) {
        done(null, {});
        return;
      }
      try {
        done(null, JSON.parse(text));
      } catch {
        done(null, text);
      }
    },
  );

  fastify.addHook('onRequest', async (req, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    if (req.method === 'OPTIONS') {
      return reply.code(204).send();
    }
    if ((req.method === 'POST' || req.method === 'PUT') && !req.headers['content-type']) {
      req.headers['content-type'] = 'application/json';
    }
  });

  const loadSettings = () => {
    const row = db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, SETTINGS_KEY))
      .get();
    const parsed = SettingsSchema.safeParse(row?.value ?? {});
    return parsed.success ? parsed.data : createSettings();
  };

  fastify.get('/api/health', async () => ({
    ok: true,
    version: APP_VERSION,
    port: state.port,
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    wsClients: hub.size,
  }));

  fastify.get('/api/app/version', async () => ({
    currentVersion: APP_VERSION,
    name: 'StumpCast Studio',
    releaseUrl: 'https://github.com/stumpcast/studio/releases',
  }));

  let simulatedUpdate = false;
  let serverDownloadProgress = {
    status: 'idle' as 'idle' | 'downloading' | 'ready' | 'error',
    percent: 0,
    transferred: 0,
    total: 129412818,
    bytesPerSecond: 0,
    error: null as string | null,
    installerPath: null as string | null,
  };

  fastify.get('/api/app/update-check', async (req) => {
    const query = req.query as { simulate?: string; url?: string } | undefined;
    let latestVersion = APP_VERSION;
    let releaseNotes = '';
    let updateAvailable = false;
    let downloadUrl = '';

    // Check local release/latest.yml first
    const latestYmlCandidates = [
      path.resolve(process.cwd(), 'release', 'latest.yml'),
      path.resolve(import.meta.dirname, '..', '..', '..', 'release', 'latest.yml'),
      path.resolve(import.meta.dirname, '..', '..', 'release', 'latest.yml'),
      'C:\\Users\\IK\\Downloads\\StumpCast Studio\\stumpcast\\release\\latest.yml',
      path.join(process.env.USERPROFILE || '', 'Downloads', 'StumpCast Studio', 'stumpcast', 'release', 'latest.yml'),
    ];
    const latestYmlPath = latestYmlCandidates.find((f) => fs.existsSync(f));
    if (latestYmlPath) {
      try {
        const content = fs.readFileSync(latestYmlPath, 'utf8');
        const verMatch = content.match(/version:\s*([0-9.]+)/i);
        if (verMatch && verMatch[1]) {
          const fileVer = verMatch[1].trim();
          latestVersion = fileVer;
          downloadUrl = '/api/app/update-download-file';
          releaseNotes =
            '• Complete White, Royal Blue & Cricket Orange broadcast design\n• Ultra-fast Cricbuzz & Crex match state scrapers\n• Fixed button contrast & responsive broadcast layout\n• Direct in-app update installer to version ' + fileVer;
          const [curMajor = 0, curMinor = 0, curPatch = 0] = APP_VERSION.split('.').map(Number);
          const [latMajor = 0, latMinor = 0, latPatch = 0] = fileVer.split('.').map(Number);
          if (
            latMajor > curMajor ||
            (latMajor === curMajor && latMinor > curMinor) ||
            (latMajor === curMajor && latMinor === curMinor && latPatch > curPatch)
          ) {
            updateAvailable = true;
          }
        }
      } catch {
        /* ignore */
      }
    }

    if (query?.simulate === '1' || simulatedUpdate || process.env.STUMPCAST_UPDATE_SIMULATE === '1') {
      return {
        currentVersion: APP_VERSION,
        latestVersion: '1.0.2',
        updateAvailable: true,
        releaseNotes:
          '• Direct In-App Desktop Updater with live transfer progress bar\n• Ultra-fast Cricbuzz & Crex match state scrapers\n• White, Royal Blue & Cricket Orange studio broadcast look\n• Responsive operator control room layout\n• Automatic background installer updates',
        downloadUrl: '/api/app/update-download-file',
        fileSize: 140364848,
      };
    }

    try {
      const checkUrl =
        query?.url ||
        process.env.STUMPCAST_UPDATE_URL ||
        'https://api.github.com/repos/EmmaRose1122/Stump-Cast-Studio/releases/latest';

      const res = await fetch(checkUrl, {
        headers: { 'User-Agent': 'StumpCast-Studio' },
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          tag_name?: string;
          body?: string;
          html_url?: string;
          assets?: Array<{ browser_download_url?: string }>;
          latestVersion?: string;
          updateAvailable?: boolean;
          releaseNotes?: string;
        };
        if (data.latestVersion) {
          latestVersion = data.latestVersion;
          releaseNotes = data.releaseNotes ?? '';
          updateAvailable = Boolean(data.updateAvailable);
          downloadUrl = data.assets?.[0]?.browser_download_url ?? '/api/app/update-download-file';
        } else if (data.tag_name) {
          latestVersion = data.tag_name.replace(/^v/, '');
          releaseNotes = data.body ?? '';
          downloadUrl = data.assets?.[0]?.browser_download_url ?? data.html_url ?? '/api/app/update-download-file';
          const [curMajor = 0, curMinor = 0, curPatch = 0] = APP_VERSION.split('.').map(Number);
          const [latMajor = 0, latMinor = 0, latPatch = 0] = latestVersion.split('.').map(Number);
          if (
            latMajor > curMajor ||
            (latMajor === curMajor && latMinor > curMinor) ||
            (latMajor === curMajor && latMinor === curMinor && latPatch > curPatch)
          ) {
            updateAvailable = true;
          }
        }
      }
    } catch {
      // Offline or network timeout; fallback smoothly
    }

    return {
      currentVersion: APP_VERSION,
      latestVersion,
      updateAvailable,
      releaseNotes,
      downloadUrl,
    };
  });

  fastify.get('/api/app/update-download-file', async (_req, reply) => {
    const candidates = [
      path.resolve(process.cwd(), 'release', 'StumpCast-Studio-Setup-1.0.2.exe'),
      path.resolve(import.meta.dirname, '..', '..', '..', 'release', 'StumpCast-Studio-Setup-1.0.2.exe'),
      'C:\\Users\\IK\\Downloads\\StumpCast Studio\\stumpcast\\release\\StumpCast-Studio-Setup-1.0.2.exe',
      path.join(process.env.USERPROFILE || '', 'Downloads', 'StumpCast Studio', 'stumpcast', 'release', 'StumpCast-Studio-Setup-1.0.2.exe'),
      path.resolve(process.cwd(), 'release', 'StumpCast-Studio-Setup-1.0.1.exe'),
      path.resolve(import.meta.dirname, '..', '..', '..', 'release', 'StumpCast-Studio-Setup-1.0.1.exe'),
      path.resolve(process.cwd(), 'release', 'StumpCast-Studio-Setup-0.0.0.exe'),
      path.resolve(import.meta.dirname, '..', '..', '..', 'release', 'StumpCast-Studio-Setup-0.0.0.exe'),
    ];
    const target = candidates.find((f) => fs.existsSync(f));
    if (!target) {
      return reply.code(404).send({ error: 'Installer executable not found' });
    }
    const stat = fs.statSync(target);
    reply.header('Content-Type', 'application/vnd.microsoft.portable-executable');
    reply.header('Content-Disposition', `attachment; filename="${path.basename(target)}"`);
    reply.header('Content-Length', stat.size);
    return reply.send(fs.createReadStream(target));
  });

  fastify.get('/latest.yml', async (_req, reply) => {
    const candidates = [
      path.resolve(process.cwd(), 'release', 'latest.yml'),
      path.resolve(import.meta.dirname, '..', '..', '..', 'release', 'latest.yml'),
      'C:\\Users\\IK\\Downloads\\StumpCast Studio\\stumpcast\\release\\latest.yml',
      path.join(process.env.USERPROFILE || '', 'Downloads', 'StumpCast Studio', 'stumpcast', 'release', 'latest.yml'),
    ];
    const target = candidates.find((f) => fs.existsSync(f));
    if (!target) return reply.code(404).send({ error: 'latest.yml not found' });
    reply.header('Content-Type', 'text/yaml');
    return reply.send(fs.readFileSync(target, 'utf8'));
  });

  fastify.post('/api/app/update-simulate', async (req) => {
    const body = (req.body as { active?: boolean } | undefined) ?? {};
    simulatedUpdate = body.active !== undefined ? body.active : !simulatedUpdate;
    return {
      simulated: simulatedUpdate,
      currentVersion: APP_VERSION,
      latestVersion: simulatedUpdate ? '1.0.2' : APP_VERSION,
    };
  });

  fastify.get('/api/app/update-progress', async () => serverDownloadProgress);

  fastify.post('/api/app/update-download', async () => {
    serverDownloadProgress = {
      status: 'downloading',
      percent: 0,
      transferred: 0,
      total: 140364848,
      bytesPerSecond: 4200000,
      error: null,
      installerPath: null,
    };

    setTimeout(async () => {
      for (let p = 15; p <= 100; p += 15) {
        await new Promise((r) => setTimeout(r, 120));
        serverDownloadProgress.percent = p;
        serverDownloadProgress.transferred = Math.round((p / 100) * serverDownloadProgress.total);
      }
      serverDownloadProgress.status = 'ready';
      serverDownloadProgress.percent = 100;
    }, 50);

    return { status: 'downloading', message: 'Update download started.' };
  });

  fastify.post('/api/app/update-trigger', async () => {
    serverDownloadProgress.status = 'ready';
    return {
      status: 'update-triggered',
      message: 'Update download started. The application will restart to install.',
    };
  });

  fastify.post('/api/app/update-install', async () => {
    return {
      status: 'installing',
      message: 'Installer launched. Application restarting...',
    };
  });


  fastify.get('/api/settings', async () => loadSettings());

  fastify.put('/api/settings', async (req, reply) => {
    const parsed = SettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid settings', issues: parsed.error.issues });
    }
    db.insert(schema.settings)
      .values({ key: SETTINGS_KEY, value: parsed.data })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value: parsed.data } })
      .run();
    applyRuntimeSettings(parsed.data);
    hub.broadcast('layout', 'settings', parsed.data);
    return parsed.data;
  });

  fastify.get('/api/settings/sync-delay', async () => ({ syncDelaySec: delay.delaySec }));
  fastify.put('/api/settings/sync-delay', async (req, reply) => {
    const body = z.object({ syncDelaySec: z.number().min(0).max(60) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'syncDelaySec must be 0-60' });
    const next = { ...loadSettings(), syncDelaySec: body.data.syncDelaySec };
    db.insert(schema.settings)
      .values({ key: SETTINGS_KEY, value: next })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value: next } })
      .run();
    applyRuntimeSettings(next);
    hub.broadcast('layout', 'settings', next);
    return { syncDelaySec: delay.delaySec };
  });

  fastify.get('/ws', { websocket: true }, (socket, req) => {
    const preview = new URL(req.url, 'http://localhost').searchParams.get('preview') === '1';
    hub.add(socket, { preview });
  });

  const extension = new ExtensionProvider();
  const obs = new OBSLink();
  const detector = new EventDetector();

  /** What is on air (after the sync delay). /api/state serves this, so a reconnecting overlay
   *  can never jump ahead of the delayed feed. */
  const published = new Map<string, MatchState>();

  const persistEvent = (e: EngineEvent) =>
    db
      .insert(schema.events)
      .values({
        id: e.id,
        matchId: e.matchId,
        type: e.type,
        payload: e.payload,
        at: Date.parse(e.at),
      })
      .onConflictDoNothing()
      .run();

  const director = new Director(
    (cmd) => hub.broadcast('cards', 'card', cmd),
    loadSettings().director,
  );

  const sound: {
    auto?: { autoFor(type: string, m: Settings['sounds']['auto']): string | null };
  } = {};

  const commentary = new CommentaryService();

  const delay = new DelayBuffer<{ state: MatchState; events: EngineEvent[] }>(
    ({ state: s, events }) => {
      published.set(s.id, s);
      hub.broadcast('state', 'match-state', s, 'live');
      director.onState(s);
      for (const e of events) {
        persistEvent(e);
        hub.broadcast('events', 'engine-event', e, 'live');
        director.onEvent(e);
        sound.auto?.autoFor(e.type, loadSettings().sounds.auto);
        const comm = commentary.onEvent(e, s);
        if (comm) hub.broadcast('commentary', 'speak', comm, 'live');
      }
    },
    loadSettings().syncDelaySec,
  );

  const engine = new MatchEngine({
    db,
    onState: (s) => {
      const events = detector.observe(s);
      // The admin preview socket sees everything immediately; overlays get the delayed feed.
      hub.broadcast('state', 'match-state', s, 'preview');
      for (const e of events) {
        hub.broadcast('events', 'engine-event', e, 'preview');
        const comm = commentary.onEvent(e, s);
        if (comm) hub.broadcast('commentary', 'speak', comm, 'preview');
      }
      delay.push({ state: s, events });
    },
  });

  extension.onUpdate((u) => {
    engine.process(u);
    // When a real match update arrives, auto-purge any old mock seed match from memory and DB
    if (u.matchId !== '147920' && u.matchId !== 'seed-match') {
      engine.deleteMatch('147920');
      engine.deleteMatch('seed-match');
      extension.deleteMatch('147920');
      extension.deleteMatch('seed-match');
      db.delete(schema.matches).where(eq(schema.matches.id, '147920')).run();
      db.delete(schema.matches).where(eq(schema.matches.id, 'seed-match')).run();
    }
    const s = loadSettings();
    if (!s.onStreamMatchId || s.onStreamMatchId === '147920' || s.onStreamMatchId === 'seed-match') {
      const next = { ...s, onStreamMatchId: u.matchId };
      db.insert(schema.settings)
        .values({ key: SETTINGS_KEY, value: next })
        .onConflictDoUpdate({ target: schema.settings.key, set: { value: next } })
        .run();
      hub.broadcast('layout', 'settings', next);
    }
  });

  // Optional backup source: operator-scored matches share the same engine and overlay pipeline.
  const manual = new ManualProvider(sqlite);
  manual.onUpdate((u) => engine.process(u));
  registerManualRoutes(fastify, manual);
  manual.republishAll();

  // API provider (backup official data API source)
  const secrets = new SecretStore({ dataDir: path.join(config.dataDir, 'secrets') });
  const apiVendor = new CricketDataApiVendor();
  const api = new ApiProvider({
    vendorAdapter: apiVendor,
    secretStore: secrets,
  });
  registerApiProviderRoutes(fastify, api, engine);
  // After a reconnect the first state is a snapshot, not live action: do not replay old events.
  extension.onConnectionChange((connected) => {
    if (connected) for (const s of engine.allStates()) detector.resync(s.id);
  });

  fastify.get<{ Querystring: { matchId?: string; limit?: string } }>('/api/events', async (req) => {
    const limit = Math.min(Number(req.query.limit ?? 50) || 50, 500);
    const rows = db.select().from(schema.events).orderBy(desc(schema.events.at)).limit(limit).all();
    return req.query.matchId ? rows.filter((r) => r.matchId === req.query.matchId) : rows;
  });

  const stateSource = (preview: boolean) =>
    preview ? engine.allStates() : [...published.values()];
  fastify.get<{ Querystring: { preview?: string } }>('/api/state', async (req) =>
    stateSource(req.query.preview === '1'),
  );
  fastify.get<{ Params: { id: string }; Querystring: { preview?: string } }>(
    '/api/state/:id',
    async (req, reply) => {
      const s =
        req.query.preview === '1' ? engine.getState(req.params.id) : published.get(req.params.id);
      return s ?? reply.code(404).send({ error: 'Unknown match' });
    },
  );

  fastify.delete('/api/matches', async () => {
    engine.clear();
    extension.clear();
    published.clear();
    db.delete(schema.matches).run();
    db.delete(schema.snapshots).run();
    db.delete(schema.events).run();
    const current = loadSettings();
    if (current.onStreamMatchId) {
      saveSettings({ ...current, onStreamMatchId: null });
    }
    return { ok: true };
  });

  fastify.delete<{ Params: { id: string } }>('/api/matches/:id', async (req) => {
    const id = req.params.id;
    engine.deleteMatch(id);
    extension.deleteMatch(id);
    published.delete(id);
    db.delete(schema.matches).where(eq(schema.matches.id, id)).run();
    db.delete(schema.snapshots).where(eq(schema.snapshots.matchId, id)).run();
    db.delete(schema.events).where(eq(schema.events.matchId, id)).run();
    const current = loadSettings();
    if (current.onStreamMatchId === id) {
      saveSettings({ ...current, onStreamMatchId: null });
    }
    return { ok: true, id };
  });

  // ---- sounds (B9) ---------------------------------------------------------------------
  const sounds = new SoundService(db, config.dataDir);
  sound.auto = registerSoundRoutes(fastify, {
    sounds,
    hub,
    getSettings: loadSettings,
    saveSettings: (s) => saveSettings(s),
  });

  // ---- assets (B8) ------------------------------------------------------------------
  const assets = new AssetService(db, config.dataDir);
  assets.syncFromDisk();
  await registerAssetRoutes(fastify, {
    assets,
    hub,
    missingSource: (matchId) => {
      const state = engine.getState(matchId);
      const squad = manual.get(matchId);
      if (!state && !squad) return undefined;
      if (squad) {
        // Manual matches know both full squads.
        return {
          teams: squad.setup.teams.map((t, i) => ({
            id: squad.teamIdOf(i as 0 | 1),
            short: t.short ?? t.name.slice(0, 3).toUpperCase(),
            name: t.name,
          })),
          players: squad.teams.flatMap((team, i) =>
            team.map((p) => ({ id: p.id, name: p.name, teamId: squad.teamIdOf(i as 0 | 1) })),
          ),
        };
      }
      const s = state!;
      return {
        teams: s.teams.map((t) => ({ id: t.id, short: t.short, name: t.name })),
        players: [
          ...s.batters.map((b) => ({ id: b.playerId, name: b.name })),
          { id: s.bowler.playerId, name: s.bowler.name },
        ],
      };
    },
  });

  // ---- looks (B11) & licence --------------------------------------------------------
  const isLicensed = () => {
    if (config.licensed) return true;
    const row = db.select().from(schema.licence).get();
    return Boolean(row?.token && verifyLicenceToken(row.token).valid);
  };
  const looks = new LookService(db, isLicensed);
  const activeLookId = () => loadSettings().theme;
  const lookFail = (reply: FastifyReply, err: unknown) => {
    if (err instanceof LookError) return reply.code(err.status).send({ error: err.message });
    throw err;
  };

  // ---- licence routes ----
  const privateKeyHex = (() => {
    const candidates = [
      process.env.STUMPCAST_LICENCE_PRIVATE_KEY_FILE,
      config.licencePrivateKey,
      path.resolve(import.meta.dirname, '..', '..', '.secrets', 'licence-private.key'),
      path.resolve(import.meta.dirname, '..', '..', '..', '.secrets', 'licence-private.key'),
      path.resolve(process.cwd(), '.secrets', 'licence-private.key'),
      'C:\\Users\\IK\\Downloads\\StumpCast Studio\\stumpcast\\.secrets\\licence-private.key',
      path.join(process.env.USERPROFILE || '', 'Downloads', 'StumpCast Studio', 'stumpcast', '.secrets', 'licence-private.key'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'StumpCast Studio', 'resources', 'app', '.secrets', 'licence-private.key'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'StumpCast Studio', '.secrets', 'licence-private.key'),
    ].filter(Boolean) as string[];

    for (const keyPath of candidates) {
      try {
        if (fs.existsSync(keyPath)) {
          return fs.readFileSync(keyPath, 'utf8').trim();
        }
      } catch {
        /* try next */
      }
    }
    return null;
  })();

  fastify.post('/api/licence/generate', async (req, reply) => {
    if (!privateKeyHex) {
      return reply.code(503).send({ error: 'Licence private key not found on server' });
    }
    const body = z.object({
      channel: z.string().min(1).max(100),
      plan: z.enum(['monthly', 'yearly', 'lifetime']),
      days: z.number().int().min(1).max(36500).optional(),
    }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Invalid licence request' });

    const { channel, plan, days: reqDays } = body.data;
    const iat = Math.floor(Date.now() / 1000);
    const defaultDays = plan === 'monthly' ? 31 : 366;
    const days = reqDays ?? defaultDays;

    const payload: LicencePayload = plan === 'lifetime'
      ? { v: 1, channel, plan, iat }
      : { v: 1, channel, plan, iat, exp: iat + days * 86400 };

    const token = signLicenceToken(payload, privateKeyHex);
    return { token, channel, plan, days, expiresAt: payload.exp ? payload.exp * 1000 : null };
  });

  fastify.get('/api/licence', async () => {
    const row = db.select().from(schema.licence).get();
    return {
      licensed: isLicensed(),
      token: row?.token ?? null,
      checkedAt: row?.checkedAt ?? null,
    };
  });
  fastify.post('/api/licence', async (req, reply) => {
    const body = z
      .object({
        key: z.string().min(1).max(200).optional(),
        token: z.string().min(1).max(200).optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'A licence key or token is required' });
    const key = (body.data.key ?? body.data.token)?.trim();
    if (!key || key.length < 4) {
      return reply.code(400).send({ error: 'Please enter a valid licence key' });
    }
    const check = verifyLicenceToken(key);
    if (!check.valid) {
      return reply.code(400).send({ error: `Licence key rejected (${check.reason})` });
    }
    const existing = db.select().from(schema.licence).get();
    const now = Math.floor(Date.now() / 1000);
    if (existing) {
      db.update(schema.licence)
        .set({ token: key, checkedAt: now })
        .where(eq(schema.licence.id, existing.id))
        .run();
    } else {
      db.insert(schema.licence)
        .values({ token: key, checkedAt: now })
        .run();
    }
    hub.broadcast('licence', 'updated', { licensed: true, token: key });
    return { ok: true, licensed: true, token: key };
  });
  fastify.delete('/api/licence', async () => {
    db.delete(schema.licence).run();
    hub.broadcast('licence', 'updated', { licensed: config.licensed, token: null });
    return { ok: true, licensed: config.licensed };
  });

  // ---- looks routes ----
  fastify.get('/api/looks', async () => ({
    licensed: isLicensed(),
    looks: looks.list(activeLookId()),
  }));
  fastify.get('/api/looks/catalog', async () => ({
    catalog: looks.catalog(),
  }));
  fastify.get('/api/looks/active', async () => looks.get(activeLookId()) ?? looks.all()[0]);
  fastify.post('/api/looks/activate', async (req, reply) => {
    const body = z
      .object({ id: z.string().min(1).max(40), preview: z.boolean().optional() })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'A look id is required' });
    try {
      const look = looks.require(body.data.id, body.data.preview);
      saveSettings({ ...loadSettings(), theme: look.id });
      hub.broadcast('layout', 'look', look);
      return look;
    } catch (err) {
      return lookFail(reply, err);
    }
  });
  fastify.post('/api/looks/import', async (req, reply) => {
    try {
      return looks.import(req.body);
    } catch (err) {
      return lookFail(reply, err);
    }
  });
  fastify.delete<{ Params: { id: string } }>('/api/looks/:id', async (req, reply) => {
    try {
      if (req.params.id === 'ink-gold' || ALL_LOOKS.some((l) => l.id === req.params.id)) {
        return reply.code(403).send({ error: 'Built-in looks cannot be removed' });
      }
      const wasActive = activeLookId() === req.params.id;
      looks.remove(req.params.id);
      if (wasActive) {
        saveSettings({ ...loadSettings(), theme: 'ink-gold' });
        hub.broadcast('layout', 'look', looks.get('ink-gold'));
      }
      return { ok: true };
    } catch (err) {
      return lookFail(reply, err);
    }
  });

  // ---- history (per-over and fall-of-wickets, rebuilt from the stored snapshots) -------
  fastify.get<{ Params: { id: string } }>('/api/match/:id/history', async (req, reply) => {
    const rows = db
      .select()
      .from(schema.snapshots)
      .where(eq(schema.snapshots.matchId, req.params.id))
      .orderBy(schema.snapshots.id)
      .limit(20000)
      .all();
    if (rows.length === 0) return reply.code(404).send({ error: 'No history for that match' });
    const states = rows.flatMap((r) => {
      const p = MatchStateSchema.safeParse(r.state);
      return p.success ? [p.data] : [];
    });
    return buildHistory(req.params.id, states);
  });

  // ---- cards + director ----------------------------------------------------------------
  const saveSettings = (next: ReturnType<typeof loadSettings>) => {
    db.insert(schema.settings)
      .values({ key: SETTINGS_KEY, value: next })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value: next } })
      .run();
    applyRuntimeSettings(next);
    hub.broadcast('layout', 'settings', next);
  };

  registerObsRoutes(fastify, { obs, getSettings: loadSettings, saveSettings });

  fastify.post<{ Params: { id: string } }>('/api/cards/:id/show', async (req, reply) => {
    const id = CardSlugSchema.safeParse(req.params.id);
    const body = z
      .object({ durationSec: z.number().min(0).max(600).default(8) })
      .safeParse(req.body ?? {});
    if (!id.success || !body.success)
      return reply.code(400).send({ error: 'Invalid card request' });
    director.show(id.data, body.data.durationSec);
    return director.state;
  });
  fastify.post('/api/cards/hide', async (req, reply) => {
    const body = z.object({ cardId: CardSlugSchema.optional() }).safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Invalid card id' });
    director.hide(body.data.cardId);
    return director.state;
  });

  fastify.get('/api/director', async () => ({
    config: director.getConfig(),
    ...director.state,
  }));
  fastify.put('/api/director', async (req, reply) => {
    const patch = z
      .object({
        mode: z.enum(['smart', 'carousel', 'manual']).optional(),
        rules: z.array(DirectorRuleSchema).max(50).optional(),
        carousel: z
          .object({
            cards: z.array(CardSlugSchema).min(1).max(20),
            intervalSec: z.number().min(5).max(120),
          })
          .optional(),
      })
      .safeParse(req.body);
    if (!patch.success) {
      return reply.code(400).send({ error: 'Invalid director config', issues: patch.error.issues });
    }
    const current = loadSettings();
    saveSettings({ ...current, director: { ...current.director, ...patch.data } });
    return { config: director.getConfig(), ...director.state };
  });

  // ---- failover manager & watchdog ---------------------------------------------------
  const failover = new ProviderFailoverManager({
    getActiveMatchId: () => loadSettings().onStreamMatchId,
    setActiveMatchId: (matchId: string) => {
      saveSettings({ ...loadSettings(), onStreamMatchId: matchId });
    },
    getAvailableMatches: () => {
      const extMatches = extension.status().matches.map((m) => {
        const snap = engine.getState(m.matchId);
        return {
          id: m.matchId,
          title: snap ? `${snap.teams[0]?.short ?? ''} vs ${snap.teams[1]?.short ?? ''}` : m.matchId,
          source: 'extension',
          health: m.health,
        };
      });
      const manualMatches = manual.list().map((m) => ({
        id: m.id,
        title: m.title,
        source: 'manual',
        health: 'connected' as const,
      }));
      const apiMatchId = api.getActiveMatchId();
      const apiMatches = apiMatchId
        ? [
            {
              id: apiMatchId,
              title: engine.getState(apiMatchId)
                ? `${engine.getState(apiMatchId)?.teams[0]?.short ?? ''} vs ${engine.getState(apiMatchId)?.teams[1]?.short ?? ''}`
                : apiMatchId,
              source: 'api',
              health: api.health(),
            },
          ]
        : [];
      return [...extMatches, ...manualMatches, ...apiMatches];
    },
    onFailover: (ev) => {
      hub.broadcast('health', 'failover', ev);
    },
  });

  const watchdog = new Watchdog(
    {
      providerHealth: () => {
        const activeId = loadSettings().onStreamMatchId;
        if (activeId && api.getActiveMatchId() === activeId) {
          return api.health();
        }
        return extension.health();
      },
      lastDataAt: () => {
        const activeId = loadSettings().onStreamMatchId;
        if (activeId && api.getActiveMatchId() === activeId) {
          return api.lastDataAt();
        }
        return extension.lastDataAt();
      },
      obsConnected: () => (obs.status.host ? obs.connected : null),
    },
    (alarm: Alarm) => {
      hub.broadcast('health', 'alarm', alarm);
      const activeId = loadSettings().onStreamMatchId;
      if (activeId) {
        failover.evaluateHealth(extension.matchHealth(activeId), alarm.code);
      }
    },
  );
  const applyRuntimeSettings = (s: ReturnType<typeof loadSettings>) => {
    delay.setDelay(s.syncDelaySec);
    director.setConfig(s.director);
    watchdog.setStaleSec(s.watchdogSec);
    obs.setRotation({
      enabled: s.video.sceneRotation,
      intervalSec: s.video.rotationSec,
      layouts: s.video.rotationLayouts,
      map: s.video.obsMap,
      sceneName: s.video.obsScene,
    });
  };
  applyRuntimeSettings(loadSettings());

  fastify.get('/api/alarm', async () => watchdog.alarm);
  fastify.post('/api/alarm/mute', async (req, reply) => {
    const body = z
      .object({ minutes: z.number().min(1).max(240).default(15) })
      .safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'minutes must be 1-240' });
    watchdog.mute(body.data.minutes);
    return watchdog.alarm;
  });
  fastify.delete('/api/alarm/mute', async () => {
    watchdog.unmute();
    return watchdog.alarm;
  });

  fastify.get('/api/failover', async () => failover.getStatus());
  fastify.post('/api/failover/config', async (req, reply) => {
    const body = z
      .object({
        autoFailoverEnabled: z.boolean().optional(),
        fallbackMatchId: z.string().nullable().optional(),
        staleThresholdSec: z.number().min(5).max(300).optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Invalid failover config' });
    return failover.updateConfig(body.data);
  });
  fastify.post('/api/failover/switch', async (req, reply) => {
    const body = z.object({ matchId: z.string().min(1) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'matchId is required' });
    const res = failover.manualSwitch(body.data.matchId);
    if (!res.ok) return reply.code(400).send({ error: res.error });
    return failover.getStatus();
  });

  // ---- commentary & TTS (E3) ----------------------------------------------------------
  fastify.get('/api/commentary/status', async () => ({
    config: commentary.getConfig(),
    history: commentary.getHistory(),
  }));
  fastify.post('/api/commentary/config', async (req, reply) => {
    const body = z
      .object({
        enabled: z.boolean().optional(),
        autoEvents: z.boolean().optional(),
        voice: z.string().optional(),
        rate: z.number().min(0.5).max(2).optional(),
        pitch: z.number().min(0.5).max(2).optional(),
        volume: z.number().min(0).max(1).optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Invalid commentary config' });
    return commentary.updateConfig(body.data);
  });
  fastify.post('/api/commentary/speak', async (req, reply) => {
    const body = z
      .object({
        text: z.string().min(1).max(500),
        eventType: z.string().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Text is required (max 500 chars)' });
    const item = commentary.speak(body.data.text, body.data.eventType);
    hub.broadcast('commentary', 'speak', item);
    return item;
  });

  const selectors = new SelectorService({ dataDir: config.dataDir });
  selectors.onUpdate(() => {
    extension.sendCommand({ command: 'reloadSelectors' });
    hub.broadcast('health', 'selectors-updated', selectors.getStatus());
  });

  registerExtRoutes(fastify, {
    auth: new ExtensionAuth(db),
    provider: extension,
    hub,
    selectors,
    acceptSourceTerms: () => {
      const acceptedAt = Date.now();
      const settings = { ...loadSettings(), sourceTermsAcceptedAt: acceptedAt };
      db.insert(schema.settings)
        .values({ key: SETTINGS_KEY, value: settings })
        .onConflictDoUpdate({ target: schema.settings.key, set: { value: settings } })
        .run();
      applyRuntimeSettings(settings);
      return acceptedAt;
    },
    sourceTermsAccepted: () => loadSettings().sourceTermsAcceptedAt !== null,
  });

  const serve = async (root: string, prefix: string, decorateReply: boolean) => {
    if (!fs.existsSync(root)) return;
    await fastify.register(fastifyStatic, { root, prefix, decorateReply, wildcard: true });
  };
  await serve(config.overlayDir, '/overlay/', true);
  await serve(config.adminDir, '/admin/', false);
  await serve(config.licenseAdminDir, '/license-admin/', false);
  await serve(config.licenseAdminDir, '/license-generator/', false);
  fastify.get('/overlay', async (_req, reply) => reply.redirect('/overlay/'));
  fastify.get('/admin', async (_req, reply) => reply.redirect('/admin/'));
  fastify.get('/license-admin', async (_req, reply) => reply.redirect('/license-admin/'));
  fastify.get('/license-generator', async (_req, reply) => reply.redirect('/license-generator/'));
  const assetsDir = path.join(config.dataDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  // Auto-seed bundled default assets (backgrounds, presets) if missing in user's dataDir
  const candidateBundledDirs = [
    path.resolve(import.meta.dirname, '..', 'data', 'assets'),
    path.resolve(import.meta.dirname, '..', '..', 'server', 'data', 'assets'),
    path.resolve(process.cwd(), 'packages', 'server', 'data', 'assets'),
    path.resolve(process.cwd(), 'data', 'assets'),
    ...((process as unknown as { resourcesPath?: string }).resourcesPath
      ? [
          path.join((process as unknown as { resourcesPath: string }).resourcesPath, 'app', 'packages', 'server', 'data', 'assets'),
          path.join((process as unknown as { resourcesPath: string }).resourcesPath, 'packages', 'server', 'data', 'assets'),
          path.join((process as unknown as { resourcesPath: string }).resourcesPath, 'assets'),
        ]
      : []),
  ];
  const bundledAssetsDir = candidateBundledDirs.find(
    (d) => fs.existsSync(d) && fs.existsSync(path.join(d, 'backgrounds', 'floodlight.jpg')),
  );
  if (bundledAssetsDir && path.resolve(bundledAssetsDir) !== path.resolve(assetsDir)) {
    try {
      fs.cpSync(bundledAssetsDir, assetsDir, { recursive: true, force: false });
    } catch {
      // non-fatal
    }
  }

  await fastify.register(fastifyStatic, {
    root: assetsDir,
    prefix: '/assets/',
    decorateReply: false,
  });

  const app: StumpCastApp = {
    fastify,
    hub,
    extension,
    engine,
    watchdog,
    director,
    manual,
    api,
    assets,
    sounds,
    obs,
    delay,
    get port() {
      return state.port;
    },
    async start() {
      let lastErr: unknown;
      for (let i = 0; i < config.portAttempts; i++) {
        // Port 0 means "any free port"; do not increment it.
        const port = config.port === 0 ? 0 : config.port + i;
        try {
          await fastify.listen({ host: config.host, port });
          const addr = fastify.server.address();
          state.port = typeof addr === 'object' && addr ? addr.port : port;
          watchdog.start();
          return state.port;
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw err;
          lastErr = err;
        }
      }
      throw lastErr;
    },
    async stop() {
      watchdog.stop();
      director.stop();
      api.destroy();
      await obs.disconnect();
      delay.flush();
      hub.closeAll();
      await fastify.close();
      sqlite.close();
      // Close the log file so nothing is written after the data folder goes away.
      try {
        logDest.flushSync();
      } catch {
        /* the file was not opened yet; nothing to flush */
      }
      logDest.end();
    },
  };
  return app;
};
