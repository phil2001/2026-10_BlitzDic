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

## Optional speaker UI and persistence, 2026-10-31

The Meeting page now exposes optional experimental speaker separation and a known
speaker count from 1–20, or automatic estimation. The setting is snapshotted when
recording starts. The main process validates options, checks auxiliary model files
and passes the fixed local model directory to the worker. Missing auxiliary files
disable the controls; ordinary ASR remains available. Speaker numbers are explicitly
scoped to each recording section in the transcript, avoiding false identities when
several independently clustered recordings are appended.

32 automated tests passed (two optional ASR tests skipped). The real Electron
microphone workflow passed with both Whisper and Parakeet using a synthetic
single-speaker recording, known speaker count one, and actual local diarization.
Labels survived explicit encrypted transcript save and reload. Four-speaker ASR
composition remains covered separately by the earlier known-count fixture test.
The UI test initially found a missing one-speaker option; options are now generated
consistently for every count from one to twenty. Two non-UTF8 bytes introduced in
new explanatory text were also corrected. Automatic-count quality, auxiliary model
provenance/licensing, reproducible acquisition and installer bundling remain open.
The 0.2.0 installer does not yet include these controls or auxiliary models.

## Bundled speaker package 0.3.0, 2026-10-31

Built: BlitzDicWindows/dist/windows-2026-10-31T17-12-37-801Z-29ba3b/BlitzDic Setup 0.3.0.exe
Size: 1,141,066,999 bytes. SHA-256:
E2A6111637A8201A5E5784A0E28556E836FC3CF62394C4DA9E979A209EDE57E7

Includes both preferred ASR models, auxiliary speaker models, frozen sherpa runtime,
local transcript saving and current speaker controls. Acquisition is hash-pinned
and build-verified; no extra install is required by the end user. Provenance was
traced through the official sherpa export documentation to NVIDIA NGC TitaNet-S
v1.19.0, whose original card refers model usage to the NeMo Toolkit license.
The corresponding Apache-2.0 text and the segmentation archive's CNRS MIT text
are included with source attribution. This does not close unrelated native-library
review (FFmpeg/libsndfile and other binary dependency obligations).

The packed executable passed actual microphone -> diarization -> Whisper/Parakeet
-> labeled transcript -> encrypted save -> reload using a fresh app profile and
synthetic single-speaker audio. The packaged license inventory has 36 dependencies
and no missing package notices. The one missing core notice seen at initial
collection was supplemented from the official v2.0.1 LICENSE before packaging;
the same version-pinned notice is now used by future collector runs.
Actual 0.3 installer execution, clean VM, automatic speaker quality and other
remaining acceptance gates are still open; the overall goal remains incomplete.

## Native binary evidence and build integration, 2026-10-31

Added native-inventory.py and map-native-package.py to the build pipeline. The first
records 118 installed package DLL/PYD fingerprints and queries actual FFmpeg DLL
license/configuration exports: all seven report LGPL version 3 or later, version
8.0. The second verified the existing 0.3.0 speech package's 182 native files:
111 match installed package hashes, 71 are outside that package-only inventory
(mainly Python/Windows runtime files, with OpenSSL/libffi/sqlite dependencies).
Both scopes and the unmatched set remain explicit; this is not a completed audit.

Official FFmpeg n8.0 LGPLv3/GPLv3 texts and LICENSE.md component notes were added.
The license collector now bundles this directory. A new collection pass found 36
Python dependencies and no missing package notices. Native source/build revision,
corresponding-source and remaining binary notice work are still open. Existing
0.3.0 installer predates these inventory files; a later build will include them.
No application behavior was changed or re-tested unnecessarily in this step.

## DLL search-path build correction, 2026-10-31

PyInstaller build-origin matching was extended to all 182 native files using its
actual Analysis-00.toc input paths and source hashes. This exposed 48 files sourced
from an unrelated external tool-runtime PATH directory in the existing 0.3.0 build.
The speech build now isolates PATH to project Python and Windows, restoring it on
exit. A strict build gate rejects unmatched hashes or external-tool origins.

A fresh isolated speech worker built successfully with 138 native files, zero
unresolved hash matches and zero external origins. Both ASR models and the speaker
pipeline passed using the frozen executable; the final repeat also stripped the
test worker's runtime PATH to Windows-only paths. The strict gate rejected the old
0.3.0 package as expected. This corrects build reproducibility/provenance and reduces
unnecessary runtime files. The existing full installer still needs rebuilding with
this worker; it has not been silently replaced. Native license/source review remains
open independently. No user directories or existing builds were deleted.

## Corrected complete package 0.3.1, 2026-10-31

The full unsigned installer was rebuilt successfully using isolated DLL resolution:
BlitzDicWindows/dist/windows-2026-10-31T17-23-25-351Z-fd5908/BlitzDic Setup 0.3.1.exe
Size: 1,140,226,268 bytes. SHA-256:
F855518EA51206362CC0BBBA077EA440979BAEBB202CA203D12753567AA37598

The strict native-origin gate passed: 138 speech DLL/PYD files, all build-source
hashes matched, no unresolved origins and no external developer-tool runtime origins.
The installed resources include the origin map, native inventory, FFmpeg license
references, 36 package notices and speaker-model attribution. Package notices have
no missing entries; general corresponding-source/native-license review remains open.

verify-installed.mjs passed against the packaged 0.3.1 executable with a fresh
profile, validating contained inventories, both real ASR imports, meeting-source UI
and program-rule UI. verify-meeting-audio.mjs then passed actual synthetic microphone
capture -> local diarization -> Whisper/Parakeet -> speaker-labeled transcript ->
encrypted save/reload through the frozen runtime and bundled models. No project
Python was used as the application's speech runtime. Test harness Node/Playwright
and the synthetic input fixture remain development-only tools.

This supersedes the 0.3.0 build-origin issue. It is not actual 0.3.1 NSIS execution,
a clean Windows VM, a physical microphone test, automatic speaker-count quality,
or proof of every remaining upstream feature. The overall goal remains active.

## Bounded hierarchical meeting summaries, 2026-10-31

Meeting summaries now merge in pairs through a reducing hierarchy instead of
concatenating every intermediate result into one potentially oversized request.
Source requests are capped at 12,000 UTF-16 code units, preferring whitespace and
preserving surrogate pairs. Intermediate output is limited to 5,500 code units,
so paired merge inputs stay below 12,000; oversize or empty output is rejected
without truncation or partial persistence. Each await rechecks cancellation.
The original complete transcript remains unchanged. Character bounds do not prove
fit within every provider's token context window or guarantee model factuality.

34 Node tests passed (two optional ASR tests skipped), plus the Electron summary
UI/local-mock/persistence workflow. The focused large-source test carries unique
fact markers through all reduction levels, checks per-request limits and exact
source reconstruction including Unicode, and confirms all markers reach the end.
The oversized-output test verifies no further model calls or saves occur. The UI
also clears the previous visible summary when starting a new generation, avoiding
an old summary being displayed as the result of a newly edited transcript.
These changes postdate installer 0.3.1 and require inclusion in a later package.
Actual model semantic quality remains an independent open acceptance issue.

## Real local summary quality and UI validation, 2026-10-31

The preinstalled google/gemma-4-e4b model (6.33 GB on disk, 5.89 GiB reported by
LM Studio on load) passed verify-real-meeting-model.mjs using the current summary
instructions. The synthetic German source's selected offer B, 2500-euro budget,
Ben's explicit document-review task with no invented deadline, and the open Berlin
shipping question were correctly preserved and categorized. The generated summary
was manually inspected in addition to the scripted fact/section assertions.

The new opt-in verify-real-meeting-ui.mjs then passed the actual Electron UI ->
real local LM Studio server -> fact checks -> DPAPI store -> exact reload workflow
with the same synthetic source. This is real model inference, not a mock provider.
The initial state was no loaded models and server stopped; the temporary test alias
was unloaded and the server stopped after the test. No new model was downloaded.
Gemma is not bundled in BlitzDic and is not added as an ASR preset. Whisper and
Parakeet remain the two preferred bundled speech models.

