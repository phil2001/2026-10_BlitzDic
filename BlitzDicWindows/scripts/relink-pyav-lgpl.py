"""Create a private PyAV wheel linked to the project's clean FFmpeg DLLs.

Only DLL import names in the upstream Windows extensions change. Executable
sections are required to remain byte-identical. The upstream wheel is retained.
The result includes corresponding FFmpeg source and the exact build configuration.
"""
import argparse
import base64
import csv
import ctypes
import hashlib
import io
import json
import os
from pathlib import Path
import re
import zipfile
import pefile

ROOT = Path(__file__).resolve().parents[1]
WHEEL_SHA = '0c669b6b6668c8ae74451c15ec6d6d8a36e4c3803dc5d9910f607a174dd18f17'
SOURCE_SHA = '6136812ea6d4e68bdba27e33c2a94382711cdf4f8602ffef056ff792bd6f9818'
VERSION = '16.0.1+blitzdic.1'
LIBRARIES = ['avcodec-62.dll', 'avdevice-62.dll', 'avfilter-11.dll', 'avformat-62.dll',
             'avutil-60.dll', 'swresample-6.dll', 'swscale-9.dll']


def sha(data):
    return hashlib.sha256(data).hexdigest()


def code_hashes(binary):
    return {section.Name: sha(section.get_data()) for section in binary.sections if section.Characteristics & 0x20000000}


def relink(data):
    changes = []
    with pefile.PE(data=data) as binary:
        previous = code_hashes(binary)
        for dependency in getattr(binary, 'DIRECTORY_ENTRY_IMPORT', []):
            original = dependency.dll.decode('ascii')
            canonical = re.sub(r'-[0-9a-f]{32}(?=\.dll$)', '', original, flags=re.I)
            if original == canonical:
                continue
            if canonical.lower() not in LIBRARIES:
                raise ValueError(f'Unexpected non-FFmpeg mangled extension dependency: {original}')
            replacement = canonical.encode('ascii') + bytes(len(original) + 1 - len(canonical))
            if not binary.set_bytes_at_rva(dependency.struct.Name, replacement):
                raise ValueError(f'Could not rewrite import: {original}')
            changes.append({'from': original, 'to': canonical})
        binary.OPTIONAL_HEADER.CheckSum = binary.generate_checksum()
        modified = binary.write()
    with pefile.PE(data=modified) as binary:
        if previous != code_hashes(binary):
            raise ValueError('Executable code changed while rewriting DLL import names')
    return modified, changes


def ffmpeg_report(directory):
    result = []
    with os.add_dll_directory(str(directory)):
        for filename in LIBRARIES:
            path = directory / filename
            library = ctypes.CDLL(str(path))
            prefix = filename.split('-')[0]
            license_function = getattr(library, prefix + '_license'); license_function.restype = ctypes.c_char_p
            config_function = getattr(library, prefix + '_configuration'); config_function.restype = ctypes.c_char_p
            license_text = license_function().decode()
            configuration = config_function().decode()
            if license_text != 'LGPL version 2.1 or later' or not all(flag in configuration.split() for flag in
                    ['--disable-gpl', '--disable-nonfree', '--disable-version3', '--disable-autodetect']):
                raise ValueError(f'Unexpected FFmpeg license/configuration: {filename}')
            if any(flag in configuration for flag in ['--enable-gpl', '--enable-nonfree', '--enable-libx264', '--enable-libx265']):
                raise ValueError('GPL/nonfree configuration detected')
            result.append({'file': filename, 'sha256': sha(path.read_bytes()), 'reportedLicense': license_text,
                           'configuration': configuration})
    return result


