import { encodeWav } from './wav.js';

export class Recorder {
  constructor({ onLevel = () => {}, onLimit = () => {} } = {}) {
    this.onLevel = onLevel; this.onLimit = onLimit; this.state = 'idle';
  }
  async start(deviceId = '') {
    if (this.state !== 'idle') throw new Error('Aufnahme läuft bereits.');
    this.state = 'starting'; this.chunks = []; this.samples = 0;
    const session = {}; this.session = session;
    const current = () => this.session === session;
    try {
      session.stream = await navigator.mediaDevices.getUserMedia({ audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        channelCount: 1, echoCancellation: true, noiseSuppression: true,
      } });
      if (!current()) { this.release(session); return false; }
      session.context = new AudioContext();
      await session.context.audioWorklet.addModule(new URL('./recorder-worklet.js', import.meta.url));
      if (!current()) { this.release(session); return false; }
      session.node = new AudioWorkletNode(session.context, 'blitzdic-capture');
      session.source = session.context.createMediaStreamSource(session.stream);
      session.mute = session.context.createGain(); session.mute.gain.value = 0;
      session.node.port.onmessage = ({ data }) => {
        if (!current() || this.state !== 'recording') return;
        this.chunks.push(data); this.samples += data.length;
        this.onLevel(Math.sqrt(data.reduce((sum, x) => sum + x * x, 0) / data.length));
        if (this.samples >= session.context.sampleRate * 60 * 30) {
          this.state = 'limit'; this.onLimit();
        }
      };
      session.source.connect(session.node); session.node.connect(session.mute); session.mute.connect(session.context.destination);
      await session.context.resume();
      if (!current()) { this.release(session); return false; }
      this.state = 'recording'; return true;
    } catch (error) {
      if (!current()) { this.release(session); return false; }
      this.cancel(); throw error;
    }
  }
  stop() {
    if (!['recording', 'limit'].includes(this.state)) throw new Error('Keine aktive Aufnahme.');
    this.state = 'stopping';
    try { return encodeWav(this.chunks, this.session.context.sampleRate); }
    finally { this.cancel(); }
  }
  cancel() {
    const session = this.session; this.session = null; this.state = 'idle';
    this.release(session); this.chunks = []; this.onLevel(0);
  }
  release(session) {
    if (!session) return;
    session.stream?.getTracks().forEach(track => track.stop());
    session.source?.disconnect(); session.node?.disconnect(); session.mute?.disconnect();
    if (session.node) session.node.port.onmessage = null;
    if (session.context && session.context.state !== 'closed') session.context.close().catch(() => {});
  }
}
