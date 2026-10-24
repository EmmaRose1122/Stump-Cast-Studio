import {
  MatchStateSchema,
  SettingsSchema,
  type MatchState,
  type Settings,
} from '@stumpcast/shared';
import { useQuery } from '@tanstack/react-query';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const json = async (res: Response): Promise<unknown> => {
  if (!res.ok) throw new ApiError(res.status, `${res.status} ${res.statusText}`);
  return res.json();
};

const send = (method: string, url: string, body?: unknown) =>
  fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(json);

export interface ProviderStatus {
  health: 'connected' | 'stale' | 'down';
  lastHeartbeatAt: number | null;
  extensionVersion: string | null;
  selectorsVersion: number | null;
  matches: { matchId: string; health: string }[];
  openTabs?: number;
  lastDegraded?: { site: string; missing: string[]; at: number } | null;
}

export interface AlarmState {
  level: 'ok' | 'warn' | 'error';
  code: string | null;
  message: string;
  muted: boolean;
  since: number | null;
}

export interface ObsStatus {
  connected: boolean;
  host: string | null;
  port: number | null;
  connectedAt: number | null;
  error: string | null;
}

/**
 * Where the overlay is really served. The admin is proxied in dev and served by the app itself
 * when packaged, and the packaged server picks its own port (4000 is usually taken by a dev
 * stack) — so a hard-coded `:4000` hands the operator an OBS source that shows and hears nothing.
 */
export const serverOrigin = async (): Promise<string> => {
  const h = (await fetch('/api/health').then(json)) as { port: number };
  return `${window.location.protocol}//${window.location.hostname}:${h.port}`;
};

/** The server's own origin, falling back to this page's until the answer arrives. */
export const useServerOrigin = (): string => {
  const fallback = `${window.location.protocol}//${window.location.hostname}:${window.location.port}`;
  const { data } = useQuery({
    queryKey: ['server-origin'],
    queryFn: serverOrigin,
    staleTime: Infinity,
  });
  return data ?? fallback;
};

export const api = {
  providerStatus: () => fetch('/api/ext/status').then(json) as Promise<ProviderStatus>,
  alarm: () => fetch('/api/alarm').then(json) as Promise<AlarmState>,
  obsStatus: () => fetch('/api/obs/status').then(json) as Promise<ObsStatus>,
  muteAlarm: (minutes = 15) => send('POST', '/api/alarm/mute', { minutes }) as Promise<AlarmState>,
  unmuteAlarm: () => send('DELETE', '/api/alarm/mute') as Promise<AlarmState>,

  /** All match states, on-stream match first. */
  matches: async (): Promise<MatchState[]> => {
    const list = (await fetch('/api/matches').then(json)) as unknown[];
    return list.flatMap((m) => {
      const r = MatchStateSchema.safeParse(m);
      return r.success ? [r.data] : [];
    });
  },

  settings: async (): Promise<Settings> =>
    SettingsSchema.parse(await fetch('/api/settings').then(json)),
  saveSettings: async (s: Settings): Promise<Settings> =>
    SettingsSchema.parse(await send('PUT', '/api/settings', s)),

  showCard: (cardId: string, durationSec = 8) =>
    send('POST', `/api/cards/${encodeURIComponent(cardId)}/show`, { durationSec }),
  hideCard: () => send('POST', '/api/cards/hide', {}),
  clearMatches: () => send('DELETE', '/api/matches'),
  deleteMatch: (id: string) => send('DELETE', `/api/matches/${encodeURIComponent(id)}`),
};

// ---- manual scoring (B1) ---------------------------------------------------------------

export interface ManualPlayer {
  id: string;
  name: string;
}

