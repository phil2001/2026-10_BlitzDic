const { contextBridge, ipcRenderer } = require('electron');
const methods = ['load', 'settings', 'models', 'model-directory', 'connection', 'download', 'import', 'audio', 'cancel', 'copy', 'history-clear', 'recording-state', 'meetings', 'meeting-summary', 'meeting-audio', 'meetings-clear'];
const api = Object.fromEntries(methods.map(name => [name, (...args) => ipcRenderer.invoke(name, ...args)]));
api.onState = callback => { const listener = (_event, state) => callback(state); ipcRenderer.on('state', listener); return () => ipcRenderer.removeListener('state', listener); };
api.onShortcut = callback => { const listener = (_event, mode) => callback(mode); ipcRenderer.on('shortcut', listener); return () => ipcRenderer.removeListener('shortcut', listener); };
api.onShortcutError = callback => { const listener = (_event, text) => callback(text); ipcRenderer.on('shortcut-error', listener); return () => ipcRenderer.removeListener('shortcut-error', listener); };
api.onCancelRecording = callback => { ipcRenderer.on('cancel-recording', () => callback()); };
contextBridge.exposeInMainWorld('blitz', api);
