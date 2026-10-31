import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {runSpeech} from '../src/speech.js';
const root = resolve(import.meta.dirname, '..');
const pythonPath = process.env.BLITZDIC_TEST_SPEECH_EXECUTABLE || `${root}/.runtime/venv/Scripts/python.exe`;
const modelRoot = process.env.BLITZDIC_TEST_MODEL_ROOT || `${root}/models`;
const language = process.env.BLITZDIC_TEST_LANGUAGE || '';
for (const preset of ['whisper', 'parakeet-ultra']) {
  const result = await runSpeech({action: 'transcribe', preset, modelDirectory: `${modelRoot}/${preset}`,
    audioPath: `${root}/.runtime/german-speech-utf8.wav`, language}, {pythonPath});
  console.log(`${preset} (synthetic German): ${result.text}`);
  assert.match(result.text, /Besprechung beginnt morgen/i);
  assert.match(result.text, /neun Uhr|9\s*Uhr/i);
  assert.match(result.text, /Anna prüft die Unterlagen/i);
  assert.match(result.text, /2[.,\s]?500|zweitausendfünfhundert/i);
  assert.match(result.text, /Lieferung nach Berlin/i);
  if (preset === 'whisper') assert.equal(result.language, 'de');
  console.log(`PASS: ${preset}, German umlaut, time, budget and open question`);
}
