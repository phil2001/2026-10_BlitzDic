// Each key gesture owns its preparation and release watcher until key-up.
// Cancelling audio keeps the guard until release, so key repeat cannot restart it.
export class HoldShortcuts {
  constructor({wait, start, stop, discard, tooShort, error}) {
    Object.assign(this, {wait, start, stop, discard, tooShort, error});
    this.active = null; this.sequence = 0;
  }
  async press(shortcut, prepare) {
    if (this.active) return;
    const gesture = {token: ++this.sequence, controller: new AbortController(),
      prepared: false, started: false, released: false, cancelled: false};
    this.active = gesture;
    Promise.resolve().then(() => this.wait(shortcut, gesture.controller.signal)).then(() => {
      gesture.released = true;
      if (this.active !== gesture || !gesture.prepared) return;
      if (gesture.started && !gesture.cancelled) this.stop(gesture.token);
      this.active = null;
    }).catch(cause => {
      if (this.active !== gesture) return;
      const cancelled = gesture.cancelled;
      this.active = null; gesture.cancelled = true; gesture.released = true;
      this.discard();
      if (!cancelled) this.error(gesture.token, cause);
    });
    try {
      const result = await prepare();
      gesture.prepared = true;
      if (this.active !== gesture) return;
      if (result === null) gesture.cancelled = true;
      if (gesture.cancelled || gesture.released) {
        this.discard();
        if (gesture.released && !gesture.cancelled) this.tooShort();
        if (gesture.released) this.active = null;
        return;
      }
      gesture.started = true; this.start(gesture.token, result);
    } catch (cause) {
      if (this.active !== gesture) return;
      gesture.prepared = true; gesture.cancelled = true; this.discard();
      this.error(gesture.token, cause);
      if (gesture.released) this.active = null;
    }
  }
  cancel(token = this.active?.token) {
    if (this.active && this.active.token === token) this.active.cancelled = true;
  }
  destroy() {
    const gesture = this.active; this.active = null;
    gesture?.controller.abort();
  }
}
