# Status: BlitzDic für Windows 11

Stand: 20.11.2026

## Aktueller Auftrag und nutzbarer Stand

Die lokale Diktier-App mit Whisper und Parakeet steht im Vordergrund. Keine neue
Test-VM, keine zusätzlichen Funktionen und keine umfangreiche Testinfrastruktur.
Weitere Arbeiten werden nach Rückmeldung zur Benutzung festgelegt.

- Installer: **BlitzDic Setup 0.3.10-dev.25.exe** im Hauptordner, Windows 11 **x64**
  (SHA-256 `b6bde70bbb2e94b1d39b534a6f20f10bd03ce1964ec255cd0cd4c7d86c3bb8fa`).
- Voreinstellung neuer Installationen: **Wortgenau**, **Parakeet Ultra (NVIDIA / Moondream)**,
  **Medizinisches Deutsch** mit **Fachbegriff-Korrektur**.
- **Whisper Small** ist unter **Modelle** auswählbar.
- Ältere Einträge: dev.24 lief auf dem früheren Arbeitsrechner über **BlitzDic Lokal.lnk**.
- Beide Modelle und die Sprachlaufzeit sind enthalten. Für Diktate sind kein
  zusätzliches Python, Visual Studio, CUDA, LM Studio oder OpenAI-Konto nötig.
- Die lokale Ausgabe wurde direkt gestartet; die ältere registrierte
  Testinstallation dev.20 wurde dabei nicht entfernt oder aktualisiert.
- Dev.24-Installer und Prüfsumme liegen lokal und als unveröffentlichter
  [privater Release-Entwurf](https://github.com/phil2001/2026-10_BlitzDic/releases/tag/untagged-844c147fb152289d0ade)
  vor. Hochgeladene Größe und SHA-256 sind abgeglichen. Der Installer ist unsigniert; eine Freigabe für alle Ordinations-PCs ist
  damit noch nicht belegt.

Dev.25 wurde am 20.11.2026 auf diesem Rechner gebaut und als entpackte App geprüft:
Pakettest mit beiden Modellen, Lizenzen und LLM-Testserver, Fachbegriff-Korrektur
(„Apexaban“ → „Apixaban“, abgeschaltet unverändert) und das Prüfskript für Arbeitsplätze.
Das Setup selbst wurde hier noch nicht ausgeführt; ein Release auf GitHub gibt es dafür nicht.

## Sprachwahl: umgesetzt in dev.24

Unter **Diktat → Diktatsprache** stehen **Medizinisches Deutsch** (Standard),
**Deutsch** und **Englisch** zur Auswahl. Alte automatische Spracheinstellungen
werden auf medizinisches Deutsch umgestellt; eine gespeicherte feste deutsche
oder englische Auswahl bleibt erhalten.

Whisper erhält fest `de` oder `en`. Medizinisches Deutsch verwendet ebenfalls
`de`, ergänzt um einen deutschen medizinischen Kontexthinweis und die vorhandenen
**Eigenen Begriffe** aus Einstellungen. Es ist kein separat medizinisch trainiertes
oder klinisch validiertes Modell; Fachbegriffe, Zahlen und Einheiten prüfen.

**Parakeet** bestimmt die Sprache modellintern. Seit dev.25 bleibt die Sprachwahl
auch dafür aktiv: Medizinisches Deutsch schaltet die Fachbegriff-Korrektur mit dem
mitgelieferten Wörterbuch ein. Für fest vorgegebenes Deutsch bitte Whisper wählen.

Die gemeldete arabische Ausgabe wurde mit der Originalaufnahme nicht reproduziert.
Die frühere automatische Whisper-Spracherkennung war eine plausible Ursache.
Synthetische deutsche, englische und medizinisch-deutsche Audiodateien wurden im
gebauten Paket korrekt mit den erwarteten Sprachen erkannt; kein arabischer Text.
Beide enthaltenen Modelle bestanden zusätzlich den bestehenden Pakettest.

Offen bei erneutem Auftreten: ausgewähltes Modell und Profil notieren; echte
Mikrofonqualität und problematische Fachbegriffe gezielt prüfen. Die synthetischen
Tests ersetzen keinen Genauigkeitsnachweis für medizinische Diktate.

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
