import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseShortcut, formatShortcut, planShortcuts, checkRecordedShortcut, keyFromEvent, modifiersFromEvent, accelerator } from '../src/shortcuts.js';
import { ShortcutKeys } from '../src/shortcut-keys.js';

const defaults = {verbatim: 'Alt+Space', clean: 'Alt+Space+1', calm: 'Alt+Space+2', emoji: 'Alt+Space+3'};

test('shortcuts parse to canonical modifiers and one or two keys', () => {
  assert.deepEqual(parseShortcut('CommandOrControl+Shift+1'), {modifiers: ['Control', 'Shift'], keys: ['1']});
  assert.deepEqual(parseShortcut('shift+alt+space+1'), {modifiers: ['Alt', 'Shift'], keys: ['Space', '1']});
  assert.deepEqual(parseShortcut('Control+up'), {modifiers: ['Control'], keys: ['Up']});
  assert.deepEqual(parseShortcut('F9'), {modifiers: [], keys: ['F9']});
  for (const bad of ['', 'Alt+', 'Alt', 'Space+Alt', 'Alt+A+B+C', 'Alt+Space+Space', 'Alt+Escape', 'Alt+Esc+1', 'Strg+Up', 'Alt+ö'])
    assert.throws(() => parseShortcut(bad), undefined, bad);
});

test('shortcuts are shown with German key names', () => {
  assert.equal(formatShortcut('Alt+Space+1'), 'Alt + Leertaste + 1');
  assert.equal(formatShortcut('CommandOrControl+Shift+2'), 'Strg + Umschalt + 2');
  assert.equal(formatShortcut('Control+Up'), 'Strg + ↑');
  assert.equal(formatShortcut(''), 'Kein Kürzel');
  assert.equal(formatShortcut('kaputt+'), 'kaputt+');
});

test('the plan registers direct shortcuts and the first part of key sequences', () => {
  const plan = planShortcuts(defaults);
  assert.deepEqual([...plan.direct], [['Alt+Space', 'verbatim']]);
  assert.deepEqual([...plan.sequences.get('Alt+Space')], [['Alt+1', 'clean'], ['Alt+2', 'calm'], ['Alt+3', 'emoji']]);
  assert.deepEqual(plan.problems, []);
  // A sequence also works without a direct shortcut on its first part, and empty fields are skipped.
  const own = planShortcuts({verbatim: '', clean: 'Control+Up+1'});
  assert.equal(own.direct.size, 0);
  assert.equal(own.sequences.get('Control+Up').get('Control+1'), 'clean');
});

test('the plan reports duplicates and overlaps but keeps the other shortcuts', () => {
  assert.match(planShortcuts({verbatim: 'Alt+Space', clean: 'alt+space'}).problems[0], /doppelt/);
  assert.match(planShortcuts({verbatim: 'Alt+1', clean: 'Alt+Space+1'}).problems[0], /überschneidet sich mit Alt \+ 1/);
  const broken = planShortcuts({verbatim: 'Strg+Up', clean: 'Alt+Space+1'});
  assert.equal(broken.problems.length, 1);
  assert.equal(broken.sequences.get('Alt+Space').get('Alt+1'), 'clean');
});

test('recorded shortcuts must not block normal typing', () => {
  assert.throws(() => checkRecordedShortcut({modifiers: [], keys: ['A']}), /Strg, Alt oder Win/);
  assert.throws(() => checkRecordedShortcut({modifiers: ['Shift'], keys: ['1']}), /Strg, Alt oder Win/);
  assert.throws(() => checkRecordedShortcut({modifiers: ['Alt'], keys: []}));
  checkRecordedShortcut({modifiers: ['Alt'], keys: ['Space', '1']});
  checkRecordedShortcut({modifiers: [], keys: ['F9']});
});

test('pressed keys map to the Windows key, independent of the typed character', () => {
  assert.equal(keyFromEvent({keyCode: 32, key: ' '}), 'Space');
  assert.equal(keyFromEvent({keyCode: 49, key: '!'}), '1'); // Shift+1 on a German keyboard
  assert.equal(keyFromEvent({keyCode: 90, key: 'z'}), 'Z');
  assert.equal(keyFromEvent({keyCode: 38, key: 'ArrowUp'}), 'Up');
  assert.equal(keyFromEvent({keyCode: 120, key: 'F9'}), 'F9');
  assert.equal(keyFromEvent({keyCode: 97, key: '1'}), 'num1');
  assert.equal(keyFromEvent({keyCode: 187, key: '+'}), 'Plus');
  assert.equal(keyFromEvent({keyCode: 191, key: '#'}), '#');
  assert.equal(keyFromEvent({keyCode: 18, key: 'Alt'}), null);
  assert.throws(() => keyFromEvent({keyCode: 192, key: 'ö'}), /nicht als globales Kürzel/);
  assert.deepEqual(modifiersFromEvent({altKey: true, ctrlKey: true, shiftKey: false, metaKey: false}), ['Control', 'Alt']);
  assert.equal(accelerator(['Shift', 'Alt'], 'Space', '1'), 'Alt+Shift+Space+1');
});

