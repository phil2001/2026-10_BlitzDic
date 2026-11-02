"""Windows UI Automation bridge; system PowerShell/.NET, no optional installation."""
import json
import os
from pathlib import Path
import subprocess
import sys


def request(action, **args):
    executable = Path(os.environ['SystemRoot']) / 'System32/WindowsPowerShell/v1.0/powershell.exe'
    try:
        result = subprocess.run([str(executable), '-NoLogo', '-NoProfile', '-NonInteractive',
            '-ExecutionPolicy', 'Bypass', '-File', str(Path(__file__).with_suffix('.ps1'))],
            input=json.dumps({'action': action, **args}), capture_output=True, text=True,
            encoding='utf-8', timeout=4, creationflags=subprocess.CREATE_NO_WINDOW)
    except subprocess.TimeoutExpired as error:
        if os.environ.get('BLITZDIC_UIA_TRACE') == '1' and error.stderr:
            print(error.stderr.decode('utf-8', errors='replace') if isinstance(error.stderr, bytes) else error.stderr, file=sys.stderr)
        raise
    if os.environ.get('BLITZDIC_UIA_TRACE') == '1' and result.stderr:
        print(result.stderr, file=sys.stderr)
    if result.returncode:
        raise RuntimeError('Windows-UI-Automation konnte das Eingabefeld nicht zuverlässig bedienen.')
    return json.loads(result.stdout)


def capture(website=False, scope=None):
    result = request('capture', website=website, scope=scope)
    capture.website_host = result.get('websiteHost')
    capture.reason = result.get('reason', '')
    signature = result.get('signature')
    return {'kind': 'uia', 'signature': signature,
            'before': result.get('before'), 'after': result.get('after')} if signature else None


def insert(target, text):
    result = request('insert', signature=target.get('signature'), text=text)
    if not result.get('inserted'):
        result['reason'] = 'Feld, Text oder Auswahl geändert oder Zusatztaste gedrückt; Text bleibt in BlitzDic.'
    return result
