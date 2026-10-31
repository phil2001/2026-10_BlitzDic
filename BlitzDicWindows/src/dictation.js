import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { runSpeech, speechPresets } from './speech.js';
import { rewrite, modes } from './modes.js';

// One task at a time. Cancellation keeps ownership until the worker has exited.
export class Dictation extends EventEmitter {
  constructor({ store, modelRoot, pythonPath, transcribe = runSpeech, rewriteText = rewrite }) {
    super(); Object.assign(this, { store, modelRoot, pythonPath, transcribe, rewriteText });
    this.active = null; this.state = 'idle';
  }
  transition(state) { this.state = state; this.emit('state', state); }
  cancel() { this.active?.abort(); }
  async process(audioPath, modeOverride, { saveHistory = true } = {}) {
    if (this.active) throw new Error('Eine Aufnahme wird bereits verarbeitet.');
    const controller = new AbortController(); this.active = controller;
    const { signal } = controller;
    try {
      const settings = structuredClone(await this.store.settings());
      signal.throwIfAborted();
      const mode = modeOverride ?? settings.mode;
      if (!Object.hasOwn(modes, mode)) throw new Error('Unbekannter Schreibmodus.');
      const preset = speechPresets.find(p => p.id === settings.speech.preset);
      if (!preset && settings.speech.preset !== 'custom') throw new Error('Unbekanntes Sprachmodell.');
      const modelDirectory = preset ? join(this.modelRoot, preset.id) : settings.speech.modelDirectory;
      if (!modelDirectory) throw new Error('Bitte einen lokalen Modellordner auswählen.');
      this.transition('transcribing');
      const recognized = await this.transcribe({ action: 'transcribe', preset: preset?.id,
        engine: preset?.engine ?? settings.speech.engine, modelDirectory,
        ...(Buffer.isBuffer(audioPath) ? { audioBase64: audioPath.toString('base64') } : { audioPath }),
        language: settings.speech.language,
      }, { pythonPath: this.pythonPath, signal });
      signal.throwIfAborted();
      if (typeof recognized.text !== 'string') throw new Error('Ungültiges Transkript.');
      const entry = { id: randomUUID(), createdAt: new Date().toISOString(), mode,
        original: recognized.text, text: recognized.text, segments: recognized.segments ?? [],
        language: recognized.language, speechModel: preset?.id ?? 'custom', warning: null };
      if (entry.original.trim() && mode !== 'verbatim') this.transition('rewriting');
      try {
        entry.text = await this.rewriteText(entry.original, mode, settings.modeSettings, settings.provider, { signal });
      } catch (error) {
        signal.throwIfAborted();
        // Keep a successful transcript recoverable if a text provider is unavailable.
        entry.warning = `Überarbeitung fehlgeschlagen: ${error.message}`;
        entry.mode = 'verbatim';
      }
      signal.throwIfAborted();
      if (entry.text.trim() && settings.historyEnabled && saveHistory) {
        this.transition('saving');
        try { await this.store.appendHistory(entry, settings.historyLimit); }
        catch (error) { entry.warning = [entry.warning, `Verlauf nicht gespeichert: ${error.message}`].filter(Boolean).join('\n'); }
      }
      signal.throwIfAborted();
      this.emit('result', entry);
      return entry;
    } finally { this.active = null; this.transition('idle'); }
  }
}
