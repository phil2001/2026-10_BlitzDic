"""Observe only the browser PID/title owned by the test; never synthesize input."""
import ctypes as c
from ctypes import wintypes as w
import json
import sys
import time

pid, title, mode, seconds = int(sys.argv[1]), sys.argv[2], sys.argv[3], float(sys.argv[4])
if mode not in ('observe', 'request') or not 0 <= seconds <= 1800:
    raise ValueError('Invalid owned-window query')
user32 = c.WinDLL('user32', use_last_error=True)
user32.GetForegroundWindow.restype = w.HWND
user32.SetForegroundWindow.argtypes = [w.HWND]
user32.IsWindowVisible.argtypes = [w.HWND]
user32.GetWindowThreadProcessId.argtypes = [w.HWND, c.POINTER(w.DWORD)]
user32.GetWindowTextW.argtypes = [w.HWND, w.LPWSTR, c.c_int]


def owned(hwnd):
    owner = w.DWORD()
    user32.GetWindowThreadProcessId(hwnd, c.byref(owner))
    name = c.create_unicode_buffer(512)
    user32.GetWindowTextW(hwnd, name, len(name))
    return owner.value == pid and user32.IsWindowVisible(hwnd) and title in name.value


windows = []


@c.WINFUNCTYPE(w.BOOL, w.HWND, w.LPARAM)
def visit(hwnd, _):
    if owned(hwnd):
        windows.append(int(hwnd))
    return True


user32.EnumWindows.argtypes = [type(visit), w.LPARAM]
user32.EnumWindows(visit, 0)
if len(windows) == 1:
    hwnd = windows[0]
    if mode == 'request' and user32.GetForegroundWindow() != hwnd:
        user32.SetForegroundWindow(hwnd)  # Normal request; no focus-lock workaround.
    deadline = time.monotonic() + seconds
    while owned(hwnd) and user32.GetForegroundWindow() != hwnd and time.monotonic() < deadline:
        time.sleep(.05)
    if not owned(hwnd):
        windows = []
print(json.dumps({'windows': windows,
                  'foreground': len(windows) == 1 and user32.GetForegroundWindow() == windows[0]}))
