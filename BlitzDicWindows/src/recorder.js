import { encodeWav } from './wav.js';

export class Recorder {
  constructor({ onLevel = () => {}, onLimit = () => {} } = {}) {
    this.onLevel = onLevel; this.onLimit = onLimit; this.state = 'idle';
  }
  async start(deviceId = '') {
    if (this.state !== 'idle') throw new Error('Aufnahme läuft bereits.');
    this.state = 'starting'; this.chunks = []; this.samples = 0;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        channelCount: 1, echoCancellation: true, noiseSuppression: true,
      } });
      if (this.state !== 'starting') { this.release(); return; }
      this.context = new AudioContext();
      await this.context.audioWorklet.addModule(new URL('./recorder-worklet.js', import.meta.url));
      if (this.state !== 'starting') { this.release(); return; }
      this.node = new AudioWorkletNode(this.context, 'blitzdic-capture');
      this.source = this.context.createMediaStreamSource(this.stream);
      this.mute = this.context.createGain(); this.mute.gain.value = 0;
      this.node.port.onmessage = ({ data }) => {
        if (this.state !== 'recording') return;
        this.chunks.push(data); this.samples += data.length;
        this.onLevel(Math.sqrt(data.reduce((sum, x) => sum + x * x, 0) / data.length));
        if (this.samples >= this.context.sampleRate * 60 * 30) {
          this.state = 'limit'; this.onLimit();
        }
      };
      this.source.connect(this.node); this.node.connect(this.mute); this.mute.connect(this.context.destination);
      await this.context.resume(); this.state = 'recording';
    } catch (error) { this.release(); this.state = 'idle'; throw error; }
  }
  stop() {
    if (!['recording', 'limit'].includes(this.state)) throw new Error('Keine aktive Aufnahme.');
    this.state = 'stopping';
    const result = encodeWav(this.chunks, this.context.sampleRate);
    this.release(); this.state = 'idle'; return result;
  }
  cancel() { this.state = 'idle'; this.release(); }
  release() {
    this.stream?.getTracks().forEach(track => track.stop());
    this.source?.disconnect(); this.node?.disconnect(); this.mute?.disconnect();
    if (this.context && this.context.state !== 'closed') this.context.close();
    this.stream = null; this.context = null; this.source = null; this.node = null; this.mute = null;
    this.chunks = []; this.onLevel(0);
  }
}
