import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { runSpeech, speechPresets, speechModel, WarmSpeech } from '../src/speech.js';

test('only requested speech families are preset', () => {
  assert.deepEqual(speechPresets.map(p => p.id), ['whisper', 'parakeet-ultra']);
});

const fakeWorker = fileURLToPath(new URL('../scripts/fake-speech-worker.mjs', import.meta.url));
const pool = (options = {}) => new WarmSpeech({ pythonPath: process.execPath, script: fakeWorker, ...options });
const whisper = { engine: 'whisper', modelDirectory: join('models', 'whisper') };
const parakeet = { engine: 'parakeet', modelDirectory: join('models', 'parakeet-ultra') };
const transcribe = (model, extra = {}) => ({ action: 'transcribe', ...model, ...extra });

test('speech model matches the engine and directory a dictation request names', () => {
  assert.deepEqual(speechModel({ preset: 'parakeet-ultra' }, 'models'), parakeet);
  assert.deepEqual(speechModel({ preset: 'custom', engine: 'whisper', modelDirectory: 'D:/m' }, 'models'),
    { engine: 'whisper', modelDirectory: 'D:/m' });
  assert.equal(speechModel({ preset: 'custom' }, 'models'), null);
  assert.equal(speechModel({ preset: 'unknown' }, 'models'), null);
});

test('preloaded worker answers the matching transcription and a new one is warmed afterwards', async () => {
  const speech = pool();
  try {
    assert.equal(speech.prepare(whisper), true);
    const first = speech.warm.child.pid;
    const result = await speech.run(transcribe(whisper));
    assert.deepEqual(result.preloaded, ['whisper', whisper.modelDirectory]);
    assert.equal(result.pid, first);
    assert.ok(speech.warm, 'next worker is warmed after the transcription');
    assert.notEqual(speech.warm.child.pid, first);
    const again = await speech.run(transcribe(whisper));
    assert.deepEqual(again.preloaded, ['whisper', whisper.modelDirectory]);
  } finally { speech.destroy(); }
});

test('repeated preparation for the same model keeps the loaded worker', () => {
  const speech = pool();
  try {
    speech.prepare(whisper); const child = speech.warm.child;
    assert.equal(speech.prepare({ ...whisper }), true);
    assert.equal(speech.warm.child, child);
    assert.equal(child.killed, false);
  } finally { speech.destroy(); }
});

test('a different model starts cold, ends the unused worker and warms the new model', async () => {
  const speech = pool();
  try {
    speech.prepare(whisper); const old = speech.warm.child;
    const result = await speech.run(transcribe(parakeet));
    assert.equal(result.preloaded, null);
    assert.equal(old.killed, true);
    assert.ok(speech.warm.key.startsWith('parakeet'));
  } finally { speech.destroy(); }
});

test('changing the selected model replaces the warm worker', () => {
  const speech = pool();
  try {
    speech.prepare(whisper); const old = speech.warm.child;
    speech.prepare(parakeet);
    assert.equal(old.killed, true);
    assert.ok(speech.warm.key.startsWith('parakeet'));
  } finally { speech.destroy(); }
});

test('no second worker loads while a transcription is running', async () => {
  const speech = pool();
  try {
    const running = speech.run(transcribe(whisper, { delayMs: 300 }));
    assert.equal(speech.prepare(whisper), false);
    assert.equal(speech.warm, null);
    await running;
    assert.ok(speech.warm, 'warmed once the transcription ended');
  } finally { speech.destroy(); }
});

test('other worker actions never consume the warm worker', async () => {
  const speech = pool();
  try {
    speech.prepare(whisper); const child = speech.warm.child;
    const result = await speech.run({ action: 'capture-target' });
    assert.equal(result.preloaded, null);
    assert.equal(speech.warm.child, child);
    assert.equal(child.killed, false);
  } finally { speech.destroy(); }
});

test('cancelling ends the preloaded worker that was handling the request', async () => {
  const speech = pool();
  try {
    speech.prepare(whisper); const child = speech.warm.child;
    const controller = new AbortController();
    const running = speech.run(transcribe(whisper, { delayMs: 10000 }), { signal: controller.signal });
    controller.abort();
    await assert.rejects(running, /abgebrochen/);
    assert.equal(child.killed, true);
  } finally { speech.destroy(); }
});

