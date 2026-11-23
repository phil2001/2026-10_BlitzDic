"""Interactive Windows test for Visual Basic 6 text fields (as used by CGM PcPo).

Opens its own windows, never edits another app. A small host process builds them like
VB6 controls: ANSI superclasses of the Windows Edit control (ThunderRT6TextBox) and of
RichEdit 1.0 (RichTextWndClass, the VB6 RichTextBox). The host runs once as a 64-bit
and once as a 32-bit process; PcPo is 32-bit while the speech worker is 64-bit.

Run from BlitzDicWindows with .runtime/venv/Scripts/python.exe scripts/verify-vb6-insertion.py.
Needs an interactive desktop where Windows permits foreground activation.
"""
import ctypes as c
from ctypes import wintypes as w
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'speech'))
from windows_target import user32, message, native_kind, representable, text_index, GUI

user32.AllowSetForegroundWindow.argtypes = [w.DWORD]
user32.PostThreadMessageW.argtypes = [w.DWORD, w.UINT, w.WPARAM, w.LPARAM]

SAMPLE = 'Grüße „Befund“ – 5 µg'
FOCUS = 0x8001  # WM_APP + 1, posted to the host thread: focus the field in wParam.

# Host: VB6-style ANSI fields in their own process; ends after 120 s or when killed.
HOST = r'''
$code = @"
using System; using System.Runtime.InteropServices;
public static class Vb6Host {
  [StructLayout(LayoutKind.Sequential)] public struct WCA { public uint cbSize, style; public IntPtr proc; public int cls, wnd; public IntPtr inst, icon, cursor, brush, menu, name, sm; }
  [StructLayout(LayoutKind.Sequential)] public struct MSG { public IntPtr hwnd; public uint message; public IntPtr wParam, lParam; public uint time; public int x, y; }
  [DllImport("user32.dll", CharSet=CharSet.Ansi)] static extern bool GetClassInfoExA(IntPtr i, string n, ref WCA w);
  [DllImport("user32.dll")] static extern ushort RegisterClassExA(ref WCA w);
  [DllImport("user32.dll", CharSet=CharSet.Ansi)] static extern IntPtr CreateWindowExA(uint ex, string c, string t, uint s, int x, int y, int w, int h, IntPtr p, IntPtr m, IntPtr i, IntPtr l);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern IntPtr CreateWindowExW(uint ex, string c, string t, uint s, int x, int y, int w, int h, IntPtr p, IntPtr m, IntPtr i, IntPtr l);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, IntPtr pid);
  [DllImport("user32.dll")] static extern bool AttachThreadInput(uint a, uint b, bool attach);
  [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
  // Windows only lets the foreground thread hand over the foreground; join its input briefly.
  static void Front(IntPtr parent) {
    uint me = GetCurrentThreadId(), owner = GetWindowThreadProcessId(GetForegroundWindow(), IntPtr.Zero);
    bool attached = owner != 0 && owner != me && AttachThreadInput(me, owner, true);
    SetForegroundWindow(parent);
    if (attached) AttachThreadInput(me, owner, false);
  }
  [DllImport("user32.dll")] static extern IntPtr SetFocus(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsWindowUnicode(IntPtr h);
  [DllImport("user32.dll")] static extern IntPtr SetTimer(IntPtr h, IntPtr id, uint ms, IntPtr f);
  [DllImport("user32.dll")] static extern int GetMessageW(out MSG m, IntPtr h, uint a, uint b);
  [DllImport("user32.dll")] static extern bool TranslateMessage(ref MSG m);
  [DllImport("user32.dll")] static extern IntPtr DispatchMessageW(ref MSG m);
  [DllImport("user32.dll")] static extern bool DestroyWindow(IntPtr h);
  [DllImport("kernel32.dll")] static extern IntPtr GetModuleHandleW(IntPtr n);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode)] static extern IntPtr LoadLibraryW(string n);
  static void Superclass(string from, string name) {
    var w = new WCA(); w.cbSize = (uint)Marshal.SizeOf(typeof(WCA));
    if (!GetClassInfoExA(IntPtr.Zero, from, ref w)) throw new Exception(from + " class unavailable");
    w.name = Marshal.StringToHGlobalAnsi(name); w.inst = GetModuleHandleW(IntPtr.Zero); w.menu = IntPtr.Zero;
    if (RegisterClassExA(ref w) == 0) throw new Exception(name + " not registered");
  }
  static string Charset(IntPtr h) { return IsWindowUnicode(h) ? "unicode" : "ansi"; }
  public static void Run() {
    if (LoadLibraryW("riched32.dll") == IntPtr.Zero) throw new Exception("riched32.dll unavailable");
    Superclass("EDIT", "ThunderRT6TextBox");
    Superclass("RICHEDIT", "RichTextWndClass");
    IntPtr parent = CreateWindowExW(0, "STATIC", "BlitzDic VB6 verification", 0x10CF0000, 100, 100, 600, 260, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero);
    IntPtr box = CreateWindowExA(0, "ThunderRT6TextBox", "Vorher ", 0x50000000, 10, 10, 500, 30, parent, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero);
    IntPtr lines = CreateWindowExA(0, "ThunderRT6TextBox", "Erste\r\nZweite", 0x50000004, 10, 50, 500, 60, parent, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero);
    IntPtr rich = CreateWindowExA(0, "RichTextWndClass", "Vorher ", 0x50000004, 10, 120, 500, 60, parent, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero);
    Front(parent); SetFocus(box);
    Console.WriteLine(String.Join(" ", new string[] { parent.ToInt64().ToString(), box.ToInt64().ToString(),
      lines.ToInt64().ToString(), rich.ToInt64().ToString(), (IntPtr.Size * 8).ToString(), Charset(box), Charset(rich) }));
    Console.Out.Flush();
    SetTimer(IntPtr.Zero, IntPtr.Zero, 120000, IntPtr.Zero);
    MSG m;
    while (GetMessageW(out m, IntPtr.Zero, 0, 0) > 0) {
      if (m.hwnd == IntPtr.Zero && m.message == 0x113) break;  // WM_TIMER: test time is over.
      if (m.hwnd == IntPtr.Zero && m.message == 0x8001) { Front(parent); SetFocus(m.wParam); continue; }
      TranslateMessage(ref m); DispatchMessageW(ref m);
    }
    DestroyWindow(parent);
  }
}
"@
Add-Type -TypeDefinition $code
[Vb6Host]::Run()
'''


