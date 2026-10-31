import {_electron as electron} from 'playwright';
import {resolve} from 'node:path';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {runSpeech} from '../src/speech.js';
const root = resolve(import.meta.dirname, '..');
const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE;
const fixture = (await readFile(`${root}/.runtime/test-speech.wav`)).toString('base64');
const app = await electron.launch({args: [root, `--user-data-dir=${root}/.runtime/system-comparison-${Date.now()}`], env});
try {
  const page = await app.firstWindow(); await page.waitForSelector('#provider option', {state: 'attached'});
  await page.evaluate(async () => {
    const {Recorder} = await import('../src/recorder.js');
    window.comparisonRecorder = new Recorder();
    const button = document.createElement('button'); button.id = 'comparison-start'; button.textContent = 'Test capture';
    button.onclick = async () => {
      try {window.comparisonReady = await window.comparisonRecorder.start('', {source: 'system'});}
      catch (error) {window.comparisonError = error.message;}
    };
    document.body.append(button);
  });
  await page.locator('#comparison-start').click();
  await page.waitForFunction(() => window.comparisonReady || window.comparisonError, {}, {timeout: 15000});
  assert.equal(await page.evaluate(() => window.comparisonError), undefined);
  const audioBase64 = await page.evaluate(async fixture => {
    const context = new AudioContext();
    try {
      const bytes = Uint8Array.from(atob(fixture), char => char.charCodeAt(0));
      const audio = await context.decodeAudioData(bytes.buffer);
      const player = context.createBufferSource(); player.buffer = audio;
      const gain = context.createGain(); gain.gain.value = 0.5;
      player.connect(gain); gain.connect(context.destination); await context.resume();
      await new Promise(resolve => {player.onended = resolve; player.start();});
      await new Promise(resolve => setTimeout(resolve, 700));
      const wav = new Uint8Array(window.comparisonRecorder.stop());
      let binary = '';
      for (let offset = 0; offset < wav.length; offset += 32768)
        binary += String.fromCharCode(...wav.subarray(offset, offset + 32768));
      return btoa(binary);
    } finally {window.comparisonRecorder.cancel(); await context.close();}
  }, fixture);
  const results = [];
  for (const preset of ['whisper', 'parakeet-ultra']) {
    const result = await runSpeech({action: 'transcribe', preset, modelDirectory: `${root}/models/${preset}`, audioBase64},
      {pythonPath: `${root}/.runtime/venv/Scripts/python.exe`});
    const evidence = {preset, expectedSentence: /local speech recognition test/i.test(result.text),
      expectedMeeting: /meeting starts tomorrow/i.test(result.text), characters: result.text.length};
    results.push(evidence); console.log(JSON.stringify(evidence));
  }
  assert.ok(results.every(result => result.expectedSentence && result.expectedMeeting),
    'Same captured audio did not yield the expected fixture phrases with both engines. No captured contents were saved.');
  console.log('PASS: both engines recognized the same in-memory Windows loopback capture');
} finally {await app.close();}
