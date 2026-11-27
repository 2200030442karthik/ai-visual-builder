# Stores (or removes) the Anthropic API key for Claude AI in the AI Visual Builder panel host, for the current Windows user
# only. The key goes to %LOCALAPPDATA%\AIVisualBuilder\claude.json, readable only by you; it is never put in the panel's
# JavaScript, the shared folder, logs or git. Claude requests are billed to your Anthropic account; the panel asks before
# each one (one request per variation, no automatic retries, no fallback model).
#   (no switch)          asks for the key (hidden input) and stores it; existing settings are kept
#   -Remove              deletes the stored key (Claude off)       -Disable / -Enable   keeps the key, turns Claude off / on
#   -Model <id>          model (default claude-opus-5-5)           -Effort <level>      low|medium|high|xhigh|max (default high)
#   -MaxTokens <n>       output cap per variation (default 32000)  -Status              shows the settings (never the key)
param([switch]$Remove, [switch]$Disable, [switch]$Enable, [switch]$Status, [string]$Model,
      [ValidateSet('low', 'medium', 'high', 'xhigh', 'max')][string]$Effort, [int]$MaxTokens)
$ErrorActionPreference = 'Stop'
$Data = Join-Path $env:LOCALAPPDATA 'AIVisualBuilder'
$File = Join-Path $Data 'claude.json'
New-Item -ItemType Directory -Force $Data | Out-Null

function Load { if (Test-Path $File) { Get-Content $File -Raw | ConvertFrom-Json } else { $null } }
function Save($j) {   # UTF-8 without byte-order mark, readable only by this user
    [IO.File]::WriteAllText($File, ($j | ConvertTo-Json), (New-Object Text.UTF8Encoding $false))
    icacls $File /inheritance:r /grant:r "$($env:USERNAME):(R,W)" | Out-Null
}
function SetProp($j, $name, $value) { $j | Add-Member -NotePropertyName $name -NotePropertyValue $value -Force }
function Show($j) {
    if (-not $j) { Write-Host 'Claude AI: not configured (no key stored).'; return }
    $on = $j.enabled -ne $false
    Write-Host ("Claude AI: key stored ({0} characters), {1}; model {2}, effort {3}, max tokens {4}." -f $j.api_key.Length, $(if ($on) { 'on' } else { 'off' }),
        $(if ($j.model) { $j.model } else { 'claude-opus-5-5' }), $(if ($j.effort) { $j.effort } else { 'high' }), $(if ($j.max_tokens) { $j.max_tokens } else { 32000 }))
}

if ($Status) { Show (Load); exit 0 }
if ($Remove) { Remove-Item $File -ErrorAction SilentlyContinue; Write-Host 'Claude API key removed. Claude AI is off.'; exit 0 }
if ($Disable -or $Enable -or $Model -or $Effort -or $MaxTokens) {
    $j = Load
    if (-not $j) { Write-Host 'No key stored yet: run "Configure Claude.bat" without options first.' -ForegroundColor Yellow; exit 1 }
    if ($Disable -or $Enable) { SetProp $j 'enabled' ([bool]$Enable) }
    if ($Model) { SetProp $j 'model' $Model }
    if ($Effort) { SetProp $j 'effort' $Effort }
    if ($MaxTokens) { SetProp $j 'max_tokens' $MaxTokens }
    Save $j; Show $j
    Write-Host 'The panel host reads this on every request; no restart needed.'
    exit 0
}

$py = $null
foreach ($c in @('py', 'python')) { $cmd = Get-Command $c -ErrorAction SilentlyContinue; if ($cmd -and $cmd.Source -notmatch 'WindowsApps') { $py = $cmd.Source; break } }
$installed = $false
if ($py) {
    & $py -c "import anthropic" 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Installing the anthropic Python package (needed to call Claude)...'
        & $py -m pip install --user --quiet anthropic
        if ($LASTEXITCODE -ne 0) { Write-Host 'Could not install it; run: py -m pip install anthropic' -ForegroundColor Yellow } else { $installed = $true }
    }
}
$sec = Read-Host 'Paste your Anthropic API key (from platform.claude.com > API keys) and press Enter (it is not shown)' -AsSecureString
$key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)).Trim()
if (-not $key.StartsWith('sk-ant-')) { Write-Host 'That does not look like an Anthropic API key (sk-ant-...); nothing was saved.' -ForegroundColor Yellow; exit 1 }
$j = Load
if (-not $j) { $j = [pscustomobject]@{} }
SetProp $j 'api_key' $key
SetProp $j 'enabled' $true
if (-not $j.model) { SetProp $j 'model' 'claude-opus-5-5' }
Save $j
Write-Host 'Saved. Claude AI is on (billed to your Anthropic account; the panel asks before each request).' -ForegroundColor Green
Show $j
if ($installed) { Write-Host 'The anthropic package was just installed: double-click "Restart AI Visual Builder.bat" once.' }
Write-Host 'Then close and reopen the AI Visual Builder V10 panel in PowerPoint.'
