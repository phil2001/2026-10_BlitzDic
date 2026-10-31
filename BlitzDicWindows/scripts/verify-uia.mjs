import { _electron as electron } from 'playwright';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { runSpeech } from '../src/speech.js';

const root = resolve(import.meta.dirname, '..');
const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({args: [resolve(import.meta.dirname, 'uia-test-app.cjs'),
  `--user-data-dir=${root}/.runtime/uia-test-profile`], env});
const worker = request => runSpeech(request, {pythonPath: process.env.BLITZDIC_TEST_SPEECH_EXECUTABLE || `${root}/.runtime/venv/Scripts/python.exe`, timeoutMs: 10000});
try {
  const page = await app.firstWindow();
  await app.evaluate(({app, BrowserWindow}) => { app.focus({steal: true}); BrowserWindow.getAllWindows()[0].focus(); });
  await page.locator('#editor').click();
  await page.locator('#editor').evaluate(element => element.setSelectionRange(7, 7));
  const captured = await worker({action: 'capture-target'});
  assert.equal(captured.executable, 'electron.exe');
  const target = captured.target;
  assert.equal(target?.kind, 'uia', JSON.stringify(target));
  assert.equal((await worker({action: 'insert-text', target, text: 'Grüße! 🌍'})).inserted, true);
  await page.waitForFunction(() => document.querySelector('#editor').value === 'Before Grüße! 🌍');
  const stale = (await worker({action: 'capture-target'})).target;
  await page.locator('#editor').evaluate(element => element.setSelectionRange(0, 0));
  assert.equal((await worker({action: 'insert-text', target: stale, text: 'WRONG'})).inserted, false);
  await page.locator('#editor').evaluate(element => element.setSelectionRange(0, 6));
  const selected = (await worker({action: 'capture-target'})).target;
  assert.equal((await worker({action: 'insert-text', target: selected, text: 'After'})).inserted, true);
  await page.waitForFunction(() => document.querySelector('#editor').value === 'After Grüße! 🌍');
  const changedText = (await worker({action: 'capture-target'})).target;
  await page.locator('#editor').evaluate(element => {
    const start = element.selectionStart, end = element.selectionEnd;
    element.value = element.value.replace('After', 'Other');
    element.setSelectionRange(start, end);
  });
  assert.equal((await worker({action: 'insert-text', target: changedText, text: 'WRONG'})).inserted, false);
  const changedFocus = (await worker({action: 'capture-target'})).target;
  await page.locator('#password').click();
  assert.equal((await worker({action: 'insert-text', target: changedFocus, text: 'WRONG'})).inserted, false);
  assert.equal((await worker({action: 'capture-target'})).target, null);
  await page.locator('#readonly').click();
  assert.equal((await worker({action: 'capture-target'})).target, null);
  await page.locator('#rich').click();
  const rich = (await worker({action: 'capture-target'})).target;
  assert.equal(rich?.kind, 'uia');
  assert.equal((await worker({action: 'insert-text', target: rich, text: ' Test'})).inserted, true);
  await page.waitForFunction(() => document.querySelector('#rich').textContent.includes(' Test'));
  console.log('PASS: Chromium textarea/contenteditable, Unicode, selection, focus and read-only/password checks');
} finally { await app.close(); }
