$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$destination = Join-Path $projectRoot '.runtime/german-speech-utf8.wav'
if (Test-Path -LiteralPath $destination) { throw 'Die Testdatei existiert bereits und bleibt unverändert.' }
$voice = $null; $token = $null; $stream = $null
try {
    # Use the already installed classic SAPI token directly. This does not copy
    # or alter machine-wide voice registrations or install any language package.
    $token = New-Object -ComObject SAPI.SpObjectToken
    $token.SetId('HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Speech\Voices\Tokens\TTS_MS_DE-DE_HEDDA_11.0', '', $false)
    $voice = New-Object -ComObject SAPI.SpVoice
    $voice.Voice = $token
    $voice.Rate = 0
    $stream = New-Object -ComObject SAPI.SpFileStream
    $stream.Format.Type = 22 # 22.05 kHz, 16-bit mono PCM
    $stream.Open($destination, 3, $false)
    $voice.AudioOutputStream = $stream
    $voice.Speak('Guten Morgen. Die Besprechung beginnt morgen um neun Uhr. Anna prüft die Unterlagen. Das Budget beträgt zweitausendfünfhundert Euro. Offen bleibt die Lieferung nach Berlin.', 0) | Out-Null
    $stream.Close()
    Write-Output $destination
} finally {
    foreach ($item in @($stream, $voice, $token)) {
        if ($null -ne $item) { [Runtime.InteropServices.Marshal]::FinalReleaseComObject($item) | Out-Null }
    }
}
