"""Map frozen speech DLLs/extensions to the recorded installed-package hashes."""
import hashlib
import ast
import json
import os
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
inventory_path, package, output = [Path(value).resolve() for value in sys.argv[1:4]]
analysis_path = Path(sys.argv[4]).resolve() if len(sys.argv) > 4 else None
if not inventory_path.is_relative_to(root / 'build') or not output.is_relative_to(root / 'build'):
    raise SystemExit('Inventory and output must stay within project build directories')
if not package.is_relative_to(root / 'dist'):
    raise SystemExit('Package must stay within project dist directories')
if output.exists(): raise SystemExit('Output already exists')
origins = {}
if analysis_path:
    if not analysis_path.is_relative_to(root / 'build'):
        raise SystemExit('Analysis data must stay in project build directories')
    analysis = ast.literal_eval(analysis_path.read_text(encoding='utf-8'))
    for section in analysis:
        if not isinstance(section, (tuple, list)): continue
        for item in section:
            if isinstance(item, tuple) and len(item) == 3 and item[2] in ('BINARY', 'EXTENSION'):
                origins[item[0].replace('\\', '/')] = Path(item[1]).resolve()
inventory = json.loads(inventory_path.read_text(encoding='utf-8'))
lookup = {item['sha256']: item['path'] for item in inventory['nativeBinaries']}
records = []
for source in sorted(package.rglob('*')):
    if source.is_file() and source.suffix.lower() in ('.dll', '.pyd'):
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        relative = source.relative_to(package).as_posix()
        build_name = relative.removeprefix('_internal/')
        original = origins.get(build_name)
        origin = None
        if original and original.is_file():
            if original.is_relative_to(root):
                category, logical = 'project-environment', original.relative_to(root).as_posix()
            elif original.is_relative_to(Path(os.environ['SystemRoot'])):
                category, logical = 'windows-runtime', original.relative_to(Path(os.environ['SystemRoot'])).as_posix()
            else:
                category, logical = 'external-runtime', original.name
            origin = {'category': category, 'path': logical,
                      'sourceHashMatches': hashlib.sha256(original.read_bytes()).hexdigest() == digest}
        records.append({'path': relative, 'sha256': digest,
                        'installedPackageSource': lookup.get(digest), 'buildOrigin': origin})
missing = [record['path'] for record in records if not record['installedPackageSource']]
unresolved = [record['path'] for record in records if not record['buildOrigin'] or not record['buildOrigin']['sourceHashMatches']]
external = [record['path'] for record in records if record['buildOrigin'] and record['buildOrigin']['category'] == 'external-runtime']
result = {'scope': 'Actual frozen speech DLLs and extensions, excludes Electron executable/runtime',
          'files': records, 'unmatchedInstalledPackageFiles': missing,
          'unresolvedBuildOrigins': unresolved,
          'externalBuildOrigins': external,
          'reviewPending': ['Complete native component source and notice attribution; origin/hash matches do not establish redistribution rights']}
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'packagedNativeFiles': len(records), 'matchedPackageFiles': len(records) - len(missing),
                  'unmatchedRuntimeOrSystemFiles': len(missing), 'unresolvedBuildOrigins': len(unresolved),
                  'externalBuildOrigins': len(external)}))
if '--require-trusted-origins' in sys.argv[5:] and (external or unresolved):
    raise SystemExit('Frozen worker contains unresolved or external tool-runtime origins. Inspect the generated report.')
