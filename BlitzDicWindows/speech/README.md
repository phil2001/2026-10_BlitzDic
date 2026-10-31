# Local speech recognition

German user guide: [Systemvoraussetzungen für Whisper und Parakeet Ultra](../SYSTEMVORAUSSETZUNGEN.md).

Development setup (Windows x64, uv installed):

```powershell
./scripts/setup-speech.ps1
```

The environment is project-local under `.runtime`. `requirements.lock.txt`
records the tested dependency versions. PyAV is pinned to 16.0.1: version
19.0.2 removed an argument used by faster-whisper 1.2.1 and failed decoding.

Download a preferred model explicitly:

```powershell
'{"action":"download","preset":"whisper","modelDirectory":"models/whisper"}' | .runtime/venv/Scripts/python.exe speech/worker.py
'{"action":"download","preset":"parakeet-ultra","modelDirectory":"models/parakeet-ultra"}' | .runtime/venv/Scripts/python.exe speech/worker.py
```

Transcription accepts `action: transcribe`, the same preset/directory and an
`audioPath`. Whisper handles file decoding through PyAV. Parakeet currently
accepts soundfile-supported audio formats, mixes channels to mono, and splits
long audio near quiet boundaries between 17 and 20 seconds. This segmentation
is not speaker diarization and needs long-form quality evaluation.

Transcription sets Hugging Face offline mode and uses local model files;
there is no remote recognition fallback. Both engines currently run on CPU.
Downloaded presets are pinned to the tested repository commits in worker.py.

## Verified on 2026-10-31

Windows System.Speech generated this fixture locally:
“This is a local speech recognition test. The meeting starts tomorrow at nine.”
Both engines recognized the key phrases through the Node-to-Python IPC path.
Whisper took about 3.5 seconds and Parakeet about 7 seconds including process
startup/model loading. This is a smoke test, not an accuracy benchmark.

To repeat, generate `.runtime/test-speech.wav` using System.Speech, then:

```powershell
$env:BLITZDIC_ASR_TEST = '1'
npm.cmd test
```

Both actual-model tests passed. Without the environment
variable, those two tests are explicitly skipped. Synthetic microphone capture and bundled packaged inference have since passed. Physical microphone tests, German accuracy evaluation, GPU operation and a clean installation test remain pending.

## Attribution

Whisper: OpenAI (MIT), CTranslate2 export by Systran, faster-whisper runtime.
Parakeet Ultra: NVIDIA base model, Moondream post-training, Masterx ONNX
conversion, CC-BY-4.0. Runtime: onnx-asr / ONNX Runtime.
Model source and license links:

- https://huggingface.co/Systran/faster-whisper-small
- https://huggingface.co/moondream/parakeet-ultra
- https://huggingface.co/Masterx/parakeet-tdt-0.6b-ultra-onnx
- https://creativecommons.org/licenses/by/4.0/
