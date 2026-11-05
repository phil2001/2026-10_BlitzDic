# Status: BlitzDic für Windows 11

Stand: 05.11.2026

## Aktueller Auftrag und nutzbarer Stand

Die lokale Diktier-App mit Whisper und Parakeet steht im Vordergrund. Keine neue
Test-VM, keine zusätzlichen Funktionen und keine umfangreiche Testinfrastruktur.
Weitere Arbeiten werden nach Rückmeldung zur Benutzung festgelegt.

- Lokale Ausgabe: **0.3.10-dev.23**, Windows 11 **x64**.
- Start auf diesem Rechner: **BlitzDic Lokal.lnk** im Projektordner.
- Voreinstellung bei Übergabe: **Wortgenau**, **Whisper Small**.
- **Parakeet Ultra (NVIDIA / Moondream)** ist unter **Modelle** auswählbar.
- Beide Modelle und die Sprachlaufzeit sind enthalten. Für Diktate sind kein
  zusätzliches Python, Visual Studio, CUDA, LM Studio oder OpenAI-Konto nötig.
- Die lokale Ausgabe wurde direkt gestartet; die ältere registrierte
  Testinstallation dev.20 wurde dabei nicht entfernt oder aktualisiert.
- Vollständiger Installer und Prüfsumme liegen als privater GitHub-Release-Entwurf
  vor. Der Installer ist unsigniert; eine Freigabe für alle Ordinations-PCs ist
  damit noch nicht belegt.

## Priorität 1: unerwarteter Sprachwechsel

**Neue Benutzerrückmeldung:** Eine lokale Aufnahme ergab arabischen Text, eine
andere deutschen Text. Noch nicht reproduziert. Modell, genaue Aufnahme und
erkannte Sprachkennung der beiden Vorgänge wurden nicht ausgelesen.

**Im Code bestätigt:** `speech.language` ist standardmäßig leer. Der
Whisper-Worker übergibt dann `language=None`; faster-whisper erkennt die Sprache
automatisch. Eine feste deutsche Vorgabe wurde bei der lokalen Bereitstellung
nicht gesetzt. Das ist eine plausible Erklärung, falls Whisper aktiv war, aber
noch kein Nachweis für die Ursache dieses konkreten Ergebnisses.

Die Oberfläche bietet derzeit keine sichtbare Auswahl der Diktatsprache.
Der Parakeet-Zweig verwendet `model.recognize(...)` und erzwingt die übergebene
Whisper-Sprachvorgabe nicht; die beiden Engines müssen getrennt behandelt werden.

Nächste kleine Schritte, sobald diese Fehlerbehebung beauftragt wird:

- [ ] Bei einem erneuten Auftreten das ausgewählte Modell notieren.
- [ ] Für deutsche Whisper-Diktate die vorhandene Spracheinstellung auf `de`
      festlegen; automatische Erkennung bei Bedarf weiterhin ermöglichen.
- [ ] Mit einem neutralen deutschen Testsatz die Erkennung vergleichen;
      kurze/undeutliche Aufnahmen und das gewählte Mikrofon berücksichtigen.
- [ ] Dasselbe mit Parakeet prüfen und die Ergebnisse getrennt dokumentieren.

Es wurde für diesen Statusbericht keine App-Einstellung geändert und kein neuer
Build erstellt. Die Sprachkorrektur ist **offen**.

Referenz zur automatischen Erkennung und zum Parameter `language`:
[faster-whisper, ursprünglicher Quellcode](https://github.com/SYSTRAN/faster-whisper/blob/master/faster_whisper/transcribe.py).
Lokale Stellen: `BlitzDicWindows/src/store.js`, `src/dictation.js` und
`speech/worker.py` (die beiden letzten relativ zu `BlitzDicWindows`).

## Weitere Arbeiten, nach Bedarf

1. **Lokales Diktieren stabilisieren:** echte Mikrofonaufnahmen mit beiden
   Modellen, deutsche Namen/Fachbegriffe und Mikrofonwahl prüfen. Frühere Tests
   enthielten Erkennungsfehler; zuletzt wurde ein korrekter deutscher Satz vom
   Benutzer zurückgemeldet. Das ist kein allgemeiner Genauigkeitsnachweis.
2. **Weitere Ordinations-PCs:** Installation auf einem tatsächlich verfügbaren
   Windows-11-PC prüfen. 16 GB RAM sind empfohlen; eine belastbare Mindestgrenze
   sowie 8-GB-PCs sind nicht verifiziert. Es wird keine Test-VM erstellt.
3. **Einfügen und Tastenkürzel:** bei Problemen gezielt am betroffenen Programm
   nachprüfen. Chrome/Whisper, Word und klassische Felder haben dev.20-Tests
   bestanden; das ersetzt nicht jede Office-/Browser-Konfiguration.
4. **Spätere Weitergabe:** Signierung, übrige Weitergabe-/Lizenzabnahmen und
   Veröffentlichung des Installers abschließen. Lizenztexte und zugehörige
   FFmpeg-Quellen sind bereits gebündelt.
5. **Nur auf Wunsch:** vorhandene LLM-Anbindungen mit einem echten lokalen,
   Netzwerk- oder API-Anbieter prüfen. Die Konfiguration ist vorhanden; ein
   gemeinsamer Netzwerkserver steht noch nicht bereit. Für Wortgenau unnötig.
6. **Optionaler Bestand:** Meetings, Sprecherzuordnung, Live-Notizen, Echo-Filter
   und Stummschaltung haben begrenzte bzw. experimentelle Testabdeckung. Deren
   weitere Abnahme ist zurückgestellt und erweitert nicht den aktuellen Auftrag.

## Nachweise und ausführliche Unterlagen

- [README.md](README.md): Windows-Anleitung und aktueller Installerpfad.
- [ROADMAP.md](ROADMAP.md): zurückgestellte Arbeiten und Funktionsübersicht.
- [WINDOWS_PORT.md](WINDOWS_PORT.md): ausführliche, versionsbezogene Prüfchronik.
- [Systemvoraussetzungen](BlitzDicWindows/SYSTEMVORAUSSETZUNGEN.md).

Die Prüfchronik ist historischer Nachweis, kein Auftrag, alle dort genannten
Zusatzarbeiten automatisch wieder aufzunehmen. Bei Fortsetzung zuerst den
aktuellen Benutzerwunsch und diesen Status berücksichtigen.
