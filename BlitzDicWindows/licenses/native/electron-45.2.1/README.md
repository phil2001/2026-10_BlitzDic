# Electron 45.2.1 Windows runtime and FFmpeg source

The six Windows DLLs match the complete official Electron x64 release archive
byte for byte. The packaged executable's sections also match the supplier's
`electron.exe`, except `.rsrc`, which electron-builder changes for BlitzDic's
branding, version and ASAR integrity resource. The release archive digest,
individual file hashes, source revisions and notice hashes are recorded in
`provenance.json`. This checks supplier identity, not an independent rebuild.

Electron's FFmpeg is separate from the clean FFmpeg 8.0.3 used by PyAV in the
speech worker. The standalone downloadable Electron FFmpeg ZIP contains a
different DLL and is not used as proof for the one shipped with BlitzDic.

The source chain for the shipped runtime is:

- Electron `f81ca3d4f09f57667238120adacb01239d5ecd89` (45.2.1).
- Its DEPS pins Chromium 156.0.8078.75, commit
  `861389936bf33ea77529ee5dcc0605e68f6bb620`.
- Chromium's DEPS pins FFmpeg
  `9db86ce5b5b454dfc96c435f9f0723012980c37f`.

Both complete source archives are included under `source/`. Each archive's
Git tree was reconstructed from all file contents, executable modes and
symbolic-link contents, and matched the authoritative commit tree. The
Electron Chromium patches do not modify DEPS. Its FFmpeg patch series contains
one loader-path patch whose change is guarded by `is_mac`; the original patch
is preserved even though this package targets Windows.

The Windows x64 Chrome configuration in the pinned FFmpeg source sets
`CONFIG_GPL`, `CONFIG_NONFREE` and `CONFIG_VERSION3` to zero. Electron's release
arguments enable a shared FFmpeg library and Chrome branding/proprietary
codecs. This is source-recipe evidence; it is not a patent clearance or an
independent measurement of every compiler option in the supplier binary.
The original LGPL-2.1 text, FFmpeg license overview and Chromium credits are
retained alongside the configuration. The full Chromium notice document and
Electron MIT notice are already collected at the installed license root.

## Separate Microsoft SDK component

The supplier includes `d3dcompiler_47.dll`, version 10.0.28000.2270. Its
Authenticode signature was valid with Microsoft Corporation as signer.
Microsoft lists this file as distributable with Classic Windows applications
under the Windows SDK terms. It also matches the exact x64 Redist file in the
official SDK NuGet package. The [separate SDK record](../windows-sdk-10.0.28000.2270/README.md)
retains that acquisition evidence and the original terms. The installer now
identifies those terms separately from Visual C++ V14 and the MIT application.
The publisher's obligations under both Microsoft agreements continue to apply.
[Windows SDK terms](https://learn.microsoft.com/en-us/legal/windows-sdk/license),
[SDK REDIST list](https://learn.microsoft.com/en-us/legal/windows-sdk/redist).

## Rebuilding or replacing the library on Windows

The included Electron source archive contains the upstream Windows and GN
build instructions under `docs/development/`. These describe the developer
toolchain and source checkout; they are not runtime prerequisites for BlitzDic.
Use an isolated source workspace and the exact Electron commit above, then
sync its DEPS with gclient as described in those instructions. The release
configuration is the included `build/args/release.gn`, which imports `all.gn`
and enables `is_component_ffmpeg = true` for the shared library.

Build the upstream `electron` release target following those Windows
instructions to produce its compatible `ffmpeg.dll`. The included FFmpeg
archive supplies the pinned library source and generated configurations;
Electron's archive supplies its patch series and release build controls.
The pinned Chromium checkout supplies the common GN/toolchain infrastructure.
BlitzDic's build-time hash checks do not run at application startup and do not
prevent replacing the application-local library with a compatible modified
build. The rest of the BlitzDic application is available under MIT.

Ordination workstations receive the complete app package. They do not need
these build tools, separate source downloads or another FFmpeg installation.

Sources: [Electron release](https://github.com/electron/electron/releases/tag/v45.2.1),
[pinned Electron DEPS](https://github.com/electron/electron/blob/f81ca3d4f09f57667238120adacb01239d5ecd89/DEPS),
[pinned Chromium DEPS](https://github.com/chromium/chromium/blob/861389936bf33ea77529ee5dcc0605e68f6bb620/DEPS),
[FFmpeg source commit](https://chromium.googlesource.com/chromium/third_party/ffmpeg/+/9db86ce5b5b454dfc96c435f9f0723012980c37f).
