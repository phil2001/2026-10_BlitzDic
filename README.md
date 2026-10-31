# BlitzDic für Windows 11

BlitzDic ist eine Windows-11-Diktier-App mit lokaler Spracherkennung durch
**OpenAI Whisper Small** und **Parakeet Ultra (NVIDIA / Moondream)**.
Beide Modelle und die Sprachlaufzeit sind im vollständigen Windows-Paket enthalten.
Keine separate Python-Installation, kein LM Studio und kein nachträglicher Modelldownload nötig. Für reine Spracherkennung ist auch kein OpenAI-Konto erforderlich.

**Status: Entwicklungsversion. Noch keine fertig geprüfte Veröffentlichung.**

## Funktionen

- Lokale Transkription von Mikrofonaufnahmen und Audiodateien.
- Vier Schreibmodi: Wortgenau, Überarbeiten, Ruhig formulieren und Mit Emojis.
- Textüberarbeitung mit einem lokalen LLM über Ollama oder LM Studio, einem
  KI-Computer im Netzwerk oder einer API. Anbieter und Modell sind frei wählbar.
- OpenAI, Anthropic, Gemini, Mistral, OpenRouter und kompatible eigene Endpunkte.
- Eigene kompatible Sprachmodelle über lokale Modellordner.
- Windows-Infobereich, einstellbare globale Tastenkürzel, Wörterbuch-Ersetzungen
  und Schreibmodus-Regeln je Programm.
- Meetings mit Mikrofon, Systemaudio oder beiden Quellen; optionale Sprecherzuordnung,
  lokales Speichern von Transkripten und Zusammenfassungen über den gewählten LLM-Anbieter.
- Verschlüsselte Einstellungen, API-Schlüssel und Verlauf über Windows-DPAPI.
- Systemvoraussetzungen direkt bei der Modellauswahl.

## Voraussetzungen

Windows 11 x64, moderner Intel-/AMD-Mehrkernprozessor. 16 GB RAM empfohlen;
eine verbindliche RAM-Mindestgrenze ist noch nicht ermittelt. Eine NVIDIA-GPU
ist für den aktuellen CPU-Betrieb nicht erforderlich. Beide Modelle belegen
zusammen etwa 1,16 GB. Zunächst mindestens 5 GB freien SSD-Speicher einplanen.

Details und Quellen: [Systemvoraussetzungen](BlitzDicWindows/SYSTEMVORAUSSETZUNGEN.md).
Ein zusätzliches lokales LLM hat eigene RAM-/VRAM-Anforderungen.

## Installation und Bedienung

Der aktuelle lokal gebaute Entwicklungsinstaller ist **0.3.4** unter
`BlitzDicWindows/dist/windows-2026-10-31T21-12-11-505Z-1fdc73/BlitzDic Setup 0.3.4.exe`
(etwa 1,14 GB). Er ist nicht signiert. Eine fertige Release-Datei ist noch nicht
veröffentlicht. Ältere Testbuilds bitte durch diesen Stand ersetzen: 0.3.4 behebt
die UTF-8-Verarbeitung von Umlauten und Emoji in der gebündelten Sprachlaufzeit.

1. Nach Installation BlitzDic öffnen und unter **Modelle** Whisper oder Parakeet wählen.
2. Unter **Diktat** Mikrofon und Schreibmodus wählen, Aufnahme starten und beenden.
3. Für Schreibmodi außer Wortgenau unter **Verbindungen** einen LLM-Server einrichten.
   LM Studio verwendet üblicherweise `http://127.0.0.1:1234/v1`,
   Ollama `http://127.0.0.1:11434/v1`. Für einen Netzwerk-PC dessen Adresse einsetzen.
4. Modellnamen abrufen oder eingeben, Verbindung testen und speichern.
5. Text kopieren. Beim Schließen bleibt die App im Infobereich; dort lässt sie sich beenden.

Standard-Tastenkürzel: Strg+Umschalt+1 bis 4 für die vier Modi.
Einmal drücken startet, erneut drücken beendet die Aufnahme.
Zum Einfügen den Cursor zuerst im Zielprogramm setzen und dort das Kürzel benutzen.
Bleiben Feld, Inhalt und Auswahl unverändert, wird das Ergebnis dort eingefügt.
Bei einer Änderung oder verweigertem Zugriff bleibt der Text in BlitzDic verfügbar.
Geprüft wurden klassische Edit-/RichEdit-Felder, Chromium und Word;
Details und Grenzen stehen unter [Windows-Einfügen](BlitzDicWindows/speech/WINDOWS_INSERTION.md).

