/**
 * Auto-update (DK-4). The decision logic is kept apart from Electron so it can be unit tested:
 * `setupAutoUpdate` takes anything shaped like electron-updater's `autoUpdater`.
 */
export interface UpdaterLike {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  on(event: 'update-available', cb: (info: UpdateInfo) => void): unknown;
  on(event: 'update-downloaded', cb: (info: UpdateInfo) => void): unknown;
  on(event: 'error', cb: (error: Error) => void): unknown;
  checkForUpdates(): Promise<unknown>;
  quitAndInstall(): void;
}

export interface UpdateInfo {
  version: string;
  releaseNotes?: string | Array<{ note?: string | null }> | null;
}

export interface UpdateHooks {
  /** Ask the user; resolve true to restart now. */
  confirmInstall(version: string, notes: string): Promise<boolean>;
  log(message: string): void;
}

export interface UpdateProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';
  error?: string | null;
}

export const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export const isVersionNewer = (latest: string, current: string): boolean => {
  const cleanLat = latest.replace(/^v/, '').split('.').map(Number);
  const cleanCur = current.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(cleanLat.length, cleanCur.length); i++) {
    const lat = cleanLat[i] ?? 0;
    const cur = cleanCur[i] ?? 0;
    if (lat > cur) return true;
    if (lat < cur) return false;
  }
  return false;
};

export const releaseNotesText = (notes: UpdateInfo['releaseNotes']): string => {
  if (!notes) return '';
  if (typeof notes === 'string') return notes.replace(/<[^>]*>/g, '').trim();
  return notes
    .map((n) => n.note ?? '')
    .join('\n')
    .replace(/<[^>]*>/g, '')
    .trim();
};

export function setupAutoUpdate(
  updater: UpdaterLike,
  hooks: UpdateHooks,
  timers: { setInterval: (fn: () => void, ms: number) => unknown } = { setInterval },
): { check: () => Promise<void> } {
  // Download quietly; never restart the app mid-broadcast without the operator agreeing.
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;

  updater.on('update-available', (info) => hooks.log(`Update ${info.version} available, downloading`));
  updater.on('error', (error) => hooks.log(`Update check failed: ${error.message}`));
  updater.on('update-downloaded', (info) => {
    void hooks
      .confirmInstall(info.version, releaseNotesText(info.releaseNotes))
      .then((restart) => {
        if (restart) updater.quitAndInstall();
        else hooks.log(`Update ${info.version} will install when the app quits`);
      });
  });

  const check = async (): Promise<void> => {
    try {
      await updater.checkForUpdates();
    } catch (error) {
      hooks.log(`Update check failed: ${String(error)}`);
    }
  };
  void check();
  timers.setInterval(() => void check(), CHECK_INTERVAL_MS);
  return { check };
}

export interface DirectDownloadOptions {
  downloadUrl: string;
  destFilePath: string;
  onProgress?: (progress: UpdateProgress) => void;
  signal?: AbortSignal;
}

export const launchInstallerAndExit = (
  installerPath: string,
  spawnFn: (command: string, args: string[], options: unknown) => { unref: () => void },
  exitFn: () => void = () => process.exit(0),
): boolean => {
  try {
    const child = spawnFn(installerPath, [], { detached: true, stdio: 'ignore' });
    child.unref();
    exitFn();
    return true;
  } catch {
    return false;
  }
};

