# BlitzDic for Windows 11

Hardware guidance: [Systemvoraussetzungen für Whisper und Parakeet Ultra](BlitzDicWindows/SYSTEMVORAUSSETZUNGEN.md).
The model-selection UI must display these requirements before downloading a
model, including the distinction between CPU support and optional GPU support.

## Provenance

Windows fork of https://github.com/cmagnussen/blitztext-app at
`ebd5c84de89a924b4dce82c1d718f9597fcd33e6`. The upstream history and MIT
copyright notice are retained. Windows distribution must use independent
BlitzDic branding; upstream brand assets are not licensed for reuse.

## Implementation and acceptance checklist

The Windows application is in development. A bundled development installer exists;
a finished release remains pending. This checklist tracks the full deliverable.

- [x] Import original source and ancestry into the target repository.
- [ ] Windows 11 desktop application, tray, microphone selection, recording
      indicator, global configurable shortcuts, cancellation, safe insertion at
      the original cursor and restoration of clipboard contents.
- [ ] Preserve the four writing modes and editable instructions, dictionary,
      replacements, encrypted local history, audio-file transcription, per-app
      preferences, meeting transcription and summaries.
- [ ] Local speech recognition with preferred Whisper and NVIDIA Parakeet
      presets, model download management and actionable hardware/runtime errors.
      Verify the upstream Parakeet Ultra model's Windows runtime compatibility;
      never label a different Parakeet model as Ultra.
- [ ] Local LLM execution on the user's computer through Ollama/LM Studio.
- [ ] Configurable LAN host for Ollama and LM Studio, including model discovery.
- [ ] API access and preservation of OpenAI, Anthropic, Gemini, Mistral,
      OpenRouter and custom compatible endpoints. Keep speech recognition
      configuration independent of text-rewriting configuration.
- [ ] Additional models can be entered manually; only the requested speech
      model families receive presets. Secrets use Windows-protected storage.
- [ ] Clear indication of where audio/text is processed, connection testing,
      timeouts and useful errors; no silent remote fallback for local operation.
- [ ] Windows installer/portable artifact with third-party notices, reproducible
      build instructions and CI. Test actual packaged startup on Windows 11.
- [ ] Verify microphone-to-transcript-to-target-app end to end, both preferred
      speech engines, local/LAN/API rewriting, cancellation and offline behavior.

## Porting evidence

### Windows progress, 2026-10-31

The first development installer with both speech models has been built:
`BlitzDicWindows/dist/windows-bundled/BlitzDic Setup 0.1.0.exe` (1,095,378,134
bytes). It is not the finished release. Its unpacked packaged app was tested
through Electron/Playwright with both bundled models: file selection -> local
recognition -> visible transcript, without separately installing model files
in the user profile. Both tests passed with no observed JavaScript errors.
Installer execution on a clean Windows installation is still unverified.

The current source additionally provides manual selection of compatible local
Whisper/CTranslate2 or Parakeet TDT ONNX INT8 folders. That addition postdates
the above installer and needs inclusion in the next build.

Outstanding release gates include real microphone capture, safe insertion into
other apps, tray workflow, configurable shortcut UI, meeting features, complete
third-party license distribution, visual polish, real LLM server tests and
publication to the target repository. Do not mark this goal complete from the
existence of the installer alone.

Additional source verification: Chromium's file-backed synthetic microphone was
used through getUserMedia -> AudioWorklet -> PCM WAV -> Electron IPC -> actual
Whisper inference -> visible transcript. The expected test sentence was recognized
without observed JavaScript errors. This does not validate physical microphone
hardware or Windows microphone permissions on another PC.

Tray support and editable global toggle shortcuts were added after the first
bundled installer. Electron reports the default shortcut registered; closing the
window leaves it hidden and alive. A full physical-keypress and external-app
insertion test remains outstanding.

