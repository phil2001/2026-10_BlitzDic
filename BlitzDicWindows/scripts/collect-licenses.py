"""Collect installed dependency notices without modifying the environment.

The manifest records missing notices explicitly; collection alone is not a
complete review of the native libraries embedded in wheels.
"""
import hashlib
import importlib.metadata as metadata
import json
from pathlib import Path
import shutil
import sys

root = Path(__file__).resolve().parents[1]
output = Path(sys.argv[1]).resolve()
if not output.is_relative_to(root / 'build'):
    raise SystemExit('License output must be within the project build directory')
output.mkdir(parents=True, exist_ok=False)
manifest = {'packages': [], 'missingPackageNotices': [],
    'reviewPending': ['Remaining native CPU/numerical and platform-runtime redistribution obligations, including static components']}
supplemental_root = root / 'licenses/upstream'
supplemental = json.loads((supplemental_root / 'sources.json').read_text(encoding='utf-8'))
for dist in sorted(metadata.distributions(), key=lambda item: item.metadata['Name'].lower()):
    name, version = dist.metadata['Name'], dist.version
    folder = output / 'python-packages' / f'{name}-{version}'
    folder.mkdir(parents=True)
    (folder / 'METADATA.txt').write_text(dist.read_text('METADATA') or '', encoding='utf-8')
    files = []
    for item in dist.files or []:
        path = Path(str(item))
        # Include all files in a licenses directory, but not Python source from
        # similarly named runtime modules such as packaging/licenses.
        notice = any(word in path.name.lower() for word in ('license', 'licence', 'copying', 'notice'))
        license_directory = any(part.lower() == 'licenses' for part in path.parts) and '.dist-info' in str(path)
        if not (notice or license_directory) or path.suffix.lower() in ('.py', '.pyc', '.pyd'):
            continue
        source = Path(dist.locate_file(item)).resolve()
        if not source.is_file():
            continue
        relative = Path(*[part for part in path.parts if part not in ('..', '.')])
        destination = folder / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)
        files.append({'path': str(destination.relative_to(output)),
                      'sha256': hashlib.sha256(source.read_bytes()).hexdigest()})
    for notice in supplemental:
        if notice['name'].lower() != name.lower() or notice['version'] != version:
            continue
        source = supplemental_root / notice['file']
        destination = folder / source.name
        shutil.copyfile(source, destination)
        files.append({'path': str(destination.relative_to(output)), 'source': notice['url'],
                      'sha256': hashlib.sha256(source.read_bytes()).hexdigest()})
    if not files:
        manifest['missingPackageNotices'].append(f'{name}=={version}')
    manifest['packages'].append({'name': name, 'version': version, 'files': files})

extras = {
    root.parent / 'LICENSE': 'BlitzDic-LICENSE.txt',
    root.parent / 'THIRD_PARTY_NOTICES.md': 'THIRD_PARTY_NOTICES.md',
    root / 'speech/README.md': 'Speech-model-attribution.md',
    Path(sys.base_prefix) / 'LICENSE.txt': 'Python-LICENSE.txt',
    root / 'node_modules/electron/dist/LICENSE': 'Electron-LICENSE.txt',
    root / 'node_modules/electron/dist/LICENSES.chromium.html': 'Chromium-LICENSES.html',
}
for source, filename in extras.items():
    if not source.is_file():
        raise SystemExit(f'Required notice missing: {source}')
    shutil.copyfile(source, output / filename)
shutil.copytree(root / 'licenses/native', output / 'native')
(output / 'inventory.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print(json.dumps({'collectedPackages': len(manifest['packages']),
                  'missingPackageNotices': manifest['missingPackageNotices'],
                  'reviewPending': manifest['reviewPending']}))
