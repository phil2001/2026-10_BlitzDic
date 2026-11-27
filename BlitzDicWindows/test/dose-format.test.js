import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDoses } from '../src/dose-format.js';
import { correctRecognized } from '../src/term-correction.js';
import { defaultSettings } from '../src/store.js';

const formatted = text => formatDoses(text).text;

test('intake schedules after a dose are written with hyphens', () => {
  // As Parakeet and Whisper wrote them for a spoken "eins null null" / "eins null eins".
  assert.equal(formatted('Ramipril 5 mg 100 Metformin 1000 mg 101'), 'Ramipril 5 mg 1-0-0 Metformin 1000 mg 1-0-1');
  assert.equal(formatted('Pantoprazol 40 mg 1 0 0 vor dem Frühstück.'), 'Pantoprazol 40 mg 1-0-0 vor dem Frühstück.');
  assert.equal(formatted('Insulin 4 Einheiten 1 0 1 0, Salbutamol 2 Hübe 2 0 2.'), 'Insulin 4 Einheiten 1-0-1-0, Salbutamol 2 Hübe 2-0-2.');
  assert.equal(formatted('Euthyrox 50 µg 1-0-0.'), 'Euthyrox 50 µg 1-0-0.');
  assert.equal(formatted('Concor 5mg 100, Lasix 40mg 1-0-0.'), 'Concor 5 mg 1-0-0, Lasix 40 mg 1-0-0.');  // Whisper with a profile
});

test('numbers that are no schedule stay', () => {
  for (const text of ['Ramipril 5 mg 100 Stück.', 'Ramipril 5 mg 2023 begonnen.', 'Ramipril 5 mg 1000 mg', 'Nach 100 Metern Atemnot.',
    'Metformin 500 mg 120 Tabletten', 'Bisoprolol 2,5 mg 1,25 mg', 'Gewicht 100 kg'])
    assert.equal(formatted(text), text);
});

test('units after a number are abbreviated, also with "pro"', () => {
  assert.equal(formatted('Kalium 4,1 Millimol pro Liter, Kreatinin 1,3 Milligramm pro Dezilliter.'), 'Kalium 4,1 mmol/l, Kreatinin 1,3 mg/dl.');
  assert.equal(formatted('Kalium 4,1 millimol pro Liter, Kreatinin 1,3 mg pro Deziliter.'), 'Kalium 4,1 mmol/l, Kreatinin 1,3 mg/dl.');
  assert.equal(formatted('Kreatinin 1,3mg pro Dezilitr.'), 'Kreatinin 1,3 mg/dl.');
  assert.equal(formatted('Euthyrox 50 Mikrogramm 100. Vitamin D 20.000 internationale Einheiten.'), 'Euthyrox 50 µg 1-0-0. Vitamin D 20.000 IE.');
  assert.equal(formatted('Puls 72 pro Minute, Blutdruck 135 zu 85, RR von 120 über 80.'), 'Puls 72/min, Blutdruck 135/85, RR von 120/80.');
  for (const text of ['Die Milligramm-Angabe fehlt.', 'Einmal pro Woche, dreimal täglich, 7 Tage.', 'Der Blutdruck stieg zu stark.', '8 Einheiten abends.'])
    assert.equal(formatted(text), text);
});

test('every change is reported', () => {
  assert.deepEqual(formatDoses('Ramipril 5 Milligramm 100.').changes, [{ from: 'Milligramm', to: 'mg' }, { from: '100', to: '1-0-0' }]);
  assert.deepEqual(formatDoses('Keine Medikation.').changes, []);
});

test('doses are formatted for Medizinisches Deutsch only, and only with the correction switched on', async () => {
  const recognized = { text: 'Ramipril 5 mg 100.', segments: [{ start: 0, end: 1, text: 'Ramipril 5 mg 100.' }] };
  const medical = await correctRecognized(recognized, defaultSettings(), {});
  assert.equal(medical.text, 'Ramipril 5 mg 1-0-0.');
  assert.equal(medical.segments[0].text, 'Ramipril 5 mg 1-0-0.');
  assert.deepEqual(medical.corrections, [{ from: '100', to: '1-0-0' }]);
  const settings = defaultSettings();
  for (const changed of [{ ...settings, termCorrection: false }, { ...settings, speech: { ...settings.speech, language: 'de' } }])
    assert.equal((await correctRecognized(recognized, changed, {})).text, 'Ramipril 5 mg 100.');
});