This provides short-fixture local LLM quality evidence for that model. It does not
reverse the earlier Qwen 2.5 Coder 3B failures or prove factuality for other models,
long meetings or arbitrary prompts. The test is intentionally opt-in, outside
normal unit CI, and requires a running local server with the requested model alias.
The current installer still predates hierarchical summary reduction; no application
code changed in this step, so deterministic tests were not needlessly repeated.

## Ended capture sources, 2026-10-31

Recorder now listens for ended events on every acquired microphone/display track.
An active source ending switches the recorder to a finalizable state and invokes
the UI's normal stop/transcribe path exactly once, preserving buffered audio.
If a source ends during startup, startup fails cleanly instead of falsely showing
an active recording. Event listeners are removed before tracks are stopped during
normal cleanup, preventing cancellation or stale tracks from triggering later work.
The dictation/meeting result reports when its source ended unexpectedly.

35 Node tests passed (two optional ASR tests skipped). The recorder regression
covers exact buffered WAV length, duplicate ended events, source loss during
AudioContext resume, and stale events after cancellation. The extended Electron
meeting test injects ended events into a real browser stream backed by the synthetic
microphone fixture; both actual Whisper and Parakeet produced the expected text,
the UI returned to its idle button and reported the ended source. This simulates
the browser event contract; physical USB unplugging and Windows session loss remain
unverified. No audio/history/meeting entries were persisted by that test.
Installer 0.3.1 predates this behavior and hierarchical summary changes and must
be rebuilt before those are represented as delivered in the installer.

## German speech validation, 2026-10-31

A German SAPI Hedda token was already installed under the classic Windows speech
registry, despite the earlier .NET voice enumeration returning only Zira. The new
make-german-speech.ps1 uses that existing token directly to create a synthetic
German fixture under .runtime. It does not modify registry voice registrations,
install language packs or contact an external speech service. The script includes
a UTF-8 BOM because Windows PowerShell 5 must decode the German umlauts correctly.
The Windows voice is a test-fixture dependency, not an application requirement.

verify-german-speech.mjs passed with both real speech models on the German sentence:
meeting tomorrow at nine, Anna reviewing documents, budget 2500 euros and the open
Berlin delivery question. Umlaute and the factual phrases were retained. The first
run used project Python with language de. The final run used the 0.3.1 packaged
speech executable and its packaged model files with no language hint; Whisper
identified de and both engines returned the expected German facts. This provides
synthetic German evidence, not physical microphone, accent/dialect, clinical-vocabulary
or general accuracy validation. Test audio remains ignored locally, outside Git.
No application behavior or dependency changed, so unrelated tests were not repeated.

## Consistent compressed-audio import, 2026-10-31

The import UI already offered M4A and WebM, but Parakeet and speaker processing
used libsndfile, which could not reliably decode those containers. Both paths now
share a PyAV decoder that selects the first audio stream, downmixes to mono and
resamples to 16 kHz, including draining the resampler. Whisper retains its existing
decoder. Meeting turn boundaries use the same decoded sample rate as diarization.
No new runtime dependency or external FFmpeg installation is required.

make-audio-formats.py creates local AAC/M4A and Opus/WebM variants of the synthetic
English fixture. verify-audio-formats.mjs passed both formats through actual Whisper,
actual Parakeet, speaker detection and combined speaker-labeled Parakeet recognition.
test-audio-decode.py passed duration/frequency preservation from stereo 48 kHz and
rejection of a video-only MP4. The 35 Node tests passed, with two optional ASR cases
skipped; the format checks separately ran real inference. These checks cover those
two codec/container pairs, not every codec variant sharing the file extensions.

The frozen 0.3.2 speech executable passed the same format checks. The speaker/ASR
regression retained ten turns/four IDs in the Chinese sample and thirty turns
across the 105-second English sample. The complete 0.3.2 Windows package was built
in BlitzDicWindows/dist/windows-2026-10-31T20-49-55-471Z-378a41. It includes the
previous source-ended handling and hierarchical summary changes. Its native map
contains 138 binaries with no unresolved or external build origins.

The packaged app passed fresh-profile checks, both bundled ASR engines, German
recognition without a language hint, and a synthetic microphone meeting through
speaker transcription and encrypted save/reload. The latter injected duplicate
ended events and verified automatic completion and the source-ended notice.
These are packed-application tests, not a fresh Windows VM or a new execution of
the NSIS installer. The local installer remains unsigned and unpublished; native
corresponding-source/license obligations remain under review.

Installer 0.3.2: 1,140,226,775 bytes; SHA-256
F3D46353C2B903989EEFF8BA5F33B9DEF10689D77C21C393A8B284B3875A84CA.

## Native text guards, Word and UTF-8 IPC, 2026-10-31

The native Edit/RichEdit capture previously compared the window and selection but
not document contents. A regression reproduced insertion into changed text at
an unchanged cursor. Captures now include a complete UTF-16 SHA-256 fingerprint
and length, recheck selection/focus, and refuse incomplete reads. RichEdit at
64,000 units and above uses UI Automation, following the documented WM_GETTEXT
limit. The real 70,000-character RichEdit50W test passed this fallback.

Word's generic Unicode keyboard path changed the test emoji to digits even when
SendInput reported success. Word document controls now resolve OBJID_NATIVEOM
from the exact focused _WwG window. Its owning window, normal selection type,
UI Automation document fingerprint, protection and cursor are checked before
Range.Text replaces the selected range; the caret is collapsed at its end.
No running Word instance is selected arbitrarily, no instance is launched by
production code, and no clipboard or Word options are changed. Reflection uses
the installed Office object model without an extra interop package.

verify-word-insertion.ps1 creates its own unsaved Word documents and discards
them. Against Word 16.0 build 16.0.20527 it passed Unicode/emoji, replacement,
undo/redo, paragraph insertion, rejection after document/cursor/text changes,
document protection and unchanged clipboard. These are not proofs for every
Office version, table/form selection, protected view or elevated process.
verify-insertion.py now covers Edit and RichEdit, unchanged-position content
changes, multi-line insertion and the large-document fallback. The undo check
uses single-line native controls; multi-line classic Edit undo grouping differs
and is not established as one atomic selection-replacement undo step.

Testing frozen 0.3.3 exposed a separate defect: PyInstaller's interpreter could
ignore PYTHONIOENCODING and decode stdin as a Windows code page. UTF-8 dictation
and filenames were corrupted even though ASCII-based tests passed. worker.py
now reads stdin bytes and explicitly decodes UTF-8; output remains ASCII-escaped
JSON. Native regression requests now send actual UTF-8 rather than escaping all
non-ASCII characters. verify-unicode-speech-path.mjs passed both actual ASR models
with a WAV path containing umlauts, a space and an emoji using the 0.3.4 packed
runtime and packed model directories. The helper PowerShell file has a UTF-8 BOM
so Windows PowerShell 5 also decodes its German messages correctly.

The frozen 0.3.4 runtime passed the native Edit, large RichEdit, Word and Chromium
tests. Installer 0.3.3 remains a failed local test build, not a delivered release.
The README now describes the current build and workflows in one place rather
than repeating outdated release-stage paragraphs. No local directories were
deleted. The overall release gates remain open.

The packed 0.3.4 app passed fresh-profile startup and file imports through both
bundled models. Both actual global-shortcut -> synthetic microphone -> local ASR
-> external Chromium insertion runs passed with the packaged application.
Installer: BlitzDicWindows/dist/windows-2026-10-31T21-12-11-505Z-1fdc73/BlitzDic Setup 0.3.4.exe;
1,140,229,047 bytes; SHA-256
1A8440669E4E1471293FAC60091B455C979A7C7F81130DFB1D506D3810D013D5.
It remains unsigned and was not installed on a clean Windows VM.

## Clean FFmpeg replacement and corresponding source, 2026-10-31

The official PyAV 16.0.1 vendor configuration was traced through its pinned source
commit to pyav-ffmpeg 8.0-2, commit fab22bcb12748a05f86683ac632fdb96994d970e.
The downloaded Windows vendor archive matched GitHub's published SHA-256. All 32
installed av.libs DLLs matched its executable sections; fifteen matched whole
files. The upstream configure patch moves x264/x265 from the GPL list into the
version3 list. This contradicts treating the DLL-reported LGPL string alone as
sufficient licensing evidence. The checked provenance report retains this fact.

