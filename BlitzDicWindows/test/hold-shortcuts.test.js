import test from 'node:test';
import assert from 'node:assert/strict';
import {HoldShortcuts} from '../src/hold-shortcuts.js';
const deferred = () => {let resolve, reject; const promise = new Promise((yes, no) => {resolve = yes; reject = no;}); return {promise, resolve, reject};};
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  const release = deferred(), events = [], signals = [];
  const owner = new HoldShortcuts({wait: (_shortcut, signal) => {signals.push(signal); return release.promise;},
    start: (token, mode) => events.push(['start', token, mode]), stop: token => events.push(['stop', token]),
    discard: () => events.push(['discard']), tooShort: () => events.push(['short']),
    error: token => events.push(['error', token])});
  return {owner, release, events, signals};
}
test('one hold gesture starts once, ignores repeat, and stops once on release', async () => {
  const {owner, release, events} = fixture();
  assert.doesNotThrow(() => owner.cancel());
  await owner.press('Ctrl+1', async () => 'clean');
  await owner.press('Ctrl+1', async () => assert.fail('repeat prepared twice'));
  assert.deepEqual(events, [['start', 1, 'clean']]);
  release.resolve(); await tick(); assert.deepEqual(events, [['start', 1, 'clean'], ['stop', 1]]);
  assert.equal(owner.active, null);
  assert.doesNotThrow(() => owner.cancel());
});
test('release during target preparation never starts recording', async () => {
  const {owner, release, events} = fixture(), preparation = deferred();
  const pending = owner.press('Ctrl+1', () => preparation.promise);
  release.resolve(); await tick(); assert.notEqual(owner.active, null);
  preparation.resolve('verbatim'); await pending;
  assert.deepEqual(events, [['discard'], ['short']]); assert.equal(owner.active, null);
});
test('cancelled holds stay guarded until key-up and cannot stop a later manual recording', async () => {
  const {owner, release, events} = fixture();
  await owner.press('Ctrl+1', async () => 'verbatim');
  owner.cancel(999); assert.equal(owner.active.cancelled, false);
  owner.cancel(); await owner.press('Ctrl+2', async () => assert.fail('cancelled keys still held'));
  release.resolve(); await tick();
  assert.deepEqual(events, [['start', 1, 'verbatim']]); assert.equal(owner.active, null);
});
test('cancel while preparing plus early key-up leaves no stranded gesture', async () => {
  const {owner, release, events} = fixture(), preparation = deferred();
  const pending = owner.press('Ctrl+1', () => preparation.promise);
  owner.cancel(); release.resolve(); await tick(); preparation.resolve(null); await pending;
  assert.deepEqual(events, [['discard']]); assert.equal(owner.active, null);
});
test('worker failure invalidates its own preparation; cancellation suppresses late errors', async () => {
  const {owner, release, events} = fixture(), preparation = deferred();
  const pending = owner.press('Ctrl+1', () => preparation.promise);
  release.reject(new Error('unavailable')); await tick(); preparation.resolve('verbatim'); await pending;
  assert.deepEqual(events, [['discard'], ['error', 1]]);
  const second = fixture(); await second.owner.press('Ctrl+1', async () => 'verbatim');
  second.owner.cancel(); second.release.reject(new Error('late failure')); await tick();
  assert.deepEqual(second.events, [['start', 1, 'verbatim'], ['discard']]);
});
test('app shutdown aborts the watcher and ignores late callbacks', async () => {
  const {owner, release, events, signals} = fixture();
  await owner.press('Ctrl+1', async () => 'verbatim'); owner.destroy();
  assert.equal(signals[0].aborted, true); release.resolve(); await tick();
  assert.deepEqual(events, [['start', 1, 'verbatim']]);
});
