import { app, BrowserWindow, ipcMain, dialog, clipboard, session, globalShortcut, Tray, Menu, nativeImage, desktopCapturer, shell } from 'electron';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { access } from 'node:fs/promises';
import { PrivateStore } from '../src/store.js';
import { windowsCrypto } from '../src/windows-storage.js';
import { Dictation } from '../src/dictation.js';
import { runSpeech, speechPresets } from '../src/speech.js';
import { providers, listModels, testConnection } from '../src/providers.js';
import { modeForApp } from '../src/app-modes.js';
import { Meetings } from '../src/meetings.js';
import { fitInsertion } from '../src/insertion-fit.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let window, flow, store, tray, meetings, quitting = false;
const uiURL = pathToFileURL(join(root, 'ui/index.html')).href;
app.setName('BlitzDic');
if (!app.requestSingleInstanceLock()) app.quit();
else app.whenReady().then(async () => {
  store = new PrivateStore(join(app.getPath('userData'), 'private'), await windowsCrypto());
  const pythonPath = app.isPackaged ? join(process.resourcesPath, 'speech-runtime/blitzdic-speech.exe') : join(root, '.runtime/venv/Scripts/python.exe');
  const modelRoot = app.isPackaged ? join(process.resourcesPath, 'models') : join(root, 'models');
  const speakerModelsAvailable = () => Promise.all(['model.int8.onnx', 'nemo_en_titanet_small.onnx']
    .map(file => access(join(modelRoot, 'diarization', file)))).then(() => true, () => false);
  flow = new Dictation({ store, modelRoot, pythonPath });
  meetings = new Meetings({store});
  let insertionTarget = null, recording = false, capturePending = false, captureEpoch = 0;
  let insertionRequested = false, insertionProblem = '';
  async function triggerShortcut(mode) {
    if (flow.active || meetings.active || capturePending) return;
    if (!recording) {
      capturePending = true;
      insertionRequested = true; insertionProblem = '';
      const epoch = captureEpoch;
      try {
        const {target: captured, reason, executable} = await runSpeech({ action: 'capture-target' }, { pythonPath, timeoutMs: 5000 });
        if (epoch !== captureEpoch) return;
        insertionTarget = captured;
        mode = modeForApp(mode, executable, (await store.settings()).appModes);
        if (!captured) insertionProblem = `Kein unterstütztes Eingabefeld erkannt (${reason || 'unbekannter Feldtyp'}); Text bleibt in BlitzDic.`;
      }
      catch (error) { insertionTarget = null; insertionProblem = `Eingabefeld konnte nicht erfasst werden: ${error.message}`; }
      finally { capturePending = false; }
      if (epoch !== captureEpoch) return;
    }
    window.webContents.send('shortcut', mode);
  }
  window = new BrowserWindow({ width: 1200, height: 820, minWidth: 760, minHeight: 620, title: 'BlitzDic',
    webPreferences: { preload: join(root, 'desktop/preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  window.setMenuBarVisibility(false);
  // A simple original waveform mark, BGRA bitmap, independent of upstream branding.
  const pixels = Buffer.alloc(32 * 32 * 4);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const i = (y * 32 + x) * 4;
    const bar = ((x >= 6 && x <= 9 && y >= 11 && y <= 21) || (x >= 14 && x <= 17 && y >= 5 && y <= 27) || (x >= 22 && x <= 25 && y >= 9 && y <= 23));
    pixels[i] = bar ? 255 : 230; pixels[i + 1] = bar ? 255 : 65; pixels[i + 2] = bar ? 255 : 55; pixels[i + 3] = 255;
  }
  const trayIcon = nativeImage.createFromBitmap(pixels, { width: 32, height: 32 });
  window.setIcon(trayIcon); tray = new Tray(trayIcon); tray.setToolTip('BlitzDic · Bereit');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'BlitzDic öffnen', click: () => { window.show(); window.focus(); } },
    { label: 'Wortgenau diktieren / beenden', click: () => window.webContents.send('shortcut', 'verbatim') },
    { label: 'Abbrechen', click: () => { flow.cancel(); window.webContents.send('cancel-recording'); } },
    { type: 'separator' }, { label: 'Beenden', click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on('double-click', () => { window.show(); window.focus(); });
  window.on('close', event => { if (!quitting) { event.preventDefault(); window.hide(); } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) =>
    callback(contents === window.webContents &&
      ((permission === 'media' && details.mediaTypes?.every(t => t === 'audio')) || permission === 'display-capture')));
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    if (request.frame !== window.webContents.mainFrame || request.frame?.url !== uiURL || !request.userGesture || !request.audioRequested)
      return callback({});
    try {
      const sources = await desktopCapturer.getSources({types: ['screen'], thumbnailSize: {width: 0, height: 0}});
      if (!sources.length || request.frame !== window.webContents.mainFrame) return callback({});
      callback({video: sources[0], audio: 'loopback'});
    } catch { callback({}); }
  });
  const handle = (name, fn) => ipcMain.handle(name, async (event, ...args) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== uiURL) throw new Error('Unzulässiger Aufruf.');
    return fn(...args);
  });
  handle('load', async () => ({ version: app.getVersion(), settings: await store.settings(), history: await store.history(), providers, speechPresets, modelsBundled: app.isPackaged,
    speakerModelsAvailable: await speakerModelsAvailable() }));
  function registerShortcuts(settings) {
    globalShortcut.unregisterAll();
    const failed = [];
    for (const [mode, shortcut] of Object.entries(settings.shortcuts || {})) {
      try {
        if (!globalShortcut.register(shortcut, () => triggerShortcut(mode))) failed.push(shortcut);
      } catch { failed.push(shortcut); }
    }
    return failed;
  }
  handle('settings', async settings => {
    await store.saveSettings(settings);
    const failed = registerShortcuts(settings);
    if (failed.length) throw new Error(`Einstellungen gespeichert, aber Tastenkürzel nicht verfügbar: ${failed.join(', ')}`);
    return settings;
  });
  handle('models', config => listModels(config));
  handle('model-directory', async () => {
    const choice = await dialog.showOpenDialog(window, { properties: ['openDirectory'], title: 'Lokalen Sprachmodell-Ordner auswählen' });
    return choice.canceled ? null : choice.filePaths[0];
  });
  handle('connection', config => testConnection(config));
  handle('download', async preset => {
    if (!speechPresets.some(p => p.id === preset)) throw new Error('Unbekanntes Modell.');
    if (app.isPackaged) return { installed: true, bundled: true };
    return runSpeech({ action: 'download', preset, modelDirectory: join(modelRoot, preset) }, { pythonPath, timeoutMs: 3600000 });
  });
  handle('import', async mode => {
    if (meetings.active) throw new Error('Bitte die Meeting-Zusammenfassung abwarten oder abbrechen.');
    const selected = await dialog.showOpenDialog(window, { properties: ['openFile'], filters: [{ name: 'Audio', extensions: ['wav', 'mp3', 'm4a', 'ogg', 'flac', 'webm'] }] });
    return selected.canceled ? null : flow.process(selected.filePaths[0], mode);
  });
  handle('audio', async (bytes, mode) => {
    if (meetings.active) throw new Error('Bitte die Meeting-Zusammenfassung abwarten oder abbrechen.');
    if (!(bytes instanceof ArrayBuffer) || bytes.byteLength > 350 * 1024 * 1024) throw new Error('Ungültige Aufnahme.');
    const target = insertionTarget; insertionTarget = null;
    const requested = insertionRequested, problem = insertionProblem;
    insertionRequested = false; insertionProblem = '';
    const entry = await flow.process(Buffer.from(bytes), mode);
    if (requested && !target) entry.warning = [entry.warning, problem].filter(Boolean).join('\n');
    if (target && entry.text.trim()) {
      try {
        const text = fitInsertion(entry.text, target.before ?? null, target.after ?? null);
        const insertion = await runSpeech({ action: 'insert-text', target, text }, { pythonPath, timeoutMs: 5000 });
        if (!insertion.inserted) entry.warning = [entry.warning, insertion.reason].filter(Boolean).join('\n');
      } catch (error) { entry.warning = [entry.warning, `Automatisches Einfügen fehlgeschlagen: ${error.message}`].filter(Boolean).join('\n'); }
    }
    return entry;
  });
  handle('cancel', () => { captureEpoch++; insertionTarget = null; insertionRequested = false; insertionProblem = ''; flow.cancel(); meetings.cancel(); });
  handle('meetings', () => store.meetings());
  handle('meeting-save', (transcript, title) => meetings.saveTranscript(transcript, title));
  handle('meeting-audio', async (bytes, options = {}) => {
    if (meetings.active) throw new Error('Eine Meeting-Zusammenfassung läuft bereits.');
    if (!(bytes instanceof ArrayBuffer) || bytes.byteLength > 350 * 1024 * 1024) throw new Error('Ungültige Aufnahme.');
    if (!options || typeof options !== 'object') throw new Error('Ungültige Sprecheroptionen.');
    const diarize = options.enabled === true, speakerCount = options.speakerCount ?? -1;
    if (!Number.isInteger(speakerCount) || (speakerCount !== -1 && (speakerCount < 1 || speakerCount > 20)))
      throw new Error('Sprecherzahl muss automatisch oder zwischen 1 und 20 sein.');
    if (diarize && !await speakerModelsAvailable()) throw new Error('Dieses Paket enthält keine lokalen Sprecherzuordnungsmodelle.');
    insertionTarget = null; insertionRequested = false;
    return flow.process(Buffer.from(bytes), 'verbatim', {saveHistory: false, diarize, speakerCount});
  });
  handle('meeting-summary', (transcript, title) => {
    if (flow.active || recording || capturePending) throw new Error('Bitte das Diktat zuerst beenden.');
    return meetings.summarize(transcript, title);
  });
  handle('meetings-clear', () => store.clearMeetings());
  handle('recording-state', active => { recording = !!active; tray.setToolTip(active ? 'BlitzDic · Aufnahme läuft' : 'BlitzDic · Bereit'); });
  handle('copy', text => { if (typeof text !== 'string') throw new Error('Ungültiger Text.'); clipboard.writeText(text); });
  handle('history-clear', () => store.clearHistory());
  handle('licenses-open', async () => {
    const directory = app.isPackaged ? join(process.resourcesPath, 'licenses') : join(root, 'licenses');
    await access(directory);
    if (await shell.openPath(directory)) throw new Error('Der Lizenzordner konnte nicht geöffnet werden.');
    return true;
  });
  flow.on('state', state => { if (!window.isDestroyed()) window.webContents.send('state', state); });
  await window.loadURL(uiURL);
  const failed = registerShortcuts(await store.settings());
  if (failed.length) window.webContents.send('shortcut-error', failed.join(', '));
}).catch(error => { dialog.showErrorBox('BlitzDic konnte nicht starten', error.message); app.quit(); });
app.on('second-instance', () => { window?.show(); window?.focus(); });
app.on('window-all-closed', () => { flow?.cancel(); app.quit(); });
app.on('before-quit', () => { quitting = true; flow?.cancel(); meetings?.cancel(); });
app.on('will-quit', () => { globalShortcut.unregisterAll(); tray?.destroy(); });
