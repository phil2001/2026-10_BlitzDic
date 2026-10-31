# Local speaker diarization prototype

The speech worker now accepts action `diarize`, a modelDirectory, audioPath or
in-memory audioBase64, and optional speakerCount (-1 automatic or 1–20). It runs
sherpa-onnx 2.0.1 on CPU and returns time ranges with neutral speaker IDs normalized
by first occurrence. IDs do not identify people. PyAV resamples non-16-kHz input.

## Current models used for the prototype

- pyannote segmentation-3.0, INT8 ONNX conversion distributed by sherpa-onnx.
  Included archive LICENSE: MIT, Copyright 2022 CNRS.
  https://k2-fsa.github.io/sherpa/onnx/speaker-diarization/models.html
  https://huggingface.co/pyannote/segmentation-3.0
- NVIDIA NeMo TitaNet Small ONNX export distributed by sherpa-onnx.
  https://catalog.ngc.nvidia.com/orgs/nvidia/teams/nemo/models/titanet_small
  The original NVIDIA card links the NeMo Toolkit license. Exact conversion
  provenance and redistribution notices still need verification before packaging.

Runtime/API references:
https://github.com/k2-fsa/sherpa-onnx/blob/master/python-api-examples/offline-speaker-diarization.py
https://github.com/k2-fsa/sherpa-onnx/releases/tag/speaker-segmentation-models
https://github.com/k2-fsa/sherpa-onnx/releases/tag/speaker-recongition-models

Models are ignored local development assets under models/diarization. They are
not yet added to the Windows installer or exposed in the meeting UI.

## Local asset fingerprints

- model.int8.onnx: d582f4b4c6b48205de7e0643c57df0df5615a3c176189be3fc461e9d18827b5d
- nemo_en_titanet_small.onnx: ad4a1802485d8b34c722d2a9d04249662f2ece5d28a7a039063ca22f515a789e

The official 0-four-speakers-zh.wav test is kept in .runtime. Running
`node scripts/verify-diarization.mjs` exercises JSON IPC with a known count of four:
10 time ranges, four clusters, coverage beyond 50 seconds. That count is supplied,
so this is an execution/invariant test, not evidence of correct automatic counting.
An additional automatic-count run returned seven clusters for the same four-speaker
sample. Automatic counting quality remains unresolved; do not claim completion.

Remaining work: reproducible verified model acquisition, packaging and attribution,
ASR/speaker-range alignment, meeting UI, recording/saved-data integration, automatic
count quality and multi-language/overlap evaluation. No persistent voice profiles
or identity enrollment are implemented.
