# Datenschutz in BlitzDic für Windows 11

Whisper und Parakeet laufen lokal auf der CPU. Mikrofon-Audio wird im aktuellen
Quellcode im Arbeitsspeicher verarbeitet; importierte Dateien werden nicht verändert.
Frühere Entwicklungsbuilds konnten WAV-Aufnahmen im App-Datenordner zurücklassen.

Nur die optionalen Schreibmodi senden das Transkript an den ausdrücklich gewählten
LLM-Endpunkt. Dieser kann lokal, im Netzwerk oder bei einem API-Anbieter liegen.
Es gibt keinen stillen Wechsel zu einem externen Dienst.

Einstellungen, API-Schlüssel und Verlauf werden mit Windows-DPAPI geschützt.
Das schützt vor anderen Windows-Benutzerkonten, nicht vor anderen Programmen im
selben Benutzerkonto. Der Verlauf lässt sich abschalten oder leeren.

Die vollständige Windows-Ausgabe enthält die beiden Sprachmodelle. Entwickler
laden die festgelegten Modellversionen von Hugging Face. Ein zusätzliches LLM
wird über den gewählten Anbieter eingerichtet. BlitzDic hat kein eigenes Backend
und enthält keine absichtlich eingebaute Telemetrie.
