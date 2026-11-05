import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {runSpeech} from '../src/speech.js';
const root = resolve(import.meta.dirname, '..');
const modelRoot = process.env.BLITZDIC_TEST_MODEL_ROOT || `${root}/models`;
const pythonPath = process.env.BLITZDIC_TEST_SPEECH_EXECUTABLE || `${root}/.runtime/venv/Scripts/python.exe`;
if (process.env.BLITZDIC_TEST_SPEECH_EXECUTABLE)
  process.env.PATH = [resolve(process.env.SystemRoot, 'System32'), process.env.SystemRoot].join(';');
const result = await runSpeech({action: 'transcribe-speakers', preset: 'whisper', language: 'zh',
  modelDirectory: `${modelRoot}/whisper`, diarizationDirectory: `${modelRoot}/diarization`,
  audioPath: `${root}/.runtime/four-speakers-zh.wav`, speakerCount: 4},
  {pythonPath});
assert.equal(result.speakerCount, 4);
assert.ok(result.segments.length >= 4);
const seen = new Set(result.segments.flatMap(segment => segment.speakers));
assert.equal(seen.size, 4);
assert.ok(result.segments.every((segment, index, all) => segment.text.trim() && segment.end > segment.start &&
  (index === 0 || segment.start >= all[index - 1].end)));
assert.match(result.text, /Sprecher 1:/);
console.log(`PASS: diarization -> cached Whisper -> ${result.segments.length} labeled turns, four speaker IDs`);
const parakeet = await runSpeech({action: 'transcribe-speakers', preset: 'parakeet-ultra', language: 'en',
  modelDirectory: `${modelRoot}/parakeet-ultra`, diarizationDirectory: `${modelRoot}/diarization`,
  audioPath: `${root}/.runtime/long-speech.wav`, speakerCount: 1},
  {pythonPath});
assert.equal(parakeet.speakerCount, 1);
assert.ok(parakeet.segments.length > 1);
assert.ok(parakeet.segments.every(segment => segment.speakers.length === 1 && segment.speakers[0] === 1));
assert.match(parakeet.text.toLowerCase(), /apples/);
assert.match(parakeet.text.toLowerCase(), /grapes/);
console.log(`PASS: diarization -> cached Parakeet -> ${parakeet.segments.length} labeled turns across 105 seconds`);
