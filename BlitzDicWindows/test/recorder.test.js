import test from 'node:test';
import assert from 'node:assert/strict';
import { Recorder } from '../src/recorder.js';

test('cancelled microphone startup cannot replace or stop a newer recording', async () => {
  const pending = [];
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {configurable: true, value: {mediaDevices: {
    getUserMedia: () => new Promise(resolve => pending.push(resolve)),
  }}});
  const oldContext = globalThis.AudioContext, oldNode = globalThis.AudioWorkletNode;
  class Context {
    state = 'running'; sampleRate = 16000;
    audioWorklet = {addModule: async () => {}};
    createMediaStreamSource() { return {connect() {}, disconnect() {}}; }
    createGain() { return {gain: {}, connect() {}, disconnect() {}}; }
    resume() { return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
  }
  globalThis.AudioContext = Context;
  globalThis.AudioWorkletNode = class { port = {}; connect() {} disconnect() {} };
  const stream = () => { const track = {stopped: false, stop() {this.stopped = true;}}; return {track, getTracks: () => [track]}; };
  const recorder = new Recorder();
  try {
    const first = recorder.start(); recorder.cancel();
    const second = recorder.start();
    const active = stream(); pending[1](active);
    assert.equal(await second, true);
    const cancelled = stream(); pending[0](cancelled);
    assert.equal(await first, false);
    assert.equal(cancelled.track.stopped, true);
    assert.equal(active.track.stopped, false);
    assert.equal(recorder.state, 'recording');
    recorder.cancel();
    assert.equal(active.track.stopped, true);
    // A cancel while AudioContext.resume is unresolved must not reactivate capture.
    let finishResume;
    Context.prototype.resume = () => new Promise(resolve => {finishResume = resolve;});
    const third = recorder.start(); pending[2](stream());
    await new Promise(resolve => setImmediate(resolve));
    recorder.cancel(); finishResume();
    assert.equal(await third, false);
    assert.equal(recorder.state, 'idle');
  } finally {
    recorder.cancel();
    if (original) Object.defineProperty(globalThis, 'navigator', original); else delete globalThis.navigator;
    if (oldContext) globalThis.AudioContext = oldContext; else delete globalThis.AudioContext;
    if (oldNode) globalThis.AudioWorkletNode = oldNode; else delete globalThis.AudioWorkletNode;
  }
});
