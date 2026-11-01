$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
Add-Type -ReferencedAssemblies UIAutomationClient, UIAutomationTypes -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Reflection;
using System.Windows.Automation;
using System.Windows.Automation.Text;

public static class BlitzDicUia {
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
    [DllImport("oleacc.dll")] static extern int AccessibleObjectFromWindow(IntPtr window, uint objectId,
        ref Guid interfaceId, [MarshalAs(UnmanagedType.Interface)] out object native);
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
    public static string Reason = "";
    public static string Before = "", After = "";
    static string Reject(string reason) { Reason = reason; return null; }
    static object WordMember(object instance, string name, BindingFlags operation, params object[] args) {
        return instance.GetType().InvokeMember(name, operation, null, instance, args,
            System.Globalization.CultureInfo.InvariantCulture);
    }
    static bool InsertWord(string signature, string text) {
        var element = AutomationElement.FocusedElement;
        if (element == null || element.Current.ControlType != ControlType.Document ||
                element.Current.ClassName != "_WwG") return false;
        // OBJID_NATIVEOM resolves the exact focused Word document window, rather
        // than attaching to an arbitrary running Word instance or launching one.
        object window = null, selection = null, range = null;
        try {
            Guid dispatch = new Guid("00020400-0000-0000-C000-000000000046");
            IntPtr handle = new IntPtr(element.Current.NativeWindowHandle);
            if (handle == IntPtr.Zero || AccessibleObjectFromWindow(handle, 0xFFFFFFF0, ref dispatch, out window) != 0)
                throw new InvalidOperationException("Word-Dokumentzugriff nicht verfügbar.");
            long foreground = GetForegroundWindow().ToInt64();
            long owned = Convert.ToInt64(WordMember(window, "Hwnd", BindingFlags.GetProperty));
            if (owned != foreground) throw new InvalidOperationException("Word-Fenster geändert.");
            selection = WordMember(window, "Selection", BindingFlags.GetProperty);
            int selectionType = Convert.ToInt32(WordMember(selection, "Type", BindingFlags.GetProperty));
            if (selectionType != 1 && selectionType != 2)
                throw new InvalidOperationException("Keine eindeutige Word-Textauswahl.");
            range = WordMember(selection, "Range", BindingFlags.GetProperty);
            if (Capture() != signature) throw new InvalidOperationException("Word-Auswahl geändert.");
            // Range.Text preserves supplementary Unicode characters and replaces
            // only the verified selection without touching the clipboard/options.
            WordMember(range, "Text", BindingFlags.SetProperty, text.Replace("\n", "\r"));
            WordMember(range, "Collapse", BindingFlags.InvokeMethod, 0);
            WordMember(range, "Select", BindingFlags.InvokeMethod);
            return true;
        } finally {
            foreach (object item in new object[] { range, selection, window })
                if (item != null && Marshal.IsComObject(item)) Marshal.ReleaseComObject(item);
        }
    }
    public static string Capture() {
        Reason = "";
        IntPtr window = GetForegroundWindow();
        var element = AutomationElement.FocusedElement;
        if (element == null) return Reject("Kein fokussiertes Element");
        var current = element.Current;
        if (current.IsPassword || !current.IsEnabled || !current.HasKeyboardFocus) return Reject("Feld geschützt, inaktiv oder ohne Tastaturfokus");
        if (current.ControlType != ControlType.Edit && current.ControlType != ControlType.Document) return Reject("Kein Texteingabefeld");
        uint pid; GetWindowThreadProcessId(window, out pid);
        if (pid != current.ProcessId) return Reject("Prozess stimmt nicht mit Vordergrundfenster überein");
        object pattern;
        if (!element.TryGetCurrentPattern(TextPattern.Pattern, out pattern)) return Reject("TextPattern nicht verfügbar");
        var text = (TextPattern)pattern;
        var range = text.DocumentRange;
        var readOnly = range.GetAttributeValue(TextPattern.IsReadOnlyAttribute);
        if (!(readOnly is bool) || (bool)readOnly) return Reject("Schreibgeschützt oder Schreibschutz unklar");
        var selection = text.GetSelection();
        if (selection == null || selection.Length != 1) return Reject("Keine eindeutige Textauswahl");
        var prefix = range.Clone();
        prefix.MoveEndpointByRange(TextPatternRangeEndpoint.End, selection[0], TextPatternRangeEndpoint.Start);
        string document = range.GetText(1000001);
        if (document.Length > 1000000) return Reject("Dokument zu groß");
        string hash;
        using (var sha = SHA256.Create()) hash = Convert.ToBase64String(sha.ComputeHash(Encoding.Unicode.GetBytes(document)));
        var identity = String.Join(",", element.GetRuntimeId());
        if (GetForegroundWindow() != window || !Automation.Compare(element, AutomationElement.FocusedElement)) return Reject("Fokus während Erfassung geändert");
        string prefixText = prefix.GetText(-1);
        var suffix = range.Clone();
        suffix.MoveEndpointByRange(TextPatternRangeEndpoint.Start, selection[0], TextPatternRangeEndpoint.End);
        Before = prefixText.Substring(Math.Max(0, prefixText.Length - 160));
        After = suffix.GetText(160);
        return window.ToInt64() + ":" + pid + ":" + identity + ":" + prefixText.Length + ":" + selection[0].GetText(-1).Length + ":" + hash;
    }

    public static bool Insert(string signature, string text) {
        if (String.IsNullOrEmpty(signature) || text == null || text.Length > 100000 || text.IndexOf('\0') >= 0) return false;
        // Never release or synthesize modifiers that the user is currently holding.
        foreach (int key in new int[] { 0x10, 0x11, 0x12, 0x5B, 0x5C })
            if ((GetAsyncKeyState(key) & 0x8000) != 0) return false;
        text = text.Replace("\r\n", "\n").Replace('\r', '\n');
        if (Capture() != signature) return false;
        if (InsertWord(signature, text)) return true;
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
        $signature = [BlitzDicUia]::Capture()
        @{ signature = $signature; reason = [BlitzDicUia]::Reason; before = [BlitzDicUia]::Before; after = [BlitzDicUia]::After } | ConvertTo-Json -Compress
    } elseif ($request.action -eq 'insert') {
        @{ inserted = [BlitzDicUia]::Insert($request.signature, $request.text) } | ConvertTo-Json -Compress
    } else { throw 'Unbekannte UI-Automation-Aktion.' }
} catch {
    @{ error = 'Windows-UI-Automation konnte das Eingabefeld nicht zuverlässig bedienen.' } | ConvertTo-Json -Compress
    exit 1
}