Microphone audio now travels as an in-memory WAV buffer to the speech worker;
the current source no longer creates a recording file. Both Whisper (synthetic
microphone UI flow) and Parakeet (in-memory worker call) were verified. Existing
recordings from earlier development tests have not been removed. The previously
built installer predates this change and must be rebuilt before delivery.

Native Edit/RichEdit target capture and guarded insertion are implemented. The interactive script BlitzDicWindows/scripts/verify-insertion.py now verifies a real Windows Edit control through separate speech-worker processes: Unicode and emoji insertion, selection replacement, undo, changed-cursor rejection, password/read-only rejection, and unchanged clipboard sequence. This proves the native Edit adapter, not RichEdit, Browser/Office UI Automation, or the complete global-shortcut recording flow. Those remain outstanding; unknown controls are rejected rather than guessed.

The application now targets Windows 11 exclusively. Legacy platform sources and documentation have been removed. Ported mode prompts and provider behavior live in BlitzDicWindows/src. The original ancestry and MIT notices remain available in Git history and LICENSE.

A real LM Studio integration test passed with the already installed qwen2.5-coder-3b-instruct model: discovery, connection check and German text rewriting. The test server was stopped and its model unloaded afterwards. LAN and cloud endpoints remain unverified. Whisper and Parakeet run independently of LM Studio through the bundled speech runtime.

UI Automation now supports modern text fields via the bundled helper script and Windows system PowerShell/.NET. The Chromium test verifies textarea/contenteditable insertion and rejects changed document text, selection or focus. See BlitzDicWindows/speech/WINDOWS_INSERTION.md for exact coverage and SendInput limitations. Office and the complete shortcut flow remain unverified. Rebuild the speech runtime before packaging.

The full global-shortcut flow has now passed with both Whisper and Parakeet Ultra:
a resident keyboard test helper sends the real Windows shortcut, Chromium's
synthetic microphone feeds the recording, actual local inference runs, and text
appears in a separate Chromium editor without refocusing it. Physical microphone
hardware remains unverified. The first test helper launched at shortcut time
occasionally disturbed foreground focus; starting it beforehand fixed that test
setup. Missing target capture is now explained in the app instead of silently
leaving insertion unattempted. Recorder sessions now isolate asynchronous startup
resources, preventing cancelled permission/resume requests from damaging a newer
recording. A regression test covers both delayed microphone permission and resume.

## Updated Windows package, 2026-10-31

`BlitzDicWindows/dist/windows-2026-10-31T16-22-46-818Z-038b2c/BlitzDic Setup 0.1.0.exe`
was built successfully (1,095,896,052 bytes, SHA-256
`5309AA4CAB9F6F9F36607628ACE9C0AEA21706B219E9AD54AF0F65F77D5A8AEB`).
Its unpacked executable passed the full global-hotkey -> synthetic microphone ->
bundled inference -> external Chromium insertion flow with both Whisper and
Parakeet Ultra. It includes the current recording cancellation fix, native and
UI Automation adapters, and the packaged PowerShell helper. It does not require
a separate speech Python installation or model download.

The new build command creates fresh timestamped directories, builds its own
speech runtime and collects Python package, Python and Electron/Chromium notices.
The installer above was produced before three supplemental package notices were
added. Those notices are now present in source at pinned upstream versions, and
the revised collector reports no missing package notices. They will be included
in the next installer. Native-library source/license obligations still require
review. This remains an unsigned development build, not a finished release;
installer execution on a clean Windows installation is still unverified.

Program-specific writing modes are now available under Settings. Rules use exact
executable names, for example winword.exe => clean. They apply to the default
verbatim shortcut; explicit clean/calm/emoji shortcuts retain their selected mode.
The worker resolves the foreground process executable via Windows APIs and checks
it again after target capture. No window title or process path is persisted.
27 automated tests passed (two optional ASR tests skipped). The Electron UI test
verified encrypted rule persistence across reload and rejection of invalid modes.
A foreground integration attempt was stopped because Windows reported chrome.exe
instead of the test application's electron.exe. Actual per-program selection in
the global-shortcut flow therefore still needs an uncontested desktop test.
GitHub Windows tests for e6f8821 completed successfully. The prior Windows commits
have been pushed to origin/main; model weights and local audio remain outside Git.

