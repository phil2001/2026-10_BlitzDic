// Chromium (Chrome, Edge, the ChatGPT app) builds its accessibility tree only when a UI
// Automation client first asks. On a long page, such as a long ChatGPT conversation, the
// first capture saw only the browser window and the first dictation stayed in BlitzDic.
// This starts Edge (BLITZDIC_TEST_BROWSER=chrome for Chrome) with a new profile, so the
// capture before the dictation is its first UI Automation contact, and checks that the
// capture waits for the tree, and that a focused button or an Electron window without
// forced accessibility (also a Chromium window) is answered without waiting.
//
// Every capture is bound to the owned test window and process; text is inserted only into
// a target captured from it. If another program is in the foreground, nothing is captured
// or inserted. BLITZDIC_TEST_WAIT_FOR_FOCUS=1 waits up to a minute for a click on the
// test window instead of failing.
import { chromium, _electron as electron } from 'playwright';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { runSpeech } from '../src/speech.js';

const root = resolve(import.meta.dirname, '..');
const pythonPath = process.env.BLITZDIC_TEST_SPEECH_EXECUTABLE || `${root}/.runtime/venv/Scripts/python.exe`;
const channel = process.env.BLITZDIC_TEST_BROWSER || 'msedge';
const waitForFocus = process.env.BLITZDIC_TEST_WAIT_FOR_FOCUS === '1';
process.env.BLITZDIC_UIA_TRACE = '1'; // Inherited by the worker: shows whether the capture waited.

const capture = async scope => {
  let trace = '';
  const started = Date.now();
  const result = await runSpeech({action: 'capture-target', scope}, {pythonPath, timeoutMs: 10000,
    onProgress: chunk => { trace += chunk; }});
  return {...result, waited: trace.includes('capture:wait-for-tree'), ms: Date.now() - started,
    focused: [...new Set(trace.match(/capture:focused-element [^\r\n]*/g) ?? [])].join('; ')};
};
// Only GetForegroundWindow: no UI Automation contact before the capture under test.
const foreground = () => Number(execFileSync(`${root}/.runtime/venv/Scripts/python.exe`, ['-c',
  'import ctypes; print(ctypes.windll.user32.GetForegroundWindow())'], {encoding: 'utf8'}).trim());
async function untilForeground(window, label) {
  const deadline = Date.now() + (waitForFocus ? 60000 : 3000);
  if (waitForFocus && foreground() !== window) console.log(`Bitte in das Testfenster „${label}“ klicken …`);
  while (foreground() !== window) {
    if (Date.now() > deadline) throw new Error(`${label} ist nicht im Vordergrund; nichts erfasst oder eingefügt.`);
    await new Promise(done => setTimeout(done, 100));
  }
}

const token = randomUUID().slice(0, 8);
const conversation = '<p>Frage und Antwort mit etwas Text, <b>Hervorhebung</b> und <a href="#">Link</a>.</p>'.repeat(8000);
const profile = await mkdtemp(join(tmpdir(), 'blitzdic-chromium-'));
const browser = await chromium.launchPersistentContext(profile, {channel, headless: false});
try {
  const page = browser.pages()[0] ?? await browser.newPage();
  await page.goto('about:blank');
  await page.setContent(`<title>BlitzDic Chromium ${token}</title>${conversation}
    <div id="prompt" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Nachricht"><p><br></p></div>
    <button id="send">Senden</button>`);
  await page.bringToFront();
  await page.locator('#prompt').click();
  const [owner] = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-Command',
    `$found = @(Get-Process | Where-Object { $_.MainWindowTitle -like '*BlitzDic Chromium ${token}*' } | ` +
    `ForEach-Object { @{ window = [Int64]$_.MainWindowHandle; process = $_.Id } }); ConvertTo-Json -Compress -InputObject $found`],
    {encoding: 'utf8'}).replace(/^﻿/, '').trim() || '[]');
  assert.ok(owner?.window && owner?.process, 'Testfenster des Browsers nicht gefunden.');
  await untilForeground(owner.window, `BlitzDic Chromium ${token}`);

  const first = await capture(owner);
  console.log(`Erste Erfassung: ${first.ms} ms, gewartet: ${first.waited}, ${first.reason || 'Feld erkannt'}`);
  assert.equal(first.target?.kind, 'uia', `Erste Erfassung abgewiesen: ${first.reason} (${first.focused})`);
  assert.ok(first.waited, 'Der Zugänglichkeitsbaum war schon vorhanden; der Erstfall wurde nicht geprüft.');
  assert.equal((await runSpeech({action: 'insert-text', target: first.target, text: 'Grüße 🌍 '},
    {pythonPath, timeoutMs: 10000})).inserted, true);
  // A trailing space typed into contenteditable becomes a no-break space.
  const typed = () => page.locator('#prompt').evaluate(element => element.innerText.replace(/ /g, ' '));
  await page.waitForFunction(() => document.querySelector('#prompt').innerText.replace(/ /g, ' ').includes('Grüße 🌍 '),
    null, {timeout: 5000}).catch(async () => assert.fail(`Text nicht im Feld angekommen: ${JSON.stringify(await typed())}`));

  await page.locator('#send').focus();
  const button = await capture(owner);
  assert.equal(button.target, null, 'Eine Schaltfläche wurde als Eingabefeld erfasst.');
  assert.equal(button.waited, false, 'Bei fokussierter Schaltfläche darf die Erfassung nicht warten.');
  console.log(`PASS: ${channel}: erste Erfassung wartet auf den Baum, Text eingefügt; Schaltfläche ohne Wartezeit abgewiesen`);
} finally {
  await browser.close();
  await rm(profile, {recursive: true, force: true});
}

const env = {...process.env, BLITZDIC_TEST_LAZY_ACCESSIBILITY: '1'}; delete env.ELECTRON_RUN_AS_NODE;
const electronProfile = await mkdtemp(join(tmpdir(), 'blitzdic-electron-'));
const app = await electron.launch({args: [resolve(import.meta.dirname, 'uia-test-app.cjs'), `--user-data-dir=${electronProfile}`], env});
try {
  const page = await app.firstWindow();
  const owner = await app.evaluate(({BrowserWindow}) => {
    const handle = BrowserWindow.getAllWindows()[0].getNativeWindowHandle();
    return {window: Number(handle.length === 8 ? handle.readBigUInt64LE() : handle.readUInt32LE()), process: process.pid};
  });
  await app.evaluate(({app, BrowserWindow}) => { app.focus({steal: true}); BrowserWindow.getAllWindows()[0].focus(); });
  await page.locator('#editor').click();
  await untilForeground(owner.window, 'BlitzDic UI Automation test');
  const result = await capture(owner);
  assert.equal(result.waited, false, 'Electron ohne erzwungene Zugänglichkeit darf die Erfassung nicht verzögern.');
  console.log(`PASS: Electron ohne erzwungene Zugänglichkeit: ${result.ms} ms, ohne Wartezeit (${result.reason || 'Feld erkannt'})`);
} finally {
  await app.close();
  await rm(electronProfile, {recursive: true, force: true});
}
