param([string]$OutputDirectory = 'dist/speech', [string]$WorkDirectory = 'build/speech')
$ErrorActionPreference = 'Stop'
$originalBuildPath = $env:PATH
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
    $projectRoot = (Get-Location).Path
    # PyInstaller resolves transitive DLLs through PATH. Do not inherit unrelated
    # tool caches, applications or developer SDK runtime directories.
    $pythonBase = & .runtime/venv/Scripts/python.exe -c 'import sys; print(sys.base_prefix)'
    if ($LASTEXITCODE -ne 0) { throw 'Python-Basispfad konnte nicht ermittelt werden.' }
    $env:PATH = @((Join-Path $projectRoot '.runtime/venv/Scripts'), $pythonBase,
        (Join-Path $pythonBase 'DLLs'), (Join-Path $env:SystemRoot 'System32'),
        $env:SystemRoot, (Join-Path $env:SystemRoot 'System32/Wbem')) -join ';'
    foreach ($target in @($OutputDirectory, $WorkDirectory)) {
        $full = [IO.Path]::GetFullPath((Join-Path $projectRoot $target))
        if (-not $full.StartsWith($projectRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Build-Ausgabe muss im Projekt bleiben.' }
        if (Test-Path -LiteralPath $full) { throw "Ausgabe existiert bereits: $full. Bitte einen neuen Build-Ordner wählen." }
    }
    New-Item -ItemType Directory -Path $WorkDirectory | Out-Null
    & .runtime/venv/Scripts/python.exe -m PyInstaller --name blitzdic-speech --onedir --distpath $OutputDirectory --workpath (Join-Path $WorkDirectory 'work') --specpath $WorkDirectory --add-data ((Join-Path $projectRoot 'speech/uia_target.ps1') + ';.') --collect-all sherpa_onnx --collect-all onnx_asr --collect-all faster_whisper --additional-hooks-dir speech/build-hooks --collect-all onnxruntime --collect-all tokenizers --collect-all av --copy-metadata huggingface-hub speech/worker.py
    if ($LASTEXITCODE -ne 0) { throw 'Sprach-Laufzeit konnte nicht gebaut werden.' }
} finally { $env:PATH = $originalBuildPath; Pop-Location }
