// Shared by the renderer recorder and Node tests. Standard PCM16 WAV.
export function encodeWav(chunks, sampleRate, channels=1) {
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) throw new Error('Ungültige Abtastrate.');
  if (![1,2].includes(channels) || chunks.some(chunk=>chunk.length%channels)) throw new Error('Ungültige Audiokanäle.');
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  if (length * 2 > 0xffffffff - 36) throw new Error('Aufnahme zu groß für WAV.');
  const buffer = new ArrayBuffer(44 + length * 2); const view = new DataView(buffer);
  const ascii = (offset, text) => [...text].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  ascii(0, 'RIFF'); view.setUint32(4, 36 + length * 2, true); ascii(8, 'WAVE'); ascii(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2 * channels, true);
  view.setUint16(32, 2 * channels, true); view.setUint16(34, 16, true); ascii(36, 'data'); view.setUint32(40, length * 2, true);
  let offset = 44;
  for (const chunk of chunks) for (const value of chunk) {
    const sample = Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
    view.setInt16(offset, Math.round(sample * (sample < 0 ? 32768 : 32767)), true); offset += 2;
  }
  return buffer;
}