## Installer execution verified, 2026-10-31

The unsigned development installer from windows-2026-10-31T16-22-46-818Z-038b2c
was executed silently into the previously nonexistent project-local directory
BlitzDicWindows/.runtime/installed-test-20261031. Installer exit code was 0.
No prior BlitzDic installation or BlitzDic desktop/start-menu shortcut was found
in the preflight checks. The desktop shortcut was disabled for this test.

scripts/verify-installed.mjs launched the installed executable with a fresh profile,
verified app.isPackaged and bundled model/runtime files, then exercised audio import
through the UI with both Whisper and Parakeet Ultra. Both produced the expected
fixture sentence with no observed page errors. Speech was processed by the installed
blitzdic-speech.exe, without copying models into the profile or installing Python
for the application. Development Playwright and the test WAV remain test-harness
requirements only. The test installation remains present; it was not uninstalled.

This verifies installation on the current Windows workstation, not an isolated
clean Windows VM. The installer predates per-program mode preferences and the
three supplemental license notices; a later build must include those changes.
The physical microphone, Office, meetings, visual polish and native-library license
review remain open. Latest GitHub Windows tests for ed54fba completed successfully:
https://github.com/phil2001/2026-10_BlitzDic/actions/runs/41220060386

## Meeting summaries, 2026-10-31

A Meetings page now accepts an existing transcript or the last dictation's original
text and summarizes it through the configured local/LAN/API provider. Longer source
text is processed in bounded chunks and merged; prompts require source-grounded
facts, explicit uncertainty, decisions, tasks and open questions. Prompt constraints
are not a guarantee of model accuracy. Original transcript and summary are stored
in a separate DPAPI-encrypted collection capped at 100 entries. Summary generation
is cancellable; provider failures preserve the input and do not save partial results.
This does not yet provide live meeting capture, system audio or speaker diarization.

29 unit/integration tests passed (two optional actual-model tests skipped).
scripts/verify-meetings.mjs passed the UI -> local mock HTTP provider -> encrypted
store -> reload path. This proves orchestration and persistence, not actual LLM
summary quality. The existing installer predates this feature and must be rebuilt.

## Meeting microphone capture, 2026-10-31

The Meeting page now records microphone audio in memory and transcribes it locally
on stop using the selected Whisper or Parakeet preset. Recordings are bounded to
30-minute sections; successive sections append to the editable transcript. This
path uses verbatim recognition, suppresses dictation-history persistence and never
automatically invokes the LLM. The transcript remains unsaved in the window until
the explicit summary-and-save action. Recording/summary/dictation controls prevent
overlapping UI operations; cancellation releases either recorder.

scripts/verify-meeting-audio.mjs passed the real getUserMedia/AudioWorklet path with
a synthetic microphone fixture through both actual speech models. It verifies the
recognized text, empty dictation history, no saved meeting and no automatic summary.
30 regression tests passed (two optional ASR tests skipped in the unit run).
This is post-recording transcription, not streaming live notes. System audio,
speaker diarization, physical microphone and long-recording quality remain open.
The existing installer still predates the Meeting page and needs rebuilding.

## Windows system audio, 2026-10-31

Meeting capture now offers microphone, system audio or both. The Electron
setDisplayMediaRequestHandler permits only the app main frame with a user gesture
and an audio request. Windows loopback supplies the whole output mix, not a single
meeting application. Both inputs are mixed with equal gain and transcribed locally
on stop. Missing live system-audio tracks cause a visible error, without fallback.
The required display capture also acquires a low-frame-rate video track; the app
does not consume, save or send video frames, and stops all tracks on cancellation.

scripts/verify-system-audio.mjs passed an actual Windows loopback test using a quiet
oscillator on the real output device, verifying AudioWorklet meter activity and
cancellation without persistence. This is stronger than a fake-stream test, but
not a speech accuracy or mixed-source quality test. The first attempt exposed a
missing display-capture permission; the app-scoped permission was added and the
same test then passed. 30 regression tests also passed before that permission fix.

