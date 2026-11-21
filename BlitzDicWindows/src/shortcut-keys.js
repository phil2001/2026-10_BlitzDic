import { planShortcuts, formatShortcut } from './shortcuts.js';

// Registers the planned shortcuts through injected register/unregister functions (Electron's
// globalShortcut in the app). After the first part of a key sequence, e.g. Alt+Space, its last
// keys (Alt+1, Alt+2, ...) are registered for a moment only, so they stay free for other programs.
export class ShortcutKeys {
  constructor({register, unregister, press, choose, captured, followMs = 2000, repeatMs = 600,
    now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout}) {
    Object.assign(this, {register, unregister, press, choose, captured, followMs, repeatMs, now, setTimer, clearTimer});
    this.plan = planShortcuts({}); this.registered = new Set(); this.armed = null;
    this.lastPress = new Map(); this.capturing = false; this.probes = new Set(); this.captureTimer = null;
  }

  /** Registers the shortcuts; returns readable problems (invalid, duplicate or taken by another program). */
  apply(shortcuts) {
    this.clear();
    this.plan = planShortcuts(shortcuts);
    const failed = [...this.plan.problems];
    for (const key of new Set([...this.plan.direct.keys(), ...this.plan.sequences.keys()])) {
      if (this.tryRegister(key, () => this.pressed(key))) this.registered.add(key);
      else failed.push(`${formatShortcut(key)} (von einem anderen Programm belegt)`);
    }
    // The last keys of a sequence are only held briefly; check once that Windows would grant them.
    for (const follow of new Set([...this.plan.sequences.values()].flatMap(sequence => [...sequence.keys()]))) {
      if (this.registered.has(follow)) continue;
      if (this.tryRegister(follow, () => {})) this.unregister(follow);
      else failed.push(`${formatShortcut(follow)} (von einem anderen Programm belegt)`);
    }
    return failed;
  }

  // Windows repeats a held hotkey; only the first press of a hold counts.
  repeated(key) {
    const time = this.now(), last = this.lastPress.get(key);
    this.lastPress.set(key, time);
    return last !== undefined && time - last < this.repeatMs;
  }

  pressed(key) {
    if (this.repeated(key)) return;
    if (this.capturing) { this.captured(key); return; }
    const gesture = {lead: key, mode: this.plan.direct.get(key) ?? null, choice: null};
    const sequence = this.plan.sequences.get(key);
    if (sequence) this.arm(sequence, gesture);
    if (gesture.mode) this.press(gesture.mode, key, gesture);
  }

  arm(sequence, gesture) {
    this.disarm();
    const armed = {keys: new Set(), timer: null};
    for (const [follow, mode] of sequence)
      if (!this.registered.has(follow) && this.tryRegister(follow, () => this.followed(armed, gesture, follow, mode)))
        armed.keys.add(follow);
    armed.timer = this.setTimer(() => { if (this.armed === armed) this.disarm(); }, this.followMs);
    this.armed = armed;
  }

  followed(armed, gesture, follow, mode) {
    if (this.repeated(follow) || this.armed !== armed || gesture.chosen) return;
    // Stays registered until the window ends, so a held digit does not reach other programs.
    gesture.chosen = true;
    if (gesture.mode) this.choose(mode, gesture);
    else this.press(mode, gesture.lead, gesture);
  }

  disarm() {
    const armed = this.armed; this.armed = null;
    if (!armed) return;
    this.clearTimer(armed.timer);
    for (const key of armed.keys) this.unregister(key);
  }

  /** While a settings field records keys, our own shortcuts are passed to it instead of starting dictation. */
  capture(active) {
    this.capturing = !!active;
    this.disarm(); this.clearTimer(this.captureTimer); this.captureTimer = null;
    for (const key of this.probes) this.unregister(key);
    this.probes.clear();
    if (!this.capturing) return {unavailable: []};
    // Failsafe if the settings page disappears without ending the recording of keys.
    this.captureTimer = this.setTimer(() => this.capture(false), 120000);
    // Alt+Space otherwise opens the window menu instead of reaching the field.
    const unavailable = [];
    for (const key of ['Alt+Space']) {
      if (this.registered.has(key)) continue;
      if (this.tryRegister(key, () => this.pressed(key))) this.probes.add(key);
      else unavailable.push(key);
    }
    return {unavailable};
  }

  tryRegister(key, callback) {
    try { return this.register(key, callback) === true; } catch { return false; }
  }

  clear() {
    this.disarm(); this.capture(false);
    for (const key of this.registered) this.unregister(key);
    this.registered.clear();
  }
}
