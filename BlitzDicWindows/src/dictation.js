import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { runSpeech, speechPresets } from './speech.js';
import { rewrite, modes } from './modes.js';
import { correctRecognized } from './term-correction.js';

// One task at a time. Cancellation keeps ownership until the worker has exited.
export class Dictation extends EventEmitter {
  constructor({ store, modelRoot, pythonPath, transcribe = runSpeech, rewriteText = rewrite, misspelled = null }) {
    super(); Object.assign(this, { store, modelRoot, pythonPath, transcribe, rewriteText, misspelled });
    this.active = null; this.state = 'idle';
  }
  transition(state) { this.state = state; this.emit('state', state); }
  cancel() { this.active?.abort(); }
  async process(audioPath, modeOverride, { saveHistory = true, diarize = false, speakerCount = -1, echoFilter = false } = {}) {
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
      const recognized = await this.transcribe({ action: echoFilter ? 'transcribe-meeting' : diarize ? 'transcribe-speakers' : 'transcribe', preset: preset?.id,
        ...(echoFilter ? {diarize} : {}),
        ...(diarize ? {diarizationDirectory: join(this.modelRoot, 'diarization'), speakerCount} : {}),
        engine: preset?.engine ?? settings.speech.engine, modelDirectory,
        ...(Buffer.isBuffer(audioPath) ? { audioBase64: audioPath.toString('base64') } : { audioPath }),
        language: settings.speech.language,
        ...(settings.speech.language === 'de-medical' ? {medicalTerms: settings.modeSettings.customTerms ?? []} : {}),
      }, { pythonPath: this.pythonPath, signal });
      signal.throwIfAborted();
      if (typeof recognized.text !== 'string') throw new Error('Ungültiges Transkript.');
      // Near-miss technical terms, before rewriting and insertion; each change stays visible.
      const corrected = await correctRecognized(recognized, settings, { misspelled: this.misspelled });
      signal.throwIfAborted();
      const entry = { id: randomUUID(), createdAt: new Date().toISOString(), mode,
        original: corrected.text, text: corrected.text, segments: corrected.segments ?? [], corrections: corrected.corrections,
        language: recognized.language, speechModel: preset?.id ?? 'custom', warning: recognized.warning ?? null };
      if (corrected.correctionSkipped)
        entry.warning = [entry.warning, 'Fachbegriffe nicht korrigiert: Windows-Rechtschreibprüfung für die Diktatsprache nicht verfügbar.'].filter(Boolean).join('\n');
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
