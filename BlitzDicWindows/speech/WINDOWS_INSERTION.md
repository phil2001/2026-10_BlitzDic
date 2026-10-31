# Einfügen in Windows-Eingabefelder

Klassische Edit-/RichEdit-Felder werden über Windows-Nachrichten bedient.
Andere Felder werden über Windows UI Automation geprüft und erhalten Unicode-
Tastatureingaben über SendInput. Die Zwischenablage wird dabei nicht verändert.
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
Bei verweigertem Einfügen bleibt das Diktat in BlitzDic verfügbar.

## Reproduzierbare Prüfungen

Aus BlitzDicWindows auf einem interaktiven Windows-Desktop:

```powershell
.runtime/venv/Scripts/python.exe scripts/verify-insertion.py
node scripts/verify-uia.mjs
```

Die Prüfungen öffnen eigene Testfenster. Native Edit: Unicode, Emoji,
Markierungen ersetzen, Rückgängig, Cursoränderung, Passwortschutz,
Schreibschutz und unveränderte Zwischenablage. Chromium: textarea und
contenteditable, Unicode, Markierungen sowie Text-, Cursor- und Fokusänderungen,
Passwortschutz und Schreibschutz. Erfolgreich geprüft am 31.10.2026.

Nicht dadurch belegt: Word/Office, RichEdit, alle Browser-Versionen, erhöhte
Anwendungen oder der vollständige globale Tastenkürzel-/Mikrofonablauf.
Die Sprachlaufzeit muss mit dem neuen UI-Automation-Hilfsskript neu gebaut werden.

## Microsoft-Dokumentation

- [TextPattern.GetSelection und Cursorbereiche](https://learn.microsoft.com/en-us/dotnet/api/system.windows.automation.textpattern.getselection)
- [Texteingabe mit UI Automation](https://learn.microsoft.com/en-us/dotnet/framework/ui-automation/add-content-to-a-text-box-using-ui-automation)
- [SendInput](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput)
