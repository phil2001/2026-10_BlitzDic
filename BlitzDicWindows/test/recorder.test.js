import test from 'node:test';
import assert from 'node:assert/strict';
import { Recorder } from '../src/recorder.js';

test('ended audio sources finalize buffered audio once and fail cleanly during startup', async () => {
  class Track extends EventTarget {
    readyState = 'live';
    stop() {this.readyState = 'ended';}
    end() {this.readyState = 'ended'; this.dispatchEvent(new Event('ended'));}
  }
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const oldContext = globalThis.AudioContext, oldNode = globalThis.AudioWorkletNode;
  let track, resume = () => Promise.resolve();
  Object.defineProperty(globalThis, 'navigator', {configurable: true, value: {mediaDevices: {
    getUserMedia: async () => {track = new Track(); return {getTracks: () => [track]};},
  }}});
  globalThis.AudioContext = class {
    state = 'running'; sampleRate = 16000; audioWorklet = {addModule: async () => {}};
    createMediaStreamSource() {return {connect() {}, disconnect() {}};}
    createGain() {return {gain: {}, connect() {}, disconnect() {}};}
    resume() {return resume();} close() {this.state = 'closed'; return Promise.resolve();}
  };
  globalThis.AudioWorkletNode = class {port = {}; connect() {} disconnect() {}};
  let callbacks = 0, audio;
  const recorder = new Recorder({onEnded: () => {callbacks++; audio = recorder.stop();}});
  try {
    await recorder.start();
    recorder.session.node.port.onmessage({data: new Float32Array([0.1, 0.2, 0.3])});
    track.end(); track.end();
    assert.equal(callbacks, 1); assert.equal(recorder.state, 'idle');
    assert.equal(audio.byteLength, 44 + 3 * 2);
    let finish;
    resume = () => new Promise(resolve => {finish = resolve;});
    const pending = recorder.start(); await new Promise(resolve => setImmediate(resolve));
    track.end(); finish();
    await assert.rejects(pending, /Audioquelle/);
    assert.equal(callbacks, 1); assert.equal(recorder.state, 'idle');
    resume = () => Promise.resolve(); await recorder.start();
    recorder.cancel(); track.end(); assert.equal(callbacks, 1);
  } finally {
    recorder.cancel();
    if (original) Object.defineProperty(globalThis, 'navigator', original); else delete globalThis.navigator;
    if (oldContext) globalThis.AudioContext = oldContext; else delete globalThis.AudioContext;
    if (oldNode) globalThis.AudioWorkletNode = oldNode; else delete globalThis.AudioWorkletNode;
  }
});

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
    Context.prototype.resume = () => Promise.resolve();
    let finishPreparation;
    const fourth = recorder.start('', {beforeCapture: () => new Promise(resolve => {finishPreparation = resolve;})});
    pending[3](stream()); await new Promise(setImmediate);
    assert.equal(recorder.state, 'starting');
    assert.equal(recorder.session.node, undefined, 'No audio graph may start before output preparation');
    assert.equal(recorder.chunks.length, 0, 'Audio must not be buffered before output preparation completes');
    recorder.cancel();
    const fifth = recorder.start(); const newest = stream(); pending[4](newest);
    assert.equal(await fifth, true);
    finishPreparation(); assert.equal(await fourth, false);
    assert.equal(recorder.state, 'recording'); assert.equal(newest.track.stopped, false);
  } finally {
    recorder.cancel();
    if (original) Object.defineProperty(globalThis, 'navigator', original); else delete globalThis.navigator;
    if (oldContext) globalThis.AudioContext = oldContext; else delete globalThis.AudioContext;
    if (oldNode) globalThis.AudioWorkletNode = oldNode; else delete globalThis.AudioWorkletNode;
  }
});
