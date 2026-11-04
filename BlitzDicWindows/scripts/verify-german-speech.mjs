import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {runSpeech} from '../src/speech.js';
const root = resolve(import.meta.dirname, '..');
const pythonPath = process.env.BLITZDIC_TEST_SPEECH_EXECUTABLE || `${root}/.runtime/venv/Scripts/python.exe`;
const modelRoot = process.env.BLITZDIC_TEST_MODEL_ROOT || `${root}/models`;
const language = process.env.BLITZDIC_TEST_LANGUAGE || '';
const timed = process.env.BLITZDIC_TEST_WORD_TIMESTAMPS === '1';
for (const preset of ['whisper', 'parakeet-ultra']) {
  const result = await runSpeech({action: 'transcribe', preset, modelDirectory: `${modelRoot}/${preset}`,
    audioPath: `${root}/.runtime/german-speech-utf8.wav`, language, wordTimestamps: timed}, {pythonPath});
  console.log(`${preset} (synthetic German): ${result.text}`);
  assert.match(result.text, /Besprechung beginnt morgen/i);
  assert.match(result.text, /neun Uhr|9\s*Uhr/i);
  assert.match(result.text, /Anna prüft die Unterlagen/i);
  assert.match(result.text, /2[.,\s]?500|zweitausendfünfhundert/i);
  assert.match(result.text, /Lieferung nach Berlin/i);
  if (preset === 'whisper') assert.equal(result.language, 'de');
  if (timed) {
    assert.ok(Array.isArray(result.words) && result.words.length > 10);
    assert.match(result.words.map(word=>word.text).join(' '), /Anna prüft die Unterlagen/i);
    result.words.forEach((word,index)=>{
      assert.ok(Number.isFinite(word.start)&&Number.isFinite(word.end)&&word.start>=0&&word.end>=word.start);
      if(index)assert.ok(word.start>=result.words[index-1].start);
    });
  }
  console.log(`PASS: ${preset}, German umlaut, time, budget and open question`);
}
