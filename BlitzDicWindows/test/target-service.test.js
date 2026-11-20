import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { TargetService } from '../src/target-service.js';

const fakeWorker = fileURLToPath(new URL('../scripts/fake-speech-worker.mjs', import.meta.url));
const service = () => new TargetService({ pythonPath: process.execPath, script: fakeWorker });
const capture = (extra = {}) => ({ action: 'capture-target', ...extra });

test('capture and insertion reuse one running helper', async () => {
  const targets = service();
  try {
    const first = await targets.request(capture());
    const second = await targets.request({ action: 'insert-text', text: 'Grüße 🌍', target: {} });
    assert.equal(first.action, 'capture-target');
    assert.equal(second.text, 'Grüße 🌍');
    assert.equal(second.pid, first.pid);
  } finally { targets.destroy(); }
});

test('started ahead of the first request', async () => {
  const targets = service();
  try {
    const helper = targets.start();
    assert.equal(targets.start(), helper);
    assert.equal((await targets.request(capture())).pid, helper.child.pid);
  } finally { targets.destroy(); }
});

test('concurrent requests are answered by id', async () => {
  const targets = service();
  try {
    const [slow, fast] = await Promise.all([targets.request(capture({ delayMs: 150 })),
      targets.request({ action: 'insert-text', text: 'zwei' })]);
    assert.equal(slow.action, 'capture-target');
    assert.equal(fast.text, 'zwei');
  } finally { targets.destroy(); }
});

test('a helper error rejects only that request', async () => {
  const targets = service();
  try {
    const before = await targets.request(capture());
    await assert.rejects(targets.request(capture({ fail: 'Feld geändert' })), /Feld geändert/);
    assert.equal((await targets.request(capture())).pid, before.pid);
  } finally { targets.destroy(); }
});

test('a timeout ends the helper and the next request starts a new one', async () => {
  const targets = service();
  try {
    const before = await targets.request(capture());
    await assert.rejects(targets.request(capture({ delayMs: 5000 }), { timeoutMs: 100 }), /Zeitüberschreitung/);
    assert.notEqual((await targets.request(capture())).pid, before.pid);
  } finally { targets.destroy(); }
});

test('cancellation ends the helper like ending a single-use worker', async () => {
  const targets = service();
  try {
    const before = await targets.request(capture());
    const controller = new AbortController();
    const pending = targets.request({ action: 'insert-text', delayMs: 5000 }, { signal: controller.signal });
    controller.abort();
    await assert.rejects(pending, /Abgebrochen/);
    assert.notEqual((await targets.request(capture())).pid, before.pid);
    assert.throws(() => targets.request(capture(), { signal: AbortSignal.abort() }), { name: 'AbortError' });
  } finally { targets.destroy(); }
});

test('a crashed helper rejects its requests and is replaced', async () => {
  const targets = service();
  try {
    const before = await targets.request(capture());
    await assert.rejects(targets.request(capture({ die: true })), /unerwartet beendet/);
    assert.notEqual((await targets.request(capture())).pid, before.pid);
  } finally { targets.destroy(); }
});

test('only capture and insertion are accepted', () => {
  const targets = service();
  assert.throws(() => targets.request({ action: 'transcribe' }), /Unbekannte Aktion/);
  assert.equal(targets.helper, null);
});

test('a missing runtime fails clearly', async () => {
  const targets = new TargetService({ pythonPath: 'C:\\missing\\blitzdic-speech.exe' });
  await assert.rejects(targets.request(capture()), /nicht gestartet/);
  targets.destroy();
});

test('shutdown ends the helper and refuses further requests', async () => {
  const targets = service();
  await targets.request(capture());
  const { child } = targets.helper;
  const pending = targets.request(capture({ delayMs: 5000 }));
  targets.destroy();
  await assert.rejects(pending, /unerwartet beendet/);
  assert.equal(child.killed, true);
  await assert.rejects(targets.request(capture()), /beendet/);
});
