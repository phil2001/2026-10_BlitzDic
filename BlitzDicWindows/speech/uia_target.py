"""Windows UI Automation bridge; system PowerShell/.NET, no optional installation."""
import json
import os
from pathlib import Path
import subprocess


def request(action, **args):
    executable = Path(os.environ['SystemRoot']) / 'System32/WindowsPowerShell/v1.0/powershell.exe'
    result = subprocess.run([str(executable), '-NoLogo', '-NoProfile', '-NonInteractive',
        '-ExecutionPolicy', 'Bypass', '-File', str(Path(__file__).with_suffix('.ps1'))],
        input=json.dumps({'action': action, **args}), capture_output=True, text=True,
        encoding='utf-8', timeout=4, creationflags=subprocess.CREATE_NO_WINDOW)
    if result.returncode:
        raise RuntimeError('Windows-UI-Automation konnte das Eingabefeld nicht zuverlässig bedienen.')
    return json.loads(result.stdout)


def capture():
    signature = request('capture').get('signature')
    return {'kind': 'uia', 'signature': signature} if signature else None


def insert(target, text):
    result = request('insert', signature=target.get('signature'), text=text)
    if not result.get('inserted'):
        result['reason'] = 'Feld, Text oder Auswahl geändert oder Zusatztaste gedrückt; Text bleibt in BlitzDic.'
    return result
