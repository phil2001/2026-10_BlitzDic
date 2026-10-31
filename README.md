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
- Windows-Infobereich, einstellbare globale Tastenkürzel, Wörterbuch-Ersetzungen.
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

Der bisher lokal gebaute Entwicklungsinstaller liegt unter
`BlitzDicWindows/dist/windows-2026-10-31T16-22-46-818Z-038b2c/BlitzDic Setup 0.1.0.exe` und ist etwa
1,10 GB groß. Er ist nicht signiert und enthält die aktuelle Diktat- und Einfügelaufzeit. Eine fertige Release-Datei ist noch nicht veröffentlicht.

1. Nach Installation BlitzDic öffnen und unter **Modelle** Whisper oder Parakeet wählen.
2. Unter **Diktat** Mikrofon und Schreibmodus wählen, Aufnahme starten und beenden.
3. Für Schreibmodi außer Wortgenau unter **Verbindungen** einen LLM-Server einrichten.
   LM Studio verwendet üblicherweise `http://127.0.0.1:1234/v1`,
   Ollama `http://127.0.0.1:11434/v1`. Für einen Netzwerk-PC dessen Adresse einsetzen.
4. Modellnamen abrufen oder eingeben, Verbindung testen und speichern.
5. Text kopieren. Beim Schließen bleibt die App im Infobereich; dort lässt sie sich beenden.

Standard-Tastenkürzel: Strg+Umschalt+1 bis 4 für die vier Modi.
Einmal drücken startet, erneut drücken beendet die Aufnahme.

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
npm.cmd run build:win
```

Der Build erstellt neue Ordner mit Zeitstempel unter `build/` und `dist/`, sammelt Lizenztexte und baut die Sprachlaufzeit automatisch. Vorhandene Builds bleiben erhalten. Das Lizenzinventar nennt verbleibende Prüfungen ausdrücklich.

Die beiden großen Sprachmodelle sind keine Git-Dateien; der Installer übernimmt
sie aus den lokalen Modellordnern. Sprachtests mit echten Gewichten werden über
`BLITZDIC_ASR_TEST=1` aktiviert; siehe [Testanleitung](BlitzDicWindows/speech/README.md).

## Noch offen

Automatisches Einfügen wurde in klassischen Windows-Textfeldern und Chromium-Webfeldern geprüft. Details und Grenzen: [Windows-Einfügen](BlitzDicWindows/speech/WINDOWS_INSERTION.md). Office-Unterstützung,
Meeting-Funktionen, physische Mikrofontests, abschließender Designabgleich,
vollständige Lizenzpaketierung und ein sauberer Installationstest bleiben offen.
Der verfügbare Installer ist daher kein Nachweis der Fertigstellung.

[Arbeitsstand](WINDOWS_PORT.md) · [Datenschutz](PRIVACY.md) · [Mitwirken](CONTRIBUTING.md)

## Herkunft und Lizenz

Windows-Fork von [cmagnussen/blitztext-app](https://github.com/cmagnussen/blitztext-app).
Die ursprüngliche Git-Historie bleibt erhalten. BlitzDic verwendet einen eigenen
Namen und eigene Oberfläche. Dieses Repository entwickelt ausschließlich Windows 11.
MIT-Lizenz: [LICENSE](LICENSE). Modelle und Abhängigkeiten haben eigene
[Lizenzhinweise](THIRD_PARTY_NOTICES.md).
