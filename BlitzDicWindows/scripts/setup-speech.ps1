param([string]$Uv = 'uv')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot
try {
    $env:UV_PYTHON_INSTALL_DIR = Join-Path $projectRoot '.runtime/python'
    $env:UV_CACHE_DIR = Join-Path $projectRoot '.runtime/cache'
    if (-not (Test-Path '.runtime/venv/Scripts/python.exe')) {
        & $Uv venv --python 3.12.12 .runtime/venv
        if ($LASTEXITCODE -ne 0) { throw 'Python-Einrichtung fehlgeschlagen.' }
    }
    & $Uv pip install --python .runtime/venv/Scripts/python.exe -r speech/requirements.lock.txt
    if ($LASTEXITCODE -ne 0) { throw 'Installation der Spracherkennung fehlgeschlagen.' }
    & .runtime/venv/Scripts/python.exe -c 'import faster_whisper, onnx_asr; print("Spracherkennung bereit.")'
    if ($LASTEXITCODE -ne 0) { throw 'Laufzeitprüfung fehlgeschlagen.' }
} finally { Pop-Location }
