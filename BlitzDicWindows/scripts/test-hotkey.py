"""Press a dictation shortcut only while the exact owned test window is foreground."""
import ctypes as c
from ctypes import wintypes as w
import time
import sys
user32 = c.WinDLL('user32', use_last_error=True)
user32.keybd_event.argtypes = [c.c_ubyte, c.c_ubyte, c.c_uint, c.c_size_t]
user32.GetForegroundWindow.restype = w.HWND
user32.SetForegroundWindow.argtypes = [w.HWND]
user32.SetForegroundWindow.restype = w.BOOL
user32.GetAsyncKeyState.argtypes = [c.c_int]
user32.GetAsyncKeyState.restype = c.c_short
held = []
def release():
    for key in reversed(held):
        user32.keybd_event(key, 0, 2, 0)
    held.clear()
print('ready', flush=True)
try:
  for command in sys.stdin:
    parts = command.split()
    if len(parts) != 3 or parts[0] not in ('toggle', 'down', 'up') or not parts[1].isdigit() or parts[2] not in ('1', '2', '3', '4'):
        print('refused: expected action, target window and shortcut number', flush=True); continue
    # Always release our own injected keys, even if focus changed during a test.
    if parts[0] == 'up':
        release(); print('sent', flush=True); continue
    if held:
        print('refused: test keys already held', flush=True); continue
    expected = int(parts[1])
    if user32.GetForegroundWindow() != expected:
        # The helper starts hidden. Its first ShowWindow call would inherit
        # SW_HIDE from STARTUPINFO and can hide the *target* test window.
        # The Electron fixture already shows it; request activation only.
        user32.SetForegroundWindow(expected)
        deadline = time.monotonic() + .5
        while user32.GetForegroundWindow() != expected and time.monotonic() < deadline:
            time.sleep(.01)
    window = user32.GetForegroundWindow()
    if window != expected:
        print(f'refused: foreground window {window} differs from owned test window {parts[1]}', flush=True); continue
    keys = [0x11, 0x10, 0x30 + int(parts[2])]
    if any(user32.GetAsyncKeyState(key) & 0x8000 for key in keys):
        print('refused: shortcut keys already pressed outside this helper', flush=True); continue
    try:
        for key in keys:
            user32.keybd_event(key, 0, 0, 0); held.append(key)
        time.sleep(0.05)
        if parts[0] == 'toggle': release()
    except BaseException:
        release(); raise
    print('sent', flush=True)
finally:
    release()
