"""Conservative native Edit/RichEdit insertion without touching the clipboard.

Visual Basic 5/6 text boxes (for example in CGM PcPo) are Edit/RichEdit controls under
their own class names and use the same native path. Other controls use UI Automation
to verify focus, document fingerprint and selection. Password contents are never read;
document fingerprints are not persisted.
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
user32.IsWindowUnicode.argtypes = [w.HWND]
kernel32.GetACP.restype = w.UINT
user32.GetWindowLongW.argtypes = [w.HWND, c.c_int]
user32.GetWindowThreadProcessId.argtypes = [w.HWND, c.POINTER(w.DWORD)]
user32.SendMessageTimeoutW.argtypes = [w.HWND, w.UINT, c.c_size_t, c.c_ssize_t, w.UINT, w.UINT, c.POINTER(c.c_size_t)]
user32.SendMessageTimeoutW.restype = c.c_ssize_t

def message(hwnd, msg, wp=0, lp=0):
    result = c.c_size_t()
    if not user32.SendMessageTimeoutW(hwnd, msg, wp, lp, 2, 500, c.byref(result)):
        raise RuntimeError('Textfeld antwortet nicht oder verweigert den Zugriff.')
    return result.value

# Visual Basic TextBox and RichTextBox (RICHTX32.OCX) controls, and TX Text Control 34
# (word processing in CGM PcPo), which answers the same Edit messages. Only these named
# classes are added; any other unknown class keeps the UI Automation checks.
VB_TEXT_BOXES = ('thundertextbox', 'thunderrt5textbox', 'thunderrt6textbox')
VB_RICH_TEXT_BOXES = ('richtextwndclass', 'tx34')
# WM_GETTEXT returns CRLF paragraph breaks, but EM_GETSEL counts each one as one position.
CRLF_AS_ONE = ('tx34',)

def text_index(value, copied, position):
    """UTF-16 index in `value` of a selection position that counts each CRLF once."""
    units = c.cast(value, c.POINTER(c.c_uint16))
    index = 0
    while position > 0 and index < copied:
        index += 2 if index + 1 < copied and units[index] == 13 and units[index + 1] == 10 else 1
        position -= 1
    return index

def native_kind(class_name):
    """'edit' or 'richedit' for controls answering the standard Edit messages, else None."""
    if class_name == 'edit' or class_name in VB_TEXT_BOXES:
        return 'edit'
    if class_name.startswith('richedit') or class_name in VB_RICH_TEXT_BOXES:
        return 'richedit'
    return None

def representable(hwnd, text):
    """ANSI windows such as Visual Basic 6 fields receive text in the Windows code page."""
    if user32.IsWindowUnicode(hwnd):
        return True
    try:
        text.encode(f'cp{kernel32.GetACP()}')
    except LookupError:
        return text.isascii()
    except UnicodeEncodeError:
        return False
    return True

def capture(website=False, scope=None):
    capture.website_host = None
    capture.reason = 'Kein fokussiertes Windows-Eingabefeld.'
    if scope is not None:
        foreground = user32.GetForegroundWindow(); owner = w.DWORD()
        user32.GetWindowThreadProcessId(foreground, c.byref(owner))
        if (not isinstance(scope, dict) or type(scope.get('window')) is not int or
                type(scope.get('process')) is not int or not foreground or
                scope['window'] != foreground or scope['process'] != owner.value):
            capture.reason = 'Vordergrundfenster geändert.'
            return None
    info = GUI(); info.cbSize = c.sizeof(GUI)
    if not user32.GetGUIThreadInfo(0, c.byref(info)) or not info.hwndFocus:
        return None
    if scope is not None and (info.hwndActive != scope['window'] or
                              user32.GetForegroundWindow() != scope['window']):
        capture.reason = 'Vordergrundfenster geändert.'
        return None
    name = c.create_unicode_buffer(256)
    user32.GetClassNameW(info.hwndFocus, name, len(name))
    class_name = name.value.lower()
    def uia_fallback():
        from uia_target import capture as uia_capture
        target = uia_capture(website=website, scope=scope)
        capture.website_host = uia_capture.website_host
        capture.reason = uia_capture.reason
        return target
    kind = native_kind(class_name)
    if kind is None:
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
    if kind == 'richedit' and length >= 64000:
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
    first, last = start.value, end.value
    if class_name in CRLF_AS_ONE:
        first, last = (text_index(value, copied, position) for position in (first, last))
    return {'window': info.hwndActive, 'focus': info.hwndFocus, 'pid': pid.value,
            'thread': thread, 'class': class_name, 'start': start.value, 'end': end.value,
            'length': length, 'hash': fingerprint,
            # Selection offsets are UTF-16 units, not Python character offsets.
            # Bound context in IPC; never persist it or send it to a provider.
            'before': c.string_at(c.addressof(value) + max(0, first - 160) * 2,
                                  min(first, 160) * 2).decode('utf-16-le', errors='ignore'),
            'after': c.string_at(c.addressof(value) + last * 2,
                                 min(max(0, length - last), 160) * 2).decode('utf-16-le', errors='ignore')}

def insert(target, text):
    if target and target.get('kind') == 'uia':
        from uia_target import insert as uia_insert
        return uia_insert(target, text)
    if not target or user32.GetForegroundWindow() != target.get('window'):
        return {'inserted': False, 'reason': 'Eingabefeld oder Cursorposition geändert; Text bleibt in BlitzDic.'}
    owner = w.DWORD()
    user32.GetWindowThreadProcessId(target['window'], c.byref(owner))
    if capture(scope={'window': target['window'], 'process': owner.value}) != target:
        return {'inserted': False, 'reason': 'Eingabefeld oder Cursorposition geändert; Text bleibt in BlitzDic.'}
    if not isinstance(text, str) or '\x00' in text or len(text) > 100000:
        raise ValueError('Text kann nicht automatisch eingefügt werden.')
    if not representable(target['focus'], text):
        return {'inserted': False, 'reason': 'Der Text enthält Zeichen (z. B. Emojis), die dieses Programm '
                'nicht darstellen kann; Text bleibt in BlitzDic.'}
    value = c.create_unicode_buffer(text.replace('\r\n', '\n').replace('\n', '\r\n'))
    message(target['focus'], 0xC2, 1, c.addressof(value))  # EM_REPLACESEL, undoable
    return {'inserted': True}
