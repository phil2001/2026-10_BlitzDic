# BlitzDic für Windows 11

BlitzDic ist eine Windows-11-Diktier-App mit lokaler Spracherkennung durch
**OpenAI Whisper Small** und **Parakeet Ultra (NVIDIA / Moondream)**.
Beide Modelle und die Sprachlaufzeit sind im vollständigen Windows-Paket enthalten.
Keine separate Python-Installation, kein LM Studio und kein nachträglicher Modelldownload nötig. Für reine Spracherkennung ist auch kein OpenAI-Konto erforderlich.

**Bereitstellung in der Ordination:** Ein vollständiger BlitzDic-Installer pro
Windows-11-x64-Arbeitsplatz ist das Ziel. Whisper, Parakeet und die benötigten
Sprachlaufzeiten werden mitgeliefert. Auf den Arbeitsplätzen sollen weder Visual
Studio noch Python, CUDA oder ein gesondertes C++-Laufzeitpaket installiert werden
müssen. Visual Studio Community gehört zur Entwicklungsumgebung. Die Installation
auf einem frischen Windows-11-PC ohne Entwicklertools ist noch zu verifizieren.
Für optionale KI-Textüberarbeitung kann ein gemeinsamer LLM-Server im Netzwerk
konfiguriert werden; dann wird auf den Arbeitsplätzen kein LM Studio benötigt.

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
- Abschaltbare Aufnahmeanzeige mit Pegel, Laufzeit, Ziehgriff und Stopp-Knopf.
- Meetings mit Mikrofon, Systemaudio oder beiden Quellen; optionale Sprecherzuordnung,
  lokales Speichern von Transkripten und Zusammenfassungen über den gewählten LLM-Anbieter.
- Manuelle Sprechernamen je Aufnahmeabschnitt; Original-IDs bleiben gespeichert.
- Optionale vorläufige Live-Notizen und Rückblick auf die letzten zehn Minuten.
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

Der zuletzt vollständig im nativen Test geprüfte lokale Entwicklungsinstaller ist
**0.3.10-dev.1** unter
`BlitzDicWindows/dist/windows-2026-11-01T06-58-02-880Z-ac79d7-verified/BlitzDic Setup 0.3.10-dev.1.exe`
(etwa 1,15 GB). Er ist nicht signiert. Eine fertige Release-Datei ist noch nicht
veröffentlicht. Ältere Testbuilds bitte durch diesen Stand ersetzen: 0.3.4 behebt
die UTF-8-Verarbeitung von Umlauten und Emoji in der gebündelten Sprachlaufzeit.
0.3.5 enthält den eigenen FFmpeg-Build mit zugehörigem Quellcode und einen
Lizenzordner-Zugriff unter **Einstellungen**. Die Prüfung anderer nativer
Bibliotheken ist noch nicht abgeschlossen.
0.3.6 benötigt kein libsndfile/SoundFile mehr und lässt die ungenutzte
cuDNN-Bibliothek im CPU-Paket weg. Unterstützte Audioimporte und beide Sprachmodelle
bleiben verfügbar; die gepackte Meeting-Sprechertranskription wurde geprüft.
0.3.7 passt beim automatischen Einfügen Abstände und Satzanfänge an den Text
um den Cursor an. Diese Regeln arbeiten lokal, auch ohne LLM. Das Transkript im
Ergebnis und Verlauf bleibt erhalten. Die installierte Testversion ist weiterhin
0.3.6; der neue Installer wurde noch nicht als Upgrade ausgeführt.
0.3.8 ergänzt eine kleine Aufnahmeanzeige über den übrigen Fenstern. Sie zeigt
Pegel und Laufzeit, ohne den Fokus des Zielprogramms zu übernehmen. Am linken
Griff lässt sie sich verschieben, ein Klick auf die Anzeige beendet das Diktat
oder den Meeting-Abschnitt. × oder Rechtsklick blendet sie für die laufende
Aufnahme aus; unter **Einstellungen** ist sie dauerhaft abschaltbar.
0.3.9 ergänzt abschnittsgebundene Sprechernamen. Bei gespeicherten Meetings werden
die Namen im selben Archiveintrag aktualisiert. Frühere Zusammenfassungen bleiben
erhalten und werden bei geänderten Namen als veraltet gekennzeichnet.

