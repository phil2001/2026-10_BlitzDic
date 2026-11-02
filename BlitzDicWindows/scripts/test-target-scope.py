"""Exercise the real worker's early window guard without reading UI field data."""
import json
from pathlib import Path
import subprocess
import sys

worker = Path(__file__).resolve().parent.parent / 'speech' / 'worker.py'
sys.path.insert(0, str(worker.parent))
from windows_target import insert

assert insert({'window': 9223372036854775807}, 'must not be inserted')['inserted'] is False
for scope in ({'window': 9223372036854775807, 'process': 1}, {}, {'window': True, 'process': True}):
    result = subprocess.run([sys.executable, str(worker)],
                            input=json.dumps({'action': 'capture-target', 'website': True, 'scope': scope}),
                            capture_output=True, text=True, encoding='utf-8', timeout=8, check=True)
    payload = json.loads(result.stdout)
    assert payload['target'] is None
    assert payload['websiteHost'] is None
    assert payload['reason'] == 'Vordergrundfenster geändert.'
print('PASS: real worker rejects mismatched/malformed scopes before field capture.')
