import type {
  MatchProvider,
  MatchSummary,
  ProviderHealth,
  RawUpdate,
  Unsubscribe,
} from '@stumpcast/shared';
import type { ApiVendorAdapter } from './apiVendor';
import { SecretStore } from './SecretStore';

const MATCH_LIST_CACHE_MS = 30_000;
const DEFAULT_RATE_LIMIT_MS = 15_000;
const MAX_RATE_LIMIT_MS = 5 * 60_000;

const retryAfterMs = (value: unknown, now: number): number | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const seconds = Number(value);
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
  if (!Number.isFinite(delay)) return null;
  return Math.max(0, Math.min(delay, MAX_RATE_LIMIT_MS));
};

export interface ApiProviderOptions {
  vendorAdapter: ApiVendorAdapter;
  secretStore?: SecretStore;
  apiKeyName?: string;
  pollIntervalLiveMs?: number;
  pollIntervalIdleMs?: number;
  fetchFn?: typeof fetch;
  now?: () => number;
}

export class ApiProvider implements MatchProvider {
  readonly id = 'api';
  private readonly vendor: ApiVendorAdapter;
  private readonly secrets: SecretStore;
  private readonly apiKeyName: string;
  private readonly pollIntervalLive: number;
  private readonly pollIntervalIdle: number;
  private readonly fetchFn: typeof fetch;
  private readonly now: () => number;

  private activeMatchId: string | null = null;
  private subscribers = new Map<string, Set<(raw: unknown) => void>>();
  private latestSnapshots = new Map<string, RawUpdate>();
  private etags = new Map<string, string>();
  private matchesCache: { key: string; at: number; matches: MatchSummary[] } | null = null;
  private matchesInFlight: Promise<MatchSummary[]> | null = null;
  private pollInFlight: { matchId: string; request: Promise<RawUpdate | null> } | null = null;

  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private consecutiveFailures = 0;
  private lastSuccessAt: number | null = null;
  private rateLimitedUntil = 0;
  private isDestroyed = false;
  private pollGeneration = 0;

  constructor(opts: ApiProviderOptions) {
    this.vendor = opts.vendorAdapter;
    this.secrets = opts.secretStore ?? new SecretStore();
    this.apiKeyName = opts.apiKeyName ?? 'cricket_api_key';
    this.pollIntervalLive = opts.pollIntervalLiveMs ?? 3000;
    this.pollIntervalIdle = opts.pollIntervalIdleMs ?? 60000;
    this.fetchFn = opts.fetchFn ?? fetch;
    this.now = opts.now ?? Date.now;
  }

  getApiKey(): string | null {
    return this.secrets.getSecret(this.apiKeyName) ?? process.env.STUMPCAST_CRICKET_API_KEY ?? null;
  }

  setApiKey(key: string): void {
    this.secrets.setSecret(this.apiKeyName, key.trim());
    this.consecutiveFailures = 0;
    this.rateLimitedUntil = 0;
    this.matchesCache = null;
    if (this.activeMatchId) {
      this.schedulePoll(0);
    }
  }

  async listMatches(): Promise<MatchSummary[]> {
    const key = this.getApiKey();
    if (!key) return [];
    if (this.now() < this.rateLimitedUntil) return this.matchesCache?.matches ?? [];
    if (this.matchesCache?.key === key && this.now() - this.matchesCache.at < MATCH_LIST_CACHE_MS) {
      return this.matchesCache.matches;
    }
    if (this.matchesInFlight) return this.matchesInFlight;

    const request = this.vendor
      .listMatches(key, this.fetchFn)
      .then((matches) => {
        this.matchesCache = { key, at: this.now(), matches };
        return matches;
      })
      .catch((err: unknown) => {
        this.recordFailure(err);
        return this.matchesCache?.matches ?? [];
      });
    this.matchesInFlight = request;
    try {
      return await request;
    } finally {
      if (this.matchesInFlight === request) this.matchesInFlight = null;
    }
  }

