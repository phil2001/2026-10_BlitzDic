"""Test helper: press a short key sequence only while the owned test window is in the foreground.

One line per command on stdin: "<window handle> <step> ...", where a step is a key name followed by
+ (down) or - (up), e.g. "123456 ctrl+ up+ up- 1+ 1- ctrl-". Keys still held at the end are released.
"""
import ctypes as c
from ctypes import wintypes as w
import sys
import time

user32 = c.WinDLL('user32', use_last_error=True)
user32.keybd_event.argtypes = [c.c_ubyte, c.c_ubyte, c.c_uint, c.c_size_t]
user32.GetForegroundWindow.restype = w.HWND
user32.SetForegroundWindow.argtypes = [w.HWND]
user32.GetAsyncKeyState.argtypes = [c.c_int]
user32.GetAsyncKeyState.restype = c.c_short
KEYS = {'ctrl': 0x11, 'shift': 0x10, 'alt': 0x12, 'up': 0x26, 'down': 0x28, 'space': 0x20,
        'back': 0x08, 'esc': 0x1B, 'f9': 0x78}
KEYS.update({str(n): 0x30 + n for n in range(10)})
KEYS.update({chr(n).lower(): n for n in range(0x41, 0x5B)})
MODIFIERS = (0x10, 0x11, 0x12, 0x5B, 0x5C)

print('ready', flush=True)
for line in sys.stdin:
    handle, *steps = line.split()
    if not handle.isdigit() or not steps or any(step[:-1] not in KEYS or step[-1] not in '+-' for step in steps):
        print('refused: expected window handle and key steps', flush=True); continue
    expected = int(handle)
    if user32.GetForegroundWindow() != expected:
        user32.SetForegroundWindow(expected)
        deadline = time.monotonic() + .5
        while user32.GetForegroundWindow() != expected and time.monotonic() < deadline:
            time.sleep(.01)
    if user32.GetForegroundWindow() != expected:
        print('refused: the owned test window is not in the foreground', flush=True); continue
    if any(user32.GetAsyncKeyState(key) & 0x8000 for key in MODIFIERS):
        print('refused: a modifier key is pressed outside this helper', flush=True); continue
    held = []
    try:
        for step in steps:
            key = KEYS[step[:-1]]
            if step[-1] == '+':
                user32.keybd_event(key, 0, 0, 0); held.append(key)
            else:
                user32.keybd_event(key, 0, 2, 0)
                if key in held: held.remove(key)
            time.sleep(.06)
    finally:
        for key in reversed(held):
            user32.keybd_event(key, 0, 2, 0)
    print('sent', flush=True)
