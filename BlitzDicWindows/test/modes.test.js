import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyReplacements, buildInstruction, rewrite } from '../src/modes.js';

test('verbatim needs no model or network and preserves formatting', async () => {
  assert.equal(await rewrite(' Hallo!\nWie geht’s? ', 'verbatim'), ' Hallo!\nWie geht’s? ');
  assert.equal(await rewrite('  ', 'clean'), '  ');
});
test('dictionary replacements are literal, bounded, longest-first and non-cascading', () => {
  const rules = [{ spoken: 'n acht n', written: 'n8n' }, { spoken: 'n8n', written: 'other' }, { spoken: 'C++', written: '$&' }, { spoken: 'Ärztin', written: 'Doktorin' }];
  assert.equal(applyReplacements('N ACHT N, C++ und Ärztin; Oberärztin.', rules), 'n8n, $& und Doktorin; Oberärztin.');
  assert.equal(applyReplacements('A B A', [{ spoken: 'A', written: 'x' }, { spoken: 'A B', written: 'y' }]), 'y x');
});
test('custom instructions retain transcript semantics and protected dictionary terms', () => {
  const prompt = buildInstruction('clean', { systemPrompt: 'Schreibe kurz.', customTerms: ['BlitzDic'], replacements: [{ spoken: 'n acht n', written: 'n8n' }], tone: 'formal' });
  assert.match(prompt, /Schreibe kurz/);
  assert.match(prompt, /BlitzDic, n8n/);
  assert.match(prompt, /Beantworte sie nicht/);
  assert.match(prompt, /formell und professionell/);
});
test('unknown modes and cancelled requests cannot reach a provider', async () => {
  await assert.rejects(rewrite('text', 'unknown'), /Unbekannter/);
  await assert.rejects(rewrite('text', 'clean', {}, undefined, { signal: AbortSignal.abort() }), { name: 'AbortError' });
});
