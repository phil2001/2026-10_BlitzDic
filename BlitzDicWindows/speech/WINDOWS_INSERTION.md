# Einfügen in Windows-Eingabefelder

Klassische Edit-/RichEdit-Felder werden über Windows-Nachrichten bedient. Zusätzlich
zu Fenster und Auswahl wird der vollständige Text per SHA-256 verglichen. Bei
Änderungen während der Aufnahme bleibt das Diktat in BlitzDic. Große RichEdit-Texte
ab 64.000 UTF-16-Einheiten verwenden UI Automation, damit kein gekürzter Text als
vollständiger Fingerabdruck gilt. Der Test mit 70.000 Zeichen besteht diesen Pfad.
Programme aus Visual Basic 5/6, etwa CGM PcPo, verwenden für dieselben Steuerelemente
eigene Klassennamen: `ThunderTextBox`, `ThunderRT5TextBox` und `ThunderRT6TextBox`
(Edit) sowie `RichTextWndClass` (RichTextBox auf RichEdit-Basis). Sie laufen über
denselben Weg mit denselben Prüfungen; andere unbekannte Klassen bleiben bei UI
Automation. Solche Felder sind ANSI-Fenster: Enthält der Text Zeichen außerhalb der
Windows-Codepage, etwa Emojis, wird nicht eingefügt und der Text bleibt in BlitzDic,
statt als „?“ anzukommen. TX Text Control 34 (Klasse `TX34`, Textverarbeitung in
PcPo) beantwortet dieselben Nachrichten und läuft ebenfalls über diesen Weg. Es zählt
einen Absatzwechsel bei der Auswahl als eine Position, liefert im Text aber CR+LF;
der Randkontext für die Anpassung rechnet die Position deshalb um.
Andere Felder werden über Windows UI Automation geprüft und erhalten Unicode-
Tastatureingaben über SendInput. Word erhält Text über seine native
Dokumentschnittstelle. Die Zwischenablage wird dabei nicht verändert.
Dafür wird das mit Windows 11 gelieferte .NET Framework verwendet; eine
zusätzliche Installation ist nicht erforderlich. Die UI-Automation-Anbindung
(`uia_target.cs`) wird beim Build einmal mit dem in Windows enthaltenen
C#-Compiler zu `blitzdic-uia.exe` übersetzt (`scripts/build-uia.ps1`). Früher
startete jede Erfassung und jedes Einfügen Windows PowerShell und übersetzte den
Code neu; das dauerte auf einem schnellen PC 1,4–2,2 s je Aufruf, die Exe etwa
0,2–0,3 s. Zur Fehlersuche gibt `BLITZDIC_UIA_TRACE=1` Zwischenschritte und
Ausnahmen auf stderr aus.

Erfassen und Einfügen laufen in einem dauerhaften Hilfsprozess
(`worker.py --target-service`, `src/target-service.js`), der beim App-Start
bereitsteht. Vor jeder Aufnahme und jedem Einfügen entfällt damit ein
Python-Start. Zeitüberschreitung oder Abbruch beenden den Hilfsprozess wie zuvor
den Einzelprozess; die nächste Anfrage startet einen neuen.

Vor dem Einfügen prüft die UI-Automation-Anbindung das fokussierte Element,
Prozess, Fenster, Laufzeitkennung, Textauswahl und einen SHA-256-Fingerabdruck
des Dokumentinhalts. Der Klartext wird nur vorübergehend im lokalen Hilfsprozess
verarbeitet und nicht gespeichert oder an den LLM-Anbieter gesendet. Passwort-
und schreibgeschützte Felder werden abgewiesen. Nicht unterstützte oder mehrdeutige
Auswahlen, Dokumente über einer Million Zeichen und gedrückte Zusatztasten führen
zum Abbruch. Die App verschiebt den Fokus nicht selbst zurück.

Chromium-Programme (Chrome, Edge, die ChatGPT-App) legen ihren Zugänglichkeitsbaum erst
an, wenn ein UI-Automation-Client das erste Mal fragt. Bis er steht, meldet Windows als
fokussiertes Element nur einen Bereich des Browserfensters ohne Tastaturfokus (Chrome:
das Fenster selbst, Edge: eine innere „View“), auch wenn der Cursor im Webtextfeld
steht. Bei langen Seiten wie einem langen ChatGPT-Verlauf dauert das spürbar: im Test mit
8.000 Absätzen etwa 0,7 s. Früher wies die Erfassung genau dann das Feld ab; das erste
Diktat blieb in BlitzDic, erst das zweite kam an. Die Erfassung vor der Aufnahme wartet
deshalb in genau diesem Zustand bis zu 2 s und fragt alle 100 ms erneut, gebunden an das
beim ersten Versuch aktive Fenster. Alle anderen Abweisungen gelten sofort, und die
Prüfung unmittelbar vor dem Einfügen wartet nie. Bleibt der Baum aus, meldet BlitzDic
„Eingabefeld der Anwendung noch nicht über UI Automation lesbar“.

