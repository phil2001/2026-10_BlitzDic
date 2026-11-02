import { Recorder } from '../src/recorder.js';
import { parseAppModes } from '../src/app-modes.js';
import { parseWebsiteModes } from '../src/website-modes.js';
import { meetingSpeakers, namedMeetingTranscript, normalizeSpeakerNames, speakerSectionHeading } from '../src/meeting-speakers.js';
const $ = id => document.getElementById(id);
const api = window.blitz;
let settings, catalog, busy = false, lastOriginal = '';
let meetingBusy = false;
let dictationSourceEnded = false, meetingSourceEnded = false;
let speakerOptions = {enabled: false, speakerCount: -1};
let speakerModelsAvailable = false;
let heldGesture = null;
let dictationStartup = null, meetingStartup = null;
const cancelStartup = () => {
  if (dictationStartup) dictationStartup.cancelled = true;
  if (meetingStartup) meetingStartup.cancelled = true;
  dictationStartup = null; meetingStartup = null;
};
const status = text => { $('status').textContent = text; };
const attempt = fn => async () => {
  try { await fn(); }
  catch (error) {
    const message = error.message.replace(/^Error invoking remote method '[^']+': (?:Error|AbortError): /, '');
    status(error.name === 'AbortError' || /\bAbortError:/.test(error.message) || message === 'Spracherkennung abgebrochen.' ? 'Abgebrochen.' : message);
  }
};
let speakerDraft = {source: '', names: [], rendered: ''};
let loadedMeetingId = null;
const summaryWarning = document.createElement('p'); summaryWarning.id = 'meeting-summary-warning'; summaryWarning.hidden = true;
summaryWarning.textContent = 'Diese Zusammenfassung verwendet frühere Sprechernamen. Sie bleibt erhalten; bitte bei Bedarf neu zusammenfassen.';
$('meeting-result').parentElement.before(summaryWarning);
$('meeting-result').setAttribute('aria-describedby', 'meeting-summary-warning');
const speakerEditor = document.createElement('div'); speakerEditor.id = 'meeting-speaker-editor'; speakerEditor.hidden = true;
const speakerTitle = document.createElement('h3'); speakerTitle.textContent = 'Sprechernamen';
const speakerNote = document.createElement('p');
speakerNote.textContent = 'Namen manuell zuordnen. Gleiche IDs in verschiedenen Aufnahmeabschnitten sind unabhängig. Leeres Feld stellt die Sprecher-ID wieder her. Manuelle Transkriptänderungen übernehmen den sichtbaren Text und setzen die Zuordnungen zurück.';
const speakerFields = document.createElement('div'); speakerFields.id = 'meeting-speaker-fields';
const speakerApply = document.createElement('button'); speakerApply.id = 'meeting-speaker-apply'; speakerApply.textContent = 'Namen übernehmen';
speakerEditor.append(speakerTitle, speakerNote, speakerFields, speakerApply);
$('meeting-transcript').parentElement.after(speakerEditor);
function speakerControls() {
  const slots = meetingSpeakers(speakerDraft.source); speakerFields.replaceChildren(); speakerEditor.hidden = !slots.length;
  const groups = new Map();
  for (const {section, speaker} of slots) {
    if (!groups.has(section)) {
      const group = document.createElement('fieldset'), legend = document.createElement('legend');
      group.disabled = meetingBusy;
      legend.textContent = section ? `Aufnahmeabschnitt ${section}` : 'Transkript'; group.append(legend);
      groups.set(section, group); speakerFields.append(group);
    }
    const label = document.createElement('label'); label.textContent = `Sprecher ${speaker}`;
    const input = document.createElement('input'); input.maxLength = 80; input.placeholder = 'Name (optional)';
    input.dataset.section = section; input.dataset.speaker = speaker;
    input.value = speakerDraft.names.find(item => item.section === section && item.speaker === speaker)?.name ?? '';
    label.append(input); groups.get(section).append(label);
  }
}
function setMeetingDraft(source, names = [], savedId = null) {
  const normalized = normalizeSpeakerNames(source, names), rendered = namedMeetingTranscript(source, normalized);
  speakerDraft = {source, names: normalized, rendered}; loadedMeetingId = savedId;
  speakerApply.textContent = savedId ? 'Namen übernehmen und speichern' : 'Namen übernehmen';
  $('meeting-transcript').value = rendered; speakerControls();
}
function setMeetingSummary(entry) {
  $('meeting-result').value = entry.summary ?? ''; summaryWarning.hidden = entry.summaryStale !== true;
}
function currentMeetingDraft() {
  if ($('meeting-transcript').value !== speakerDraft.rendered) setMeetingDraft($('meeting-transcript').value);
  return speakerDraft;
}
function meetingEditingUI(locked) {
  $('meeting-transcript').readOnly = locked; $('meeting-title').disabled = locked;
  speakerApply.disabled = locked;
  speakerFields.querySelectorAll('fieldset').forEach(group => {group.disabled = locked;});
}
$('meeting-transcript').addEventListener('change', attempt(async () => {
  currentMeetingDraft(); setMeetingSummary({});
}));
speakerApply.onclick = attempt(async () => {
  if (meetingBusy) return;
  const draft = currentMeetingDraft();
  const names = [...speakerFields.querySelectorAll('input')].filter(input => input.value.trim()).map(input => ({
    section: Number(input.dataset.section), speaker: Number(input.dataset.speaker), name: input.value,
  }));
  if (loadedMeetingId) {
    meetingBusy = true; meetingEditingUI(true);
    try {
      const entry = await api['meeting-rename'](loadedMeetingId, draft.source, names);
      setMeetingDraft(entry.transcript, entry.speakerNames ?? [], entry.id); setMeetingSummary(entry);
      await refreshMeetings(); status('Sprechernamen im gespeicherten Meeting aktualisiert.');
    } finally {meetingBusy = false; meetingEditingUI(false);}
  } else {
    setMeetingDraft(draft.source, names); setMeetingSummary({});
    status('Sprechernamen übernommen. Zum Speichern „Transkript lokal speichern“ oder „Zusammenfassen und speichern“ wählen.');
  }
});
let lastLevelSent = 0;
function level(value) {
  const now = performance.now();
  if (now - lastLevelSent < 80) return;
  lastLevelSent = now;
  api['recording-level'](value).catch(() => {});
}
const recorder = new Recorder({ onLevel: value => { $('level').value = value; level(value); }, onLimit: () => $('record').click(),
  onEnded: () => {dictationSourceEnded = true; $('record').click();} });
