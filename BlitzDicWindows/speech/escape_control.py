"""Scoped Escape interception. Other keys are passed through and never recorded.

The hook thread only updates Escape state and enqueues small notifications. Pipe
I/O runs on other threads so a slow parent cannot stall Windows' keyboard hook.
No hook is installed while idle, except to finish an Escape key-up we own.
"""
import ctypes as c
from ctypes import wintypes as w
import json
import queue
import sys
import threading


class EscapeGate:
    def __init__(self):
        self.active = False
        self.owned = False
        self.down = False

    def arm(self, already_down=False):
        if not self.active and not self.owned:
            self.down = already_down
        self.active = True

    def disarm(self):
        self.active = False

    def key(self, virtual_key, down):
        if virtual_key != 0x1B:
            return False, False
        if down:
            emit = self.active and not self.down
            if emit:
                self.owned = True
            self.down = True
            return self.owned, emit
        consume = self.owned
        self.down = False
        self.owned = False
        return consume, False


def serve():
    user32 = c.WinDLL('user32', use_last_error=True)
    kernel32 = c.WinDLL('kernel32', use_last_error=True)
    result_type = c.c_ssize_t
    callback_type = c.WINFUNCTYPE(result_type, c.c_int, w.WPARAM, w.LPARAM)

    class Keyboard(c.Structure):
        _fields_ = [('vkCode', w.DWORD), ('scanCode', w.DWORD), ('flags', w.DWORD),
                    ('time', w.DWORD), ('dwExtraInfo', c.c_size_t)]

    user32.SetWindowsHookExW.argtypes = [c.c_int, callback_type, w.HINSTANCE, w.DWORD]
    user32.SetWindowsHookExW.restype = w.HANDLE
    user32.CallNextHookEx.argtypes = [w.HANDLE, c.c_int, w.WPARAM, w.LPARAM]
    user32.CallNextHookEx.restype = result_type
    user32.UnhookWindowsHookEx.argtypes = [w.HANDLE]
    user32.UnhookWindowsHookEx.restype = w.BOOL
    user32.GetMessageW.argtypes = [c.POINTER(w.MSG), w.HWND, w.UINT, w.UINT]
    user32.GetMessageW.restype = w.BOOL
    user32.PeekMessageW.argtypes = [c.POINTER(w.MSG), w.HWND, w.UINT, w.UINT, w.UINT]
    user32.PostThreadMessageW.argtypes = [w.DWORD, w.UINT, w.WPARAM, w.LPARAM]
    user32.PostThreadMessageW.restype = w.BOOL
    user32.GetAsyncKeyState.argtypes = [c.c_int]
    user32.GetAsyncKeyState.restype = c.c_short
    kernel32.GetCurrentThreadId.restype = w.DWORD
    kernel32.GetModuleHandleW.argtypes = [w.LPCWSTR]
    kernel32.GetModuleHandleW.restype = w.HMODULE
    thread = kernel32.GetCurrentThreadId()
    command_message = 0x8001
    messages = queue.Queue(maxsize=128)
    gate, hook, generation = EscapeGate(), None, 0

    def notify(value):
        try:
            messages.put_nowait(value)
        except queue.Full:
            user32.PostThreadMessageW(thread, 0x12, 0, 0)

    def writer():
        try:
            while True:
                value = messages.get()
                if value is None:
                    break
                print(json.dumps(value, ensure_ascii=True), flush=True)
        except (OSError, ValueError):
            user32.PostThreadMessageW(thread, 0x12, 0, 0)

    def reader():
        try:
            for line in sys.stdin:
                value = json.loads(line)
                if (set(value) != {'id', 'active'} or type(value['id']) is not int
                        or not 1 <= value['id'] < 2**31 or type(value['active']) is not bool):
                    break
                if not user32.PostThreadMessageW(thread, command_message, value['id'], int(value['active'])):
                    break
        except (OSError, ValueError, TypeError):
            pass
        finally:
            user32.PostThreadMessageW(thread, 0x12, 0, 0)

    @callback_type
    def callback(code, message, data):
        if code == 0 and message in (0x100, 0x101, 0x104, 0x105):
            key = c.cast(data, c.POINTER(Keyboard)).contents.vkCode
            consume, emit = gate.key(key, message in (0x100, 0x104))
            if emit:
                notify({'event': 'escape', 'id': generation})
            if consume:
                if not gate.active and not gate.owned:
                    # Remove the idle hook after consuming the matching key-up.
                    user32.PostThreadMessageW(thread, command_message, 0, 0)
                return 1
        return user32.CallNextHookEx(hook, code, message, data)

    msg = w.MSG()
    user32.PeekMessageW(c.byref(msg), None, 0, 0, 0)  # Create queue before the reader posts.
    output_thread = threading.Thread(target=writer, daemon=True)
    output_thread.start()
    threading.Thread(target=reader, daemon=True).start()
    notify({'event': 'ready'})
    try:
        while True:
            result = user32.GetMessageW(c.byref(msg), None, 0, 0)
            if result == 0:
                break
            if result == -1:
                raise c.WinError(c.get_last_error())
            if msg.message != command_message:
                continue
            identifier, active = int(msg.wParam), bool(msg.lParam)
            if identifier == 0:  # Cleanup request from our callback, never a client command.
                if not gate.active and not gate.owned and hook:
                    user32.UnhookWindowsHookEx(hook)
                    hook = None
                continue
            generation = identifier
            if active:
                gate.arm(bool(user32.GetAsyncKeyState(0x1B) & 0x8000))
                if not hook:
                    hook = user32.SetWindowsHookExW(13, callback, kernel32.GetModuleHandleW(None), 0)
                    if not hook:
                        raise c.WinError(c.get_last_error())
            else:
                gate.disarm()
                if hook and not gate.owned:
                    user32.UnhookWindowsHookEx(hook)
                    hook = None
            notify({'event': 'state', 'id': identifier, 'active': active})
    finally:
        if hook:
            user32.UnhookWindowsHookEx(hook)
        try:
            messages.put_nowait(None)
        except queue.Full:
            pass
        output_thread.join(timeout=2)

