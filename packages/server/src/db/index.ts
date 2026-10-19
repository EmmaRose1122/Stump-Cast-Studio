import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

/** Ordered, append-only migrations. `PRAGMA user_version` records how many have run. */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE matches (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, format TEXT NOT NULL, status TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  );
  CREATE TABLE match_state_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT, match_id TEXT NOT NULL, state TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX idx_snapshots_match ON match_state_snapshots(match_id, id);
  CREATE TABLE events (
    id TEXT PRIMARY KEY, match_id TEXT NOT NULL, type TEXT NOT NULL, payload TEXT, at INTEGER NOT NULL
  );
  CREATE INDEX idx_events_match ON events(match_id, at);
  CREATE TABLE teams (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, short TEXT NOT NULL, color TEXT NOT NULL,
    logo_asset_id TEXT
  );
  CREATE TABLE players (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, team_id TEXT NOT NULL,
    is_captain INTEGER NOT NULL DEFAULT 0, is_wk INTEGER NOT NULL DEFAULT 0, photo_asset_id TEXT
  );
  CREATE TABLE assets (
    id TEXT PRIMARY KEY, type TEXT NOT NULL, file TEXT NOT NULL,
    rights_confirmed INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
  );
  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE sounds (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, file TEXT NOT NULL,
    include_in_loop INTEGER NOT NULL DEFAULT 0, volume REAL NOT NULL DEFAULT 1
  );
  CREATE TABLE licence (id INTEGER PRIMARY KEY, token TEXT NOT NULL, checked_at INTEGER);
  CREATE TABLE looks (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, plan TEXT NOT NULL DEFAULT 'free',
    definition TEXT NOT NULL
  );
  `,
  `
  CREATE TABLE manual_matches (
    id TEXT PRIMARY KEY, setup TEXT NOT NULL, created_at INTEGER NOT NULL
  );
  CREATE TABLE manual_commands (
    id INTEGER PRIMARY KEY AUTOINCREMENT, match_id TEXT NOT NULL, command TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX idx_manual_commands_match ON manual_commands(match_id, id);
  `,
];

export type StumpCastDb = BetterSQLite3Database<typeof schema>;

export const openDatabase = (dataDir: string): { sqlite: Database.Database; db: StumpCastDb } => {
  fs.mkdirSync(dataDir, { recursive: true });
  const sqlite = new Database(path.join(dataDir, 'stumpcast.db'));
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  migrate(sqlite);
  return { sqlite, db: drizzle(sqlite, { schema }) };
};

export const migrate = (sqlite: Database.Database): void => {
  const current = sqlite.pragma('user_version', { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    sqlite.transaction(() => {
      sqlite.exec(MIGRATIONS[v]!);
      sqlite.pragma(`user_version = ${v + 1}`);
    })();
  }
};

export { schema };
