"""Conservative native Edit/RichEdit insertion without touching the clipboard.

Other controls use UI Automation to verify focus, document fingerprint and selection.
Password contents are never read; document fingerprints are not persisted.
"""
import ctypes as c
from ctypes import wintypes as w

user32 = c.WinDLL('user32', use_last_error=True)
class GUI(c.Structure):
    _fields_ = [('cbSize', w.DWORD), ('flags', w.DWORD), ('hwndActive', w.HWND),
                ('hwndFocus', w.HWND), ('hwndCapture', w.HWND), ('hwndMenuOwner', w.HWND),
                ('hwndMoveSize', w.HWND), ('hwndCaret', w.HWND), ('rcCaret', w.RECT)]
user32.GetGUIThreadInfo.argtypes = [w.DWORD, c.POINTER(GUI)]
user32.GetGUIThreadInfo.restype = w.BOOL
user32.GetClassNameW.argtypes = [w.HWND, w.LPWSTR, c.c_int]
user32.GetWindowLongW.argtypes = [w.HWND, c.c_int]
user32.GetWindowThreadProcessId.argtypes = [w.HWND, c.POINTER(w.DWORD)]
user32.SendMessageTimeoutW.argtypes = [w.HWND, w.UINT, c.c_size_t, c.c_ssize_t, w.UINT, w.UINT, c.POINTER(c.c_size_t)]
user32.SendMessageTimeoutW.restype = c.c_ssize_t

def message(hwnd, msg, wp=0, lp=0):
    result = c.c_size_t()
    if not user32.SendMessageTimeoutW(hwnd, msg, wp, lp, 2, 500, c.byref(result)):
        raise RuntimeError('Textfeld antwortet nicht oder verweigert den Zugriff.')
    return result.value

def capture():
    capture.reason = 'Kein fokussiertes Windows-Eingabefeld.'
    info = GUI(); info.cbSize = c.sizeof(GUI)
    if not user32.GetGUIThreadInfo(0, c.byref(info)) or not info.hwndFocus:
        return None
    name = c.create_unicode_buffer(256)
    user32.GetClassNameW(info.hwndFocus, name, len(name))
    class_name = name.value.lower()
    if class_name != 'edit' and not class_name.startswith('richedit'):
        from uia_target import capture as uia_capture
        target = uia_capture()
        capture.reason = uia_capture.reason
        return target
    style = user32.GetWindowLongW(info.hwndFocus, -16)
    if style & (0x20 | 0x800):  # ES_PASSWORD or ES_READONLY
        return None
    # Password character also covers controls that dynamically mask contents.
    if message(info.hwndFocus, 0xD2):
        return None
    start, end = w.DWORD(), w.DWORD()
    message(info.hwndFocus, 0xB0, c.addressof(start), c.addressof(end))
    pid = w.DWORD(); thread = user32.GetWindowThreadProcessId(info.hwndFocus, c.byref(pid))
    return {'window': info.hwndActive, 'focus': info.hwndFocus, 'pid': pid.value,
            'thread': thread, 'class': class_name, 'start': start.value, 'end': end.value}

def insert(target, text):
    if target and target.get('kind') == 'uia':
        from uia_target import insert as uia_insert
        return uia_insert(target, text)
    if not target or capture() != target:
        return {'inserted': False, 'reason': 'Eingabefeld oder Cursorposition geändert; Text bleibt in BlitzDic.'}
    if not isinstance(text, str) or '\x00' in text or len(text) > 100000:
        raise ValueError('Text kann nicht automatisch eingefügt werden.')
    value = c.create_unicode_buffer(text.replace('\r\n', '\n').replace('\n', '\r\n'))
    message(target['focus'], 0xC2, 1, c.addressof(value))  # EM_REPLACESEL, undoable
    return {'inserted': True}