test('cancelled before start uses no worker', () => {
  const speech = pool();
  try {
    speech.prepare(whisper); const child = speech.warm.child;
    assert.throws(() => speech.run(transcribe(whisper), { signal: AbortSignal.abort() }), { name: 'AbortError' });
    assert.equal(speech.warm.child, child);
  } finally { speech.destroy(); }
});

test('by default the warm worker stays loaded while unused', async () => {
  const speech = pool();
  try {
    speech.prepare(whisper); const child = speech.warm.child;
    await new Promise(done => setTimeout(done, 200));
    assert.equal(speech.warm?.child, child);
    assert.equal(child.exitCode, null);
    assert.equal(child.killed, false);
  } finally { speech.destroy(); }
});

test('with an idle time an unused warm worker ends', async () => {
  const speech = pool({ idleMs: 50 });
  try {
    speech.prepare(whisper); const child = speech.warm.child;
    await once(child, 'exit');
    assert.equal(speech.warm, null);
  } finally { speech.destroy(); }
});

test('a warm worker that exited is not used', async () => {
  const speech = pool();
  try {
    speech.prepare(whisper); const child = speech.warm.child;
    child.kill(); await once(child, 'exit');
    const result = await speech.run(transcribe(whisper));
    assert.equal(result.preloaded, null);
    assert.notEqual(result.pid, child.pid);
  } finally { speech.destroy(); }
});

test('shutdown ends the warm worker and prevents warming after a running transcription', async () => {
  const speech = pool();
  const running = speech.run(transcribe(whisper, { delayMs: 200 }));
  speech.destroy();
  await running;
  assert.equal(speech.warm, null);
  assert.equal(speech.prepare(whisper), false);
});
test('missing runtime fails clearly', async () => {
  await assert.rejects(runSpeech({}, { pythonPath: resolve('missing-runtime.exe') }), /nicht gestartet/);
});
test('cancel before launch does not create a worker', () => {
  assert.throws(() => runSpeech({}, { pythonPath: 'unused', signal: AbortSignal.abort() }), { name: 'AbortError' });
});

// Explicit opt-in: real CPU inference with downloaded model weights, no mocks.
for (const preset of ['whisper', 'parakeet-ultra']) {
  test(`offline Windows inference: ${preset}`, { skip: process.env.BLITZDIC_ASR_TEST !== '1' }, async () => {
    const result = await runSpeech({ action: 'transcribe', preset,
      modelDirectory: resolve('models', preset), audioPath: resolve('.runtime/test-speech.wav'),
    }, { pythonPath: resolve('.runtime/venv/Scripts/python.exe') });
    assert.match(result.text.toLowerCase(), /local speech recognition test/);
    assert.match(result.text.toLowerCase(), /meeting starts tomorrow/);
    assert.ok(result.segments.length > 0);
    assert.ok(result.segments.every(s => s.end > s.start));
  });
  // Compares a cold worker with one that loaded the model ahead of the request.
  test(`offline Windows inference with preloaded model: ${preset}`, { skip: process.env.BLITZDIC_ASR_TEST !== '1' }, async t => {
    const pythonPath = resolve(process.env.BLITZDIC_TEST_RUNTIME || '.runtime/venv/Scripts/python.exe');
    const engine = speechPresets.find(p => p.id === preset).engine;
    const request = { action: 'transcribe', preset, engine, modelDirectory: resolve('models', preset),
      audioPath: resolve('.runtime/test-speech.wav') };
    let started = performance.now();
    await runSpeech(request, { pythonPath });
    const cold = performance.now() - started;
    const speech = new WarmSpeech({ pythonPath });
    try {
      speech.prepare({ engine, modelDirectory: request.modelDirectory });
      await new Promise(done => setTimeout(done, 30000)); // Loading finishes before the request.
      started = performance.now();
      const result = await speech.run(request);
      const warm = performance.now() - started;
      assert.match(result.text.toLowerCase(), /local speech recognition test/);
      t.diagnostic(`${preset}: cold ${(cold / 1000).toFixed(2)} s, preloaded ${(warm / 1000).toFixed(2)} s`);
    } finally { speech.destroy(); }
  });
}
