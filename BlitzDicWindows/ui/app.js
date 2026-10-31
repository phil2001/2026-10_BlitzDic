import { Recorder } from '../src/recorder.js';
import { parseAppModes } from '../src/app-modes.js';
const $ = id => document.getElementById(id);
const api = window.blitz;
let settings, catalog, busy = false, lastOriginal = '';
let meetingBusy = false;
let dictationSourceEnded = false, meetingSourceEnded = false;
let speakerOptions = {enabled: false, speakerCount: -1};
let speakerModelsAvailable = false;
const status = text => { $('status').textContent = text; };
const attempt = fn => async () => { try { await fn(); } catch (error) { status(error.message); } };
const recorder = new Recorder({ onLevel: level => { $('level').value = level; }, onLimit: () => $('record').click(),
  onEnded: () => {dictationSourceEnded = true; $('record').click();} });
const meetingRecorder = new Recorder({onLevel: level => { $('meeting-level').value = level; }, onLimit: () => $('meeting-record').click(),
  onEnded: () => {meetingSourceEnded = true; $('meeting-record').click();}});
function meetingRecordingUI(active) {
  api['recording-state'](active).catch(error => status(error.message));
  $('meeting-record').textContent = active ? 'Aufnahme beenden und transkribieren' : 'Meeting aufnehmen';
  $('meeting-level').hidden = !active;
  $('meeting-cancel').hidden = !active && !meetingBusy;
  $('meeting-diarize').disabled = active || meetingBusy || !speakerModelsAvailable;
  $('meeting-speaker-count').disabled = active || meetingBusy || !speakerModelsAvailable;
}
$('meeting-record').onclick = attempt(async () => {
  if (busy || meetingBusy || recorder.state !== 'idle' || meetingRecorder.state === 'starting') return;
  if (['recording', 'limit'].includes(meetingRecorder.state)) {
    const wav = meetingRecorder.stop(); meetingBusy = true; meetingRecordingUI(false);
    try {
      const entry = await api['meeting-audio'](wav, speakerOptions);
      const existing = $('meeting-transcript').value.trim();
      const text = speakerOptions.enabled ? `Aufnahmeabschnitt (Sprecherkennungen gelten nur hier):\n${entry.original}` : entry.original;
      $('meeting-transcript').value = [existing, text].filter(Boolean).join('\n\n');
      status('Meeting lokal transkribiert. ' + (meetingSourceEnded ? 'Die Audioquelle wurde beendet; der vorhandene Abschnitt wurde verarbeitet.' : 'Die Zusammenfassung kann jetzt gestartet werden.'));
    } finally { meetingBusy = false; meetingRecordingUI(false); }
  } else {
    meetingSourceEnded = false;
    speakerOptions = {enabled: $('meeting-diarize').checked, speakerCount: Number($('meeting-speaker-count').value)};
    $('meeting-cancel').hidden = false; status('Mikrofon wird gestartet …');
    try { if (!await meetingRecorder.start($('microphone').value, {source: $('meeting-source').value})) return; }
    catch (error) { await api.cancel(); meetingRecordingUI(false); throw error; }
    meetingRecordingUI(true); status('Meeting-Aufnahme läuft …');
  }
});
function recordingUI(active) {
  api['recording-state'](active).catch(error => status(error.message));
  $('record').textContent = active ? 'Aufnahme beenden' : 'Aufnahme starten';
  $('recording-label').textContent = active ? 'Ich höre zu …' : 'Bereit für dein Diktat.';
  $('level').hidden = !active; $('cancel').hidden = !active && !busy;
}
async function save() { await api.settings(settings); }
async function result(entry) {
  if (!entry) return;
  lastOriginal = entry.original;
  $('result').value = entry.text; status(entry.warning || 'Transkription abgeschlossen.');
  await refreshHistory();
}
async function refreshHistory() {
  const data = await api.load(); $('history-list').replaceChildren();
  if (!data.history.length) $('history-list').textContent = 'Noch keine Einträge.';
  for (const item of data.history) {
    const article = document.createElement('article');
    const time = document.createElement('small'); time.textContent = new Date(item.createdAt).toLocaleString('de-DE');
    const text = document.createElement('p'); text.textContent = item.text;
    const copy = document.createElement('button'); copy.textContent = 'Kopieren'; copy.onclick = attempt(() => api.copy(item.text));
    article.append(time, text, copy); $('history-list').append(article);
  }
}
async function refreshMeetings() {
  const entries = await api.meetings(); $('meeting-list').replaceChildren();
  if (!entries.length) $('meeting-list').textContent = 'Noch keine Meetings.';
  for (const entry of entries) {
    const button = document.createElement('button');
    button.textContent = `${entry.title} · ${new Date(entry.createdAt).toLocaleString('de-DE')}`;
    button.onclick = () => { $('meeting-title').value = entry.title; $('meeting-transcript').value = entry.transcript; $('meeting-result').value = entry.summary; };
    $('meeting-list').append(button);
  }
}
$('meeting-from-dictation').onclick = () => { $('meeting-transcript').value = lastOriginal || $('result').value; };
$('meeting-save').onclick = attempt(async () => {
  if (meetingBusy || busy || meetingRecorder.state !== 'idle') return;
  meetingBusy = true; $('meeting-save').disabled = true;
  try {
    await api['meeting-save']($('meeting-transcript').value, $('meeting-title').value);
    $('meeting-result').value = '';
    await refreshMeetings(); status('Transkript lokal verschlüsselt gespeichert.');
  } finally {meetingBusy = false; $('meeting-save').disabled = false;}
});
$('meeting-summarize').onclick = attempt(async () => {
  if (meetingBusy || busy || recorder.state !== 'idle' || meetingRecorder.state !== 'idle') return;
  meetingBusy = true;
  $('meeting-summarize').disabled = true; $('meeting-cancel').hidden = false;
  $('meeting-result').value = '';
  status('Meeting wird zusammengefasst …');
  try {
    const entry = await api['meeting-summary']($('meeting-transcript').value, $('meeting-title').value);
    $('meeting-result').value = entry.summary; await refreshMeetings(); status('Meeting verschlüsselt gespeichert.');
  } finally { meetingBusy = false; $('meeting-summarize').disabled = false; $('meeting-cancel').hidden = true; }
});
$('meeting-cancel').onclick = attempt(async () => { meetingRecorder.cancel(); await api.cancel(); meetingRecordingUI(false); status('Abgebrochen.'); });
$('meeting-copy').onclick = attempt(async () => { await api.copy($('meeting-result').value); status('Zusammenfassung kopiert.'); });
$('meetings-clear').onclick = attempt(async () => {
  if (confirm('Alle gespeicherten Meetings leeren?')) { await api['meetings-clear'](); await refreshMeetings(); }
});
const providerConfig = () => Object.fromEntries(['provider', 'location', 'baseURL', 'model', 'apiKey'].map(id => [id, $(id).value]));
document.querySelectorAll('nav button').forEach(button => button.onclick = () => {
  document.querySelectorAll('main > section').forEach(section => { section.hidden = section.id !== button.dataset.page; });
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('selected', b === button));
});
$('record').onclick = attempt(async () => {
  if (busy || meetingBusy || meetingRecorder.state !== 'idle' || recorder.state === 'starting') return;
  if (['recording', 'limit'].includes(recorder.state)) {
    const wav = recorder.stop(); recordingUI(false);
    const entry = await api.audio(wav, $('mode').value);
    if (dictationSourceEnded) entry.warning = [entry.warning, 'Die Audioquelle wurde beendet; der vorhandene Abschnitt wurde verarbeitet.'].filter(Boolean).join('\n');
    await result(entry);
  } else {
    dictationSourceEnded = false;
    $('cancel').hidden = false; status('Mikrofon wird gestartet …');
    try {
      if (!await recorder.start($('microphone').value)) return;
    } catch (error) {
      await api.cancel(); recordingUI(false); throw error;
    }
    recordingUI(true); status('');
    const devices = await navigator.mediaDevices.enumerateDevices();
    const selected = $('microphone').value;
    $('microphone').replaceChildren(new Option('Standardmikrofon', ''));
    devices.filter(d => d.kind === 'audioinput').forEach(d => $('microphone').add(new Option(d.label || 'Mikrofon', d.deviceId)));
    $('microphone').value = selected;
  }
});
$('import').onclick = attempt(async () => { if (!busy && !meetingBusy && meetingRecorder.state === 'idle' && recorder.state === 'idle') await result(await api.import($('mode').value)); });
$('cancel').onclick = attempt(async () => { recorder.cancel(); meetingRecorder.cancel(); await api.cancel(); recordingUI(false); meetingRecordingUI(false); status('Abgebrochen.'); });
$('copy').onclick = attempt(async () => { await api.copy($('result').value); status('Text kopiert.'); });
$('mode').onchange = attempt(async () => { settings.mode = $('mode').value; await save(); });
$('speech-model').onchange = attempt(async () => { settings.speech.preset = $('speech-model').value; await save(); updateLocation(); });
function updateLocation() { $('processing-location').textContent = `Spracherkennung: ${{ whisper: 'Whisper', 'parakeet-ultra': 'Parakeet Ultra', custom: 'Eigenes Modell' }[settings.speech.preset]} · Lokal auf diesem Computer.`; }
$('download').onclick = attempt(async () => {
  $('download').disabled = true; status('Modell wird heruntergeladen …');
  try { await api.download($('speech-model').value); status('Modell ist bereit.'); } finally { $('download').disabled = false; }
});
$('provider').onchange = () => { const provider = catalog[$('provider').value]; $('baseURL').value = provider.baseURL; $('location').value = provider.local ? 'local' : 'api'; $('model').value = ''; $('apiKey').value = ''; };
$('save-provider').onclick = attempt(async () => { settings.provider = providerConfig(); await save(); status('Verbindung gespeichert.'); });
$('discover').onclick = attempt(async () => {
  const models = await api.models(providerConfig()); $('model-list').replaceChildren(...models.map(id => new Option(id, id))); status(`${models.length} Modelle gefunden. Modellname auswählen oder eingeben.`);
});
$('test').onclick = attempt(async () => { status('Verbindung wird geprüft …'); await api.connection(providerConfig()); status('Verbindung funktioniert.'); });
$('save-settings').onclick = attempt(async () => {
  settings.historyEnabled = $('history-enabled').checked;
  settings.modeSettings.customTerms = $('terms').value.split('\n').map(s => s.trim()).filter(Boolean);
  settings.modeSettings.systemPrompt = $('instruction').value; await save(); status('Einstellungen gespeichert.');
});
$('clear-history').onclick = attempt(async () => { if (confirm('Gesamten Verlauf leeren?')) { await api['history-clear'](); await refreshHistory(); } });
api.onState(state => {
  busy = state !== 'idle'; $('record').disabled = busy; $('import').disabled = busy;
  $('cancel').hidden = !busy && recorder.state === 'idle';
  if (busy) status({ transcribing: 'Sprache wird erkannt …', rewriting: 'Text wird überarbeitet …', saving: 'Verlauf wird gespeichert …' }[state]);
});
api.onShortcut(mode => {
  if (busy || meetingBusy || meetingRecorder.state !== 'idle' || !settings || recorder.state === 'starting') return;
  if (recorder.state === 'idle') $('mode').value = mode;
  $('record').click();
});
api.onShortcutError(text => status(`Tastenkürzel nicht verfügbar: ${text}`));
api.onCancelRecording(() => $('cancel').click());
try {
  const data = await api.load(); settings = data.settings; catalog = data.providers;
  speakerModelsAvailable = data.speakerModelsAvailable;
  $('meeting-speaker-count').replaceChildren(new Option('Automatisch (experimentell)', '-1'),
    ...Array.from({length: 20}, (_, index) => new Option(String(index + 1), String(index + 1))));
  $('meeting-diarize').disabled = !speakerModelsAvailable;
  $('meeting-speaker-count').disabled = !speakerModelsAvailable;
  $('meeting-speaker-availability').textContent = speakerModelsAvailable ? 'Lokale Sprecherzuordnungsmodelle sind vorhanden.' : 'Dieses Paket enthält noch keine Sprecherzuordnungsmodelle.';
  const originalButton = document.createElement('button'); originalButton.textContent = 'Wortgenaues Transkript';
  originalButton.onclick = () => { if (lastOriginal) { $('result').value = lastOriginal; status('Ursprüngliches Transkript wiederhergestellt.'); } };
  $('copy').before(originalButton);
  const replacementHeading = document.createElement('h3'); replacementHeading.textContent = 'Feste Ersetzungen';
  const replacementLabel = document.createElement('label'); replacementLabel.textContent = 'Eine Regel pro Zeile: gesprochen => geschrieben';
  const replacements = document.createElement('textarea');
  replacements.value = (settings.modeSettings.replacements || []).map(r => `${r.spoken} => ${r.written}`).join('\n');
  replacementLabel.append(replacements);
  const replacementSave = document.createElement('button'); replacementSave.textContent = 'Ersetzungen speichern';
  replacementSave.onclick = attempt(async () => {
    const rules = replacements.value.split('\n').filter(line => line.trim()).map(line => {
      const split = line.indexOf('=>');
      if (split < 1 || !line.slice(0, split).trim()) throw new Error('Jede Ersetzung braucht das Format: gesprochen => geschrieben');
      return { spoken: line.slice(0, split).trim(), written: line.slice(split + 2).trim() };
    });
    settings.modeSettings.replacements = rules; await save(); status('Ersetzungen gespeichert.');
  });
  $('settings').append(replacementHeading, replacementLabel, replacementSave);
  const appTitle = document.createElement('h3'); appTitle.textContent = 'Schreibmodus pro Programm';
  const appNote = document.createElement('p'); appNote.textContent = 'Gilt beim Start über das Wortgenau-Tastenkürzel (standardmäßig Strg+Umschalt+1). Die anderen Modus-Tastenkürzel behalten ihre feste Wahl. Eine Regel pro Zeile, zum Beispiel: winword.exe => clean. Modi: verbatim, clean, calm, emoji.';
  const appRules = document.createElement('textarea'); appRules.id = 'app-mode-rules';
  appRules.setAttribute('aria-label', 'Programmregeln für Schreibmodi');
  appRules.value = (settings.appModes || []).map(rule => `${rule.executable} => ${rule.mode}`).join('\n');
  const appSave = document.createElement('button'); appSave.id = 'save-app-modes'; appSave.textContent = 'Programmregeln speichern';
  appSave.onclick = attempt(async () => {
    const rules = parseAppModes(appRules.value); settings.appModes = rules;
    await save(); status('Programmregeln gespeichert.');
  });
  $('settings').append(appTitle, appNote, appRules, appSave);
  const shortcutsTitle = document.createElement('h3'); shortcutsTitle.textContent = 'Globale Tastenkürzel';
  const shortcutsNote = document.createElement('p'); shortcutsNote.textContent = 'Einmal drücken startet, erneut drücken beendet die Aufnahme. Beim Schließen bleibt BlitzDic im Infobereich aktiv.';
  $('settings').append(shortcutsTitle, shortcutsNote);
  for (const [mode, title] of Object.entries({verbatim:'Wortgenau',clean:'Überarbeiten',calm:'Ruhig formulieren',emoji:'Mit Emojis'})) {
    const label = document.createElement('label'); label.textContent = title;
    const input = document.createElement('input'); input.value = settings.shortcuts[mode];
    input.onchange = attempt(async () => { settings.shortcuts[mode] = input.value.trim(); await save(); status('Tastenkürzel gespeichert.'); });
    label.append(input); $('settings').append(label);
  }
  $('speech-model').add(new Option('Eigenes kompatibles Modell', 'custom'));
  const customBox = document.createElement('div');
  const engineLabel = document.createElement('label'); engineLabel.textContent = 'Modellformat';
  const engine = document.createElement('select');
  engine.add(new Option('Whisper / CTranslate2', 'whisper'));
  engine.add(new Option('Parakeet TDT / ONNX INT8', 'parakeet'));
  engine.value = settings.speech.engine || 'whisper'; engineLabel.append(engine);
  const directory = document.createElement('p'); directory.textContent = settings.speech.modelDirectory || 'Noch kein Modellordner gewählt.';
  const choose = document.createElement('button'); choose.textContent = 'Modellordner auswählen';
  choose.onclick = attempt(async () => {
    const path = await api['model-directory'](); if (!path) return;
    settings.speech.modelDirectory = path; settings.speech.engine = engine.value;
    await save(); directory.textContent = path; status('Eigenes Modell gespeichert.');
  });
  engine.onchange = attempt(async () => { settings.speech.engine = engine.value; await save(); });
  const note = document.createElement('p'); note.textContent = 'Weitere Modelle werden nicht vorbelegt. Verwende einen vollständigen lokalen Modellordner im gewählten Format. Andere Architekturen benötigen einen eigenen Adapter.';
  customBox.append(engineLabel, directory, choose, note); $('models').append(customBox);
  const customVisibility = () => { customBox.hidden = $('speech-model').value !== 'custom'; $('download').hidden = !customBox.hidden; };
  $('speech-model').addEventListener('change', customVisibility);
  if (data.modelsBundled) { $('download').textContent = 'Beide Modelle sind enthalten'; $('download').disabled = true; $('model-download-info').textContent = 'Whisper und Parakeet Ultra sind bereits enthalten. Die lokale Spracherkennung benötigt keine Internetverbindung und keine zusätzliche Installation.'; }
  for (const [id, provider] of Object.entries(catalog)) $('provider').add(new Option(provider.label, id));
  for (const id of ['provider', 'location', 'baseURL', 'model', 'apiKey']) $(id).value = settings.provider[id] || '';
  $('mode').value = settings.mode; $('speech-model').value = settings.speech.preset;
  customVisibility();
  $('history-enabled').checked = settings.historyEnabled;
  $('terms').value = settings.modeSettings.customTerms.join('\n'); $('instruction').value = settings.modeSettings.systemPrompt || '';
  updateLocation(); await refreshHistory(); await refreshMeetings();
} catch (error) { status(error.message); }