class TargetService:
    """The persistent capture/insert helper BlitzDic keeps running (worker.py --target-service).

    It answers within milliseconds, so another window taking the foreground shortly after
    the test window was activated does not race a worker start.
    """
    def __init__(self):
        command = ([os.environ['BLITZDIC_TEST_SPEECH_EXECUTABLE']] if os.environ.get('BLITZDIC_TEST_SPEECH_EXECUTABLE')
                   else [sys.executable, str(ROOT / 'speech/worker.py')]) + ['--target-service']
        # No console window: like in BlitzDic, the helper must not take the foreground.
        self.process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL, text=True, encoding='utf-8', creationflags=subprocess.CREATE_NO_WINDOW)
        assert json.loads(self.process.stdout.readline()) == {'event': 'ready'}
        self.id = 0

    def request(self, request):
        self.id += 1
        self.process.stdin.write(json.dumps({'id': self.id, 'request': request}, ensure_ascii=False) + '\n')
        self.process.stdin.flush()
        answer = json.loads(self.process.stdout.readline())
        assert answer.get('id') == self.id and 'error' not in answer, answer
        return answer['result']

    def close(self):
        self.process.kill()
        self.process.wait()


def worker(request, scope):
    if request.get('action') == 'capture-target':
        request = {**request, 'scope': scope}
    return service.request(request)


def text(hwnd):
    value = c.create_unicode_buffer(200)
    copied = message(hwnd, 0xD, len(value), c.addressof(value))  # WM_GETTEXT, across processes
    return value.value[:copied]


class Host:
    def __init__(self, bits, script):
        folder = 'SysWOW64' if bits == 32 else 'System32'
        shell = Path(os.environ['SystemRoot']) / folder / 'WindowsPowerShell/v1.0/powershell.exe'
        user32.AllowSetForegroundWindow(0xFFFFFFFF)  # ASFW_ANY: the host may take the foreground.
        self.process = subprocess.Popen([str(shell), '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', str(script)],
            stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding='utf-8',
            creationflags=subprocess.CREATE_NO_WINDOW)  # A console window would take the foreground.
        line = self.process.stdout.readline().split()
        if len(line) != 7:
            self.close()
            raise AssertionError(f'{bits}-bit host did not start: {self.process.stderr.read()}')
        self.parent, self.box, self.lines, self.rich = (int(value) for value in line[:4])
        assert line[4:] == [str(bits), 'ansi', 'ansi'], line
        self.thread = user32.GetWindowThreadProcessId(self.parent, None)
        self.scope = {'window': self.parent, 'process': self.process.pid}

    def front(self, hwnd):
        """Foreground window and keyboard focus on `hwnd`; the selection stays as it is."""
        user32.PostThreadMessageW(self.thread, FOCUS, hwnd, 0)
        deadline = time.monotonic() + 3
        info = GUI()
        info.cbSize = c.sizeof(GUI)
        while not (user32.GetForegroundWindow() == self.parent and
                   user32.GetGUIThreadInfo(self.thread, c.byref(info)) and info.hwndFocus == hwnd):
            assert time.monotonic() < deadline, ('Windows did not bring the test window to the foreground; '
                                                 'leave mouse and keyboard alone while the test runs')
            time.sleep(0.01)

    def select(self, hwnd, start, end):
        self.front(hwnd)
        message(hwnd, 0xB1, start, end)  # EM_SETSEL

    def close(self):
        self.process.kill()
        self.process.wait()


