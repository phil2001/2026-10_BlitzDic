import { _electron as electron } from 'playwright';
import { resolve, dirname, sep } from 'node:path';
import { access, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
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
const avPackage = inventory.packages.find(item => item.name === 'av');
assert.equal(avPackage.version, '16.0.1+blitzdic.1');
const ffmpegSource = resolve(resources, 'licenses/dependencies/python-packages', `av-${avPackage.version}`,
  `av-${avPackage.version}.dist-info/licenses/blitzdic-ffmpeg/ffmpeg-8.0.3.tar.xz`);
assert.equal(createHash('sha256').update(await readFile(ffmpegSource)).digest('hex'),
  '6136812ea6d4e68bdba27e33c2a94382711cdf4f8602ffef056ff792bd6f9818');
const nativeInventory = JSON.parse(await readFile(resolve(resources, 'licenses/dependencies/native-binaries.json'), 'utf8'));
assert.equal(nativeInventory.cleanFfmpegGatePassed, true);
assert.ok(nativeInventory.ffmpegReports.every(report => report.license === 'LGPL version 2.1 or later'));
const nativeMap = JSON.parse(await readFile(resolve(resources, 'licenses/dependencies/native-package-map.json'), 'utf8'));
assert.deepEqual(nativeMap.unresolvedBuildOrigins, []);
assert.deepEqual(nativeMap.externalBuildOrigins, []);
assert.ok(nativeMap.files.every(item => !/libsndfile|_cffi_backend|cudnn64/i.test(item.path)),
  'CPU package unexpectedly includes removed audio/GPU libraries');
const licenseRoot = resolve(resources, 'licenses/dependencies');
for (const item of inventory.packages.flatMap(pkg => pkg.files)) {
  const path = resolve(licenseRoot, item.path);
  assert.ok(path.startsWith(licenseRoot + sep));
  assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'), item.sha256);
}
const openmp = JSON.parse(await readFile(resolve(licenseRoot, 'native/intel-openmp/provenance.json'), 'utf8'));
assert.equal(createHash('sha256').update(await readFile(resolve(licenseRoot, 'native/intel-openmp', openmp.notice.file))).digest('hex'), openmp.notice.sha256);
assert.equal(nativeMap.files.find(item => item.path.toLowerCase().endsWith('/ctranslate2/libiomp5md.dll')).sha256, openmp.dllSha256);
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
  await app.evaluate(({shell}) => { shell.openPath = async path => { globalThis.blitzLicenseTestPath = path; return ''; }; });
  assert.match(await page.locator('#app-version').textContent(), /LGPL v2.1/);
  await page.locator('#licenses-open').click();
  await page.waitForTimeout(100);
  assert.equal(await app.evaluate(() => globalThis.blitzLicenseTestPath), resolve(resources, 'licenses'));
  console.log('PASS: bundled corresponding FFmpeg source, clean runtime inventory and scoped license-folder button');
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
