# ADMINISTRATOR / MANAGER - makes the team package in one go (V10.22).
#  First time: makes the activation keys from this PC's Claude and Napkin keys (%LOCALAPPDATA%\AIVisualBuilder) into
#  deploy\team-keys\ (activation-bundle.json = encrypted keys for the package; activation-keys.csv = the list of
#  activation keys to give out, one per person - keep it private). Later runs reuse them, so users stay activated.
#  Then builds Team_Package\AI-Visual-Builder-Team-<version>.zip: the one file to share with the team.
#   -NewKeys   new activation keys and a new bundle (use after rotating the Claude/Napkin keys; everyone activates again)
#   -Count 25 -Expires 2027-03-31 -Names names.txt   (asked when not given)
param([int]$Count, [string]$Expires, [string]$Names, [switch]$NewKeys)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Keys = Join-Path $PSScriptRoot 'team-keys'
$BundlePath = Join-Path $Keys 'activation-bundle.json'
Set-Location $Root
Write-Host ''
Write-Host 'AI Visual Builder - make the team package' -ForegroundColor Cyan
if ($NewKeys -and (Test-Path $Keys)) {
    $old = "$Keys-retired-$(Get-Date -Format yyyyMMdd-HHmmss)"
    Move-Item $Keys $old
    Write-Host "Previous activation keys kept in $old (they stop working once users install the new package)." -ForegroundColor Yellow
}
if (-not (Test-Path $BundlePath)) {
    if (-not $Count) { $c = Read-Host 'How many activation keys? (Enter = 25)'; $Count = $(if ($c) { [int]$c } else { 25 }) }
    if (-not $Expires) { $e = Read-Host 'Valid until (YYYY-MM-DD, Enter = 2027-03-31)'; $Expires = $(if ($e) { $e } else { '2027-03-31' }) }
    $a = @('local-ai\activation.py', 'issue', '--count', "$Count", '--expires', $Expires, '--out', $Keys)
    if ($Names) { $a += @('--names', $Names) }
    & python @a
    if ($LASTEXITCODE -ne 0) { throw 'The activation keys were not made (see above).' }
} else {
    Write-Host "Activation keys: reusing $Keys (activated users stay activated)." -ForegroundColor Green
}
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'build-team-package.ps1') -Bundle $BundlePath
if ($LASTEXITCODE -ne 0) { throw 'The package was not built (see above).' }
Write-Host ''
Write-Host 'Share with the team:  Team_Package\ (the zip and START HERE.txt)' -ForegroundColor Green
Write-Host "Give each person ONE key from:  $Keys\activation-keys.csv  (private: never share the file itself)" -ForegroundColor Green
