import test from 'node:test';
import assert from 'node:assert/strict';
import { Meetings } from '../src/meetings.js';

test('transcripts save offline without loading provider settings or invoking a model', async () => {
  const saved = [];
  const service = new Meetings({store: {appendMeeting: async entry => saved.push(entry)},
    generate: async () => {throw new Error('Must not invoke a model');}});
  const original = 'Unverändertes Transkript mit 2500 Euro.\nZweite Zeile.';
  const entry = await service.saveTranscript(original, ' Offline ');
  assert.equal(saved.length, 1); assert.equal(entry.transcript, original);
  assert.equal(entry.title, 'Offline'); assert.equal(entry.summary, '');
  assert.equal(entry.provider, undefined);
  await assert.rejects(service.saveTranscript(' '), /Transkript/);
  await assert.rejects(service.saveTranscript('Text', 'A'.repeat(201)), /Titel/);
  assert.equal(saved.length, 1);
});

test('meeting summaries preserve original source, snapshot provider and merge all chunks', async () => {
  const saved = [], requests = [], config = {provider: 'ollama', model: 'local'};
  const service = new Meetings({store: {settings: async () => ({provider: config}), appendMeeting: async entry => saved.push(entry)},
    generate: async (provider, instruction, text) => {requests.push({provider, instruction, text}); config.model = 'changed'; return `Summary ${requests.length}`;}});
  const transcript = 'A'.repeat(12000) + 'B'.repeat(50);
  const entry = await service.summarize(transcript, ' Planung ');
  assert.equal(requests.length, 3);
  assert.equal(requests[0].text + requests[1].text, transcript);
  assert.ok(requests.every(request => request.provider.model === 'local'));
  assert.match(requests[2].text, /Summary 1[\s\S]*Summary 2/);
  assert.equal(entry.transcript, transcript); assert.equal(entry.title, 'Planung');
  assert.equal(saved.length, 1); assert.equal(entry.summary, 'Summary 3');
});

test('cancelled or failed meeting generation cannot persist partial summaries', async () => {
  let release, started;
  const ready = new Promise(resolve => {started = resolve;});
  const saved = [];
  const service = new Meetings({store: {settings: async () => ({provider: {}}), appendMeeting: async entry => saved.push(entry)},
    generate: async () => {started(); return new Promise(resolve => {release = resolve;});}});
  const pending = service.summarize('Source'); await ready;
  await assert.rejects(service.summarize('Second'), /bereits/);
  service.cancel(); release('Late summary');
  await assert.rejects(pending, {name: 'AbortError'}); assert.equal(saved.length, 0);
  service.generate = async () => {throw new Error('Server offline');};
  await assert.rejects(service.summarize('Source'), /offline/);
  assert.equal(saved.length, 0); assert.equal(service.active, null);
});
