"""Record binary fingerprints and FFmpeg's own build/license reports.

This is evidence for dependency review, not a legal-compliance verdict or an
assertion that all installed native files are shipped by PyInstaller.
"""
import ctypes
import hashlib
import importlib.metadata as metadata
import json
from pathlib import Path
import sys

import av  # Initializes bundled DLL dependencies before querying exports.
import soundfile

root = Path(__file__).resolve().parents[1]
target = Path(sys.argv[1]).resolve()
if not target.is_relative_to(root / 'build'):
    raise SystemExit('Inventory output must stay in the project build directory')
if target.exists(): raise SystemExit('Inventory output exists; choose a new path')
site = Path(av.__file__).resolve().parent.parent
records = []
for source in sorted(site.rglob('*')):
    if source.is_file() and source.suffix.lower() in ('.dll', '.pyd'):
        records.append({'path': source.relative_to(site).as_posix(), 'bytes': source.stat().st_size,
                        'sha256': hashlib.sha256(source.read_bytes()).hexdigest()})
reports = []
for prefix in ['avcodec', 'avformat', 'avutil', 'avdevice', 'avfilter', 'swresample', 'swscale']:
    source = next((site / 'av.libs').glob(prefix + '-*.dll'))
    library = ctypes.CDLL(str(source))
    report = {'file': source.name}
    for suffix in ['license', 'configuration']:
        function = getattr(library, prefix + '_' + suffix)
        function.restype = ctypes.c_char_p
        report[suffix] = function().decode('utf-8')
    if prefix == 'avutil':
        library.av_version_info.restype = ctypes.c_char_p
        report['ffmpegVersion'] = library.av_version_info().decode('utf-8')
    reports.append(report)
inventory = {'scope': 'Installed project environment, before frozen-package filtering',
    'pyavVersion': av.__version__, 'soundfileVersion': metadata.version('soundfile'),
    'libsndfileVersion': soundfile.__libsndfile_version__, 'ffmpegReports': reports,
    'nativeBinaries': records,
    'reviewPending': ['Map actual packaged binary hashes to this inventory',
        'Establish exact upstream build/source revision for each native component',
        'Complete corresponding-source and third-party notices for redistribution']}
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(inventory, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'nativeFiles': len(records), 'ffmpegReports': len(reports),
                  'reportedLicenses': sorted({item['license'] for item in reports}),
                  'ffmpegVersion': next(item['ffmpegVersion'] for item in reports if 'ffmpegVersion' in item)}))
