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

test('stereo WAV preserves interleaved source channels, byte rate and complete frames',()=>{
  const audio=Buffer.from(encodeWav([Float32Array.of(.25,-.5,.5,-.25)],16000,2));
  assert.equal(audio.readUInt16LE(22),2);assert.equal(audio.readUInt16LE(32),4);
  assert.equal(audio.readUInt32LE(28),64000);assert.equal(audio.length,52);
  assert.deepEqual(Array.from({length:4},(_,i)=>audio.readInt16LE(44+i*2)),[8192,-16384,16384,-8192]);
  assert.throws(()=>encodeWav([Float32Array.of(1)],16000,2),/Audiokanäle/);
});
