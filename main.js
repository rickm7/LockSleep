const { app, BrowserWindow, systemPreferences } = require('electron');
const path = require('path');

app.setName('LockSleep 2');
const dataRoot = process.env.PORTABLE_EXECUTABLE_DIR || app.getPath('appData');
app.setPath('userData', path.join(dataRoot, 'LockSleep 2'));

let mainWindow;
const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    const action = commandLine.includes('--autostop') ? 'quick_stop'
      : commandLine.includes('--autostart') ? 'quick_start' : null;
    if (action && mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      mainWindow.webContents.send('locksleep:command', action);
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 900,
    minHeight: 650,
    title: 'LockSleep 2 - Monitoraggio Sonno',
    backgroundColor: '#07090e',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false
    }
  });

  // This app runs from a local file and needs no network access. Grant only the
  // media permissions used by camera/microphone capture; deny unrelated access.
  const appSession = mainWindow.webContents.session;
  const mediaPermissions = new Set(['media', 'camera', 'microphone']);
  appSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) =>
    mediaPermissions.has(permission) && typeof requestingOrigin === 'string' && requestingOrigin.startsWith('file:'));
  appSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(mediaPermissions.has(permission) && webContents.getURL().startsWith('file:'));
  });

  const quickAction = process.argv.includes('--autostart') ? 'autostart'
    : process.argv.includes('--autostop') ? 'autostop' : null;
  const launchOptions = quickAction ? { query: { [quickAction]: '1' } } : {};
  mainWindow.loadFile(path.join(__dirname, 'index.html'), launchOptions);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

if (hasSingleInstanceLock) app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
