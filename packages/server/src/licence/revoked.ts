import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Revocations written by the Python key generator (see `data/licences/revoked.json`).
 *
 * A token is only ever looked at here AFTER its Ed25519 signature has been checked, so matching on
 * the decoded payload is safe: nobody can add themselves to a revocation list by forging a token.
 * We match on two things at once — the exact token string, and the `channel|iat` identity — so the
 * check does not depend on both sides agreeing on a hash recipe.
 */
export interface RevokedEntry {
  fingerprint?: string;
  token?: string;
  channel?: string;
  plan?: string;
  iat?: number;
  exp?: number | null;
  revokedAt?: string;
  note?: string;
}

export interface RevocationIndex {
  tokens: ReadonlySet<string>;
  ids: ReadonlySet<string>;
  /** The file this index was built from, or null when no revoke list exists (yet). */
  file: string | null;
  count: number;
}

/** sha256 over the whole token, first 16 hex characters. Mirrors the Python key generator. */
export const fingerprintOf = (token: string): string =>
  createHash('sha256').update(token).digest('hex').slice(0, 16);

const FILE = path.join('data', 'licences', 'revoked.json');

/**
 * The app lives next to the repo, not inside the pnpm workspace, so the path is resolved the same
 * forgiving way the rest of the server resolves its neighbours: override, then bundle/source
 * layouts, then cwd, then the packaged install.
 */
const candidates = (): string[] => {
  const from = import.meta.dirname;
  const env = process.env.STUMPCAST_REVOKED_KEYS_FILE;
  const list = [
    env,
    // .../packages/server/src/licence -> repo root (tsx dev), and .../packages/server/dist (esbuild).
    path.resolve(from, '..', '..', '..', '..', FILE),
    path.resolve(from, '..', '..', '..', FILE),
    path.resolve(from, '..', '..', '..', '..', '..', FILE),
    path.resolve(process.cwd(), '..', FILE),
    path.resolve(process.cwd(), FILE),
    path.join(process.env.USERPROFILE || '', 'Downloads', 'StumpCast Studio', FILE),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'StumpCast Studio', FILE),
  ].filter(Boolean) as string[];
  return [...new Set(list)];
};

export const buildRevocationIndex = (
  entries: readonly RevokedEntry[],
  file: string | null,
): RevocationIndex => {
  const tokens = new Set<string>();
  const ids = new Set<string>();
  for (const e of entries) {
    if (typeof e.token === 'string' && e.token.trim() !== '') tokens.add(e.token.trim());
    if (typeof e.channel === 'string' && typeof e.iat === 'number') ids.add(`${e.channel}|${e.iat}`);
  }
  return { tokens, ids, file, count: entries.length };
};

const EMPTY: RevocationIndex = { tokens: new Set(), ids: new Set(), file: null, count: 0 };

let cache: { key: string; index: RevocationIndex } | null = null;
let located: { at: number; file: string | null } | null = null;

/** Locating the file costs a handful of stat calls; re-look for it at most twice a second. */
const locate = (): string | null => {
  const now = Date.now();
  if (located && now - located.at < 2_000) return located.file;
  const file =
    candidates().find((p) => {
      try {
        return fs.statSync(p).isFile();
      } catch {
        return false;
      }
    }) ?? null;
  if (file !== located?.file) cache = null;
  located = { at: now, file };
  return file;
};

/** Re-reads only when the file's size or mtime moved, so a revoke lands without restarting anything. */
export const loadRevocations = (): RevocationIndex => {
  const file = locate();
  if (!file) {
    cache = null;
    return EMPTY;
  }
  const stat = fs.statSync(file);
  const key = `${file}:${stat.size}:${stat.mtimeMs}`;
  if (cache?.key === key) return cache.index;
  let index = EMPTY;
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
    const entries = Array.isArray(raw)
      ? (raw as RevokedEntry[])
      : Array.isArray((raw as { revoked?: RevokedEntry[] })?.revoked)
        ? ((raw as { revoked: RevokedEntry[] }).revoked)
        : [];
    index = buildRevocationIndex(entries, file);
  } catch {
    // An unreadable revoke list must not hand everybody a free pass: keep the last good one.
    index = cache?.index ?? EMPTY;
  }
  cache = { key, index };
  return index;
};

export const isRevoked = (
  token: string,
  payload: { channel: string; iat: number },
  index: RevocationIndex = loadRevocations(),
): boolean => index.tokens.has(token.trim()) || index.ids.has(`${payload.channel}|${payload.iat}`);

/** Test/DI helper: forget the cached read so a rewritten file is picked up immediately. */
export const clearRevocationCache = (): void => {
  cache = null;
  located = null;
};
