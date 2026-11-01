const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('indicator', {
  stop: () => ipcRenderer.send('indicator-stop'),
  hide: () => ipcRenderer.send('indicator-hide'),
  onActive: callback => ipcRenderer.on('indicator-active', (_event, startedAt) => callback(startedAt)),
  onLevel: callback => ipcRenderer.on('indicator-level', (_event, level) => callback(level)),
});
