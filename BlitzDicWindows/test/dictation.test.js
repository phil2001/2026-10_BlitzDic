import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Dictation } from '../src/dictation.js';
import { defaultSettings } from '../src/store.js';

function fixture(overrides = {}) {
  const settings = defaultSettings(); const history = [];
  const store = { settings: async () => settings, appendHistory: async entry => history.push(entry) };
  const flow = new Dictation({ store, modelRoot: 'models', pythonPath: 'python',
    transcribe: async () => ({ text: 'Hallo Welt', segments: [] }), ...overrides });
  return { flow, settings, history };
}
test('verbatim transcript reaches history without configured LLM', async () => {
  const { flow, history } = fixture(); const states = [];
  flow.on('state', state => states.push(state));
  const result = await flow.process('audio.wav');
  assert.equal(result.text, 'Hallo Welt'); assert.equal(history.length, 1);
  assert.deepEqual(states, ['transcribing', 'saving', 'idle']);
});
test('meeting capture can transcribe without adding a dictation history entry', async () => {
  const {flow, history} = fixture();
  const entry = await flow.process(Buffer.from('test audio'), 'verbatim', {saveHistory: false});
  assert.equal(entry.original, 'Hallo Welt'); assert.equal(history.length, 0);
});
test('optional speaker transcription uses local auxiliary models and preserves labels', async () => {
  let request;
  const {flow, history} = fixture({transcribe: async input => {
    request = input; return {text: 'Sprecher 1: Hallo.', segments: [{start: 0, end: 1, speakers: [1], text: 'Hallo.'}]};
  }});
  const entry = await flow.process(Buffer.from('audio'), 'verbatim', {saveHistory: false, diarize: true, speakerCount: 2});
  assert.equal(request.action, 'transcribe-speakers'); assert.equal(request.speakerCount, 2);
  assert.match(request.diarizationDirectory, /models[\\/]diarization$/);
  assert.equal(entry.original, 'Sprecher 1: Hallo.'); assert.deepEqual(entry.segments[0].speakers, [1]);
  assert.equal(history.length, 0);
});
test('rewrite failure preserves transcription with explicit warning', async () => {
  const { flow, settings } = fixture({ rewriteText: async () => { throw new Error('offline'); } });
  settings.mode = 'clean';
  const result = await flow.process('audio.wav');
  assert.equal(result.original, 'Hallo Welt'); assert.equal(result.text, 'Hallo Welt');
  assert.match(result.warning, /offline/); assert.equal(result.mode, 'verbatim');
});
test('cancellation blocks late results and overlapping work', async () => {
  let release; let entered;
  const started = new Promise(resolve => { entered = resolve; });
  const { flow, history } = fixture({ transcribe: () => { entered(); return new Promise(resolve => { release = resolve; }); } });
  let results = 0; flow.on('result', () => results++);
  const running = flow.process('audio.wav'); await started; flow.cancel();
  await assert.rejects(flow.process('other.wav'), /bereits/);
  release({ text: 'late' }); await assert.rejects(running, { name: 'AbortError' });
  assert.equal(history.length, 0); assert.equal(results, 0); assert.equal(flow.state, 'idle');
});
test('settings are frozen per request and disabled history stays empty', async () => {
  let settings;
  const f = fixture({ transcribe: async () => { settings.mode = 'clean'; return { text: 'Original' }; } });
  settings = f.settings; settings.historyEnabled = false;
  assert.equal((await f.flow.process('audio.wav')).mode, 'verbatim');
  assert.equal(f.history.length, 0);
});
test('disk failures do not lose the completed dictation', async () => {
  const f = fixture(); f.flow.store.appendHistory = async () => { throw new Error('disk full'); };
  const result = await f.flow.process('audio.wav');
  assert.equal(result.text, 'Hallo Welt'); assert.match(result.warning, /disk full/);
});
test('microphone buffers are passed in memory without a recording file path', async () => {
  let request;
  const { flow } = fixture({ transcribe: async input => { request = input; return { text: 'audio' }; } });
  const audio = Buffer.from('test-wave-data');
  await flow.process(audio);
  assert.equal(request.audioPath, undefined);
  assert.deepEqual(Buffer.from(request.audioBase64, 'base64'), audio);
});
