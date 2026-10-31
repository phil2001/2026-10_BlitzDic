"""Bind CTranslate2's OpenMP DLL to Intel's SHA-pinned distribution and notice.

The recorded license is preserved verbatim. Matching bytes and collecting a
notice do not by themselves establish every redistribution requirement.
"""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
WHEEL_SHA = '8ff899d01a41b92ffe0e618b221ea633127d16df726086082d381c431c31339d'
URL = 'https://files.pythonhosted.org/packages/79/69/05addedd727061b61a85b4fd989754edb628b5be1cd5d161727f98cf4d86/intel_openmp-2025.3.0-py2.py3-none-win_amd64.whl'


def sha(data): return hashlib.sha256(data).hexdigest()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    target = args.output.resolve()
    if not target.is_relative_to(ROOT) or target.exists():
        raise SystemExit('Choose a new output directory inside BlitzDicWindows')
    wheel = ROOT / '.runtime/native-provenance/intel_openmp-2025.3.0-py2.py3-none-win_amd64.whl'
    if sha(wheel.read_bytes()) != WHEEL_SHA:
        raise SystemExit('Intel archive does not match the published PyPI hash')
    with zipfile.ZipFile(wheel) as archive:
        binary = archive.read('intel_openmp-2025.3.0.data/data/Library/bin/libiomp5md.dll')
        notice = archive.read('intel_openmp-2025.3.0.dist-info/LICENSE.txt')
    installed = ROOT / '.runtime/venv/Lib/site-packages/ctranslate2/libiomp5md.dll'
    if binary != installed.read_bytes():
        raise SystemExit('Installed OpenMP library differs from the pinned Intel package')
    target.mkdir(parents=True)
    (target / 'Intel-EULA-August-2024.txt').write_bytes(notice)
    report = {'component': 'libiomp5md.dll', 'supplierPackage': 'intel-openmp==2025.3.0',
              'supplierUrl': URL, 'supplierSha256': WHEEL_SHA, 'dllSha256': sha(binary),
              'installedPackage': 'ctranslate2==4.8.4', 'identicalBytes': True,
              'notice': {'file': 'Intel-EULA-August-2024.txt', 'sha256': sha(notice), 'encoding': 'Windows-1252'},
              'licenseTitle': 'Intel End User License Agreement for Developer Tools (Version August 2024)',
              'scope': 'OpenMP DLL only; not all statically linked CTranslate2 components',
              'reviewPending': ['Verify the exact redistribution conditions and designation of redistributables.',
                                'Review statically linked oneMKL and oneDNN components separately.']}
    (target / 'provenance.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'identicalBytes': True, 'dllSha256': report['dllSha256'], 'noticeCollected': True}))
