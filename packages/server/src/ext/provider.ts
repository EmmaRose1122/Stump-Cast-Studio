import type {
  ExtCommand,
  Heartbeat,
  MatchProvider,
  MatchSummary,
  ProviderHealth,
  RawUpdate,
  TabInfo,
  Unsubscribe,
} from '@stumpcast/shared';

export const HEARTBEAT_TIMEOUT_MS = 15_000;
export const STALE_AFTER_MS = 20_000;

export type MatchHealth = ProviderHealth | 'unknown';

/** PRIMARY data source: normalised updates streamed by the Chrome extension. */
export class ExtensionProvider implements MatchProvider {
  readonly id = 'extension';

  private readonly latest = new Map<string, RawUpdate>();
  private readonly receivedAt = new Map<string, number>();
  private readonly subs = new Map<string, Set<(raw: unknown) => void>>();
  private readonly updateListeners = new Set<(u: RawUpdate) => void>();
  private readonly connectionListeners = new Set<(connected: boolean) => void>();
  private lastHeartbeatAt: number | null = null;
  private heartbeat: Heartbeat | null = null;
  private sender: ((cmd: ExtCommand) => boolean) | null = null;
  /** Newest "adapter could not read the page" report; explains why no match appears. */
  private degraded: { site: string; url: string; confidence: number; missing: string[]; at: number } | null = null;

  constructor(private readonly now: () => number = Date.now) {}

  // ---- inbound ----------------------------------------------------------------------------

  ingest(update: RawUpdate): void {
    this.latest.set(update.matchId, update);
    this.receivedAt.set(update.matchId, this.now());
    for (const cb of this.subs.get(update.matchId) ?? []) cb(update);
    for (const cb of this.updateListeners) cb(update);
  }

  deleteMatch(matchId: string): void {
    this.latest.delete(matchId);
    this.receivedAt.delete(matchId);
    this.subs.delete(matchId);
  }

  clear(): void {
    this.latest.clear();
    this.receivedAt.clear();
    this.subs.clear();
  }

  /** Receive every update from every match (used to feed the match engine). */
  onUpdate(cb: (u: RawUpdate) => void): Unsubscribe {
    this.updateListeners.add(cb);
    return () => this.updateListeners.delete(cb);
  }

  recordDegraded(d: { site: string; url: string; confidence: number; missing: string[]; at: number }): void {
    this.degraded = d;
  }

  recordHeartbeat(hb: Heartbeat): void {
    this.heartbeat = hb;
    this.lastHeartbeatAt = this.now();
  }

  /** The WS layer registers how to push a command to the connected extension. */
  setCommandSender(fn: ((cmd: ExtCommand) => boolean) | null): void {
    this.sender = fn;
    for (const cb of this.connectionListeners) cb(fn !== null);
  }

  /** Called when the extension connects (true) or disconnects (false). */
  onConnectionChange(cb: (connected: boolean) => void): Unsubscribe {
    this.connectionListeners.add(cb);
    return () => this.connectionListeners.delete(cb);
  }

  sendCommand(cmd: ExtCommand): boolean {
    return this.sender?.(cmd) ?? false;
  }

  // ---- MatchProvider ----------------------------------------------------------------------

  async listMatches(): Promise<MatchSummary[]> {
    return [...this.latest.values()].map((u) => ({
      matchId: u.matchId,
      title: u.fields.title ?? u.matchId,
      teams: u.fields.teams.map((t) => t.name),
      status: u.fields.status,
      source: u.source,
    }));
  }

  subscribe(matchId: string, cb: (raw: unknown) => void): Unsubscribe {
    const set = this.subs.get(matchId) ?? new Set();
    set.add(cb);
    this.subs.set(matchId, set);
    return () => set.delete(cb);
  }

  async snapshot(matchId: string): Promise<unknown> {
    return this.latest.get(matchId) ?? null;
  }

  /** down: no heartbeat or data for 15 s. stale: a live tab has produced nothing for 20 s. */
  health(): ProviderHealth {
    const lastData = this.lastDataAt();
    const hasRecentData = lastData !== null && this.now() - lastData <= HEARTBEAT_TIMEOUT_MS;
    const hasRecentHeartbeat =
      this.lastHeartbeatAt !== null && this.now() - this.lastHeartbeatAt <= HEARTBEAT_TIMEOUT_MS;

    if (!hasRecentHeartbeat && !hasRecentData) {
      return 'down';
    }
    const tabs = this.heartbeat?.tabs ?? [];
    return tabs.some((t) => this.tabAge(t) > STALE_AFTER_MS) ? 'stale' : 'connected';
  }

  /** Newest sign of life from any match (update or unchanged-score tick), or null. */
  lastDataAt(): number | null {
    let newest: number | null = null;
    const consider = (t: number) => {
      if (newest === null || t > newest) newest = t;
    };
    for (const t of this.receivedAt.values()) consider(t);
    for (const tab of this.heartbeat?.tabs ?? []) consider(tab.lastUpdateAt);
    return newest;
  }

  matchHealth(matchId: string): MatchHealth {
    if (this.health() === 'down') return 'down';
    const tab = this.heartbeat?.tabs.find((t) => t.matchId === matchId);
    if (!tab) return this.latest.has(matchId) ? 'stale' : 'unknown';
    return this.tabAge(tab) > STALE_AFTER_MS ? 'stale' : 'connected';
  }

  status() {
    return {
      health: this.health(),
      lastHeartbeatAt: this.lastHeartbeatAt,
      extensionVersion: this.heartbeat?.extensionVersion ?? null,
      selectorsVersion: this.heartbeat?.selectorsVersion ?? null,
      lastDegraded: this.degraded,
      openTabs: this.heartbeat?.tabs.length ?? 0,
      matches: [...this.latest.keys()].map((matchId) => ({
        matchId,
        health: this.matchHealth(matchId),
      })),
    };
  }

  private tabAge(tab: TabInfo): number {
    const seen = Math.max(tab.lastUpdateAt, this.receivedAt.get(tab.matchId) ?? 0);
    return this.now() - seen;
  }
}
