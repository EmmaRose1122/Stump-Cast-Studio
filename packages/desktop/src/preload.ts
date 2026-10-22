import { contextBridge, ipcRenderer } from 'electron';

const api = {
  getVersion: (): Promise<string> => ipcRenderer.invoke('stumpcast:get-version'),
  openExternal: (url: string): Promise<boolean> =>
    ipcRenderer.invoke('stumpcast:open-external', url),
  selectFile: (filters?: Electron.FileFilter[]): Promise<string | undefined> =>
    ipcRenderer.invoke('stumpcast:select-file', filters),
  getSecret: (key: 'apiKey' | 'licenceToken' | 'geminiKey' | string): Promise<string | undefined> =>
    ipcRenderer.invoke('stumpcast:get-secret', key),
  setSecret: (key: 'apiKey' | 'licenceToken' | 'geminiKey' | string, value?: string): Promise<boolean> =>
    ipcRenderer.invoke('stumpcast:set-secret', key, value),
  checkUpdate: (
    customUrl?: string,
  ): Promise<{
    updateAvailable: boolean;
    version?: string;
    currentVersion?: string;
    latestVersion?: string;
    releaseNotes?: string;
    downloadUrl?: string;
    error?: string;
  }> => ipcRenderer.invoke('stumpcast:check-update', customUrl),
  downloadUpdate: (
    downloadUrl?: string,
  ): Promise<{ success: boolean; filePath?: string; error?: string }> =>
    ipcRenderer.invoke('stumpcast:download-update', downloadUrl),
  installUpdate: (): Promise<boolean> =>
    ipcRenderer.invoke('stumpcast:install-update'),
  onUpdateProgress: (
    callback: (progress: {
      percent: number;
      transferred: number;
      total: number;
      bytesPerSecond: number;
      status: string;
      error?: string | null;
    }) => void,
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      progress: {
        percent: number;
        transferred: number;
        total: number;
        bytesPerSecond: number;
        status: string;
        error?: string | null;
      },
    ) => callback(progress);
    ipcRenderer.on('stumpcast:update-progress', handler);
    return () => {
      ipcRenderer.removeListener('stumpcast:update-progress', handler);
    };
  },
  // Splash-only pushes from the main process: the running version, boot status,
  // and the newer build the updater found. Kept as plain channels so the splash
  // never has to guess (or ship a literal) for what version it is displaying.
  onSplashVersion: (
    callback: (payload: { version?: string; source?: string }) => void,
  ): (() => void) => onChannel('splash:version', callback),
  onSplashStatus: (
    callback: (payload: { percent?: number; message?: string }) => void,
  ): (() => void) => onChannel('splash:status', callback),
  onSplashUpdate: (
    callback: (payload: { version?: string; state?: string }) => void,
  ): (() => void) => onChannel('splash:update-available', callback),
};

function onChannel<T>(channel: string, callback: (payload: T) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, payload: T) => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

contextBridge.exposeInMainWorld('stumpcast', api);

export type StumpCastDesktopApi = typeof api;