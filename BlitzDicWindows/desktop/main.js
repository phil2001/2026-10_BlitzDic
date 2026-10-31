import { app, BrowserWindow, ipcMain, dialog, clipboard, session } from 'electron';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PrivateStore } from '../src/store.js';
import { windowsCrypto } from '../src/windows-storage.js';
import { Dictation } from '../src/dictation.js';
import { runSpeech, speechPresets } from '../src/speech.js';
import { providers, listModels, testConnection } from '../src/providers.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let window, flow, store;
const uiURL = pathToFileURL(join(root, 'ui/index.html')).href;
app.setName('BlitzDic');
if (!app.requestSingleInstanceLock()) app.quit();
else app.whenReady().then(async () => {
  store = new PrivateStore(join(app.getPath('userData'), 'private'), await windowsCrypto());
  const pythonPath = join(root, '.runtime/venv/Scripts/python.exe');
  const modelRoot = join(root, 'models');
  flow = new Dictation({ store, modelRoot, pythonPath });
  window = new BrowserWindow({ width: 1200, height: 820, minWidth: 760, minHeight: 620, title: 'BlitzDic',
    webPreferences: { preload: join(root, 'desktop/preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  window.setMenuBarVisibility(false);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) =>
    callback(contents === window.webContents && permission === 'media' && details.mediaTypes?.every(t => t === 'audio')));
  const handle = (name, fn) => ipcMain.handle(name, async (event, ...args) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== uiURL) throw new Error('Unzulässiger Aufruf.');
    return fn(...args);
  });
  handle('load', async () => ({ settings: await store.settings(), history: await store.history(), providers, speechPresets }));
  handle('settings', settings => store.saveSettings(settings));
  handle('models', config => listModels(config));
  handle('connection', config => testConnection(config));
  handle('download', async preset => {
    if (!speechPresets.some(p => p.id === preset)) throw new Error('Unbekanntes Modell.');
    return runSpeech({ action: 'download', preset, modelDirectory: join(modelRoot, preset) }, { pythonPath, timeoutMs: 3600000 });
  });
  handle('import', async mode => {
    const selected = await dialog.showOpenDialog(window, { properties: ['openFile'], filters: [{ name: 'Audio', extensions: ['wav', 'mp3', 'm4a', 'ogg', 'flac', 'webm'] }] });
    return selected.canceled ? null : flow.process(selected.filePaths[0], mode);
  });
  handle('audio', async (bytes, mode) => {
    if (!(bytes instanceof ArrayBuffer) || bytes.byteLength > 350 * 1024 * 1024) throw new Error('Ungültige Aufnahme.');
    const directory = join(app.getPath('userData'), 'recordings'); await mkdir(directory, { recursive: true });
    const path = join(directory, `${randomUUID()}.wav`); await writeFile(path, Buffer.from(bytes));
    return flow.process(path, mode);
  });
  handle('cancel', () => flow.cancel());
  handle('copy', text => { if (typeof text !== 'string') throw new Error('Ungültiger Text.'); clipboard.writeText(text); });
  handle('history-clear', () => store.clearHistory());
  flow.on('state', state => { if (!window.isDestroyed()) window.webContents.send('state', state); });
  await window.loadURL(uiURL);
}).catch(error => { dialog.showErrorBox('BlitzDic konnte nicht starten', error.message); app.quit(); });
app.on('second-instance', () => { window?.show(); window?.focus(); });
app.on('window-all-closed', () => { flow?.cancel(); app.quit(); });
