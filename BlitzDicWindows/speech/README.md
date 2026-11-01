# Local speech recognition

German user guide: [Systemvoraussetzungen für Whisper und Parakeet Ultra](../SYSTEMVORAUSSETZUNGEN.md).

Development setup (Windows x64, uv installed):

First prepare the private clean-FFmpeg wheel as described in
[BUILD_FFMPEG.md](../licenses/native/BUILD_FFMPEG.md).

```powershell
./scripts/setup-speech.ps1
```

The environment is project-local under `.runtime`. `requirements.lock.txt`
records the tested dependency versions. The private PyAV build uses 16.0.1+blitzdic.1
and FFmpeg 8.0.3. Its Python API is pinned to upstream 16.0.1: version
19.0.2 removed an argument used by faster-whisper 1.2.1 and failed decoding.

Download a preferred model explicitly:

```powershell
'{"action":"download","preset":"whisper","modelDirectory":"models/whisper"}' | .runtime/venv/Scripts/python.exe speech/worker.py
'{"action":"download","preset":"parakeet-ultra","modelDirectory":"models/parakeet-ultra"}' | .runtime/venv/Scripts/python.exe speech/worker.py
```

Transcription accepts `action: transcribe`, the same preset/directory and an
`audioPath`. Whisper handles file decoding through PyAV. Parakeet currently
uses the shared PyAV decoder for local audio formats, mixes channels to mono, and splits
long audio near quiet boundaries between 17 and 20 seconds. This segmentation
is not speaker diarization and needs long-form quality evaluation.
Internal speaker turns are written as PCM16 WAV by the Python standard library.
The runtime no longer needs SoundFile, libsndfile, CFFI or pycparser. Advertised
file formats continue to be decoded by the shared PyAV path.

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

## Installed-app hotkey checks

`scripts/verify-hotkey.mjs` can target the installed app through
`BLITZDIC_TEST_EXECUTABLE`. Set `BLITZDIC_TEST_APP_RULE=1` to check that the
foreground editor's `electron.exe` rule selects the clean mode, sends the expected
rewrite prompt to an isolated loopback fixture, inserts its response and records
the chosen mode in encrypted history. Set `BLITZDIC_TEST_EXPLICIT_MODE=calm` to
check that Ctrl+Shift+3 preserves an explicit choice over that rule. This fixture
tests routing and insertion, not the quality of a real LLM.

The default resident key helper refuses input unless the exact owned test window
is foreground. `BLITZDIC_TEST_EXTERNAL_INPUT=1` instead waits for actual shortcut
input in that editor and prints the required chord. Focus the test textarea at its
end before starting; the synthetic microphone is supplied by the test fixture.
Both the Whisper/rule-selected mode and Parakeet/explicit-mode checks passed on
2026-11-01 against installed 0.3.6, with Windows input supplied through Computer Use.

## Attribution

Whisper: OpenAI (MIT), CTranslate2 export by Systran, faster-whisper runtime.
Parakeet Ultra: NVIDIA base model, Moondream post-training, Masterx ONNX
conversion, CC-BY-4.0. Runtime: onnx-asr / ONNX Runtime.
Model source and license links:

- https://huggingface.co/Systran/faster-whisper-small
- https://huggingface.co/moondream/parakeet-ultra
- https://huggingface.co/Masterx/parakeet-tdt-0.6b-ultra-onnx
- https://creativecommons.org/licenses/by/4.0/
