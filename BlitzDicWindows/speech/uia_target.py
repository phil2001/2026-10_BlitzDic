"""Windows UI Automation bridge: blitzdic-uia.exe, compiled from uia_target.cs.

The helper is built once (scripts/build-uia.ps1) with the .NET Framework compiler
included in Windows. Starting PowerShell and compiling C# for every capture and
insertion took over a second each, even on a fast PC.
"""
import json
import os
from pathlib import Path
import subprocess
import sys


def helper():
    executable = Path(__file__).with_name('blitzdic-uia.exe')
    if not executable.is_file():
        raise RuntimeError('UIA-Hilfsprogramm fehlt. Bitte scripts/build-uia.ps1 ausführen.')
    return executable


def request(action, **args):
    try:
        result = subprocess.run([str(helper())],
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
