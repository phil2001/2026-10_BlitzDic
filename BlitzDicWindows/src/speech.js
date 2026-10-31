import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const speechPresets = Object.freeze([
  { id: 'whisper', label: 'OpenAI Whisper', engine: 'whisper', repository: 'Systran/faster-whisper-small' },
  { id: 'parakeet-ultra', label: 'Parakeet Ultra (NVIDIA / Moondream)', engine: 'parakeet', repository: 'Masterx/parakeet-tdt-0.6b-ultra-onnx' },
]);

export function runSpeech(request, { pythonPath, signal, timeoutMs = 600000, onProgress = () => {} } = {}) {
  if (!pythonPath) throw new Error('Die lokale Spracherkennungs-Laufzeit fehlt.');
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const child = spawn(pythonPath, [fileURLToPath(new URL('../speech/worker.py', import.meta.url))], {
      windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', HF_HUB_DISABLE_TELEMETRY: '1' },
    });
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
