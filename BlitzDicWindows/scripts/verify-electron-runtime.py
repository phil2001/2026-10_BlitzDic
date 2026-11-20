"""Verify the Windows Electron supplier files and corresponding source bundle.

This is a developer/build check, never a workstation prerequisite or a runtime
restriction on replacing LGPL library files.
"""
import argparse
import hashlib
import json
from pathlib import Path

import pefile

root = Path(__file__).resolve().parents[1]
base = root / 'licenses/native/electron-45.2.1'
manifest = json.loads((base / 'provenance.json').read_text(encoding='utf-8'))
parser = argparse.ArgumentParser(description=__doc__)
group = parser.add_mutually_exclusive_group(required=True)
group.add_argument('--distribution', type=Path)
group.add_argument('--application', type=Path)
args = parser.parse_args()


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def verify_file(directory, relative, expected):
    path = (directory / relative).resolve()
    if not path.is_relative_to(directory.resolve()) or digest(path) != expected:
        raise SystemExit(f'Electron/source hash mismatch: {relative}')


def verify_sources(directory):
    for item in manifest['files'] + manifest['sourceArchives']:
        verify_file(directory, item['path'], item['sha256'])


# The Electron fuses set in electron-builder.yml are the only intended change inside .rdata.
FUSE_SENTINEL = b'dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX'
# Fuse wire v1 of Electron 45.2.1, in Electron's order: RunAsNode, CookieEncryption,
# NodeOptions, NodeCliInspect, AsarIntegrity, OnlyLoadAppFromAsar, BrowserV8Snapshot,
# GrantFileProtocolExtraPrivileges, WasmTrapHandlers.
SUPPLIER_FUSES, BLITZDIC_FUSES = b'101100011', b'011111011'


def restore_supplier_fuses(rdata):
    """Checks the packaged fuses and returns .rdata as Electron shipped it."""
    if rdata.count(FUSE_SENTINEL) != 1:
        raise SystemExit('Electron fuse wire not found exactly once')
    start = rdata.index(FUSE_SENTINEL) + len(FUSE_SENTINEL)
    if rdata[start:start + 2] != bytes([1, len(SUPPLIER_FUSES)]):
        raise SystemExit('Unexpected Electron fuse wire version or length')
    fuses = slice(start + 2, start + 2 + len(SUPPLIER_FUSES))
    if rdata[fuses] != BLITZDIC_FUSES:
        raise SystemExit(f'Packaged Electron fuses differ from electron-builder.yml: {rdata[fuses].decode()}')
    return rdata[:fuses.start] + SUPPLIER_FUSES + rdata[fuses.stop:]


verify_sources(base)
directory = (args.distribution or args.application).resolve()
if args.distribution:
    if (directory / 'version').read_text().strip() != manifest['version']:
        raise SystemExit('Electron version differs from the recorded source bundle')
    notices = [('LICENSE', manifest['notices'][0]), ('LICENSES.chromium.html', manifest['notices'][1])]
else:
    packaged = directory / 'resources/licenses/dependencies/native/electron-45.2.1'
    if (packaged / 'provenance.json').read_bytes() != (base / 'provenance.json').read_bytes():
        raise SystemExit('Packaged Electron provenance differs from the reviewed source manifest')
    verify_sources(packaged)
    notices = [(f'resources/licenses/dependencies/{item["path"]}', item) for item in manifest['notices']]
for relative, item in notices:
    verify_file(directory, relative, item['sha256'])
expected_dlls = {item['path'] for item in manifest['runtimeDlls']}
if {path.name for path in directory.glob('*.dll')} != expected_dlls:
    raise SystemExit('Unexpected Windows Electron runtime DLL set')
for item in manifest['runtimeDlls']:
    verify_file(directory, item['path'], item['sha256'])
executable = directory / ('electron.exe' if args.distribution else 'BlitzDic.exe')
with pefile.PE(str(executable)) as image:
    sections = {section.Name.decode().rstrip('\0'): section.get_data() for section in image.sections}
if args.application:
    sections['.rdata'] = restore_supplier_fuses(sections['.rdata'])
if manifest['excludedExecutableSections'] != ['.rsrc']:
    raise SystemExit('Only the application resource section may differ from the supplier')
if set(sections) != {item['name'] for item in manifest['executableSections']} | {'.rsrc'}:
    raise SystemExit('Unexpected executable section set')
for item in manifest['executableSections']:
    if hashlib.sha256(sections[item['name']]).hexdigest() != item['sha256']:
        raise SystemExit(f'Electron executable section changed: {item["name"]}')
print('PASS: six Electron DLLs, executable sections' + (' (fuses as configured)' if args.application else '')
      + ', original notices and matching source bundle')
