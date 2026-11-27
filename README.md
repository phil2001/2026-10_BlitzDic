# BlitzDic für Windows 11

BlitzDic ist eine Diktier-App für Windows 11. Du sprichst, BlitzDic schreibt – direkt in
das Programm, in dem gerade der Cursor steht. Die Spracherkennung läuft **lokal auf dem PC**
mit **Parakeet Ultra** (Standard) oder **OpenAI Whisper Small**. Beide Modelle sind im
Installer enthalten: kein Python, kein Modelldownload, kein Konto nötig.

> **Hinweis:** Erkennung und Fachbegriff-Korrektur ersetzen keine Prüfung des Textes.
> Bitte Fachbegriffe, Zahlen und Einheiten immer kontrollieren.

## Installation

Zum Installieren brauchst du **nur eine Datei, nicht das Repository**. Das Repository
enthält den Quellcode; den fertigen Installer gibt es auf der Seite **„Releases“**. Das ist
**kein Ordner im Code**, sondern ein eigener Bereich von GitHub: Auf der Startseite des
Repositorys steht er rechts unter **Releases**, bei schmalem Fenster weiter unten (dort
„BlitzDic … Latest“ anklicken).

1. Im Browser die Seite **[Releases – neueste Version](https://github.com/phil2001/BlitzDic/releases/latest)**
   öffnen. Der Link führt immer zur neuesten Version. Eine Anmeldung bei GitHub ist nicht nötig.
2. Ganz unten unter **Assets** die Datei **`BlitzDic.Setup.<Version>.exe`** herunterladen, zum
   Beispiel `BlitzDic.Setup.1.0.4.exe` (GitHub zeigt etwa 1,11 GB an). **Nicht** „Source code
   (zip)“ – das ist nur der Quellcode, kein Installer. Blockiert Chrome den Download, siehe
   [Häufige Probleme](#häufige-probleme).
3. Die heruntergeladene Datei doppelklicken. Weil der Installer nicht signiert ist, zeigt Windows
   „Der Computer wurde durch Windows geschützt“: auf **Weitere Informationen** und dann auf
   **Trotzdem ausführen** klicken.
4. Lizenz bestätigen und wählen, ob BlitzDic **für alle Benutzer** des PCs (Windows fragt dann
   nach Administratorrechten) oder **nur für dein Konto** installiert wird. Ordner bestätigen.
5. Fertig: BlitzDic erscheint als Symbol unten rechts im Infobereich und startet ab jetzt
   automatisch mit Windows.

**Datei prüfen (optional):** Im selben Release liegt `SHA256SUMS.txt`. In PowerShell ausführen
(Dateiname bei Bedarf anpassen) und die angezeigte Zahl mit der Zahl in `SHA256SUMS.txt`
vergleichen (Groß-/Kleinschreibung spielt keine Rolle). Stimmen beide überein, ist die Datei
unverändert.

```powershell
Get-FileHash "$env:USERPROFILE\Downloads\BlitzDic.Setup.1.0.4.exe" -Algorithm SHA256
```

**Voraussetzungen:** Windows 11 (64 Bit), moderner Intel- oder AMD-Prozessor, 16 GB
Arbeitsspeicher empfohlen, mindestens 5 GB freier Speicherplatz. Eine eigene Grafikkarte ist
nicht nötig. Für die Fachbegriff-Korrektur muss **Deutsch** in Windows installiert sein
(Einstellungen → Zeit und Sprache → Sprache und Region); auf deutschen PCs ist das üblich.
Details: [Systemvoraussetzungen](BlitzDicWindows/SYSTEMVORAUSSETZUNGEN.md).

## Aktualisieren

1. In BlitzDic **Einstellungen → Über BlitzDic → Auf neue Version prüfen** klicken.
2. Meldet BlitzDic eine neue Version, auf **Veröffentlichungen öffnen** klicken und dort das
   neue Setup herunterladen.
3. BlitzDic beenden (Rechtsklick auf das Symbol im Infobereich → **Beenden**) und das neue
   Setup starten. Es ersetzt die installierte Version; **Einstellungen und Verlauf bleiben
   erhalten**.

BlitzDic prüft nur auf Knopfdruck und lädt oder installiert nichts selbst.
Versionen **vor 1.0.1** finden keine Updates mehr (das Repository hieß früher
`2026-10_BlitzDic`): diese bitte einmal von Hand wie oben unter „Installation“ auf die neueste
Version bringen. Danach klappt das Aktualisieren wieder über die App.

## Erste Schritte

1. Den Cursor in das Programm setzen, in das geschrieben werden soll (Word, Browser,
   Praxissoftware …).
2. **Alt + Leertaste** drücken, sprechen, erneut **Alt + Leertaste** drücken. Der erkannte
   Text wird an der Cursorposition eingefügt und bleibt zusätzlich in BlitzDic sichtbar.
3. **Escape** beendet eine laufende Aufnahme; während der Verarbeitung bricht Escape ab.

| Tasten | Schreibmodus |
| --- | --- |
| **Alt + Leertaste** | Wortgenau – genau wie gesprochen |
| **Alt + Leertaste + 1** | Überarbeiten |
| **Alt + Leertaste + 2** | Ruhig formulieren |
| **Alt + Leertaste + 3** | Mit Emojis |

Für die Zahlen die Alt-Taste gedrückt halten und Leertaste und Zahl nacheinander drücken.
Die Modi außer Wortgenau brauchen einen KI-Dienst für die Textüberarbeitung; ihn richtest du
unter **Verbindungen** ein (siehe unten).

**Tasten ändern:** **Einstellungen → Globale Tastenkürzel**, ins Feld klicken und die gewünschten
Tasten drücken – BlitzDic übernimmt genau die gedrückte Kombination. Rücktaste entfernt ein
Kürzel, Escape bricht ab.

**Fachbegriffe:** Bei der Diktatsprache **Medizinisches Deutsch** (Standard) korrigiert BlitzDic
fast richtig erkannte Fachbegriffe, z. B. „Apexaban“ → „Apixaban“ oder „Xerelto“ → „Xarelto“,
auch nach Klang („Pantoprazul“ → „Pantoprazol“, „Diklofenak“ → „Diclofenac“), und zeigt jede Anpassung unter dem Text an. Abschaltbar unter **Einstellungen**. Das Wörterbuch
umfasst ein handgepflegtes Grundwörterbuch und rund 26.000 Begriffe aus ICD-10-GM, OPS, dem
deutschen MeSH und den in Österreich und EU-weit zugelassenen Arzneimitteln (EMA). Geändert wird
ein Wort nur, wenn auch die Windows-Rechtschreibprüfung es als falsch meldet; Namen nach „Frau“,
„Herr“ oder „Dr.“ bleiben unverändert.

**Dosierungen:** Ebenfalls bei **Medizinisches Deutsch** und mit demselben Schalter schreibt BlitzDic
Einnahmeschemata, Einheiten und Blutdruckwerte einheitlich: „5 mg 100“ oder „5 mg 1 0 0“ →
„5 mg 1-0-0“, „Milligramm pro Deziliter“ → „mg/dl“, „Mikrogramm“ → „µg“, „72 pro Minute“ →
„72/min“, „Blutdruck 135 zu 85“ → „Blutdruck 135/85“. Angepasst wird nur direkt nach einer Zahl;
auch diese Änderungen stehen unter dem Text.

## Deinstallieren

Windows-Einstellungen → **Apps → Installierte Apps → BlitzDic → Deinstallieren**. Der
Autostart wird dabei entfernt. Einstellungen und Verlauf bleiben in `%APPDATA%\BlitzDic`
erhalten; wer sie ebenfalls entfernen will, löscht diesen Ordner von Hand.

## Häufige Probleme

- **„Der Computer wurde durch Windows geschützt“ beim Installieren:** Der Installer ist nicht
  signiert. **Weitere Informationen → Trotzdem ausführen**. Wer sichergehen will, prüft vorher
  die Datei wie oben beschrieben.
- **Chrome meldet „Diese Datei wurde vom erweiterten Sicherheitsprogramm blockiert“:** Das ist
  kein Virusfund. Ist das Google-Konto im Erweiterten Sicherheitsprogramm von Google (Advanced
  Protection), blockiert Chrome selten heruntergeladene, nicht signierte Dateien – das betrifft
  vor allem frisch veröffentlichte BlitzDic-Versionen. Den Schutz deshalb nicht abschalten,
  sondern die Datei in PowerShell herunterladen (bei einer neueren Version beide
  Versionsnummern anpassen) und danach wie oben unter **Datei prüfen** vergleichen:

  ```powershell
  curl.exe -L -o "$env:USERPROFILE\Downloads\BlitzDic.Setup.1.0.4.exe" "https://github.com/phil2001/BlitzDic/releases/download/v1.0.4/BlitzDic.Setup.1.0.4.exe"
  ```

  Alternativ mit einem Chrome-Profil ohne dieses Google-Konto oder mit Microsoft Edge
  herunterladen.
- **„Tastenkürzel nicht verfügbar … (von einem anderen Programm belegt)“:** Ein anderes Programm
  nutzt dieselben Tasten, z. B. Google Gemini die Alt+Leertaste. Entweder dort das Kürzel ändern
  oder in BlitzDic unter **Einstellungen** andere Tasten ins Kürzelfeld drücken.
- **„Fachbegriffe nicht korrigiert: Windows-Rechtschreibprüfung … nicht verfügbar“:** Deutsch
  unter Einstellungen → Zeit und Sprache → Sprache und Region hinzufügen.
- **Der Text wird nicht eingefügt:** Hat sich das Feld oder der Inhalt während des Diktats
  geändert, fügt BlitzDic aus Sicherheitsgründen nicht ein. Der Text steht dann in BlitzDic
  zum Kopieren bereit. Mehr dazu: [Windows-Einfügen](BlitzDicWindows/speech/WINDOWS_INSERTION.md).
- **Ältere Programme wie CGM PcPo:** Seit 1.0.2 fügt BlitzDic auch in Felder von
  Visual-Basic-6-Programmen und in TX Text Control ein, in PcPo also in Kartei und Befunde.
  Emojis kann das Karteifeld nicht darstellen; enthält das Diktat welche, bleibt der Text in
  BlitzDic. Vor 1.0.2 kam in PcPo „Kein unterstütztes Eingabefeld erkannt“.
- **„GitHub ist nicht erreichbar“ bei der Update-Prüfung:** Internetverbindung prüfen. Bei
  Versionen vor 1.0.1 einmal von Hand aktualisieren (siehe „Aktualisieren“).
- **Fehler melden:** **Einstellungen → Über BlitzDic → Supportinformationen anzeigen**,
  Text kopieren und als [Issue](https://github.com/phil2001/BlitzDic/issues) einreichen.
  Bitte keine Patientendaten, Diktate oder Schlüssel mitschicken.

Arbeitsstand und nächste Schritte der Entwicklung: [STATUS.md](STATUS.md).

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
- Manuelle Versionsprüfung im eigenen GitHub-Repository und lokal vorbereitete
  Supportinformationen zur Prüfung und zum Kopieren.

## Bedienung im Detail

Das Setup zeigt eine Lizenzseite: MIT-Lizenz für BlitzDic sowie die Bedingungen der
mitgelieferten Microsoft-Laufzeitdateien. Alle Lizenztexte und die zugehörigen
Electron-/FFmpeg-Quellen liegen nach der Installation im Lizenzordner (**Einstellungen →
Über BlitzDic → Lizenzen und Quellcode öffnen**). Build-, Prüf- und Versionsgeschichte:
[Arbeitsstand](WINDOWS_PORT.md).

1. Nach Installation BlitzDic öffnen. Standard ist **Parakeet Ultra**; unter **Modelle** lässt sich
   Whisper wählen. Bereits gespeicherte Einstellungen behalten ihr Modell.
2. Unter **Diktat** Mikrofon, Schreibmodus und **Diktatsprache** wählen, Aufnahme starten und beenden.
   Zur Wahl stehen **Medizinisches Deutsch** (Standard), **Deutsch** und **Englisch**.
   Bei Whisper legt die Auswahl die Sprache fest, und Medizinisches Deutsch ergänzt einen
   Kontexthinweis und eigene Begriffe. Parakeet erkennt die Sprache selbst.
   Das **Fachgebiet** (bei Medizinisches Deutsch) wirkt nur bei Whisper: **Allgemeinmedizin**
   (Standard) gibt Whisper häufige Diagnosen, Präparate und die Schreibweise „5 mg 1-0-0“ mit,
   **Allgemein** nur den kurzen medizinischen Hinweis.
   Bei Medizinisches Deutsch korrigiert BlitzDic anschließend fast richtig erkannte Fachbegriffe
   („Apexaban“ → „Apixaban“) mit einem mitgelieferten Wörterbuch und den eigenen Begriffen.
   Jede Anpassung steht unter dem Text; abschaltbar unter **Einstellungen**. Geändert wird nur,
   was auch die Windows-Rechtschreibprüfung als falsch meldet
   ([Messung](BlitzDicWindows/SYSTEMVORAUSSETZUNGEN.md)). Es ist kein medizinisch trainiertes
   Modell; Fachbegriffe, Zahlen und Einheiten prüfen.
   BlitzDic merkt sich die Mikrofonwahl für Diktate und Meetings.
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

Tastenkürzel (Übersicht unter „Erste Schritte“): Ältere Installationen mit den früheren
Standardkürzeln (Strg+Umschalt+1 bis 4) erhalten die neuen automatisch; selbst gewählte Kürzel
bleiben. Alt+Leertaste öffnet sonst das Windows-Fenstermenü; solange BlitzDic läuft, gehört die
Kombination BlitzDic. Unter **Einstellungen → Kürzelbedienung** lässt sich statt „Drücken:
starten / erneut drücken: beenden“ auch „Halten: aufnehmen / loslassen: beenden“ wählen.
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
[Ruy-Build auf GitHub](https://github.com/phil2001/BlitzDic/actions/workflows/ct2-ruy.yml)

Die Sprecherlaufzeit kann zusätzlich aus dem eigenen Windows-Quellbuild
eingebunden werden: `setup-speech.ps1 -SpeakerArtifactDirectory` erwartet das
zugehörige Wheel mit Herkunftsmanifest. Beide Artefaktoptionen können gemeinsam
verwendet werden. [Bau und Prüfung der Sprecherlaufzeit](BlitzDicWindows/licenses/native/sherpa-onnx-2.0.1/BUILD.md).

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

## Versionen und Support

Unter **Einstellungen → Über BlitzDic** prüft **Auf neue Version prüfen** auf
Knopfdruck die letzte stabile, öffentliche Veröffentlichung dieses Repositorys. Nur passende
Windows-Installer werden als Update angeboten; Vorabversionen und Entwürfe nicht.
**Veröffentlichungen öffnen** öffnet die Release-Seite im Standardbrowser; Download und
Installation erfolgen manuell (siehe „Aktualisieren“). Es gibt keine automatische
Installation und derzeit keine Signaturprüfung eines heruntergeladenen Updates durch BlitzDic.
Die Prüfung ist anonym und sendet keine Einstellungen, Diktate oder Gerätekennungen. Ab 1.0.1
fragt sie GitHub über die feste Nummer des Repositorys und funktioniert damit auch nach einer
Umbenennung.
**Supportinformationen anzeigen** zeigt ausschließlich Version und Windows-
Plattform mit einer Vorlage für die Fehlerbeschreibung. Erst **Kopieren**
überträgt diesen Text in die Zwischenablage. Es wird keine Nachricht versendet.

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
