import { _electron as electron } from 'playwright';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '..');
const requests = [];
const server = createServer(async (request, response) => {
  let body = ''; for await (const chunk of request) body += chunk;
  requests.push(JSON.parse(body)); response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify({choices: [{message: {content: 'Aufgaben: Anna bringt morgen die Unterlagen.'}, finish_reason: 'stop'}]}));
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({args: [root, `--user-data-dir=${root}/.runtime/meeting-test-${Date.now()}`], env});
try {
  const page = await app.firstWindow(); await page.waitForSelector('#provider option', {state: 'attached'});
  await page.evaluate(async url => {
    const {settings} = await window.blitz.load();
    settings.provider = {provider: 'ollama', location: 'local', model: 'test', baseURL: url, apiKey: ''};
    await window.blitz.settings(settings);
  }, `http://127.0.0.1:${server.address().port}/v1`);
  await page.locator('nav button[data-page="meetings"]').click();
  await page.locator('#meeting-title').fill('Planung');
  await page.locator('#meeting-transcript').fill('Anna bringt morgen die Unterlagen.');
  await page.locator('#meeting-save').click();
  await page.waitForFunction(() => document.querySelector('#status').textContent === 'Transkript lokal verschlüsselt gespeichert.');
  assert.equal(requests.length, 0);
  const local = await page.evaluate(() => window.blitz.meetings());
  assert.equal(local.length, 1); assert.equal(local[0].summary, '');
  assert.equal(local[0].transcript, 'Anna bringt morgen die Unterlagen.');
  await page.locator('#meeting-summarize').click();
  await page.waitForFunction(() => document.querySelector('#status').textContent === 'Meeting verschlüsselt gespeichert.');
  assert.match(await page.locator('#meeting-result').inputValue(), /Anna/);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].messages[1].content, 'Anna bringt morgen die Unterlagen.');
  await page.reload(); await page.waitForSelector('#provider option', {state: 'attached'});
  await page.locator('nav button[data-page="meetings"]').click();
  await page.locator('#meeting-list button').first().click();
  assert.equal(await page.locator('#meeting-title').inputValue(), 'Planung');
  assert.equal(await page.locator('#meeting-transcript').inputValue(), 'Anna bringt morgen die Unterlagen.');
  assert.match(await page.locator('#meeting-result').inputValue(), /Anna/);
  console.log('PASS: meeting UI -> local mock provider -> encrypted persistence -> reload original and summary');
} finally { await app.close(); await new Promise(resolve => server.close(resolve)); }
