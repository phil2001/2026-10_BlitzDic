import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {runSpeech} from '../src/speech.js';
const root = resolve(import.meta.dirname, '..');
const modelRoot = process.env.BLITZDIC_TEST_MODEL_ROOT || `${root}/models`;
const pythonPath = process.env.BLITZDIC_TEST_SPEECH_EXECUTABLE;
if (!pythonPath) throw new Error('BLITZDIC_TEST_SPEECH_EXECUTABLE must identify the frozen worker');
// Do not let runtime tests accidentally succeed by resolving unbundled DLLs from
// the same external developer-tool PATH that the build is intended to exclude.
process.env.PATH = [resolve(process.env.SystemRoot, 'System32'), process.env.SystemRoot].join(';');
for (const preset of ['whisper', 'parakeet-ultra']) {
  const result = await runSpeech({action: 'transcribe', preset, modelDirectory: `${modelRoot}/${preset}`,
    audioPath: `${root}/.runtime/test-speech.wav`}, {pythonPath});
  assert.match(result.text, /local speech recognition test/i);
  console.log(`PASS: isolated frozen worker ${preset}`);
}
const result = await runSpeech({action: 'diarize', modelDirectory: `${modelRoot}/diarization`,
  audioPath: `${root}/.runtime/four-speakers-zh.wav`, speakerCount: 4}, {pythonPath});
assert.equal(result.speakerCount, 4); assert.ok(result.speakers.length >= 4);
console.log('PASS: isolated frozen worker speaker diarization');
