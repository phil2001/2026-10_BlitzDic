import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { runSpeech, speechPresets } from '../src/speech.js';

test('only requested speech families are preset', () => {
  assert.deepEqual(speechPresets.map(p => p.id), ['whisper', 'parakeet-ultra']);
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
}
