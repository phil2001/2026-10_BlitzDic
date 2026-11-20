[CmdletBinding(DefaultParameterSetName = 'Synthesis')]
param(
    [Parameter(Mandatory = $true)] [string]$Executable,
    [Parameter(Mandatory = $true, ParameterSetName = 'Recording')] [string]$WavePath,
    [Parameter(Mandatory = $true, ParameterSetName = 'Recording')] [ValidateSet('de', 'en')] [string]$Language,
    [Parameter(Mandatory = $true, ParameterSetName = 'Recording')] [ValidateNotNullOrEmpty()] [string]$ExpectedText
)

$ErrorActionPreference = 'Stop'
$app = Get-Item -LiteralPath $Executable
if ($app.PSIsContainer -or $app.Name -ne 'BlitzDic.exe') {
    throw 'Bitte den Pfad zur installierten BlitzDic.exe angeben.'
}
$resources = Join-Path $app.DirectoryName 'resources'
$worker = Join-Path $resources 'speech-runtime\blitzdic-speech.exe'
foreach ($file in @($worker, (Join-Path $resources 'app.asar'))) {
    if (!(Test-Path -LiteralPath $file -PathType Leaf)) { throw "Paketdatei fehlt: $file" }
}

if ($PSCmdlet.ParameterSetName -eq 'Recording') {
    $recording = Get-Item -LiteralPath $WavePath
    if ($recording.PSIsContainer -or $recording.Extension -ne '.wav') {
        throw 'Bitte eine WAV-Testaufnahme angeben.'
    }
    $audio = [Convert]::ToBase64String([IO.File]::ReadAllBytes($recording.FullName))
    $expected = [regex]::Escape($ExpectedText)
} else {
    Add-Type -AssemblyName System.Speech
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $wave = New-Object System.IO.MemoryStream
    try {
        $voice = $synth.GetInstalledVoices() | Where-Object {
            $_.Enabled -and $_.VoiceInfo.Culture.TwoLetterISOLanguageName -in @('de', 'en')
        } | Select-Object -First 1
        if (!$voice) { throw 'Fuer diese Testaufnahme ist eine deutsche oder englische Windows-Stimme erforderlich.' }
        $language = $voice.VoiceInfo.Culture.TwoLetterISOLanguageName
        if ($language -eq 'de') {
            $sentence = 'Die Besprechung beginnt morgen. Anna prueft die Unterlagen.' -replace 'prueft', ('pr' + [char]0x00FC + 'ft')
            $expected = 'Besprechung.*morgen'
        } else {
            $sentence = 'This is a local speech recognition test. The meeting starts tomorrow.'
            $expected = 'speech recognition test'
        }
        $synth.SelectVoice($voice.VoiceInfo.Name)
        $synth.SetOutputToWaveStream($wave)
        $synth.Speak($sentence)
        $synth.SetOutputToNull()
        $audio = [Convert]::ToBase64String($wave.ToArray())
    } catch {
        throw ('Windows konnte keine Testaufnahme mit einer installierten Stimme erzeugen. ' +
            'BlitzDic benoetigt diese Stimme nicht. Das Pruefskript stattdessen mit ' +
            '-WavePath, -Language (de oder en) und -ExpectedText fuer eine vorhandene WAV-Testaufnahme ausfuehren. ' +
            'Ursache: ' + $_.Exception.Message)
    } finally {
        $synth.Dispose()
        $wave.Dispose()
    }
}

foreach ($preset in @('whisper', 'parakeet-ultra')) {
    $modelDirectory = Join-Path $resources "models\$preset"
    if (!(Test-Path -LiteralPath $modelDirectory -PathType Container)) {
        throw "Mitgelieferter Modellordner fehlt: $modelDirectory"
    }
    $request = @{
        action = 'transcribe'
        preset = $preset
        modelDirectory = $modelDirectory
        language = $language
        audioBase64 = $audio
    } | ConvertTo-Json -Compress

    $start = New-Object System.Diagnostics.ProcessStartInfo
    $start.FileName = $worker
    $start.WorkingDirectory = Split-Path -Parent $worker
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardInput = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.EnvironmentVariables['PATH'] = "$env:SystemRoot\System32;$env:SystemRoot"
    $start.EnvironmentVariables['HF_HUB_OFFLINE'] = '1'
    # Windows PowerShell 5.1 writes the console input encoding's BOM into a redirected
    # stdin when the console uses UTF-8 (code page 65001); the worker expects plain JSON.
    $consoleEncoding = [Console]::InputEncoding
    try { [Console]::InputEncoding = New-Object System.Text.UTF8Encoding $false } catch { }
    try { $process = [System.Diagnostics.Process]::Start($start) }
    finally { try { [Console]::InputEncoding = $consoleEncoding } catch { } }
    try {
        $output = $process.StandardOutput.ReadToEndAsync()
        $errors = $process.StandardError.ReadToEndAsync()
        $bytes = [Text.Encoding]::UTF8.GetBytes($request)
        $process.StandardInput.BaseStream.Write($bytes, 0, $bytes.Length)
        $process.StandardInput.Close()
        if (!$process.WaitForExit(120000)) { throw "Zeitlimit fuer $preset erreicht." }
        if ($process.ExitCode -ne 0) { throw "$preset fehlgeschlagen: $($output.Result) $($errors.Result)" }
        $result = ConvertFrom-Json -InputObject $output.Result
        if ($result.text -notmatch $expected) { throw "Unerwarteter Text fuer $preset`: $($result.text)" }
        Write-Output "PASS $preset ($language): $($result.text)"
    } finally {
        if (!$process.HasExited) { $process.Kill(); $process.WaitForExit() }
        $process.Dispose()
    }
}
