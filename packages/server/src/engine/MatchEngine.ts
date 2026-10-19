import { MatchStateSchema, type MatchState, type RawUpdate } from '@stumpcast/shared';
import { schema, type StumpCastDb } from '../db';
import { rawToBaseState } from './adapt';
import { deriveStats } from './derive';
import { BallTracker } from './tracker';

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
  private readonly listeners = new Set<(s: MatchState) => void>();
  private readonly now: () => number;

  constructor(private readonly opts: MatchEngineOptions = {}) {
    this.now = opts.now ?? Date.now;
    if (opts.onState) this.listeners.add(opts.onState);
  }

  /** Returns the new state, or null if nothing changed. */
  process(raw: RawUpdate): MatchState | null {
    const at = new Date(this.now()).toISOString();
    const base = rawToBaseState(raw, at);
    this.tracker.observe(base);
    const derived = deriveStats(this.tracker.apply(base));
    const parsed = MatchStateSchema.safeParse(derived);
    if (!parsed.success) return null; // never publish an invalid state
    const state = parsed.data;

    const print = fingerprint(state);
    if (this.prints.get(state.id) === print) return null;
    this.prints.set(state.id, print);

    const frozen = deepFreeze(structuredClone(state));
    this.states.set(state.id, frozen);
    this.persist(frozen);
    for (const cb of this.listeners) cb(frozen);
    return frozen;
  }

  getState(matchId: string): MatchState | undefined {
    return this.states.get(matchId);
  }

  allStates(): MatchState[] {
    return [...this.states.values()];
  }

  deleteMatch(matchId: string): boolean {
    const deleted = this.states.delete(matchId);
    this.prints.delete(matchId);
    return deleted;
  }

  clear(): void {
    this.states.clear();
    this.prints.clear();
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
  }
}
