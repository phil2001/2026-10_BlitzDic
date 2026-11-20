# Systemvoraussetzungen für lokale Spracherkennung

Stand: 05.11.2026. Gilt für die aktuellen BlitzDic-Vorgaben und den getesteten
CPU-Betrieb. Die Windows-App befindet sich noch in Entwicklung.

Die vollständige Windows-Ausgabe bündelt Whisper Small, Parakeet Ultra und
die Sprachlaufzeit im Installer. Nach Installation ist kein Modelldownload und
keine separate Python-Installation nötig. Die Downloadangaben unten betreffen
die Entwicklungsumgebung; Endnutzer laden einmal den vollständigen Installer.
Beide Modelle zusammen belegen unkomprimiert etwa 1,16 GB zusätzlich zu App
und Laufzeiten. Externe LLM-Anbieter für Schreibmodi werden separat eingerichtet.

Für die Ordinations-Arbeitsplätze ist ein vollständiger Installer vorgesehen,
der auch die benötigten C++-Laufzeitdateien mitliefert. Visual Studio, Python,
CUDA und LM Studio sind dort für die lokale Spracherkennung nicht als zusätzliche
Installationen vorgesehen. Visual Studio Community wird nur in der
Entwicklungsumgebung verwendet. Ein Test auf einem frischen Windows-11-PC ohne
Entwicklertools steht noch aus; die bisherigen Tests ersetzen diesen nicht.
Ein optionaler gemeinsamer LLM-Server wird auf dem dafür vorgesehenen Netzwerk-PC
eingerichtet und in BlitzDic über seine Adresse konfiguriert.

| Voraussetzung | OpenAI Whisper | Parakeet Ultra (NVIDIA / Moondream) |
|---|---|---|
| Vorkonfiguriertes Modell | Whisper Small, mehrsprachig, faster-whisper | Parakeet Ultra 0.6B, ONNX INT8 |
| Betriebssystem dieser Ausgabe | Windows 11, x64 | Windows 11, x64 |
| Prozessor | Intel-/AMD-x64-Prozessor mit x86-64-v2; moderner Mehrkernprozessor empfohlen | Intel-/AMD-x64-Prozessor mit x86-64-v2; moderner Mehrkernprozessor empfohlen |
| RAM-Empfehlung für den gesamten PC | 16 GB | 16 GB |
| Verbindliche RAM-Mindestgrenze | Noch nicht auf kleinen PCs ermittelt | Noch nicht auf kleinen PCs ermittelt |
| NVIDIA-Grafikkarte / CUDA | Nicht erforderlich im aktuellen CPU-Betrieb | Nicht erforderlich im aktuellen CPU-Betrieb |
| Reine installierte Modelldateien, lokal gemessen | 486.212.372 Byte, etwa 486 MB | 670.479.254 Byte, etwa 670 MB |
| Internet | Einmalig für den Installerdownload; danach lokale Transkription ohne Modelldownload offline | Einmalig für den Installerdownload; danach lokale Transkription ohne Modelldownload offline |
| Audio | Mikrofon mit Windows-Zugriffserlaubnis oder Audiodatei | Mikrofon mit Windows-Zugriffserlaubnis oder Audiodatei |

**Dauerhaft geladenes Modell:** Damit ein Diktat nicht auf das Laden des Modells
wartet, hält BlitzDic das gewählte Modell ständig in einem bereiten Sprachprozess.
Die installierte App startet dazu standardmäßig mit Windows im Infobereich
(abschaltbar unter Einstellungen). Das belegt dauerhaft grob 1 GB Arbeitsspeicher;
ein eigener Messwert für den Leerlauf steht noch aus. Bei 16 GB ist das eingeplant.

