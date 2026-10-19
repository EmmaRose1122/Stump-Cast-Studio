import { BrowserWindow, app } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 900,
    minWidth: 600,
    minHeight: 700,
    title: 'StumpCast Studio - License Key Generator',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    backgroundColor: '#f1f5f9',
  });

  win.setMenuBarVisibility(false);

  if (isDev) {
    void win.loadURL('http://127.0.0.1:5177/');
  } else {
    const distPath = path.join(__dirname, '..', 'dist');
    void win.loadFile(path.join(distPath, 'index.html'));
  }
};

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.setAsDefaultProtocolClient('stumpcast-license');
