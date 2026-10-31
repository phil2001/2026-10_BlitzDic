# Bundled speaker-model attribution

Segmentation: pyannote/segmentation-3.0 by CNRS, INT8 ONNX conversion by
sherpa-onnx. The distributed conversion archive includes the MIT license,
Copyright (c) 2022 CNRS, reproduced in pyannote-segmentation-LICENSE.txt.
Source: https://huggingface.co/pyannote/segmentation-3.0
Conversion and release: https://github.com/k2-fsa/sherpa-onnx/tree/master/scripts/pyannote/segmentation
https://github.com/k2-fsa/sherpa-onnx/releases/tag/speaker-segmentation-models

Embedding: NVIDIA NeMo TitaNet-Small, ONNX conversion by sherpa-onnx.
The original NVIDIA NGC model card, version 1.19.0, explicitly refers model
use to the NeMo Toolkit license. The corresponding Apache-2.0 license text
is reproduced in NeMo-TitaNet-LICENSE.txt.
Original card: https://catalog.ngc.nvidia.com/orgs/nvidia/teams/nemo/models/titanet_small
License source: https://raw.githubusercontent.com/NVIDIA/NeMo/v1.19.0/LICENSE
Export provenance: https://github.com/k2-fsa/sherpa-onnx/tree/master/scripts/nemo/speaker-verification
Converted weights: https://github.com/k2-fsa/sherpa-onnx/releases/tag/speaker-recongition-models

BlitzDic distributes the two tested ONNX files without modifying their weights.
Their exact SHA-256 fingerprints and download URLs are in
speech/diarization-models.json. Runtime: sherpa-onnx 2.0.1, Apache-2.0.
No endorsement by the above authors or publishers is asserted.
