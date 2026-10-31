import {resolve} from 'node:path';
import {mkdir, copyFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {runSpeech} from '../src/speech.js';
const root = resolve(import.meta.dirname, '..');
const pythonPath = process.env.BLITZDIC_TEST_SPEECH_EXECUTABLE || `${root}/.runtime/venv/Scripts/python.exe`;
const modelRoot = process.env.BLITZDIC_TEST_MODEL_ROOT || `${root}/models`;
const directory = `${root}/.runtime/unicode-import-${Date.now()}`;
await mkdir(directory);
const audioPath = `${directory}/Grüße 🌍.wav`;
await copyFile(`${root}/.runtime/test-speech.wav`, audioPath);
for (const preset of ['whisper', 'parakeet-ultra']) {
  const result = await runSpeech({action: 'transcribe', preset, modelDirectory: `${modelRoot}/${preset}`, audioPath}, {pythonPath});
  assert.match(result.text, /local speech recognition test/i);
  console.log(`PASS: ${preset} imports a UTF-8 path with umlauts, space and emoji`);
}
