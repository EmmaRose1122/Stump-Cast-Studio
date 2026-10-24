import fs from 'node:fs';
import path from 'node:path';

/** `StumpCast-Studio-Setup-1.0.9.exe` -> `1.0.9`. */
export const INSTALLER_NAME = /^StumpCast-Studio-Setup-(\d+\.\d+\.\d+)\.exe$/i;

export const installerVersion = (file: string): string | null =>
  INSTALLER_NAME.exec(path.basename(file))?.[1] ?? null;

/** Positive when `a` is newer than `b`, mirroring the app's own version comparison. */
export const compareVersions = (a: string, b: string): number => {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
};

export interface InstallerHit {
  file: string;
  version: string;
}

/**
 * Picks the newest setup executable across the folders the app looks in.
 *
 * This used to be a hard-coded list that started at `Setup-1.0.7.exe`, so an app already running
 * 1.0.9 downloaded and installed 1.0.7 when the operator pressed Update — a downgrade dressed as an
 * update. `minimumVersion` makes that impossible: an installer that is not strictly newer than the
 * running build is never offered, whatever happens to be sitting on disk.
 */
export const findNewestInstaller = (
  dirs: string[],
  minimumVersion?: string,
): InstallerHit | null => {
  let best: InstallerHit | null = null;
  for (const dir of dirs) {
    let names: string[];
    try {
      if (!fs.existsSync(dir)) continue;
      names = fs.readdirSync(dir);
    } catch {
      continue; // an unreadable folder is not an update
    }
    for (const name of names) {
      const version = installerVersion(name);
      if (!version) continue;
      if (minimumVersion && compareVersions(version, minimumVersion) <= 0) continue;
      if (!best || compareVersions(version, best.version) > 0) {
        best = { file: path.join(dir, name), version };
      }
    }
  }
  return best;
};

/** Every folder an installer may have been built into or downloaded to on this machine. */
export const installerDirs = (opts: {
  cwd?: string;
  moduleDir?: string;
  appData?: string;
  userProfile?: string;
} = {}): string[] => {
  const cwd = opts.cwd ?? process.cwd();
  const moduleDir = opts.moduleDir;
  const appData = opts.appData ?? process.env.APPDATA ?? '';
  const userProfile = opts.userProfile ?? process.env.USERPROFILE ?? '';
  const dirs = [path.resolve(cwd, 'release')];
  if (moduleDir) {
    dirs.push(path.resolve(moduleDir, '..', '..', '..', 'release'));
    dirs.push(path.resolve(moduleDir, '..', '..', 'release'));
  }
  if (userProfile) {
    dirs.push(path.join(userProfile, 'Downloads', 'StumpCast Studio', 'stumpcast', 'release'));
  }
  if (appData) dirs.push(path.join(appData, 'StumpCast Studio', 'updates'));
  return [...new Set(dirs)];
};
