// Global dictation shortcuts as Electron accelerators. A shortcut may be a key sequence such as
// "Alt+Space+1": hold Alt, press Space, then 1. Windows registers only one key plus modifiers,
// so the first part is a normal global shortcut and the last key is listened for briefly after it.
// Shared by the main process and the settings page; no Node or Electron imports.

const MODIFIERS = new Map([
  ['commandorcontrol', 'Control'], ['cmdorctrl', 'Control'], ['control', 'Control'], ['ctrl', 'Control'],
  ['alt', 'Alt'], ['option', 'Alt'], ['altgr', 'AltGr'], ['shift', 'Shift'], ['super', 'Super'], ['meta', 'Super'],
]);
const MODIFIER_ORDER = ['Control', 'Alt', 'AltGr', 'Shift', 'Super'];
const NAMED_KEYS = ['Space', 'Tab', 'Capslock', 'Numlock', 'Scrolllock', 'Backspace', 'Delete', 'Insert', 'Return',
  'Enter', 'Up', 'Down', 'Left', 'Right', 'Home', 'End', 'PageUp', 'PageDown', 'Escape', 'Esc', 'VolumeUp',
  'VolumeDown', 'VolumeMute', 'MediaNextTrack', 'MediaPreviousTrack', 'MediaStop', 'MediaPlayPause', 'PrintScreen',
  'Plus', 'numdec', 'numadd', 'numsub', 'nummult', 'numdiv'];
const KEYS = new Map(NAMED_KEYS.map(name => [name.toLowerCase(), name]));
for (let n = 1; n <= 24; n++) KEYS.set(`f${n}`, `F${n}`);
for (let n = 0; n <= 9; n++) KEYS.set(`num${n}`, `num${n}`);
const PUNCTUATION = /^[!"#$%&'()*,\-./:;<=>?@[\\\]^_`{|}~]$/;
// Keys that are fine without Ctrl, Alt or Win because they never type text.
const STANDALONE = /^(F\d+|Volume\w+|Media\w+|PrintScreen)$/;

const LABELS = {Control: 'Strg', Alt: 'Alt', AltGr: 'AltGr', Shift: 'Umschalt', Super: 'Win', Space: 'Leertaste',
  Up: '↑', Down: '↓', Left: '←', Right: '→', Return: 'Eingabe', Enter: 'Eingabe', Backspace: 'Rücktaste',
  Delete: 'Entf', Insert: 'Einfg', Home: 'Pos1', End: 'Ende', PageUp: 'Bild ↑', PageDown: 'Bild ↓', Plus: '+',
  Escape: 'Esc', Esc: 'Esc', Capslock: 'Feststelltaste', PrintScreen: 'Druck', numdec: 'Num ,', numadd: 'Num +',
  numsub: 'Num −', nummult: 'Num *', numdiv: 'Num /', VolumeUp: 'Lauter', VolumeDown: 'Leiser', VolumeMute: 'Stumm',
  MediaPlayPause: 'Wiedergabe/Pause', MediaNextTrack: 'Nächster Titel', MediaPreviousTrack: 'Voriger Titel',
  MediaStop: 'Stopp'};

function keyName(part) {
  const known = KEYS.get(part.toLowerCase());
  if (known) return known;
  if (/^[a-z0-9]$/i.test(part)) return part.toUpperCase();
  if (PUNCTUATION.test(part)) return part;
  throw new Error(`Unbekannte Taste „${part}“.`);
}

/** Splits an accelerator into canonical modifiers and one or two keys; throws on anything Windows cannot register. */
export function parseShortcut(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 80) throw new Error('Ungültiges Tastenkürzel.');
  const parts = value.split('+').map(part => part.trim());
  if (parts.some(part => !part)) throw new Error('Die Plus-Taste als „Plus“ angeben.');
  const modifiers = new Set(), keys = [];
  for (const part of parts) {
    const modifier = MODIFIERS.get(part.toLowerCase());
    if (modifier) {
      if (keys.length) throw new Error('Strg, Alt, Umschalt und Win gehören an den Anfang des Kürzels.');
      modifiers.add(modifier);
    } else keys.push(keyName(part));
  }
  if (!keys.length) throw new Error('Zusätzlich zu Strg, Alt, Umschalt oder Win eine Taste wählen.');
  if (keys.length > 2) throw new Error('Höchstens zwei Tasten nach Strg, Alt, Umschalt oder Win.');
  if (keys.length === 2 && keys[0] === keys[1]) throw new Error('Die zweite Taste muss sich von der ersten unterscheiden.');
  if (keys.some(key => key === 'Escape' || key === 'Esc'))
    throw new Error('Escape ist zum Beenden einer Aufnahme und Abbrechen der Verarbeitung reserviert.');
  return {modifiers: MODIFIER_ORDER.filter(modifier => modifiers.has(modifier)), keys};
}

export const accelerator = (modifiers, ...keys) =>
  [...MODIFIER_ORDER.filter(modifier => modifiers.includes(modifier)), ...keys].join('+');

