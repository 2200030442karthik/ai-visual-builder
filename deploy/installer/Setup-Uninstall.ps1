# SL Editor 10.25 - run by the setup's uninstaller (PowerPoint closed): stops the local service, puts the original
# SL Smart Design and SL_Audomation add-ins back (their own ribbon tabs visible again) and removes this add-in's
# PowerPoint registration. Never asks anything (it runs without a window).
param([string]$AppDir)
$ErrorActionPreference = 'Continue'
if (-not $AppDir) { $AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
$DataDir = Join-Path $env:LOCALAPPDATA 'AIVisualBuilder'

Get-Process python*, pythonw* -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$AppDir*" } | Stop-Process -Force -ErrorAction SilentlyContinue

$py = Join-Path $AppDir 'runtime\python.exe'
$tabsPy = Join-Path $AppDir 'app\addin_tabs.py'
if ((Test-Path $py) -and (Test-Path $tabsPy)) {
    & $py $tabsPy restore --data $DataDir | Out-File (Join-Path $DataDir 'addin-tabs.log') -Append -Encoding utf8
}

$WefKey = 'HKCU:\Software\Microsoft\Office\16.0\WEF\Developer'
Remove-ItemProperty -Path $WefKey -Name '2f01d600-c9ec-4d94-ade9-69b8b6f0bfa7' -ErrorAction SilentlyContinue
Remove-Item (Join-Path ([Environment]::GetFolderPath('SendTo')) 'SL Editor - clean copy for sharing.lnk') -ErrorAction SilentlyContinue
$startup = [Environment]::GetFolderPath('Startup')
Remove-Item (Join-Path $startup 'AI SL Smart Design Service.lnk'), (Join-Path $startup 'SL Editor Service.lnk') -ErrorAction SilentlyContinue
foreach ($f in 'activation.json', 'claude.json', 'napkin.json') { Remove-Item (Join-Path $DataDir $f) -ErrorAction SilentlyContinue }
