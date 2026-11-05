# Sherpa-ONNX dependency notices

Sherpa-ONNX v2.0.1's CMake recipe names the following dependency archives.
Their downloaded bytes matched the SHA-256 values in the upstream recipes.
The original license files and the corresponding recipe files are preserved
in this directory. File hashes and source URLs are in provenance.json.

| Component | Source version |
| --- | --- |
| kaldi-native-fbank | 1.22.4 |
| utf8proc | 2.12.0 |
| kaldi-decoder | 0.3.0 |
| simple-sentencepiece | 0.7 |
| hclust-cpp | 2026-02-25 |
| ONNX Runtime | 1.28.2, Windows x64 MT Release |
| OpenFST | 1.8.5-2026-07-09 |
| nlohmann/json | 3.12.0 |
| pybind11 | 3.0.0 |
| KissFFT | febd4caeed32e33ad8b2e0bb5ea77542c40f18ec |
| kaldifst | 1.8.0 |
| Eigen | 3.4.0 |

The main source recipe includes the first four components. It includes
hclust-cpp when speaker diarization is enabled.
[Pinned source recipe](https://github.com/k2-fsa/sherpa-onnx/blob/v2.0.1/CMakeLists.txt)

The three Sherpa core DLLs packaged in dev.15 match the official PyPI wheel
byte for byte. The Python extension reports Git revision `af2d8d81`,
version 2.0.1 and ONNX Runtime 1.28.2. The tag resolves to full revision
`af2d8d81dbfa61c4cea4c568da78f3982edca005`. Measured hashes and the source
workflow link are in wheel-origin.json. PyPI does not publish an attestation
for this core wheel.

The packaged ONNX Runtime DLL also matches the MT Release archive selected by
the pinned Windows build recipe. Its original LICENSE and ThirdPartyNotices.txt
are preserved here. This covers the embedded 1.28.2 DLL independently of the
separate top-level ONNX Runtime Python package.

KissFFT comes from kaldi-native-fbank's recipe. Kaldifst and Eigen come
from kaldi-decoder's recipe. The original Eigen source archive is included
beside its notices and verified against the recipe hash.

This collection follows the declared source dependencies. The exact static
composition of the supplier binaries still requires verification. Optional
components outside these archives remain outside this collection.