## Programmregeln und Meetings

Unter **Einstellungen** lassen sich Regeln wie `winword.exe => clean` und
`chrome.exe => calm` speichern. Erlaubte Modi: `verbatim`, `clean`, `calm`,
`emoji`. Regeln gelten für das Wortgenau-Kürzel; andere Modus-Kürzel behalten
ihre ausdrückliche Auswahl.

Unter **Meetings** vorhandene Transkripte eingeben, das letzte Diktat übernehmen
oder Audio aufnehmen. Quellen sind Mikrofon, gesamte Windows-Audioausgabe oder
beides. Das Mikrofon wird unter **Diktat** gewählt. Nach dem Beenden wird jeder
Abschnitt lokal erkannt und ans Transkript angehängt. Maximal 30 Minuten pro
Abschnitt; Systemaudio benötigt eine kurze Anlaufzeit. Endet eine Quelle während
der Aufnahme, wird das vorhandene Audio abgeschlossen und der Vorfall angezeigt.

Sprechertrennung ist optional und experimentell. Eine bekannte Sprecherzahl
von 1 bis 20 ist zuverlässiger als die automatische Schätzung. Sprecherkennungen
gelten nur innerhalb eines Aufnahmeabschnitts; echte Namen werden nicht erkannt.
Die dafür nötigen Zusatzmodelle sind enthalten.

**Transkript lokal speichern** arbeitet ohne LLM. **Zusammenfassen und speichern**
sendet das Transkript an den unter **Verbindungen** gewählten Endpunkt und speichert
Original und Zusammenfassung verschlüsselt. Bis zum Speichern bleibt das Transkript
nur im geöffneten Fenster. Gespeichert werden maximal 100 Meetings. LLM-Ergebnisse
müssen auf Zuordnung von Aufgaben, Zahlen und offenen Fragen geprüft werden.

## Entwicklung unter Windows 11

Benötigt: Node.js 22 oder neuer, npm und uv. PowerShell im Projektordner:

```powershell
cd BlitzDicWindows
npm.cmd ci
node node_modules/electron/install.js
./scripts/setup-speech.ps1
```

Modelle für Entwicklung und Paketierung bereitstellen:

```powershell
'{"action":"download","preset":"whisper","modelDirectory":"models/whisper"}' | .runtime/venv/Scripts/python.exe speech/worker.py
'{"action":"download","preset":"parakeet-ultra","modelDirectory":"models/parakeet-ultra"}' | .runtime/venv/Scripts/python.exe speech/worker.py
npm.cmd start
npm.cmd test
```

Installer bauen:

```powershell
uv pip install --python .runtime/venv/Scripts/python.exe pyinstaller==6.22.3
.runtime/venv/Scripts/python.exe scripts/setup-diarization.py
npm.cmd run build:win
```

Der Build erstellt neue Ordner mit Zeitstempel unter `build/` und `dist/`, sammelt Lizenztexte und baut die Sprachlaufzeit automatisch. Vorhandene Builds bleiben erhalten. Das Lizenzinventar nennt verbleibende Prüfungen ausdrücklich.

Die beiden großen Sprachmodelle sind keine Git-Dateien; der Installer übernimmt
sie aus den lokalen Modellordnern. Sprachtests mit echten Gewichten werden über
`BLITZDIC_ASR_TEST=1` aktiviert; siehe [Testanleitung](BlitzDicWindows/speech/README.md).

## Noch offen

Physische Mikrofontests, weitere Office-/Browser-Versionen, abschließender
Designabgleich, vollständige Prüfung der nativen Lizenzpflichten, Signierung und
der Test in einer frischen Windows-VM bleiben offen. Beide enthaltenen Sprachmodelle
und die gepackte App wurden auf dem Entwicklungs-PC mit frischem App-Profil geprüft.
Der verfügbare Installer ist daher kein Nachweis der Fertigstellung.

[Arbeitsstand](WINDOWS_PORT.md) · [Datenschutz](PRIVACY.md) · [Mitwirken](CONTRIBUTING.md)

## Herkunft und Lizenz

Windows-Fork von [cmagnussen/blitztext-app](https://github.com/cmagnussen/blitztext-app).
Die ursprüngliche Git-Historie bleibt erhalten. BlitzDic verwendet einen eigenen
Namen und eigene Oberfläche. Dieses Repository entwickelt ausschließlich Windows 11.
MIT-Lizenz: [LICENSE](LICENSE). Modelle und Abhängigkeiten haben eigene
[Lizenzhinweise](THIRD_PARTY_NOTICES.md).