def build(upstream, native_build, output, toolchain):
    if sha(upstream.read_bytes()) != WHEEL_SHA:
        raise ValueError('Upstream wheel differs from pinned PyPI SHA-256')
    source = ROOT / '.runtime/native-provenance/ffmpeg-8.0.3.tar.xz'
    if sha(source.read_bytes()) != SOURCE_SHA:
        raise ValueError('FFmpeg source differs from verified release archive')
    binary_dir = native_build / 'install/bin'
    if {p.name.lower() for p in binary_dir.glob('*.dll')} != set(LIBRARIES + ['libwinpthread-1.dll']):
        raise ValueError('Clean FFmpeg build must contain the seven expected libraries and the compiler TLS runtime')
    runtime = (binary_dir / 'libwinpthread-1.dll').read_bytes()
    if runtime != (toolchain / 'ucrt64/bin/libwinpthread-1.dll').read_bytes():
        raise ValueError('Compiler TLS runtime does not match the recorded toolchain')
    native_report = ffmpeg_report(binary_dir)
    old_info = 'av-16.0.1.dist-info'
    new_info = f'av-{VERSION}.dist-info'
    files, changes = {}, []
    with zipfile.ZipFile(upstream) as archive:
        for item in archive.infolist():
            if item.is_dir() or item.filename.startswith('av.libs/') or item.filename == f'{old_info}/RECORD':
                continue
            name = item.filename.replace(old_info + '/', new_info + '/', 1)
            if item.filename == f'{old_info}/DELVEWHEEL':
                name = f'{new_info}/UPSTREAM_DELVEWHEEL'
            data = archive.read(item)
            if name.endswith('.pyd'):
                rewritten, dependencies = relink(data)
                changes.append({'file': name, 'upstreamSha256': sha(data), 'relinkedSha256': sha(rewritten), 'imports': dependencies})
                data = rewritten
            elif name == 'av/about.py':
                data, count = re.subn(rb'(?m)^__version__ = [\'"]16\.0\.1[\'"]', f'__version__ = "{VERSION}"'.encode(), data)
                if count != 1:
                    raise ValueError('Upstream version declaration changed')
            elif name == f'{new_info}/METADATA':
                data, count = re.subn(rb'(?m)^Version: 16\.0\.1(?=\r?$)', f'Version: {VERSION}'.encode(), data)
                if count != 1:
                    raise ValueError('Wheel metadata version not updated')
            files[name] = data
    for filename in LIBRARIES + ['libwinpthread-1.dll']:
        files[f'av.libs/{filename}'] = (binary_dir / filename).read_bytes()
    notices = f'{new_info}/licenses/blitzdic-ffmpeg'
    files[f'{notices}/ffmpeg-8.0.3.tar.xz'] = source.read_bytes()
    for filename in ['COPYING.LGPLv2.1', 'COPYING.GPLv2', 'LICENSE.md']:
        files[f'{notices}/{filename}'] = (native_build / 'source' / filename).read_bytes()
    for filename in ['compiler.txt', 'assembler.txt', 'build-packages.txt', 'configure-output.txt']:
        files[f'{notices}/{filename}'] = (native_build / filename).read_bytes()
    files[f'{notices}/build-ffmpeg-lgpl.sh'] = (ROOT / 'scripts/build-ffmpeg-lgpl.sh').read_bytes()
    for component in ['crt', 'libgcc', 'libwinpthread']:
        directory = toolchain / 'ucrt64/share/licenses' / component
        license_files = [p for p in directory.rglob('*') if p.is_file()]
        if not license_files:
            raise ValueError(f'Missing toolchain runtime notices: {component}')
        for notice in license_files:
            files[f'{notices}/toolchain/{component}/{notice.relative_to(directory).as_posix()}'] = notice.read_bytes()
    manifest = {'upstreamWheelSha256': WHEEL_SHA, 'version': VERSION, 'ffmpegVersion': '8.0.3',
                'ffmpegSourceSha256': SOURCE_SHA, 'ffmpegSourceUrl': 'https://ffmpeg.org/releases/ffmpeg-8.0.3.tar.xz',
                'sourceChanges': 'None. Unmodified signed FFmpeg release archive.',
                'extensionChanges': 'DLL import names and PE checksums only; executable sections verified unchanged.',
                'extensions': changes, 'libraries': native_report,
                'compilerTlsRuntime': {'file': 'libwinpthread-1.dll', 'sha256': sha(runtime),
                                       'origin': 'Same project-local MSYS2 toolchain recorded in build-packages.txt',
                                       'notice': 'toolchain/libwinpthread/COPYING'},
                'reviewPending': ['All other application native libraries remain subject to review.']}
    files[f'{notices}/relink-manifest.json'] = json.dumps(manifest, indent=2).encode() + b'\n'
    record = io.StringIO(newline='')
    writer = csv.writer(record, lineterminator='\n')
    for name, data in sorted(files.items()):
        writer.writerow([name, 'sha256=' + base64.urlsafe_b64encode(hashlib.sha256(data).digest()).rstrip(b'=').decode(), len(data)])
    writer.writerow([f'{new_info}/RECORD', '', ''])
    files[f'{new_info}/RECORD'] = record.getvalue().encode()
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as wheel:
        for name, data in sorted(files.items()):
            wheel.writestr(name, data)
    print(json.dumps({'wheel': str(output), 'sha256': sha(output.read_bytes()), 'ffmpegLibraries': len(native_report),
                      'extensions': len(changes), 'ffmpegSourceIncluded': True}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('native_build', type=Path)
    parser.add_argument('output_directory', type=Path)
    parser.add_argument('--upstream-wheel', type=Path, default=ROOT / '.runtime/native-provenance/av-16.0.1-cp312-cp312-win_amd64.whl')
    parser.add_argument('--toolchain', type=Path, default=ROOT / '.runtime/toolchains/msys2-20260927/msys64')
    args = parser.parse_args()
    output = args.output_directory.resolve() / f'av-{VERSION}-cp312-cp312-win_amd64.whl'
    if not output.is_relative_to(ROOT) or output.exists():
        raise SystemExit('Output must be a new wheel inside the project')
    build(args.upstream_wheel.resolve(), args.native_build.resolve(), output, args.toolchain.resolve())