1. Nach Installation BlitzDic öffnen und unter **Modelle** Whisper oder Parakeet wählen.
2. Unter **Diktat** Mikrofon und Schreibmodus wählen, Aufnahme starten und beenden.
   Ab 0.3.10-dev.10 merkt sich BlitzDic die Mikrofonwahl für Diktate und Meetings.
   Falls das Gerät fehlt, es erneut verbinden oder **Standardmikrofon** wählen.
3. Für Schreibmodi außer Wortgenau unter **Verbindungen** einen LLM-Server einrichten.
   LM Studio verwendet üblicherweise `http://127.0.0.1:1234/v1`,
   Ollama `http://127.0.0.1:11434/v1`. Für einen Netzwerk-PC **KI-Computer im Netzwerk**
   und die Adresse dieses Rechners wählen, zum Beispiel `http://ki-pc:1234`.
   Der aktuelle Quellstand ergänzt bei LM Studio und Ollama `/v1`, wenn die
   Adresse nur aus Host und Port besteht. Bei einer eigenen API den Basis-Pfad
   des Servers angeben.
4. Modellnamen abrufen oder eingeben, Verbindung testen und speichern.
5. Text kopieren. Beim Schließen bleibt die App im Infobereich; dort lässt sie sich beenden.

Ein weiteres Sprachmodell bindest du unter **Modelle → Eigenes kompatibles
Modell** ein. Wähle **Whisper / CTranslate2** für einen vollständigen
CTranslate2-Modellordner oder **Parakeet TDT / ONNX INT8** für einen vollständigen
ONNX-Export im onnx-asr-Format. Klicke dann auf **Modellordner auswählen** und
wähle den Ordner, der die Gewichte und die zugehörigen Konfigurations- und
Tokenizerdateien enthält. BlitzDic lädt das gewählte Modell lokal aus diesem
Ordner.

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

Unter dem Transkript lassen sich Sprecher manuell benennen. **Namen übernehmen**
aktualisiert die Vorschau; ein leeres Namensfeld stellt die ursprüngliche ID wieder her.
Bei einem geöffneten gespeicherten Meeting heißt der Knopf **Namen übernehmen und
speichern** und ändert denselben Eintrag. Bei neuen Transkripten anschließend lokal
speichern oder zusammenfassen. Original-IDs und Namen werden getrennt verschlüsselt
gespeichert. Überlappende Beiträge bleiben als solche markiert. Beim ausdrücklichen
Zusammenfassen erhält der gewählte LLM-Endpunkt die benannten Sprecherzeilen.
Manuelle Änderungen am Transkript übernehmen den sichtbaren Text und setzen die
Zuordnungen zurück; das gespeicherte Original bleibt bis zu einer neuen Speicherung erhalten.

**Transkript lokal speichern** arbeitet ohne LLM. **Zusammenfassen und speichern**
sendet das Transkript an den unter **Verbindungen** gewählten Endpunkt und speichert
Original und Zusammenfassung verschlüsselt. Bis zum Speichern bleibt das Transkript
nur im geöffneten Fenster. Gespeichert werden maximal 100 Meetings. LLM-Ergebnisse
müssen auf Zuordnung von Aufgaben, Zahlen und offenen Fragen geprüft werden.

## Entwicklung unter Windows 11

