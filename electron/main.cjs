// SchoolEx Electron main process (CommonJS: Electron entry point).
// Starts the local Express+SQLite server in-process on 127.0.0.1 with an
// auto-chosen port, waits for /api/health, then opens the app window.
// Fully offline: the window only ever talks to the local server.
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow = null;
let serverHandle = null;

function waitForHealth(port, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) return resolve();
        retry();
      }).on('error', retry);
    };
    const retry = () => {
      if (Date.now() - start > timeoutMs) return reject(new Error('Server did not become healthy in time'));
      setTimeout(tick, 250);
    };
    tick();
  });
}

async function startServer() {
  // DB lives in the per-user app data folder, NOT the install folder.
  const userData = app.getPath('userData');
  process.env.SCHOOLEX_DB = path.join(userData, 'schoolex.db');
  // server/ is shipped inside the app (see electron-builder files config).
  const { pathToFileURL } = require('url');
  const serverModule = await import(pathToFileURL(path.join(__dirname, '..', 'server', 'index.js')).href);
  serverHandle = await serverModule.startServer({
    port: 0, // auto free port
    dbPath: process.env.SCHOOLEX_DB,
    distDir: path.join(__dirname, '..', 'dist'),
  });
  return serverHandle.port;
}

async function createWindow() {
  const port = await startServer();
  await waitForHealth(port);
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1024, minHeight: 700,
    title: 'SchoolEx',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  // External links (if any) open in the system browser, never in-app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http') && !url.startsWith(`http://127.0.0.1:${port}`)) {
      shell.openExternal(url); return { action: 'deny' };
    }
    return { action: 'allow' };
  });
  await mainWindow.loadURL(`http://127.0.0.1:${port}/`);
  mainWindow.on('closed', () => { mainWindow = null; });
}

// Single-instance lock: a second launch just focuses the existing window.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
  });
  app.whenReady().then(createWindow).catch((e) => { console.error(e); app.quit(); });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', async () => {
    if (serverHandle) { try { await serverHandle.close(); } catch {} serverHandle = null; }
  });
}
