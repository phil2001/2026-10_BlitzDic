import {_electron as electron} from 'playwright';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '..');
const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({args: [root, `--user-data-dir=${root}/.runtime/real-meeting-ui-${Date.now()}`], env});
const transcript = 'Anna: Wir entscheiden uns für Angebot B. Das Budget beträgt 2500 Euro. '
  + 'Ben: Ich prüfe die technischen Unterlagen. Ein Abgabetermin wurde nicht vereinbart. '
  + 'Anna: Offen bleibt, ob die Lieferung nach Berlin möglich ist.';
try {
  const page = await app.firstWindow(); await page.waitForSelector('#provider option', {state: 'attached'});
  await page.evaluate(async config => {
    const {settings} = await window.blitz.load(); settings.provider = config; await window.blitz.settings(settings);
  }, {provider: 'lmstudio', location: 'local', baseURL: process.env.BLITZDIC_TEST_LLM_URL || 'http://127.0.0.1:1234/v1',
    model: process.env.BLITZDIC_TEST_LLM_MODEL || 'blitzdic-summary-test', apiKey: ''});
  await page.locator('nav button[data-page="meetings"]').click();
  await page.locator('#meeting-title').fill('Synthetischer lokaler Modelltest');
  await page.locator('#meeting-transcript').fill(transcript);
  await page.locator('#meeting-summarize').click();
  await page.waitForFunction(() => document.querySelector('#status').textContent === 'Meeting verschlüsselt gespeichert.' ||
    !document.querySelector('#meeting-summarize').disabled, {}, {timeout: 180000});
  assert.equal(await page.locator('#status').textContent(), 'Meeting verschlüsselt gespeichert.');
  const summary = await page.locator('#meeting-result').inputValue();
  assert.match(summary, /2[.,\s]?500/); assert.match(summary, /Angebot B/i);
  assert.match(summary.split(/Aufgaben\s*:?/i)[1]?.split(/Offene Fragen/i)[0] || '', /Ben/);
  assert.match(summary.split(/Offene Fragen\s*:?/i)[1] || '', /Berlin/);
  await page.reload(); await page.waitForSelector('#provider option', {state: 'attached'});
  await page.locator('nav button[data-page="meetings"]').click(); await page.locator('#meeting-list button').first().click();
  assert.equal(await page.locator('#meeting-transcript').inputValue(), transcript);
  assert.equal(await page.locator('#meeting-result').inputValue(), summary);
  console.log('PASS: real local model -> UI -> fact checks -> encrypted save -> exact reload');
} finally {await app.close();}
