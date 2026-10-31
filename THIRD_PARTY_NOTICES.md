# Drittanbieter und Modellherkunft

BlitzDic basiert auf MIT-lizenziertem Code der Blitztext contributors.
Copyright-Hinweise bleiben in LICENSE erhalten; die Git-Historie dokumentiert
übernommene Schreibmodi und Anbieterprotokolle.

## In der Windows-Ausgabe verwendete Sprachmodelle

- OpenAI Whisper Small, MIT: https://github.com/openai/whisper
- CTranslate2-Konvertierung von Systran, MIT:
  https://huggingface.co/Systran/faster-whisper-small
- NVIDIA Parakeet TDT 0.6B v3 als Grundlage, CC-BY-4.0:
  https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3
- Moondream Parakeet Ultra, Nachtraining, CC-BY-4.0:
  https://huggingface.co/moondream/parakeet-ultra
- Masterx ONNX-Konvertierung, INT8-Quantisierung, CC-BY-4.0:
  https://huggingface.co/Masterx/parakeet-tdt-0.6b-ultra-onnx
- CC-BY-4.0: https://creativecommons.org/licenses/by/4.0/

BlitzDic bündelt die festgelegten Konvertierungen unverändert. Konvertierung und
Quantisierung stammen von den genannten Herausgebern. Es besteht keine behauptete
Unterstützung oder Empfehlung durch diese Herausgeber.

## Windows-Laufzeiten

Electron, faster-whisper, CTranslate2, onnx-asr, ONNX Runtime, PyAV/FFmpeg
und deren Abhängigkeiten haben eigene Lizenzbedingungen. SoundFile/libsndfile
wurde bis 0.3.5 verwendet und entfällt ab 0.3.6; interne WAV-Dateien benötigen
diese Bibliothek nicht mehr.
Die Versionen stehen in package-lock.json und speech/requirements.lock.txt.
scripts/collect-licenses.py sammelt die mitgelieferten Paket-Lizenztexte, Python-
und Chromium-Hinweise sowie die versionsgebundenen Ergänzungen unter
BlitzDicWindows/licenses/upstream. Das Build-Inventar dokumentiert Herkunft und
Prüfsummen. Eingebettete native Bibliotheken und deren Quellcodepflichten müssen
vor der fertigen Veröffentlichung zusätzlich geprüft werden.

Ab Windows 0.3.5 verwendet die Paketierung das private PyAV-Wheel
16.0.1+blitzdic.1 mit FFmpeg 8.0.3, dynamisch unter LGPL v2.1 oder später,
ohne aktivierte GPL-/Nonfree-Komponenten. Die ausführbaren PyAV-Codeabschnitte
bleiben unverändert; DLL-Importnamen und Paketmetadaten sind angepasst.
Der korrespondierende FFmpeg-Quellcode, Build-Skript, Konfiguration, Lizenztexte
und Hash-Manifest sind im Paket unter den Python-Paket-Lizenzen enthalten.
GCC-/CRT-/winpthread-Laufzeittexte liegen dort ebenfalls. Über Einstellungen
lassen sich Lizenzen und Quellcode öffnen. Andere native Abhängigkeiten bleiben
Gegenstand der laufenden Prüfung.

Für CTranslate2s Intel-OpenMP-DLL wurde Bytegleichheit mit intel-openmp 2025.3.0
nachgewiesen. Dessen originaler Intel-EULA-Text und der Herkunftsnachweis werden
unter `licenses/native/intel-openmp` gesammelt. Das ist kein Abschluss der
Prüfung aller Weitergabebedingungen. Hinweise zu der im Build genannten oneDNN-
Version 3.1.1 liegen daneben. NumPys OpenBLAS-Lieferdatei wurde ebenfalls
bytegleich mit scipy-openblas64 0.3.34.106.0 abgeglichen. Die NumPy-Pakethinweise
enthalten die OpenBLAS-/LAPACK-Lizenztexte.

## Speaker auxiliary models in Windows 0.3

The package now also includes pyannote segmentation-3.0 (CNRS, MIT) and
NVIDIA NeMo TitaNet-Small (the original NGC card refers to the NeMo Toolkit
license; the v1.19.0 Apache-2.0 text is included). Both ONNX conversions are
published by sherpa-onnx and distributed unchanged by BlitzDic. Dedicated
attribution, source links and complete texts are in
BlitzDicWindows/licenses/diarization and the installed resources/licenses/diarization.
Pinned source URLs and SHA-256 fingerprints are in speech/diarization-models.json.
The sherpa-onnx/core runtime is Apache-2.0; its version-bound notice is collected
with the remaining Python dependencies. General native-library review remains open.
