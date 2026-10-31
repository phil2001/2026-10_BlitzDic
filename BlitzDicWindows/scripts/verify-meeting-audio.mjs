import { _electron as electron } from 'playwright';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '..');
const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({args: [root, `--user-data-dir=${root}/.runtime/meeting-audio-${Date.now()}`,
  '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
  `--use-file-for-fake-audio-capture=${root}/.runtime/test-speech.wav`], env});
try {
  const page = await app.firstWindow(); await page.waitForSelector('#provider option', {state: 'attached'});
  await page.locator('nav button[data-page="meetings"]').click();
  for (const preset of ['whisper', 'parakeet-ultra']) {
    await page.evaluate(async preset => {
      const {settings} = await window.blitz.load(); settings.speech.preset = preset;
      await window.blitz.settings(settings); document.querySelector('#meeting-transcript').value = '';
    }, preset);
    await page.locator('#meeting-record').click();
    await page.waitForFunction(() => document.querySelector('#meeting-record').textContent.startsWith('Aufnahme beenden'));
    await new Promise(resolve => setTimeout(resolve, 6200));
    await page.locator('#meeting-record').click();
    await page.waitForFunction(() => document.querySelector('#meeting-transcript').value.includes('local speech recognition test'), {}, {timeout: 60000});
    assert.equal((await page.evaluate(() => window.blitz.load())).history.length, 0);
    assert.equal((await page.evaluate(() => window.blitz.meetings())).length, 0);
    assert.equal(await page.locator('#meeting-result').inputValue(), '');
    console.log(`PASS: meeting microphone -> ${preset} -> transcript, no automatic summary or persistent history`);
  }
} finally { await app.close(); }
