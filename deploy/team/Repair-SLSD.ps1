# Brings back the original SL Smart Design tab at once, whatever happened:
#  - this installation hid it (one SL Smart Design tab): the original add-in kept on this PC is put back byte for byte,
#    and the automatic one-tab switch is turned off (run Install again to turn it back on);
#  - the earlier unified / "Easy Pilot" installer replaced it: that installation's own uninstaller puts back what this PC
#    had before it.
# Nothing is copied from this package. PowerPoint must be closed.
param([string]$Instance = 'AIVisualBuilderPilot')
. (Join-Path $PSScriptRoot 'common.ps1')
$P = PilotPaths $Instance
Say ''
Say 'Restore SL Smart Design' Cyan
while (Get-Process POWERPNT -ErrorAction SilentlyContinue) {
    Say 'Save your work and CLOSE PowerPoint, then press Enter (or type S to stop).' Yellow
    if ("$(Read-Host)".Trim().ToUpper() -eq 'S') { exit 1 }
}
$done = $false
$pj = ReadJson $P.Pilot
if ($pj) {
    if ($pj.slsd_unify) { $pj.slsd_unify = $false; WriteJson $P.Pilot $pj }
    [void](StopPilot $P)
    $r = & $P.Python (Join-Path $P.App 'slsd_tab.py') restore --data-dir $pj.data_dir 2>$null | Select-Object -Last 1 | ConvertFrom-Json
    if ($r.done -eq 'restored') { Say 'Original SL Smart Design add-in put back (its own tab is back).' Green; $done = $true }
    [void](StartPilot $P $pj.port)
}
$u = RepairSLSD
if ($u -eq 'repaired') { $done = $true }
if ($done) { Say 'Start PowerPoint: the SL Smart Design tab is back.' Green }
else {
    Say 'Nothing had to be put back: the SL Smart Design add-in on this PC is its original.' Green
    Say 'If its tab is still missing: PowerPoint > File > Options > Add-ins > Manage: PowerPoint Add-ins > Go, and tick SL Smart Design.'
}
