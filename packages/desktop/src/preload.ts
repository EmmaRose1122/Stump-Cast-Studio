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
  checkUpdate: (): Promise<{ updateAvailable: boolean; version?: string; error?: string }> =>
    ipcRenderer.invoke('stumpcast:check-update'),
  installUpdate: (): Promise<boolean> =>
    ipcRenderer.invoke('stumpcast:install-update'),
};

contextBridge.exposeInMainWorld('stumpcast', api);

export type StumpCastDesktopApi = typeof api;