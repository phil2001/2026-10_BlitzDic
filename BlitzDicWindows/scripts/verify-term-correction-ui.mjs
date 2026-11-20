// Real app, real model, real Windows spell checker: a German medical recording is imported,
// near-miss terms are corrected and listed under the text; switched off, the text stays raw.
// Usage: node scripts/verify-term-correction-ui.mjs <recording.wav> [expected change, e.g. "Apexaban → Apixaban"]
// Set BLITZDIC_TEST_EXECUTABLE to a built BlitzDic.exe to check the package instead of the source.
import {_electron as electron} from 'playwright';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '..');
const [audio, expected] = process.argv.slice(2);
if (!audio) throw new Error('Pfad zu einer deutschen medizinischen Testaufnahme angeben.');
const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE;
const executablePath = process.env.BLITZDIC_TEST_EXECUTABLE;
const profile = `--user-data-dir=${root}/.runtime/term-correction-ui-${Date.now()}`;
const app = await electron.launch(executablePath ? {executablePath, args: [profile], env} : {args: [root, profile], env});
try {
  const page = await app.firstWindow(); await page.waitForSelector('#provider option', {state: 'attached'});
  if (executablePath) console.log('Gebaute App:', await app.evaluate(({app}) => `${app.getVersion()}, gepackt: ${app.isPackaged}`));
  // New settings: Parakeet, Medizinisches Deutsch with the dictionary, correction on.
  assert.equal(await page.locator('#speech-model').inputValue(), 'parakeet-ultra');
  assert.equal(await page.locator('#speech-language').isDisabled(), false);
  assert.match(await page.locator('#speech-language-hint').textContent(), /medizinischen Wörterbuch/);
  assert.match(await page.locator('#processing-location').textContent(), /Parakeet Ultra · Sprache automatisch · Medizinisches Wörterbuch/);
  assert.equal(await page.locator('#term-correction').isChecked(), true);
  await app.evaluate(({dialog}, file) => { dialog.showOpenDialog = async () => ({canceled: false, filePaths: [file]}); }, resolve(audio));
  const transcribe = async () => {
    await page.locator('#result').fill('');
    await page.locator('#import').click();
    await page.waitForFunction(() => document.querySelector('#result').value.trim() && !document.querySelector('#import').disabled, {}, {timeout: 180000});
    return {text: await page.locator('#result').inputValue(), note: await page.locator('#corrections').isVisible() ? await page.locator('#corrections').textContent() : ''};
  };
  const corrected = await transcribe();
  console.log('Mit Korrektur:', corrected.text, '|', corrected.note || '(keine Anpassung)', '|', await page.locator('#status').textContent());
  assert.doesNotMatch(await page.locator('#status').textContent(), /Rechtschreibprüfung/);
  if (expected) assert.ok(corrected.note.includes(expected), `Erwartet: ${expected}`);
  await page.locator('nav button[data-page="settings"]').click();
  await page.locator('#term-correction').uncheck(); await page.locator('#save-settings').click();
  await page.waitForFunction(() => document.querySelector('#status').textContent === 'Einstellungen gespeichert.');
  await page.locator('nav button[data-page="dictation"]').click();
  const raw = await transcribe();
  console.log('Ohne Korrektur:', raw.text);
  assert.equal(raw.note, '');
  if (expected) assert.ok(raw.text.includes(expected.split(' → ')[0]), 'Ohne Korrektur bleibt der erkannte Begriff stehen.');
  console.log('PASS: Parakeet default -> import -> guarded correction listed under the text -> switched off stays raw');
} finally { await app.close(); }
