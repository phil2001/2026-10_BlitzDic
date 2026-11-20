import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { basename, join } from 'node:path';

export const speechPresets = Object.freeze([
  { id: 'whisper', label: 'OpenAI Whisper', engine: 'whisper', repository: 'Systran/faster-whisper-small' },
  { id: 'parakeet-ultra', label: 'Parakeet Ultra (NVIDIA / Moondream)', engine: 'parakeet', repository: 'Masterx/parakeet-tdt-0.6b-ultra-onnx' },
]);

const workerScript = fileURLToPath(new URL('../speech/worker.py', import.meta.url));
const transcriptionActions = new Set(['transcribe', 'transcribe-speakers', 'transcribe-meeting']);

// Same engine and directory that Dictation and LiveNotes send with a request.
export function speechModel(speech, modelRoot) {
  const preset = speechPresets.find(p => p.id === speech?.preset);
  if (preset) return { engine: preset.engine, modelDirectory: join(modelRoot, preset.id) };
  if (speech?.preset === 'custom' && speech.modelDirectory) return { engine: speech.engine, modelDirectory: speech.modelDirectory };
  return null;
}

const modelKey = model => ['whisper', 'parakeet'].includes(model?.engine) &&
  typeof model.modelDirectory === 'string' && model.modelDirectory ? `${model.engine}\n${model.modelDirectory}` : null;

function spawnWorker(pythonPath, args = [], script = workerScript) {
  const prefix = basename(pythonPath).toLowerCase() === 'blitzdic-speech.exe' ? [] : [script];
  return spawn(pythonPath, [...prefix, ...args], {
    windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', HF_HUB_DISABLE_TELEMETRY: '1' },
  });
}

// One request per worker process; settles once that process has exited.
function exchange(child, request, { signal, timeoutMs = 600000, onProgress = () => {} } = {}) {
  return new Promise((resolve, reject) => {
    let output = ''; let failure;
    const stop = message => { failure = new Error(message); child.kill(); };
    const cancel = () => stop('Spracherkennung abgebrochen.');
    const timer = setTimeout(() => stop('Zeitüberschreitung bei der Spracherkennung.'), timeoutMs);
    signal?.addEventListener('abort', cancel, { once: true });
    child.stdout.on('data', chunk => {
      output += chunk.toString('utf8');
      if (output.length > 16 * 1024 * 1024) stop('Ergebnis überschreitet die maximale Größe.');
    });
    child.stderr.on('data', chunk => onProgress(chunk.toString('utf8')));
    child.stdin.on('error', () => {});
    child.on('error', () => { failure = new Error('Spracherkennungs-Laufzeit konnte nicht gestartet werden.'); });
    child.on('close', code => {
      clearTimeout(timer); signal?.removeEventListener('abort', cancel);
      if (failure) return reject(failure);
      try {
        const result = JSON.parse(output);
        if (code !== 0 || result.error) return reject(new Error(result.error || 'Spracherkennung fehlgeschlagen.'));
        resolve(result);
      } catch { reject(new Error('Ungültige Antwort der Spracherkennungs-Laufzeit.')); }
    });
    child.stdin.end(JSON.stringify(request));
    if (signal?.aborted) cancel();
  });
}

export function runSpeech(request, { pythonPath, signal, timeoutMs, onProgress, script } = {}) {
  if (!pythonPath) throw new Error('Die lokale Spracherkennungs-Laufzeit fehlt.');
  signal?.throwIfAborted();
  return exchange(spawnWorker(pythonPath, [], script), request, { signal, timeoutMs, onProgress });
}

const usable = child => child.pid !== undefined && child.exitCode === null && child.signalCode === null && !child.killed;

// Keeps at most one worker that has loaded the selected model and waits for its
// request, so a dictation does not pay process start and model loading. The
// next one starts only after running transcriptions end: never two computing
// workers, never two loaded models. By default it stays loaded (target PCs have
// 16 GB); with idleMs, an unused worker is ended after that time.
export class WarmSpeech {
  constructor({ pythonPath, idleMs = null, script = workerScript } = {}) {
    Object.assign(this, { pythonPath, idleMs, script });
    this.warm = null; this.target = null; this.running = 0; this.destroyed = false; this.idle = null;
  }
  // Called at startup, after a settings change and when a recording starts.
  prepare(model) {
    const key = modelKey(model);
    if (this.destroyed || !this.pythonPath || !key) return false;
    this.target = { engine: model.engine, modelDirectory: model.modelDirectory };
    if (this.warm?.key === key && usable(this.warm.child)) { this.armIdle(); return true; }
    this.discard();
    if (this.running) return false;
    const child = spawnWorker(this.pythonPath, ['--preload', model.engine, model.modelDirectory], this.script);
    const warm = { key, child };
    const drop = () => { if (this.warm === warm) { this.warm = null; clearTimeout(this.idle); } };
    child.on('error', drop); child.on('exit', drop);
    child.stdin.on('error', () => {});
    child.stderr.resume(); // Loading messages must not fill the pipe while idle.
    this.warm = warm; this.armIdle();
    return true;
  }
  run(request, { signal, timeoutMs, onProgress } = {}) {
    if (!this.pythonPath) throw new Error('Die lokale Spracherkennungs-Laufzeit fehlt.');
    signal?.throwIfAborted();
    if (!transcriptionActions.has(request?.action))
      return runSpeech(request, { pythonPath: this.pythonPath, signal, timeoutMs, onProgress, script: this.script });
    const model = { engine: request.engine, modelDirectory: request.modelDirectory };
    const key = modelKey(model);
    let child;
    if (key && this.warm?.key === key && usable(this.warm.child)) {
      child = this.warm.child; this.warm = null; clearTimeout(this.idle);
    } else {
      this.discard(); // A different loaded model would only hold memory.
      child = spawnWorker(this.pythonPath, [], this.script);
    }
    if (key) this.target = model;
    this.running++;
    return exchange(child, request, { signal, timeoutMs, onProgress }).finally(() => {
      if (--this.running === 0 && this.target) this.prepare(this.target);
    });
  }
  armIdle() {
    clearTimeout(this.idle);
    if (!Number.isFinite(this.idleMs)) return;
    this.idle = setTimeout(() => this.discard(), this.idleMs);
    this.idle.unref?.();
  }
  discard() {
    clearTimeout(this.idle);
    const warm = this.warm; this.warm = null;
    warm?.child.kill();
  }
  destroy() { this.destroyed = true; this.target = null; this.discard(); }
}
