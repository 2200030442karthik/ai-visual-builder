# Shared helpers for the AI Visual Builder team installation (V10.22). Dot-sourced; not run directly.
# Rule for every script here: add AI Visual Builder only. Never change SL Smart Design or any other add-in, never close
# PowerPoint, never clear Office's caches. The one exception is asked for and done by SL Smart Design's own uninstaller:
# undoing the earlier unified / "Easy Pilot" installation that replaced the SL Smart Design add-in (RepairSLSD).
$ErrorActionPreference = 'Stop'

function Say($m, $c) { if ($c) { Write-Host $m -ForegroundColor $c } else { Write-Host $m } }

function PilotPaths([string]$Instance = 'AIVisualBuilderPilot') {
    $dest = Join-Path $env:LOCALAPPDATA "Programs\$Instance"
    [pscustomobject]@{
        Dest         = $dest
        App          = Join-Path $dest 'app'
        Runtime      = Join-Path $dest 'runtime'
        Python       = Join-Path $dest 'runtime\python.exe'
        Pythonw      = Join-Path $dest 'runtime\pythonw.exe'
        Launcher     = Join-Path $dest 'app\run_server.pyw'
        Bundle       = Join-Path $dest 'app\activation-bundle.json'
        Pilot        = Join-Path $dest 'app\pilot.json'
        State        = Join-Path $dest 'install-state.json'
        Manifest     = Join-Path $dest 'manifest-pilot.xml'
        Startup      = Join-Path ([Environment]::GetFolderPath('Startup')) "$Instance.lnk"
        UninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$Instance"
    }
}

function ReadJson($path) { if (Test-Path $path) { Get-Content $path -Raw -Encoding UTF8 | ConvertFrom-Json } else { $null } }

function WriteJson($path, $obj, [switch]$Private) {
    [IO.File]::WriteAllText($path, ($obj | ConvertTo-Json -Depth 8), (New-Object Text.UTF8Encoding $false))
    if ($Private) { icacls $path /inheritance:r /grant:r "$($env:USERNAME):(R,W)" | Out-Null }
}

# Panel host processes started from this install folder (matched by command line; nothing else is touched)
function PilotHosts($p) {
    @(Get-CimInstance Win32_Process -Filter "Name like 'python%'" | Where-Object { $_.CommandLine -and $_.CommandLine -like "*$($p.Dest)*" })
}

function StopPilot($p) {
    $h = @(PilotHosts $p)
    foreach ($x in $h) { Stop-Process -Id $x.ProcessId -Force -ErrorAction SilentlyContinue }
    if ($h.Count) { Start-Sleep 1 }
    return [int]$h.Count
}

# /api/status over HTTPS with normal certificate checking (no -k): proves the certificate is trusted on this PC
function PilotStatus([int]$Port) {
    try { (& curl.exe -s --max-time 5 -H 'X-AIVB-Client: 1' "https://localhost:$Port/api/status") | ConvertFrom-Json } catch { $null }
}

