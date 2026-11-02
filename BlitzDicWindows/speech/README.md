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

`worker.py --output-mute` serves acknowledged NDJSON mute leases. It changes only
the mute switch of the default multimedia rendering endpoint, holds that exact
endpoint until restoration, and preserves an already-muted device. EOF restores
an owned change. `--output-mute-status` only queries its current mute state.
`scripts/test-output-mute.py` exercises fake endpoints, including partial failures,
device changes and EOF; it never changes Windows audio. `node
scripts/verify-output-mute-ui.mjs` uses a headless renderer with fake IPC/recorder
to check settings and meeting/dictation routing without desktop focus or audio
access. This renderer fixture does not prove actual Main IPC or native mutation.

`node scripts/verify-website-settings.mjs` checks real renderer/IPC/DPAPI storage,
canonical host persistence, invalid edits, concurrent settings saves and clearing
rules. It saves screenshots in a new `.runtime/website-settings-artifacts-*`
directory. Run it separately from foreground browser tests, because its own
visible Electron windows can take focus.

`scripts/verify-website-modes.mjs` uses a fresh owned Chrome or Edge profile and
an isolated HTTP fixture. `BLITZDIC_BROWSER=edge` selects Edge. It checks the
focused document host, URL-shaped editable text and cross-origin frames without
reading an unrelated foreground window. `BLITZDIC_WEBSITE_E2E=1` additionally
checks actual ASR, website/app precedence, explicit shortcuts and the no-LLM
fallback. Choose `BLITZDIC_TEST_PRESET=parakeet-ultra` and
`BLITZDIC_TEST_HOLD=1` for Parakeet with hold-to-dictate. Optional executable
overrides are `BLITZDIC_TEST_EXECUTABLE` and
`BLITZDIC_TEST_SPEECH_EXECUTABLE`. `BLITZDIC_TEST_WAIT_FOR_FOCUS=1` waits up to
30 minutes for manual focus; leave its exact fixture window active until it
closes. It generates only owned test keystrokes after foreground ownership checks.

The host bridge follows the exact focused UIA element's document ancestors,
reads the document's LegacyIAccessible URL property and returns only its host.
It does not inspect the address bar, arbitrary browser text or screen positions.
Unavailable metadata falls back to the program rule. Run
`powershell.exe -NoProfile -File scripts/test-uia-compile.ps1` to compile the
bridge without inspecting any application. Native browser acceptance remains
separate from this compilation check.

`scripts/test-uia-scope.ps1` also verifies early rejection of an impossible
window/signature without querying application elements. `scripts/test-target-scope.py`
checks the actual worker's malformed/mismatched window scopes. Website tests pass
their owned HWND and browser PID through capture requests, including the tested
app's capture subprocess. UIA and classic insertion reject a changed foreground
window before reading another field. Existing document/selection/modifier guards
remain in place. Optional `BLITZDIC_UIA_TRACE=1` logs phase names and elapsed time,
never field text or URLs; the website verifier forwards these diagnostics.

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

`BLITZDIC_TEST_INDICATOR=1` additionally checks the visible recording indicator
and captures the actual Windows foreground handle while it is displayed. The
handle must still match the owned external editor. The indicator must disappear
after recording stops. This opt-in check requires source/packaged 0.3.8 or later;
the older installed 0.3.6 has no recording indicator. `BLITZDIC_TEST_FIT=1` also
checks the lowercase sentence continuation in the English test fixture.

For real speaker naming and encrypted reload, run `scripts/verify-meeting-audio.mjs`
with `BLITZDIC_TEST_DIARIZE=1` and `BLITZDIC_TEST_RENAME=1`. It exercises both
bundled ASR engines unless `BLITZDIC_TEST_PRESET` selects one, names the detected
speaker in the last section and verifies both the original IDs and the separately
stored name after reopening the saved meeting. This requires source/packaged 0.3.9
or later; use `BLITZDIC_TEST_EXECUTABLE` for the packaged executable.

## Hold-shortcut development checks

Source 0.3.10-dev.0 adds `BLITZDIC_TEST_HOLD=1` to verify-hotkey.mjs. The resident
test helper holds only its own injected Ctrl+Shift+number chord until release;
it refuses to press keys unless the exact owned test editor is foreground or if
those keys were already pressed. It always releases its own keys at EOF/cleanup.
Use `BLITZDIC_TEST_EXTERNAL_INPUT=1` for actual manually supplied hold/release input.
The packaged native hold and toggle flows passed with both bundled engines on
2026-11-01 using Windows keydown/up injection and a synthetic microphone. This
does not replace hardware-keyboard, physical-microphone or clean-VM testing.

`node --test test/hold-shortcuts.test.js` covers repeat, early release, cancellation,
stale workers and shutdown with controlled promises. `scripts/test-hold-keys.py`
checks Windows accelerator parsing and simulated key-state transitions using only
the standard library; CI runs it on Windows. The frozen worker actions
`validate-hold-shortcuts` and `wait-shortcut-release` are bundled. A non-held chord
query proves packaging and API availability, not physical key delivery.

## Escape development checks

Source 0.3.10-dev.1 adds scoped Escape control. Escape stops a recording and
transcribes it; during ASR or rewriting it cancels the operation. The separate
`--escape-control` worker accepts JSON-line `{id, active}` commands and acknowledges
hook state. Only Escape is consumed while a workflow is active; other keys are
passed through without recording them. An owned Escape key-up is completed even
if the workflow ends while that key is held. Pipe closure/app shutdown removes
the hook. Hook callbacks enqueue events; stdin/stdout I/O runs on other threads.

`scripts/test-escape-control.py` covers repeat/preheld/key-up ownership and actual
native arm/disarm/EOF. Set `BLITZDIC_TEST_RUNTIME` to a frozen worker executable to
repeat the native lifecycle check there. Node tests additionally cover generations,
worker failure and shutdown. CI runs both sets.

Set `BLITZDIC_TEST_ESCAPE=1` for the guarded hotkey test to stop with native Escape
and verify that idle Escape reaches the external editor again. Combine it with
`BLITZDIC_TEST_HOLD=1` to press Escape while the helper still holds its shortcut.
`BLITZDIC_TEST_ESCAPE_CANCEL=1` adds an intentionally pending loopback rewrite and
cancels it with a second Escape; history and editor must stay empty/unchanged.
Use `BLITZDIC_TEST_ESCAPE_CANCEL_ASR=1` instead to cancel during actual local ASR.
`BLITZDIC_TEST_WAIT_FOR_FOCUS=1` optionally waits up to ten minutes for the exact
owned foreground editor. It does not relax any foreground or preheld-key guard.

## Attribution

Whisper: OpenAI (MIT), CTranslate2 export by Systran, faster-whisper runtime.
Parakeet Ultra: NVIDIA base model, Moondream post-training, Masterx ONNX
conversion, CC-BY-4.0. Runtime: onnx-asr / ONNX Runtime.
Model source and license links:

- https://huggingface.co/Systran/faster-whisper-small
- https://huggingface.co/moondream/parakeet-ultra
- https://huggingface.co/Masterx/parakeet-tdt-0.6b-ultra-onnx
- https://creativecommons.org/licenses/by/4.0/
