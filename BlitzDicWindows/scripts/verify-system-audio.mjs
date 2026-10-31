import {_electron as electron} from 'playwright';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '..');
const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({args: [root, `--user-data-dir=${root}/.runtime/system-audio-${Date.now()}`], env});
try {
  const page = await app.firstWindow(); await page.waitForSelector('#provider option', {state: 'attached'});
  await page.locator('nav button[data-page="meetings"]').click();
  await page.locator('#meeting-source').selectOption('system');
  await page.locator('#meeting-record').click();
  await page.waitForFunction(() => document.querySelector('#meeting-record').textContent.startsWith('Aufnahme beenden'), {}, {timeout: 15000});
  // A short, quiet test tone on the real Windows audio output. No audio file or
  // real meeting content is recorded or transcribed by this test.
  await page.evaluate(async () => {
    const context = new AudioContext(); const oscillator = context.createOscillator();
    const gain = context.createGain(); gain.gain.value = 0.03;
    oscillator.connect(gain); gain.connect(context.destination); oscillator.start();
    window.testToneContext = context; window.testToneOscillator = oscillator;
    await context.resume();
  });
  await page.waitForFunction(() => document.querySelector('#meeting-level').value > 0.001, {}, {timeout: 10000});
  await page.evaluate(async () => { window.testToneOscillator.stop(); await window.testToneContext.close(); });
  await page.locator('#meeting-cancel').click();
  await page.waitForFunction(() => document.querySelector('#meeting-record').textContent === 'Meeting aufnehmen');
  assert.equal((await page.evaluate(() => window.blitz.meetings())).length, 0);
  console.log('PASS: actual Windows system loopback -> AudioWorklet meter -> cancel without persistence');
} catch (error) {
  console.error('Status:', await (await app.firstWindow()).locator('#status').textContent()); throw error;
} finally { await app.close(); }
