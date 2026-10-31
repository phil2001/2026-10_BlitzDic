# Saubere FFmpeg-Laufzeit bauen

Diese Anleitung betrifft ausschließlich die Entwicklung/Paketierung unter
Windows 11 x64. Nutzer des vollständigen Installers benötigen diese Werkzeuge nicht.

Das offizielle PyAV-16.0.1-Windows-Wheel verwendet FFmpeg-Vendorbuild 8.0-2.
Dessen Konfigurationspatch verschiebt x264/x265 aus der GPL-Liste; seine angezeigte
LGPL-Zeichenfolge ist daher keine ausreichende Freigabegrundlage. Der lokale
Herkunftsvergleich ist in `provenance/av-16.0.1-windows-vendor.json` dokumentiert.
Neue Windows-Pakete verlangen stattdessen die unten beschriebene Konfiguration.

## Geprüfte Eingaben

| Eingabe | SHA-256 |
| --- | --- |
| MSYS2 `msys2-base-x86_64-20260927.tar.xz` | `ea2f31a0b6ade63914ce441ffb022f0f6aa96982bfefa2326460a26d5fb01322` |
| FFmpeg `ffmpeg-8.0.3.tar.xz` | `6136812ea6d4e68bdba27e33c2a94382711cdf4f8602ffef056ff792bd6f9818` |
| PyAV `av-16.0.1-cp312-cp312-win_amd64.whl` | `0c669b6b6668c8ae74451c15ec6d6d8a36e4c3803dc5d9910f607a174dd18f17` |

Quellen:

- [MSYS2-Basis und veröffentlichte Prüfsumme](https://github.com/msys2/msys2-installer/releases/tag/2026-09-27)
- [FFmpeg-Quellcode](https://ffmpeg.org/releases/ffmpeg-8.0.3.tar.xz),
  [Signatur](https://ffmpeg.org/releases/ffmpeg-8.0.3.tar.xz.asc),
  [Release-Schlüssel](https://ffmpeg.org/ffmpeg-devel.asc)
- [PyAV-Wheel](https://files.pythonhosted.org/packages/15/37/c7811eca0f318d5fd3212f7e8c3d8335f75a54907c97a89213dc580b8056/av-16.0.1-cp312-cp312-win_amd64.whl)
- [PyPI-Metadaten und Prüfsummen](https://pypi.org/pypi/av/16.0.1/json)

Die FFmpeg-Signatur wurde mit dem auf der offiziellen Downloadseite angegebenen
Fingerabdruck `FCF986EA15E6E293A5644F10B4322F04D67658D8` erfolgreich geprüft.
Der Quellcode bleibt unverändert; insbesondere wird der Vendor-Konfigurationspatch
nicht angewendet. FFmpeg 8.0.3 verwendet dieselben DLL-Hauptversionen wie das Wheel.

## Ablauf

Alle relativen Pfade beziehen sich auf `BlitzDicWindows`. Downloads vor dem
Entpacken mit den obigen SHA-256-Werten prüfen; Archive und alte Builds aufbewahren.

1. Die Dateien FFmpeg-Quellcode und PyAV-Wheel unter `.runtime/native-provenance/`
   mit ihren obigen Dateinamen bereitstellen. Für eine erste Build-Umgebung kann
   `scripts/setup-speech.ps1 -AllowUpstreamAvForBuild` verwendet werden. Dieses
   erlaubt das ursprüngliche Wheel ausdrücklich nur für die Vorbereitung. Darin
   `uv pip install --python .runtime/venv/Scripts/python.exe pefile==2024.8.26` ausführen.
2. Die geprüfte MSYS2-Basis in einen neuen Projekt-Unterordner
   `.runtime/toolchains/msys2-20260927/` entpacken. Das ergibt `msys64/` darunter.
   MSYS2 mit `MSYSTEM=UCRT64` und `CHERE_INVOKING=yes` starten. Mit
   `pacman --noconfirm -Syu` aktualisieren; ein erforderliches Schließen nach dem
   Kernupdate abwarten und danach in einem neuen Bash-Prozess fortfahren.
3. `pacman --noconfirm -Syu --needed mingw-w64-ucrt-x86_64-gcc mingw-w64-ucrt-x86_64-nasm make diffutils`
   installiert die Build-Werkzeuge nur in dieser portablen Umgebung.

Beispiel aus PowerShell nach dem Einrichten dieser Umgebung:

```powershell
$env:MSYSTEM = 'UCRT64'
$env:CHERE_INVOKING = 'yes'
& .runtime/toolchains/msys2-20260927/msys64/usr/bin/bash.exe -lc 'bash scripts/build-ffmpeg-lgpl.sh "$PWD/.runtime/native-build/ffmpeg-lgpl-run1"'
.runtime/venv/Scripts/python.exe scripts/relink-pyav-lgpl.py .runtime/native-build/ffmpeg-lgpl-run1 .runtime/native-wheels
```

Der erste Befehl verlangt einen neuen Build-Ordner. Der zweite überschreibt kein
vorhandenes Wheel; für weitere Varianten einen neuen Ausgabeordner angeben.
Der geprüfte Build verwendete GCC 16.2.0 und NASM 3.02. Die vollständigen tatsächlich
aufgelösten Paketversionen stehen in `build-packages.txt`; ein späterer Pacman-Lauf
kann andere Versionen liefern. Bitidentische Neubauten werden nicht behauptet.

`relink-pyav-lgpl.py` prüft die Original-Wheel-Prüfsumme, die FFmpeg-Konfiguration
und alle ausführbaren PE-Abschnitte. Es ändert ausschließlich Importnamen und
PE-Prüfsummen der 48 PyAV-Erweiterungen sowie Paketmetadaten. FFmpeg-DLLs behalten
ihre üblichen Namen. Die Abhängigkeit `libwinpthread-1.dll` stammt aus derselben
Compiler-Umgebung; ihre MIT-Lizenz sowie CRT-/GCC-Laufzeittexte sind enthalten.

Das Ergebnis heißt `av-16.0.1+blitzdic.1-cp312-cp312-win_amd64.whl`. Darin befinden
sich acht native DLLs, der unveränderte FFmpeg-Quellcode, Lizenztexte,
Konfigurationsausgabe, Build-Skript und ein Hash-Manifest. Die vollständigen
Quellcode-/Lizenzdaten liegen in `av-*.dist-info/licenses/blitzdic-ffmpeg/` und
werden vom Windows-Build in dessen Lizenzordner übernommen.

Die vorherige `.runtime/venv` bei Bedarf als Sicherung innerhalb des Projekts
verschieben und eine frische Laufzeit mit `scripts/setup-speech.ps1` anlegen.
Standardmäßig nimmt dieses Skript das Wheel unter `.runtime/native-wheels/`;
`-CleanAvWheel` erlaubt einen ausdrücklich angegebenen anderen Pfad. Anschließend:

```powershell
uv pip install --python .runtime/venv/Scripts/python.exe pyinstaller==6.22.3
npm.cmd run build:win
```

Die Paketierung prüft `--disable-gpl`, `--disable-nonfree`, `--disable-version3`,
`--disable-autodetect`, die LGPL-2.1-Laufzeitmeldung und das Fehlen der
x264-/x265-DLLs. Diese Schranke ersetzt keine Prüfung aller anderen Abhängigkeiten.
Audiodateien in M4A/AAC und WebM/Opus, beide ASR-Modelle, Sprechertranskription,
Deutsch und Unicode-Dateipfade wurden mit dem Ersatz getestet.
