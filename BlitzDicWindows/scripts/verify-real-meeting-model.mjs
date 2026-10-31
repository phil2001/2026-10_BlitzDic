import assert from 'node:assert/strict';
import { Meetings } from '../src/meetings.js';

const provider = {provider: 'lmstudio', location: 'local',
  baseURL: process.env.BLITZDIC_TEST_LLM_URL || 'http://127.0.0.1:1234/v1',
  model: process.env.BLITZDIC_TEST_LLM_MODEL || 'blitzdic-summary-test', apiKey: ''};
const transcript = 'Anna: Wir entscheiden uns für Angebot B. Das Budget beträgt 2500 Euro. '
  + 'Ben: Ich prüfe die technischen Unterlagen. Ein Abgabetermin wurde nicht vereinbart. '
  + 'Anna: Offen bleibt, ob die Lieferung nach Berlin möglich ist.';
const saved = [];
const meetings = new Meetings({store: {settings: async () => ({provider}), appendMeeting: async entry => saved.push(entry)}});
const entry = await meetings.summarize(transcript, 'Synthetischer LLM-Test');
assert.equal(entry.transcript, transcript); assert.equal(saved.length, 1);
assert.match(entry.summary, /Angebot B/i);
assert.match(entry.summary, /2[.,\s]?500/);
assert.match(entry.summary, /Ben/);
assert.match(entry.summary, /Berlin/);
const questions = entry.summary.split(/Offene Fragen\s*:?/i)[1] || '';
assert.match(questions, /Berlin/);
const tasks = entry.summary.split(/Aufgaben\s*:?/i)[1]?.split(/Offene Fragen/i)[0] || '';
assert.match(tasks, /Ben/);
assert.doesNotMatch(tasks, /Anna/);
console.log('SYNTHETIC FIXTURE SUMMARY:\n' + entry.summary);
console.log('PASS: real local model, key facts retained, original preserved, save invoked');