Der Quellstand **0.3.10-dev.11** enthält zusätzlich Website-Regeln. Unter
**Einstellungen → Schreibmodus pro Website** etwa
`example.com => clean` und `mail.example.com => calm` eintragen. Eine Domain
umfasst ihre Unterdomains; die spezifischste Website-Regel hat Vorrang vor der
Programmregel. Das gilt für das Wortgenau-Kürzel. Explizite Modus-Kürzel bleiben
unverändert. Ohne konfiguriertes LLM bleibt der Text wortgenau. Gespeichert wird
nur der Hostname; Pfad und Suchparameter gelangen nicht in Verlauf oder LLM-Anfrage.
Kann das fokussierte Browser-Dokument nicht sicher zugeordnet werden, gilt die
Programmregel. Die neue Fassung wurde noch nicht als Upgrade installiert.
Die Host- und Frame-Erkennung ist in Edge und Chrome geprüft. Parakeet hat mit
Halten-zum-Diktieren in Edge Website-Vorrang, explizite Moduswahl und den Fall ohne
LLM bis zum Einfügen bestanden, auch mit der gepackten App 0.3.10-dev.3.
Chrome/Whisper und Word/klassische Felder bleiben im neuen Paket zu prüfen.
Der Quellstand prüft Fenster und Prozess vor der erneuten Feldlesung zum Einfügen.
Ein neuer Build liegt unter
`BlitzDicWindows/dist/windows-2026-11-04T12-16-15-585Z-23ed47/BlitzDic Setup 0.3.10-dev.11.exe`.
Dieser Build verwendet für Whisper Small eine CTranslate2-Laufzeit mit Ruy ohne
Intel-OpenMP-DLL. Die beiden mitgelieferten Sprachmodelle bleiben dieselben.
Beide gebündelten ASR-Engines und die Sprechertrennung sind im neuen Worker
geprüft; die native Browser-Abnahme steht noch aus.

0.3.10-dev.4 ergänzt experimentell **Windows-Ausgabe während eines Diktats
stummschalten** unter Einstellungen. Die Option ist zunächst aus. Sie betrifft
das zu Aufnahmebeginn gewählte Windows-Standardwiedergabegerät; beim Beenden
oder Abbrechen wird nur die eigene Stummschaltung zurückgenommen. Eine bereits
stumme Ausgabe bleibt stumm, der Lautstärkepegel wird nicht geändert. Meetings
bereiten keine Stummschaltung vor. Fehler lassen das Diktat weiterlaufen und
werden angezeigt. Die echte Stummschaltung und der Ablauf im neuen Paket sind
noch zu prüfen; bisher sind Zustands-/Abbruchtests, Renderer und eine rein
lesende Core-Audio-Abfrage bestanden.

0.3.10-dev.5 ergänzt **vorläufige Live-Notizen** unter Meetings. Vor jeder
Aufnahme separat aktivieren; die Oberfläche zeigt die dafür verwendete Verbindung.
Etwa alle zweieinhalb Minuten oder mit **Jetzt aktualisieren** wird der neue
Audioabschnitt lokal transkribiert und der Text über den gewählten lokalen,
LAN- oder API-Anbieter zusammengefasst. Die Verbindung bleibt für diesen Abschnitt
fest. **Was habe ich in den letzten zehn Minuten verpasst?** erzeugt einen Rückblick.
Dafür ist zusätzlich zu Whisper/Parakeet ein erreichbares LLM erforderlich.
Die vollständige Aufnahme bleibt für das abschließende Transkript erhalten;
Live-Notizen haben keine Sprecherzuordnung und werden nicht automatisch gespeichert.
Die Vorschau kann nach Fehlern oder langen Pausen unvollständig sein; dies wird
angezeigt. Ergebnisse prüfen und bei Bedarf kopieren. Renderer, Abbruchlogik und
beide echten ASR-Modelle mit einem simulierten HTTP-LLM sind geprüft. Echte
Meeting-Audioaufnahme und LLM-Qualität dieser Funktion bleiben zu prüfen.

