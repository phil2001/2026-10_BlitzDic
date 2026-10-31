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
