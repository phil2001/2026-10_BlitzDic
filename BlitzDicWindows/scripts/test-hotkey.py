"""Press only the app's default dictation shortcut during the interactive test."""
import ctypes as c
import time
import sys
user32 = c.WinDLL('user32', use_last_error=True)
user32.keybd_event.argtypes = [c.c_ubyte, c.c_ubyte, c.c_uint, c.c_size_t]
keys = [0x11, 0x10, 0x31]
print('ready', flush=True)
for command in sys.stdin:
    if command.strip() != 'toggle':
        continue
    try:
        for key in keys:
            user32.keybd_event(key, 0, 0, 0)
        time.sleep(0.05)
    finally:
        for key in reversed(keys):
            user32.keybd_event(key, 0, 2, 0)
    print('sent', flush=True)
