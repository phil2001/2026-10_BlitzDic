$ErrorActionPreference = 'Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
    & .runtime/venv/Scripts/python.exe -m PyInstaller --name blitzdic-speech --onedir --distpath dist/speech --workpath build/speech --specpath build --collect-all onnx_asr --collect-all faster_whisper --collect-all ctranslate2 --collect-all onnxruntime --collect-all tokenizers --collect-all av --collect-all soundfile --copy-metadata huggingface-hub speech/worker.py
    if ($LASTEXITCODE -ne 0) { throw 'Sprach-Laufzeit konnte nicht gebaut werden.' }
} finally { Pop-Location }