function StartPilot($p, [int]$Port) {
    Start-Process -FilePath $p.Pythonw -ArgumentList "`"$($p.Launcher)`"" -WorkingDirectory $p.App -WindowStyle Hidden
    for ($i = 0; $i -lt 40; $i++) {
        Start-Sleep -Milliseconds 500
        $s = PilotStatus $Port
        if ($s -and $s.server) { return $s }
    }
    $null
}

# ---------------------------------------------------------------- activation (local-ai\activation.py)
function ActivationCall($p, [string]$DataDir, [string]$Command, [string]$Key) {
    $script = Join-Path $p.App 'activation.py'
    $args2 = @($script, $Command, '--data-dir', $DataDir, '--bundle', $p.Bundle)
    $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    try {
        $out = $(if ($Command -eq 'activate') { $Key | & $p.Python @args2 2>$null } else { & $p.Python @args2 2>$null })
    } finally { $ErrorActionPreference = $old }
    try { ($out | Select-Object -Last 1) | ConvertFrom-Json } catch { [pscustomobject]@{ ok = $false; reason = 'error'; message = 'The activation check did not run.' } }
}

function ActivationText($r) {
    $who = $(if ($r.label) { " for $($r.label)" } else { '' })
    $until = $(if ($r.expires) { ", valid until $($r.expires)" } else { '' })
    "Activated$who$until."
}

# Asks for the key in this window (or uses -ActivationKey). Up to 3 tries; Enter alone = later, in PowerPoint.
function ActivateInteractive($p, [string]$DataDir, [string]$Key) {
    $now = ActivationCall $p $DataDir 'status'
    if ($now.ok) { Say "Activation:  $(ActivationText $now)" Green; return $true }
    for ($try = 1; $try -le 3; $try++) {
        if (-not $Key) {
            Say ''
            Say 'Enter the activation key from your manager (AIVB-XXXXX-XXXXX-XXXXX-XXXXX).' Cyan
            $Key = "$(Read-Host 'Activation key (or just Enter to do it later in PowerPoint)')".Trim()
            if (-not $Key) { Say 'Activation:  later - AI Visual Builder asks for the key when you open it.' Yellow; return $false }
        }
        $r = ActivationCall $p $DataDir 'activate' $Key
        if ($r.ok) { Say "Activation:  $(ActivationText $r) AI services: $(@($r.services) -join ' and ')." Green; return $true }
        Say "  $($r.message)" Red
        $Key = ''
        if ($r.reason -eq 'no-bundle') { break }
    }
    Say 'Activation:  not done - AI Visual Builder asks for the key when you open it.' Yellow
    $false
}

# ---------------------------------------------------------------- SL Smart Design repair
# The unified / "Easy Pilot" installer (deploy/slsd-unified) replaced SL_Smart_Design_v2_Key_Dec_25.ppam with a copy
# whose own tab is hidden. Its own uninstaller puts back exactly what this PC had before (its baseline backup):
# the original licensed add-in file and its registration. Nothing is copied from this package.
function UnifiedInstallDir {
    $d = Join-Path $env:LOCALAPPDATA 'Programs\SLSmartDesign'
    if (Test-Path (Join-Path $d 'install-state.json')) { $d } else { $null }
}

function RepairSLSD([switch]$NoPrompt) {
    $d = UnifiedInstallDir
    if (-not $d) { return 'none' }
    Say ''
    Say 'Found the earlier "SL Smart Design" unified / Easy Pilot installation, which hid the original SL Smart Design tab.' Yellow
    $un = Join-Path $d 'Uninstall.ps1'
    if (-not (Test-Path $un)) { Say "  Its uninstaller is missing ($un). Ask the SL Smart Design administrator to reinstall the original add-in." Red; return 'manual' }
    if (Get-Process POWERPNT -ErrorAction SilentlyContinue) {
        if ($NoPrompt) { Say '  PowerPoint is open: not repaired now. Close PowerPoint and run "Restore SL Smart Design.bat".' Yellow; return 'skipped' }
        Say '  To bring the original SL Smart Design tab back, save your work and CLOSE PowerPoint, then press Enter here.' Yellow
        [void](Read-Host '  Press Enter when PowerPoint is closed')
        if (Get-Process POWERPNT -ErrorAction SilentlyContinue) { Say '  PowerPoint is still open: not repaired now. Later: close PowerPoint and run "Restore SL Smart Design.bat".' Yellow; return 'skipped' }
    }
    $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    try { & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $un -KeepData | Out-Host } finally { $ErrorActionPreference = $old }
    if (-not (Test-Path (Join-Path $d 'install-state.json'))) { Say '  Original SL Smart Design restored (its own tab is back after PowerPoint starts).' Green; return 'repaired' }
    Say '  The repair did not finish. Close PowerPoint and run "Restore SL Smart Design.bat".' Red
    'failed'
}
