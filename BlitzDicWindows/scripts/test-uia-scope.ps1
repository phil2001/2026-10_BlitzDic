$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/test-uia-compile.ps1"
# Impossible HWND: prove rejection before querying any application's UIA element.
$scope = [Int64]::MaxValue
$result = [BlitzDicUia]::CaptureScoped($scope, 1)
if (-not [String]::IsNullOrEmpty($result) -or [BlitzDicUia]::Reason -notin @('Vordergrundfenster geändert', 'Kein Vordergrundfenster')) {
    throw 'A mismatched window must be rejected before UIA capture.'
}
if ([BlitzDicUia]::Insert("${scope}:1:0:0:0:invalid", 'must not be inserted')) {
    throw 'Insertion accepted a mismatched window.'
}
if (-not [String]::IsNullOrEmpty([BlitzDicUia]::CaptureScoped(0, 0)) -or [BlitzDicUia]::Reason -ne 'Ungültiger Fensterbereich') {
    throw 'Invalid window scope was accepted.'
}
Write-Output 'PASS: invalid/mismatched capture and insertion scopes rejected without reading application elements.'
