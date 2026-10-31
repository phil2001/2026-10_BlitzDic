#!/usr/bin/env bash
# Run in the project-local MSYS2 UCRT64 environment. No directories are removed.
set -euo pipefail
project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
archive="$project_root/.runtime/native-provenance/ffmpeg-8.0.3.tar.xz"
build_dir="${1:?Pass a new absolute build directory below .runtime/native-build}"
case "$build_dir" in "$project_root"/.runtime/native-build/*) ;; *) echo 'Build directory outside project native-build root' >&2; exit 1;; esac
if [[ -e "$build_dir" ]]; then echo 'Build directory exists; choose a new path' >&2; exit 1; fi
printf '%s  %s\n' 6136812ea6d4e68bdba27e33c2a94382711cdf4f8602ffef056ff792bd6f9818 "$archive" | sha256sum --check
mkdir -p "$build_dir/source" "$build_dir/objects" "$build_dir/install"
tar -xJf "$archive" --strip-components=1 -C "$build_dir/source"
gcc --version > "$build_dir/compiler.txt"
nasm -v > "$build_dir/assembler.txt"
pacman -Q > "$build_dir/build-packages.txt"
cd "$build_dir/objects"
# Unmodified FFmpeg release source. Disable auto-discovery so unrelated libraries
# on a developer machine cannot silently change the binary's dependency/license set.
"$build_dir/source/configure" --prefix="$build_dir/install" \
  --target-os=mingw32 --arch=x86_64 --cc=gcc --cxx=g++ \
  --enable-shared --disable-static --disable-programs --disable-doc --disable-debug \
  --disable-autodetect --disable-gpl --disable-nonfree --disable-version3 \
  --disable-network --disable-indevs --disable-outdevs \
  --disable-pthreads --enable-w32threads --extra-ldflags=-static-libgcc \
  2>&1 | tee "$build_dir/configure-output.txt"
make -j8 > "$build_dir/compile.log" 2>&1
make install > "$build_dir/install.log" 2>&1
# GCC's emulated thread-local storage uses this MIT-licensed runtime even with
# FFmpeg's own w32threads backend. Its package/version is in build-packages.txt.
install -m644 /ucrt64/bin/libwinpthread-1.dll "$build_dir/install/bin/libwinpthread-1.dll"
printf 'FFmpeg LGPL build complete: %s\n' "$build_dir/install"
