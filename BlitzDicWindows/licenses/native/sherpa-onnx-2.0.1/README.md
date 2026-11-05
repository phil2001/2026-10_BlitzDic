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

The main source recipe includes the first four components. It includes
hclust-cpp when speaker diarization is enabled.
[Pinned source recipe](https://github.com/k2-fsa/sherpa-onnx/blob/v2.0.1/CMakeLists.txt)

These are the versions declared by the source recipe. The exact configuration
and static dependency versions of the installed supplier wheel still require
verification. Other optional dependencies and Tokenizers' Rust dependencies
remain outside this collection.
