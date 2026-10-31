param([string]$OutputDirectory = 'dist/speech', [string]$WorkDirectory = 'build/speech')
$ErrorActionPreference = 'Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
    $projectRoot = (Get-Location).Path
    foreach ($target in @($OutputDirectory, $WorkDirectory)) {
        $full = [IO.Path]::GetFullPath((Join-Path $projectRoot $target))
        if (-not $full.StartsWith($projectRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Build-Ausgabe muss im Projekt bleiben.' }
        if (Test-Path -LiteralPath $full) { throw "Ausgabe existiert bereits: $full. Bitte einen neuen Build-Ordner wählen." }
    }
    New-Item -ItemType Directory -Path $WorkDirectory | Out-Null
    & .runtime/venv/Scripts/python.exe -m PyInstaller --name blitzdic-speech --onedir --distpath $OutputDirectory --workpath (Join-Path $WorkDirectory 'work') --specpath $WorkDirectory --add-data ((Join-Path $projectRoot 'speech/uia_target.ps1') + ';.') --collect-all sherpa_onnx --collect-all onnx_asr --collect-all faster_whisper --collect-all ctranslate2 --collect-all onnxruntime --collect-all tokenizers --collect-all av --collect-all soundfile --copy-metadata huggingface-hub speech/worker.py
    if ($LASTEXITCODE -ne 0) { throw 'Sprach-Laufzeit konnte nicht gebaut werden.' }
} finally { Pop-Location }
