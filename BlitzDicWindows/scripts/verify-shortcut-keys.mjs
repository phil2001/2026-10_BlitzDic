// Real app, real Windows keystrokes: shortcut fields record pressed keys, and a key sequence
// (first part, then a digit with the modifier held) starts a dictation in the chosen mode.
// Alt+Space may be taken by another program (e.g. Google Gemini), so the sequence under test is
// Ctrl+Up+1; the default Alt+Space is checked for registration or a clear "taken" message.
// Usage: node scripts/verify-shortcut-keys.mjs   (BLITZDIC_TEST_EXECUTABLE for a built app)
// BLITZDIC_TEST_SYNTHETIC_KEYS=1 sends the keys to the page only and stands in for the Windows
// hotkey messages (e.g. while the screen is locked); it then checks the page and the rewrite, not Windows.
import { _electron as electron } from 'playwright';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE;
const executablePath = process.env.BLITZDIC_TEST_EXECUTABLE;
const rewritten = 'Überarbeitet: This is a local speech recognition test.';
const requests = [];
const server = createServer(async (request, response) => {
  let body = ''; for await (const part of request) body += part;
  requests.push(JSON.parse(body));
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify({choices: [{message: {content: rewritten}, finish_reason: 'stop'}]}));
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const native = process.env.BLITZDIC_TEST_SYNTHETIC_KEYS !== '1';
const keyboard = native ? spawn(`${root}/.runtime/venv/Scripts/python.exe`, [`${root}/scripts/test-keys.py`], {windowsHide: true}) : null;
if (keyboard) await once(keyboard.stdout, 'data');
let handle, page;
// Windows only lets the app itself take the foreground; the helper then checks it before sending.
const foreground = () => native && app.evaluate(({app, BrowserWindow}) => { app.focus({steal: true}); BrowserWindow.getAllWindows().find(window => window.getTitle() === 'BlitzDic').focus(); });
const PAGE_KEYS = {ctrl: 'Control', up: 'ArrowUp', back: 'Backspace', esc: 'Escape'};
const keys = async steps => {
  if (!native) {
    for (const step of steps.split(' ')) await page.keyboard[step.endsWith('+') ? 'down' : 'up'](PAGE_KEYS[step.slice(0, -1)] ?? step.slice(0, -1));
    return;
  }
  await foreground();
  const sent = once(keyboard.stdout, 'data');
  keyboard.stdin.write(`${handle} ${steps}\n`);
  assert.equal((await sent)[0].toString().trim(), 'sent');
};
// Synthetic mode: what the main process sends when Windows reports Ctrl+Up, then the digit.
const hotkey = (...events) => app.evaluate(({BrowserWindow}, events) => {
  for (const [channel, mode] of events) BrowserWindow.getAllWindows().find(window => window.getTitle() === 'BlitzDic').webContents.send(channel, mode);
}, events);
const app = await electron.launch({...(executablePath ? {executablePath} : {}), env, args: [...(executablePath ? [] : [root]),
  `--user-data-dir=${root}/.runtime/shortcut-keys-${Date.now()}`, '--use-fake-device-for-media-stream',
  '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${root}/.runtime/test-speech.wav`]});
try {
  page = await app.firstWindow();
  await page.waitForSelector('#provider option', {state: 'attached'});
  const startupStatus = await page.locator('#status').textContent();
  const altSpace = await app.evaluate(({globalShortcut}) => globalShortcut.isRegistered('Alt+Space'));
  if (altSpace) console.log('PASS: default Alt+Space registered for Wortgenau');
  else {
    assert.match(startupStatus, /Alt \+ Leertaste \(von einem anderen Programm belegt\)/);
    console.log(`PASS: Alt+Space is taken by another program on this PC and BlitzDic says so: ${startupStatus}`);
  }
  await page.evaluate(async baseURL => {
    const {settings} = await window.blitz.load(); settings.speech.language = 'en';
    settings.provider = {provider: 'custom', location: 'local', baseURL, model: 'shortcut-fixture', apiKey: ''};
    await window.blitz.settings(settings).catch(() => {}); // Saved even if Alt+Space is taken.
  }, `http://127.0.0.1:${server.address().port}/v1`);
  await page.reload(); await page.waitForSelector('#provider option', {state: 'attached'});
  handle = await app.evaluate(({BrowserWindow}) => {
    const value = BrowserWindow.getAllWindows().find(window => window.getTitle() === 'BlitzDic').getNativeWindowHandle();
    return value.length === 8 ? value.readBigUInt64LE().toString() : value.readUInt32LE().toString();
  });
  await foreground(); await page.locator('nav button[data-page="settings"]').click();
  const fields = Object.fromEntries(await Promise.all(['verbatim', 'clean', 'calm', 'emoji'].map(async mode =>
    [mode, await page.locator(`#shortcut-${mode}`).inputValue()])));
  assert.deepEqual(fields, {verbatim: 'Alt + Leertaste', clean: 'Alt + Leertaste + 1', calm: 'Alt + Leertaste + 2', emoji: 'Alt + Leertaste + 3'});
  console.log('PASS: settings show the default shortcuts in German');

  // Record Ctrl+Up+1 for Überarbeiten by pressing the keys, then Ctrl+Up for Wortgenau.
  await page.locator('#shortcut-clean').click();
  assert.equal(await page.locator('#shortcut-clean').inputValue(), 'Tasten drücken …');
  if (!altSpace) await page.waitForFunction(() => /Alt \+ Leertaste ist gerade von einem anderen Programm belegt/.test(document.querySelector('#status').textContent));
  await keys('ctrl+ up+ up- 1+ 1- ctrl-');
  // The field shows the saved keys; while Alt+Space stays taken, each save also says so.
  const recorded = (mode, text) => page.waitForFunction(({mode, text}) => {
    const field = document.querySelector(`#shortcut-${mode}`); return field.value === text && document.activeElement !== field;
  }, {mode, text});
  await recorded('clean', 'Strg + ↑ + 1');
  console.log('Status after saving:', await page.locator('#status').textContent());
  await page.locator('#shortcut-verbatim').click();
  // Ctrl+Up is now BlitzDic's own shortcut (first part of the sequence): Windows hands it to the main process.
  await keys('ctrl+ up+ up- ctrl-');
  await recorded('verbatim', 'Strg + ↑');
  const saved = (await page.evaluate(() => window.blitz.load())).settings.shortcuts;
  assert.equal(saved.verbatim, 'Control+Up'); assert.equal(saved.clean, 'Control+Up+1');
  assert.equal(await app.evaluate(({globalShortcut}) => globalShortcut.isRegistered('Control+Up')), true);
  assert.equal(await app.evaluate(({globalShortcut}) => globalShortcut.isRegistered('Control+1')), false);
  console.log('PASS: pressed keys recorded and saved (Strg + ↑, Strg + ↑ + 1); the digit stays free for other programs');

  // Backspace removes a shortcut; Escape leaves the field unchanged.
  await page.locator('#shortcut-emoji').click(); await keys('back+ back-');
  await recorded('emoji', 'Kein Kürzel');
  assert.equal((await page.evaluate(() => window.blitz.load())).settings.shortcuts.emoji, '');
  await page.locator('#shortcut-calm').click(); await keys('esc+ esc-');
  await recorded('calm', 'Alt + Leertaste + 2');
  console.log('PASS: Backspace removes a shortcut, Escape cancels recording');

  // Ctrl+Up starts Wortgenau, the 1 pressed with Ctrl still held switches this dictation to Überarbeiten.
  await page.locator('nav button[data-page="dictation"]').click();
  assert.equal(await page.locator('#mode').inputValue(), 'verbatim');
  if (native) await keys('ctrl+ up+ up- 1+ 1- ctrl-');
  else { await hotkey(['shortcut', 'verbatim']); await page.waitForTimeout(150); await hotkey(['shortcut-mode', 'clean']); }
  await page.waitForFunction(() => document.querySelector('#record').textContent === 'Aufnahme beenden', {}, {timeout: 15000});
  await page.waitForFunction(() => document.querySelector('#mode').value === 'clean', {}, {timeout: 5000});
  console.log('PASS: Ctrl+Up+1 started a dictation in Überarbeiten:', await page.locator('#status').textContent());
  await page.waitForTimeout(5000);
  if (native) await keys('ctrl+ up+ up- ctrl-'); else await hotkey(['shortcut', 'verbatim']);
  await page.waitForFunction(text => document.querySelector('#result').value === text, rewritten, {timeout: 90000}).catch(async error => {
    console.log('Status:', await page.locator('#status').textContent(), '| Text:', await page.locator('#result').inputValue(),
      '| Knopf:', await page.locator('#record').textContent(), '| LLM-Anfragen:', requests.length);
    throw error;
  });
  assert.equal(requests.length, 1);
  // The fake microphone loops the test file, so the recording may begin mid-sentence.
  assert.match(requests[0].messages.at(-1).content, /speech recognition test|meeting starts tomorrow/i);
  console.log('PASS: Ctrl+Up stopped it; the text went through the Überarbeiten rewrite:', await page.locator('#result').inputValue());
  assert.equal((await page.evaluate(() => window.blitz.load())).settings.mode, 'verbatim'); // The saved default stays.
  console.log(native ? 'PASS: real keystrokes -> recorded shortcut fields -> key sequence picks the writing mode'
    : 'PASS (synthetic keys, Windows hotkeys not involved): recorded shortcut fields -> mode switch -> rewrite');
} finally {
  keyboard?.stdin.end(); await app.close(); server.close();
}
