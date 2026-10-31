"""Interactive Windows test: opens its own Edit control, never edits another app.

Run from BlitzDicWindows with .runtime/venv/Scripts/python.exe scripts/verify-insertion.py.
Needs an interactive desktop where Windows permits foreground activation.
"""
import ctypes as c
from ctypes import wintypes as w
import json
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'speech'))
from windows_target import user32, message

user32.CreateWindowExW.argtypes = [w.DWORD, w.LPCWSTR, w.LPCWSTR, w.DWORD,
    c.c_int, c.c_int, c.c_int, c.c_int, w.HWND, w.HMENU, w.HINSTANCE, c.c_void_p]
user32.CreateWindowExW.restype = w.HWND
user32.SetForegroundWindow.argtypes = [w.HWND]
user32.SetFocus.argtypes = [w.HWND]
user32.DestroyWindow.argtypes = [w.HWND]
user32.GetWindowTextW.argtypes = [w.HWND, w.LPWSTR, c.c_int]
user32.PeekMessageW.argtypes = [c.POINTER(w.MSG), w.HWND, w.UINT, w.UINT, w.UINT]
user32.DispatchMessageW.argtypes = [c.POINTER(w.MSG)]
user32.DispatchMessageW.restype = c.c_ssize_t


def worker(request):
    process = subprocess.Popen([sys.executable, str(ROOT / 'speech/worker.py')],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    process.stdin.write(json.dumps(request))
    process.stdin.close()
    deadline = time.monotonic() + 10
    msg = w.MSG()
    while process.poll() is None:
        # Service cross-process EM_GETSEL/EM_REPLACESEL sent by the speech worker.
        while user32.PeekMessageW(c.byref(msg), None, 0, 0, 1):
            user32.TranslateMessage(c.byref(msg))
            user32.DispatchMessageW(c.byref(msg))
        if time.monotonic() > deadline:
            process.kill()
            process.wait()
            raise AssertionError('Insertion worker timed out')
        time.sleep(0.005)
    output = process.stdout.read()
    assert process.returncode == 0, (output, process.stderr.read())
    return json.loads(output)


parent = user32.CreateWindowExW(0, 'STATIC', 'BlitzDic insertion verification',
    0x10CF0000, 100, 100, 600, 200, None, None, None, None)
edit = user32.CreateWindowExW(0, 'EDIT', 'Before ', 0x50000000,
    10, 10, 500, 80, parent, None, None, None)
assert parent and edit
try:
    clipboard_sequence = user32.GetClipboardSequenceNumber()
    user32.SetForegroundWindow(parent)
    user32.SetFocus(edit)
    message(edit, 0xB1, 7, 7)
    target = worker({'action': 'capture-target'})['target']
    assert target and target['focus'] == edit, 'Windows did not foreground the test field'
    assert worker({'action': 'insert-text', 'target': target, 'text': 'Grüße! 🌍'})['inserted']
    value = c.create_unicode_buffer(100)
    user32.GetWindowTextW(edit, value, 100)
    assert value.value == 'Before Grüße! 🌍', repr(value.value)
    stale = worker({'action': 'capture-target'})['target']
    message(edit, 0xB1, 0, 0)
    assert not worker({'action': 'insert-text', 'target': stale, 'text': 'WRONG'})['inserted']
    message(edit, 0xB1, 0, 6)
    selected = worker({'action': 'capture-target'})['target']
    assert worker({'action': 'insert-text', 'target': selected, 'text': 'After'})['inserted']
    user32.GetWindowTextW(edit, value, 100)
    assert value.value == 'After Grüße! 🌍', repr(value.value)
    message(edit, 0xC7)  # EM_UNDO
    user32.GetWindowTextW(edit, value, 100)
    assert value.value == 'Before Grüße! 🌍', repr(value.value)
    message(edit, 0xB1, 0, 0)
    message(edit, 0xCC, ord('*'))  # EM_SETPASSWORDCHAR
    assert worker({'action': 'capture-target'})['target'] is None
    message(edit, 0xCC, 0)  # EM_SETPASSWORDCHAR
    message(edit, 0xCF, 1)  # EM_SETREADONLY
    assert worker({'action': 'capture-target'})['target'] is None
    assert user32.GetClipboardSequenceNumber() == clipboard_sequence, 'Clipboard changed during test'
    print('PASS: Unicode insertion, selection replacement, undo, cursor/password/read-only guards, unchanged clipboard')
finally:
    user32.DestroyWindow(parent)
