# SL Smart Design 10.20.1 - switch this PC to the unified SL Smart Design tab, or back (rollback).
#
#   Activate : 1. backs up what is there now (both add-in files, the two registry values it changes)
#              2. installs the SL Smart Design copy whose own tab is hidden (make_unified_slsd.py --hide-tab; its VBA,
#                 forms and licence check byte-identical to the original) under the same file name
#              3. points the AI Visual Builder registration (its Id only) at manifest-slsd.xml: the SL Smart Design tab
#              4. stops loading the V10.20 "SL Smart Design AI" VBA add-in (its AddIns key only; the file is kept)
#   Rollback : puts back exactly what the last Activate backed up.
#   Status   : shows the current state; changes nothing.
#
# Only these named values/keys are touched; no shared Office key is recreated or emptied, so other add-ins keep their
# registrations. PowerPoint must be closed (it reads add-ins when it starts). -OfficeRoot / -AddInsDir / -StateDir let the
# tests run the same code on an isolated registry key and folders.
param(
    [ValidateSet('Activate', 'Rollback', 'Status')][string]$Action = 'Status',
    [string]$OfficeRoot = 'HKCU:\Software\Microsoft\Office\16.0',
    [string]$AddInsDir = (Join-Path $env:APPDATA 'Microsoft\AddIns'),
    [string]$StateDir = (Join-Path $env:LOCALAPPDATA 'SLSmartDesign\rollback'),
    [string]$Manifest = (Join-Path $PSScriptRoot '..\..\manifest-slsd.xml'),
    [string]$HiddenTabAddIn = 'D:\Karthik\SL_Smart_Design_Source\Unified_V10.20.1\SL_Smart_Design_v2_Key_Dec_25.ppam',
    [switch]$KeepOfficeCache
)
$ErrorActionPreference = 'Stop'
$AddInId = '08d15d9d-8629-4583-b67d-5f80143dde6d'
$SlsdFile = 'SL_Smart_Design_v2_Key_Dec_25.ppam'
$AiFile = 'SLSD_AIVisualBuilder.ppam'
$Wef = Join-Path $OfficeRoot 'WEF\Developer'
$AiKey = Join-Path $OfficeRoot 'PowerPoint\AddIns\SLSD_AIVisualBuilder'
$Real = $OfficeRoot -eq 'HKCU:\Software\Microsoft\Office\16.0'

function Get-Value($key, $name) {
    if (-not (Test-Path $key)) { return $null }
    $p = Get-ItemProperty -Path $key -ErrorAction SilentlyContinue
    if ($p -and ($p.PSObject.Properties.Name -contains $name)) { return $p.$name }
    return $null
}
function Show-State {
    $hidden = $null
    $f = Join-Path $AddInsDir $SlsdFile
    if (Test-Path $f) {
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        try {
            $z = [IO.Compression.ZipFile]::OpenRead($f)
            try { $e = $z.GetEntry('customUI/customUI.xml'); if ($e) { $r = New-Object IO.StreamReader($e.Open()); $hidden = $r.ReadToEnd() -match 'id="Template_Selector"[^>]*visible="false"'; $r.Close() } } finally { $z.Dispose() }
        } catch { $hidden = 'file not readable as an add-in' }
    }
    [pscustomobject]@{
        'AI Visual Builder manifest'          = Get-Value $Wef $AddInId
        'SL Smart Design add-in tab hidden'   = $hidden
        'SL Smart Design AI (V10.20) loading' = [bool](Test-Path $AiKey)
        'Last backup'                         = $(if (Test-Path (Join-Path $StateDir 'last.txt')) { Get-Content (Join-Path $StateDir 'last.txt') } else { 'none' })
    } | Format-List
}

if ($Action -eq 'Status') { Show-State; return }
if ($Real -and (Get-Process POWERPNT -ErrorAction SilentlyContinue)) { throw 'Close PowerPoint first (it reads its add-ins when it starts).' }