/** German display text for parts, e.g. ["Alt"], ["Space", "1"] → "Alt + Leertaste + 1". */
export const formatParts = (modifiers, keys = []) =>
  [...MODIFIER_ORDER.filter(modifier => modifiers.includes(modifier)), ...keys].map(part => LABELS[part] ?? part).join(' + ');

/** German display text, e.g. "Alt + Leertaste + 1"; unparsable values are shown as stored. */
export function formatShortcut(value) {
  if (!value) return 'Kein Kürzel';
  try {
    const {modifiers, keys} = parseShortcut(value);
    return formatParts(modifiers, keys);
  } catch { return value; }
}

/** Extra rule for newly recorded shortcuts: plain or Shift-only letters would block normal typing. */
export function checkRecordedShortcut({modifiers, keys}) {
  if (!keys.length) throw new Error('Zusätzlich zu Strg, Alt oder Win eine Taste drücken.');
  if (!modifiers.some(modifier => modifier !== 'Shift') && !STANDALONE.test(keys[0]))
    throw new Error('Bitte mit Strg, Alt oder Win kombinieren, sonst blockiert das Kürzel normales Tippen.');
}

/**
 * Which accelerators to register: direct shortcuts start a mode; the first part of a key sequence
 * listens briefly for its last key. Problems are listed, the remaining shortcuts still work.
 */
export function planShortcuts(shortcuts = {}) {
  const direct = new Map(), sequences = new Map(), problems = [], parsed = [];
  for (const [mode, value] of Object.entries(shortcuts ?? {})) {
    if (!value) continue; // An empty field means: no shortcut for this mode.
    try { parsed.push({mode, value, ...parseShortcut(value)}); }
    catch (error) { problems.push(`${value}: ${error.message}`); }
  }
  for (const item of parsed.filter(item => item.keys.length === 1)) {
    const key = accelerator(item.modifiers, item.keys[0]);
    if (direct.has(key)) problems.push(`${formatShortcut(item.value)} ist doppelt vergeben.`);
    else direct.set(key, item.mode);
  }
  for (const item of parsed.filter(item => item.keys.length === 2)) {
    const lead = accelerator(item.modifiers, item.keys[0]), follow = accelerator(item.modifiers, item.keys[1]);
    const sequence = sequences.get(lead) ?? new Map();
    if (direct.has(follow) || sequences.has(follow))
      problems.push(`${formatShortcut(item.value)} überschneidet sich mit ${formatShortcut(follow)}.`);
    else if (sequence.has(follow)) problems.push(`${formatShortcut(item.value)} ist doppelt vergeben.`);
    else { sequence.set(follow, item.mode); sequences.set(lead, sequence); }
  }
  for (const [lead, sequence] of sequences)
    for (const follow of sequence.keys())
      if (sequences.has(follow)) problems.push(`${formatShortcut(follow)} ist zugleich Anfang einer Tastenfolge.`);
  return {direct, sequences, problems};
}

// Windows virtual-key codes as reported by KeyboardEvent.keyCode in Chromium on Windows.
// Using them keeps the recorded shortcut identical to what RegisterHotKey sees on this PC.
const VIRTUAL_KEYS = {8: 'Backspace', 9: 'Tab', 13: 'Enter', 20: 'Capslock', 32: 'Space', 33: 'PageUp', 34: 'PageDown',
  35: 'End', 36: 'Home', 37: 'Left', 38: 'Up', 39: 'Right', 40: 'Down', 44: 'PrintScreen', 45: 'Insert', 46: 'Delete',
  106: 'nummult', 107: 'numadd', 109: 'numsub', 110: 'numdec', 111: 'numdiv', 144: 'Numlock', 145: 'Scrolllock',
  173: 'VolumeMute', 174: 'VolumeDown', 175: 'VolumeUp', 176: 'MediaNextTrack', 177: 'MediaPreviousTrack',
  178: 'MediaStop', 179: 'MediaPlayPause'};
const MODIFIER_KEYS = new Set([16, 17, 18, 91, 92, 93, 225]);

/** Key part of a keydown event: "Space", "1", "A", "F9", null for modifiers; throws for unsupported keys. */
export function keyFromEvent({keyCode, key}) {
  if (MODIFIER_KEYS.has(keyCode)) return null;
  if (keyCode >= 48 && keyCode <= 57) return String(keyCode - 48);
  if (keyCode >= 65 && keyCode <= 90) return String.fromCharCode(keyCode);
  if (keyCode >= 96 && keyCode <= 105) return `num${keyCode - 96}`;
  if (keyCode >= 112 && keyCode <= 135) return `F${keyCode - 111}`;
  if (VIRTUAL_KEYS[keyCode]) return VIRTUAL_KEYS[keyCode];
  if (key === '+') return 'Plus';
  if (typeof key === 'string' && PUNCTUATION.test(key)) return key;
  throw new Error('Diese Taste kann nicht als globales Kürzel verwendet werden.');
}

export const modifiersFromEvent = event => MODIFIER_ORDER.filter(modifier =>
  ({Control: event.ctrlKey, Alt: event.altKey, Shift: event.shiftKey, Super: event.metaKey})[modifier]);
