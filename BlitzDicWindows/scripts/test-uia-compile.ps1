$ErrorActionPreference = 'Stop'
# Compile only: do not inspect the foreground application or send any input.
$bridge = Get-Content -LiteralPath "$PSScriptRoot/../speech/uia_target.ps1" -Raw
$source = [regex]::Match($bridge, "(?s)-TypeDefinition @'\r?\n(.*?)\r?\n'@").Groups[1].Value
if (-not $source) { throw 'UIA bridge C# definition not found.' }
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
Add-Type -ReferencedAssemblies UIAutomationClient, UIAutomationTypes -TypeDefinition $source
Write-Output 'Windows PowerShell UIA bridge compiles.'