Einfügen per SendInput ist keine atomare Transaktion mit der Zielanwendung.
Ein Fokuswechsel unmittelbar zwischen letzter Prüfung und Verarbeitung der
Tastaturereignisse lässt sich damit nicht vollständig ausschließen. Windows kann
Eingaben in höher privilegierte Anwendungen verweigern. Eine Annahme durch
SendInput ist außerdem keine Bestätigung der Textverarbeitung durch jede Anwendung.
Auch die Prüfung und das anschließende Ändern eines nativen Textfelds oder
Word-Bereichs sind keine atomare Transaktion. Bei verweigertem Einfügen bleibt
das Diktat in BlitzDic verfügbar.

Word wird über das native Objekt des fokussierten Dokumentfensters angesprochen;
es wird keine beliebige laufende Instanz ausgewählt oder eine neue gestartet.
Nur eine normale Textauswahl oder ein Cursor werden akzeptiert. Fenster, Inhalt
und Auswahl werden unmittelbar vor dem Ersetzen erneut geprüft. Der gewählte
Bereich erhält Unicode-Text einschließlich Emoji und Absatzumbrüchen, anschließend
steht der Cursor hinter dem eingefügten Text. Word-Optionen werden nicht geändert.
Der eigene Word-Test hat gezeigt, dass generische Unicode-Tastaturereignisse das
Emoji verändern können; deshalb verwendet dieser Pfad die Dokumentschnittstelle.

## Reproduzierbare Prüfungen

Aus BlitzDicWindows auf einem interaktiven Windows-Desktop:

```powershell
.runtime/venv/Scripts/python.exe scripts/verify-insertion.py
.runtime/venv/Scripts/python.exe scripts/verify-insertion.py --rich --large
.runtime/venv/Scripts/python.exe scripts/verify-vb6-insertion.py
node scripts/verify-uia.mjs
node scripts/verify-chromium-first-capture.mjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/verify-word-insertion.ps1
```

Die Prüfungen öffnen eigene Testfenster. Native Edit: Unicode, Emoji,
Markierungen ersetzen, Rückgängig, Cursoränderung, Passwortschutz,
Schreibschutz, mehrzeilige Felder und unveränderte Zwischenablage. RichEdit50W:
dieselben Prüfungen sowie der große Text über UI Automation. Chromium: textarea und
contenteditable, Unicode, Markierungen sowie Text-, Cursor- und Fokusänderungen,
Passwortschutz und Schreibschutz. Erfolgreich geprüft am 31.10.2026. Dieses
Testfenster erzwingt die Zugänglichkeit und zeigt den Erstzugriff deshalb nicht.

Erstzugriff auf Chromium: `verify-chromium-first-capture.mjs` startet Edge
(`BLITZDIC_TEST_BROWSER=chrome` für Chrome) mit neuem Profil und langer Seite, sodass die
Erfassung vor dem Diktat der erste UI-Automation-Zugriff ist. Geprüft werden das Warten
auf den Baum, Unicode/Emoji im `contenteditable`-Feld, eine fokussierte Schaltfläche ohne
Wartezeit und ein Electron-Fenster ohne erzwungene Zugänglichkeit ohne Wartezeit. Jede
Erfassung ist an Fenster und Prozess des Testfensters gebunden; ist ein anderes Programm
im Vordergrund, wird nichts erfasst oder eingefügt. Erfolgreich geprüft am 26.11.2026
mit Edge (zwei Läufe, je etwa 0,7 s Wartezeit). Nicht dadurch belegt: die ChatGPT-App
selbst und langsamere PCs, auf denen der Baum länger als 2 s brauchen kann.

VB6: Ein eigener Hilfsprozess legt ANSI-Felder wie Visual Basic 6 an
(`ThunderRT6TextBox` ein- und mehrzeilig, `RichTextWndClass` auf RichEdit 1.0), einmal
als 64-Bit- und einmal als 32-Bit-Prozess wie PcPo. Geprüft werden Umlaute und
typografische Zeichen, Markierungen ersetzen, Cursoränderung, Abweisung von Emojis,
Passwort- und Schreibschutz über den dauerhaften Hilfsprozess (`--target-service`)
sowie die unveränderte Zwischenablage. Erfolgreich geprüft am 22.11.2026.