const meetingRecorder = new Recorder({onLevel: value => { $('meeting-level').value = value; level(value); }, onLimit: () => $('meeting-record').click(),
  onEnded: () => {meetingSourceEnded = true; $('meeting-record').click();}});
function meetingRecordingUI(active, processing = false) {
  meetingEditingUI(meetingBusy);
  api['recording-state'](active, processing).catch(error => status(error.message));
  $('meeting-record').textContent = active ? 'Aufnahme beenden und transkribieren' : 'Meeting aufnehmen';
  $('meeting-level').hidden = !active;
  $('meeting-cancel').hidden = !active && !meetingBusy;
  $('meeting-diarize').disabled = active || meetingBusy || !speakerModelsAvailable;
  $('meeting-speaker-count').disabled = active || meetingBusy || !speakerModelsAvailable;
}
$('meeting-record').onclick = attempt(async () => {
  if (busy || meetingBusy || dictationStartup || meetingStartup || recorder.state !== 'idle' || meetingRecorder.state === 'starting') return;
  if (['recording', 'limit'].includes(meetingRecorder.state)) {
    const wav = meetingRecorder.stop(); meetingBusy = true; meetingRecordingUI(false, true);
    try {
      const entry = await api['meeting-audio'](wav, speakerOptions);
      const draft = currentMeetingDraft();
      // Every recording starts a section, including recordings without diarization.
      // An old section's alias must never spill into later unlabelled audio.
      const text = `${speakerSectionHeading}\n${entry.original}`;
      const combined = [draft.source, text].filter(value => value.trim()).join('\n\n');
      const display = [draft.rendered, text].filter(value => value.trim()).join('\n\n');
      if (combined.length > 500000 || display.length > 500000) {
        // Keep every recognized word available even when the save limit is exceeded.
        $('meeting-transcript').value = display;
        speakerEditor.hidden = true; setMeetingSummary({});
        status('Transkript vollständig vorhanden, aber über 500.000 Zeichen. Vor weiterem Aufnehmen oder Speichern kürzen oder aufteilen.');
        return;
      }
      setMeetingDraft(combined, draft.names);
      setMeetingSummary({});
      status('Meeting lokal transkribiert. ' + (meetingSourceEnded ? 'Die Audioquelle wurde beendet; der vorhandene Abschnitt wurde verarbeitet.' : 'Die Zusammenfassung kann jetzt gestartet werden.'));
    } finally { meetingBusy = false; meetingRecordingUI(false); }
  } else {
    if ($('meeting-transcript').value.length > 500000) throw new Error('Transkript vor weiterem Aufnehmen auf höchstens 500.000 Zeichen kürzen oder aufteilen.');
    meetingSourceEnded = false;
    speakerOptions = {enabled: $('meeting-diarize').checked, speakerCount: Number($('meeting-speaker-count').value)};
    $('meeting-cancel').hidden = false; status('Mikrofon wird gestartet …');
    const startup = {cancelled: false}; meetingStartup = startup;
    try {
      await api['recording-starting']();
      if (startup.cancelled) return;
      if (!await meetingRecorder.start($('microphone').value, {source: $('meeting-source').value})) return;
    }
    catch (error) {
      if (startup.cancelled) return;
      await api.cancel(); meetingRecordingUI(false); throw error;
    }
    finally {if (meetingStartup === startup) meetingStartup = null;}
    meetingRecordingUI(true); status('Meeting-Aufnahme läuft …');
  }
});
function recordingUI(active, processing = false) {
  api['recording-state'](active, processing).catch(error => status(error.message));
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
    button.onclick = attempt(async () => {
      if (meetingBusy || meetingRecorder.state !== 'idle') return;
      setMeetingDraft(entry.transcript, entry.speakerNames ?? [], entry.id);
      $('meeting-title').value = entry.title; setMeetingSummary(entry);
    });
    $('meeting-list').append(button);
  }
}
$('meeting-from-dictation').onclick = attempt(async () => {
  if (meetingBusy || meetingRecorder.state !== 'idle') return;
  setMeetingDraft(lastOriginal || $('result').value); setMeetingSummary({});
});
$('meeting-save').onclick = attempt(async () => {
  if (meetingBusy || busy || meetingRecorder.state !== 'idle') return;
  const draft = currentMeetingDraft();
  meetingBusy = true; $('meeting-save').disabled = true;
  meetingEditingUI(true);
  try {
    const entry = await api['meeting-save'](draft.source, $('meeting-title').value, draft.names);
    setMeetingDraft(entry.transcript, entry.speakerNames ?? [], entry.id); setMeetingSummary(entry);
    await refreshMeetings(); status('Transkript lokal verschlüsselt gespeichert.');
  } finally {meetingBusy = false; $('meeting-save').disabled = false; meetingEditingUI(false);}
});
$('meeting-summarize').onclick = attempt(async () => {
  if (meetingBusy || busy || recorder.state !== 'idle' || meetingRecorder.state !== 'idle') return;
  const draft = currentMeetingDraft();
  meetingBusy = true;
  $('meeting-summarize').disabled = true; $('meeting-cancel').hidden = false;
  setMeetingSummary({});
  status('Meeting wird zusammengefasst …');
  meetingEditingUI(true);
  try {
    const entry = await api['meeting-summary'](draft.source, $('meeting-title').value, draft.names);
    setMeetingDraft(entry.transcript, entry.speakerNames ?? [], entry.id); setMeetingSummary(entry);
    await refreshMeetings(); status('Meeting verschlüsselt gespeichert.');
  } finally { meetingBusy = false; $('meeting-summarize').disabled = false; $('meeting-cancel').hidden = true; meetingEditingUI(false); }
});
$('meeting-cancel').onclick = attempt(async () => { cancelStartup(); meetingRecorder.cancel(); await api.cancel(); meetingRecordingUI(false); status('Abgebrochen.'); });
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
  if (busy || meetingBusy || dictationStartup || meetingStartup || meetingRecorder.state !== 'idle' || recorder.state === 'starting') return;
  if (['recording', 'limit'].includes(recorder.state)) {
    heldGesture = null;
    const wav = recorder.stop(); recordingUI(false, true);
    const entry = await api.audio(wav, $('mode').value);
    if (dictationSourceEnded) entry.warning = [entry.warning, 'Die Audioquelle wurde beendet; der vorhandene Abschnitt wurde verarbeitet.'].filter(Boolean).join('\n');
    await result(entry);
  } else {
    dictationSourceEnded = false;
    $('cancel').hidden = false; status('Mikrofon wird gestartet …');
    const startingGesture = heldGesture;
    const startup = {cancelled: false}; dictationStartup = startup;
    try {
      await api['recording-starting']();
      if (startup.cancelled) return;
      if (!await recorder.start($('microphone').value)) return;
    } catch (error) {
      if (startup.cancelled) return;
      if (heldGesture === startingGesture) heldGesture = null;
      await api.cancel(); recordingUI(false); throw error;
    }
    finally {if (dictationStartup === startup) dictationStartup = null;}
    recordingUI(true); status('');
    const devices = await navigator.mediaDevices.enumerateDevices();
    const selected = $('microphone').value;
    $('microphone').replaceChildren(new Option('Standardmikrofon', ''));
    devices.filter(d => d.kind === 'audioinput').forEach(d => $('microphone').add(new Option(d.label || 'Mikrofon', d.deviceId)));
    $('microphone').value = selected;
  }
});
$('import').onclick = attempt(async () => { if (!busy && !meetingBusy && meetingRecorder.state === 'idle' && recorder.state === 'idle') await result(await api.import($('mode').value)); });
$('cancel').onclick = attempt(async () => { cancelStartup(); heldGesture = null; recorder.cancel(); meetingRecorder.cancel(); await api.cancel(); recordingUI(false); meetingRecordingUI(false); status('Abgebrochen.'); });
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
  settings.recordingIndicator = $('recording-indicator-enabled').checked;
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
  if (busy || meetingBusy || dictationStartup || meetingStartup || meetingRecorder.state !== 'idle' || !settings || recorder.state === 'starting') return;
  if (recorder.state === 'idle') $('mode').value = mode;
  $('record').click();
});
api.onShortcutError(text => status(`Tastenkürzel nicht verfügbar: ${text}`));
api.onCancelRecording(() => $('cancel').click());
const shortHold = () => status('Kürzel vor Aufnahmebereitschaft losgelassen. Zum Diktieren länger halten.');
api.onHoldTooShort(shortHold);
api.onHoldStart(({token, mode}) => {
  if (busy || meetingBusy || dictationStartup || meetingStartup || !settings || recorder.state !== 'idle' || meetingRecorder.state !== 'idle') {
    api['hold-rejected'](token).catch(() => {}); return;
  }
  heldGesture = token; $('mode').value = mode; $('record').click();
});
api.onHoldStop(token => {
  if (heldGesture !== token) return;
  heldGesture = null;
  if (dictationStartup || recorder.state === 'starting') {
    cancelStartup();
    recorder.cancel(); api.cancel().catch(() => {}); recordingUI(false); shortHold();
  } else if (['recording', 'limit'].includes(recorder.state)) $('record').click();
});
api.onHoldFailed(({token, message}) => {
  if (heldGesture === token) {cancelStartup(); heldGesture = null; recorder.cancel(); recordingUI(false);}
  else if (heldGesture !== null || recorder.state !== 'idle') return;
  status(`Haltemodus nicht verfügbar: ${message}`);
});
api.onStopRecording(() => {
  if (['recording', 'limit'].includes(meetingRecorder.state)) $('meeting-record').click();
  else if (['recording', 'limit'].includes(recorder.state)) $('record').click();
});
try {
  const data = await api.load(); settings = data.settings; catalog = data.providers;
  const aboutTitle = document.createElement('h2'); aboutTitle.textContent = 'Über BlitzDic';
  const aboutText = document.createElement('p'); aboutText.id = 'app-version';
  aboutText.textContent = `Version ${data.version} · Windows 11. Diese App verwendet FFmpeg-Bibliotheken unter LGPL v2.1 oder später. Lizenztexte und der zugehörige FFmpeg-Quellcode sind im Windows-Paket enthalten.`;
  const licensesButton = document.createElement('button'); licensesButton.id = 'licenses-open';
  licensesButton.textContent = 'Lizenzen und Quellcode öffnen';
  licensesButton.onclick = attempt(() => api['licenses-open']());
  $('settings').append(aboutTitle, aboutText, licensesButton);
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
  const websiteTitle = document.createElement('h3'); websiteTitle.textContent = 'Schreibmodus pro Website';
  const websiteNote = document.createElement('p');
  websiteNote.textContent = 'Gilt für das Wortgenau-Kürzel. Die spezifischste Website-Regel hat Vorrang vor der Programmregel; eine Domain umfasst ihre Unterdomains. Andere Modus-Kürzel behalten ihre Auswahl. Eine Regel pro Zeile: mail.beispiel.de => clean. Modi: verbatim, clean, calm, emoji. Gespeichert wird nur der Hostname, keine vollständige Adresse. Ohne eingerichtetes LLM bleibt der Text wortgenau.';
  const websiteRules = document.createElement('textarea'); websiteRules.id = 'website-mode-rules';
  websiteRules.setAttribute('aria-label', 'Website-Regeln für Schreibmodi');
  websiteRules.value = (settings.websiteModes || []).map(rule => `${rule.host} => ${rule.mode}`).join('\n');
  const websiteSave = document.createElement('button'); websiteSave.id = 'save-website-modes'; websiteSave.textContent = 'Website-Regeln speichern';
  websiteSave.onclick = attempt(async () => {
    const rules = parseWebsiteModes(websiteRules.value);
    settings.websiteModes = rules; await save();
    websiteRules.value = rules.map(rule => `${rule.host} => ${rule.mode}`).join('\n');
    status('Website-Regeln gespeichert.');
  });
  $('settings').append(websiteTitle, websiteNote, websiteRules, websiteSave);
  const shortcutsTitle = document.createElement('h3'); shortcutsTitle.textContent = 'Globale Tastenkürzel';
  const shortcutsNote = document.createElement('p'); shortcutsNote.textContent = 'Einmal drücken startet, erneut drücken beendet die Aufnahme. Beim Schließen bleibt BlitzDic im Infobereich aktiv.';
  $('settings').append(shortcutsTitle, shortcutsNote);
  const escapeNote = document.createElement('p');
  escapeNote.textContent = 'Escape beendet eine laufende Aufnahme und transkribiert sie. Während der Verarbeitung bricht Escape den Vorgang ab. Außerhalb eines Vorgangs bleibt Escape für andere Programme verfügbar.';
  $('settings').append(escapeNote);
  const behaviorLabel = document.createElement('label'); behaviorLabel.textContent = 'Kürzelbedienung';
  const behavior = document.createElement('select'); behavior.id = 'shortcut-behavior';
  behavior.add(new Option('Drücken: starten / erneut drücken: beenden', 'toggle'));
  behavior.add(new Option('Halten: aufnehmen / loslassen: beenden', 'hold'));
  behavior.value = settings.shortcutBehavior ?? 'toggle';
  const behaviorNote = () => {shortcutsNote.textContent = behavior.value === 'hold' ?
    'Kürzel halten, bis die Aufnahmeanzeige erscheint, dann sprechen. Loslassen beendet die Aufnahme. Die Knöpfe und der Infobereich bleiben unabhängig davon Start-/Stopp-Schalter.' :
    'Einmal drücken startet, erneut drücken beendet die Aufnahme. Beim Schließen bleibt BlitzDic im Infobereich aktiv.';};
  behaviorNote(); behaviorLabel.append(behavior); $('settings').append(behaviorLabel);
  behavior.onchange = attempt(async () => {
    behavior.disabled = true;
    settings.shortcutBehavior = behavior.value;
    try {await save();}
    catch (error) {
      try {settings.shortcutBehavior = (await api.load()).settings.shortcutBehavior ?? 'toggle'; behavior.value = settings.shortcutBehavior;}
      finally {behaviorNote(); behavior.disabled = false;}
      throw error;
    }
    behavior.disabled = false; behaviorNote(); status('Kürzelbedienung gespeichert.');
  });
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
  $('recording-indicator-enabled').checked = settings.recordingIndicator !== false;
  $('terms').value = settings.modeSettings.customTerms.join('\n'); $('instruction').value = settings.modeSettings.systemPrompt || '';
  updateLocation(); await refreshHistory(); await refreshMeetings();
} catch (error) { status(error.message); }
