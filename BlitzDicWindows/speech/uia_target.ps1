$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
Add-Type -ReferencedAssemblies UIAutomationClient, UIAutomationTypes -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Windows.Automation;
using System.Windows.Automation.Text;

public static class BlitzDicUia {
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll", SetLastError=true)] static extern uint SendInput(uint count, INPUT[] inputs, int size);
    [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT {
        public ushort vk, scan; public uint flags, time; public UIntPtr extra;
    }
    [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT {
        public int x, y; public uint data, flags, time; public UIntPtr extra;
    }
    [StructLayout(LayoutKind.Explicit)] struct UNION {
        [FieldOffset(0)] public KEYBDINPUT key;
        [FieldOffset(0)] public MOUSEINPUT mouse;
    }
    [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public UNION data; }

    // The signature contains hashes and selection lengths, never the document text.
    public static string Capture() {
        IntPtr window = GetForegroundWindow();
        var element = AutomationElement.FocusedElement;
        if (element == null) return null;
        var current = element.Current;
        if (current.IsPassword || !current.IsEnabled || !current.HasKeyboardFocus) return null;
        if (current.ControlType != ControlType.Edit && current.ControlType != ControlType.Document) return null;
        uint pid; GetWindowThreadProcessId(window, out pid);
        if (pid != current.ProcessId) return null;
        object pattern;
        if (!element.TryGetCurrentPattern(TextPattern.Pattern, out pattern)) return null;
        var text = (TextPattern)pattern;
        var range = text.DocumentRange;
        var readOnly = range.GetAttributeValue(TextPattern.IsReadOnlyAttribute);
        if (!(readOnly is bool) || (bool)readOnly) return null;
        var selection = text.GetSelection();
        if (selection == null || selection.Length != 1) return null;
        var prefix = range.Clone();
        prefix.MoveEndpointByRange(TextPatternRangeEndpoint.End, selection[0], TextPatternRangeEndpoint.Start);
        string document = range.GetText(1000001);
        if (document.Length > 1000000) return null;
        string hash;
        using (var sha = SHA256.Create()) hash = Convert.ToBase64String(sha.ComputeHash(Encoding.Unicode.GetBytes(document)));
        var identity = String.Join(",", element.GetRuntimeId());
        if (GetForegroundWindow() != window || !Automation.Compare(element, AutomationElement.FocusedElement)) return null;
        return window.ToInt64() + ":" + pid + ":" + identity + ":" + prefix.GetText(-1).Length + ":" + selection[0].GetText(-1).Length + ":" + hash;
    }

    public static bool Insert(string signature, string text) {
        if (String.IsNullOrEmpty(signature) || text == null || text.Length > 100000 || text.IndexOf('\0') >= 0) return false;
        // Never release or synthesize modifiers that the user is currently holding.
        foreach (int key in new int[] { 0x10, 0x11, 0x12, 0x5B, 0x5C })
            if ((GetAsyncKeyState(key) & 0x8000) != 0) return false;
        text = text.Replace("\r\n", "\n").Replace('\r', '\n');
        INPUT[] inputs = new INPUT[text.Length * 2];
        for (int i = 0; i < text.Length; i++) {
            KEYBDINPUT key = new KEYBDINPUT();
            if (text[i] == '\n') key.vk = 0x0D;
            else { key.scan = text[i]; key.flags = 4; } // KEYEVENTF_UNICODE
            inputs[i * 2].type = 1; inputs[i * 2].data.key = key;
            key.flags |= 2;
            inputs[i * 2 + 1].type = 1; inputs[i * 2 + 1].data.key = key;
        }
        if (Capture() != signature) return false;
        uint sent = SendInput((uint)inputs.Length, inputs, Marshal.SizeOf(typeof(INPUT)));
        if (sent != inputs.Length) throw new InvalidOperationException("Windows hat die Texteingabe nicht vollständig angenommen. Ergebnis im Zielfeld prüfen.");
        return true;
    }
}
'@
try {
    $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
    if ($request.action -eq 'capture') {
        @{ signature = [BlitzDicUia]::Capture() } | ConvertTo-Json -Compress
    } elseif ($request.action -eq 'insert') {
        @{ inserted = [BlitzDicUia]::Insert($request.signature, $request.text) } | ConvertTo-Json -Compress
    } else { throw 'Unbekannte UI-Automation-Aktion.' }
} catch {
    @{ error = 'Windows-UI-Automation konnte das Eingabefeld nicht zuverlässig bedienen.' } | ConvertTo-Json -Compress
    exit 1
}
