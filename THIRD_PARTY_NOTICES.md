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

Electron, faster-whisper, CTranslate2, onnx-asr, ONNX Runtime, PyAV/FFmpeg,
SoundFile/libsndfile und deren Abhängigkeiten haben eigene Lizenzbedingungen.
Die Versionen stehen in package-lock.json und speech/requirements.lock.txt.
Vollständige Lizenztexte aller ausgelieferten Binärabhängigkeiten müssen vor
der fertigen Veröffentlichung zusätzlich zusammengetragen und geprüft werden.
