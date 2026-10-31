"""Package the CPU inference dependencies; omit the unused CUDA cuDNN loader.

BlitzDic explicitly selects device='cpu'. CTranslate2's v4.8.4 Windows recipe
also sets WITH_CUDNN=OFF but copies this GPU loader into its wheel. Retain its
actual CPU engine and OpenMP runtime. The frozen-package tests verify CPU ASR.
"""
from pathlib import Path
from PyInstaller.utils.hooks import collect_all

datas, binaries, hiddenimports = collect_all('ctranslate2')
binaries = [(source, destination) for source, destination in binaries
            if Path(source).name.lower() != 'cudnn64_9.dll']
datas = [(source, destination) for source, destination in datas
         if Path(source).name.lower() != 'cudnn64_9.dll']
