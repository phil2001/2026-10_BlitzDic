import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAppModes, modeForApp } from '../src/app-modes.js';

test('app modes match exact executable names and preserve explicit mode shortcuts', () => {
  const rules = parseAppModes('WINWORD.EXE => clean\nchrome.exe => emoji');
  assert.equal(modeForApp('verbatim', 'WinWord.exe', rules), 'clean');
  assert.equal(modeForApp('calm', 'winword.exe', rules), 'calm');
  assert.equal(modeForApp('verbatim', 'evil-winword.exe', rules), 'verbatim');
  assert.equal(modeForApp('verbatim', '', rules), 'verbatim');
  assert.throws(() => parseAppModes('word.exe => unknown'));
  assert.throws(() => parseAppModes('word.exe => clean\nWORD.exe => calm'));
  assert.throws(() => parseAppModes('C:\\word.exe => clean'));
  assert.equal(modeForApp('verbatim', 'word.exe', [{executable: 'word.exe', mode: 'unknown'}]), 'verbatim');
});