A project-local portable MSYS2/UCRT64 toolchain was prepared from the verified
20260927 archive. FFmpeg 8.0.3 was downloaded with its official signature; GPG
validated fingerprint FCF986EA15E6E293A5644F10B4322F04D67658D8. Unmodified source
was built with GPL/nonfree/version3/autodetection disabled, dynamic DLL linkage,
no network/desktop capture devices and Windows threads. Compiler/package versions
and commands were recorded. No local directories were deleted; the previous
Python environment was retained as .runtime/venv-upstream-20261031.

relink-pyav-lgpl.py creates av 16.0.1+blitzdic.1 from the SHA-pinned original
wheel. It changes DLL import names/PE checksums and package metadata, requiring
unchanged executable sections in all 48 extension modules. Seven clean FFmpeg
DLLs plus the compiler's MIT winpthread TLS DLL replace the original 32 DLLs.
FFmpeg source, configuration/build instructions and runtime notices are included
in wheel license data and in the packaged application's license directory.
The new setup script accepts the clean wheel; the Windows build refuses the old
configuration. A negative test against the retained original environment confirmed
that refusal. PowerShell 5 quoting/encoding in setup was corrected and tested.

Isolated and active-runtime checks passed M4A/AAC, WebM/Opus, both ASR models,
speaker-labeled transcription, German speech, Unicode filenames, a four-speaker
sample and the 105-second sample. The fixture generator can use FFmpeg's native
Opus encoder when libopus is unavailable. All 35 Node tests passed; two optional
ASR tests skipped, separately covered by the real inference checks.

Windows 0.3.5 was built in
BlitzDicWindows/dist/windows-2026-10-31T21-40-57-389Z-96185a. It contains 114 mapped
native binaries, all with trusted build origins. The packaged app passed both
bundled models, clean-inventory checks, the included FFmpeg-source SHA-256 and the
scoped license-folder button under Settings. Both frozen engines and diarization
also passed with PATH limited to Windows. The About text identifies FFmpeg LGPL
v2.1-or-later. Full review of libsndfile, numerical/runtime libraries and overall
redistribution obligations remains open; this is not a blanket compliance verdict.

Installer: 1,149,418,566 bytes; SHA-256
458C86CF9A840EA829A323AF86291484ADBD88BB4A7CDBF957A7CDAAB6F433A8.
Unsigned, local development artifact; no clean-VM installation was performed.

## Remove redundant audio dependencies and audit numeric DLLs, 2026-10-31

Actual usage and package metadata showed SoundFile was needed only to write
internal speaker-turn WAVs, not by onnx-asr/faster-whisper or the public imports.
wav_encode.py now creates mono PCM16 WAV using the Python standard library and
NumPy, validates finite/mono samples and rate, and clips/rounds into the signed
16-bit range. SoundFile, libsndfile, CFFI and pycparser were removed from runtime
requirements. The previous environment was moved to a project-local backup and
a fresh environment was created; none of the old package directories were deleted.
Tests verify PCM boundaries, sample count/rate, empty audio and invalid samples.
The actual four-speaker and 105-second speaker-transcription regressions passed.

A custom CTranslate2 hook omits cudnn64_9.dll, which has no static import from
the CPU engine and is copied by upstream even with WITH_CUDNN=OFF. BlitzDic
explicitly uses CPU. The packaged artifact verifier checks the absence of that
loader, libsndfile and CFFI. Both frozen ASR engines and diarization passed with
PATH limited to Windows, proving the CPU path does not need the omitted loader.

OpenMP's libiomp5md.dll matched Intel's official intel-openmp 2025.3.0 wheel
byte-for-byte, SHA-256 982233366b0afcda1e0f55a0b134097e35b779613f54ddb69e685e6cd06b755f.
The wheel hash was checked against PyPI and its original August-2024 Intel EULA
was collected. That file is preserved as binary Git data because its original
encoding is Windows-1252. Exact redistribution conditions and the statically
linked oneMKL component remain under review. The CTranslate2 recipe declares
oneDNN 3.1.1; its pinned notices were added without overstating static-binary proof.

NumPy's OpenBLAS DLL also matched the declared scipy-openblas64 0.3.34.106.0
supplier wheel byte-for-byte. The provenance and supplier notice are in
licenses/native/numpy-openblas. NumPy's existing distribution notice includes
OpenBLAS and LAPACK. Its reported X86_V2 SIMD baseline was added to the hardware
guide; this is evidence for that component, not every inference backend/CPU pair.
The installer-download/offline wording was clarified. Those documentation edits
and the OpenBLAS provenance report postdate the 0.3.6 license snapshot.

Installer 0.3.6 was built in
BlitzDicWindows/dist/windows-2026-10-31T21-58-11-448Z-bf0b4d. It has 111 mapped
native files, zero unresolved/external build origins, 33 collected package notices
and no missing notices. The enhanced artifact check verified every collected
package-notice hash, matched the actual OpenMP DLL to its notice provenance and
verified the contained FFmpeg source. Fresh-profile UI and both bundled speech
models passed. The synthetic-microphone meeting test passed speaker transcription
for both engines and encrypted speaker-labeled save/reload without libsndfile.
Windows CI now also runs the PCM encoder unit checks with Python 3.12 and the
pinned NumPy version; official setup-node/setup-python v7 examples were verified.

Installer: 1,148,440,253 bytes; SHA-256
02D0B5316A6B3F268CAB7D926D365351DA4842DBFE83848618061B82C89B9F41.
Unsigned local development artifact. Component-wide redistribution review,
clean-PC validation and other overall release gates remain open.

The first added Python CI step requested 3.12.12, which GitHub does not provide
as a Windows binary. The workflow now selects its available 3.12 Windows line;
the app's separately bundled Python 3.12.12 runtime is unchanged. This distinction
does not turn a CI interpreter check into a test of the packaged interpreter.

## Actual installer upgrade and foreground mode rules, 2026-11-01

The user explicitly approved replacing the old 0.1.0 test installation and its
Desktop/Start Menu shortcuts. The exact 0.3.6 installer above was checked against
its SHA-256 and executed silently for the current user. It returned exit code 0,
removed the old project-local installation and installed into the new path
`BlitzDicWindows/.runtime/Installiert Grüße 🌍 0.3.6`. The uninstall registry now
reports version 0.3.6 and its new Unicode path; both shortcuts exist. No unrelated
directories or files were deleted by the test scripts.

The installed executable passed verify-installed.mjs with a fresh app profile:
both actual bundled models recognized the expected English fixture; all 111
native file origins, collected package notices and corresponding FFmpeg source
passed the artifact checks. The unpacked app had also passed from a separate
Unicode root, including its model and speech runtime paths. This is an actual
NSIS upgrade on the Windows 11 development PC (build 26200), not a clean-PC test.
Windows Sandbox is absent and this session cannot query/manage Hyper-V without
administrator access, so no isolated Windows installation is claimed.

verify-hotkey.mjs now tests foreground app rules against an isolated loopback
rewrite fixture. In the installed app, a real Ctrl+Shift+1 selected the clean mode
for the external Chromium editor's electron.exe rule, processed synthetic
microphone audio through actual Whisper, checked the rewrite request and inserted
the response into that editor. A second run used actual Parakeet Ultra and
Ctrl+Shift+3: the explicit calm mode prevailed over the clean app rule. Both runs
also checked the selected prompt, single rewrite request and encrypted history.
The fixture response is controlled, so these are not real-LLM quality tests.

The resident keyboard helper now requires the exact owned window handle and
refuses to emit keys when Windows foreground activation fails. After such a
refusal, the successful checks used the external-input test mode and Computer
Use to focus only the owned test editor and send Windows shortcuts. An initial
Computer Use app-approval timeout cleared on a fresh window selection. The first
completed app-rule run revealed a case-sensitive test assertion against Whisper's
variable capitalization; the assertion now ignores case and the rerun passed.
Physical microphone, clean-PC and the other overall release gates remain open.

## Cursor fitting port and packaged 0.3.7, 2026-11-01

An audit against the pinned upstream README and InsertionFitter.swift identified
a real functionality gap: safe insertion existed, but surrounding-text spacing
and capitalization were not ported. src/insertion-fit.js now ports those local
rules: sentence starts, a conservative German/English function-word list, word
boundaries, joiners/quotes and duplicate punctuation. Proper names and ambiguous
pronouns keep their case. The result/history text remains unchanged; only the
actual inserted text is fitted. No context goes to a text provider.

