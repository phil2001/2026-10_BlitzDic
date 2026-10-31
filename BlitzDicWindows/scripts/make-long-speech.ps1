$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$projectRoot = Split-Path $PSScriptRoot -Parent
$destination = Join-Path $projectRoot '.runtime/long-speech.wav'
if (Test-Path -LiteralPath $destination) { throw 'Testdatei existiert bereits; bitte einen neuen Dateinamen im Skript wählen.' }
$synth = [System.Speech.Synthesis.SpeechSynthesizer]::new()
try {
    $voice = $synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -eq 'en-US' } | Select-Object -First 1
    if (-not $voice) { throw 'Dieser synthetische Test benötigt eine installierte englische Windows-Stimme.' }
    $synth.SelectVoice($voice.VoiceInfo.Name)
    $synth.Rate = -1
    $synth.SetOutputToWaveFile($destination)
    $prompt = [System.Speech.Synthesis.PromptBuilder]::new([Globalization.CultureInfo]::new('en-US'))
    foreach ($item in @('apples', 'bananas', 'oranges', 'pears', 'lemons', 'grapes')) {
        $prompt.AppendText("The next report concerns $item. The team has reviewed the documents and approved the budget. The meeting will continue tomorrow morning. Please preserve this information in the written report. There are no further questions about $item.")
        $prompt.AppendBreak([TimeSpan]::FromMilliseconds(400))
    }
    $synth.Speak($prompt)
} finally { $synth.Dispose() }
Write-Output $destination
