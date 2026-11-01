"""Read only the configured shortcut's current Windows key states.

No keyboard hook, text capture or synthetic input. A separate worker lives until
release (at most the recording limit); app shutdown terminates it.
"""
import ctypes as c
from ctypes import wintypes as w
import re
import time

user32 = c.WinDLL('user32', use_last_error=True)
user32.GetAsyncKeyState.argtypes = [c.c_int]
user32.GetAsyncKeyState.restype = c.c_short
user32.GetForegroundWindow.restype = w.HWND
user32.GetWindowThreadProcessId.argtypes = [w.HWND, c.POINTER(w.DWORD)]
user32.GetKeyboardLayout.argtypes = [w.DWORD]
user32.GetKeyboardLayout.restype = w.HANDLE
user32.VkKeyScanExW.argtypes = [w.WCHAR, w.HANDLE]
user32.VkKeyScanExW.restype = c.c_short

MODIFIERS = {'control': [0x11], 'ctrl': [0x11], 'commandorcontrol': [0x11],
             'cmdorctrl': [0x11], 'shift': [0x10], 'alt': [0x12],
             'altgr': [0xA5], 'super': [0x5B, 0x5C], 'meta': [0x5B, 0x5C]}
KEYS = {'space': 0x20, 'tab': 9, 'capslock': 0x14, 'numlock': 0x90, 'scrolllock': 0x91,
        'backspace': 8, 'delete': 0x2E, 'insert': 0x2D, 'return': 13, 'enter': 13,
        'up': 0x26, 'down': 0x28, 'left': 0x25, 'right': 0x27, 'home': 0x24,
        'end': 0x23, 'pageup': 0x21, 'pagedown': 0x22, 'escape': 0x1B, 'esc': 0x1B,
        'volumeup': 0xAF, 'volumedown': 0xAE, 'volumemute': 0xAD,
        'medianexttrack': 0xB0, 'mediaprevioustrack': 0xB1, 'mediastop': 0xB2,
        'mediaplaypause': 0xB3, 'printscreen': 0x2C, 'numdec': 0x6E,
        'numadd': 0x6B, 'numsub': 0x6D, 'nummult': 0x6A, 'numdiv': 0x6F}


def shortcut_keys(shortcut):
    if not isinstance(shortcut, str) or not shortcut or len(shortcut) > 150:
        raise ValueError('Ungültiges Kürzel für den Haltemodus.')
    parts = [part.strip().lower() for part in shortcut.split('+')]
    if not parts or any(not part for part in parts):
        raise ValueError('Haltemodus: Plus-Taste als „Plus“ angeben.')
    groups = []
    for part in parts[:-1]:
        if part not in MODIFIERS:
            raise ValueError('Haltemodus: Windows-Modifikatoren Control, Shift, Alt oder Super verwenden.')
        groups.append(MODIFIERS[part])
    key = parts[-1]
    if key in KEYS:
        code = KEYS[key]
    elif re.fullmatch(r'f(?:[1-9]|1\d|2[0-4])', key):
        code = 0x70 + int(key[1:]) - 1
    elif re.fullmatch(r'num[0-9]', key):
        code = 0x60 + int(key[-1])
    elif re.fullmatch(r'[a-z0-9]', key):
        code = ord(key.upper())
    else:
        if key == 'plus':
            key = '+'
        if len(key) != 1:
            raise ValueError('Haltemodus: nicht unterstützte Taste im Kürzel.')
        thread = user32.GetWindowThreadProcessId(user32.GetForegroundWindow(), None)
        code = user32.VkKeyScanExW(key, user32.GetKeyboardLayout(thread))
        if code == -1:
            raise ValueError('Taste auf der aktiven Windows-Tastaturbelegung nicht verfügbar.')
        code &= 0xFF
    groups.append([code])
    return groups


def wait_for_release(groups, down=None, clock=time.monotonic, pause=time.sleep, limit=1800):
    down = down or (lambda key: bool(user32.GetAsyncKeyState(key) & 0x8000))
    deadline = clock() + limit
    while all(any(down(key) for key in group) for group in groups):
        if clock() >= deadline:
            return {'released': False, 'timedOut': True}
        pause(0.01)
    return {'released': True, 'timedOut': False}


def run(request):
    if request['action'] == 'validate-hold-shortcuts':
        shortcuts = request.get('shortcuts')
        if not isinstance(shortcuts, list) or not 1 <= len(shortcuts) <= 4:
            raise ValueError('Ein bis vier Haltekürzel erforderlich.')
        for shortcut in shortcuts:
            shortcut_keys(shortcut)
        return {'valid': True}
    return wait_for_release(shortcut_keys(request.get('shortcut')))