Native Edit/RichEdit and UI Automation capture now supply at most 160 UTF-16
units before and after the selection. The native reader validates selection
bounds before accessing its text buffer. Full-document hashes and focus/selection
guards remain in place. Password/read-only controls are still rejected. Missing
context preserves the original insertion text. PRIVACY.md documents this transient
local context; three legacy Windows-1252 bytes in its final paragraph were also
repaired to UTF-8.

The regular suite passed 37 tests (two optional real-ASR tests skipped). New
behavior checks cover mid-sentence function words, names/pronouns, spacing,
abbreviations, paragraphs, punctuation, emoji and unsupported contexts. Actual
native Edit/RichEdit, 70K-character UIA fallback and Chromium insertion checks
passed against both source and frozen 0.3.7 helpers, including exact context
boundaries and all existing rejection/clipboard checks. The complete packaged
Whisper hotkey-to-microphone-to-external-editor flow proved that 'This' becomes
'this' after 'Before '. Both real bundled speech models passed fresh-profile
packaged imports, along with all 111 native origin and license/source checks.
The same complete cursor-fitting flow passed with packaged Parakeet Ultra.
Word 16.0.20527 also passed the frozen helper regression, explicitly verifying
the captured context for both a caret and a selection, plus Unicode/emoji,
undo/redo, paragraphs, change/protection rejection and unchanged clipboard.

Installer: BlitzDicWindows/dist/windows-2026-11-01T00-25-55-013Z-008cc0/BlitzDic Setup 0.3.7.exe;
1,148,459,057 bytes; SHA-256
BE43139888506054C5402554BD57A15DE5958CF9133BD3BE1D277B3621707CF1.
It is unsigned and was built without replacing the approved 0.3.6 test installation.
The revised roadmap explicitly records additional missing upstream functions,
including website rules, a movable recording indicator, hold-to-dictate, audio
muting, live notes, speaker renaming and echo filtering. No full-parity or finished
release claim is made. The hardware/clean-PC and redistribution gates remain open.

## Non-activating recording indicator, 2026-11-01

The upstream recording pill is now represented by an independently branded,
sandboxed Electron window. It shows a live level and elapsed time, offers a native
drag grip and stop control, and can be hidden for the current recording with × or
right click. The encrypted recordingIndicator preference disables it globally.
Stopping routes to the active dictation or meeting recorder without focusing the
main window. The level is throttled to at most one IPC call per 80 ms; no audio,
transcript, cursor context, settings or provider credentials enter this surface.

Its preload exposes only stop/hide and display events. Main-process commands
require the exact indicator sender/frame/URL; the general application IPC remains
restricted to the main renderer. Navigation and new windows are denied. The window
uses focusable:false and showInactive, with stale-load protection on stop/cancel.
Bounds are clamped to a current work area after display-layout changes. This
implementation follows Electron's BrowserWindow and custom-window interactions
documentation:
https://www.electronjs.org/docs/latest/api/browser-window and
https://www.electronjs.org/docs/latest/tutorial/custom-window-interactions.

Browser plugin not available. Electron/Playwright UI validation used Windows 11,
a 1200×820 main window and the 284×68 indicator. Source and packaged 0.3.8 checks
passed page identity, meaningful rendering, no framework error surface, observed
console/page-error checks, screenshot review and interaction/state checks. The
synthetic microphone moved the bars and advanced the clock; hide kept recording,
the next recording restored the indicator, clicking stop produced actual local
dictation and meeting transcripts, the disabled setting survived restart, and a
stop during initial window loading did not leave a stale visible indicator.
The first UI test stopped after one second and only recognized a sentence fragment;
waiting for the full six-second fixture corrected that test assumption.

Native read-only checks verified WS_EX_NOACTIVATE and HTCAPTION at the grip,
against the actual Electron main-process ID (rather than its launcher PID).
The source Whisper global-hotkey flow proved the exact external Windows foreground
handle remained unchanged while the indicator was visible and text subsequently
inserted at its original cursor. The regular suite passed 37 tests, with two
optional real-model unit tests skipped. A full physical mouse-drag, multi-monitor
movement and physical microphone capture remain unverified. Screenshots and the
temporary detailed UI script are outside the repository in the task's visualization
folder; no separate HTML report was generated.

The packaged Parakeet Ultra hotkey flow likewise passed the exact external
foreground-handle assertion, visible/hidden indicator state, real synthetic-mic
recognition, cursor fitting and external insertion. Fresh-profile packaged imports
passed both actual ASR models, the 111 native origin mappings, collected package
notice hashes and bundled corresponding FFmpeg source checks.

Installer: BlitzDicWindows/dist/windows-2026-11-01T00-40-31-732Z-e9c39c/BlitzDic Setup 0.3.8.exe;
1,148,461,478 bytes; SHA-256
30BFC66659733CEDE0C6B921BE959B56B7F858F6749D5875EC0750F26D1BB083.
Unsigned local development artifact. It does not replace the installed 0.3.6
test installation. Other upstream-parity, hardware, clean-PC and native-library
redistribution gates remain open.

## Scoped speaker names and archived-meeting updates, 2026-11-01

The upstream speaker-renaming feature is ported with explicit per-recording
scope. Anchored speaker labels (IDs 1–20) and recording headings identify the
controls; text inside an utterance is never globally replaced. Names can be
cleared to restore IDs. Overlap labels preserve their uncertainty. Every newly
recorded section gets a heading, even without diarization, so an earlier section's
names cannot spill into later recordings. Manually editing a named transcript
adopts the visible text as a new draft and resets its alias metadata.

Original transcript and validated alias metadata are stored separately. A summary
receives the named transcript while the saved original retains its IDs. Names are
not real-world identities inferred by the model. For existing archived meetings,
the new meeting-rename IPC updates that record atomically, checks the expected
original text and cannot recreate a deleted meeting. Old summaries remain intact
with a visible stale marker after names change; changing names does not invoke
any provider. Save/summary/rename operations lock draft editing until complete.

The regular suite passed 42 tests (two optional real-ASR unit tests skipped).
Tests cover scoped IDs, partial naming, overlap, literal utterance preservation,
invalid/stale/duplicate aliases, summary payloads, archived-record identity/source,
old-summary retention and atomic encrypted updates concurrent with appends/clear.
The UI also preserves the full recognized text when an appended section exceeds
the 500K-character save limit and remains editable after invalid draft requests.

Browser plugin not available; Electron/Playwright exercised source and final
packaged 0.3.9 at 1200×820 and 760×620. Page identity, meaningful UI, absence of an
error surface, observed console/page-error health, screenshots and interactions
passed. The test verified Unicode/emoji names, independent IDs across two sections,
reset, real DPAPI save/reload, in-place archive rename without duplicates, named
summary protocol requests, stale-summary retention on reopen, manual-edit reset
and real-ASR oversized-draft recovery. The summary provider was an isolated
loopback fixture, not a new real-LLM quality benchmark. Source and packaged actual
Whisper/Parakeet microphone→diarization→transcript→rename→encrypted reload checks
passed. The synthetic known-one-speaker fixture does not prove physical
multi-speaker diarization accuracy. Both packaged ASR imports and the 111 native
origin, notice hash and corresponding FFmpeg source checks also passed.

The first 0.3.9 package in windows-2026-11-01T00-56-29-939Z-6e8751 missed a final
UI-only correction for an obsolete summary hint in the overflow case. A byte
comparison identified the mismatch. It was retained and superseded by a fresh
electron-builder package in the -final output below, reusing the identical frozen
runtime and license inventory. All seven changed runtime/UI source files matched
the final app.asar byte-for-byte before the packaged tests were run. Temporary UI
scripts and screenshots remain outside the repository in the visualization folder.

Final installer: BlitzDicWindows/dist/windows-2026-11-01T00-56-29-939Z-6e8751-final/BlitzDic Setup 0.3.9.exe;
1,148,464,533 bytes; SHA-256
642E2F6923675AB4E916C0654CE20D51D5A3DD6839DB3FF22B1042FB4CA3FBA6.
Unsigned, unpublished local development artifact. The installed 0.3.6 remains
untouched. Remaining upstream features and hardware/clean-PC/native-license
release gates are still open; this is not a finished-release claim.

