const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lockSleepDesktop', {
  onCommand(callback) {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, action) => callback(action);
    ipcRenderer.on('locksleep:command', listener);
    return () => ipcRenderer.removeListener('locksleep:command', listener);
  }
});
