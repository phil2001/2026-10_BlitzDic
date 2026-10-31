import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {runSpeech} from '../src/speech.js';
const root = resolve(import.meta.dirname, '..');
const result = await runSpeech({action: 'diarize', modelDirectory: `${root}/models/diarization`,
  audioPath: `${root}/.runtime/four-speakers-zh.wav`, speakerCount: 4},
  {pythonPath: `${root}/.runtime/venv/Scripts/python.exe`});
assert.equal(result.speakerCount, 4);
assert.ok(result.speakers.length >= 4);
assert.equal(result.speakers[0].speaker, 1);
assert.ok(result.speakers.every((segment, index, all) => segment.end > segment.start &&
  (index === 0 || segment.start >= all[index - 1].start)));
assert.ok(result.speakers.at(-1).end > 50);
console.log(`PASS: speaker worker, four clusters, ${result.speakers.length} time ranges through >50 seconds`);
