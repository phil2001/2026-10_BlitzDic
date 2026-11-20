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


_speller = None


def prepare_spelling():
    """Starts the persistent spell checker (blitzdic-uia.exe --spell-service) ahead of use."""
    global _speller
    if _speller is None or _speller.poll() is not None:
        _speller = subprocess.Popen([str(helper()), '--spell-service'], stdin=subprocess.PIPE,
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, encoding='utf-8',
            creationflags=subprocess.CREATE_NO_WINDOW)
    return _speller


def misspelled(words, language):
    """Words the Windows spell checker reports as misspelled in every capitalization.

    The parent's timeout ends this process; the spell service then sees stdin close and ends too.
    """
    global _speller
    if (not isinstance(words, list) or len(words) > 5000 or
            not all(isinstance(word, str) and 0 < len(word) <= 100 for word in words)):
        raise ValueError('Ungültige Wortliste für die Rechtschreibprüfung.')
    try:
        speller = prepare_spelling()
        speller.stdin.write(json.dumps({'words': words, 'language': 'en' if language == 'en' else 'de'}) + '\n')
        speller.stdin.flush()
        result = json.loads(speller.stdout.readline())
    except Exception as error:
        if _speller is not None:
            _speller.kill()
            _speller = None
        raise RuntimeError('Windows-Rechtschreibprüfung nicht verfügbar.') from error
    if not isinstance(result, dict) or 'error' in result:
        raise RuntimeError('Windows-Rechtschreibprüfung nicht verfügbar.')
    return {'misspelled': result.get('misspelled', []), 'language': result.get('language')}


def insert(target, text):
    result = request('insert', signature=target.get('signature'), text=text)
    if not result.get('inserted'):
        result['reason'] = 'Feld, Text oder Auswahl geändert oder Zusatztaste gedrückt; Text bleibt in BlitzDic.'
    return result
