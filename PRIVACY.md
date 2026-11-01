# Datenschutz in BlitzDic für Windows 11

Whisper und Parakeet laufen lokal auf der CPU. Mikrofon-Audio wird im aktuellen
Quellcode im Arbeitsspeicher verarbeitet; importierte Dateien werden nicht verändert.
Frühere Entwicklungsbuilds konnten WAV-Aufnahmen im App-Datenordner zurücklassen.

Nur die optionalen Schreibmodi senden das Transkript an den ausdrücklich gewählten
LLM-Endpunkt. Dieser kann lokal, im Netzwerk oder bei einem API-Anbieter liegen.
Es gibt keinen stillen Wechsel zu einem externen Dienst.

Der vorläufige Haltemodus (Quellstand 0.3.10-dev.0) fragt ausschließlich den
gedrückten Zustand der konfigurierten Kürzeltasten bei Windows ab. Er protokolliert
keine allgemeinen Tastatureingaben und speichert keine Tastenzustandschronik.
Nach Abbruch der Aufnahme kann diese begrenzte Abfrage bis zum Loslassen des
Kürzels weiterlaufen, damit gehaltene Tasten keine neue Aufnahme auslösen.
Sie ist auf 30 Minuten begrenzt und wird beim Beenden der App beendet.

Einstellungen, API-Schlüssel und Verlauf werden mit Windows-DPAPI geschützt.
Das schützt vor anderen Windows-Benutzerkonten, nicht vor anderen Programmen im
selben Benutzerkonto. Der Verlauf lässt sich abschalten oder leeren.

Die vollständige Windows-Ausgabe enthält die beiden Sprachmodelle. Entwickler
laden die festgelegten Modellversionen von Hugging Face. Ein zusätzliches LLM
wird über den gewählten Anbieter eingerichtet. BlitzDic hat kein eigenes Backend
und enthält keine absichtlich eingebaute Telemetrie.

Beim automatischen Einfügen über die Windows-Schnittstellen wird der Inhalt des Zieltextfelds
vorübergehend lokal gelesen, um Änderungen während der Erkennung zu erkennen.
Gespeichert wird er nicht; nur ein flüchtiger Fingerabdruck und die Auswahlposition
werden verglichen. Zusätzlich bleiben höchstens 160 UTF-16-Zeichen vor und nach
der Auswahl vorübergehend im Arbeitsspeicher, um Abstände und Satzanfänge lokal
anzupassen. Diese Umgebung wird weder gespeichert noch an einen LLM-Anbieter
gesendet. Passwortfelder werden ausgeschlossen. Details:
[Windows-Einfügen](BlitzDicWindows/speech/WINDOWS_INSERTION.md).

Meeting-Zusammenfassungen senden das eingegebene Transkript an denselben gewählten
LLM-Endpunkt. Original und Zusammenfassung liegen in einer eigenen verschlüsselten
Sammlung mit maximal 100 Einträgen; sie lässt sich auf der Meeting-Seite leeren.
Manuell zugeordnete Sprechernamen liegen zusammen mit den ursprünglichen Sprecher-IDs
in dieser verschlüsselten Sammlung. Namen sind keine automatisch erkannten Identitäten.
Bei einer ausdrücklich gestarteten Zusammenfassung enthält der an den gewählten
LLM-Endpunkt gesendete Text die zugeordneten Namen. Eine reine Namensänderung
kontaktiert keinen LLM-Anbieter. Frühere Zusammenfassungen werden dabei erhalten
und gegebenenfalls als veraltet markiert.
Die allgemeine Option „Verlauf speichern“ betrifft den Diktatverlauf. Meetings
werden durch den ausdrücklich beschrifteten Zusammenfassen-und-Speichern-Schritt
unabhängig davon gespeichert.

Für Online-Meetings ist unter **Audioquelle** auch **Systemaudio** oder
**Mikrofon und Systemaudio** wählbar. Systemaudio erfasst die gesamte Windows-
Audioausgabe. Die Streams werden lokal verarbeitet. Die technische Bildschirm-
Freigabe liefert zusätzlich einen Videostream, der weder gespeichert noch an
Anbieter gesendet wird. Bei Abbruch werden alle Aufnahmespuren beendet.

Meeting-Transkripte lassen sich auch ohne Zusammenfassung ausdrücklich lokal
speichern. Dieser Schritt ruft keinen Modellanbieter auf. Die Speicherung erfolgt
in derselben verschlüsselten Meeting-Sammlung, unabhängig vom Diktatverlauf.