0.3.10-dev.6 ergänzt bei **Mikrofon und Systemaudio** den experimentellen
Echo-Filter für das abschließende Transkript. Beide Quellen werden synchron getrennt
aufgenommen und lokal mit dem gewählten Sprachmodell erkannt. Wortzeitpunkte helfen,
Lautsprecher-Echos aus der Mikrofonspur zu entfernen; die Systemspur bleibt erhalten.
Der Filter ist für diese Quellenauswahl zunächst an und vor dem nächsten Abschnitt
abschaltbar. Er benötigt zusätzliche Erkennungszeit und kann eigene gleichzeitige
Wiederholungen entfernen. Bei einem Filterfehler wird die vollständige gemischte
Aufnahme mit einer Warnung transkribiert. Bei Sprechertrennung bezeichnet die
Sprecherzahl die Systemspur; die Mikrofonspur bildet eine gemeinsame Quelle,
keine automatisch erkannte Person. Seit 0.3.10-dev.7 gilt dieselbe Filtereinstellung
für die Live-Notizen und den Rückblick. An Abschnittsgrenzen können Echos in der
Vorschau stehen bleiben. Ein Rückfall auf gemischte Erkennung wird angezeigt.
Physische Lautsprecher-/Mikrofontests und die komplette Electron-Aufnahmekette
dieser Änderung sind noch offen.

Seit **0.3.10-dev.0** gibt es unter Einstellungen die Wahl zwischen
Drücken und Halten eines Kürzels. Zustands-, Mikrofonstart-/Abbruch- und IPC-Tests
sowie der native Windows-Tastenablauf sind bestanden: Halten und Start/Stopp
wurden mit beiden gebündelten Sprachmodellen bis zum Einfügen in einen externen
Editor geprüft. Die Aufnahme verwendete eine Audio-Testdatei. Physische Mikrofone
und weitere Zielprogramme bleiben separat zu prüfen. Der Vorabstand bleibt eine
Entwicklungsfassung; die übrigen Fertigstellungsschritte stehen unten.
Escape beendet eine laufende Aufnahme und transkribiert sie. Während der
Verarbeitung bricht Escape ab. Außerhalb eines Vorgangs bleibt Escape für andere
Programme verfügbar. Auch das Beenden bei noch gehaltenem Diktierkürzel ist
im Windows-Quellstand geprüft.
Der zugehörige lokale Entwicklungsinstaller liegt unter
`BlitzDicWindows/dist/windows-2026-11-01T06-58-02-880Z-ac79d7-verified/BlitzDic Setup 0.3.10-dev.1.exe`.
Auch im Paket sind die Escape-Abläufe für Diktat, Meeting-Aufnahme und Abbruch
geprüft. Die installierte Testversion 0.3.6 wurde dabei nicht ersetzt.

Benötigt: Node.js 22 oder neuer, npm und uv. PowerShell im Projektordner:

```powershell
cd BlitzDicWindows
npm.cmd ci
node node_modules/electron/install.js
./scripts/setup-speech.ps1
```

Die Entwicklungslaufzeit verwendet ein eigenes PyAV-Wheel mit sauberem FFmpeg-Build.
Dieses muss vor `setup-speech.ps1` bereitstehen; Vorbereitung, Quellcode und
Prüfsummen stehen unter [FFmpeg bauen](BlitzDicWindows/licenses/native/BUILD_FFMPEG.md).
Das betrifft die Entwicklung. Der vollständige Windows-Installer enthält die Laufzeit.

Modelle für Entwicklung und Paketierung bereitstellen:

```powershell
'{"action":"download","preset":"whisper","modelDirectory":"models/whisper"}' | .runtime/venv/Scripts/python.exe speech/worker.py
'{"action":"download","preset":"parakeet-ultra","modelDirectory":"models/parakeet-ultra"}' | .runtime/venv/Scripts/python.exe speech/worker.py
npm.cmd start
npm.cmd test
```

