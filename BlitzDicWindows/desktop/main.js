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
import { RecordingIndicator } from './recording-indicator.js';
import { HoldShortcuts } from '../src/hold-shortcuts.js';
import { EscapeControl } from '../src/escape-control.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let window, flow, store, tray, meetings, indicator, quitting = false;
let holdShortcuts;
let escapeControl;
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
  indicator = new RecordingIndicator(() => { if (!window.isDestroyed()) window.webContents.send('stop-recording'); });
  await indicator.setEnabled((await store.settings()).recordingIndicator !== false);
  let insertionTarget = null, recording = false, capturePending = false, captureEpoch = 0;
  let insertionRequested = false, insertionProblem = '';
  let shortcutBehavior = 'toggle';
  let recordingStarting = false, processingPending = false;
  const escapeJobs = new Set();
  const escapeError = error => { if (window && !window.isDestroyed()) window.webContents.send('shortcut-error', error.message); };
  const syncEscape = () => escapeControl.setActive(!!(recordingStarting || recording || processingPending || insertionRequested || capturePending || escapeJobs.size));
  const clearInsertion = () => { insertionTarget = null; insertionRequested = false; insertionProblem = ''; syncEscape().catch(escapeError); };
  const cancelWorkflow = () => {
    captureEpoch++; recordingStarting = false; processingPending = false;
    for (const controller of escapeJobs) controller.abort();
    holdShortcuts?.cancel(); flow.cancel(); meetings.cancel(); clearInsertion();
  };
  escapeControl = new EscapeControl({pythonPath,
    onEscape: () => {
      if (recording) {
        holdShortcuts.cancel(); window.webContents.send('stop-recording');
      } else {
        cancelWorkflow(); window.webContents.send('cancel-recording');
      }
    },
    onError: error => {
      cancelWorkflow();
      if (window && !window.isDestroyed()) window.webContents.send('cancel-recording');
      escapeError(error);
    },
  });
  escapeControl.start().catch(() => {});
  async function escapeJob(work) {
    const epoch = captureEpoch, controller = new AbortController(); escapeJobs.add(controller);
    try {
      await syncEscape();
      if (epoch !== captureEpoch) throw new Error('Abgebrochen.');
      const result = await work(controller.signal);
      controller.signal.throwIfAborted();
      return result;
    } finally {escapeJobs.delete(controller); processingPending = false; await syncEscape().catch(escapeError);}
  }
  holdShortcuts = new HoldShortcuts({
    wait: (shortcut, signal) => runSpeech({action: 'wait-shortcut-release', shortcut}, {pythonPath, signal, timeoutMs: 1805000}),
    start: (token, mode) => window.webContents.send('hold-start', {token, mode}),
    stop: token => window.webContents.send('hold-stop', token),
    tooShort: () => window.webContents.send('hold-too-short'),
    discard: clearInsertion,
    error: (token, cause) => {
      captureEpoch++; clearInsertion();
      if (!quitting) window.webContents.send('hold-failed', {token, message: cause.message});
    },
  });
  async function captureOriginalTarget(mode) {
      capturePending = true;
      insertionRequested = true; insertionProblem = '';
      const epoch = captureEpoch;
      try {
        await syncEscape();
        if (epoch !== captureEpoch) return null;
        const {target: captured, reason, executable} = await runSpeech({ action: 'capture-target' }, { pythonPath, timeoutMs: 5000 });
        if (epoch === captureEpoch) {
          insertionTarget = captured;
          mode = modeForApp(mode, executable, (await store.settings()).appModes);
          if (!captured) insertionProblem = `Kein unterstütztes Eingabefeld erkannt (${reason || 'unbekannter Feldtyp'}); Text bleibt in BlitzDic.`;
        }
      }
      catch (error) { insertionTarget = null; insertionProblem = `Eingabefeld konnte nicht erfasst werden: ${error.message}`; }
      finally { capturePending = false; syncEscape().catch(escapeError); }
      return epoch === captureEpoch ? mode : null;
  }
  async function triggerShortcut(mode, shortcut) {
    if (flow.active || meetings.active || capturePending || holdShortcuts.active) return;
    if (shortcutBehavior === 'hold') {
      if (!recording) await holdShortcuts.press(shortcut, () => captureOriginalTarget(mode));
      return;
    }
    if (!recording) mode = await captureOriginalTarget(mode);
    if (mode !== null) window.webContents.send('shortcut', mode);
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
    { label: 'Abbrechen', click: () => { cancelWorkflow(); window.webContents.send('cancel-recording'); } },
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
    shortcutBehavior = settings.shortcutBehavior === 'hold' ? 'hold' : 'toggle';
    globalShortcut.unregisterAll();
    const failed = [];
    for (const [mode, shortcut] of Object.entries(settings.shortcuts || {})) {
      if (/(?:^|\+)esc(?:ape)?$/i.test(shortcut)) {failed.push(shortcut); continue;}
      try {
        if (!globalShortcut.register(shortcut, () => triggerShortcut(mode, shortcut))) failed.push(shortcut);
      } catch { failed.push(shortcut); }
    }
    return failed;
  }
  let settingsQueue = Promise.resolve();
  handle('settings', settings => {
    // Include asynchronous key validation in ordering: a slower earlier save
    // must not overwrite a newer choice of hold/toggle behavior.
    const operation = settingsQueue.then(async () => {
      if (Object.values(settings.shortcuts ?? {}).some(value => /(?:^|\+)esc(?:ape)?$/i.test(value)))
        throw new Error('Escape ist zum Beenden einer Aufnahme und Abbrechen der Verarbeitung reserviert.');
      if (settings.shortcutBehavior !== undefined && !['hold', 'toggle'].includes(settings.shortcutBehavior))
        throw new Error('Unbekannte Kürzelbedienung.');
      if (settings.shortcutBehavior === 'hold') await runSpeech({action: 'validate-hold-shortcuts',
        shortcuts: Object.values(settings.shortcuts ?? {})}, {pythonPath, timeoutMs: 5000});
      await store.saveSettings(settings);
      await indicator.setEnabled(settings.recordingIndicator !== false);
      const failed = registerShortcuts(settings);
      if (failed.length) throw new Error(`Einstellungen gespeichert, aber Tastenkürzel nicht verfügbar: ${failed.join(', ')}`);
      return settings;
    });
    settingsQueue = operation.catch(() => {});
    return operation;
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
    return selected.canceled ? null : escapeJob(() => flow.process(selected.filePaths[0], mode));
  });
  handle('audio', async (bytes, mode) => {
    if (meetings.active) throw new Error('Bitte die Meeting-Zusammenfassung abwarten oder abbrechen.');
    if (!(bytes instanceof ArrayBuffer) || bytes.byteLength > 350 * 1024 * 1024) throw new Error('Ungültige Aufnahme.');
    return escapeJob(async signal => {
      processingPending = false;
      const target = insertionTarget; insertionTarget = null;
      const requested = insertionRequested, problem = insertionProblem;
      insertionRequested = false; insertionProblem = '';
      const entry = await flow.process(Buffer.from(bytes), mode);
      signal.throwIfAborted();
      if (requested && !target) entry.warning = [entry.warning, problem].filter(Boolean).join('\n');
      if (target && entry.text.trim()) {
        try {
          const text = fitInsertion(entry.text, target.before ?? null, target.after ?? null);
          const insertion = await runSpeech({ action: 'insert-text', target, text }, { pythonPath, signal, timeoutMs: 5000 });
          if (!insertion.inserted) entry.warning = [entry.warning, insertion.reason].filter(Boolean).join('\n');
        } catch (error) { entry.warning = [entry.warning, `Automatisches Einfügen fehlgeschlagen: ${error.message}`].filter(Boolean).join('\n'); }
      }
      return entry;
    });
  });
  handle('cancel', () => {
    cancelWorkflow();
  });
  handle('hold-rejected', token => {
    if (!holdShortcuts.active || holdShortcuts.active.token !== token) return;
    holdShortcuts.cancel(token); clearInsertion();
  });
  handle('meetings', () => store.meetings());
  handle('meeting-save', (transcript, title, names) => meetings.saveTranscript(transcript, title, names));
  handle('meeting-rename', (id, transcript, names) => meetings.renameSpeakers(id, transcript, names));
  handle('meeting-audio', async (bytes, options = {}) => {
    const epoch = captureEpoch;
    if (meetings.active) throw new Error('Eine Meeting-Zusammenfassung läuft bereits.');
    if (!(bytes instanceof ArrayBuffer) || bytes.byteLength > 350 * 1024 * 1024) throw new Error('Ungültige Aufnahme.');
    if (!options || typeof options !== 'object') throw new Error('Ungültige Sprecheroptionen.');
    const diarize = options.enabled === true, speakerCount = options.speakerCount ?? -1;
    if (!Number.isInteger(speakerCount) || (speakerCount !== -1 && (speakerCount < 1 || speakerCount > 20)))
      throw new Error('Sprecherzahl muss automatisch oder zwischen 1 und 20 sein.');
    if (diarize && !await speakerModelsAvailable()) throw new Error('Dieses Paket enthält keine lokalen Sprecherzuordnungsmodelle.');
    if (epoch !== captureEpoch) throw new Error('Abgebrochen.');
    insertionTarget = null; insertionRequested = false;
    return escapeJob(() => {
      processingPending = false;
      return flow.process(Buffer.from(bytes), 'verbatim', {saveHistory: false, diarize, speakerCount});
    });
  });
  handle('meeting-summary', (transcript, title, names) => {
    if (flow.active || recording || capturePending) throw new Error('Bitte das Diktat zuerst beenden.');
    return escapeJob(() => meetings.summarize(transcript, title, names));
  });
  handle('meetings-clear', () => store.clearMeetings());
  handle('recording-starting', async () => {
    const epoch = captureEpoch;
    recordingStarting = true;
    await syncEscape();
    if (epoch !== captureEpoch) throw new Error('Abgebrochen.');
  });
  handle('recording-state', async (active, processing = false) => {
    if (typeof active !== 'boolean' || typeof processing !== 'boolean') throw new Error('Ungültiger Aufnahmestatus.');
    recordingStarting = false; processingPending = !active && processing;
    recording = active; tray.setToolTip(active ? 'BlitzDic · Aufnahme läuft' : 'BlitzDic · Bereit');
    if (!active && holdShortcuts.active?.started) holdShortcuts.cancel();
    syncEscape().catch(escapeError);
    await indicator.setActive(active);
  });
  handle('recording-level', value => {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Ungültiger Aufnahmepegel.');
    indicator.level(value);
  });
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
app.on('before-quit', () => { quitting = true; escapeControl?.destroy(); holdShortcuts?.destroy(); flow?.cancel(); meetings?.cancel(); indicator?.destroy(); });
app.on('will-quit', () => { globalShortcut.unregisterAll(); tray?.destroy(); });
