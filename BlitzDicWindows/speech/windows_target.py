"""Conservative native Edit/RichEdit insertion without touching the clipboard.

Other controls use UI Automation to verify focus, document fingerprint and selection.
Password contents are never read; document fingerprints are not persisted.
"""
import ctypes as c
from ctypes import wintypes as w
import hashlib
from pathlib import PureWindowsPath

user32 = c.WinDLL('user32', use_last_error=True)
kernel32 = c.WinDLL('kernel32', use_last_error=True)
user32.GetForegroundWindow.restype = w.HWND
kernel32.OpenProcess.argtypes = [w.DWORD, w.BOOL, w.DWORD]
kernel32.OpenProcess.restype = w.HANDLE
kernel32.QueryFullProcessImageNameW.argtypes = [w.HANDLE, w.DWORD, w.LPWSTR, c.POINTER(w.DWORD)]
kernel32.CloseHandle.argtypes = [w.HANDLE]

def foreground_app():
    window = user32.GetForegroundWindow()
    pid = w.DWORD()
    user32.GetWindowThreadProcessId(window, c.byref(pid))
    process = kernel32.OpenProcess(0x1000, False, pid.value)
    if not process:
        return ''
    try:
        size = w.DWORD(32768); path = c.create_unicode_buffer(size.value)
        if not kernel32.QueryFullProcessImageNameW(process, 0, path, c.byref(size)):
            return ''
        return PureWindowsPath(path.value).name.lower() if user32.GetForegroundWindow() == window else ''
    finally:
        kernel32.CloseHandle(process)

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
    def uia_fallback():
        from uia_target import capture as uia_capture
        target = uia_capture()
        capture.reason = uia_capture.reason
        return target
    if class_name != 'edit' and not class_name.startswith('richedit'):
        return uia_fallback()
    style = user32.GetWindowLongW(info.hwndFocus, -16)
    if style & (0x20 | 0x800):  # ES_PASSWORD or ES_READONLY
        return None
    # Password character also covers controls that dynamically mask contents.
    if message(info.hwndFocus, 0xD2):
        return None
    start, end = w.DWORD(), w.DWORD()
    message(info.hwndFocus, 0xB0, c.addressof(start), c.addressof(end))
    length = message(info.hwndFocus, 0xE)  # WM_GETTEXTLENGTH, UTF-16 units
    # WM_GETTEXT is documented only up to 64K for RichEdit. Larger rich
    # documents use TextPattern rather than a partial native fingerprint.
    if class_name.startswith('richedit') and length >= 64000:
        return uia_fallback()
    if length > 1000000:
        capture.reason = 'Dokument zu groß für sicheres automatisches Einfügen.'
        return None
    value = c.create_unicode_buffer(length + 1)
    copied = message(info.hwndFocus, 0xD, length + 1, c.addressof(value))
    if copied != length or message(info.hwndFocus, 0xE) != length:
        capture.reason = 'Dokument während Zielerfassung geändert oder nicht vollständig lesbar.'
        return None
    if not 0 <= start.value <= end.value <= copied:
        capture.reason = 'Textauswahl außerhalb des vollständig gelesenen Dokuments.'
        return None
    fingerprint = hashlib.sha256(c.string_at(c.addressof(value), copied * 2)).hexdigest()
    current = GUI(); current.cbSize = c.sizeof(GUI)
    selected_start, selected_end = w.DWORD(), w.DWORD()
    message(info.hwndFocus, 0xB0, c.addressof(selected_start), c.addressof(selected_end))
    if (not user32.GetGUIThreadInfo(0, c.byref(current)) or
            current.hwndActive != info.hwndActive or current.hwndFocus != info.hwndFocus or
            (selected_start.value, selected_end.value) != (start.value, end.value)):
        capture.reason = 'Fokus oder Auswahl während Zielerfassung geändert.'
        return None
    pid = w.DWORD(); thread = user32.GetWindowThreadProcessId(info.hwndFocus, c.byref(pid))
    return {'window': info.hwndActive, 'focus': info.hwndFocus, 'pid': pid.value,
            'thread': thread, 'class': class_name, 'start': start.value, 'end': end.value,
            'length': length, 'hash': fingerprint,
            # Selection offsets are UTF-16 units, not Python character offsets.
            # Bound context in IPC; never persist it or send it to a provider.
            'before': c.string_at(c.addressof(value) + max(0, start.value - 160) * 2,
                                  min(start.value, 160) * 2).decode('utf-16-le', errors='ignore'),
            'after': c.string_at(c.addressof(value) + end.value * 2,
                                 min(max(0, length - end.value), 160) * 2).decode('utf-16-le', errors='ignore')}

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
