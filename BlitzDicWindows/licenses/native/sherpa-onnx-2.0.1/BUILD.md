# Source-built Windows speaker runtime

The manual `Build Windows speaker runtime from source` workflow checks out
`k2-fsa/sherpa-onnx` at `af2d8d81dbfa61c4cea4c568da78f3982edca005`.
It records the CMake cache, packaging patch, source revision and wheel hash.
The package includes the source dependency notices in this directory.
In the original run, the retained `CMakeCache.txt` was overwritten by a
dependency's cache. The complete CI log records that run's configuration;
the workflow now retains only the top-level cache for future source builds.

The first successful wheel build was produced by
[run 41982775391](https://github.com/phil2001/BlitzDic/actions/runs/41982775391).
Wheel: `sherpa_onnx-2.0.1-cp312-cp312-win_amd64.whl`.
SHA-256: `40a45982f4d01fff01ae7d2345dc4f82f2a1d801885a6006743a836452bcd898`.
That run failed its subsequent verification because the pinned upstream
`sherpa-onnx/csrc/version.cc` embeds `96255a1b` as a literal Git revision.
The CMake output and checkout both identify the requested full source revision.
The verifier now checks the literal against that source file and independently
checks the actual checkout and wheel provenance. It does not relabel this
upstream version string or treat it as the checkout identity.

The downloaded wheel was installed in a new isolated Python 3.12.12 environment
alongside the source-built CTranslate2/Ruy wheel and clean PyAV/FFmpeg wheel.
All installed DLL/PYD bytes matched the wheel. Imports, embedded notice presence,
version 2.0.1 and ONNX Runtime 1.28.2 passed verification. The normal BlitzDic
speech worker processed the 105-second synthetic speech fixture with this
runtime, returning 30 ordered speech intervals assigned to one speaker.
This test checks inference, not accuracy on multiple real speakers.
The corrected CI verification of the same wheel also passed in
[run 41992637746](https://github.com/phil2001/BlitzDic/actions/runs/41992637746).

The actual build log selects Eigen 5.0.1, not the 3.4.0 version mentioned in
kaldifst's fallback recipe. The supplementary `eigen-5.0.1` folder includes
its original source archive and license files, verified against Sherpa's own
pinned CMake recipe. This supplements the notices inside the original wheel.

To prepare the build environment, download the retained source artifact and
the CTranslate2/Ruy artifact, then run from `BlitzDicWindows`:

```powershell
./scripts/setup-speech.ps1 -RuyArtifactDirectory <ruy-artifact-folder> -SpeakerArtifactDirectory <speaker-artifact-folder>
```

The script checks the recorded source revisions and wheel hashes and creates
a separate environment. It omits the supplier's split `sherpa-onnx-core`
distribution because this source wheel already owns its native files.
Set `BLITZDIC_BUILD_PYTHON` to the printed Python path and install
`pyinstaller==6.22.3` there before `npm.cmd run build:win`.

For rechecking a retained artifact in CI without recompiling, provide its run
ID in the workflow's optional `reuse_run_id` input. Source builds are still
performed when this field is empty. The reused artifact must come from a
completed run of the same source-build workflow in this repository.
