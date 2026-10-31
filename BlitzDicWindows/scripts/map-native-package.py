"""Map frozen speech DLLs/extensions to the recorded installed-package hashes."""
import hashlib
import json
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
inventory_path, package, output = [Path(value).resolve() for value in sys.argv[1:4]]
if not inventory_path.is_relative_to(root / 'build') or not output.is_relative_to(root / 'build'):
    raise SystemExit('Inventory and output must stay within project build directories')
if not package.is_relative_to(root / 'dist'):
    raise SystemExit('Package must stay within project dist directories')
if output.exists(): raise SystemExit('Output already exists')
inventory = json.loads(inventory_path.read_text(encoding='utf-8'))
lookup = {item['sha256']: item['path'] for item in inventory['nativeBinaries']}
records = []
for source in sorted(package.rglob('*')):
    if source.is_file() and source.suffix.lower() in ('.dll', '.pyd'):
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        records.append({'path': source.relative_to(package).as_posix(), 'sha256': digest,
                        'installedPackageSource': lookup.get(digest)})
missing = [record['path'] for record in records if not record['installedPackageSource']]
result = {'scope': 'Actual frozen speech DLLs and extensions, excludes Electron executable/runtime',
          'files': records, 'unmatchedInstalledPackageFiles': missing,
          'reviewPending': ['Resolve runtime/system binaries outside Python package inventory',
                            'Complete native component source and notice attribution']}
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'packagedNativeFiles': len(records), 'matchedPackageFiles': len(records) - len(missing),
                  'unmatchedRuntimeOrSystemFiles': len(missing)}))