export interface ManualDetail {
  id: string;
  title: string;
  format: 'T20' | 'ODI' | 'TEST' | 'OTHER';
  oversLimit: number | null;
  teams: { id: string; name: string; short: string }[];
  toss: { winnerTeamId: string; decision: 'bat' | 'bowl' } | null;
  battingTeamId: string;
  awaiting: ('striker' | 'nonStriker' | 'bowler')[];
  freeHit: boolean;
  result: string | null;
  inningsComplete: boolean;
  inningsNumber: number;
  striker: string | null;
  nonStriker: string | null;
  bowler: string | null;
  lastOverBowler: string | null;
  overBalls: number;
  runs: number;
  wkts: number;
  overs: number;
  balls: number;
  crr: number;
  availableBatters: ManualPlayer[];
  yetToBat: ManualPlayer[];
  bowlers: ManualPlayer[];
  bowlerOptions: ManualPlayer[];
  commandCount: number;
  players: { teamId: string; players: ManualPlayer[] }[];
}

export interface ManualSummary {
  id: string;
  title: string;
  format: string;
  result: string | null;
  commandCount: number;
}

export interface ManualSetupInput {
  title?: string;
  format: 'T20' | 'ODI' | 'TEST' | 'OTHER';
  overs?: number;
  venue?: string;
  teams: [
    { name: string; short?: string; players: string[] },
    { name: string; short?: string; players: string[] },
  ];
}

export interface EventRow {
  id: string;
  matchId: string;
  type: string;
  payload: Record<string, unknown> | null;
  at: number;
}

const manualSend = async (url: string, body: unknown): Promise<ManualDetail> => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const data = (await res.json()) as ManualDetail & { error?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? `${res.status} ${res.statusText}`);
  return data;
};

export const manualApi = {
  list: () => fetch('/api/manual/matches').then(json) as Promise<ManualSummary[]>,
  get: (id: string) =>
    fetch(`/api/manual/${encodeURIComponent(id)}`).then(json) as Promise<ManualDetail>,
  create: (setup: ManualSetupInput) => manualSend('/api/manual/matches', setup),
  command: (id: string, type: string, body: object = {}) =>
    manualSend(`/api/manual/${encodeURIComponent(id)}/${type}`, body),
  undo: (id: string) => manualSend(`/api/manual/${encodeURIComponent(id)}/undo`, {}),
  remove: (id: string) =>
    fetch(`/api/manual/${encodeURIComponent(id)}`, { method: 'DELETE' }).then(json),
};

export const eventsApi = {
  recent: (limit = 50) => fetch(`/api/events?limit=${limit}`).then(json) as Promise<EventRow[]>,
};

export interface SelectorsStatus {
  version: number;
  updatedAt: number;
  source: 'bundled' | 'remote';
  hasUpdate: boolean;
  lastCheckedAt?: number;
}

export const selectorsApi = {
  status: () => fetch('/api/ext/selectors/status').then(json) as Promise<SelectorsStatus>,
  check: (url?: string) =>
    send('POST', '/api/ext/selectors/check', { url }) as Promise<{
      ok: boolean;
      updated: boolean;
      version: number;
      message: string;
    }>,
  rollback: () =>
    send('POST', '/api/ext/selectors/rollback', {}) as Promise<{ ok: boolean; version: number }>,
};

export interface AiKeysStatus {
  gemini: { hasKey: boolean };
  openai: { hasKey: boolean };
  cricket: { hasKey: boolean };
  xtts: { hasKey: boolean };
}

export const keysApi = {
  status: () => fetch('/api/ai/keys').then(json) as Promise<AiKeysStatus>,
  save: (provider: 'gemini' | 'openai' | 'cricket', key: string) =>
    send('POST', '/api/ai/keys', { provider, key }) as Promise<{ ok: boolean; provider: string; hasKey: boolean }>,
  remove: (provider: 'gemini' | 'openai' | 'cricket') =>
    fetch(`/api/ai/keys/${provider}`, { method: 'DELETE' }).then(json) as Promise<{ ok: boolean; provider: string; hasKey: boolean }>,
};