API reference: https://www.electronjs.org/docs/latest/api/desktop-capturer
The current installer predates this change and must be rebuilt. Long recordings,
combined microphone/loopback speech quality and diarization remain open.

## System-audio speech validation, 2026-10-31

The meeting-audio test now supports microphone, system or combined capture using
BLITZDIC_TEST_AUDIO_SOURCE, and an optional BLITZDIC_TEST_PRESET to isolate an
engine. In system mode it does not enable fake media devices: the known speech
fixture plays through Windows output and must return via actual loopback.
Whisper passed this full path. Parakeet completed local transcription but returned
a different sentence; a second isolated Parakeet attempt reproduced the mismatch.
The cause is not yet established (capture timing, concurrent output, or recognition
behavior need investigation). Mixed-source speech validation remains unperformed.
The test now checks processing completion before checking the expected sentence,
and diagnostics report transcript length rather than logging captured contents.
No meeting/history entries were intentionally saved by these tests. This evidence
does not establish Parakeet system-audio quality; it remains a release gate.

## Loopback startup correction, 2026-10-31

scripts/compare-system-audio.mjs captures one in-memory loopback WAV and passes
identical bytes to both actual engines, logging only expected-phrase indicators.
Without startup delay, Whisper recovered only the second expected phrase and
Parakeet neither. With a 1.5-second loopback warm-up, both recovered both phrases.
A separate synthetic-fixture check passed Parakeet at 22,050 and 48,000 Hz and at
full, 0.1 and 0.01 amplitude, so those factors alone did not reproduce the failure.

Recorder now retains its starting state for 1.5 seconds after AudioContext resume
when system audio is involved. The final comparison removed the test-only delay
and passed with both engines using this production warm-up. All 30 regression tests
passed (two optional ASR tests skipped). This resolves the observed short-fixture
failure on this workstation; it does not establish behavior on every audio device,
long-form accuracy or combined-source quality. The installer needs rebuilding.
No captured waveform or transcript was saved by the comparison script.

## Mixed-source and real local summary tests, 2026-10-31

The full meeting-audio UI test passed with BLITZDIC_TEST_AUDIO_SOURCE=both for
Whisper and Parakeet Ultra. A synthetic microphone and real Windows playback of
the speech fixture were mixed, recognized locally, and left no saved meeting or
dictation history. This is a controlled short test, not long-recording validation.

An actual LM Studio server and the preinstalled qwen2.5-coder-3b-instruct model
were exercised through the Meetings service using a synthetic German transcript.
The protocol and model inference worked, but quality checks found omitted tasks,
unfounded additions and misclassified open questions. Instructions were clarified
for first-person speaker assignments, absent deadlines and open questions. The
stronger verify-real-meeting-model.mjs still fails the open-question check for this
small coding model. Do not represent it as a successful summary-quality validation.
The script is an opt-in real-model quality gate, not part of deterministic unit CI.
The temporarily loaded test model was unloaded and its server stopped afterwards,
restoring their original unloaded/stopped state. No new model was downloaded.
Further model-quality work is required before claiming reliable meeting summaries.

## Current development package 0.2.0, 2026-10-31

The updated unsigned NSIS installer was built successfully:
BlitzDicWindows/dist/windows-2026-10-31T16-51-34-965Z-b5d89f/BlitzDic Setup 0.2.0.exe
Size: 1,095,874,997 bytes. SHA-256:
DB3A4C9E35A8A7EF9095617CA4A4146B3C4587DF8653FEC6EAAA91414F39A20B

It includes the current meeting recording/system-audio/warm-up logic, summary page,
program rules, both pinned models, frozen speech worker, UI Automation helper and
all 34 collected package notices, including the three upstream supplements.
Native-library source/license review remains open. A new original multi-resolution
waveform icon and Windows product/version metadata are embedded; the executable
reports BlitzDic 0.2.0.0. It remains unsigned.

