import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {runSpeech} from '../src/speech.js';
const root = resolve(import.meta.dirname, '..');
const pythonPath = process.env.BLITZDIC_TEST_SPEECH_EXECUTABLE || `${root}/.runtime/venv/Scripts/python.exe`;
const modelRoot = process.env.BLITZDIC_TEST_MODEL_ROOT || `${root}/models`;
for (const extension of ['m4a', 'webm']) {
  const audioPath = `${process.env.BLITZDIC_TEST_AUDIO_FORMAT_DIRECTORY || `${root}/.runtime/audio-format-fixtures`}/speech.${extension}`;
  for (const preset of ['whisper', 'parakeet-ultra']) {
    const result = await runSpeech({action: 'transcribe', preset, modelDirectory: `${modelRoot}/${preset}`, audioPath}, {pythonPath});
    assert.match(result.text, /local speech recognition test/i);
    console.log(`PASS: ${extension} -> ${preset} -> expected speech`);
  }
  const result = await runSpeech({action: 'diarize', modelDirectory: `${modelRoot}/diarization`, audioPath, speakerCount: 1}, {pythonPath});
  assert.equal(result.speakerCount, 1); assert.ok(result.speakers.length > 0);
  console.log(`PASS: ${extension} -> speaker ranges`);
  const labeled = await runSpeech({action: 'transcribe-speakers', preset: 'parakeet-ultra',
    modelDirectory: `${modelRoot}/parakeet-ultra`, diarizationDirectory: `${modelRoot}/diarization`,
    audioPath, speakerCount: 1}, {pythonPath});
  assert.match(labeled.text, /local speech recognition test/i);
  assert.match(labeled.text, /Sprecher 1:/);
  console.log(`PASS: ${extension} -> speaker-labeled Parakeet transcription`);
}
