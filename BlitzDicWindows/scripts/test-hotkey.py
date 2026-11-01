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
user32.ShowWindow.argtypes = [w.HWND, c.c_int]
print('ready', flush=True)
for command in sys.stdin:
    parts = command.split()
    if len(parts) != 3 or parts[0] != 'toggle' or not parts[1].isdigit() or parts[2] not in ('1', '2', '3', '4'):
        print('refused: expected target window and shortcut number', flush=True)
        continue
    expected = int(parts[1])
    if user32.GetForegroundWindow() != expected:
        user32.ShowWindow(expected, 9)
        user32.SetForegroundWindow(expected)
    window = user32.GetForegroundWindow()
    if window != int(parts[1]):
        print(f'refused: foreground window {window} differs from owned test window {parts[1]}', flush=True)
        continue
    keys = [0x11, 0x10, 0x30 + int(parts[2])]
    try:
        for key in keys:
            user32.keybd_event(key, 0, 0, 0)
        time.sleep(0.05)
    finally:
        for key in reversed(keys):
            user32.keybd_event(key, 0, 2, 0)
    print('sent', flush=True)
