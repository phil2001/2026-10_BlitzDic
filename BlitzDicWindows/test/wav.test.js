import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeWav } from '../src/wav.js';
test('PCM WAV preserves rate, length and signed clipped sample values', () => {
  const buffer = Buffer.from(encodeWav([new Float32Array([-2, -0.5, 0]), new Float32Array([0.5, 2, NaN])], 48000));
  assert.equal(buffer.toString('ascii', 0, 4), 'RIFF');
  assert.equal(buffer.readUInt32LE(4), buffer.length - 8);
  assert.equal(buffer.readUInt32LE(24), 48000);
  assert.equal(buffer.readUInt32LE(40), 12);
  assert.deepEqual(Array.from({ length: 6 }, (_, i) => buffer.readInt16LE(44 + i * 2)), [-32768, -16384, 0, 16384, 32767, 0]);
});
