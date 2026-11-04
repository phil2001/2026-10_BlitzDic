param([string]$Uv = 'uv', [string]$CleanAvWheel = '', [switch]$AllowUpstreamAvForBuild,
      [string]$RuyArtifactDirectory = '')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot
try {
    if (!$CleanAvWheel) { $CleanAvWheel = Join-Path $projectRoot '.runtime/native-wheels/av-16.0.1+blitzdic.1-cp312-cp312-win_amd64.whl' }
    $cleanAvailable = Test-Path -LiteralPath $CleanAvWheel
    if (!$cleanAvailable -and !$AllowUpstreamAvForBuild) {
        throw 'Clean FFmpeg wheel missing. Follow licenses/native/BUILD_FFMPEG.md first. -AllowUpstreamAvForBuild is only for preparing build tools, not packaging.'
    }
    $venv = '.runtime/venv'
    $ruyWheel = $null
    if ($RuyArtifactDirectory) {
        $wheels = @(Get-ChildItem -LiteralPath $RuyArtifactDirectory -Filter 'ctranslate2-*-cp312-cp312-win_amd64.whl' -File)
        if ($wheels.Count -ne 1) { throw 'Das Ruy-Artefakt muss genau ein passendes Windows-Wheel enthalten.' }
        $ruyWheel = $wheels[0].FullName
        $hash = (Get-FileHash -LiteralPath $ruyWheel -Algorithm SHA256).Hash
        $provenance = Get-Content -LiteralPath (Join-Path $RuyArtifactDirectory 'build-provenance.txt')
        if ('CTranslate2: 5de572ef60b67a0276c5989ee73d0072808ff4c3' -notin $provenance -or
            "Wheel SHA-256: $hash" -notin $provenance -or
            'Experimental Windows x64 CPU wheel. Ruy ON, MKL OFF, DNNL OFF, OpenMP NONE.' -notin $provenance) {
            throw 'Ruy-Wheel, Buildprofil und Herkunftsmanifest stimmen nicht überein.'
        }
        $venv = '.runtime/venv-ruy-' + $hash.Substring(0, 12).ToLowerInvariant()
        if (Test-Path -LiteralPath $venv) { throw "Ruy-Umgebung existiert bereits: $venv. Für den Build die vorhandene Umgebung auswählen." }
    }
    $env:UV_PYTHON_INSTALL_DIR = Join-Path $projectRoot '.runtime/python'
    $env:UV_CACHE_DIR = Join-Path $projectRoot '.runtime/cache'
    $python = "$venv/Scripts/python.exe"
    if (-not (Test-Path -LiteralPath $python)) {
        & $Uv venv --python 3.12.12 $venv
        if ($LASTEXITCODE -ne 0) { throw 'Python-Einrichtung fehlgeschlagen.' }
    }
    $installArguments = @('pip', 'install', '--python', $python, '-r', 'speech/requirements.lock.txt')
    if ($cleanAvailable) { $installArguments += $CleanAvWheel }
    if ($ruyWheel) { $installArguments += $ruyWheel }
    & $Uv @installArguments
    if ($LASTEXITCODE -ne 0) { throw 'Installation der Spracherkennung fehlgeschlagen.' }
    & $python -c 'import faster_whisper, onnx_asr'
    if ($LASTEXITCODE -ne 0) { throw 'Laufzeitprüfung fehlgeschlagen.' }
    Write-Output "Spracherkennung bereit: $python"
} finally { Pop-Location }
