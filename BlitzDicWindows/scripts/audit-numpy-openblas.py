"""Verify the NumPy OpenBLAS DLL against its SHA-pinned supplier wheel."""
import argparse
import hashlib
import importlib.metadata as metadata
import json
from pathlib import Path
import zipfile
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SUPPLIER_SHA = 'ea34bf76b8427ac2eca7a99334cbd8937a040303fa8364f9ed8e667d7c8e2c7d'
SUPPLIER_URL = 'https://files.pythonhosted.org/packages/0c/17/ffc91653b566011d7c790116759266ec0a588fdd0e2f839d0343f3f79e0e/scipy_openblas64-0.3.34.106.0-py3-none-win_amd64.whl'


def sha(data): return hashlib.sha256(data).hexdigest()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    output = args.output.resolve()
    if not output.is_relative_to(ROOT) or output.exists():
        raise SystemExit('Output must be a new directory inside BlitzDicWindows')
    if np.__version__ != '2.5.4':
        raise SystemExit('This supplier comparison is pinned to NumPy 2.5.4')
    source = ROOT / '.runtime/native-provenance/scipy_openblas64-0.3.34.106.0-py3-none-win_amd64.whl'
    if sha(source.read_bytes()) != SUPPLIER_SHA:
        raise SystemExit('Supplier archive hash differs from the published PyPI hash')
    with zipfile.ZipFile(source) as archive:
        original = archive.read('scipy_openblas64/lib/libscipy_openblas64_.dll')
        notice = archive.read('scipy_openblas64-0.3.34.106.0.dist-info/licenses/LICENSE.txt')
    installed = next((Path(np.__file__).resolve().parent.parent / 'numpy.libs').glob('libscipy_openblas64_*.dll'))
    if original != installed.read_bytes():
        raise SystemExit('Installed OpenBLAS DLL differs from the pinned supplier')
    config = np.show_config(mode='dicts')
    dist = metadata.distribution('numpy')
    numpy_notice = dist.read_text('licenses/LICENSE.txt')
    if not numpy_notice or not all(name in numpy_notice for name in ('OpenBLAS', 'LAPACK')):
        raise SystemExit('NumPy bundled-component license declarations missing')
    output.mkdir(parents=True)
    (output / 'SUPPLIER-LICENSE.txt').write_bytes(notice)
    report = {'installedPackage': 'numpy==2.5.4', 'supplierPackage': 'scipy-openblas64==0.3.34.106.0',
              'supplierUrl': SUPPLIER_URL, 'supplierSha256': SUPPLIER_SHA,
              'dll': installed.name, 'dllSha256': sha(original), 'identicalBytes': True,
              'supplierNotice': {'file': 'SUPPLIER-LICENSE.txt', 'sha256': sha(notice)},
              'blas': config['Build Dependencies']['blas'], 'simd': config['SIMD Extensions'],
              'numpyNoticeIncludesOpenblasAndLapack': True,
              'scope': 'OpenBLAS DLL identity and supplier notices; not every NumPy runtime component',
              'reviewPending': ['Complete Microsoft-runtime and application-wide redistribution review.']}
    (output / 'provenance.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'identicalBytes': True, 'dllSha256': sha(original), 'simdBaseline': report['simd']['baseline']}))