def check_field(host, field, expected_class):
    """Insertion, selection, stale target and non-ANSI text in one VB6-style field."""
    host.select(field, 7, 7)
    target = worker({'action': 'capture-target'}, host.scope)['target']
    assert target and target['focus'] == field, 'Windows did not foreground the test field'
    assert target.get('kind') != 'uia' and target['class'] == expected_class, target.get('class')
    assert (target['before'], target['after']) == ('Vorher ', '')
    host.front(field)
    inserted = worker({'action': 'insert-text', 'target': target, 'text': SAMPLE}, host.scope)
    assert inserted['inserted'], inserted
    assert text(field) == f'Vorher {SAMPLE}', f'Unexpected fixture text length: {len(text(field))}'
    stale = worker({'action': 'capture-target'}, host.scope)['target']
    host.select(field, 0, 0)
    assert not worker({'action': 'insert-text', 'target': stale, 'text': 'FALSCH'}, host.scope)['inserted']
    assert text(field) == f'Vorher {SAMPLE}', 'Stale target changed the text'
    host.select(field, 0, 6)
    selected = worker({'action': 'capture-target'}, host.scope)['target']
    assert (selected['before'], selected['after']) == ('', f' {SAMPLE}')
    host.front(field)
    assert worker({'action': 'insert-text', 'target': selected, 'text': 'Nachher'}, host.scope)['inserted']
    assert text(field) == f'Nachher {SAMPLE}', f'Unexpected fixture text length: {len(text(field))}'
    host.select(field, 0, 0)
    emoji = worker({'action': 'capture-target'}, host.scope)['target']
    host.front(field)
    refused = worker({'action': 'insert-text', 'target': emoji, 'text': 'Super 🌍 '}, host.scope)
    assert not refused['inserted'] and 'Zeichen' in refused.get('reason', ''), refused
    assert text(field) == f'Nachher {SAMPLE}', 'Text changed although insertion was refused'


def check_host(bits, script):
    host = Host(bits, script)
    try:
        assert representable(host.box, SAMPLE) and not representable(host.box, '🌍')
        check_field(host, host.box, 'thunderrt6textbox')
        check_field(host, host.rich, 'richtextwndclass')
        host.select(host.lines, 0, 5)
        multiline = worker({'action': 'capture-target'}, host.scope)['target']
        assert multiline, 'Multiline VB6 target unavailable'
        host.front(host.lines)
        assert worker({'action': 'insert-text', 'target': multiline, 'text': 'Oben\nMitte'}, host.scope)['inserted']
        assert text(host.lines) == 'Oben\r\nMitte\r\nZweite', f'Unexpected fixture text length: {len(text(host.lines))}'
        host.select(host.box, 0, 0)
        message(host.box, 0xCC, ord('*'))  # EM_SETPASSWORDCHAR
        assert worker({'action': 'capture-target'}, host.scope)['target'] is None
        message(host.box, 0xCC, 0)
        message(host.box, 0xCF, 1)  # EM_SETREADONLY
        assert worker({'action': 'capture-target'}, host.scope)['target'] is None
    finally:
        host.close()


assert native_kind('thunderrt6textbox') == 'edit' and native_kind('richtextwndclass') == 'richedit'
assert native_kind('tx34') == 'richedit' and native_kind('thunderrt6commandbutton') is None
# TX Text Control counts a CRLF paragraph break as one selection position (checked in PcPo).
paragraphs = c.create_unicode_buffer('Ab\r\nCd\r\n🌍')
assert [text_index(paragraphs, 10, position) for position in (0, 2, 3, 5, 6, 8, 20)] == [0, 2, 4, 6, 8, 10, 10]
clipboard_sequence = user32.GetClipboardSequenceNumber()
service = TargetService()
try:
    with tempfile.TemporaryDirectory(prefix='blitzdic-vb6-') as folder:
        script = Path(folder) / 'vb6-host.ps1'
        script.write_text(HOST, encoding='utf-8-sig')  # Windows PowerShell 5.1 needs the BOM for UTF-8.
        for bits in (64, 32):
            check_host(bits, script)
            print(f'PASS: {bits}-bit VB6 TextBox/RichTextBox host')
finally:
    service.close()
assert user32.GetClipboardSequenceNumber() == clipboard_sequence, 'Clipboard changed during test'
print('PASS: VB6 TextBox/RichTextBox: ANSI text, selection, multiline, changed cursor, emoji refusal, '
      'password/read-only, 64- and 32-bit hosts, unchanged clipboard')
