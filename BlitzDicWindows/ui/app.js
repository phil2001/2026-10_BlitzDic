import { Recorder } from '../src/recorder.js';
const $ = id => document.getElementById(id);
const api = window.blitz;
let settings, catalog, busy = false;
const status = text => { $('status').textContent = text; };
const attempt = fn => async () => { try { await fn(); } catch (error) { status(error.message); } };
const recorder = new Recorder({ onLevel: level => { $('level').value = level; }, onLimit: () => $('record').click() });
function recordingUI(active) {
  $('record').textContent = active ? 'Aufnahme beenden' : 'Aufnahme starten';
  $('recording-label').textContent = active ? 'Ich höre zu …' : 'Bereit für dein Diktat.';
  $('level').hidden = !active; $('cancel').hidden = !active && !busy;
}
async function save() { await api.settings(settings); }
async function result(entry) {
  if (!entry) return;
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
const providerConfig = () => Object.fromEntries(['provider', 'location', 'baseURL', 'model', 'apiKey'].map(id => [id, $(id).value]));
document.querySelectorAll('nav button').forEach(button => button.onclick = () => {
  document.querySelectorAll('main > section').forEach(section => { section.hidden = section.id !== button.dataset.page; });
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('selected', b === button));
});
$('record').onclick = attempt(async () => {
  if (busy) return;
  if (['recording', 'limit'].includes(recorder.state)) {
    const wav = recorder.stop(); recordingUI(false); await result(await api.audio(wav, $('mode').value));
  } else {
    await recorder.start($('microphone').value); recordingUI(true); status('');
    const devices = await navigator.mediaDevices.enumerateDevices();
    const selected = $('microphone').value;
    $('microphone').replaceChildren(new Option('Standardmikrofon', ''));
    devices.filter(d => d.kind === 'audioinput').forEach(d => $('microphone').add(new Option(d.label || 'Mikrofon', d.deviceId)));
    $('microphone').value = selected;
  }
});
$('import').onclick = attempt(async () => { if (!busy && recorder.state === 'idle') await result(await api.import($('mode').value)); });
$('cancel').onclick = attempt(async () => { recorder.cancel(); await api.cancel(); recordingUI(false); status('Abgebrochen.'); });
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
  if (busy || !settings || recorder.state === 'starting') return;
  if (recorder.state === 'idle') $('mode').value = mode;
  $('record').click();
});
api.onShortcutError(text => status(`Tastenkürzel nicht verfügbar: ${text}`));
try {
  const data = await api.load(); settings = data.settings; catalog = data.providers;
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
  updateLocation(); await refreshHistory();
} catch (error) { status(error.message); }
