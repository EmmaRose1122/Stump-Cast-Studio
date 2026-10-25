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
  /** Store multi-page fetch results for merging */
  private readonly multiPageCache = new Map<string, { pages: unknown[]; baseUrl: string; at: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  // ---- inbound ----------------------------------------------------------------------------

  ingest(update: RawUpdate): void {
    // Handle multi-page fetch results (HTML sent from connector for server-side processing)
    if (update.source === 'multi-page-fetch' && update.fields.multiPageData) {
      this.handleMultiPageFetch(update);
      return;
    }

    if (ExtensionProvider.isBlankScrape(update)) {
      this.rejected = {
        matchId: update.matchId,
        at: this.now(),
        reason: 'named no team and reported no ball',
      };
      return;
    }
    const invalid = ExtensionProvider.invalidReason(update);
    if (invalid) {
      this.rejected = { matchId: update.matchId, at: this.now(), reason: invalid };
      return;
    }

    // Merge with existing data for the same match (e.g., live page + squads page)
    const existing = this.latest.get(update.matchId);
    if (existing) {
      const merged = this.mergeUpdates(existing, update);
      this.latest.set(update.matchId, merged);
      this.receivedAt.set(update.matchId, this.now());
      for (const cb of this.subs.get(update.matchId) ?? []) cb(merged);
      for (const cb of this.updateListeners) cb(merged);
    } else {
      this.latest.set(update.matchId, update);
      this.receivedAt.set(update.matchId, this.now());
      for (const cb of this.subs.get(update.matchId) ?? []) cb(update);
      for (const cb of this.updateListeners) cb(update);
    }
  }

  private handleMultiPageFetch(update: RawUpdate): void {
    const pages = update.fields.multiPageData as unknown[];
    this.multiPageCache.set(update.matchId, {
      pages,
      baseUrl: update.url,
      at: this.now(),
    });

    // Merge with existing data if available
    const existing = this.latest.get(update.matchId);
    if (existing) {
      const merged = this.mergeMultiPageData(existing, pages);
      this.latest.set(update.matchId, merged);
      this.receivedAt.set(update.matchId, this.now());
      for (const cb of this.subs.get(update.matchId) ?? []) cb(merged);
      for (const cb of this.updateListeners) cb(merged);
    }
  }

  /** Merge two updates for the same match, preferring non-empty values from each. */
  private mergeUpdates(existing: RawUpdate, incoming: RawUpdate): RawUpdate {
    const ef = existing.fields;
    const inf = incoming.fields;

    // Merge teams: combine squads, logos, players
    const mergedTeams = this.mergeTeams(ef.teams, inf.teams);

    // Merge batters: prefer incoming if it has more data
    const mergedBatters = this.mergeBatters(ef.batters, inf.batters);

    // Merge bowler: prefer incoming if it has more data
    const mergedBowler = this.mergeBowler(ef.bowler, inf.bowler);

    // Merge innings: combine all innings
    const mergedInnings = this.mergeInnings(ef.innings, inf.innings);

    // Use incoming for scalar fields if they have values, otherwise keep existing
    const pick = <T>(incomingVal: T | undefined, existingVal: T | undefined): T | undefined =>
      incomingVal !== undefined && incomingVal !== null ? incomingVal : existingVal;

    return {
      ...incoming, // Use incoming as base (newer timestamp, etc.)
      fields: {
        ...inf,
        teams: mergedTeams,
        batters: mergedBatters,
        bowler: mergedBowler,
        innings: mergedInnings,
        title: pick(inf.title, ef.title),
        status: pick(inf.status, ef.status),
        venue: pick(inf.venue, ef.venue),
        toss: pick(inf.toss, ef.toss),
        partnership: pick(inf.partnership, ef.partnership),
        target: pick(inf.target, ef.target),
        crr: pick(inf.crr, ef.crr),
        rrr: pick(inf.rrr, ef.rrr),
        day: pick(inf.day, ef.day),
        session: pick(inf.session, ef.session),
        resultText: pick(inf.resultText, ef.resultText),
        commentaryLast: pick(inf.commentaryLast, ef.commentaryLast),
        format: pick(inf.format, ef.format),
        oversLimit: pick(inf.oversLimit, ef.oversLimit),
        preMatch: pick(inf.preMatch, ef.preMatch),
        thisOver: inf.thisOver?.length ? inf.thisOver : ef.thisOver,
        lastBalls: inf.lastBalls?.length ? inf.lastBalls : ef.lastBalls,
      },
      // Keep higher confidence
      confidence: Math.max(existing.confidence, incoming.confidence),
      missing: [...new Set([...existing.missing, ...incoming.missing])],
    };
  }

  private mergeTeams(
    existing: RawUpdate['fields']['teams'],
    incoming: RawUpdate['fields']['teams']
  ): RawUpdate['fields']['teams'] {
    if (incoming.length === 0) return existing;
    // A completed live scrape names both sides. Old or partial entries must not accumulate into a
    // third "team" ("DEN P1" alongside "Denmark" and "Papua New Guinea"), because the match schema
    // keeps two and the extra one pushes the real opponent out.
    if (incoming.length >= 2) return incoming;
    if (existing.length >= 2) return existing;
    const byName = new Map<string, RawUpdate['fields']['teams'][0]>();
    for (const t of [...existing, ...incoming]) {
      const key = t.name.toLowerCase();
      const previous = byName.get(key);
      byName.set(key, previous ? {
        ...previous,
        ...t,
        logoUrl: t.logoUrl || previous.logoUrl,
        squad: t.squad?.length ? t.squad : previous.squad,
        players: t.players?.length ? t.players : previous.players,
      } : t);
    }
    return [...byName.values()];
  }

  private mergeBatters(
    existing: RawUpdate['fields']['batters'],
    incoming: RawUpdate['fields']['batters']
  ): RawUpdate['fields']['batters'] {
    if (incoming.length === 0) return existing;
    // A lower score is normal after an innings change; runs are not a version number. The newest
    // full list is current, while a shorter list is a patch (for example a squads page).
    return incoming.length >= existing.length ? incoming : existing;
  }

  private mergeBowler(
    existing: RawUpdate['fields']['bowler'],
    incoming: RawUpdate['fields']['bowler']
  ): RawUpdate['fields']['bowler'] {
    return incoming ?? existing;
  }

  private mergeInnings(
    existing: RawUpdate['fields']['innings'],
    incoming: RawUpdate['fields']['innings']
  ): RawUpdate['fields']['innings'] {
    if (incoming.length === 0) return existing;
    if (existing.length === 0) return incoming;
    // Innings are ordered, not unique per team: a Test has two innings from the same side, and a
    // team-keyed merge collapsed the live third innings into the first. A newer, equally complete
    // snapshot is the whole innings list.
    if (incoming.length >= existing.length) return incoming;
    return existing.map((old, index) => {
      const next = incoming[index];
      return next && (next.runs >= old.runs || next.overs > old.overs) ? next : old;
    });
  }

  private mergeMultiPageData(baseUpdate: RawUpdate, pages: unknown[]): RawUpdate {
    // Collect all teams, players, squads from all pages
    const allTeams: typeof baseUpdate.fields.teams = [];
    const allBatters: typeof baseUpdate.fields.batters = [];
    let mergedBowler: typeof baseUpdate.fields.bowler = undefined;
    const allInnings: typeof baseUpdate.fields.innings = [];

    const seenTeams = new Set<string>();
    const seenBatters = new Set<string>();
    const seenBowlers = new Set<string>();

    for (const page of pages) {
      if (!page || typeof page !== 'object') continue;
      const p = page as Record<string, unknown>;
      
      // Extract teams
      if (p.rawUpdate && typeof p.rawUpdate === 'object') {
        const raw = p.rawUpdate as Record<string, unknown>;
        if (raw.fields && typeof raw.fields === 'object') {
          const fields = raw.fields as Record<string, unknown>;
          
          // Teams
          if (Array.isArray(fields.teams)) {
            for (const team of fields.teams) {
              if (team && typeof team === 'object' && 'name' in team) {
                const key = (team as { name: string }).name.toLowerCase();
                if (!seenTeams.has(key)) {
                  seenTeams.add(key);
                  allTeams.push(team as typeof baseUpdate.fields.teams[0]);
                }
              }
            }
          }
          
          // Batters
          if (Array.isArray(fields.batters)) {
            for (const batter of fields.batters) {
              if (batter && typeof batter === 'object' && 'name' in batter) {
                const key = (batter as { name: string }).name.toLowerCase();
                if (!seenBatters.has(key)) {
                  seenBatters.add(key);
                  allBatters.push(batter as typeof baseUpdate.fields.batters[0]);
                }
              }
            }
          }
          
          // Bowler
          if (fields.bowler && typeof fields.bowler === 'object' && 'name' in fields.bowler) {
            const key = (fields.bowler as { name: string }).name.toLowerCase();
            if (!seenBowlers.has(key)) {
              seenBowlers.add(key);
              mergedBowler = fields.bowler as typeof baseUpdate.fields.bowler;
            }
          }
          
          // Innings
          if (Array.isArray(fields.innings)) {
            for (const inn of fields.innings) {
              allInnings.push(inn as typeof baseUpdate.fields.innings[0]);
            }
          }
        }
      }
    }

    // Use base update as primary, supplement with merged data
    return {
      ...baseUpdate,
      fields: {
        ...baseUpdate.fields,
        teams: allTeams.length > 0 ? allTeams : baseUpdate.fields.teams,
        batters: allBatters.length > 0 ? allBatters.slice(0, 2) : baseUpdate.fields.batters,
        bowler: mergedBowler ?? baseUpdate.fields.bowler,
        innings: allInnings.length > 0 ? allInnings : baseUpdate.fields.innings,
      },
    };
  }

  /**
   * A scrape that named nobody and had nothing to show is the adapter guessing around a page it
   * could not read, not a match. Publishing one used to wipe whatever was on air and fill
   * "Pick the match" with rows like `Batting vs Team B · 0-0`.
   */
  /** Reasons a scrape cannot be attached to a real Crex match or cannot represent cricket. */
  static invalidReason(u: RawUpdate): string | null {
    if (u.source === 'crex' && (!/^[a-z0-9]{2,12}$/i.test(u.matchId) || /^unknown$/i.test(u.matchId))) {
      return 'Crex match id is a page path, not a match key';
    }
    const innings = u.fields.innings.at(-1);
    if (innings && innings.runs > 0 && innings.overs === 0 && innings.balls === 0) {
      return 'score has runs but no legal balls';
    }
    return null;
  }

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
