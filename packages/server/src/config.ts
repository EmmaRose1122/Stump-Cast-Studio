import path from 'node:path';

export interface ServerConfig {
  host: string;
  port: number;
  /** How many consecutive ports to try if the preferred one is busy. */
  portAttempts: number;
  dataDir: string;
  /** Built overlay/admin bundles; static routes are skipped if a folder is missing. */
  overlayDir: string;
  adminDir: string;
  /** Placeholder until the licence client (B12) exists: treat the app as licensed (Pro looks). */
  licensed: boolean;
}

const pkgRoot = path.resolve(import.meta.dirname, '..', '..');

export const loadConfig = (
  env: NodeJS.ProcessEnv = process.env,
  overrides: Partial<ServerConfig> = {},
): ServerConfig => ({
  host: env.STUMPCAST_HOST ?? '127.0.0.1',
  port: Number(env.STUMPCAST_PORT ?? 4000),
  portAttempts: 11,
  dataDir: path.resolve(env.STUMPCAST_DATA ?? './data'),
  overlayDir: path.join(pkgRoot, 'overlay', 'dist'),
  adminDir: path.join(pkgRoot, 'admin', 'dist'),
  licensed: env.STUMPCAST_LICENSED !== '0',
  ...overrides,
});
