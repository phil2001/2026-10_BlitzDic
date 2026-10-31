# Systemvoraussetzungen für lokale Spracherkennung

Stand: 31.10.2026. Gilt für die aktuellen BlitzDic-Vorgaben und den getesteten
CPU-Betrieb. Die Windows-App befindet sich noch in Entwicklung.

| Voraussetzung | OpenAI Whisper | Parakeet Ultra (NVIDIA / Moondream) |
|---|---|---|
| Vorkonfiguriertes Modell | Whisper Small, mehrsprachig, faster-whisper | Parakeet Ultra 0.6B, ONNX INT8 |
| Betriebssystem dieser Ausgabe | Windows 11, x64 | Windows 11, x64 |
| Prozessor | Intel-/AMD-x64-Prozessor; moderner Mehrkernprozessor empfohlen | Intel-/AMD-x64-Prozessor; moderner Mehrkernprozessor empfohlen |
| RAM-Empfehlung für den gesamten PC | 16 GB | 16 GB |
| Verbindliche RAM-Mindestgrenze | Noch nicht auf kleinen PCs ermittelt | Noch nicht auf kleinen PCs ermittelt |
| NVIDIA-Grafikkarte / CUDA | Nicht erforderlich im aktuellen CPU-Betrieb | Nicht erforderlich im aktuellen CPU-Betrieb |
| Reine installierte Modelldateien, lokal gemessen | 486.212.372 Byte, etwa 486 MB | 670.479.254 Byte, etwa 670 MB |
| Internet | Für Installation und Modelldownload; anschließend lokale Transkription offline | Für Installation und Modelldownload; anschließend lokale Transkription offline |
| Audio | Mikrofon mit Windows-Zugriffserlaubnis oder Audiodatei | Mikrofon mit Windows-Zugriffserlaubnis oder Audiodatei |

**Planungsempfehlung:** Für App, Laufzeiten, beide Modelle und Downloadreserve
zunächst mindestens 5 GB freien SSD-Speicher vorsehen. Das ist eine vorläufige
Reserve, keine gemessene finale Installergröße. Aufnahmen, weitere Modelle und
der Verlauf benötigen zusätzlichen Platz. Die RAM-Empfehlung ist eine
Projekt-Empfehlung, keine offizielle Mindestanforderung von NVIDIA oder OpenAI.
8-GB-PCs wurden bisher nicht verifiziert; 32 GB sind nicht als Pflicht anzusehen.

## Was bereits getestet wurde

Beide Modelle haben einen kurzen synthetischen englischen Audiosatz auf einem
Intel Core Ultra 7 265 mit 20 logischen Prozessoren, x64 und rund 31 GiB vom
Betriebssystem gemeldetem RAM erfolgreich erkannt. Dabei lief die Erkennung
explizit auf der CPU: Whisper mit INT8 und Parakeet mit CPUExecutionProvider.
Der Test belegt keinen Mindest-RAM-Bedarf und garantiert keine bestimmte
Geschwindigkeit auf anderen PCs. Langzeitaufnahmen und deutsche Sprache müssen
noch gesondert geprüft werden.

## Grafikkarten, ARM und andere Modellgrößen

Eine NVIDIA-GPU ist trotz des Namens Parakeet keine Voraussetzung für diese
ONNX-Ausgabe. GPU-Beschleunigung ist derzeit in BlitzDic nicht aktiviert.
Die zugrunde liegenden Bibliotheken bieten GPU-Varianten; deren passende
Treiber, CUDA-/cuDNN-Versionen beziehungsweise DirectML-Laufzeit müssten für
eine spätere GPU-Ausgabe separat geprüft werden. Deshalb gibt es hier noch
keine zugesicherte GPU-/VRAM-Mindestanforderung.

Diese Ausgabe ist für x64 eingerichtet. Windows-on-ARM ist für BlitzDic noch
nicht getestet. Die Werte für Whisper Small gelten nicht automatisch für
Whisper Medium, Large oder Turbo; andere Modelle können erheblich mehr Speicher
und Rechenleistung benötigen.

## Zusätzliches lokales LLM für Schreibmodi

Whisper und Parakeet erkennen Sprache. Ein zusätzliches LLM in Ollama oder
LM Studio formuliert den Text um und hat eigene, modellabhängige RAM-/VRAM-
Anforderungen. Diese sind in den obigen Empfehlungen nicht eingerechnet.
Bei einem LLM auf einem Netzwerk-PC oder über eine API entsteht dieser
zusätzliche Modell-Speicherbedarf auf dem Server. Die lokale Spracherkennung
benötigt auf dem Arbeitsplatz weiterhin ihre oben beschriebene Ausstattung.

## Quellen und Abgrenzung

- [Whisper Small: Modellformat und Herkunft](https://huggingface.co/Systran/faster-whisper-small)
- [faster-whisper: CPU-INT8, GPU-Abhängigkeiten und Benchmarks](https://github.com/SYSTRAN/faster-whisper)
- [Parakeet Ultra: Moondream-Nachtraining des NVIDIA-Modells](https://huggingface.co/moondream/parakeet-ultra)
- [Verwendete ONNX-Konvertierung: Varianten und Kompatibilität](https://huggingface.co/Masterx/parakeet-tdt-0.6b-ultra-onnx)
- [onnx-asr: Windows-Unterstützung und CPU-/GPU-Laufzeiten](https://istupakov.github.io/onnx-asr/installation/)

Dateigrößen und Testrechner stammen aus lokalen Messungen. RAM- und
SSD-Planungsempfehlungen sind eigene vorläufige Richtwerte. Die genannten
Quellen liefern keine einheitliche verbindliche Mindestkonfiguration für die
hier kombinierte BlitzDic-Anwendung.