if ($Action -eq 'Activate') {
    $Manifest = (Resolve-Path $Manifest).Path
    if (-not (Test-Path $HiddenTabAddIn)) { throw "Not found: $HiddenTabAddIn (build it with make_unified_slsd.py --hide-tab)." }
    if (-not (Test-Path $AddInsDir)) { throw "Not found: $AddInsDir" }
    # 1. backup
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $bak = Join-Path $StateDir $stamp
    New-Item -ItemType Directory -Path $bak | Out-Null
    $files = @{}
    foreach ($n in @($SlsdFile, $AiFile)) {
        $p = Join-Path $AddInsDir $n
        if (Test-Path $p) { Copy-Item $p (Join-Path $bak $n); $files[$n] = $true } else { $files[$n] = $false }
    }
    $state = [ordered]@{
        made = (Get-Date).ToString('s'); files = $files
        wef = Get-Value $Wef $AddInId
        aiKey = $(if (Test-Path $AiKey) { [ordered]@{ Path = Get-Value $AiKey 'Path'; AutoLoad = Get-Value $AiKey 'AutoLoad' } } else { $null })
    }
    $state | ConvertTo-Json -Depth 4 | Set-Content -Path (Join-Path $bak 'state.json') -Encoding UTF8
    Set-Content -Path (Join-Path $StateDir 'last.txt') -Value $stamp -Encoding ASCII
    # 2. the SL Smart Design copy with its own tab hidden (same file name, so its registration is unchanged)
    Copy-Item $HiddenTabAddIn (Join-Path $AddInsDir $SlsdFile) -Force
    if ((Get-FileHash $HiddenTabAddIn).Hash -ne (Get-FileHash (Join-Path $AddInsDir $SlsdFile)).Hash) { throw 'The SL Smart Design copy was not written correctly.' }
    # 3. this add-in's own registration value only
    if (-not (Test-Path $Wef)) { New-Item -Path $Wef | Out-Null }
    Set-ItemProperty -Path $Wef -Name $AddInId -Value $Manifest
    # 4. the V10.20 VBA buttons add-in: its own key only
    if (Test-Path $AiKey) { Remove-Item -Path $AiKey }
    if ($Real -and -not $KeepOfficeCache) {
        $cache = Join-Path $env:LOCALAPPDATA 'Microsoft\Office\16.0\Wef'
        if (Test-Path $cache) { Get-ChildItem $cache -Force | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue }
    }
    Write-Host "Activated. Backup: $bak" -ForegroundColor Green
    Write-Host 'Start PowerPoint: one SL Smart Design tab (Design | SL Templates | Miscellaneous | Shape Rename).'
    Show-State
    return
}

# Rollback
$lastFile = Join-Path $StateDir 'last.txt'
if (-not (Test-Path $lastFile)) { throw "No backup found in $StateDir." }
$bak = Join-Path $StateDir ((Get-Content $lastFile -TotalCount 1).Trim())
$state = Get-Content (Join-Path $bak 'state.json') -Raw | ConvertFrom-Json
foreach ($n in @($SlsdFile, $AiFile)) {
    $had = [bool]$state.files.$n
    $dst = Join-Path $AddInsDir $n
    if ($had) { Copy-Item (Join-Path $bak $n) $dst -Force }
    elseif (Test-Path $dst) { Remove-Item $dst }
}
if ($null -eq $state.wef) { if (Test-Path $Wef) { Remove-ItemProperty -Path $Wef -Name $AddInId -ErrorAction SilentlyContinue } }
else { if (-not (Test-Path $Wef)) { New-Item -Path $Wef | Out-Null }; Set-ItemProperty -Path $Wef -Name $AddInId -Value $state.wef }
if ($null -ne $state.aiKey) {
    if (-not (Test-Path $AiKey)) { New-Item -Path $AiKey | Out-Null }
    if ($null -ne $state.aiKey.Path) { Set-ItemProperty -Path $AiKey -Name Path -Value $state.aiKey.Path }
    if ($null -ne $state.aiKey.AutoLoad) { New-ItemProperty -Path $AiKey -Name AutoLoad -Value ([int]$state.aiKey.AutoLoad) -PropertyType DWord -Force | Out-Null }
} elseif (Test-Path $AiKey) { Remove-Item -Path $AiKey }
if ($Real -and -not $KeepOfficeCache) {
    $cache = Join-Path $env:LOCALAPPDATA 'Microsoft\Office\16.0\Wef'
    if (Test-Path $cache) { Get-ChildItem $cache -Force | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue }
}
Write-Host "Rolled back to the state of $bak" -ForegroundColor Green
Show-State
