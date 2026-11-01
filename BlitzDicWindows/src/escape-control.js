import {spawn} from 'node:child_process';
import {basename} from 'node:path';
import {fileURLToPath} from 'node:url';

// A persistent, windowless helper installs its Escape-only hook on demand.
// Generation checks discard messages already in flight after cancellation.
export class EscapeControl {
  constructor({pythonPath, onEscape, onError, spawnProcess = spawn, timeoutMs = 5000}) {
    Object.assign(this, {pythonPath, onEscape, onError, spawnProcess, timeoutMs});
    this.sequence = 0; this.generation = 0; this.active = false;
    this.pending = new Map(); this.destroyed = false;
  }
  start() {
    if (this.ready) return this.ready;
    this.ready = new Promise((accept, reject) => {this.acceptReady = accept; this.rejectReady = reject;});
    this.ready.catch(() => {});
    const args = basename(this.pythonPath).toLowerCase() === 'blitzdic-speech.exe' ? [] :
      [fileURLToPath(new URL('../speech/worker.py', import.meta.url))];
    const child = this.spawnProcess(this.pythonPath, [...args, '--escape-control'], {
      windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'],
      env: {...process.env, PYTHONIOENCODING: 'utf-8'},
    });
    this.child = child;
    let output = '', stopped = false;
    const fail = () => {
      if (stopped || this.destroyed) return;
      stopped = true; this.active = false; this.generation = 0;
      const error = new Error('Escape-Steuerung nicht verfügbar. BlitzDic bitte erneut starten.');
      this.failed = error;
      clearTimeout(this.readyTimer); this.rejectReady(error);
      for (const request of this.pending.values()) {clearTimeout(request.timer); request.reject(error);}
      this.pending.clear(); child.kill(); this.onError(error);
    };
    this.readyTimer = setTimeout(fail, this.timeoutMs);
    child.on('error', fail); child.on('close', fail);
    child.stdin.on('error', fail);
    child.stderr.on('data', () => {}); // Native errors are surfaced without raw diagnostics.
    child.stdout.on('data', chunk => {
      if (stopped || this.destroyed) return;
      output += chunk.toString('utf8');
      if (output.length > 65536) return fail();
      while (output.includes('\n')) {
        const end = output.indexOf('\n'), line = output.slice(0, end); output = output.slice(end + 1);
        let event;
        try {event = JSON.parse(line);} catch {return fail();}
        if (!event || typeof event !== 'object') return fail();
        if (event.event === 'ready') {clearTimeout(this.readyTimer); this.acceptReady();}
        else if (event.event === 'state') {
          const request = this.pending.get(event.id);
          if (!request || request.active !== event.active) return fail();
          this.pending.delete(event.id); clearTimeout(request.timer); request.accept();
        } else if (event.event === 'escape' && this.active && event.id === this.generation) this.onEscape();
        else if (event.event !== 'escape') return fail();
      }
    });
    this.fail = fail;
    return this.ready;
  }
  setActive(active) {
    if (this.destroyed) return Promise.reject(new Error('Escape-Steuerung beendet.'));
    if (this.failed) return Promise.reject(this.failed);
    if (this.active === active && this.operation) return this.operation;
    this.active = active;
    const id = ++this.sequence; this.generation = id;
    this.operation = this.start().then(() => new Promise((accept, reject) => {
      if (this.destroyed) return reject(new Error('Escape-Steuerung beendet.'));
      if (this.failed) return reject(this.failed);
      const timer = setTimeout(() => this.fail(), this.timeoutMs);
      this.pending.set(id, {accept, reject, active, timer});
      this.child.stdin.write(`${JSON.stringify({id, active})}\n`);
    }));
    this.operation.catch(() => {});
    return this.operation;
  }
  destroy() {
    this.destroyed = true; this.active = false; this.generation = 0;
    clearTimeout(this.readyTimer);
    const error = new Error('Escape-Steuerung beendet.');
    this.rejectReady?.(error);
    for (const request of this.pending.values()) {clearTimeout(request.timer); request.reject(error);}
    this.pending.clear(); this.child?.kill();
  }
}
