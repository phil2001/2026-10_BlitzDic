$ErrorActionPreference = 'Stop'
# Spell-check guard of the term correction: blitzdic-uia.exe --spell-service answers one
# JSON line per request. English is present on every Windows; German only where installed,
# otherwise the service must answer with its error instead of guessing.
. "$PSScriptRoot/test-uia-compile.ps1"
$start = New-Object Diagnostics.ProcessStartInfo $script:UiaHelper, '--spell-service'
$start.UseShellExecute = $false; $start.RedirectStandardInput = $true; $start.RedirectStandardOutput = $true
$start.StandardOutputEncoding = New-Object Text.UTF8Encoding($false)
$process = [Diagnostics.Process]::Start($start)
$writer = New-Object IO.StreamWriter($process.StandardInput.BaseStream, (New-Object Text.UTF8Encoding($false)))
function Ask($request) {
    $writer.WriteLine(($request | ConvertTo-Json -Compress)); $writer.Flush()
    return $process.StandardOutput.ReadLine() | ConvertFrom-Json
}
try {
    # Windows Server images (CI) may lack the spelling feature; then only the error path is checked.
    $english = Ask @{ language = 'en'; words = @('pneumonia', 'pnemonia', 'infection') }
    if ($english.error) { Write-Output "Englisch nicht installiert: $($english.error)" }
    elseif (($english.misspelled -join ',') -ne 'pnemonia') { throw "Englisch: unerwartet $($english | ConvertTo-Json -Compress)" }
    $german = Ask @{ language = 'de'; words = @('Infektion', 'infektion', 'Apexaban', 'Metoprool') }
    if ($german.error) { Write-Output "Deutsch nicht installiert: $($german.error)" }
    elseif (($german.misspelled -join ',') -ne 'Apexaban,Metoprool') { throw "Deutsch: unerwartet $($german | ConvertTo-Json -Compress)" }
    else { Write-Output "Deutsch ($($german.language)) erkennt Fehler und lässt richtige Wörter in jeder Schreibung stehen." }
    $broken = Ask @{ language = 'de' }
    if (-not $broken.error) { throw 'Eine Anfrage ohne Wortliste muss mit Fehler beantwortet werden.' }
} finally {
    $writer.Close()
    if (-not $process.WaitForExit(5000)) { $process.Kill(); throw 'Rechtschreibdienst endet nicht nach geschlossener Eingabe.' }
    Remove-Item -Recurse -Force $script:UiaDirectory -ErrorAction SilentlyContinue
}
Write-Output 'Spell service: English and German checks answered, ends when its input closes.'
