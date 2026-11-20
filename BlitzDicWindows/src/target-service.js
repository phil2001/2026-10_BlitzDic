import { spawn } from 'node:child_process';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const workerScript = fileURLToPath(new URL('../speech/worker.py', import.meta.url));
const actions = new Set(['capture-target', 'insert-text']);

// Persistent field capture and insertion (worker.py --target-service). Starting
// a worker before every recording and every insertion cost noticeable time on
// slow PCs. Requests are answered in order. A timeout or cancellation ends the
// helper, as ending a single-use worker did before; the next request starts one.
export class TargetService {
  constructor({ pythonPath, script = workerScript, onProgress = () => {} } = {}) {
    Object.assign(this, { pythonPath, script, onProgress });
    this.helper = null; this.sequence = 0; this.closed = false;
  }
  start() {
    if (this.closed || !this.pythonPath) return null;
    if (this.helper) return this.helper;
    const prefix = basename(this.pythonPath).toLowerCase() === 'blitzdic-speech.exe' ? [] : [this.script];
    const child = spawn(this.pythonPath, [...prefix, '--target-service'], {
      windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    const helper = { child, pending: new Map(), output: '' };
    const fail = error => {
      if (this.helper === helper) this.helper = null;
      for (const item of [...helper.pending.values()]) item.reject(error);
    };
    const broken = message => { fail(new Error(message)); child.kill(); };
    child.on('error', () => fail(new Error('Spracherkennungs-Laufzeit konnte nicht gestartet werden.')));
    child.on('close', () => fail(new Error('Die Eingabehilfe wurde unerwartet beendet.')));
    child.stdin.on('error', () => {});
    child.stderr.on('data', chunk => this.onProgress(chunk.toString('utf8')));
    child.stdout.on('data', chunk => {
      helper.output += chunk.toString('utf8'); // ASCII-only JSON lines.
      if (helper.output.length > 16 * 1024 * 1024) return broken('Antwort der Eingabehilfe ist zu groß.');
      for (let end; (end = helper.output.indexOf('\n')) >= 0;) {
        const line = helper.output.slice(0, end); helper.output = helper.output.slice(end + 1);
        let message;
        try { message = JSON.parse(line); } catch { return broken('Ungültige Antwort der Eingabehilfe.'); }
        if (message?.event === 'ready') continue;
        const item = helper.pending.get(message?.id);
        if (!item) continue; // Answer to an abandoned request.
        if (typeof message.error === 'string') item.reject(new Error(message.error));
        else if (message.result && typeof message.result === 'object') item.resolve(message.result);
        else item.reject(new Error('Ungültige Antwort der Eingabehilfe.'));
      }
    });
    this.helper = helper;
    return helper;
  }
  request(request, { signal, timeoutMs = 5000 } = {}) {
    if (!this.pythonPath) throw new Error('Die lokale Spracherkennungs-Laufzeit fehlt.');
    if (!actions.has(request?.action)) throw new Error('Unbekannte Aktion der Eingabehilfe.');
    signal?.throwIfAborted();
    const helper = this.start();
    if (!helper) return Promise.reject(new Error('Eingabehilfe beendet.'));
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const settle = (finish, value) => {
        clearTimeout(timer); signal?.removeEventListener('abort', cancel);
        helper.pending.delete(id); finish(value);
      };
      const abandon = message => { settle(reject, new Error(message)); this.end(helper); };
      const cancel = () => abandon('Abgebrochen.');
      const timer = setTimeout(() => abandon('Zeitüberschreitung bei der Eingabefelderkennung.'), timeoutMs);
      helper.pending.set(id, { resolve: value => settle(resolve, value), reject: error => settle(reject, error) });
      signal?.addEventListener('abort', cancel, { once: true });
      helper.child.stdin.write(`${JSON.stringify({ id, request })}\n`);
    });
  }
  end(helper) {
    if (this.helper === helper) this.helper = null;
    helper.child.kill(); // Close rejects any other pending request.
  }
  destroy() {
    this.closed = true;
    if (this.helper) this.end(this.helper);
  }
}
