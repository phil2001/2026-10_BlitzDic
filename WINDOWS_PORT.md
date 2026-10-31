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

Native Edit/RichEdit target capture and guarded insertion are implemented, but
the attempted native-window test could not acquire foreground focus. Successful
insertion is therefore not yet verified. Browser/Office UI Automation remains
outstanding; unknown controls are rejected rather than guessed.

The application now targets Windows 11 exclusively. Legacy platform sources and documentation have been removed. Ported mode prompts and provider behavior live in BlitzDicWindows/src. The original ancestry and MIT notices remain available in Git history and LICENSE.

A real LM Studio integration test passed with the already installed qwen2.5-coder-3b-instruct model: discovery, connection check and German text rewriting. The test server was stopped and its model unloaded afterwards. LAN and cloud endpoints remain unverified. Whisper and Parakeet run independently of LM Studio through the bundled speech runtime.
