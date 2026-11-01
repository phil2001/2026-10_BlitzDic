import test from 'node:test';
import assert from 'node:assert/strict';
import { fitInsertion } from '../src/insertion-fit.js';

test('dictation fits sentence starts and joins words around the cursor', () => {
  assert.equal(fitInsertion('hallo.', '', ''), 'Hallo.');
  assert.equal(fitInsertion('und dann.', 'Ich gehe heim', ''), ' und dann.');
  assert.equal(fitInsertion('Und dann.', 'Ich gehe heim ', ''), 'und dann.');
  assert.equal(fitInsertion('hallo', 'Fertig. ', ''), 'Hallo');
  assert.equal(fitInsertion('hallo', 'Zeile\n', ''), 'Hallo');
  assert.equal(fitInsertion('diesen Text.', 'Wir ergänzen ', 'im Satz.'), 'diesen Text ');
  assert.equal(fitInsertion('Hallo.', '', '.'), 'Hallo');
});

test('proper names, pronouns, abbreviations, whitespace and joiners stay intact', () => {
  for (const word of ['Sie', 'Ihr', 'I', 'Berlin', 'NVIDIA', 'Ärztin'])
    assert.equal(fitInsertion(word, 'Hier ', ''), word);
  assert.equal(fitInsertion('Mail', 'E-', ''), 'Mail');
  assert.equal(fitInsertion('und', 'gut -', ''), ' und');
  assert.equal(fitInsertion('Text', '„', '“'), 'Text');
  assert.equal(fitInsertion('Text', '"', '"'), 'Text');
  assert.equal(fitInsertion(', danke.', 'Hallo', ''), ', danke.');
  assert.equal(fitInsertion('usw.', 'wie ', 'auch hier'), 'usw. ');
  assert.equal(fitInsertion('Text.', 'Hier ', '\nweiter'), 'Text.');
  assert.equal(fitInsertion(' \n ', '', ''), ' \n ');
  assert.equal(fitInsertion('unverändert', null, null), 'unverändert');
  assert.equal(fitInsertion('🌍 Grüße', '', ''), '🌍 Grüße');
});
