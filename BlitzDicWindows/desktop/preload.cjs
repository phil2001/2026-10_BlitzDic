const { contextBridge, ipcRenderer } = require('electron');
const methods = ['load', 'settings', 'models', 'connection', 'download', 'import', 'audio', 'cancel', 'copy', 'history-clear'];
const api = Object.fromEntries(methods.map(name => [name, (...args) => ipcRenderer.invoke(name, ...args)]));
api.onState = callback => { const listener = (_event, state) => callback(state); ipcRenderer.on('state', listener); return () => ipcRenderer.removeListener('state', listener); };
contextBridge.exposeInMainWorld('blitz', api);
