# Windows speech runtime research

Inspected 2026-10-31. These are implementation candidates, not verified working
integrations or claims about this app's recognition quality.

## Whisper

Use a packaged Windows whisper.cpp runtime with multilingual Whisper weights.
The upstream CLI supports JSON output (`--output-json`), model selection and
audio-file input. Ship the accompanying DLLs, not just whisper-cli.exe.

Primary documentation: https://github.com/ggml-org/whisper.cpp and
https://github.com/ggml-org/whisper.cpp/blob/master/examples/cli/README.md

## Parakeet Ultra

The source is https://huggingface.co/moondream/parakeet-ultra, a post-trained
NVIDIA Parakeet v3 model, licensed CC-BY-4.0. It must not be confused with the
original NVIDIA v3 weights. Windows uses the ONNX export described below.

A candidate Windows export exists:
https://huggingface.co/Masterx/parakeet-tdt-0.6b-ultra-onnx

Its publisher documents full replacement of the v3 initializers by Ultra
weights, onnx-asr compatibility and DirectML compatibility. It provides fp32,
fp16 and int8 variants, config.json and vocab.txt, under CC-BY-4.0. This is a
third-party conversion; verify recognition with real audio before selecting
it as the shipped preset. Preserve NVIDIA, Moondream and converter attribution.

Candidate runtime: https://github.com/istupakov/onnx-asr

## Text generation

The Node provider client implements the existing upstream provider protocols,
plus explicit local/LAN/API location selection. Ollama and LM Studio use their
OpenAI-compatible endpoints. HTTP tests currently use local fixture servers;
they do not prove inference against an installed model.

https://github.com/ollama/ollama/blob/main/docs/api/openai-compatibility.mdx
https://lmstudio.ai/docs/developer/core/server

## Verification so far

`npm.cmd test` in BlitzDicWindows: 10 passing tests (2026-10-31).
Coverage: HTTP model discovery/rewrite requests, URL/location validation,
timeouts, cancellation, redirect refusal, sanitized errors, truncated output,
verbatim mode, dictionary replacement and prompt construction.
Still required: actual ASR execution, packaged UI, hardware and end-to-end tests.
