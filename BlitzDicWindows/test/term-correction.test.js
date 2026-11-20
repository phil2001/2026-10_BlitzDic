import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCorrector, correctRecognized, medicalLexicon, parseLexicon, termCorrector } from '../src/term-correction.js';
import { defaultSettings } from '../src/store.js';

const { terms, protect } = medicalLexicon();
const medical = createCorrector(terms, { protect });
const fixed = text => medical.correct(text).text;

test('near-miss terms are corrected, keeping sentence capitals', () => {
  const { text, changes } = medical.correct('Unter Metoprool und Apexaban zeigt sich eine Cholezystolithiasis.');
  assert.equal(text, 'Unter Metoprolol und Apixaban zeigt sich eine Cholezystolithiasis.');
  assert.deepEqual(changes, [{ from: 'Metoprool', to: 'Metoprolol' }, { from: 'Apexaban', to: 'Apixaban' }]);
  assert.equal(fixed('Feinblasig, Druckdolennt. Druckdolennt, Labor chemisch.'), 'Feinblasig, druckdolent. Druckdolent, laborchemisch.');
});

test('the word form stays: no new ending, no adjective turned into a noun', () => {
  for (const text of ['Depression', 'bronchoskopisch', 'lymphozytäre Infiltrate', 'extracraniellen Gefäße', 'Apexabans'])
    assert.equal(fixed(text), text);
});

test('known and inflected terms stay as dictated', () => {
  for (const text of ['Das Abdomen ist druckdolentes Gebiet.', 'Mehrere Pneumonien, eine Parese, keine Paresen.',
    'Sonografisch und sonographisch, Zystitis und Cystitis.']) assert.equal(fixed(text), text);
});

test('a split compound is joined only from two unknown words', () => {
  assert.equal(fixed('Bekanntes Vorhof flimmern.'), 'Bekanntes Vorhofflimmern.');
  for (const text of ['Die Niereninsuffizienz ist bekannt.', 'Palpitationen bei Belastung.', 'Bei der Auskultation finden sich Geräusche.'])
    assert.equal(fixed(text), text);
});

test('medical counterparts are both listed and never turned into each other', () => {
  const pairs = [['Hyperkaliämie', 'Hypokaliämie'], ['Hypernatriämie', 'Hyponatriämie'], ['Hyperglykämie', 'Hypoglykämie'],
    ['Hyperthyreose', 'Hypothyreose'], ['Hypertonie', 'Hypotonie'], ['Dysphagie', 'Dysphasie'], ['Abduktion', 'Adduktion'],
    ['Intubation', 'Extubation'], ['Inspiration', 'Exspiration'], ['Hypästhesie', 'Hyperästhesie'], ['Arthritis', 'Arteriitis'],
    ['intrakraniell', 'extrakraniell'], ['Pronation', 'Supination'], ['Tachykardie', 'Bradykardie']];
  const listed = new Set(terms.map(term => term.toLocaleLowerCase('de')));
  for (const pair of pairs) for (const term of pair) {
    assert.ok(listed.has(term.toLocaleLowerCase('de')), `${term} fehlt im Wörterbuch`);
    assert.equal(fixed(`Befund: ${term}.`), `Befund: ${term}.`);
  }
});

test('everyday German, acronyms and short words are left alone', () => {
  const text = 'Die Patientin kam kausal begründet; das Verbrechen, die Sicherheit, neurologisch unauffällig, EKG, Ileus, Inspektion, Infektion.';
  assert.equal(fixed(text), text);
});

test('two equally close terms leave the word unchanged', () => {
  const corrector = createCorrector(['Abcdefgh', 'Abcdxfgh']);
  assert.deepEqual(corrector.correct('Abcdyfgh').changes, []);
  assert.equal(createCorrector(['Abcdefgh']).correct('Abcdyfgh').text, 'Abcdefgh');
});

test('protected words are never the result of a correction', () => {
  const corrector = createCorrector(['ventral'], { protect: ['zentral'] });
  assert.equal(corrector.correct('zentral').text, 'zentral');
  assert.equal(corrector.correct('wentral').text, 'ventral');
  assert.deepEqual(parseLexicon('# Kommentar\nApixaban\n!zentral # Alltagswort\n'), { terms: ['Apixaban'], protect: ['zentral'] });
});

