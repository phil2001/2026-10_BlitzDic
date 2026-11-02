param([string]$SpeechExecutable = '')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
if (!$SpeechExecutable) { $SpeechExecutable = Join-Path $projectRoot '.runtime/venv/Scripts/python.exe' }
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class WordInsertionTest {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern uint GetClipboardSequenceNumber();
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
}
'@
function Invoke-Speech($request) {
    if ($request.action -eq "capture-target" -and $script:captureScope) { $request.scope = $script:captureScope }
    $info = [Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $SpeechExecutable
    if ([IO.Path]::GetFileName($SpeechExecutable) -ne 'blitzdic-speech.exe') {
        $info.Arguments = '"' + (Join-Path $projectRoot 'speech/worker.py') + '"'
    }
    $info.UseShellExecute = $false; $info.CreateNoWindow = $true
    $info.RedirectStandardInput = $true; $info.RedirectStandardOutput = $true; $info.RedirectStandardError = $true
    $info.EnvironmentVariables['PYTHONIOENCODING'] = 'utf-8'
    $process = [Diagnostics.Process]::Start($info)
    try {
        $bytes = [Text.Encoding]::UTF8.GetBytes(($request | ConvertTo-Json -Depth 10 -Compress))
        $process.StandardInput.BaseStream.Write($bytes, 0, $bytes.Length)
        $process.StandardInput.BaseStream.Flush()
        $process.StandardInput.Close()
        $outputTask = $process.StandardOutput.ReadToEndAsync()
        $errorTask = $process.StandardError.ReadToEndAsync()
        if (!$process.WaitForExit(15000)) { $process.Kill(); throw 'Speech worker timed out' }
        $output = $outputTask.GetAwaiter().GetResult()
        if ($process.ExitCode -ne 0) { throw ('Speech worker failed: ' + $output + $errorTask.GetAwaiter().GetResult()) }
        return $output | ConvertFrom-Json
    } finally { $process.Dispose() }
}
function Assert-True($condition, [string]$message) { if (!$condition) { throw $message } }
function Assert-Text([string]$expected) {
    $deadline = [DateTime]::UtcNow.AddSeconds(5)
    do {
        $actual = $document.Content.Text.TrimEnd([char[]]"`r`n")
        if ($actual -ceq $expected) { return }
        Start-Sleep -Milliseconds 25
    } while ([DateTime]::UtcNow -lt $deadline)
    throw ('Word fixture text mismatch; expected length ' + $expected.Length + '; actual length ' + $actual.Length)
}

$application = $null; $document = $null; $otherDocument = $null; $owned = $false; $testFailure = $null
try {
    # Create a separate instance. Never attach to an existing user's document.
    $application = New-Object -ComObject Word.Application
    Assert-True ($application.Documents.Count -eq 0) 'Word instance already contains documents; test stopped'
    $owned = $true
    Write-Output ('Word version: ' + $application.Version + '; build: ' + $application.Build)
    $document = $application.Documents.Add()
    $application.Visible = $true
    $document.Content.Text = 'Before '
    $document.Activate(); $application.Activate()
    $application.Selection.SetRange(7, 7)
    $window = [IntPtr]$document.ActiveWindow.Hwnd
    [uint32]$owner = 0
    [void][WordInsertionTest]::GetWindowThreadProcessId($window, [ref]$owner)
    $script:captureScope = @{window=$window.ToInt64(); process=$owner}
    [void][WordInsertionTest]::SetForegroundWindow($window)
    Assert-True ([WordInsertionTest]::GetForegroundWindow() -eq $window) 'Windows did not foreground the owned Word instance'
    $clipboard = [WordInsertionTest]::GetClipboardSequenceNumber()
    $captured = Invoke-Speech @{action='capture-target'}
    Assert-True ($captured.executable -eq 'winword.exe') 'Captured process is not the owned Word instance'
    Assert-True ($captured.target.kind -eq 'uia') ('Word target unavailable: ' + $captured.reason)
    Assert-True ($captured.target.before -ceq 'Before ') 'Word cursor prefix mismatch'
    Assert-True ([string]::IsNullOrWhiteSpace($captured.target.after)) 'Word cursor suffix mismatch'
    $unicode = 'Gr' + [char]0xFC + [char]0xDF + 'e! ' + [char]::ConvertFromUtf32(0x1F30D)
    $result = Invoke-Speech @{action='insert-text'; target=$captured.target; text=$unicode}
    Assert-True $result.inserted 'Word insertion rejected'
    Assert-Text ('Before ' + $unicode)
    $application.Selection.SetRange(0, 6)
    $selected = Invoke-Speech @{action='capture-target'}
    Assert-True ($selected.target.kind -eq 'uia') 'Word selection unavailable'
    Assert-True ($selected.target.before -ceq '') 'Word selected prefix mismatch'
    Assert-True ($selected.target.after.StartsWith(' ' + $unicode, [StringComparison]::Ordinal)) 'Word selected suffix mismatch'
    $result = Invoke-Speech @{action='insert-text'; target=$selected.target; text='After'}
    Assert-True $result.inserted 'Word selection replacement rejected'
    Assert-Text ('After ' + $unicode)
    [void]$document.Undo()
    Assert-Text ('Before ' + $unicode)
    [void]$document.Redo()
    Assert-Text ('After ' + $unicode)
    $application.Selection.SetRange(0, 0)
    $multiline = Invoke-Speech @{action='capture-target'}
    $result = Invoke-Speech @{action='insert-text'; target=$multiline.target; text="First line`nSecond line`n"}
    Assert-True $result.inserted 'Word multiline insertion rejected'
    Assert-Text ("First line`rSecond line`rAfter " + $unicode)
    $application.Selection.SetRange(0, 0)
    $stale = Invoke-Speech @{action='capture-target'}
    $document.Content.Text = 'Other ' + $unicode
    $application.Selection.SetRange(0, 0)
    $result = Invoke-Speech @{action='insert-text'; target=$stale.target; text='WRONG'}
    Assert-True (!$result.inserted) 'Changed Word document accepted'
    Assert-Text ('Other ' + $unicode)
    $cursor = Invoke-Speech @{action='capture-target'}
    $application.Selection.SetRange(2, 2)
    $result = Invoke-Speech @{action='insert-text'; target=$cursor.target; text='WRONG'}
    Assert-True (!$result.inserted) 'Changed Word cursor accepted'
    $windowTarget = Invoke-Speech @{action='capture-target'}
    $otherDocument = $application.Documents.Add()
    $otherDocument.Content.Text = 'Separate test document'
    $otherDocument.Activate()
    [void][WordInsertionTest]::SetForegroundWindow([IntPtr]$otherDocument.ActiveWindow.Hwnd)
    $result = Invoke-Speech @{action='insert-text'; target=$windowTarget.target; text='WRONG'}
    Assert-True (!$result.inserted) 'Different Word document accepted'
    Assert-True ($otherDocument.Content.Text.TrimEnd([char[]]"`r`n") -ceq 'Separate test document') 'Other Word document changed'
    [object]$discardOther = 0
    $otherDocument.Close([ref]$discardOther)
    [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($otherDocument); $otherDocument = $null
    $document.Activate()
    [void][WordInsertionTest]::SetForegroundWindow($window)
    [object]$protection = 3
    $document.Protect([ref]$protection)
    $protected = Invoke-Speech @{action='capture-target'}
    Assert-True ($null -eq $protected.target) 'Read-only Word document accepted'
    Assert-True ([WordInsertionTest]::GetClipboardSequenceNumber() -eq $clipboard) 'Clipboard changed'
    Write-Output 'PASS: Word Unicode/emoji, selection, undo/redo, multiline, changed text/cursor/document, protection, unchanged clipboard'
} catch { $testFailure = $_ } finally {
    [object]$discard = 0
    try {
        if ($null -ne $otherDocument) { $otherDocument.Close([ref]$discard); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($otherDocument) }
        if ($null -ne $document) { $document.Close([ref]$discard); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($document) }
        if ($owned -and $application.Documents.Count -eq 0) { $application.Quit([ref]$discard) }
    } catch { if (!$testFailure) { $testFailure = $_ } }
    if ($null -ne $application) { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($application) }
}
if ($testFailure) { throw $testFailure }