Für den Ruy-Build wie in dev.11 das Wheel aus dem Workflow **Build Windows
Whisper runtime with Ruy** herunterladen. Falls das Artefakt abgelaufen ist,
den Workflow erneut auslösen. `scripts/setup-speech.ps1 -RuyArtifactDirectory`
erwartet den entpackten Artefaktordner mit Wheel und `build-provenance.txt`.
Das Skript prüft Quellstand, Buildprofil und Prüfsumme und gibt den Pfad zur
neuen Python-Umgebung aus. Diesen Pfad als `BLITZDIC_BUILD_PYTHON` setzen und
in den folgenden Befehlen statt `.runtime/venv/Scripts/python.exe` verwenden.
[Ruy-Build auf GitHub](https://github.com/phil2001/2026-10_BlitzDic/actions/workflows/ct2-ruy.yml)

Der Standard-Entwicklungsbuild verwendet die normale Python-Umgebung.

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

Weitere Mikrofon-/Office-/Browser-Konfigurationen, abschließender
Designabgleich, vollständige Prüfung der nativen Lizenzpflichten, Signierung und
der Test in einer frischen Windows-VM bleiben offen. Beide enthaltenen Sprachmodelle
und die gepackte App wurden auf dem Entwicklungs-PC mit frischem App-Profil geprüft.
Auch die Installer-Upgrades von 0.1.0 auf 0.3.6 und von 0.3.6 auf 0.3.10-dev.14
wurden dort erfolgreich getestet, einschließlich eines Installationspfads mit
Umlauten und Emoji. Die installierte dev.14 wurde mit beiden Modellen, einem
eigenen Whisper-Tiny-Ordner und der LLM-Anbindung geprüft.
Der manuelle Mikrofontest mit Parakeet Ultra und ausdrücklich ausgewähltem
Realtek-USB-Mikrofon lieferte laut Rückmeldung den Testsatz korrekt.
Vorherige Durchläufe mit Whisper Small und Parakeet Ultra enthielten
Erkennungsfehler bei „Anna prüft die Unterlagen“.
Der verfügbare Installer ist daher kein Nachweis der Fertigstellung.

[Arbeitsstand](WINDOWS_PORT.md) · [Datenschutz](PRIVACY.md) · [Mitwirken](CONTRIBUTING.md)

Für die Prüfung auf einem frischen Windows-11-PC zuerst den Installer ausführen.
Danach das [PowerShell-Prüfskript](BlitzDicWindows/scripts/verify-windows-package.ps1)
mit `-Executable` und dem Pfad zur installierten `BlitzDic.exe` starten. Es erzeugt
mit einer vorhandenen deutschen oder englischen Windows-Stimme eine kurze
Testaufnahme und erwartet je eine `PASS`-Zeile für Whisper und Parakeet Ultra.
Falls keine Windows-Stimme verfügbar ist, eine bekannte WAV-Testaufnahme mit
`-WavePath` angeben und mit `-Language` (`de` oder `en`) sowie `-ExpectedText`
die Sprache und einen wörtlich erwarteten Textausschnitt festlegen.
Für den Mikrofontest anschließend in BlitzDic **Wortgenau** wählen, eine kurze
Aufnahme starten und beenden und den Text prüfen.

## Herkunft und Lizenz

BlitzDic ist eine Windows-Weiterentwicklung mit gemeinsamer Git-Historie bis
zum Commit `ebd5c84`. GitHub führt dieses Projekt als eigenständiges Repository.
BlitzDic verwendet einen eigenen Namen und eine eigene Oberfläche. Dieses
Repository entwickelt ausschließlich Windows 11. [Blitztext-Original](https://github.com/cmagnussen/blitztext-app)
MIT-Lizenz: [LICENSE](LICENSE). Modelle und Abhängigkeiten haben eigene
[Lizenzhinweise](THIRD_PARTY_NOTICES.md).
