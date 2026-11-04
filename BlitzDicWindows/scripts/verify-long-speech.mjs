import {resolve} from 'node:path';
import {access, readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {runSpeech} from '../src/speech.js';
const root = resolve(import.meta.dirname, '..');
const modelRoot = process.env.BLITZDIC_TEST_MODEL_ROOT || `${root}/models`;
const pythonPath = process.env.BLITZDIC_TEST_SPEECH_EXECUTABLE || `${root}/.runtime/venv/Scripts/python.exe`;
const audioPath = `${root}/.runtime/long-speech.wav`;
try {await access(audioPath);} catch {
  await new Promise((resolvePromise, reject) => {
    const child = spawn(`${process.env.SystemRoot}/System32/WindowsPowerShell/v1.0/powershell.exe`,
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', `${root}/scripts/make-long-speech.ps1`],
      {stdio: 'inherit', windowsHide: true});
    child.on('error', reject); child.on('exit', code => code === 0 ? resolvePromise() : reject(new Error(`Fixture generation failed: ${code}`)));
  });
}
const wav = await readFile(audioPath);
let rate, channels, bits, size;
for (let offset = 12; offset + 8 <= wav.length;) {
  const id = wav.toString('ascii', offset, offset + 4), bytes = wav.readUInt32LE(offset + 4);
  if (id === 'fmt ') {channels = wav.readUInt16LE(offset + 10); rate = wav.readUInt32LE(offset + 12); bits = wav.readUInt16LE(offset + 22);}
  if (id === 'data') size = bytes;
  offset += 8 + bytes + (bytes % 2);
}
const seconds = size / (rate * channels * bits / 8);
assert.ok(seconds > 60 && seconds < 600, `Unexpected fixture duration: ${seconds}`);
console.log(`Synthetic fixture: ${seconds.toFixed(1)} seconds`);
for (const preset of ['whisper', 'parakeet-ultra']) {
  const start = Date.now();
  const result = await runSpeech({action: 'transcribe', preset, modelDirectory: `${modelRoot}/${preset}`, audioPath},
    {pythonPath});
  let position = -1;
  if (/\bpairs\b/i.test(result.text)) console.log(`SPELLING VARIATION: ${preset} used the homophone pairs for pears`);
  const normalized = result.text.toLowerCase().replace(/\bpairs\b/g, 'pears');
  for (const word of ['apples', 'bananas', 'oranges', 'pears', 'lemons', 'grapes']) {
    const found = normalized.indexOf(word, position + 1);
    assert.ok(found > position, `${preset}: missing or reordered marker ${word}`); position = found;
    assert.equal(normalized.split(word).length - 1, 2, `${preset}: marker ${word} must occur at beginning and end of its section`);
  }
  assert.equal((result.text.toLowerCase().match(/the meeting will continue tomorrow morning/g) || []).length, 6);
  assert.ok(result.segments.length > 1);
  assert.ok(result.segments.every((segment, index, all) => segment.end >= segment.start &&
    (index === 0 || segment.start >= all[index - 1].start)));
  assert.ok(result.segments.at(-1).end > seconds - 15, `${preset}: final portion not represented`);
  console.log(`PASS: ${preset}, ${result.segments.length} segments, all ordered markers, ${(Date.now() - start) / 1000}s processing`);
}
