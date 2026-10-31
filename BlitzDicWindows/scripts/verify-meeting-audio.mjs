import { _electron as electron } from 'playwright';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root = resolve(import.meta.dirname, '..');
const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE;
const executablePath = process.env.BLITZDIC_TEST_EXECUTABLE;
const source = process.env.BLITZDIC_TEST_AUDIO_SOURCE || 'microphone';
assert.ok(['microphone', 'system', 'both'].includes(source));
const fixture = source === 'microphone' ? null : (await readFile(`${root}/.runtime/test-speech.wav`)).toString('base64');
const app = await electron.launch({executablePath, args: [...(executablePath ? [] : [root]), `--user-data-dir=${root}/.runtime/meeting-audio-${Date.now()}`,
  ...(source === 'system' ? [] : ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
  `--use-file-for-fake-audio-capture=${root}/.runtime/test-speech.wav`])], env});
try {
  const page = await app.firstWindow(); await page.waitForSelector('#provider option', {state: 'attached'});
  const endSource = process.env.BLITZDIC_TEST_END_SOURCE === '1';
  if (endSource) await page.evaluate(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async options => {
      const stream = await original(options); window.blitzTestMic = stream; return stream;
    };
  });
  await page.locator('nav button[data-page="meetings"]').click();
  await page.locator('#meeting-source').selectOption(source);
  const diarize = process.env.BLITZDIC_TEST_DIARIZE === '1';
  if (diarize) {
    await page.locator('#meeting-diarize').check();
    await page.locator('#meeting-speaker-count').selectOption({label: '1'});
  }
  const presets = process.env.BLITZDIC_TEST_PRESET ? [process.env.BLITZDIC_TEST_PRESET] : ['whisper', 'parakeet-ultra'];
  for (const preset of presets) {
    assert.ok(['whisper', 'parakeet-ultra'].includes(preset));
    await page.evaluate(async preset => {
      const {settings} = await window.blitz.load(); settings.speech.preset = preset;
      await window.blitz.settings(settings); document.querySelector('#meeting-transcript').value = '';
    }, preset);
    await page.locator('#meeting-record').click();
    await page.waitForFunction(() => document.querySelector('#meeting-record').textContent.startsWith('Aufnahme beenden'));
    if (fixture) {
      // Play the known sentence through the real Windows output, not directly
      // into the recorder. The capture must obtain it through loopback.
      await page.evaluate(async base64 => {
        const context = new AudioContext();
        try {
          const data = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
          const buffer = await context.decodeAudioData(data.buffer);
          const player = context.createBufferSource(); player.buffer = buffer;
          const gain = context.createGain(); gain.gain.value = 0.5;
          player.connect(gain); gain.connect(context.destination);
          await context.resume();
          await new Promise(resolve => {player.onended = resolve; player.start();});
          await new Promise(resolve => setTimeout(resolve, 500));
        } finally {await context.close();}
      }, fixture);
    } else await new Promise(resolve => setTimeout(resolve, 6200));
    if (endSource) await page.evaluate(() => {
      const track = window.blitzTestMic.getAudioTracks()[0];
      track.dispatchEvent(new Event('ended'));
      track.dispatchEvent(new Event('ended'));
    });
    else await page.locator('#meeting-record').click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Meeting lokal transkribiert.'), {}, {timeout: 60000});
    if (endSource) {
      assert.match(await page.locator('#status').textContent(), /Audioquelle wurde beendet/);
      assert.equal(await page.locator('#meeting-record').textContent(), 'Meeting aufnehmen');
    }
    assert.ok(/local speech recognition test/.test(await page.locator('#meeting-transcript').inputValue()),
      'Der erwartete Testsatz wurde nicht erkannt. Audioquelle und Umgebungswiedergabe prüfen.');
    assert.equal((await page.evaluate(() => window.blitz.load())).history.length, 0);
    assert.equal((await page.evaluate(() => window.blitz.meetings())).length, 0);
    assert.equal(await page.locator('#meeting-result').inputValue(), '');
    if (diarize) assert.match(await page.locator('#meeting-transcript').inputValue(), /Sprecher 1:/);
    console.log(`PASS: meeting ${source} -> ${preset} -> transcript, no automatic summary or persistent history`);
  }
  if (diarize) {
    const original = await page.locator('#meeting-transcript').inputValue();
    await page.locator('#meeting-save').click();
    await page.waitForFunction(() => document.querySelector('#status').textContent === 'Transkript lokal verschlüsselt gespeichert.');
    await page.reload(); await page.waitForSelector('#provider option', {state: 'attached'});
    await page.locator('nav button[data-page="meetings"]').click();
    await page.locator('#meeting-list button').first().click();
    assert.equal(await page.locator('#meeting-transcript').inputValue(), original);
    console.log('PASS: speaker-labeled meeting persists through encrypted save and reload');
  }
} catch (error) {
  const page = await app.firstWindow();
  console.error('Meeting status:', await page.locator('#status').textContent());
  console.error('Meeting transcript length:', (await page.locator('#meeting-transcript').inputValue()).length);
  throw error;
} finally { await app.close(); }
