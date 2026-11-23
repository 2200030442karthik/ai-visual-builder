# Restores the original licensed SL Smart Design add-in (with visible tab) for this user.
# Fixes desktops where a previous experimental installer hid the SL Smart Design tab.
$ErrorActionPreference = 'Stop'
function Say($m, $c) { if ($c) { Write-Host $m -ForegroundColor $c } else { Write-Host $m } }

Say ''
Say 'Restoring Original SL Smart Design Add-in...' Cyan
Say '------------------------------------------------'

if (Get-Process 'POWERPNT' -ErrorAction SilentlyContinue) {
    Say 'NOTICE: Microsoft PowerPoint is open.' Yellow
    Say 'Please close PowerPoint and press any key to proceed...' Yellow
    $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
    if (Get-Process 'POWERPNT' -ErrorAction SilentlyContinue) {
        Stop-Process -Name 'POWERPNT' -Force -ErrorAction SilentlyContinue
        Start-Sleep 1
    }
}

$origFile = Join-Path $PSScriptRoot 'original_slsd\SL_Smart_Design_v2_Key_Dec_25.ppam'
if (-not (Test-Path $origFile)) {
    $alt = 'D:\Karthik\SL_Smart_Design_Source\Backup_before_V10.20\SL_Smart_Design_v2_Key_Dec_25.ppam'
    if (Test-Path $alt) { $origFile = $alt }
}

if (-not (Test-Path $origFile)) {
    Say "Original SL Smart Design source file not found ($origFile)." Red
    exit 1
}

$addinsDir = Join-Path $env:APPDATA 'Microsoft\AddIns'
if (-not (Test-Path $addinsDir)) { New-Item -ItemType Directory -Force $addinsDir | Out-Null }
$targetFile = Join-Path $addinsDir 'SL_Smart_Design_v2_Key_Dec_25.ppam'

Copy-Item $origFile $targetFile -Force

$regKey = 'HKCU:\Software\Microsoft\Office\16.0\PowerPoint\AddIns\SL_Smart_Design_v2_Key_Dec_25'
if (-not (Test-Path $regKey)) { New-Item -Path $regKey -Force | Out-Null }
Set-ItemProperty -Path $regKey -Name 'Path' -Value 'SL_Smart_Design_v2_Key_Dec_25.ppam' -Force
New-ItemProperty -Path $regKey -Name 'AutoLoad' -Value 1 -PropertyType DWord -Force | Out-Null

Say ''
Say 'SUCCESS: Original SL Smart Design add-in restored!' Green
Say "File: $targetFile ($((Get-Item $targetFile).Length) bytes)" Green
Say 'The "SL Smart Design" tab will now appear when PowerPoint starts.' Green
Say ''
