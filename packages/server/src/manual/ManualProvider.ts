import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import {
  ManualCommandSchema,
  ManualSetupSchema,
  slug,
  type ManualCommand,
  type ManualSetup,
  type MatchProvider,
  type MatchSummary,
  type ProviderHealth,
  type RawUpdate,
  type Unsubscribe,
} from '@stumpcast/shared';
import { ManualError, ManualMatch } from './ManualMatch';

interface Row {
  id: string;
  setup: string;
}
interface CmdRow {
  id: number;
  command: string;
}

/**
 * Operator-scored matches (optional backup source). The command log lives in SQLite; the state
 * is rebuilt by replaying it, which makes undo trivial and restarts lossless.
 */
export class ManualProvider implements MatchProvider {
  readonly id = 'manual';
  private readonly matches = new Map<string, ManualMatch>();
  private readonly listeners = new Set<(u: RawUpdate) => void>();
  private readonly subs = new Map<string, Set<(raw: unknown) => void>>();

  constructor(
    private readonly sqlite: Database.Database,
    private readonly now: () => number = Date.now,
  ) {
    this.load();
  }

  // ---- persistence -----------------------------------------------------------------------

  private load(): void {
    const rows = this.sqlite.prepare('SELECT id, setup FROM manual_matches').all() as Row[];
    for (const r of rows) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(r.setup);
      } catch {
        continue;
      }
      const setup = ManualSetupSchema.safeParse(parsed);
      if (!setup.success) continue;
      const match = new ManualMatch(r.id, setup.data);
      const cmds = this.sqlite
        .prepare('SELECT id, command FROM manual_commands WHERE match_id = ? ORDER BY id')
        .all(r.id) as CmdRow[];
      for (const c of cmds) {
        try {
          match.apply(ManualCommandSchema.parse(JSON.parse(c.command)));
        } catch {
          /* a command that no longer replays is skipped rather than losing the match */
        }
      }
      this.matches.set(r.id, match);
    }
  }

  // ---- management ------------------------------------------------------------------------

  create(input: unknown): ManualMatch {
    const setup = ManualSetupSchema.parse(input);
    const base = slug(setup.title ?? `${setup.teams[0].name}-v-${setup.teams[1].name}`) || 'match';
    const id = `manual-${base}-${crypto.randomBytes(4).toString('hex')}`;
    const match = new ManualMatch(id, setup);
    this.sqlite
      .prepare('INSERT INTO manual_matches (id, setup, created_at) VALUES (?, ?, ?)')
      .run(id, JSON.stringify(setup), this.now());
    this.matches.set(id, match);
    this.publish(match);
    return match;
  }

  get(id: string): ManualMatch | undefined {
    return this.matches.get(id);
  }

  list(): ManualMatch[] {
    return [...this.matches.values()];
  }

  delete(id: string): boolean {
    if (!this.matches.delete(id)) return false;
    this.sqlite.prepare('DELETE FROM manual_commands WHERE match_id = ?').run(id);
    this.sqlite.prepare('DELETE FROM manual_matches WHERE id = ?').run(id);
    return true;
  }

  /** Validate, apply and persist a command. Throws ManualError when it is not allowed. */
  command(id: string, cmd: ManualCommand): ManualMatch {
    const match = this.matches.get(id);
    if (!match) throw new ManualError('Unknown match');
    match.apply(cmd); // throws before anything is stored if the command is invalid
    this.sqlite
      .prepare('INSERT INTO manual_commands (match_id, command, created_at) VALUES (?, ?, ?)')
      .run(id, JSON.stringify(cmd), this.now());
    this.publish(match);
    return match;
  }

  /** Remove the last command and rebuild the match from the remaining log. */
  undo(id: string): ManualMatch {
    const old = this.matches.get(id);
    if (!old) throw new ManualError('Unknown match');
    const last = this.sqlite
      .prepare('SELECT id FROM manual_commands WHERE match_id = ? ORDER BY id DESC LIMIT 1')
      .get(id) as { id: number } | undefined;
    if (!last) throw new ManualError('Nothing to undo');
    this.sqlite.prepare('DELETE FROM manual_commands WHERE id = ?').run(last.id);

    const rebuilt = new ManualMatch(id, old.setup);
    const cmds = this.sqlite
      .prepare('SELECT command FROM manual_commands WHERE match_id = ? ORDER BY id')
      .all(id) as { command: string }[];
    for (const c of cmds) {
      try {
        rebuilt.apply(ManualCommandSchema.parse(JSON.parse(c.command)));
      } catch {
        /* skip unparseable commands */
      }
    }
    this.matches.set(id, rebuilt);
    this.publish(rebuilt);
    return rebuilt;
  }

  commandCount(id: string): number {
    const r = this.sqlite
      .prepare('SELECT COUNT(*) AS n FROM manual_commands WHERE match_id = ?')
      .get(id) as { n: number };
    return r.n;
  }

  // ---- MatchProvider ---------------------------------------------------------------------

  /** Receive every update from every manual match (feeds the match engine). */
  onUpdate(cb: (u: RawUpdate) => void): Unsubscribe {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private publish(match: ManualMatch): void {
    const update = match.toRawUpdate(this.now());
    for (const cb of this.subs.get(match.id) ?? []) cb(update);
    for (const cb of this.listeners) cb(update);
  }

  async listMatches(): Promise<MatchSummary[]> {
    return this.list().map((m) => ({
      matchId: m.id,
      title: m.title,
      teams: m.setup.teams.map((t) => t.name),
      status: m.result ?? 'Live',
      source: 'manual',
    }));
  }

  subscribe(matchId: string, cb: (raw: unknown) => void): Unsubscribe {
    const set = this.subs.get(matchId) ?? new Set();
    set.add(cb);
    this.subs.set(matchId, set);
    return () => set.delete(cb);
  }

  async snapshot(matchId: string): Promise<unknown> {
    return this.matches.get(matchId)?.toRawUpdate(this.now()) ?? null;
  }

  /** The operator is the source, so it is always available. */
  health(): ProviderHealth {
    return 'connected';
  }

  /** Re-publish every match, e.g. after a restart, so the engine has state straight away. */
  republishAll(): void {
    for (const m of this.matches.values()) this.publish(m);
  }
}

export type { ManualSetup };
