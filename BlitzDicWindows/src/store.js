import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export const defaultSettings = () => ({
  version: 1,
  speech: { preset: 'parakeet-ultra', language: 'de-medical', microphone: '' },
  provider: { provider: 'ollama', location: 'local', baseURL: 'http://127.0.0.1:11434/v1', model: '', apiKey: '' },
  mode: 'verbatim', modeSettings: { customTerms: [], replacements: [] },
  appModes: [],
  websiteModes: [],
  // Alt+Space starts Wortgenau; the digit after it (Alt held) picks the other writing modes.
  shortcuts: { verbatim: 'Alt+Space', clean: 'Alt+Space+1', calm: 'Alt+Space+2', emoji: 'Alt+Space+3' },
  shortcutLayout: 2,
  historyEnabled: true, historyLimit: 100,
  recordingIndicator: true,
  muteOutputWhileRecording: false,
  shortcutBehavior: 'toggle',
  startWithWindows: true,
  termCorrection: true,
});

const legacyShortcuts = { verbatim: 'CommandOrControl+Shift+1', clean: 'CommandOrControl+Shift+2', calm: 'CommandOrControl+Shift+3', emoji: 'CommandOrControl+Shift+4' };

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
    const speech = { ...defaults.speech, ...saved.speech };
    // Migrate the former automatic/empty preference to the requested German default.
    if (!['de', 'en', 'de-medical'].includes(speech.language)) speech.language = 'de-medical';
    // Untouched former defaults move to the new keys once; own shortcuts stay as they are.
    const legacy = (saved.shortcutLayout ?? 1) < 2 && saved.shortcuts &&
      Object.entries(legacyShortcuts).every(([mode, value]) => saved.shortcuts[mode] === value);
    const shortcuts = legacy ? defaults.shortcuts : saved.shortcuts ?? defaults.shortcuts;
    return { ...defaults, ...saved, speech, provider: { ...defaults.provider, ...saved.provider }, shortcuts, shortcutLayout: 2 };
  }
  saveSettings(settings) { return this.update('settings', defaultSettings(), () => settings); }
  history() { return this.read('history', []); }
  meetings() { return this.read('meetings', []); }
  appendMeeting(entry) { return this.update('meetings', [], entries => [entry, ...entries].slice(0, 100)); }
  async updateMeeting(id, transform) {
    let updated;
    await this.update('meetings', [], entries => {
      const index = entries.findIndex(entry => entry.id === id);
      if (index < 0) throw new Error('Gespeichertes Meeting nicht mehr vorhanden.');
      updated = transform(entries[index]);
      return entries.map((entry, current) => current === index ? updated : entry);
    });
    return updated;
  }
  clearMeetings() { return this.update('meetings', [], () => []); }
  appendHistory(entry, limit = 100) {
    const count = Math.max(1, Math.min(1000, Number.isFinite(limit) ? Math.trunc(limit) : 100));
    return this.update('history', [], entries => [entry, ...entries].slice(0, count));
  }
  clearHistory() { return this.update('history', [], () => []); }
}