## Hold-to-record development snapshot, 2026-11-01

Source 0.3.10-dev.0 adds a hold/toggle preference, retaining toggle as the default.
HoldShortcuts gives each gesture an owner token, starts a read-only native key-state
worker before target preparation and ignores repeats while that gesture is held.
Releasing during preparation or microphone startup cannot strand a recording.
Cancellation preserves the key-up guard but stops the microphone immediately;
stale stop/error events cannot affect a newer recording. Shutdown aborts the worker.
Its wait is bounded to 30 minutes. The native module maps Windows accelerator keys
and reads only the configured groups' GetAsyncKeyState high bits, without a global
keyboard hook, input injection or general key log. Sources checked:
https://www.electronjs.org/docs/latest/tutorial/keyboard-shortcuts and
https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getasynckeystate.

48 regular Node tests passed (two optional real-ASR unit tests skipped), including
six gesture lifecycle cases. The two new Windows Python tests passed accelerator
mapping and controlled release/timeout cases. CI now runs those Python checks.
Settings validation and persistence are serialized together so a slower hold-mode
validation cannot overwrite a newer toggle choice; its selector disables while
saving and reloads the persisted choice after errors.

Browser plugin not available. Source Electron/Playwright IPC lifecycle checks with
actual Whisper and packaged checks with actual Parakeet passed start/release,
delayed microphone permission completion, stream cleanup, old-token stop/error
isolation, current-worker failure, preference persistence and concurrent settings
ordering. Page identity, rendering, observed page/console health and screenshots
were checked at 1200×820 and 760×620. These tests supplied application IPC events,
not physical/native keydown/up, and do not satisfy the full native gesture gate.

The guarded native hotkey test refused input because its editor was not foreground.
An unsafe ShowWindow call in the hidden test helper was removed: its first call
can inherit SW_HIDE from STARTUPINFO, overriding the requested restore state.
See https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-showwindow.
After removal the foreground handle was another application's window, rather than
null, but Windows still refused the test's SetForegroundWindow request. The helper
retains the exact owned-window check, refuses pre-existing pressed keys, waits
briefly for asynchronous activation and never sends keys on refusal. A pending
indicator-window promise no longer hides the original test failure during cleanup.
Read-only diagnostics found WinSta0/Default and matching process/console session 1;
no desktop switch, unlock or security-setting change was attempted. The desktop
cannot be classified as locked from these observations. Native hold/release,
current-build external insertion and toggle-regression acceptance remain open.

A development package was built, then repackaged into a fresh -final output after
the ordered-settings fix, reusing the unchanged frozen speech runtime and license
inventory. Five changed runtime/UI files matched app.asar byte-for-byte. Frozen
shortcut validation and a non-held Ctrl+Shift+F24 query passed; both actual ASR
imports, 111 native origins, notice hashes and corresponding FFmpeg source passed.
An accidentally placed temporary UI screenshot file was removed from project/out;
the empty directory was retained in accordance with the no-directory-delete rule.
All retained QA screenshots/scripts are in the external task visualization folder.

Experimental installer: BlitzDicWindows/dist/windows-2026-11-01T01-22-29-281Z-9ca584-final/BlitzDic Setup 0.3.10-dev.0.exe;
1,148,470,352 bytes; SHA-256
BECC2C14AE8F7FE1676558F342ED03124102907FCDD4A6814D08D3997DD67128.
At packaging time this was an unsigned development snapshot with an unproven
native-key flow. The subsequent native results below close that particular gate.
Installed 0.3.6 remains untouched. Other full-scope release gates remain open;
the goal is not complete.

## Native hold/toggle acceptance, 2026-11-01

The user confirmed that Windows was unlocked and locally operable. A fresh owned
test editor was observed and focused through Computer Use; no desktop, security
setting or unrelated application was changed. The test helper can now optionally
wait up to ten minutes for that exact foreground HWND with
BLITZDIC_TEST_WAIT_FOR_FOCUS=1. It still refuses input if the owned-window or
unheld-key checks fail. The harness prints its ready state before waiting.

The unchanged packaged 0.3.10-dev.0 executable from the -final output above passed
these four end-to-end cases with fresh application profiles:

| Windows shortcut behavior | Bundled speech model | Result |
| --- | --- | --- |
| Hold, then release | Whisper Small | Passed |
| Hold, then release | Parakeet Ultra | Passed |
| Press to start, press to stop | Whisper Small | Passed |
| Press to start, press to stop | Parakeet Ultra | Passed |

These tests injected actual Windows keydown/up events through the guarded helper,
captured a WAV fixture through Chromium's synthetic microphone and ran the actual
bundled ASR runtime. Every successful case confirmed that the visible recording
indicator preserved the exact external foreground HWND, hid after stopping and
inserted the recognized text at the original Chromium cursor. Local sentence
continuation fitting also passed. They are not physical microphone or manual
hardware-keyboard tests, and do not establish behavior in every application.

One initial toggle run recognized speech but the insertion guard rejected the
target as changed; the text remained available in BlitzDic and the editor was
unchanged. An isolated repeat passed. The precise cause of that rejection was
not established; it is retained here rather than counted as a passing insertion.
Earlier failed activation attempts did not demonstrate a locked desktop.

## Scoped Escape control, 2026-11-01

Source 0.3.10-dev.1 stops and transcribes a recording on Escape; during processing
Escape cancels. A registration probe on this Windows host rejected Control+Escape
and Control+Shift+Escape. Registering only bare Escape would therefore miss the
default hold gesture while Control+Shift remain down. A dedicated windowless
worker now installs a WH_KEYBOARD_LL hook only for an active workflow. It examines
the virtual key code, passes every non-Escape key through and stores no text or
general key log. Its callback enqueues Escape notifications without pipe I/O;
separate threads handle stdin commands and stdout responses. Source/API references:
https://learn.microsoft.com/en-us/windows/win32/winmsg/lowlevelkeyboardproc,
https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowshookexw,
https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-postthreadmessagew.

The parent waits for native arm acknowledgements before microphone startup or
target capture. Command generations reject late notifications after cancellation.
Escape repeats do not emit another stop/cancel. A key already held before arming
passes through until released. An owned Escape key-up is consumed even if the
workflow finishes mid-press, then the idle hook is removed. Worker EOF, parent
shutdown and worker failure all remove the hook. Lost worker/acknowledgement has
a bounded error path; active recordings are cancelled rather than left running.

Processing ownership spans the recording-to-ASR handoff and native insertion.
Cancellation aborts active jobs and invalidates pending capture. Meeting model
availability checks revalidate the cancellation epoch. Renderer startup tokens
prevent a delayed microphone grant or earlier error from cancelling a newer
recording. An initial UI regression blocked a new recording until an old grant
resolved; releasing cancelled startup ownership fixed it. The same lifecycle QA
then passed. Cancellation errors now display “Abgebrochen.” rather than Electron
IPC implementation details. Escape cannot be saved as a dictation shortcut.

Validation completed:

- Node: 51 passed, two optional actual-ASR unit tests skipped. Actual models were
  exercised separately below. The initial sandboxed suite could not reach its
  loopback HTTP fixtures; the suite passed with local networking permitted.
- Python: four Escape tests (including real hook arm/disarm and EOF), two hold-key
  tests and two WAV tests passed. The Escape lifecycle also passed in the newly
  frozen worker. CI includes the new Escape tests.
- Source hold/IPC QA with actual Whisper passed preference persistence, delayed
  microphone grants, repeat/stale-event isolation, cancellation and ordered saves.
- Source and packaged UI QA passed page identity/content, visible Escape guidance,
  1200×820 and 760×620 screenshots, no horizontal overflow and no relevant page or
  console errors. Killing only the owned Escape helper cancelled the microphone
  and released its tracks. Browser plugin not available; Electron Playwright used.
- On the final -verified package, native Windows Escape stopped Whisper toggle
  dictation and Parakeet held dictation while Control+Shift were still down. Both
  transcribed and inserted into the external Chromium editor. Active Escape was
  consumed; idle Escape reached that editor. Foreground HWND and indicator behavior
  remained correct. Ordinary native hold/release with Whisper also passed cursor
  fitting and insertion, without Escape.
