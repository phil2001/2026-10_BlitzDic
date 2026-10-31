import { _electron as electron } from 'playwright';
import { resolve, dirname } from 'node:path';
import { access, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '..');
const executablePath = process.env.BLITZDIC_TEST_EXECUTABLE;
if (!executablePath) throw new Error('BLITZDIC_TEST_EXECUTABLE muss auf die installierte BlitzDic.exe zeigen.');
const resources = resolve(dirname(executablePath), 'resources');
for (const relative of ['models/whisper/model.bin', 'models/parakeet-ultra/encoder-model.int8.onnx',
  'models/parakeet-ultra/decoder_joint-model.int8.onnx', 'speech-runtime/blitzdic-speech.exe',
  'speech-runtime/_internal/uia_target.ps1', 'licenses/dependencies/inventory.json'])
  await access(resolve(resources, relative));
const inventory = JSON.parse(await readFile(resolve(resources, 'licenses/dependencies/inventory.json'), 'utf8'));
assert.deepEqual(inventory.missingPackageNotices, []);
const nativeMap = JSON.parse(await readFile(resolve(resources, 'licenses/dependencies/native-package-map.json'), 'utf8'));
assert.deepEqual(nativeMap.unresolvedBuildOrigins, []);
assert.deepEqual(nativeMap.externalBuildOrigins, []);
console.log('Verified native origins:', nativeMap.files.length);
const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({executablePath,
  args: [`--user-data-dir=${root}/.runtime/installed-smoke-${Date.now()}`], env});
try {
  const page = await app.firstWindow();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.waitForSelector('#provider option', {state: 'attached'});
  assert.equal((await page.evaluate(() => window.blitz.load())).modelsBundled, true);
  assert.equal(await app.evaluate(({app}) => app.isPackaged), true);
  console.log('Packaged version:', await app.evaluate(({app}) => app.getVersion()));
  await page.locator('nav button[data-page="meetings"]').click();
  assert.equal(await page.locator('#meeting-source option').count(), 3);
  await page.screenshot({path: `${root}/.runtime/packaged-meetings.png`});
  await page.locator('nav button[data-page="settings"]').click();
  await page.locator('#app-mode-rules').waitFor({state: 'visible'});
  await page.locator('nav button[data-page="dictation"]').click();
  await app.evaluate(({dialog}, file) => {
    dialog.showOpenDialog = async () => ({canceled: false, filePaths: [file]});
  }, `${root}/.runtime/test-speech.wav`);
  for (const preset of ['whisper', 'parakeet-ultra']) {
    await page.evaluate(async preset => {
      const {settings} = await window.blitz.load(); settings.speech.preset = preset;
      await window.blitz.settings(settings);
      document.querySelector('#result').value = '';
    }, preset);
    await page.locator('#import').click();
    await page.waitForFunction(() => document.querySelector('#result').value.includes('local speech recognition test'), {}, {timeout: 60000});
    console.log(`PASS: installed ${preset}: ${await page.locator('#result').inputValue()}`);
  }
  assert.deepEqual(errors, []);
  console.log('PASS: installed app, fresh profile, both bundled models and speech runtime');
} finally { await app.close(); }
