import { _electron as electron } from 'playwright';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {runSpeech} from '../src/speech.js';

const root = resolve(import.meta.dirname, '..');
const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE;
const preset = process.env.BLITZDIC_TEST_PRESET || 'whisper';
const executablePath = process.env.BLITZDIC_TEST_EXECUTABLE;
const externalInput = process.env.BLITZDIC_TEST_EXTERNAL_INPUT === '1';
const hold = process.env.BLITZDIC_TEST_HOLD === '1';
const escape = process.env.BLITZDIC_TEST_ESCAPE === '1';
const cancelRewrite = process.env.BLITZDIC_TEST_ESCAPE_CANCEL === '1';
const cancelSpeech = process.env.BLITZDIC_TEST_ESCAPE_CANCEL_ASR === '1';
assert.ok(!cancelRewrite || escape, 'Cancellation fixture requires Escape control');
assert.ok(!cancelSpeech || (escape && !cancelRewrite), 'ASR cancellation requires Escape without the rewrite fixture');
assert.ok(['whisper', 'parakeet-ultra'].includes(preset));
const appRule = process.env.BLITZDIC_TEST_APP_RULE === '1';
const explicitMode = process.env.BLITZDIC_TEST_EXPLICIT_MODE || '';
assert.ok(!explicitMode || (appRule && ['clean', 'calm', 'emoji'].includes(explicitMode)));
const expectedMode = explicitMode || 'clean';
const shortcutNumber = cancelRewrite ? 2 : {clean: 2, calm: 3, emoji: 4}[explicitMode] || 1;
const requests = [];
let acceptRequest;
const requestReady = new Promise(accept => {acceptRequest = accept;});
const server = appRule || cancelRewrite ? createServer(async (request, response) => {
  let body = ''; for await (const part of request) body += part;
  requests.push(JSON.parse(body)); acceptRequest();
  if (cancelRewrite) return; // Deliberately pending until Escape cancels the request.
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify({choices: [{message: {content: 'Programmregel bestätigt: This is a local speech recognition test.'}, finish_reason: 'stop'}]}));
}) : null;
if (server) { server.listen(0, '127.0.0.1'); await once(server, 'listening'); }
const baseURL = server ? `http://127.0.0.1:${server.address().port}/v1` : '';
const runId = `${Date.now()}-${preset}`;
// Start the keyboard helper before focusing the target. Launching a console
// process at the instant of the shortcut can itself disturb foreground focus.
const keyboard = externalInput ? null : spawn(`${root}/.runtime/venv/Scripts/python.exe`, [`${root}/scripts/test-hotkey.py`], {windowsHide: true});
if (keyboard) await once(keyboard.stdout, 'data');
const shortcut = async (action = 'toggle') => {
  const sent = once(keyboard.stdout, 'data');
  keyboard.stdin.write(`${action} ${targetWindow} ${shortcutNumber}\n`);
  assert.equal((await sent)[0].toString().trim(), 'sent');
};
let dictation, target, targetWindow, page, editor;
try {
  dictation = await electron.launch({executablePath, args: [...(executablePath ? [] : [root]), `--user-data-dir=${root}/.runtime/hotkey-app-${runId}`,
    '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
    `--use-file-for-fake-audio-capture=${root}/.runtime/test-speech.wav`], env});
  page = await dictation.firstWindow();
  await page.waitForSelector('#provider option', {state: 'attached'});
  await page.evaluate(async ({preset, appRule, cancelRewrite, baseURL, hold, shortcutNumber}) => {
    const {settings} = await window.blitz.load(); settings.speech.preset = preset; settings.speech.language = 'en';
    settings.shortcutBehavior = hold ? 'hold' : 'toggle';
    // The keyboard helper sends Ctrl+Shift+number. Only that shortcut is registered, so other
    // programs (e.g. an installed BlitzDic) may hold the remaining numbers.
    settings.shortcuts = {verbatim: '', clean: '', calm: '', emoji: ''};
    settings.shortcuts[['verbatim', 'clean', 'calm', 'emoji'][shortcutNumber - 1]] = `Control+Shift+${shortcutNumber}`;
    if (appRule || cancelRewrite) {
      if (appRule) settings.appModes = [{executable: 'electron.exe', mode: 'clean'}];
      settings.provider = {provider: 'custom', location: 'local', baseURL, model: 'rule-fixture', apiKey: ''};
    }
    await window.blitz.settings(settings);
  }, {preset, appRule, cancelRewrite, baseURL, hold, shortcutNumber});
  assert.equal(await dictation.evaluate(({globalShortcut}, number) => globalShortcut.isRegistered(`Control+Shift+${number}`), shortcutNumber), true);
  target = await electron.launch({args: [resolve(import.meta.dirname, 'uia-test-app.cjs'),
    `--user-data-dir=${root}/.runtime/hotkey-target-${runId}`], env});
  editor = await target.firstWindow();
  if (escape) await editor.evaluate(() => {
    window.testEscapeKeys = 0;
    window.addEventListener('keydown', event => {if (event.key === 'Escape') window.testEscapeKeys++;});
  });
  targetWindow = await target.evaluate(({BrowserWindow}) => {
    const handle = BrowserWindow.getAllWindows()[0].getNativeWindowHandle();
    return handle.length === 8 ? handle.readBigUInt64LE().toString() : handle.readUInt32LE().toString();
  });
  const indicatorReady = process.env.BLITZDIC_TEST_INDICATOR === '1' ? dictation.waitForEvent('window') : null;
  indicatorReady?.catch(() => {}); // Preserve an earlier foreground/input failure on cleanup.
  if (!externalInput) {
    await target.evaluate(({app, BrowserWindow}) => { app.focus({steal: true}); BrowserWindow.getAllWindows()[0].focus(); });
    await editor.locator('#editor').click();
    await editor.locator('#editor').evaluate(element => element.setSelectionRange(7, 7));
    if (process.env.BLITZDIC_TEST_WAIT_FOR_FOCUS === '1') console.log('READY: waiting for the exact owned editor foreground window; no keys sent yet.');
    await shortcut(hold ? 'down' : 'toggle');
  } else console.log(`READY: focus the owned test editor, place cursor at end, then ${hold ? 'hold' : 'press'} Ctrl+Shift+${shortcutNumber}.`);
  await page.waitForFunction(() => document.querySelector('#record').textContent === 'Aufnahme beenden', {}, {timeout: externalInput ? 180000 : 15000});
  console.log('Global shortcut started recording.');
  if (indicatorReady) {
    const pill = await indicatorReady;
    await pill.waitForURL(/recording-indicator.html$/);
    await pill.waitForFunction(() => document.querySelector('#elapsed').textContent !== '00:00');
    const runtime = await dictation.evaluate(({app}) => app.isPackaged ?
      `${process.resourcesPath}/speech-runtime/blitzdic-speech.exe` : `${app.getAppPath()}/.runtime/venv/Scripts/python.exe`);
    const captured = await runSpeech({action: 'capture-target'}, {pythonPath: runtime, timeoutMs: 10000});
    assert.equal(captured.target?.signature?.split(':')[0], targetWindow, 'Indicator must preserve the original Windows foreground window');
    assert.equal(await dictation.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows().find(w => w.getTitle() === 'BlitzDic · Aufnahme').isFocusable()), false);
    console.log('PASS: visible recording indicator preserves the exact external foreground window');
  }
  if (appRule) assert.equal(await page.locator('#mode').inputValue(), expectedMode);
  if (process.env.BLITZDIC_TEST_MOVE_CURSOR === '1')
    await editor.locator('#editor').evaluate(element => element.setSelectionRange(0, 0));
  await new Promise(resolve => setTimeout(resolve, 6200));
  if (externalInput) console.log(`READY: ${hold ? 'release' : 'press'} the same shortcut in the owned test window to stop.`);
  else {
    await shortcut(escape ? 'escape' : hold ? 'up' : 'toggle');
    if (escape && hold) await shortcut('up');
    console.log(escape ? 'Escape sent; held shortcut keys released.' : hold ? 'Held keys released.' : 'Stop shortcut sent.');
  }
  if (cancelRewrite || cancelSpeech) {
    let timer;
    try {
      if (cancelSpeech) await page.waitForFunction(() => document.querySelector('#status').textContent === 'Sprache wird erkannt …');
      else await Promise.race([requestReady, new Promise((_, reject) => {timer = setTimeout(() => reject(new Error('Rewrite fixture not reached')), 60000);})]);
    }
    finally {clearTimeout(timer);}
    await shortcut('escape');
    await page.waitForFunction(() => !document.querySelector('#record').disabled && /abgebrochen|aborted/i.test(document.querySelector('#status').textContent));
    assert.equal(await page.locator('#status').textContent(), 'Abgebrochen.');
    assert.equal(await editor.locator('#editor').inputValue(), 'Before ');
    assert.equal(await page.locator('#result').inputValue(), '');
    assert.deepEqual((await page.evaluate(() => window.blitz.load())).history, []);
    console.log(`PASS: native Escape cancels ${cancelSpeech ? 'local ASR' : 'a pending rewrite'}, saves no history and inserts no text`);
  } else {
  await page.waitForFunction(() => document.querySelector('#status').textContent === 'Transkription abgeschlossen.' ||
    /geändert|fehlgeschlagen|Zeitüberschreitung|Zusatztaste|Eingabefeld/.test(document.querySelector('#status').textContent), {}, {timeout: 60000});
  console.log('Transcription status:', await page.locator('#status').textContent());
  if (indicatorReady) assert.equal(await dictation.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows().find(w => w.getTitle() === 'BlitzDic · Aufnahme').isVisible()), false);
  if (process.env.BLITZDIC_TEST_MOVE_CURSOR === '1') {
    assert.equal(await editor.locator('#editor').inputValue(), 'Before ');
    assert.match(await page.locator('#status').textContent(), /geändert/);
    assert.match(await page.locator('#result').inputValue(), /local speech recognition test/i);
    console.log('PASS: moved cursor prevents insertion; recognized speech remains available.');
  } else {
  await editor.waitForFunction(() => document.querySelector('#editor').value.toLowerCase().includes('local speech recognition test'), {}, {timeout: 5000});
  assert.match(await editor.locator('#editor').inputValue(), /^Before /);
  assert.equal(await editor.locator('#editor').evaluate(element => document.activeElement === element), true);
  if (process.env.BLITZDIC_TEST_FIT === '1') {
    assert.equal(appRule, false, 'Cursor-fit fixture expects the original English transcript');
    assert.match(await editor.locator('#editor').inputValue(), /^Before this /);
    console.log('PASS: sentence continuation fits lowercase function word at the original cursor');
  }
  if (appRule) {
    assert.equal(requests.length, 1);
    assert.equal(requests[0].model, 'rule-fixture');
    assert.match(requests[0].messages.at(-1).content, /local speech recognition test/i);
    assert.match(requests[0].messages[0].content, expectedMode === 'clean' ? /Korrigiere Rechtschreibung/ :
      expectedMode === 'calm' ? /emotional gesprochenes Transkript/ : /passende Emojis/);
    assert.match(await editor.locator('#editor').inputValue(), /Programmregel bestätigt:/);
    assert.equal((await page.evaluate(() => window.blitz.load())).history[0].mode, expectedMode);
    console.log(`PASS: foreground app rule ${explicitMode ? 'preserves explicit ' : 'selects '}${expectedMode}, rewrite and encrypted history`);
  }
  console.log(`PASS: real global ${hold ? 'hold/release' : 'toggle'} shortcut -> synthetic microphone -> local ${preset} -> external Chromium insertion`);
  }
  }
  if (escape) {
    assert.equal(await editor.evaluate(() => window.testEscapeKeys), 0, 'Active Escape must be consumed');
    await shortcut('escape');
    await editor.waitForFunction(() => window.testEscapeKeys === 1);
    console.log('PASS: active Escape stops/transcribes and is consumed; idle Escape reaches the external editor');
  }
  console.log('Status:', await page.locator('#status').textContent());
} catch (error) {
  if (page) console.error('Dictation state:', await page.evaluate(() => ({status: document.querySelector('#status').textContent,
    button: document.querySelector('#record').textContent, result: document.querySelector('#result').value})));
  if (editor) console.error('Target value:', await editor.locator('#editor').inputValue());
  throw error;
} finally {
  await target?.close(); await dictation?.close();
  keyboard?.stdin.end();
  server?.closeAllConnections(); if (server) await new Promise(resolve => server.close(resolve));
}
