param([string]$Uv = 'uv', [string]$CleanAvWheel = '', [switch]$AllowUpstreamAvForBuild)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot
try {
    if (!$CleanAvWheel) { $CleanAvWheel = Join-Path $projectRoot '.runtime/native-wheels/av-16.0.1+blitzdic.1-cp312-cp312-win_amd64.whl' }
    $cleanAvailable = Test-Path -LiteralPath $CleanAvWheel
    if (!$cleanAvailable -and !$AllowUpstreamAvForBuild) {
        throw 'Clean FFmpeg wheel missing. Follow licenses/native/BUILD_FFMPEG.md first. -AllowUpstreamAvForBuild is only for preparing build tools, not packaging.'
    }
    $env:UV_PYTHON_INSTALL_DIR = Join-Path $projectRoot '.runtime/python'
    $env:UV_CACHE_DIR = Join-Path $projectRoot '.runtime/cache'
    if (-not (Test-Path '.runtime/venv/Scripts/python.exe')) {
        & $Uv venv --python 3.12.12 .runtime/venv
        if ($LASTEXITCODE -ne 0) { throw 'Python-Einrichtung fehlgeschlagen.' }
    }
    $installArguments = @('pip', 'install', '--python', '.runtime/venv/Scripts/python.exe', '-r', 'speech/requirements.lock.txt')
    if ($cleanAvailable) { $installArguments += $CleanAvWheel }
    & $Uv @installArguments
    if ($LASTEXITCODE -ne 0) { throw 'Installation der Spracherkennung fehlgeschlagen.' }
    & .runtime/venv/Scripts/python.exe -c 'import faster_whisper, onnx_asr'
    if ($LASTEXITCODE -ne 0) { throw 'Laufzeitprüfung fehlgeschlagen.' }
    Write-Output 'Spracherkennung bereit.'
} finally { Pop-Location }