PcPo selbst (CGM PcPo, Kartei `Ax_Ka`, Testpatient, 23.11.2026): Je ein zweizeiliger
Probetext mit Umlauten und typografischen Anführungszeichen wurde mit diesem Code in
das Karteifeld (`RichTextWndClass`) und ein TX-Text-Control-Feld (`TX34`) eingefügt.
Länge, Cursor und Absatzwechsel stimmten; im TX-Feld zeigte die umgerechnete Position
genau hinter den Probetext. Nicht dadurch belegt: der vollständige Ablauf mit Diktat
in der installierten App sowie PcPo-Dialoge mit Windows-Forms-Feldern.

Word: Unicode/Emoji, Markierungen ersetzen, Rückgängig/Wiederholen, Absätze,
Abweisung bei geändertem Text, Cursor oder aktivem Dokument, Dokumentschutz und
unveränderte Zwischenablage. Der optionale Test benötigt lokal installiertes Word
und öffnet eigene, ungespeicherte Dokumente, die danach verworfen werden.
Über `-SpeechExecutable` beziehungsweise `BLITZDIC_TEST_SPEECH_EXECUTABLE` lassen
sich dieselben Prüfungen gegen die gepackte Sprachlaufzeit ausführen.

Nicht dadurch belegt: alle Office-/Browser-Versionen, Excel, komplexe Word-Tabellen,
Formularfelder, geschützte Ansichten oder erhöhte Anwendungen.
Die native Rückgängig-Prüfung gilt für einzeilige Felder. Eine gemeinsame
Wiederherstellung der ersetzten Auswahl in einem Rückgängig-Schritt ist bei
mehrzeiligen klassischen Edit-Feldern nicht gewährleistet.

## Microsoft-Dokumentation

- [TextPattern.GetSelection und Cursorbereiche](https://learn.microsoft.com/en-us/dotnet/api/system.windows.automation.textpattern.getselection)
- [Texteingabe mit UI Automation](https://learn.microsoft.com/en-us/dotnet/framework/ui-automation/add-content-to-a-text-box-using-ui-automation)
- [SendInput](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput)
- [Native Office-Objekte über das genaue Fenster](https://learn.microsoft.com/en-us/windows/win32/api/oleacc/nf-oleacc-accessibleobjectfromwindow)
- [Text des Word-Bereichs ersetzen](https://learn.microsoft.com/en-us/office/vba/api/word.range.text)
- [Auswahl des Word-Fensters](https://learn.microsoft.com/en-us/office/vba/api/word.window.selection)
- [WM_GETTEXT und RichEdit-Grenze](https://learn.microsoft.com/en-us/windows/win32/winmsg/wm-gettext)

## Vollständiger Diktatablauf

Ab Version 0.3.7 passt das automatische Einfügen die Textränder an die
Cursorumgebung an: Wortabstände, Großschreibung am Satzanfang, Kleinschreibung
häufiger Funktionswörter im laufenden Satz sowie doppelte Schlusszeichen.
Eigennamen und bedeutungsabhängige Pronomen wie „Sie“, „Ihr“ oder „I“ bleiben
erhalten. Die Regeln stammen aus dem ursprünglichen InsertionFitter und brauchen
kein LLM. Dazu wird ein flüchtiger Ausschnitt von höchstens 160 UTF-16-Zeichen
je Seite erfasst. Er verlässt den Rechner nicht. Ergebnis und Verlauf behalten
den Transkripttext; nur der tatsächlich eingefügte Text erhält die Anpassung.
Fehlt ein verlässlich erfasster Kontext, wird der Text unverändert eingefügt.

`node scripts/verify-hotkey.mjs` startet BlitzDic und ein separates Chromium-
Testfenster. Es sendet das echte globale Strg+Umschalt+1, verarbeitet eine
synthetische Mikrofonaufnahme durch das lokale Sprachmodell und prüft den
Text im ursprünglichen Eingabefeld. Die WAV-Fixture `.runtime/test-speech.wav`
muss vorhanden sein. Standard ist Whisper; `BLITZDIC_TEST_PRESET=parakeet-ultra`
wählt Parakeet. `BLITZDIC_TEST_MOVE_CURSOR=1` prüft den Abbruch beim Cursorwechsel.

Beide Sprachmodelle haben den positiven Gesamtablauf bestanden. Das belegt
keine physische Mikrofonhardware. Der Tastatur-Hilfsprozess wird vor Aktivierung
des Zielfensters gestartet, damit sein Prozessstart den Fokus nicht beeinflusst.
Die App meldet eine fehlgeschlagene Zielerfassung ausdrücklich und erhält den Text.
