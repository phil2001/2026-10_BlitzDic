import { app, BrowserWindow, ipcMain, dialog, clipboard, session, globalShortcut, Tray, Menu, nativeImage, desktopCapturer, shell } from 'electron';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { access } from 'node:fs/promises';
import { PrivateStore } from '../src/store.js';
import { windowsCrypto } from '../src/windows-storage.js';
import { Dictation } from '../src/dictation.js';
import { runSpeech, speechPresets, speechModel, WarmSpeech } from '../src/speech.js';
import { providers, listModels, testConnection, validateConfig } from '../src/providers.js';
import { modeForContext, normalizeWebsiteModes } from '../src/website-modes.js';
import { Meetings } from '../src/meetings.js';
import { fitInsertion } from '../src/insertion-fit.js';
import { RecordingIndicator } from './recording-indicator.js';
import { HoldShortcuts } from '../src/hold-shortcuts.js';
import { ShortcutKeys } from '../src/shortcut-keys.js';
import { planShortcuts } from '../src/shortcuts.js';
import { EscapeControl } from '../src/escape-control.js';
import { OutputMute } from '../src/output-mute.js';
import { LiveNotes } from '../src/live-notes.js';
import { checkRelease, releasesURL, supportInfo } from '../src/releases.js';
import { autostartArgument, loginItemDeactivated, syncLoginItem } from '../src/login-item.js';
import { TargetService } from '../src/target-service.js';
import { release as windowsRelease } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let window, flow, store, tray, meetings, indicator, quitting = false;
let holdShortcuts;
let shortcutKeys;
let escapeControl;
let outputMute;
let liveNotes;
let speechWorkers;
let targets;
const uiURL = pathToFileURL(join(root, 'ui/index.html')).href;
// Started by Windows at login: stay in the tray; tray, shortcuts and model are ready.
const startHidden = process.argv.includes(autostartArgument);
const autostart = wanted => syncLoginItem(app, wanted !== false, { path: process.execPath });
app.setName('BlitzDic');
if (!app.requestSingleInstanceLock()) app.quit();
else app.whenReady().then(async () => {
  store = new PrivateStore(join(app.getPath('userData'), 'private'), await windowsCrypto());
  // Only the installed app registers itself; a development Electron would not start BlitzDic.
  if (app.isPackaged) { try { autostart((await store.settings()).startWithWindows); } catch {} }
  const pythonPath = app.isPackaged ? join(process.resourcesPath, 'speech-runtime/blitzdic-speech.exe') : join(root, '.runtime/venv/Scripts/python.exe');
  const modelRoot = app.isPackaged ? join(process.resourcesPath, 'models') : join(root, 'models');
  const speakerModelsAvailable = () => Promise.all(['model.int8.onnx', 'nemo_en_titanet_small.onnx']
    .map(file => access(join(modelRoot, 'diarization', file)))).then(() => true, () => false);
  // Transcriptions use a worker that has already loaded the selected model.
  speechWorkers = new WarmSpeech({ pythonPath });
  const transcribe = (request, options) => speechWorkers.run(request, options);
  const prepareSpeech = () => store.settings()
    .then(settings => { speechWorkers.prepare(speechModel(settings.speech, modelRoot)); }, () => {});
  // Field capture before a recording and insertion after it, without a process start.
  targets = new TargetService({ pythonPath });
  // Windows spell checker as a guard for the term correction (only asked when a correction is proposed).
  const misspelled = async (words, language) =>
    (await targets.request({ action: 'spell-check', words, language }, { timeoutMs: 5000 })).misspelled;
  flow = new Dictation({ store, modelRoot, pythonPath, transcribe, misspelled });
  meetings = new Meetings({store});
  liveNotes = new LiveNotes({modelRoot,pythonPath,recognize:transcribe,misspelled});
  indicator = new RecordingIndicator(() => { if (!window.isDestroyed()) window.webContents.send('stop-recording'); });
  await indicator.setEnabled((await store.settings()).recordingIndicator !== false);
  let insertionTarget = null, recording = false, capturePending = false, captureEpoch = 0;
  let insertionRequested = false, insertionProblem = '';
  let shortcutBehavior = 'toggle';
  let recordingStarting = false, processingPending = false;
  const escapeJobs = new Set();
  const escapeError = error => { if (window && !window.isDestroyed()) window.webContents.send('shortcut-error', error.message); };
  let muteEnabled = (await store.settings()).muteOutputWhileRecording === true;
  let recordingKind = null, recordingStateEpoch = 0, mutePreparing = false;
  outputMute = new OutputMute({pythonPath, onError: escapeError});
  const syncOutputMute = async () => {
    try {await outputMute.setActive(muteEnabled && (recording || mutePreparing) && recordingKind === 'dictation'); return null;}
    catch (error) {escapeError(error); return error.message;}
  };
  const syncEscape = () => escapeControl.setActive(!!(recordingStarting || recording || processingPending || insertionRequested || capturePending || escapeJobs.size));
  const clearInsertion = () => { insertionTarget = null; insertionRequested = false; insertionProblem = ''; syncEscape().catch(escapeError); };
  const cancelWorkflow = () => {
    liveNotes.cancel();
    recordingKind = null; mutePreparing = false; recordingStateEpoch++; syncOutputMute();
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
        const settings = await store.settings();
        const website = mode === 'verbatim' && settings.websiteModes?.length > 0;
        const {target: captured, reason, executable, websiteHost: host} = await targets.request({ action: 'capture-target', website }, { timeoutMs: 5000 });
        if (epoch === captureEpoch) {
          insertionTarget = captured;
          let canRewrite = false;
          try {validateConfig(settings.provider); canRewrite = true;} catch {}
          mode = modeForContext(mode, {executable, host}, settings, value => value === 'verbatim' || canRewrite);
          if (!captured) insertionProblem = `Kein unterstütztes Eingabefeld erkannt (${reason || 'unbekannter Feldtyp'}); Text bleibt in BlitzDic.`;
        }
      }
      catch (error) { insertionTarget = null; insertionProblem = `Eingabefeld konnte nicht erfasst werden: ${error.message}`; }
      finally { capturePending = false; syncEscape().catch(escapeError); }
      return epoch === captureEpoch ? mode : null;
  }
  // gesture.choice is the last key of a sequence such as Alt+Space+1, possibly pressed while
  // the target field is still being captured; it overrides the mode of the dictation it starts.
  async function triggerShortcut(mode, shortcut, gesture = {}) {
    if (flow.active || meetings.active || capturePending || holdShortcuts.active) return;
    if (shortcutBehavior === 'hold') {
      if (!recording) await holdShortcuts.press(shortcut, async () => {
        const resolved = await captureOriginalTarget(mode);
        gesture.started = resolved !== null;
        return resolved === null ? null : gesture.choice ?? resolved;
      });
      return;
    }
    if (recording) gesture.stopped = true;
    else mode = await captureOriginalTarget(mode);
    if (mode === null) return;
    gesture.started = !gesture.stopped;
    window.webContents.send('shortcut', gesture.started ? gesture.choice ?? mode : mode);
  }
  function chooseShortcutMode(mode, gesture) {
    if (gesture.stopped) return; // The first part ended a dictation; the digit has nothing to change.
    gesture.choice = mode;
    if (gesture.started) window.webContents.send('shortcut-mode', mode);
  }
  shortcutKeys = new ShortcutKeys({
    register: (key, callback) => globalShortcut.register(key, callback),
    unregister: key => globalShortcut.unregister(key),
    press: (mode, key, gesture) => { triggerShortcut(mode, key, gesture).catch(escapeError); },
    choose: chooseShortcutMode,
    captured: key => { if (window && !window.isDestroyed()) window.webContents.send('shortcut-captured', key); },
  });
  window = new BrowserWindow({ width: 1200, height: 820, minWidth: 760, minHeight: 620, title: 'BlitzDic', show: !startHidden,
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
  const restoreOutput = () => {liveNotes.cancel();recordingKind = null; mutePreparing = false; syncOutputMute();};
  window.webContents.on('render-process-gone', () => { restoreOutput(); shortcutKeys.capture(false); });
  window.webContents.on('did-start-navigation', details => {
    if (details.isMainFrame && !details.isInPlace) { restoreOutput(); shortcutKeys.capture(false); }
  });
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
  handle('load', async () => {
    let autostartDeactivated = false;
    try { autostartDeactivated = app.isPackaged && loginItemDeactivated(app, process.execPath); } catch {}
    return { version: app.getVersion(), settings: await store.settings(), history: await store.history(), providers, speechPresets, modelsBundled: app.isPackaged,
      speakerModelsAvailable: await speakerModelsAvailable(), autostart: { available: app.isPackaged, deactivated: autostartDeactivated } };
  });
  function registerShortcuts(settings) {
    shortcutBehavior = settings.shortcutBehavior === 'hold' ? 'hold' : 'toggle';
    return shortcutKeys.apply(settings.shortcuts || {});
  }
  let settingsQueue = Promise.resolve();
  handle('settings', settings => {
    // Include asynchronous key validation in ordering: a slower earlier save
    // must not overwrite a newer choice of hold/toggle behavior.
    const operation = settingsQueue.then(async () => {
      settings = {...settings, websiteModes: normalizeWebsiteModes(settings.websiteModes)};
      if (settings.muteOutputWhileRecording !== undefined && typeof settings.muteOutputWhileRecording !== 'boolean')
        throw new Error('Ungültige Stummschaltungseinstellung.');
      if (Object.values(settings.shortcuts ?? {}).some(value => /(?:^|\+)esc(?:ape)?$/i.test(value)))
        throw new Error('Escape ist zum Beenden einer Aufnahme und Abbrechen der Verarbeitung reserviert.');
      if (settings.shortcutBehavior !== undefined && !['hold', 'toggle'].includes(settings.shortcutBehavior))
        throw new Error('Unbekannte Kürzelbedienung.');
      if (settings.startWithWindows !== undefined && typeof settings.startWithWindows !== 'boolean')
        throw new Error('Ungültige Autostart-Einstellung.');
      if (settings.termCorrection !== undefined && typeof settings.termCorrection !== 'boolean')
        throw new Error('Ungültige Einstellung zur Fachbegriff-Korrektur.');
      const autostartBefore = (await store.settings()).startWithWindows !== false;
      // Holding is watched on the shortcut itself, or on the first part of a key sequence.
      const {direct, sequences} = planShortcuts(settings.shortcuts);
      const heldKeys = [...new Set([...direct.keys(), ...sequences.keys()])];
      if (settings.shortcutBehavior === 'hold' && heldKeys.length) await runSpeech({action: 'validate-hold-shortcuts',
        shortcuts: heldKeys}, {pythonPath, timeoutMs: 5000});
      await store.saveSettings(settings);
      prepareSpeech();
      let autostartWarning = null;
      // Only a changed choice touches the Run key, and may re-enable a Task Manager deactivation.
      if (app.isPackaged && (settings.startWithWindows !== false) !== autostartBefore) {
        try { syncLoginItem(app, settings.startWithWindows !== false, { path: process.execPath, explicit: true }); }
        catch { autostartWarning = 'der Windows-Autostart konnte nicht geändert werden.'; }
      }
      muteEnabled = settings.muteOutputWhileRecording === true;
      const muteWarning = await syncOutputMute();
      await indicator.setEnabled(settings.recordingIndicator !== false);
      const failed = registerShortcuts(settings);
      if (failed.length) throw new Error(`Einstellungen gespeichert, aber Tastenkürzel nicht verfügbar: ${failed.join(', ')}`);
      if (muteWarning) throw new Error(`Einstellungen gespeichert, aber ${muteWarning}`);
      if (autostartWarning) throw new Error(`Einstellungen gespeichert, aber ${autostartWarning}`);
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
          const insertion = await targets.request({ action: 'insert-text', target, text }, { signal, timeoutMs: 5000 });
          if (!insertion.inserted) entry.warning = [entry.warning, insertion.reason].filter(Boolean).join('\n');
        } catch (error) { entry.warning = [entry.warning, `Automatisches Einfügen fehlgeschlagen: ${error.message}`].filter(Boolean).join('\n'); }
      }
      return entry;
    });
  });
  handle('cancel', () => {
    cancelWorkflow();
  });
  // A settings field records the next pressed keys; our own shortcuts are routed to it meanwhile.
  handle('shortcut-capture', active => shortcutKeys.capture(active === true));
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
    const diarize = options.enabled === true, speakerCount = options.speakerCount ?? -1, echoFilter = options.echoFilter === true;
    if (!Number.isInteger(speakerCount) || (speakerCount !== -1 && (speakerCount < 1 || speakerCount > 20)))
      throw new Error('Sprecherzahl muss automatisch oder zwischen 1 und 20 sein.');
    if (diarize && !await speakerModelsAvailable()) throw new Error('Dieses Paket enthält keine lokalen Sprecherzuordnungsmodelle.');
    if (epoch !== captureEpoch) throw new Error('Abgebrochen.');
    insertionTarget = null; insertionRequested = false;
    if (liveNotes.session && (liveNotes.session.job || !liveNotes.session.stopped)) await liveNotes.stop(liveNotes.session.id);
    if (epoch !== captureEpoch) throw new Error('Abgebrochen.');
    return escapeJob(() => {
      processingPending = false;
      return flow.process(Buffer.from(bytes), 'verbatim', {saveHistory: false, diarize, speakerCount, echoFilter});
    });
  });
  handle('meeting-summary', (transcript, title, names) => {
    if (flow.active || recording || capturePending) throw new Error('Bitte das Diktat zuerst beenden.');
    return escapeJob(() => meetings.summarize(transcript, title, names));
  });
  handle('meetings-clear', () => store.clearMeetings());
  handle('meeting-live-start', async (echoFilter = false) => {
    const epoch=captureEpoch;
    const settings=await store.settings();
    if(liveNotes.session?.stopped&&liveNotes.session.job)await liveNotes.session.job;
    if(epoch!==captureEpoch||recordingKind!=='meeting'||(!recording&&!recordingStarting))throw new Error('Keine laufende Meeting-Aufnahme.');
    return liveNotes.start(settings,{echoFilter});
  });
  handle('meeting-live-update', (id,bytes,options) => {
    if(!recording||recordingKind!=='meeting')throw new Error('Keine laufende Meeting-Aufnahme.');
    return liveNotes.update(id,bytes,options);
  });
  handle('meeting-live-catchup', id => liveNotes.catchUp(id));
  handle('meeting-live-stop', id => liveNotes.stop(id));
  handle('recording-starting', async (kind = 'dictation') => {
    if (!['dictation', 'meeting'].includes(kind)) throw new Error('Ungültiger Aufnahmetyp.');
    const epoch = captureEpoch;
    recordingStarting = true; recordingKind = kind; mutePreparing = false;
    prepareSpeech(); // After an idle timeout the model loads while the user speaks.
    await syncEscape();
    if (epoch !== captureEpoch) throw new Error('Abgebrochen.');
  });
  handle('prepare-output', async () => {
    if (!recordingStarting || recording || recordingKind !== 'dictation') throw new Error('Abgebrochen.');
    const epoch = captureEpoch;
    mutePreparing = true;
    const warning = await syncOutputMute();
    if (epoch !== captureEpoch || !recordingStarting || recordingKind !== 'dictation') throw new Error('Abgebrochen.');
    return {warning};
  });
  handle('recording-state', async (active, processing = false, kind = 'dictation') => {
    if (typeof active !== 'boolean' || typeof processing !== 'boolean' || !['dictation', 'meeting'].includes(kind)) throw new Error('Ungültiger Aufnahmestatus.');
    const epoch = ++recordingStateEpoch;
    recordingStarting = false; processingPending = !active && processing;
    recording = active; tray.setToolTip(active ? 'BlitzDic · Aufnahme läuft' : 'BlitzDic · Bereit');
    recordingKind = active ? kind : null; mutePreparing = false;
    if (!active && holdShortcuts.active?.started) holdShortcuts.cancel();
    syncEscape().catch(escapeError);
    const warning = await syncOutputMute();
    if (epoch === recordingStateEpoch) await indicator.setActive(active);
    return {warning};
  });
  handle('recording-level', value => {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Ungültiger Aufnahmepegel.');
    indicator.level(value);
  });
  handle('copy', text => { if (typeof text !== 'string') throw new Error('Ungültiger Text.'); clipboard.writeText(text); });
  handle('history-clear', () => store.clearHistory());
  let releaseCheck;
  handle('release-check', () => {
    if (!releaseCheck) releaseCheck = checkRelease(app.getVersion()).finally(() => {releaseCheck = null;});
    return releaseCheck;
  });
  handle('releases-open', () => shell.openExternal(releasesURL));
  handle('support-info', () => supportInfo({version: app.getVersion(), platform: process.platform,
    arch: process.arch, release: windowsRelease()}));
  handle('licenses-open', async () => {
    const directory = app.isPackaged ? join(process.resourcesPath, 'licenses') : join(root, 'licenses');
    await access(directory);
    if (await shell.openPath(directory)) throw new Error('Der Lizenzordner konnte nicht geöffnet werden.');
    return true;
  });
  flow.on('state', state => { if (!window.isDestroyed()) window.webContents.send('state', state); });
  await window.loadURL(uiURL);
  prepareSpeech();
  targets.start();
  const failed = registerShortcuts(await store.settings());
  if (failed.length) window.webContents.send('shortcut-error', failed.join(', '));
}).catch(error => { dialog.showErrorBox('BlitzDic konnte nicht starten', error.message); app.quit(); });
app.on('second-instance', (_event, argv) => {
  if (argv.includes(autostartArgument)) return; // A login start must not pop up a running app.
  window?.show(); window?.focus();
});
app.on('window-all-closed', () => { flow?.cancel(); app.quit(); });
app.on('before-quit', () => { quitting = true; speechWorkers?.destroy(); targets?.destroy(); liveNotes?.cancel();outputMute?.destroy(); escapeControl?.destroy(); holdShortcuts?.destroy(); flow?.cancel(); meetings?.cancel(); indicator?.destroy(); });
app.on('will-quit', () => { globalShortcut.unregisterAll(); tray?.destroy(); });
