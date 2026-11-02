import {spawn} from 'node:child_process';
import {basename} from 'node:path';
import {fileURLToPath} from 'node:url';
const unavailable = () => new Error('Stummschaltung nicht verfügbar. Windows-Ausgabe prüfen und BlitzDic neu starten.');

export class OutputMute {
  constructor({pythonPath, onError = () => {}, spawnProcess = spawn, timeoutMs = 5000}) {
    Object.assign(this, {pythonPath, onError, spawnProcess, timeoutMs});
    this.sequence = 0; this.revision = 0; this.desired = false;
    this.queue = Promise.resolve(); this.pending = new Map();
  }
  start() {
    if (this.ready) return this.ready;
    this.ready = new Promise((accept, reject) => {this.acceptReady = accept; this.rejectReady = reject;});
    this.ready.catch(() => {});
    let child;
    try {
      const args = basename(this.pythonPath).toLowerCase() === 'blitzdic-speech.exe' ? [] :
        [fileURLToPath(new URL('../speech/worker.py', import.meta.url))];
      child = this.spawnProcess(this.pythonPath, [...args, '--output-mute'], {
        windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'],
        env: {...process.env, PYTHONIOENCODING: 'utf-8'},
      });
    } catch {
      this.failed = unavailable(); this.rejectReady(this.failed);
      if (this.desired) this.onError(this.failed);
      return this.ready;
    }
    this.child = child;
    const fail = () => {
      if (this.failed || this.closed) return;
      this.failed = unavailable();
      clearTimeout(this.readyTimer); this.rejectReady(this.failed);
      for (const item of this.pending.values()) {clearTimeout(item.timer); item.reject(this.failed);}
      this.pending.clear();
      // Do not kill a helper that may own a mute lease: EOF requests restoration.
      child.stdin.end();
      if (this.desired) this.onError(this.failed);
    };
    this.fail = fail; this.readyTimer = setTimeout(fail, this.timeoutMs);
    child.on('error', fail); child.on('close', fail); child.stdin.on('error', fail);
    child.stderr.on('data', () => {});
    let output = '';
    child.stdout.on('data', chunk => {
      if (this.closed || this.failed) return;
      output += chunk.toString('utf8');
      if (output.length > 65536) return fail();
      while (output.includes('\n')) {
        const end = output.indexOf('\n'), line = output.slice(0, end); output = output.slice(end + 1);
        let event; try {event = JSON.parse(line);} catch {return fail();}
        if (event?.event === 'ready') {clearTimeout(this.readyTimer); this.acceptReady();}
        else if (event?.event === 'state') {
          const item = this.pending.get(event.id);
          if (!item || item.active !== event.active) return fail();
          this.pending.delete(event.id); clearTimeout(item.timer); item.accept();
        } else return fail();
      }
    });
    return this.ready;
  }
  setActive(active) {
    if (typeof active !== 'boolean') return Promise.reject(new Error('Ungültiger Stummschaltungsstatus.'));
    this.desired = active; const revision = ++this.revision;
    const operation = this.queue.then(async () => {
      if (this.closed) return;
      if (this.failed) {if (active) throw this.failed; return;}
      if (!this.child && !this.desired) return;
      await this.start();
      // A restore for an already-sent mute cannot be superseded by a new session.
      if (this.closed || (revision !== this.revision && (active || !this.sentActive))) return;
      const id = ++this.sequence;
      await new Promise((accept, reject) => {
        const timer = setTimeout(() => this.fail(), this.timeoutMs);
        this.pending.set(id, {active, accept, reject, timer});
        this.sentActive = active;
        this.child.stdin.write(`${JSON.stringify({id, active})}\n`);
      });
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
  destroy() {
    this.closed = true; this.desired = false; ++this.revision;
    clearTimeout(this.readyTimer); this.rejectReady?.(new Error('Stummschaltung beendet.'));
    for (const item of this.pending.values()) {clearTimeout(item.timer); item.reject(new Error('Stummschaltung beendet.'));}
    this.pending.clear(); this.child?.stdin.end();
  }
}
