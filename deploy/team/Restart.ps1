# AI Visual Builder (team installation) - restarts the panel host (when the panel says it cannot reach it), or -Status.
param([string]$Instance = 'AIVisualBuilderPilot', [switch]$Status)
. (Join-Path $PSScriptRoot 'common.ps1')
$P = PilotPaths $Instance
$pj = ReadJson $P.Pilot
if (-not $pj) { Say 'AI Visual Builder is not installed for this user. Run Install first.' Red; exit 1 }
if (-not $Status) { [void](StopPilot $P); [void](StartPilot $P $pj.port) }
$s = PilotStatus $pj.port
if (-not $s) { Say "Not running. See $($pj.data_dir)\server.log" Red; exit 1 }
Say "AI Visual Builder $($s.server) is running on https://localhost:$($pj.port)/" Green
if ($s.activation -and -not $s.activation.ok) { Say "Not activated: $($s.activation.message)" Yellow }
elseif ($s.activation.expires) { Say "Activated$(if ($s.activation.label) { " for $($s.activation.label)" }), valid until $($s.activation.expires)." Green }