- The same final package passed native Escape cancellation during actual Whisper
  ASR and during an intentionally pending loopback rewrite request. Both displayed
  “Abgebrochen.”, inserted nothing and saved no history; idle Escape passed through.
- Packaged meeting recording stopped on native Escape and produced a real bundled
  Whisper transcript. Native Escape then cancelled a pending summary: original
  transcript unchanged, no summary or archive entry saved, idle Escape restored.
  The first meeting attempt refused input because its target was not foreground;
  Computer Use app approval expired. A subsequent run used the same owned external
  editor as dictation tests and passed. A Computer Use refresh reported no foreground
  process as the successful fixture closed; the test's own assertions completed.
- Both ASR engines and speaker diarization passed with the frozen worker and a
  system-only PATH. Seven runtime/UI files in app.asar matched current source bytes.
  Production package name/version/main/type and metadata matched; electron-builder
  intentionally removed development scripts/dependencies and normalized JSON.
- All 111 mapped native-file hashes and 88 package-notice hashes matched. Extended
  Windows paths were needed to read deeply nested notice files. This hash check
  does not resolve the remaining native redistribution review.

The full build created a new frozen runtime and inventory. Subsequent packages
reused those unchanged resources while correcting the meeting epoch check and
German cancellation display. Intermediate outputs remain retained. The final
development installer is:
BlitzDicWindows/dist/windows-2026-11-01T06-58-02-880Z-ac79d7-verified/BlitzDic Setup 0.3.10-dev.1.exe;
1,148,478,969 bytes; SHA-256
21BACC3930C3C60681E5136117B5726BA85B382B4ABB414209AD442878F098BF.

This unsigned development package has not replaced installed 0.3.6 and is not a
public release. Synthetic microphone input and injected Windows keys do not prove
physical-device behavior. Other original features, broader application coverage,
clean Windows installation, licensing review and release gates remain open.

## Website rules in progress, 2026-11-02

Source 0.3.10-dev.2 adds canonical host-only website rules. The most specific
matching domain (including subdomains) precedes the executable rule for the
default verbatim shortcut. Explicit mode shortcuts stay explicit. An unavailable
rewrite configuration falls back to the app rule, then verbatim. Settings saves
validate and normalize rules in the main process; the renderer updates its
settings snapshot before enqueueing a save so a concurrent general save retains
the rules. URLs, paths, query strings and credentials are not stored in rules.

