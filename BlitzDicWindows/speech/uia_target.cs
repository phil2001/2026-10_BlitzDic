// Windows UI Automation bridge for capturing the focused text field and inserting
// text. Compiled once at build time (scripts/build-uia.ps1) with the .NET Framework
// compiler that ships with Windows; replaces compiling it in PowerShell per call.
using System;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Reflection;
using System.Windows.Automation;
using System.Windows.Automation.Text;
using System.Collections.Generic;

public static class BlitzDicUia {
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
    [StructLayout(LayoutKind.Sequential)] struct POINT { public int x, y; }
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
    static readonly System.Diagnostics.Stopwatch TraceClock = System.Diagnostics.Stopwatch.StartNew();
    static void Trace(string stage) {
        if (Environment.GetEnvironmentVariable("BLITZDIC_UIA_TRACE") == "1")
            Console.Error.WriteLine("UIA " + TraceClock.ElapsedMilliseconds + "ms " + stage);
    }
    static AutomationElement CapturedElement;
    static IntPtr CapturedWindow;
    static IntPtr RequiredWindow;
    static uint RequiredProcess;
    public static string CaptureScoped(long window, uint process) {
        if (window <= 0 || process == 0) return Reject("Ungültiger Fensterbereich");
        RequiredWindow = new IntPtr(window); RequiredProcess = process;
        return Capture();
    }
    // Minimal read-only UIA COM declarations, in Windows SDK vtable order.
    // The managed UIA API omits LegacyIAccessibleValue, needed for document URLs.
    [ComImport, Guid("D22108AA-8AC5-49A5-837B-37BBB3D7591E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface NativeElement {
        [PreserveSig] int SetFocus(); // Never called.
        [PreserveSig] int GetRuntimeId([MarshalAs(UnmanagedType.SafeArray, SafeArraySubType=VarEnum.VT_I4)] out int[] id);
        [PreserveSig] int FindFirst(int scope, IntPtr condition, out NativeElement result);
        [PreserveSig] int FindAll(int scope, IntPtr condition, out IntPtr result);
        [PreserveSig] int FindFirstBuildCache(int scope, IntPtr condition, IntPtr cache, out NativeElement result);
        [PreserveSig] int FindAllBuildCache(int scope, IntPtr condition, IntPtr cache, out IntPtr result);
        [PreserveSig] int BuildUpdatedCache(IntPtr cache, out NativeElement result);
        [PreserveSig] int GetCurrentPropertyValue(int property, [MarshalAs(UnmanagedType.Struct)] out object value);
    }
    [ComImport, Guid("4042C624-389C-4AFC-A630-9DF854A541FC"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface NativeWalker {
        [PreserveSig] int GetParentElement(NativeElement element, out NativeElement parent);
    }
    [ComImport, Guid("30CBE57D-D9D0-452A-AB13-7AC5AC4825EE"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface NativeAutomation {
        [PreserveSig] int CompareElements(IntPtr a, IntPtr b, out int same);
        [PreserveSig] int CompareRuntimeIds(IntPtr a, IntPtr b, out int same);
        [PreserveSig] int GetRootElement(out NativeElement element);
        [PreserveSig] int ElementFromHandle(IntPtr window, out NativeElement element);
        [PreserveSig] int ElementFromPoint(POINT point, out NativeElement element);
        [PreserveSig] int GetFocusedElement(out NativeElement element);
        [PreserveSig] int GetRootElementBuildCache(IntPtr cache, out NativeElement element);
        [PreserveSig] int ElementFromHandleBuildCache(IntPtr window, IntPtr cache, out NativeElement element);
        [PreserveSig] int ElementFromPointBuildCache(POINT point, IntPtr cache, out NativeElement element);
        [PreserveSig] int GetFocusedElementBuildCache(IntPtr cache, out NativeElement element);
        [PreserveSig] int CreateTreeWalker(IntPtr condition, out NativeWalker walker);
        [PreserveSig] int GetControlViewWalker(out NativeWalker walker);
        [PreserveSig] int GetContentViewWalker(out NativeWalker walker);
        [PreserveSig] int GetRawViewWalker(out NativeWalker walker);
    }
    // Follow the exact focused element, never a hit-test position or page label.
    public static string WebsiteHost() {
        Trace("website:start");
        var references = new List<object>();
        try {
            var focused = CapturedElement;
            IntPtr window = CapturedWindow;
            if (focused == null || window == IntPtr.Zero || GetForegroundWindow() != window ||
                    !Automation.Compare(focused, AutomationElement.FocusedElement)) return null;
            uint pid; GetWindowThreadProcessId(window, out pid);
            string executable = System.Diagnostics.Process.GetProcessById((int)pid).ProcessName.ToLowerInvariant();
            if (Array.IndexOf(new string[] {"chrome", "msedge", "firefox", "brave", "opera", "vivaldi"}, executable) < 0) return null;
            Trace("website:activate-native");
            var automation = (NativeAutomation)Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("FF48DBA4-60EF-4201-AA87-54103EEF594E")));
            references.Add(automation);
            NativeElement element; NativeWalker walker; int[] identity;
            Trace("website:native-focus");
            if (automation.GetFocusedElement(out element) != 0 || element == null) return null;
            references.Add(element);
            Trace("website:runtime-id");
            if (element.GetRuntimeId(out identity) != 0 || String.Join(",", identity) != String.Join(",", focused.GetRuntimeId())) return null;
            Trace("website:raw-walker");
            if (automation.GetRawViewWalker(out walker) != 0 || walker == null) return null;
            references.Add(walker);
            var timer = System.Diagnostics.Stopwatch.StartNew();
            for (int depth = 0; element != null && depth < 40 && timer.ElapsedMilliseconds < 250; depth++) {
                Trace("website:ancestor-" + depth);
                object process, role, value;
                if (element.GetCurrentPropertyValue(30002, out process) != 0 || !(process is int) || (int)process != pid) return null;
                if (element.GetCurrentPropertyValue(30003, out role) != 0) return null;
                if (role is int && (int)role == 50030 && element.GetCurrentPropertyValue(30093, out value) == 0) {
                    string address = value as string;
                    Uri uri;
                    if (address != null && address.Length <= 8192 && Uri.TryCreate(address, UriKind.Absolute, out uri) &&
                            (uri.Scheme == "http" || uri.Scheme == "https")) {
                        if (GetForegroundWindow() != window || !Automation.Compare(focused, AutomationElement.FocusedElement)) return null;
                        string host = uri.IdnHost.ToLowerInvariant();
                        if (uri.HostNameType == UriHostNameType.IPv6) host = "[" + host.Trim('[', ']') + "]";
                        return host.StartsWith("www.") ? host.Substring(4) : host;
                    }
                    if (value != null && Marshal.IsComObject(value)) Marshal.ReleaseComObject(value);
                }
                NativeElement parent;
                if (walker.GetParentElement(element, out parent) != 0 || parent == null || references.Contains(parent)) return null;
                references.Add(parent); element = parent;
            }
        } catch { /* Unsupported/inaccessible browser: fall back to its app rule. */ }
        finally {
            Trace("website:release");
            foreach (object item in references) if (Marshal.IsComObject(item)) Marshal.ReleaseComObject(item);
        }
        return null;
    }
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
        Trace("capture:start");
        Reason = "";
        CapturedElement = null; CapturedWindow = IntPtr.Zero;
        IntPtr window = GetForegroundWindow();
        if (window == IntPtr.Zero) return Reject("Kein Vordergrundfenster");
        if (RequiredWindow != IntPtr.Zero) {
            uint owner; GetWindowThreadProcessId(window, out owner);
            if (window != RequiredWindow || owner != RequiredProcess) return Reject("Vordergrundfenster geändert");
        }
        var element = AutomationElement.FocusedElement;
        if (element == null) return Reject("Kein fokussiertes Element");
        Trace("capture:focused");
        var current = element.Current;
        if (current.IsPassword || !current.IsEnabled || !current.HasKeyboardFocus) return Reject("Feld geschützt, inaktiv oder ohne Tastaturfokus");
        if (current.ControlType != ControlType.Edit && current.ControlType != ControlType.Document) return Reject("Kein Texteingabefeld");
        uint pid; GetWindowThreadProcessId(window, out pid);
        if (pid != current.ProcessId) return Reject("Prozess stimmt nicht mit Vordergrundfenster überein");
        object pattern;
        if (!element.TryGetCurrentPattern(TextPattern.Pattern, out pattern)) return Reject("TextPattern nicht verfügbar");
        Trace("capture:text-pattern");
        var text = (TextPattern)pattern;
        var range = text.DocumentRange;
        var readOnly = range.GetAttributeValue(TextPattern.IsReadOnlyAttribute);
        if (!(readOnly is bool) || (bool)readOnly) return Reject("Schreibgeschützt oder Schreibschutz unklar");
        var selection = text.GetSelection();
        if (selection == null || selection.Length != 1) return Reject("Keine eindeutige Textauswahl");
        var prefix = range.Clone();
        prefix.MoveEndpointByRange(TextPatternRangeEndpoint.End, selection[0], TextPatternRangeEndpoint.Start);
        Trace("capture:document");
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
        Trace("capture:done");
        CapturedElement = element; CapturedWindow = window;
        return window.ToInt64() + ":" + pid + ":" + identity + ":" + prefixText.Length + ":" + selection[0].GetText(-1).Length + ":" + hash;
    }

    public static bool Insert(string signature, string text) {
        if (String.IsNullOrEmpty(signature) || text == null || text.Length > 100000 || text.IndexOf('\0') >= 0) return false;
        var parts = signature.Split(':'); long expectedWindow; uint expectedProcess;
        if (parts.Length != 6 || !Int64.TryParse(parts[0], out expectedWindow) || expectedWindow <= 0 ||
                !UInt32.TryParse(parts[1], out expectedProcess) || expectedProcess == 0) return false;
        RequiredWindow = new IntPtr(expectedWindow); RequiredProcess = expectedProcess;
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

// One JSON request on stdin, one JSON result on stdout; same requests, results and
// exit codes as the former PowerShell bridge. C# 5: the Windows-supplied compiler.
public static class BlitzDicUiaProgram {
    static object Value(Dictionary<string, object> values, string name) {
        object value; return values != null && values.TryGetValue(name, out value) ? value : null;
    }
    [STAThread] // As in Windows PowerShell: Word's COM selection is called from an STA.
    public static int Main() {
        var utf8 = new UTF8Encoding(false);
        Console.InputEncoding = utf8; Console.OutputEncoding = utf8;
        var json = new System.Web.Script.Serialization.JavaScriptSerializer();
        json.MaxJsonLength = 8 * 1024 * 1024;
        try {
            // Tolerate a byte order mark, as the PowerShell bridge's ConvertFrom-Json did.
            var request = json.Deserialize<Dictionary<string, object>>(Console.In.ReadToEnd().TrimStart('﻿'));
            var action = Value(request, "action") as string;
            Dictionary<string, object> result;
            if (action == "capture") {
                object scopeValue = Value(request, "scope");
                string signature;
                if (scopeValue != null) {
                    var scope = (Dictionary<string, object>)scopeValue;
                    signature = BlitzDicUia.CaptureScoped(Convert.ToInt64(scope["window"]), Convert.ToUInt32(scope["process"]));
                } else signature = BlitzDicUia.Capture();
                object website = Value(request, "website");
                string host = website is bool && (bool)website && !String.IsNullOrEmpty(signature) ? BlitzDicUia.WebsiteHost() : null;
                result = new Dictionary<string, object> {
                    { "signature", signature }, { "reason", BlitzDicUia.Reason },
                    { "before", BlitzDicUia.Before }, { "after", BlitzDicUia.After }, { "websiteHost", host } };
            } else if (action == "insert") {
                result = new Dictionary<string, object> {
                    { "inserted", BlitzDicUia.Insert(Value(request, "signature") as string, Value(request, "text") as string) } };
            } else throw new InvalidOperationException("Unbekannte UI-Automation-Aktion.");
            Console.Out.Write(json.Serialize(result));
            return 0;
        } catch (Exception error) {
            if (Environment.GetEnvironmentVariable("BLITZDIC_UIA_TRACE") == "1") Console.Error.WriteLine(error);
            Console.Out.Write("{\"error\":\"Windows-UI-Automation konnte das Eingabefeld nicht zuverlässig bedienen.\"}");
            return 1;
        }
    }
}
