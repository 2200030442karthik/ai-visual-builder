# SL Smart Design - rolls back the last installation or update for this Windows user:
#  - the add-in files and registrations are put back exactly as they were before it (backups\<latest>)
#  - after an update: the previous program version (previous\) is put back and started
#  - after a first installation: there is no previous version; use Uninstall instead (it restores the original state)
param([string]$Instance = 'SLSmartDesign')
. (Join-Path $PSScriptRoot 'common.ps1')
. (Join-Path $PSScriptRoot 'slsd-common.ps1')
$P = PilotPaths $Instance
$st = ReadJson $P.State
Say ''
Say 'SL Smart Design - roll back the last installation' Cyan
if (-not $st) { Say 'SL Smart Design is not installed for this user.' Red; exit 1 }
$T = OfficeTargets $st.office_root $st.addins_dir
if ($T.Real -and (Get-Process POWERPNT -ErrorAction SilentlyContinue)) { Say 'Close PowerPoint first, then run Roll back again.' Red; exit 1 }
$prev = Join-Path $P.Dest 'previous'
if (-not (Test-Path (Join-Path $prev 'app\server.py'))) {
    Say 'There is no earlier version to go back to (this was the first installation). To remove SL Smart Design and restore the original state, run "Uninstall SL Smart Design.bat".' Yellow
    exit 1
}
$latest = (Get-Content (Join-Path $P.Dest 'backups\latest.txt') -ErrorAction SilentlyContinue | Select-Object -First 1)
$bak = Join-Path $P.Dest "backups\$latest"
if (-not $latest -or -not (Test-Path (Join-Path $bak 'state.json'))) { Say 'The backup of the last installation was not found.' Red; exit 1 }

[void](StopPilot $P)
RestoreState $bak
Say "Add-ins and registrations: restored to the state before the last installation ($latest)." Green
foreach ($d in 'app', 'runtime') {
    $cur = Join-Path $P.Dest $d; $old = Join-Path $prev $d
    if (Test-Path $old) { if (Test-Path $cur) { Remove-Item $cur -Recurse -Force }; Move-Item $old $cur }
}
$prevState = ReadJson (Join-Path $prev 'install-state.json')
if ($prevState) { WriteJson $P.State $prevState }
Remove-Item $prev -Recurse -Force
Remove-Item (Join-Path $P.Dest 'backups\latest.txt') -ErrorAction SilentlyContinue      # a second roll back has nothing to undo
$pj = ReadJson $P.Pilot
$port = $(if ($pj) { $pj.port } else { $st.port })
[void](WaitPortFree $port)
$s = StartPilot $P $port
if ($s) { Say "The previous version is back: panel host $($s.server) running." Green; Say 'Start PowerPoint again.' }
else { Say "The previous version did not start; see $($st.data_dir)\server.log." Red; exit 1 }
