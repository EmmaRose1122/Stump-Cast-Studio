import type {
  MatchProvider,
  MatchSummary,
  ProviderHealth,
  RawUpdate,
  Unsubscribe,
} from '@stumpcast/shared';
import type { ApiVendorAdapter } from './apiVendor';
import { SecretStore } from './SecretStore';

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
    if (this.activeMatchId) {
      this.schedulePoll(0);
    }
  }

  async listMatches(): Promise<MatchSummary[]> {
    const key = this.getApiKey();
    if (!key) return [];
    try {
      return await this.vendor.listMatches(key, this.fetchFn);
    } catch {
      return [];
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
      return this.lastSuccessAt !== null ? 'connected' : 'connected';
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
    if (!this.activeMatchId || this.isDestroyed) return null;
    const matchId = this.activeMatchId;
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
        // 304 Not Modified
        update = this.latestSnapshots.get(matchId) ?? null;
        if (!update) return null;
      } else {
        update = this.vendor.mapPayload(res.data, matchId, this.lastSuccessAt);
        this.latestSnapshots.set(matchId, update);
      }

      const subs = this.subscribers.get(matchId);
      if (subs) {
        for (const cb of subs) {
          cb(update);
        }
      }
      return update;
    } catch (err: unknown) {
      this.consecutiveFailures++;
      const status = (err as { status?: number }).status;
      if (status === 429) {
        this.rateLimitedUntil = this.now() + 15000;
      } else if (status === 401 || status === 403) {
        this.consecutiveFailures = 5; // Mark down immediately on auth failure
      }
      return null;
    }
  }

  private schedulePoll(delayMs?: number): void {
    if (this.isDestroyed || !this.activeMatchId) return;
    const generation = ++this.pollGeneration;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    const wait =
      delayMs !== undefined
        ? delayMs
        : this.consecutiveFailures > 0
          ? Math.min(this.pollIntervalLive * Math.pow(2, this.consecutiveFailures), 60000)
          : this.pollIntervalLive;

    this.pollTimer = setTimeout(async () => {
      if (generation !== this.pollGeneration) return;
      await this.pollNow();
      if (!this.isDestroyed && this.activeMatchId && generation === this.pollGeneration) {
        this.schedulePoll();
      }
    }, wait);
  }
}