test('settings choose the dictionary: own terms always, medical only for Medizinisches Deutsch', () => {
  const settings = defaultSettings();
  assert.equal(settings.speech.preset, 'parakeet-ultra');
  assert.equal(settings.termCorrection, true);
  assert.equal(termCorrector({ ...settings, termCorrection: false }), null);
  assert.equal(termCorrector({ ...settings, speech: { ...settings.speech, language: 'de' } }), null);
  assert.equal(termCorrector(settings).correct('Metoprool').text, 'Metoprolol');
  const english = { ...settings, speech: { ...settings.speech, language: 'en' }, modeSettings: { customTerms: ['Dr. Brunnhuber'] } };
  assert.equal(termCorrector(english).correct('Brunhuber and Metoprool').text, 'Brunnhuber and Metoprool');
});

// Stands in for the Windows spell checker: these words count as correctly spelled.
const spelledRight = new Set(['Mobilität', 'Vorhof', 'flimmern', 'zentral', 'Weiter', 'mit']);
const misspelled = async words => words.filter(word => !spelledRight.has(word));

test('only words the spell checker rejects are corrected', async () => {
  const asked = [];
  const result = await correctRecognized({ text: 'Mobilität und zentral, dazu Apexaban.' }, defaultSettings(),
    { misspelled: async words => { asked.push(...words); return misspelled(words); } });
  assert.equal(result.text, 'Mobilität und zentral, dazu Apixaban.');
  assert.deepEqual(result.corrections, [{ from: 'Apexaban', to: 'Apixaban' }]);
  assert.deepEqual(asked.sort(), ['Apexaban', 'Mobilität', 'zentral']);
});

test('two correct words are joined only into exactly a listed term', async () => {
  const result = await correctRecognized({ text: 'Bekanntes Vorhof flimmern.' }, defaultSettings(), { misspelled });
  assert.equal(result.text, 'Bekanntes Vorhofflimmern.');
});

test('without a spell checker nothing is changed, and the caller is told', async () => {
  for (const options of [{}, { misspelled: async () => { throw new Error('fehlt'); } }]) {
    const result = await correctRecognized({ text: 'Weiter mit Apexaban.' }, defaultSettings(), options);
    assert.equal(result.text, 'Weiter mit Apexaban.');
    assert.equal(result.correctionSkipped, true);
  }
  const plain = await correctRecognized({ text: 'Weiter mit Apixaban.' }, defaultSettings(), {});
  assert.equal(plain.correctionSkipped, undefined);  // Nothing proposed, nothing to report.
});

test('own terms such as brand names are corrected too, in text and segments', async () => {
  const settings = { ...defaultSettings(), modeSettings: { customTerms: ['Xarelto'] } };
  const result = await correctRecognized({ text: 'Weiter mit Xarrelto.', segments: [{ start: 0, end: 1, text: 'Weiter mit Xarrelto.' }] }, settings, { misspelled });
  assert.equal(result.text, 'Weiter mit Xarelto.');
  assert.equal(result.segments[0].text, 'Weiter mit Xarelto.');
  assert.deepEqual(result.corrections, [{ from: 'Xarrelto', to: 'Xarelto' }]);
});

test('dictionary file has no word that is both a term and protected', () => {
  const parsed = parseLexicon(readFileSync(new URL('../src/medical-terms-de.txt', import.meta.url), 'utf8'));
  const listed = new Set(parsed.terms.map(term => term.toLocaleLowerCase('de')));
  assert.deepEqual(parsed.protect.filter(word => listed.has(word.toLocaleLowerCase('de'))), []);
  assert.ok(parsed.terms.length > 1000);
});

test('a long meeting transcript is corrected quickly', () => {
  const words = Array.from({ length: 20000 }, (_, index) => `Befundwort${(index * 7919).toString(36)}`);
  const started = performance.now();
  medical.correct(words.join(' '));
  assert.ok(performance.now() - started < 3000);
});
