import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export const defaultSettings = () => ({
  version: 1,
  speech: { preset: 'whisper', language: '', microphone: '' },
  provider: { provider: 'ollama', location: 'local', baseURL: 'http://127.0.0.1:11434/v1', model: '', apiKey: '' },
  mode: 'verbatim', modeSettings: { customTerms: [], replacements: [] },
  shortcuts: { verbatim: 'CommandOrControl+Shift+1', clean: 'CommandOrControl+Shift+2', calm: 'CommandOrControl+Shift+3', emoji: 'CommandOrControl+Shift+4' },
  historyEnabled: true, historyLimit: 100,
});

// Entire settings/history payload is encrypted by the operating system adapter.
// A failed decrypt is surfaced; it must never silently erase existing history.
export class PrivateStore {
  constructor(directory, crypto) {
    this.directory = directory; this.crypto = crypto; this.queue = Promise.resolve();
  }
  async read(name, fallback) {
    let data;
    try { data = await readFile(join(this.directory, `${name}.bin`)); }
    catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
    try { return JSON.parse(await this.crypto.decrypt(data)); }
    catch { throw new Error('Gespeicherte Daten können nicht entschlüsselt werden. Originaldatei bleibt erhalten.'); }
  }
  update(name, fallback, transform) {
    const operation = this.queue.then(async () => {
      const value = await transform(await this.read(name, fallback));
      const encrypted = await this.crypto.encrypt(JSON.stringify(value));
      await mkdir(this.directory, { recursive: true });
      const target = join(this.directory, `${name}.bin`);
      await writeFile(`${target}.tmp`, encrypted, { mode: 0o600 });
      await rename(`${target}.tmp`, target);
      return value;
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
  async settings() {
    const defaults = defaultSettings();
    const saved = await this.read('settings', defaults);
    return { ...defaults, ...saved, speech: { ...defaults.speech, ...saved.speech }, provider: { ...defaults.provider, ...saved.provider } };
  }
  saveSettings(settings) { return this.update('settings', defaultSettings(), () => settings); }
  history() { return this.read('history', []); }
  appendHistory(entry, limit = 100) {
    const count = Math.max(1, Math.min(1000, Number.isFinite(limit) ? Math.trunc(limit) : 100));
    return this.update('history', [], entries => [entry, ...entries].slice(0, count));
  }
  clearHistory() { return this.update('history', [], () => []); }
}