**Planungsempfehlung:** Für App, Laufzeiten, beide Modelle und Downloadreserve
zunächst mindestens 5 GB freien SSD-Speicher vorsehen. Für 0.3.10-dev.9 wurden
1,15 GB für den Installer und 1,86 GB für die entpackte App einschließlich der
Modelle gemessen. Die Empfehlung enthält Reserve für die Installation. Aufnahmen, weitere Modelle und
der Verlauf benötigen zusätzlichen Platz. Die RAM-Empfehlung ist eine
Projekt-Empfehlung, keine offizielle Mindestanforderung von NVIDIA oder OpenAI.
8-GB-PCs wurden bisher nicht verifiziert; 32 GB sind nicht als Pflicht anzusehen.

Die enthaltene NumPy-Version 2.5.4 meldet `X86_V2` als CPU-Basis, unter anderem
SSE4.2 und POPCNT. Der dazugehörige OpenBLAS-Build wurde bytegleich mit dem
offiziellen Lieferpaket abgeglichen; Nachweis unter
`licenses/native/numpy-openblas/provenance.json`. Diese Angabe beschreibt die
Numerikkomponente und ersetzt keine Tests sämtlicher CPU-/Treiberkombinationen.

## Was bereits getestet wurde

Beide Modelle haben einen kurzen synthetischen englischen Audiosatz auf einem
Intel Core Ultra 7 265 mit 20 logischen Prozessoren, x64 und rund 31 GiB vom
Betriebssystem gemeldetem RAM erfolgreich erkannt. Dabei lief die Erkennung
explizit auf der CPU: Whisper mit INT8 und Parakeet mit CPUExecutionProvider.
Der Test belegt keinen Mindest-RAM-Bedarf und garantiert keine bestimmte
Geschwindigkeit auf anderen PCs.

Auch ein kurzer synthetischer deutscher Satz wurde mit beiden tatsächlich im
Windows-Paket enthaltenen Modellen und dessen Sprachlaufzeit erfolgreich geprüft:
Umlaute, „Anna prüft die Unterlagen“, „morgen um 9 Uhr“, ein Budget von 2.500 Euro
und die offene Lieferung nach Berlin blieben erhalten. Whisper erkannte die
Sprache als Deutsch. Das ist ein Funktionstest, kein allgemeiner Genauigkeitsnachweis.
Mit der installierten Entwicklungsversion wurden auch lange synthetische deutsche
Aufnahmen geprüft. Beim physischen Mikrofontest meldete der Benutzer nach mehreren
abweichenden Ergebnissen mit Parakeet und explizit gewähltem Realtek-USB-Mikrofon
den korrekten Satz „Die Besprechung beginnt um neun Uhr, Anna prüft die Unterlagen.“
Dieses letzte Ergebnis wurde vom Benutzer zurückgemeldet und nicht unabhängig
aus der App ausgelesen. Dialekte und medizinisches Fachvokabular bleiben zu prüfen.

### Gemessener Speicherbedarf und Laufzeit

Der Worker aus 0.3.10-dev.9 verarbeitete eine synthetische englische WAV-Datei
von 105,2 Sekunden. Der Test lief unter Windows 11 Pro (Build 26200) auf dem
oben genannten PC mit 31,4 GiB sichtbarem RAM. Je Modell startete ein eigener
Prozess. Die Messzeit umfasst den Start und das Laden des Modells. Alle sechs
Abschnitte wurden anhand ihrer Textmarker erkannt.

| Modell | Verarbeitung | Maximaler physischer Speicher des Workers | Höchster gemessener privater Speicher des Workers |
|---|---:|---:|---:|
| Whisper Small | 15,38 s | 1.006 MiB | 3.586 MiB |
| Parakeet Ultra | 16,28 s | 1.047 MiB | 1.700 MiB |

Der physische Speicher entspricht dem Windows-Wert `PeakWorkingSet64`.
Der private Speicher (`PrivateMemorySize64`) wurde alle 100 ms abgefragt und
kann auch nicht im RAM befindlichen Speicher umfassen. Die Tabelle enthält
Einzelmessungen des Sprachprozesses. Der Bedarf von Windows, der BlitzDic-Oberfläche,
eines zusätzlichen LLM und von paralleler Aufnahme ist darin nicht enthalten.
Die Messung begründet keine RAM-Mindestanforderung für andere PCs.

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
