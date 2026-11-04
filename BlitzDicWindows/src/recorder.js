import { encodeWav } from './wav.js';

export class Recorder {
  constructor({ onLevel = () => {}, onLimit = () => {}, onEnded = onLimit } = {}) {
    this.onLevel = onLevel; this.onLimit = onLimit; this.onEnded = onEnded; this.state = 'idle';
  }
  async start(deviceId = '', { source = 'microphone', beforeCapture = async () => {} } = {}) {
    if (this.state !== 'idle') throw new Error('Aufnahme läuft bereits.');
    if (!['microphone', 'system', 'both'].includes(source)) throw new Error('Unbekannte Audioquelle.');
    this.state = 'starting'; this.chunks = []; this.samples = 0;
    this.channels = source === 'both' ? 2 : 1;
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
        try {
          session.stream = await navigator.mediaDevices.getUserMedia({ audio: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            channelCount: 1, echoCancellation: true, noiseSuppression: true,
          } });
        } catch (error) {
          if (deviceId && ['NotFoundError', 'OverconstrainedError'].includes(error.name)) {
            throw new Error('Das gewählte Mikrofon ist nicht verfügbar. Bitte erneut verbinden oder unter Diktat ein anderes Mikrofon wählen.');
          }
          throw error;
        }
        watch(session.stream);
      }
      if (!current()) { this.release(session); return false; }
      checkSource();
      // Permission is granted, but no audio graph/buffer runs before output preparation.
      await beforeCapture();
      if (!current()) { this.release(session); return false; }
      checkSource();
      session.context = new AudioContext(source === 'both' ? {sampleRate:16000} : {});
      await session.context.audioWorklet.addModule(new URL('./recorder-worklet.js', import.meta.url));
      if (!current()) { this.release(session); return false; }
      checkSource();
      session.node = new AudioWorkletNode(session.context, 'blitzdic-capture', {
        numberOfInputs:this.channels, processorOptions:{separate:this.channels===2},
      });
      for (const stream of session.streams) {
        const input = session.context.createMediaStreamSource(stream);
        input.connect(session.node, 0, source === 'both' && stream !== session.stream ? 1 : 0);
        session.sources.push(input);
      }
      session.mute = session.context.createGain(); session.mute.gain.value = 0;
      session.node.port.onmessage = ({ data }) => {
        if (!current() || this.state !== 'recording') return;
        this.chunks.push(data); this.samples += data.length / this.channels;
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
    try { return encodeWav(this.chunks, this.session.context.sampleRate, this.channels); }
    finally { this.cancel(); }
  }
  snapshotSince(cursor=0,{separate=false}={}) {
    if(!['recording','limit'].includes(this.state)||!this.session?.context)throw new Error('Keine aktive Aufnahme.');
    if(!Number.isInteger(cursor)||cursor<0||cursor>this.samples)throw new Error('Ungültige Audioposition.');
    const rate=this.session.context.sampleRate,end=this.samples,start=Math.max(cursor,end-rate*300);
    if(end-start<rate*2)return null;
    const parts=[];let offset=0;
    const channels=this.channels||1;
    for(const chunk of this.chunks){
      const next=offset+chunk.length/channels;
      if(next>start){
        const tail=chunk.subarray(Math.max(0,start-offset)*channels);
        if(channels===1||separate)parts.push(tail);
        else parts.push(Float32Array.from({length:tail.length/2},(_,i)=>(tail[i*2]+tail[i*2+1])/2));
      }
      offset=next;
    }
    return {audio:encodeWav(parts,rate,separate?channels:1),cursor:end,dropped:start>cursor};
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
