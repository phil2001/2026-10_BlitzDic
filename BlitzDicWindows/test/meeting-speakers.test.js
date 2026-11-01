import test from 'node:test';
import assert from 'node:assert/strict';
import {meetingSpeakers, namedMeetingTranscript, normalizeSpeakerNames, speakerSectionHeading as header} from '../src/meeting-speakers.js';

test('speaker names stay scoped to recording sections and preserve utterances and overlap uncertainty', () => {
  const source = `Notes: Sprecher 1: unchanged\r\n${header}\r\nSprecher 1: Ich sage Sprecher 1: ausdrücklich.\r\nSprecher 1 / 2 (überlappend): Unklar.\r\n${header}\r\nSprecher 1: Andere Person.`;
  assert.deepEqual(meetingSpeakers(source), [{section: 1, speaker: 1}, {section: 1, speaker: 2}, {section: 2, speaker: 1}]);
  assert.equal(namedMeetingTranscript(source, [{section: 1, speaker: 1, name: ' Anna 🌍 '}]),
    `Notes: Sprecher 1: unchanged\r\n${header}\r\nAnna 🌍: Ich sage Sprecher 1: ausdrücklich.\r\nAnna 🌍 / Sprecher 2 (überlappend): Unklar.\r\n${header}\r\nSprecher 1: Andere Person.`);
  assert.equal(namedMeetingTranscript(source), source);
  assert.deepEqual(normalizeSpeakerNames(source, [{section: 2, speaker: 1, name: ' Bernd '}]), [{section: 2, speaker: 1, name: 'Bernd'}]);
});

test('invalid, stale, duplicate and multiline aliases cannot alter a transcript', () => {
  const source = 'Sprecher 1: Hallo.\nSprecher 20: Ende.';
  assert.deepEqual(meetingSpeakers(source), [{section: 0, speaker: 1}, {section: 0, speaker: 20}]);
  const alias = {section: 0, speaker: 1, name: 'Anna'};
  for (const names of [null, {}, [null], [{...alias, section: 1}], [{...alias, speaker: 2}],
    [alias, alias], [{...alias, name: 'A\nB'}], [{...alias, name: '\nAnna'}], [{...alias, name: 'A:B'}], [{...alias, name: 'A/B'}],
    [{...alias, name: ' '}], [{...alias, name: 'A'.repeat(81)}]])
    assert.throws(() => namedMeetingTranscript(source, names), /Sprecher/);
  assert.deepEqual(meetingSpeakers('Sprecher 21: unsupported\n Sprech er 1: no\nquoted Sprecher 1: no'), []);
});
