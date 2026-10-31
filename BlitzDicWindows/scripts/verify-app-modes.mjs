import { _electron as electron } from 'playwright';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '..');
const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({args: [root, `--user-data-dir=${root}/.runtime/app-mode-test-profile`], env});
try {
  const page = await app.firstWindow();
  await page.waitForSelector('#provider option', {state: 'attached'});
  await page.locator('nav button[data-page="settings"]').click();
  await page.locator('#app-mode-rules').fill('WINWORD.EXE => clean\nchrome.exe => calm');
  await page.locator('#save-app-modes').click();
  await page.waitForFunction(() => document.querySelector('#status').textContent === 'Programmregeln gespeichert.');
  await page.reload();
  await page.waitForSelector('#provider option', {state: 'attached'});
  await page.locator('nav button[data-page="settings"]').click();
  assert.equal(await page.locator('#app-mode-rules').inputValue(), 'winword.exe => clean\nchrome.exe => calm');
  await page.locator('#app-mode-rules').fill('word.exe => unknown');
  await page.locator('#save-app-modes').click();
  await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Programmregeln:'));
  assert.equal((await page.evaluate(() => window.blitz.load())).settings.appModes[0].executable, 'winword.exe');
  console.log('PASS: program rules UI, encrypted persistence after reload, invalid mode rejected');
} finally { await app.close(); }
