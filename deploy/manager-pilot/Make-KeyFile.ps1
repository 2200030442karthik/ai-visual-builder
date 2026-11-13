# AI Visual Builder (Pilot) - for the ADMINISTRATOR only. Writes AIVB-keys.json (the organization's Napkin and Claude
# keys) so that "Install AI Visual Builder.bat" sets up the AI services without asking the user anything.
#   1. Run this on your own PC; type the keys (hidden).
#   2. Put AIVB-keys.json next to "Install AI Visual Builder.bat" on the user's PC only for the installation (bring it
#      yourself or through an approved secure channel). The installer imports it for that Windows user and deletes it.
#   Never put AIVB-keys.json in the shared OneDrive/SharePoint folder or in email with the package.
param([string]$Out = $PSScriptRoot)
. (Join-Path $PSScriptRoot 'common.ps1')
$n = ReadSecret 'Napkin AI API token (Enter to leave out)'
$c = ReadSecret 'Anthropic (Claude) API key, sk-ant-... (Enter to leave out)'
if ($c -and -not $c.StartsWith('sk-ant-')) { Say 'That does not look like an Anthropic key (sk-ant-...); nothing was written.' Red; exit 1 }
if (-not $n -and -not $c) { Say 'No key given; nothing was written.' Yellow; exit 1 }
$f = Join-Path $Out 'AIVB-keys.json'
WriteJson $f ([ordered]@{ napkin_api_key = $n; anthropic_api_key = $c }) -Private
Say "Written: $f (readable only by you). Use it for one installation; the installer deletes it." Green