The target worker requests website metadata only when needed. The current bridge
compares native and managed focused runtime IDs, follows native UIA raw document
ancestors, and reads LegacyIAccessibleValue only on Document controls. Browser
process, foreground window, focused element, ancestry depth and elapsed time are
checked. Only the canonical host leaves the bridge. Unsupported metadata falls
back to the app rule; insertion signatures and modifier checks are unchanged.
The COM interface declarations follow the Microsoft Windows SDK
[UIAutomationClient.h](https://github.com/microsoft/win32metadata/blob/main/generation/WinSDK/RecompiledIdlHeaders/um/UIAutomationClient.h).

Current evidence:
- Node: 53 passed, two optional real-ASR tests skipped. The sandbox initially
  blocked loopback provider fixtures; the unrestricted test run passed.
- The current bridge compiled using system Windows PowerShell 5.1. CI now checks
  compilation without reading applications or sending input.
- Real Electron UI/IPC/DPAPI tests passed normalization, rejection of invalid and
  duplicate rules, encrypted storage, restart persistence, concurrent saves,
  clearing rules, desktop/small-window screenshots, no horizontal overflow and
  no renderer/console errors. Browser plugin unavailable; Electron Playwright used.
- Earlier source prototypes passed Chrome/Edge host and focused-frame checks;
  Chrome also passed real Whisper dictation, precedence, explicit shortcuts and
  no-LLM fallback. An Edge Parakeet hold run recognized/rewrote correctly but its
  insertion guard rejected the target. Cause remains unproven.
- A later geometric MSAA hit-test intermittently failed focused-frame host
  lookup. It has been replaced by direct UIA ancestry. Native browser/frame and
  insertion acceptance of this replacement remains open. Foreground ownership
  refusals are test-environment failures, not successful acceptance results.

The intermediate 0.3.10-dev.2 package under
dist/windows-2026-11-02T05-47-59-505Z-716e27 predates both the current ancestry
bridge and the concurrent-save fix. It is retained as an intermediate artifact,
not the current verified package. No new installer was installed or published.

A subsequent full build contains the current ancestry bridge and save fix:
dist/windows-2026-11-02T06-45-42-813Z-14de0a/BlitzDic Setup 0.3.10-dev.2.exe;
1,148,483,870 bytes; SHA-256
2EEED60E875D36CD217A1FE445E44B0A47FA2A664E4538F8A3F56ED298E5A25D.
Both real ASR engines and speaker diarization passed using its frozen worker
with a system-only PATH. Four relevant ASAR files and the native bridge matched
source bytes. All 111 mapped native hashes and 88 package-notice hashes matched;
copied speech-model and metadata files also matched. This does not replace the
outstanding native browser/packaged UI acceptance or redistribution review.

The German fixture also passed using this package's actual worker executable
and its copied model directories (not the development model folders). Both
engines retained the meeting time, Anna's task, 2500-euro budget and open Berlin
delivery; Whisper identified de. SYSTEMVORAUSSETZUNGEN.md now reflects this
synthetic German evidence while retaining the physical-microphone and accuracy
limitations. The updated text was included in the subsequent -de-docs packaging
pass, which reused the unchanged frozen runtime. That actual packaged app passed
the website-settings renderer/IPC/DPAPI verifier, including concurrent saves,
clearing, restart persistence, screenshots and console checks.

## Earlier window ownership checks, 2026-11-02

Source 0.3.10-dev.3 adds an optional HWND/PID scope to target capture. Website
tests bind both direct worker probes and the tested app's capture subprocess to
their exact browser window. The Python bridge checks ownership before inspecting
the focused control; the PowerShell bridge repeats the check after startup.
During UIA insertion, the original signature's window/process are checked before
recapturing field contents. Classic insertion similarly rejects a changed window
before reading its current field. Document hashes, runtime IDs, selection offsets,
read-only/password checks and held-modifier checks remain required.

Additional real-worker and compiled-C# tests reject malformed/impossible window
scopes and insertion signatures without reading application elements or sending
input. Both passed locally; CI includes them. Optional BLITZDIC_UIA_TRACE=1 emits
only phase labels and elapsed time. Failure diagnostics no longer print editor
contents or recognition results.

The earlier foreground refusal eventually closed its fixture after the bounded
wait. New automatic foreground acquisition subsequently worked, but UIA timed out
at AutomationElement.FocusedElement, before website metadata was requested.
Changing PowerShell to MTA did not resolve that observation and was reverted.
Desktop/session metadata showed WinSta0/Default in session 1, matching the active
console. No desktop, security or privacy setting was changed.

After the user confirmed a two-minute idle period, actual source runs passed:
- Edge 156.0.4314.58 and Chrome 156.0.8078.74: focused document host, metadata off,
  no URL path/query in capture IPC, URL-shaped editable text, unfocused covering
  iframe and focused cross-origin iframe. Direct ancestry returned the correct
  frame host; no screen-coordinate hit test is used.
- Edge with actual Parakeet Ultra and native held shortcuts: specific website
  calm beats root-domain clean and browser emoji; explicit clean stays explicit;
  unconfigured LLM gives verbatim without an LLM request. All three recognized,
  inserted into the owned external field and saved the expected encrypted history.
  No browser host/path/query appeared in provider requests or history.

These results do not establish the cause of every earlier timeout/insertion
refusal. The final frozen 0.3.10-dev.3 package, Chrome/Whisper full path and the
expanded guards with Word/classic controls still require acceptance. Both ASR
engines were exercised with synthetic audio; physical-microphone testing, other
remaining original features, licensing and release gates remain open.

The complete 0.3.10-dev.3 build is:
dist/windows-2026-11-02T13-23-42-624Z-851a1e/BlitzDic Setup 0.3.10-dev.3.exe;
1,148,486,370 bytes; SHA-256
8FBA63B1F417C07593F2B189A44997260EBA49A2519A31563F0877EEC6F830A3.
Both ASR engines, German recognition and speaker diarization passed with the
actual packaged worker and actual packaged model directories. The English and
diarization run used a system-only PATH. The frozen worker also rejected all
malformed/impossible capture scopes before field access. Five relevant ASAR
files, version metadata and the PowerShell bridge matched source bytes; 111
native-file hashes and 88 package-notice hashes matched. Native acceptance of
this final package is still pending. Installed 0.3.6 remains unchanged.

In the next user-confirmed three-minute idle period, the actual packaged app and
worker passed Edge/Parakeet Ultra with native held shortcuts in all three cases
(website calm, explicit clean, no-LLM verbatim), including external insertion,
encrypted history and provider-payload privacy checks. Its host/frame probes also
passed. The preceding Chrome/Whisper attempt and owned Word 16.0.20527 instance
were refused foreground activation before field capture/input, so they provide
no acceptance evidence. No classic-field run was started in the remaining time.
All fixture windows/processes closed; no additional interactive tests were started
after telling the user the PC was free. Chrome/Whisper, Word/classic controls and
the packaged settings UI still require acceptance of 0.3.10-dev.3.

## Optional output mute, 2026-11-02

Source 0.3.10-dev.4 adds a default-off setting for dictation output muting.
After microphone permission succeeds and before constructing the audio graph,
the renderer awaits a Main-process preparation acknowledgement. A separate lazy
windowless helper owns a Core Audio mute lease on the default multimedia rendering
endpoint. It holds that exact endpoint until restoration, never changes volume
levels and leaves an already-muted endpoint unchanged. Meeting startup/state IPC
explicitly identifies meeting audio and never prepares a dictation mute.

Stop/cancel, renderer navigation/crash and normal app shutdown request restoration.
The helper restores on stdin EOF and retries the same endpoint if a previous
restore failed. The client requests EOF instead of force-killing a possible lease
owner. New sessions cannot supersede restoration of an earlier sent mute.
Failures preserve dictation availability and return a visible warning. A helper
failure requires restarting the app before using the optional control again.

The bridge uses system COM APIs without another installed package. Method order
and GUIDs were checked against the Microsoft Windows SDK headers. References:
[IAudioEndpointVolume](https://learn.microsoft.com/en-us/windows/win32/api/endpointvolume/nn-endpointvolume-iaudioendpointvolume),
[GetDefaultAudioEndpoint](https://learn.microsoft.com/en-us/windows/win32/api/mmdeviceapi/nf-mmdeviceapi-immdeviceenumerator-getdefaultaudioendpoint).

Evidence and limits:
- Node: 59 passed, two optional ASR tests skipped. Six mute-controller tests cover
  disabled/no-spawn, startup cancellation, acknowledged restoration, helper loss,
  session handover and synchronous launch failure. Recorder tests additionally
  cover cancellation during preparation, no graph before preparation and late
  resource arrival without stopping a newer recording.
- Python: six fake-endpoint tests cover user-owned mute, idempotency, changed
  default devices, partial failure, retry and EOF. No test changes Windows audio.
- The actual source and frozen helper passed ready/idle/EOF protocol checks and
  a read-only Core Audio GetMute call. No real SetMute call has been made.
- Headless rendered UI (Browser plugin not available; Playwright) passed default
  off, save/reload, meeting/dictation routing, preparation before dictation and a
  visible preparation warning while recording still starts. IPC/recorder were
  simulated; this does not prove Main IPC or hardware behavior. Page identity,
  meaningful content, zero page/console errors and no horizontal overflow passed.
  Inspected screenshots: .runtime/output-mute-ui-1793632101363/desktop.png and
  small.png, at 1200x820 and 760x620.

Full development build:
dist/windows-2026-11-02T15-20-18-865Z-943dc7/BlitzDic Setup 0.3.10-dev.4.exe;
1,148,492,948 bytes; SHA-256
50CDA3A5479B2C7E3750676E00CA9F2270BD536665EB600B4D9BA73BFB84C2FD.
Actual packaged Whisper, Parakeet Ultra and speaker diarization passed with the
packaged model directories and system-only PATH. Seven relevant ASAR files and
version metadata matched source; 111 native and 88 notice hashes matched.
Native mutation/restoration, actual Main/renderer recording and GUI acceptance
remain pending. This package is unsigned, uninstalled and unpublished; all other
remaining original-feature, licensing and release gates remain open.


## Optional live meeting notes, 2026-11-02

Source 0.3.10-dev.5 adds provisional live meeting notes and a ten-minute catch-up.
Each recording section starts with the option unchecked. Enabling it uses a frozen
snapshot of the selected local/LAN/API provider and speech configuration. The UI
shows destination host, location and model. ASR remains local; only transcript
text goes to the configured LLM. There is no automatic save or speaker attribution.

Every 150 seconds, or on manual update, the renderer snapshots new audio without
removing any samples from the full recording. Preview requests are limited to five
minutes of mono PCM; an older skipped tail is marked incomplete. Recognized text
survives a failed LLM update; a twice-failing prefix is skipped with a visible
incompleteness warning so later notes can continue. LLM input/output are bounded;
the catch-up uses only the latest ten minutes and at most 12,000 source characters.
Stop/cancel aborts and awaits the owned preview job before final transcription or
new preview ownership. Generation checks reject late results and prevent cancellation
during preview shutdown from starting full transcription. The final transcript
continues to use the entire original recording; preview text is never appended.

Validation:
- Seven new Node tests cover local/LAN/API snapshots, invalid local destinations,
  retries, repeated-prefix failure, stopped worker/LLM results, ten-minute cutoff,
  malformed audio/output bounds and a non-destructive 301-to-300-second audio tail.
- Full Node suite: 66 passed, two optional ASR tests skipped. The first sandbox run
  blocked loopback provider fixtures; the permitted rerun passed, without changes
  to provider behavior.
- Real renderer + real LiveNotes service passed in headless Chrome, with simulated
  recorder, IPC, ASR and LLM: opt-in, manual update, automatic interval using a
  controlled browser clock, catch-up, destination, stop, and cancelled-stop race.
  No console/page errors or horizontal overflow. Desktop/small screenshots inspected
  at .runtime/live-notes-ui-1793635360402/{desktop,small}.png (1200x820/760x620).
  A later run at .runtime/live-notes-ui-1793635521855 includes the automatic timer
  and translated destination display. Browser plugin unavailable; Playwright used.
- Both real packaged dev.4 ASR engines passed through the source live service to
  actual loopback HTTP provider transport for notes and catch-up. The LLM response
  was simulated; payloads contained transcript text only, and stop cleared transient
  pending/recent text. No microphone, Windows audio mutation or desktop focus needed.

Actual Electron Main/renderer recording, physical microphone/system audio, long
meetings and real LLM factual quality/LAN/cloud delivery remain acceptance gates.
Echo filtering remains open. This feature does not claim original speaker-aware
mic/system echo filtering. Existing installer and release limitations still apply.

Full dev.5 build: dist/windows-2026-11-02T16-05-33-057Z-d100bd/
BlitzDic Setup 0.3.10-dev.5.exe; 1,148,496,702 bytes; SHA-256
5EC035E83E010C7D6FD40D9676267410A490F48D05E7AD4B21916FE009DE8457.
Both ASR engines and diarization passed again with this package and system-only
PATH. The live-notes HTTP smoke also passed with both new packaged engines.
Seven ASAR implementation files are byte-identical to source; production package
name/version/type/main match (electron-builder strips development metadata).
The installer remains unsigned, uninstalled and unpublished.


## Dual-track meeting transcript echo filter, 2026-11-02

Source 0.3.10-dev.6 ports the original MIT EchoFilter.swift behavior, including
its 2-second offset search, 0.6-second word tolerance, consecutive-match rule,
garbled-word bridging and guarded fragment pruning. It runs on separate actual
ASR word times rather than distributing segment text uniformly across time.
Whisper supplies word alignment; Parakeet supplies token onsets through onnx-asr
with_timestamps(). Token pieces are joined at word separators. Parakeet word ends
are estimates (last lexical token + 80 ms, capped by next onset/audio end), not
native word end measurements. Delayed punctuation stays in text without assigning
the intervening silence to the preceding word. Reference:
[onnx-asr timestamp adapter](https://istupakov.github.io/onnx-asr/usage/).

For source=both, one worklet receives microphone at input 0 and system at input 1;
it emits frame-aligned interleaved stereo with silence for a missing input. The
AudioContext runs at 16 kHz. PCM16 left is microphone and right is system. This
keeps two-track 30-minute audio below the existing IPC limit and bounds buffer
memory. Single-source/dictation paths remain mono. Preview snapshots still mix
both channels non-destructively; preview cursor/duration remain frame-based.

The final-transcript checkbox is shown only for both sources, initially checked,
and frozen for each section. Source/echo controls lock during capture/processing.
Both tracks are recognized in one worker with shared cached model instances. The
microphone transcript is filtered; all recognized system words are retained.
With optional diarization, the system track is clustered; surviving microphone
words form one source cluster, not a real-world speaker identity. Speaker count
refers to system audio. Unmatched system words keep a generic source label.
Timing/ASR/diarization failures fall back to the complete mixed recording and
return a warning through Dictation and the meeting renderer. Invalid stereo
layout is rejected before recognition. Cancellation still owns/kills one worker.

Evidence:
- Source Node suite: 69 passed, two optional ASR tests skipped. Added stereo WAV,
  worklet source-gap/channel-position and Dictation routing/fallback warning tests.
- Python: four word-timing tests, five echo-filter tests covering all original
  behavioral cases and an additional trailing digit, four dual-meeting tests.
  Existing single-source and mute tests remain in CI; no added runtime dependency.
- Real Whisper and Parakeet each removed 13 echo words from a 300-ms-delayed,
  attenuated synthetic copy, while retaining the original system transcript and
  a later complete microphone reply. The same fixture also passed both models
  with actual speaker diarization: system speaker plus separate microphone source.
- Headless Chrome with real Recorder/AudioWorklet/Web Audio, generated media
  streams and silent output passed mic-left/system-right level/frame/rate checks,
  mono preview and resource shutdown. It requests no microphone/system capture.
- Real renderer with simulated recorder/IPC/ASR/LLM passed echo-option visibility,
  default, source locking, remote speaker-count label, opt-out and warning display,
  plus existing live-notes update/catch-up/cancel tests. No page/console errors or
  horizontal overflow. Inspected 760x620 screenshot:
  .runtime/live-notes-ui-1793636872900/echo-small.png; desktop also recorded.
  Browser plugin unavailable; headless Playwright avoids desktop focus.

Limits: physical microphones/loudspeakers, Windows loopback and full Electron
Main/renderer capture have not been accepted for this change. Echo filtering of
live notes is not yet connected: they explicitly use the mixed preview. This
heuristic can remove an intentional simultaneous repetition; the option can be
disabled. Existing licensing, clean-install and release gates remain open.

The dev.6 installer is `dist/windows-2026-11-02T16-28-34-655Z-af01e6/BlitzDic Setup 0.3.10-dev.6.exe`
(1,148,508,079 bytes). SHA-256 is
`3704A33E4554CAEACA1138B14D768210C31B74552C36BFCF9830C1CDD77A8C8C`.
Both frozen models passed the echo fixture with diarization using system-only
PATH. Ordinary recognition, diarization and live-notes loopback checks passed.
Both packaged models also passed the German fixture with ordered word timings.
Nine ASAR files matched source, and all 111 native and 88 notice hashes matched.

## Live echo filtering

Version 0.3.10-dev.7 uses the recording section's echo setting for live notes
and catch-up. With filtering enabled the snapshot retains both synchronized 16 kHz
channels, and local recognition uses the same echo filter as the final transcript.
The provider receives filtered text. The live filter compares words within each
snapshot, so a delay spanning two snapshots can leave a duplicate in the preview.
A fallback to mixed recognition leaves a warning visible for the session.

Both bundled models passed the live echo fixture and ordinary live notes against
a loopback LLM fixture. The renderer fixture covered the echo setting and the real
Web Audio fixture verified identical channels in the stereo preview and final WAV.
Physical audio and a clean Windows installation remain to be verified.

The installer is `dist/windows-2026-11-04T05-38-51-082Z-2f3109/BlitzDic Setup 0.3.10-dev.7.exe`
(1,148,508,494 bytes). SHA-256 is
`A14AF0EE6C3B8A35E410927406949BFCA4D203D445BB7176403BB1A2B7FFD509`.

## Installer payload qualification

The dev.7 NSIS payload exposed four extraction failures with 7-Zip 16.04
in a deep workspace directory. Each affected path belonged to the PyAV
FFmpeg source and notice bundle. Dev.8 removes the redundant wheel metadata
prefix from that bundle's installed path. The maximum relative path in the
bundle dropped from 168 to 128 characters, and all 18 file hashes were preserved.

The dev.8 installer extracted successfully at the same destination depth.
All 1,096 payload files matched the staged application byte for byte. Resource
and notice verification passed, and the extracted worker passed Whisper,
Parakeet Ultra and speaker diarization with a system-only PATH. This tested
the archive payload. A fresh Windows 11 run of the NSIS installation wizard
remains open.

The installer is `dist/windows-2026-11-04T05-48-41-607Z-9c3773/BlitzDic Setup 0.3.10-dev.8.exe`
(1,148,513,872 bytes). SHA-256 is
`3BE4D87C51CEB83F766A9EF2302C9D47045D37AC7083464BC88BE509F3FFF2DE`.

## Real LLM acceptance fixture

Run `node scripts/verify-real-meeting-model.mjs` from `BlitzDicWindows` against
a running model server. The fixture submits a synthetic meeting and checks the
decision, budget, task owner and open question, as well as the save callback.
Use `BLITZDIC_TEST_LLM_PROVIDER` (`lmstudio`, `ollama`, `custom` or a configured
API provider), `BLITZDIC_TEST_LLM_LOCATION` (`local`, `lan` or `api`),
`BLITZDIC_TEST_LLM_URL` and `BLITZDIC_TEST_LLM_MODEL` to select the endpoint.
If the server requires a key, supply it through `BLITZDIC_TEST_LLM_API_KEY`
in the test process environment. The fixture prints its synthetic result and
does not read BlitzDic's saved connections or send existing dictation text.

Dev.9 includes the simplified LAN connection settings and a more explicit
instruction about unagreed deadlines. The local LM Studio server successfully
returned text for a URL supplied without `/v1`. Qwen 2.5 Coder 3B failed all
three post-change factual checks, including omissions and invented task owners.
Gemma 4 E4B passed the same fixture on the local server. It retained offer B,
the budget of 2,500 euros, Ben's task and the open question about delivery to
Berlin. It also reported that no deadline had been agreed. Both test sessions
stopped their loopback server and unloaded the test model.
LAN and external API acceptance still require real endpoints.

The API-mode transport was exercised against an isolated HTTPS loopback
fixture with synthetic text and credentials. Plain HTTP and an untrusted
certificate were rejected before the server received an HTTP request.
After trusting the ephemeral certificate in the test process, model discovery
and chat completion succeeded under `/compat/v1` with the expected bearer
header. This checks TLS and the API protocol. External provider acceptance
remains open.

The installer is `dist/windows-2026-11-04T05-55-55-513Z-3abb43/BlitzDic Setup 0.3.10-dev.9.exe`
(1,148,514,308 bytes). SHA-256 is
`78F0075E10D8B6A032244193DA655824B0B75D01D181894DB0D54B8928BAA2D8`.
Packaged provider, meeting and UI files matched source. The resource checks
and both bundled speech models and diarization passed from the staged package.

## Manually selected models

The dev.9 frozen worker accepted both supported formats through Dictation's
`custom` mode. Test copies of the Whisper and Parakeet models were placed in
separate Windows directories with spaces, umlauts and an emoji. Both recognized
the synthetic fixture through the selected path with no available bundled model
root. Selecting custom mode without a folder returned the expected error.

A separate test downloaded Systran's Whisper Tiny CTranslate2 conversion at
revision `d90ca5fe260221311c53c58e660288d3deb8d356` into an ignored local folder.
The same worker recognized the fixture through custom mode using this distinct
model. Tiny remains a user-supplied option. The two bundled presets are unchanged.
[Whisper Tiny model card](https://huggingface.co/Systran/faster-whisper-tiny/tree/d90ca5fe260221311c53c58e660288d3deb8d356)
