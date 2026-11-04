# Native dependency review

The [Python standalone runtime notices](python-standalone-20260127/README.md)
record the source and notices for the bundled OpenSSL, SQLite and libffi DLLs.

## Microsoft C++ runtime in 0.3.10-dev.11

The frozen speech worker ships five Microsoft C++ runtime DLLs. A PE scan of
the unpacked installer checked direct and delay-loaded imports. All five files
passed Windows Authenticode verification.

| Packaged DLL | File version | Build input | Importing binaries |
| --- | --- | --- | ---: |
| `msvcp140.dll` | 14.51.36247.0 | Build host System32 | 5 |
| `msvcp140_1.dll` | 14.51.36247.0 | Build host System32 | 2 |
| `vcruntime140.dll` | 14.44.35211.0 | Python standalone 3.12.12 build 20260127 | 95 |
| `vcruntime140_1.dll` | 14.44.35211.0 | Python standalone 3.12.12 build 20260127 | 8 |
| `numpy.libs/msvcp140-a4c2229bdc2a2a630acdc095b4d86008.dll` | 14.40.33810.0 | NumPy 2.5.4 wheel | 2 |

On the development PC, both Whisper Small and Parakeet Ultra transcribed the
synthetic test recording with PATH limited to Windows directories. Windows
process-module sampling observed all five DLLs loaded from the speech package
in each run. This verifies package-local resolution on that host. A fresh
Windows 11 install test remains open.

