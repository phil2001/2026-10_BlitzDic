# Status: BlitzDic für Windows 11

Stand: 23.11.2026

## Aktueller Auftrag und nutzbarer Stand

Die lokale Diktier-App mit Whisper und Parakeet steht im Vordergrund. Keine neue
Test-VM, keine zusätzlichen Funktionen und keine umfangreiche Testinfrastruktur.

- Unveröffentlicht (26.11.2026): Fachbegriff-Korrektur mit erweitertem Wörterbuch
  (`src/medical-terms-de-generated.txt`, rund 26.000 Begriffe aus ICD-10-GM 2026, OPS 2027,
  deutschem MeSH 2026 und EMA-Artikel-57-Daten für Österreich/EU). Erzeugt mit
  `scripts/build-medical-lexicon.py` aus dem lokalen, nicht versionierten Ordner `Lern-Daten`.
  Messung mit künstlichen Fehlern: neue ICD/OPS- und Arzneimittelbegriffe werden zu fast 100 %
  korrigiert (vorher 0 %). Synthetisches Diktat (Hedda) mit Parakeet: zusätzlich „Xerelto“ →
  „Xarelto“, keine Fehlkorrektur. Mit echter Stimme und im Paket noch nicht geprüft.
- Unveröffentlicht (26.11.2026): Abgleich nach Klang (Kölner Phonetik mit Vokalstellen), wenn die
  Schreibweise allein keinen Begriff findet. Künstliche Klangfehler bleiben statt zu rund 8 % nur
  noch zu gut 1 % unkorrigiert; Namen unverändert. Hedda-Diktat: je Modell drei weitere richtige
  Korrekturen (z. B. „Novalgen“, „Pantoprazul“, „Polakisuri“), keine Fehlkorrektur. Englische
  Wörter werden öfter eingedeutscht („Complete“ → „Komplette“); Schutz vor Änderungen richtiger
  Wörter bleibt die Windows-Rechtschreibprüfung („Patientin“ würde sonst zu „Patienten“).
Weitere Arbeiten werden nach Rückmeldung zur Benutzung festgelegt.

- Version **1.0.2**: **BlitzDic Setup 1.0.2.exe** unter
  [Veröffentlichungen](https://github.com/phil2001/BlitzDic/releases/tag/v1.0.2), Windows 11
  **x64** (SHA-256 `e1aa1fbfbd042aa691a5e37b8c1c41f6c620b92065948a895b8faea864a1926d`).
  Neu: Einfügen in CGM PcPo (Visual-Basic-6-Felder der Kartei und TX Text Control), am
  23.11.2026 auf dem Ordinations-PC mit PcPo installiert und dort laut Rückmeldung mit
  Diktat erfolgreich getestet.
  Außerdem verwaltet nur die installierte Kopie den Windows-Autostart.
  Das Repository ist öffentlich und heißt seit 21.11.2026 `phil2001/BlitzDic` (früher
  `2026-10_BlitzDic`). Release 1.0.0 wurde entfernt, weil seine Update-Prüfung den alten Namen
  nutzt; der Git-Tag v1.0.0 bleibt. Updates: in der App „Auf neue Version prüfen“, dann das
  neue Setup über „Veröffentlichungen öffnen“ herunterladen und starten.
  Auf dem Entwicklungs-PC wurde am 21.11.2026 1.0.1 installiert.
- Voreinstellung neuer Installationen: **Wortgenau**, **Parakeet Ultra (NVIDIA / Moondream)**,
  **Medizinisches Deutsch** mit **Fachbegriff-Korrektur**.
- **Whisper Small** ist unter **Modelle** auswählbar.
- Tastenkürzel (seit dev.26): **Alt+Leertaste** Wortgenau,
  **Alt+Leertaste+1/2/3** Überarbeiten, Ruhig formulieren, Mit Emojis. Kürzelfelder nehmen
  die gedrückten Tasten auf. Auf diesem PC belegt Google Gemini Alt+Leertaste.
- Ältere Einträge: dev.24 lief auf dem früheren Arbeitsrechner über **BlitzDic Lokal.lnk**.
- Beide Modelle und die Sprachlaufzeit sind enthalten. Für Diktate sind kein
  zusätzliches Python, Visual Studio, CUDA, LM Studio oder OpenAI-Konto nötig.
- Die lokale Ausgabe wurde direkt gestartet; die ältere registrierte
  Testinstallation dev.20 wurde dabei nicht entfernt oder aktualisiert.
- Dev.24-Installer und Prüfsumme liegen lokal und als unveröffentlichter
  [privater Release-Entwurf](https://github.com/phil2001/BlitzDic/releases/tag/untagged-844c147fb152289d0ade)
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
