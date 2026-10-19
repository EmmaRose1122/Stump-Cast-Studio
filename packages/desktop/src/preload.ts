import { contextBridge, ipcRenderer } from 'electron';

const api = {
  getVersion: (): Promise<string> => ipcRenderer.invoke('stumpcast:get-version'),
  openExternal: (url: string): Promise<boolean> =>
    ipcRenderer.invoke('stumpcast:open-external', url),
  selectFile: (filters?: Electron.FileFilter[]): Promise<string | undefined> =>
    ipcRenderer.invoke('stumpcast:select-file', filters),
  getSecret: (key: 'apiKey' | 'licenceToken'): Promise<string | undefined> =>
    ipcRenderer.invoke('stumpcast:get-secret', key),
  setSecret: (key: 'apiKey' | 'licenceToken', value?: string): Promise<boolean> =>
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
};

contextBridge.exposeInMainWorld('stumpcast', api);

export type StumpCastDesktopApi = typeof api;