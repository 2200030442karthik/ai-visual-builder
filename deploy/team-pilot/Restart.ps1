# AI Visual Builder (Pilot) - restarts the panel host (if the panel says it cannot reach it), or -Status.
param([string]$Instance = 'AIVisualBuilderPilot', [switch]$Status)
. (Join-Path $PSScriptRoot 'common.ps1')
$P = PilotPaths $Instance
$pj = ReadJson $P.Pilot
if (-not $pj) { Say 'AI Visual Builder (Pilot) is not installed for this user. Run Install first.' Red; exit 1 }
if (-not $Status) { [void](StopPilot $P); [void](StartPilot $P $pj.port) }
$s = PilotStatus $pj.port
if ($s) { Say "AI Visual Builder $($s.server) is running on https://localhost:$($pj.port)/ ($(@(PilotHosts $P).Count) process)." Green }
else { Say "Not running. See $($pj.data_dir)\server.log" Red; exit 1 }
