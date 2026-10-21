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
  private sender: { owner: object; fn: (cmd: ExtCommand) => boolean } | null = null;
  /** Newest "adapter could not read the page" report; explains why no match appears. */
  private degraded: { site: string; url: string; confidence: number; missing: string[]; at: number } | null = null;
  /** Newest "this scrape is not a match" rejection, so an empty match list has an explanation. */
  private rejected: { matchId: string; at: number; reason: string } | null = null;

  constructor(private readonly now: () => number = Date.now) {}

  // ---- inbound ----------------------------------------------------------------------------

  ingest(update: RawUpdate): void {
    if (ExtensionProvider.isBlankScrape(update)) {
      this.rejected = {
        matchId: update.matchId,
        at: this.now(),
        reason: 'named no team and reported no ball',
      };
      return;
    }
    this.latest.set(update.matchId, update);
    this.receivedAt.set(update.matchId, this.now());
    for (const cb of this.subs.get(update.matchId) ?? []) cb(update);
    for (const cb of this.updateListeners) cb(update);
  }

  /**
   * A scrape that named nobody and had nothing to show is the adapter guessing around a page it
   * could not read, not a match. Publishing one used to wipe whatever was on air and fill
   * "Pick the match" with rows like `Batting vs Team B · 0-0`.
   */
  static isBlankScrape(u: RawUpdate): boolean {
    if (u.source === 'manual') return false;
    const named = u.fields.teams.some((t) => t.name.trim().length > 0);
    const played = u.fields.innings.some(
      (i) => i.runs > 0 || i.wkts > 0 || i.overs > 0 || i.balls > 0,
    );
    return !named && !played;
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
  setCommandSender(fn: ((cmd: ExtCommand) => boolean) | null, owner: object = this): void {
    if (fn === null) {
      this.releaseCommandSender(owner);
      return;
    }
    this.sender = { owner, fn };
    for (const cb of this.connectionListeners) cb(true);
  }

  /**
   * Only the socket that owns the channel may clear it. Without this, a stale socket closing
   * after a newer one connected would silently kill the command path of the live extension.
   */
  releaseCommandSender(owner: object): void {
    if (this.sender && this.sender.owner !== owner) return;
    this.sender = null;
    for (const cb of this.connectionListeners) cb(false);
  }

  /** Called when the extension connects (true) or disconnects (false). */
  onConnectionChange(cb: (connected: boolean) => void): Unsubscribe {
    this.connectionListeners.add(cb);
    return () => this.connectionListeners.delete(cb);
  }

  sendCommand(cmd: ExtCommand): boolean {
    return this.sender?.fn(cmd) ?? false;
  }

  // ---- MatchProvider ----------------------------------------------------------------------

  async listMatches(): Promise<MatchSummary[]> {
    return [...this.latest.values()]
      .map((u) => ({
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
      lastRejected: this.rejected,
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