Both System32 inputs match the corresponding x64 DLLs in Microsoft's signed
[Visual C++ Redistributable 14.51.36247](https://aka.ms/vs/18/release/14.51.36247/VC_redist.x64.exe)
byte for byte. The downloaded bundle passed Authenticode verification with
Microsoft Corporation as the signer. It was extracted without running the
installer. The Burn manifest maps the `vcRuntimeMinimum_amd64/cab1.cab` payload
to `a4`. The following hashes were measured with SHA-256.

| File | SHA-256 |
| --- | --- |
| `VC_redist.x64.exe` | `843068991DAAA1F73AD9F6239BCE4D0F6A07A51F18C37EA2A867E9BECA71295C` |
| `msvcp140.dll_amd64` | `7C26614E1D733892C2DEAC7E245CE115504B1D80592DD0A01B08E3E5A55F89CA` |
| `msvcp140_1.dll_amd64` | `206C931BF90FDAD8816DE3B5E2EF80B2BCAA9406C89ECC05FE6FDDFFE251E982` |

Builds still resolve these two DLLs from the host. A different host or runtime
version requires a new comparison. The distributor's rights to ship all five
files remain under review.
[Microsoft redistribution documentation](https://learn.microsoft.com/en-us/cpp/windows/redistributing-visual-cpp-files)

## CPU package changes in 0.3.6

Internal speaker-turn WAV encoding now uses the Python standard library.
SoundFile, libsndfile, CFFI and pycparser are not runtime dependencies. All public
audio imports still use PyAV. The CPU-only CTranslate2 build hook also omits the
unused cuDNN loader. The packaged native-file verifier checks their absence.

intel-openmp/ records a full-byte match between CTranslate2's OpenMP DLL and
Intel's official 2025.3.0 supplier wheel, and includes its original EULA. Collection
does not resolve all redistribution requirements; that review remains open.
onednn-3.1.1/ supplies the notices declared by the pinned CTranslate2 build recipe,
without claiming that all static components have been independently verified.
numpy-openblas/ records a full-byte match to the declared scipy-openblas64 supplier
and its notice. NumPy's own copied notice also covers OpenBLAS/LAPACK. Microsoft
runtime and remaining component obligations are still under review.

## Current clean FFmpeg build

Windows 0.3.5 uses the private av 16.0.1+blitzdic.1 wheel with unmodified,
signature-verified FFmpeg 8.0.3 source. GPL, nonfree, version3 and automatic
external-library detection are disabled. Its seven FFmpeg DLLs report LGPL 2.1
or later. The eighth DLL is the compiler's MIT-licensed winpthread TLS runtime.
Corresponding FFmpeg source, build commands/configuration, compiler package
versions, notices and binary/extension hashes are included with the wheel and
copied into the installed license directory. See [BUILD_FFMPEG.md](BUILD_FFMPEG.md).

The original PyAV extension machine code is unchanged; only DLL import names,
PE checksums and package metadata are updated. New Windows builds reject the
older vendor configuration. Other native libraries remain under review; this
component replacement is not an application-wide compliance verdict.

## Historical upstream wheel investigation

The following reports describe the original upstream wheel and older packages.
Its configure patch moves x264/x265 from the GPL list to the version3 list, so
the DLL-reported LGPL string was not accepted as sufficient release evidence.
The pinned vendor comparison in provenance/ establishes 32 identical executable
section sets and 15 whole-file matches; repaired imports account for filename/
binary differences. See its pinned source links and explicit review status.

The scripts/native-inventory.py report records the installed Python environment's
DLL/PYD SHA-256 fingerprints and queries seven actual FFmpeg DLL exports for their
license/configuration reports. It also records PyAV, FFmpeg and libsndfile versions.
This is runtime evidence, not a legal-compliance verdict.

On the tested av 16.0.1 Windows wheel, all seven queried FFmpeg libraries report
"LGPL version 3 or later", and av_version_info reports 8.0. Configuration includes
--enable-version3 and shared libraries. The raw configuration is preserved in the
generated inventory. Filenames alone are not used to infer licenses. Exact source
and build provenance for all linked components still needs to be established.

Included license/reference files are copied unchanged from the FFmpeg n8.0 tag:
https://raw.githubusercontent.com/FFmpeg/FFmpeg/n8.0/COPYING.LGPLv3
https://raw.githubusercontent.com/FFmpeg/FFmpeg/n8.0/COPYING.GPLv3
https://raw.githubusercontent.com/FFmpeg/FFmpeg/n8.0/LICENSE.md
The GPL text is included as a referenced license text; its presence is not a claim
that every bundled binary has the same license.

Upstream binary/build provenance references:
https://github.com/PyAV-Org/pyav-ffmpeg
https://pyav.basswood.io/docs/stable/overview/installation.html
The current upstream README describes newer FFmpeg builds and cannot alone prove
which source revision produced the older installed 8.0 wheel's dependencies.

scripts/map-native-package.py compares actual frozen speech DLL/PYD hashes against
the installed package inventory. Tested 0.3.0 package: 182 files, 111 matched, 71
outside that inventory. The latter list includes Python standard-library extensions,
Python DLLs, OpenSSL/libffi/sqlite runtime DLLs and Windows runtime DLLs. Their exact
origins/notices remain part of review. Electron is excluded from this speech map.

Future builds include both inventories and these license texts. A complete
corresponding-source/notice bundle and remaining binary origins are still open;
this work must not be described as completed redistribution compliance.

## Build-origin verification and isolated DLL resolution

The map now reads PyInstaller Analysis-00.toc using literal parsing and verifies
actual source hashes for every shipped DLL/PYD. The 0.3.0 package's 182 files all
had traceable origins, but 48 came from an unrelated external developer-tool
runtime directory inherited through PATH. They were not Windows-directory origins.
This revealed a reproducibility/provenance defect rather than establishing any
malicious modification; all compared source/binary hashes matched.

build-speech.ps1 now temporarily limits PATH to the project Python installation
and Windows directories, restoring the caller's PATH afterwards. Build packaging
requires no unresolved hashes and no external-tool origins. The old package is
correctly rejected by this strict check. A new isolated worker contains 138 native
files: 111 package files and 27 Python/Windows runtime files, all source hashes
matched, zero external origins. verify-frozen-speech.mjs passed actual Whisper,
Parakeet and speaker diarization with its own PATH also limited to Windows.
The full installer must be rebuilt to replace the older worker. Complete native
license/source attribution remains a separate outstanding task.
