param([Parameter(Mandatory = $true)][string]$Output)
# Compile speech/uia_target.cs with the .NET Framework 4 compiler included in
# Windows. No SDK, download or Visual Studio is involved.
$ErrorActionPreference = 'Stop'
$framework = Join-Path $env:SystemRoot 'Microsoft.NET\Framework64\v4.0.30319'
$wpf = Join-Path $framework 'WPF'
$source = Join-Path (Split-Path $PSScriptRoot -Parent) 'speech\uia_target.cs'
$target = [IO.Path]::GetFullPath($Output)
New-Item -ItemType Directory -Force -Path (Split-Path $target -Parent) | Out-Null
& (Join-Path $framework 'csc.exe') /nologo /target:exe /optimize+ /codepage:65001 "/out:$target" `
    "/reference:$wpf\UIAutomationClient.dll" "/reference:$wpf\UIAutomationTypes.dll" "/reference:$wpf\WindowsBase.dll" `
    /reference:System.Web.Extensions.dll $source
if ($LASTEXITCODE -ne 0) { throw 'UIA-Hilfsprogramm konnte nicht kompiliert werden.' }
Write-Output "UIA-Hilfsprogramm: $target"