verify-installed.mjs was run against this build's unpacked packaged executable
with a fresh profile. Both actual model import/transcription paths passed; the
Meeting page's three input sources and program-rule UI were present, and the
license inventory had no missing package notices. The rendered Meeting page was
visually inspected. This is not a repeat of installer execution or a clean-VM test;
the earlier 0.1.0 actual-installation evidence remains separate. Final visual parity,
meeting summary quality, diarization/live notes, native licenses and other remaining
acceptance items still prevent marking the full goal complete.

## Offline transcript persistence, 2026-10-31

The Meeting page now provides an explicit local transcript-save action that does
not read provider settings or call a model. It stores the exact original text and
an empty summary in the encrypted meeting collection. The summary-and-save action
remains independent. Saving raw text clears the visible previous summary to avoid
presenting it as a summary of a different edited transcript.

31 automated tests passed (two optional ASR tests skipped). The service test fails
if model generation is invoked or provider settings are requested by the offline
path. The extended Electron meeting UI test verified zero HTTP requests on raw
save, persisted exact text and empty summary, then separately generated a mock
summary and reloaded the stored entry. The 0.2.0 installer predates this addition;
a future package must include it. This closes an offline usability gap without
claiming summary-quality, diarization or live-streaming completion.

## Multi-section speech validation, 2026-10-31

scripts/make-long-speech.ps1 creates a 105.2-second English synthetic recording
using the installed Windows Zira voice. scripts/verify-long-speech.mjs verifies
six topic sections in order, each marker at both the beginning and end of its
section, six repeated meeting sentences, monotonic segment starts, and final audio
coverage. Whisper passed with 30 segments (~12.3 seconds processing), Parakeet Ultra
with six segments (~17.9 seconds), including model/process startup on this workstation.
Both engines sometimes wrote the homophone "pairs" for "pears". The completeness
test explicitly logs and normalizes that spelling difference; it does not treat
it as exact transcription accuracy. The initial stricter spelling assertion failed
and was investigated against the synthetic text before changing the check.

This adds evidence across Parakeet's 17–20-second processing boundaries, without
claiming a 30-minute stress test or German accuracy. Only an en-US Windows synthesis
voice is installed here; German speech evaluation and physical microphone quality
still need separate evidence. The fixture remains ignored under .runtime; no audio
or model weights were added to Git. No application code changed in this step.

## Speaker diarization prototype, 2026-10-31

A local sherpa-onnx speaker-range action was implemented in the JSON speech worker.
The official four-speaker sample passed with a known speaker count (10 time ranges).
Automatic counting returned seven clusters, so quality remains unresolved. The
prototype is not yet wired into meeting recordings, ASR alignment or the installer.
See BlitzDicWindows/speech/DIARIZATION.md for source/license references, model
fingerprints, test coverage and remaining integration work. No voice profiles or
real-world speaker identities are inferred or persisted. Core dependency versions
are pinned, but the next frozen worker still needs its packaging hook updated.

## Speaker-aware ASR composition, 2026-10-31

The worker now exposes `transcribe-speakers`: it runs local diarization, groups
overlapping ranges, and transcribes each turn with the selected speech engine.
ASR instances are cached within the worker so repeated turns do not reload the
model. Overlapping ranges are merged and transcribed once with multiple possible
speaker labels; they are not falsely assigned to one person. A 150-ms context
margin is used around each detected turn. Labels remain recording-local IDs.

The real-worker test passed with Whisper on the official four-speaker Chinese
fixture: ten text turns and four supplied speaker IDs. It also passed with Parakeet
on the 105-second synthetic English recording: 30 text turns, one supplied speaker
ID, and the first and final topic markers. These are supplied-count pipeline tests,
not proofs of automatic counting or diarization error rate. Two isolated range-
grouping tests passed, together with 31 Node regression tests (two optional ASR
unit tests skipped). No meeting UI or installer integration is claimed yet.
