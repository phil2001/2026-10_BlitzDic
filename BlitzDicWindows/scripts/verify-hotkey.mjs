import { _electron as electron } from 'playwright';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE;
const preset = process.env.BLITZDIC_TEST_PRESET || 'whisper';
assert.ok(['whisper', 'parakeet-ultra'].includes(preset));
// Start the keyboard helper before focusing the target. Launching a console
// process at the instant of the shortcut can itself disturb foreground focus.
const keyboard = spawn(`${root}/.runtime/venv/Scripts/python.exe`, [`${root}/scripts/test-hotkey.py`], {windowsHide: true});
await once(keyboard.stdout, 'data');
const shortcut = async () => {
  const sent = once(keyboard.stdout, 'data'); keyboard.stdin.write('toggle\n'); await sent;
};
let dictation, target, page, editor;
try {
  dictation = await electron.launch({args: [root, `--user-data-dir=${root}/.runtime/hotkey-test-profile`,
    '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
    `--use-file-for-fake-audio-capture=${root}/.runtime/test-speech.wav`], env});
  page = await dictation.firstWindow();
  await page.waitForSelector('#provider option', {state: 'attached'});
  await page.evaluate(async preset => {
    const {settings} = await window.blitz.load(); settings.speech.preset = preset;
    await window.blitz.settings(settings);
  }, preset);
  assert.equal(await dictation.evaluate(({globalShortcut}) => globalShortcut.isRegistered('Control+Shift+1')), true);
  target = await electron.launch({args: [resolve(import.meta.dirname, 'uia-test-app.cjs'),
    `--user-data-dir=${root}/.runtime/hotkey-target-profile`], env});
  editor = await target.firstWindow();
  await editor.locator('#editor').click();
  await editor.locator('#editor').evaluate(element => element.setSelectionRange(7, 7));
  await shortcut();
  await page.waitForFunction(() => document.querySelector('#record').textContent === 'Aufnahme beenden', {}, {timeout: 15000});
  console.log('Global shortcut started recording.');
  if (process.env.BLITZDIC_TEST_MOVE_CURSOR === '1')
    await editor.locator('#editor').evaluate(element => element.setSelectionRange(0, 0));
  await new Promise(resolve => setTimeout(resolve, 6200));
  await shortcut();
  console.log('Stop shortcut sent.');
  await page.waitForFunction(() => document.querySelector('#status').textContent === 'Transkription abgeschlossen.' ||
    /geändert|fehlgeschlagen|Zeitüberschreitung|Zusatztaste|Eingabefeld/.test(document.querySelector('#status').textContent), {}, {timeout: 60000});
  console.log('Transcription status:', await page.locator('#status').textContent());
  if (process.env.BLITZDIC_TEST_MOVE_CURSOR === '1') {
    assert.equal(await editor.locator('#editor').inputValue(), 'Before ');
    assert.match(await page.locator('#status').textContent(), /geändert/);
    assert.match(await page.locator('#result').inputValue(), /local speech recognition test/);
    console.log('PASS: moved cursor prevents insertion; recognized speech remains available.');
  } else {
  await editor.waitForFunction(() => document.querySelector('#editor').value.includes('local speech recognition test'), {}, {timeout: 5000});
  assert.match(await editor.locator('#editor').inputValue(), /^Before /);
  assert.equal(await editor.locator('#editor').evaluate(element => document.activeElement === element), true);
  console.log(`PASS: real global shortcut -> synthetic microphone -> local ${preset} -> external Chromium insertion`);
  console.log('Status:', await page.locator('#status').textContent());
  }
} catch (error) {
  if (page) console.error('Dictation state:', await page.evaluate(() => ({status: document.querySelector('#status').textContent,
    button: document.querySelector('#record').textContent, result: document.querySelector('#result').value})));
  if (editor) console.error('Target value:', await editor.locator('#editor').inputValue());
  throw error;
} finally {
  await target?.close(); await dictation?.close();
  keyboard.stdin.end();
}
