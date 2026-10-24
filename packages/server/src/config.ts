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
  /** Dev-only override that forces the paid tier; a real install is decided by its licence row. */
  licensed: boolean;
}

const pkgRoot = path.resolve(import.meta.dirname, '..', '..');

export const loadConfig = (
  env: NodeJS.ProcessEnv = process.env,
  overrides: Partial<ServerConfig> = {},
): ServerConfig => {
  return {
    host: env.STUMPCAST_HOST ?? '127.0.0.1',
    port: Number(env.STUMPCAST_PORT ?? 4000),
    portAttempts: 11,
    dataDir: path.resolve(env.STUMPCAST_DATA ?? './data'),
    overlayDir: path.join(pkgRoot, 'overlay', 'dist'),
    adminDir: path.join(pkgRoot, 'admin', 'dist'),
    // Opt-in, not opt-out: the old `!== '0'` meant every build was paid unless someone remembered
    // to say otherwise, so the free tier never actually existed outside a packaged installer.
    licensed: env.STUMPCAST_LICENSED === 'true',
    ...overrides,
  };
};
