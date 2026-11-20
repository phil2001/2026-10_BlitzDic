$ErrorActionPreference = 'Stop'
# Compile only: do not inspect the foreground application or send any input.
$script:UiaDirectory = Join-Path ([IO.Path]::GetTempPath()) ('blitzdic-uia-' + [guid]::NewGuid())
$script:UiaHelper = Join-Path $script:UiaDirectory 'blitzdic-uia.exe'
& "$PSScriptRoot/build-uia.ps1" -Output $script:UiaHelper | Out-Null
Write-Output 'UIA helper compiles with the .NET Framework compiler included in Windows.'