  subscribe(matchId: string, cb: (raw: unknown) => void): Unsubscribe {
    let set = this.subscribers.get(matchId);
    if (!set) {
      set = new Set();
      this.subscribers.set(matchId, set);
    }
    set.add(cb);
    this.activeMatchId = matchId;

    const existing = this.latestSnapshots.get(matchId);
    if (existing) {
      cb(existing);
    }

    this.schedulePoll(0);

    return () => {
      set?.delete(cb);
      if (set && set.size === 0) {
        this.subscribers.delete(matchId);
        if (this.activeMatchId === matchId) {
          this.activeMatchId = this.subscribers.keys().next().value ?? null;
        }
      }
    };
  }

  async snapshot(matchId: string): Promise<unknown> {
    return this.latestSnapshots.get(matchId) ?? null;
  }

  health(): ProviderHealth {
    const key = this.getApiKey();
    if (!key) return 'down';
    if (this.consecutiveFailures >= 5) return 'down';

    if (!this.activeMatchId) {
      return this.lastSuccessAt !== null ? 'connected' : 'stale';
    }

    if (this.lastSuccessAt === null) {
      return this.consecutiveFailures > 0 ? 'stale' : 'connected';
    }

    const elapsed = this.now() - this.lastSuccessAt;
    const staleThreshold = this.pollIntervalLive * 3;
    if (elapsed > staleThreshold) {
      return 'stale';
    }

    return 'connected';
  }

  lastDataAt(): number | null {
    return this.lastSuccessAt;
  }

  getActiveMatchId(): string | null {
    return this.activeMatchId;
  }

  destroy(): void {
    this.isDestroyed = true;
    this.pollGeneration++;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async pollNow(): Promise<RawUpdate | null> {
    const matchId = this.activeMatchId;
    if (!matchId || this.isDestroyed) return null;
    if (this.pollInFlight?.matchId === matchId) return this.pollInFlight.request;

    const request = this.performPoll(matchId);
    this.pollInFlight = { matchId, request };
    try {
      return await request;
    } finally {
      if (this.pollInFlight?.request === request) this.pollInFlight = null;
    }
  }

  private async performPoll(matchId: string): Promise<RawUpdate | null> {
    const key = this.getApiKey();
    if (!key) {
      this.consecutiveFailures++;
      return null;
    }

    if (this.now() < this.rateLimitedUntil) {
      return this.latestSnapshots.get(matchId) ?? null;
    }

    try {
      const etag = this.etags.get(matchId);
      const res = await this.vendor.fetchLiveScore(key, matchId, this.fetchFn, etag);

      if (res.etag) {
        this.etags.set(matchId, res.etag);
      }

      this.consecutiveFailures = 0;
      this.lastSuccessAt = this.now();

      let update: RawUpdate | null;
      if (res.data === null) {
        update = this.latestSnapshots.get(matchId) ?? null;
        if (!update) return null;
      } else {
        update = this.vendor.mapPayload(res.data, matchId, this.lastSuccessAt);
        this.latestSnapshots.set(matchId, update);
        for (const cb of this.subscribers.get(matchId) ?? []) cb(update);
      }
      return update;
    } catch (err: unknown) {
      this.recordFailure(err);
      return null;
    }
  }

  private recordFailure(err: unknown): void {
    this.consecutiveFailures++;
    const { status, retryAfter } = err as { status?: number; retryAfter?: string };
    if (status === 429) {
      const delay = retryAfterMs(retryAfter, this.now()) ?? DEFAULT_RATE_LIMIT_MS;
      this.rateLimitedUntil = Math.max(this.rateLimitedUntil, this.now() + delay);
    } else if (status === 401 || status === 403) {
      this.consecutiveFailures = 5;
    }
  }

  private schedulePoll(delayMs?: number): void {
    if (this.isDestroyed || !this.activeMatchId) return;
    const generation = ++this.pollGeneration;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    const backoff =
      delayMs !== undefined
        ? delayMs
        : this.consecutiveFailures > 0
          ? Math.min(this.pollIntervalLive * Math.pow(2, this.consecutiveFailures), 60000)
          : this.pollIntervalLive;
    const wait = Math.max(backoff, this.rateLimitedUntil - this.now());

    this.pollTimer = setTimeout(async () => {
      if (generation !== this.pollGeneration) return;
      await this.pollNow();
      if (!this.isDestroyed && this.activeMatchId && generation === this.pollGeneration) {
        this.schedulePoll();
      }
    }, wait);
  }
}
