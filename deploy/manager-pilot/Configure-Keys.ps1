# AI Visual Builder (Pilot) - adds or replaces the organization's Napkin and Claude keys for this Windows user.
#   -Status   shows whether keys are stored (never the keys)      -Remove   deletes both stored keys
param([string]$Instance = 'AIVisualBuilderPilot', [switch]$Status, [switch]$Remove)
. (Join-Path $PSScriptRoot 'common.ps1')
$P = PilotPaths $Instance
$pj = ReadJson $P.Pilot
if (-not $pj) { Say 'AI Visual Builder (Pilot) is not installed for this user. Run Install first.' Red; exit 1 }
$dd = $pj.data_dir
if ($Remove) { Remove-Item (Join-Path $dd 'napkin.json'), (Join-Path $dd 'claude.json') -ErrorAction SilentlyContinue; Say 'Both keys removed.'; exit 0 }
if (-not $Status) { ConfigureKeys $dd }
$s = PilotStatus $pj.port
if (-not $s) { Say 'The panel host is not running: run "Restart AI Visual Builder.bat".' Yellow; exit 0 }
Say ("Napkin AI: " + $(if ($s.napkin.configured) { 'key stored' } else { 'no key' }) + "; Claude: " + $(if ($s.claude.configured) { "key stored, model $($s.claude.model)" } else { 'no key' }))
Say 'The panel host reads the keys on every request; close and reopen the AI Visual Builder panel in PowerPoint.'
