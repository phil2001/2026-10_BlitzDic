$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/test-uia-compile.ps1"
function Invoke-UiaHelper($request, [int]$expectedExit = 0) {
    $output = $request | ConvertTo-Json -Compress | & $script:UiaHelper
    if ($LASTEXITCODE -ne $expectedExit) { throw "UIA helper exit $LASTEXITCODE`: $output" }
    $output | ConvertFrom-Json
}
try {
    # Impossible HWND: prove rejection before querying any application's UIA element.
    $scope = [Int64]::MaxValue
    $result = Invoke-UiaHelper @{ action = 'capture'; website = $true; scope = @{ window = $scope; process = 1 } }
    if ($null -ne $result.signature -or $null -ne $result.websiteHost -or
            $result.reason -notin @('Vordergrundfenster geändert', 'Kein Vordergrundfenster')) {
        throw 'A mismatched window must be rejected before UIA capture.'
    }
    $result = Invoke-UiaHelper @{ action = 'insert'; signature = "${scope}:1:0:0:0:invalid"; text = 'must not be inserted' }
    if ($result.inserted -ne $false) { throw 'Insertion accepted a mismatched window.' }
    $result = Invoke-UiaHelper @{ action = 'capture'; scope = @{ window = 0; process = 0 } }
    if ($null -ne $result.signature -or $result.reason -ne 'Ungültiger Fensterbereich') { throw 'Invalid window scope was accepted.' }
    $result = Invoke-UiaHelper @{ action = 'unknown' } 1
    if (-not $result.error) { throw 'Unknown helper action did not fail cleanly.' }
    Write-Output 'PASS: invalid/mismatched capture and insertion scopes rejected without reading application elements.'
} finally {
    Remove-Item -LiteralPath $script:UiaDirectory -Recurse -Force -ErrorAction SilentlyContinue
}
