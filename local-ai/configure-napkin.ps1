# Stores (or removes) the Napkin AI API key for the AI Visual Builder panel host, for the current Windows user only.
# The key goes to %LOCALAPPDATA%\AIVisualBuilder\napkin.json, readable only by you; it is never put in the panel's
# JavaScript, the shared folder or git. Napkin requests use paid credits; the panel asks before every request.
#   -Remove    deletes the stored key       -Disable / -Enable   keeps the key but turns Napkin off / on
param([switch]$Remove, [switch]$Disable, [switch]$Enable)
$ErrorActionPreference = 'Stop'
$Data = Join-Path $env:LOCALAPPDATA 'AIVisualBuilder'
$File = Join-Path $Data 'napkin.json'
New-Item -ItemType Directory -Force $Data | Out-Null
if ($Remove) { Remove-Item $File -ErrorAction SilentlyContinue; Write-Host 'Napkin AI key removed. Napkin is off.'; exit 0 }
if ($Disable -or $Enable) {
    if (-not (Test-Path $File)) { Write-Host 'No key stored yet.'; exit 1 }
    $j = Get-Content $File -Raw | ConvertFrom-Json; $j.enabled = [bool]$Enable
    $j | ConvertTo-Json | Set-Content $File -Encoding UTF8; Write-Host ("Napkin AI is now " + $(if ($Enable) { 'on' } else { 'off' }) + '.'); exit 0
}
$sec = Read-Host 'Paste your Napkin AI API token (from Napkin > Settings > Developers) and press Enter' -AsSecureString
$key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)).Trim()
if ($key.Length -lt 10) { Write-Host 'That does not look like a token; nothing was saved.' -ForegroundColor Yellow; exit 1 }
@{ api_key = $key; enabled = $true; style_id = '' } | ConvertTo-Json | Set-Content $File -Encoding UTF8
icacls $File /inheritance:r /grant:r "$($env:USERNAME):(R,W)" | Out-Null
Write-Host 'Saved. Napkin AI is on (it uses your Napkin credits; the panel asks before each request).' -ForegroundColor Green
Write-Host 'Restart is not needed: the panel host reads the key on each request.'
