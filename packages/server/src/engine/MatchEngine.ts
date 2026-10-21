import { MatchStateSchema, type MatchState, type RawUpdate } from '@stumpcast/shared';
import { sql } from 'drizzle-orm';
import { schema, type StumpCastDb } from '../db';
import { rawToBaseState } from './adapt';
import { deriveStats } from './derive';
import { PlayerTracker } from './players';
import { BallTracker } from './tracker';

/** Snapshots kept per match: enough history for the trackers to rebuild a whole innings. */
const MAX_SNAPSHOTS_PER_MATCH = 600;
/** Pruning is an index scan, so it runs every so often rather than on every delivery. */
const PRUNE_EVERY = 100;

export interface MatchEngineOptions {
  db?: StumpCastDb;
  now?: () => number;
  /** Called with every changed state (immutable copy). */
  onState?: (state: MatchState) => void;
}

/** Everything except the timestamp, so a pure re-send does not count as a change. */
const fingerprint = (s: MatchState): string => {
  return JSON.stringify({ ...s, updatedAt: undefined });
};

const deepFreeze = <T>(o: T): T => {
  if (o && typeof o === 'object') {
    for (const v of Object.values(o)) deepFreeze(v);
    Object.freeze(o);
  }
  return o;
};

/**
 * Provider-agnostic engine: RawUpdate -> validated MatchState with derived stats.
 * Emits only when the state changed; persists an immutable snapshot per change.
 */
export class MatchEngine {
  private readonly states = new Map<string, MatchState>();
  private readonly prints = new Map<string, string>();
  private readonly tracker = new BallTracker();
  private readonly players = new PlayerTracker();
  private readonly listeners = new Set<(s: MatchState) => void>();
  private readonly now: () => number;
  /** Snapshots written per match, counted here so pruning does not need a COUNT query. */
  private readonly snapshotsWritten = new Map<string, number>();

  constructor(private readonly opts: MatchEngineOptions = {}) {
    this.now = opts.now ?? Date.now;
    if (opts.onState) this.listeners.add(opts.onState);
  }

  /** Returns the new state, or null if nothing changed. */
  process(raw: RawUpdate): MatchState | null {
    const at = new Date(this.now()).toISOString();
    const base = MatchStateSchema.safeParse(rawToBaseState(raw, at));
    // Validate before observing: a rejected scrape must not pollute the dot/boundary/powerplay
    // counts that the *next* valid state gets published with.
    if (!base.success) return null;
    this.tracker.observe(base.data);
    this.players.observe(base.data);
    const derived = deriveStats(this.players.apply(this.tracker.apply(base.data)));
    const parsed = MatchStateSchema.safeParse(derived);
    if (!parsed.success) return null; // never publish an invalid state
    const state = parsed.data;

    const print = fingerprint(state);
    if (this.prints.get(state.id) === print) return null;
    this.prints.set(state.id, print);

    const frozen = deepFreeze(structuredClone(state));
    this.states.set(state.id, frozen);
    this.persist(frozen);
    // One bad subscriber (Director, commentary) must not skip the others or fail the ingest.
    for (const cb of this.listeners) {
      try {
        cb(frozen);
      } catch (err) {
        console.error('MatchEngine listener threw', err);
      }
    }
    return frozen;
  }

  getState(matchId: string): MatchState | undefined {
    return this.states.get(matchId);
  }

  /**
   * Replays the stored snapshots so a restart brings the last score of every match back with its
   * accumulated stats (dot %, boundaries, powerplay, best figures) instead of an empty preview.
   * No listener runs: restoring is not a broadcast, and replaying it would re-narrate old balls.
   * Returns the latest state per match.
   */
  restore(db: StumpCastDb): MatchState[] {
    const rows = db
      .select({ state: schema.snapshots.state })
      .from(schema.snapshots)
      .orderBy(schema.snapshots.id)
      .all();
    const latest = new Map<string, MatchState>();
    for (const row of rows) {
      const parsed = MatchStateSchema.safeParse(row.state);
      if (!parsed.success) continue;
      this.tracker.observe(parsed.data);
      this.players.observe(parsed.data);
      latest.set(parsed.data.id, parsed.data);
    }
    const restored: MatchState[] = [];
    for (const state of latest.values()) {
      const parsed = MatchStateSchema.safeParse(
        deriveStats(this.players.apply(this.tracker.apply(state))),
      );
      if (!parsed.success) continue;
      const frozen = deepFreeze(structuredClone(parsed.data));
      this.states.set(frozen.id, frozen);
      this.prints.set(frozen.id, fingerprint(frozen));
      restored.push(frozen);
    }
    return restored;
  }

  allStates(): MatchState[] {
    return [...this.states.values()];
  }

  deleteMatch(matchId: string): boolean {
    const deleted = this.states.delete(matchId);
    this.prints.delete(matchId);
    this.snapshotsWritten.delete(matchId);
    this.tracker.remove(matchId);
    this.players.remove(matchId);
    return deleted;
  }

  clear(): void {
    this.states.clear();
    this.prints.clear();
    this.tracker.clear();
    this.players.clear();
  }

  subscribe(cb: (s: MatchState) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private persist(s: MatchState): void {
    const db = this.opts.db;
    if (!db) return;
    const ts = this.now();
    db.insert(schema.matches)
      .values({
        id: s.id,
        title: s.title,
        format: s.format,
        status: s.status,
        source: 'extension',
        createdAt: ts,
        updatedAt: ts,
      })
      .onConflictDoUpdate({
        target: schema.matches.id,
        set: { title: s.title, format: s.format, status: s.status, updatedAt: ts },
      })
      .run();
    db.insert(schema.snapshots).values({ matchId: s.id, state: s, createdAt: ts }).run();

    // Every delivery used to add a row for the life of the installation, and boot replays every
    // row through both trackers. A rolling window keeps that bounded without losing the history
    // the trackers need to rebuild this innings after a restart.
    const written = (this.snapshotsWritten.get(s.id) ?? 0) + 1;
    if (written >= PRUNE_EVERY) {
      this.snapshotsWritten.set(s.id, 0);
      db.run(sql`
        DELETE FROM ${schema.snapshots}
        WHERE ${schema.snapshots.matchId} = ${s.id}
          AND ${schema.snapshots.id} NOT IN (
            SELECT ${schema.snapshots.id} FROM ${schema.snapshots}
            WHERE ${schema.snapshots.matchId} = ${s.id}
            ORDER BY ${schema.snapshots.id} DESC
            LIMIT ${MAX_SNAPSHOTS_PER_MATCH}
          )
      `);
    } else {
      this.snapshotsWritten.set(s.id, written);
    }
  }
}
