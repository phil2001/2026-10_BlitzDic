import { encodeWav } from './wav.js';

export class Recorder {
  constructor({ onLevel = () => {}, onLimit = () => {} } = {}) {
    this.onLevel = onLevel; this.onLimit = onLimit; this.state = 'idle';
  }
  async start(deviceId = '', { source = 'microphone' } = {}) {
    if (this.state !== 'idle') throw new Error('Aufnahme läuft bereits.');
    if (!['microphone', 'system', 'both'].includes(source)) throw new Error('Unbekannte Audioquelle.');
    this.state = 'starting'; this.chunks = []; this.samples = 0;
    const session = {streams: [], sources: []}; this.session = session;
    const current = () => this.session === session;
    try {
      if (source !== 'microphone') {
        const display = await navigator.mediaDevices.getDisplayMedia({audio: true, video: {frameRate: 1}});
        session.streams.push(display);
        if (!current()) { this.release(session); return false; }
        if (!display.getAudioTracks().some(track => track.readyState === 'live'))
          throw new Error('Windows hat keinen Systemaudio-Stream geliefert. Audioausgabegerät prüfen.');
      }
      if (source !== 'system') {
      session.stream = await navigator.mediaDevices.getUserMedia({ audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        channelCount: 1, echoCancellation: true, noiseSuppression: true,
      } });
      session.streams.push(session.stream);
      }
      if (!current()) { this.release(session); return false; }
      session.context = new AudioContext();
      await session.context.audioWorklet.addModule(new URL('./recorder-worklet.js', import.meta.url));
      if (!current()) { this.release(session); return false; }
      session.node = new AudioWorkletNode(session.context, 'blitzdic-capture');
      for (const stream of session.streams) {
        const input = session.context.createMediaStreamSource(stream);
        const gain = session.context.createGain(); gain.gain.value = 1 / session.streams.length;
        input.connect(gain); gain.connect(session.node);
        session.sources.push(input, gain);
      }
      session.mute = session.context.createGain(); session.mute.gain.value = 0;
      session.node.port.onmessage = ({ data }) => {
        if (!current() || this.state !== 'recording') return;
        this.chunks.push(data); this.samples += data.length;
        this.onLevel(Math.sqrt(data.reduce((sum, x) => sum + x * x, 0) / data.length));
        if (this.samples >= session.context.sampleRate * 60 * 30) {
          this.state = 'limit'; this.onLimit();
        }
      };
      session.node.connect(session.mute); session.mute.connect(session.context.destination);
      await session.context.resume();
      // WASAPI loopback can report live before its first usable audio arrives.
      // Keep the UI in "starting" during this device warm-up so the first words
      // are not spoken against a prematurely displayed recording indicator.
      if (source !== 'microphone') await new Promise(resolve => setTimeout(resolve, 1500));
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
    session.streams.forEach(stream => stream.getTracks().forEach(track => track.stop()));
    session.sources.forEach(source => source.disconnect()); session.node?.disconnect(); session.mute?.disconnect();
    if (session.node) session.node.port.onmessage = null;
    if (session.context && session.context.state !== 'closed') session.context.close().catch(() => {});
  }
}
