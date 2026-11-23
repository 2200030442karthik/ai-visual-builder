# AI Visual Builder (team installation) - enter or change the activation key for this Windows user on this PC.
# The same can be done in PowerPoint: AI Visual Builder asks for the key when it is not activated.
param([string]$Instance = 'AIVisualBuilderPilot', [string]$ActivationKey)
. (Join-Path $PSScriptRoot 'common.ps1')
$P = PilotPaths $Instance
$pj = ReadJson $P.Pilot
if (-not $pj) { Say 'AI Visual Builder is not installed for this user. Run Install first.' Red; exit 1 }
Say ''
Say 'AI Visual Builder - activation' Cyan
$ok = ActivateInteractive $P $pj.data_dir $ActivationKey
if ($ok) { [void](StopPilot $P); [void](StartPilot $P $pj.port); Say 'Open AI Visual Builder in PowerPoint (if it was open, close the panel and open it again).' Green }
exit $(if ($ok) { 0 } else { 1 })
