# Real-PowerPoint validation on the development PC (ONLY with the owner's approval): temporarily parks the development
# SL Smart Design tab registration, so the installed product can be tested without showing two tabs, and puts it back.
# Touches exactly one registry key: HKCU\...\Office\16.0\WEF\TrustedCatalogs\{5D7F6C1E-3B1A-4E5C-9C2E-51D051500001}.
# Nothing else of the development setup changes (its service, files, add-ins and Office cache stay as they are).
#   -Action Park      exports the key to -Backup, then removes it (PowerPoint must be closed)
#   -Action Restore   imports the exported key again and checks it
#   -Action Status    shows whether it is registered
param([ValidateSet('Park', 'Restore', 'Status')][string]$Action = 'Status',
      [string]$Backup = (Join-Path $env:LOCALAPPDATA 'SLSmartDesign-validation\dev-catalog.reg'))
$ErrorActionPreference = 'Stop'
$Key = 'HKCU:\Software\Microsoft\Office\16.0\WEF\TrustedCatalogs\{5D7F6C1E-3B1A-4E5C-9C2E-51D051500001}'
$RegPath = 'HKCU\Software\Microsoft\Office\16.0\WEF\TrustedCatalogs\{5D7F6C1E-3B1A-4E5C-9C2E-51D051500001}'
function Show { if (Test-Path $Key) { $p = Get-ItemProperty $Key; Write-Host "Development registration: present ($($p.Url))" } else { Write-Host 'Development registration: parked (not present)' } }
if ($Action -eq 'Status') { Show; exit 0 }
if (Get-Process POWERPNT -ErrorAction SilentlyContinue) { throw 'Close PowerPoint first.' }
if ($Action -eq 'Park') {
    if (-not (Test-Path $Key)) { throw 'The development registration is not present (already parked?).' }
    New-Item -ItemType Directory -Force (Split-Path $Backup) | Out-Null
    if (Test-Path $Backup) { throw "A parked registration already exists ($Backup). Restore it first." }
    & reg.exe export $RegPath $Backup /y | Out-Null
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $Backup)) { throw 'Export failed; nothing was changed.' }
    Remove-Item -Path $Key -Recurse
    Write-Host "Parked. Exported to $Backup" -ForegroundColor Green
} else {
    if (-not (Test-Path $Backup)) { throw "Nothing parked ($Backup not found)." }
    $ErrorActionPreference = 'Continue'            # reg.exe reports success on its error stream
    $null = & reg.exe import $Backup 2>&1
    $ErrorActionPreference = 'Stop'
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $Key)) { throw 'Import failed.' }
    Rename-Item $Backup ($Backup + '.restored-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
    Write-Host 'Restored.' -ForegroundColor Green
}
Show
