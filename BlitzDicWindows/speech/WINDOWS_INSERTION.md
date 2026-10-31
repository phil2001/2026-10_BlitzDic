# Einfügen in Windows-Eingabefelder

Klassische Edit-/RichEdit-Felder werden über Windows-Nachrichten bedient. Zusätzlich
zu Fenster und Auswahl wird der vollständige Text per SHA-256 verglichen. Bei
Änderungen während der Aufnahme bleibt das Diktat in BlitzDic. Große RichEdit-Texte
ab 64.000 UTF-16-Einheiten verwenden UI Automation, damit kein gekürzter Text als
vollständiger Fingerabdruck gilt. Der Test mit 70.000 Zeichen besteht diesen Pfad.
Andere Felder werden über Windows UI Automation geprüft und erhalten Unicode-
Tastatureingaben über SendInput. Word erhält Text über seine native
Dokumentschnittstelle. Die Zwischenablage wird dabei nicht verändert.
Dafür wird das mit Windows 11 gelieferte Windows PowerShell/.NET verwendet;
eine zusätzliche Installation ist nicht erforderlich.

Vor dem Einfügen prüft die UI-Automation-Anbindung das fokussierte Element,
Prozess, Fenster, Laufzeitkennung, Textauswahl und einen SHA-256-Fingerabdruck
des Dokumentinhalts. Der Klartext wird nur vorübergehend im lokalen Hilfsprozess
verarbeitet und nicht gespeichert oder an den LLM-Anbieter gesendet. Passwort-
und schreibgeschützte Felder werden abgewiesen. Nicht unterstützte oder mehrdeutige
Auswahlen, Dokumente über einer Million Zeichen und gedrückte Zusatztasten führen
zum Abbruch. Die App verschiebt den Fokus nicht selbst zurück.

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
node scripts/verify-uia.mjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/verify-word-insertion.ps1
```

Die Prüfungen öffnen eigene Testfenster. Native Edit: Unicode, Emoji,
Markierungen ersetzen, Rückgängig, Cursoränderung, Passwortschutz,
Schreibschutz, mehrzeilige Felder und unveränderte Zwischenablage. RichEdit50W:
dieselben Prüfungen sowie der große Text über UI Automation. Chromium: textarea und
contenteditable, Unicode, Markierungen sowie Text-, Cursor- und Fokusänderungen,
Passwortschutz und Schreibschutz. Erfolgreich geprüft am 31.10.2026.

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
