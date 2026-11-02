import { encodeWav } from './wav.js';

export class Recorder {
  constructor({ onLevel = () => {}, onLimit = () => {}, onEnded = onLimit } = {}) {
    this.onLevel = onLevel; this.onLimit = onLimit; this.onEnded = onEnded; this.state = 'idle';
  }
  async start(deviceId = '', { source = 'microphone', beforeCapture = async () => {} } = {}) {
    if (this.state !== 'idle') throw new Error('Aufnahme läuft bereits.');
    if (!['microphone', 'system', 'both'].includes(source)) throw new Error('Unbekannte Audioquelle.');
    this.state = 'starting'; this.chunks = []; this.samples = 0;
    const session = {streams: [], sources: []}; this.session = session;
    const current = () => this.session === session;
    session.onEnded = () => {
      session.ended = true;
      if (current() && this.state === 'recording') { this.state = 'limit'; this.onEnded(); }
    };
    const watch = stream => {
      session.streams.push(stream);
      stream.getTracks().forEach(track => {
        if (track.readyState === 'ended') session.ended = true;
        track.addEventListener?.('ended', session.onEnded);
      });
    };
    const checkSource = () => {
      if (session.ended) throw new Error('Die Audioquelle wurde während des Starts beendet. Bitte erneut starten.');
    };
    try {
      if (source !== 'microphone') {
        const display = await navigator.mediaDevices.getDisplayMedia({audio: true, video: {frameRate: 1}});
        watch(display);
        if (!current()) { this.release(session); return false; }
        if (!display.getAudioTracks().some(track => track.readyState === 'live'))
          throw new Error('Windows hat keinen Systemaudio-Stream geliefert. Audioausgabegerät prüfen.');
      }
      if (source !== 'system') {
      session.stream = await navigator.mediaDevices.getUserMedia({ audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        channelCount: 1, echoCancellation: true, noiseSuppression: true,
      } });
      watch(session.stream);
      }
      if (!current()) { this.release(session); return false; }
      checkSource();
      // Permission is granted, but no audio graph/buffer runs before output preparation.
      await beforeCapture();
      if (!current()) { this.release(session); return false; }
      checkSource();
      session.context = new AudioContext();
      await session.context.audioWorklet.addModule(new URL('./recorder-worklet.js', import.meta.url));
      if (!current()) { this.release(session); return false; }
      checkSource();
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
      checkSource();
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
    // Drain resources rather than sealing the session: permission may resolve
    // after cancellation and add a late stream that must also be stopped.
    const streams = session.streams.splice(0), sources = session.sources.splice(0);
    streams.forEach(stream => stream.getTracks().forEach(track => track.removeEventListener?.('ended', session.onEnded)));
    streams.forEach(stream => stream.getTracks().forEach(track => track.stop()));
    sources.forEach(source => source.disconnect()); session.node?.disconnect(); session.mute?.disconnect();
    if (session.node) session.node.port.onmessage = null;
    session.node = null; session.mute = null;
    const context = session.context; session.context = null;
    if (context && context.state !== 'closed') context.close().catch(() => {});
  }
}