function harness(taken = []) {
  let time = 1000; const timers = [];
  const registered = new Map(), events = [];
  const keys = new ShortcutKeys({
    register: (key, callback) => { if (taken.includes(key) || registered.has(key)) return false; registered.set(key, callback); return true; },
    unregister: key => registered.delete(key),
    press: (mode, key, gesture) => { events.push(['press', mode, key]); gesture.started = true; },
    choose: (mode, gesture) => { events.push(['choose', mode]); gesture.choice = mode; },
    captured: key => events.push(['captured', key]),
    now: () => time,
    setTimer: (callback, ms) => { const timer = {callback, at: time + ms}; timers.push(timer); return timer; },
    clearTimer: timer => { if (timer) timer.cleared = true; },
  });
  const hit = key => { assert.ok(registered.has(key), `${key} is registered`); registered.get(key)(); };
  const wait = ms => { time += ms; for (const timer of timers.splice(0)) if (!timer.cleared && timer.at <= time) timer.callback(); else timers.push(timer); };
  return {keys, registered, events, hit, wait};
}

test('Alt+Space starts Wortgenau at once and a following digit switches the mode', () => {
  const {keys, registered, events, hit, wait} = harness();
  assert.deepEqual(keys.apply(defaults), []);
  assert.deepEqual([...registered.keys()], ['Alt+Space']); // Digits stay free for other programs.
  hit('Alt+Space');
  assert.deepEqual([...registered.keys()].sort(), ['Alt+1', 'Alt+2', 'Alt+3', 'Alt+Space']);
  wait(150); hit('Alt+1');
  wait(40); hit('Alt+2'); // A second digit in the same gesture changes nothing.
  assert.deepEqual(events, [['press', 'verbatim', 'Alt+Space'], ['choose', 'clean']]);
  wait(2000);
  assert.deepEqual([...registered.keys()], ['Alt+Space']);
});

test('held keys repeat without restarting, and a later press works again', () => {
  const {keys, events, hit, wait} = harness();
  keys.apply(defaults);
  hit('Alt+Space');
  for (let i = 0; i < 20; i++) { wait(33); hit('Alt+Space'); } // Windows key repeat while held
  wait(3000); hit('Alt+Space');
  assert.deepEqual(events, [['press', 'verbatim', 'Alt+Space'], ['press', 'verbatim', 'Alt+Space']]);
});

test('a sequence without its own first-part shortcut starts the chosen mode', () => {
  const {keys, events, hit, registered, wait} = harness();
  keys.apply({verbatim: 'Control+Up', clean: 'Control+Alt+K+1'});
  hit('Control+Alt+K');
  assert.deepEqual(events, []);
  hit('Control+Alt+1');
  assert.deepEqual(events, [['press', 'clean', 'Control+Alt+K']]);
  wait(2500);
  assert.equal(registered.has('Control+Alt+1'), false);
});

test('keys taken by another program are reported in German', () => {
  const {keys} = harness(['Alt+Space', 'Alt+2']);
  assert.deepEqual(keys.apply(defaults), ['Alt + Leertaste (von einem anderen Programm belegt)', 'Alt + 2 (von einem anderen Programm belegt)']);
});

test('while a settings field records keys, shortcuts are forwarded instead of starting dictation', () => {
  const {keys, events, hit, registered, wait} = harness();
  keys.apply({verbatim: 'Control+Up'});
  assert.deepEqual(keys.capture(true), {unavailable: []});
  assert.equal(registered.has('Alt+Space'), true); // Keeps the window menu from taking Alt+Space.
  hit('Control+Up'); wait(700); hit('Alt+Space');
  assert.deepEqual(events, [['captured', 'Control+Up'], ['captured', 'Alt+Space']]);
  keys.capture(false);
  assert.equal(registered.has('Alt+Space'), false);
  wait(700); hit('Control+Up');
  assert.deepEqual(events.at(-1), ['press', 'verbatim', 'Control+Up']);
  const other = harness(['Alt+Space']);
  assert.deepEqual(other.keys.capture(true), {unavailable: ['Alt+Space']});
});
