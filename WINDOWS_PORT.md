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

The imported Swift application is not a Windows application. No Windows release
has been produced yet. This checklist defines the remaining deliverable.

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

Upstream uses SwiftUI/AppKit, Core ML, WhisperKit, Apple Intelligence, Keychain,
Accessibility and Sparkle. These require Windows replacements. Shared mode
prompts and provider behavior are available in `BlitztextShared/AI` and should
be carried over rather than invented anew.

The current workstation has Node 24 and npm 11 available. `dotnet` and `cargo`
were not found on PATH during the initial inspection. The Python command is a
WindowsApps alias and has not yet been verified as a working runtime.
