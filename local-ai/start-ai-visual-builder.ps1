# Starts the AI Visual Builder V10 panel host (server.py, https://localhost:44317), or replaces it when the copy that is
# running is outdated. Lightweight: Python standard library only (plus the optional anthropic package for Claude).
# Log: %LOCALAPPDATA%\AIVisualBuilder\server.log
#   -Stop      stops every panel host started from this folder (test copies with --test are left alone)
#   -Restart   stops them, then starts one fresh copy
#   -Status    reports the running version, the version on disk and the number of copies
param([switch]$Stop, [switch]$Restart, [switch]$Status)

$ErrorActionPreference = 'Stop'
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Data = Join-Path $env:LOCALAPPDATA 'AIVisualBuilder'
New-Item -ItemType Directory -Force $Data | Out-Null
$port = (Get-Content (Join-Path $Here 'config.json') -Raw | ConvertFrom-Json).port
$serverPy = Join-Path $Here 'server.py'
$diskVersion = ([regex]::Match((Get-Content $serverPy -Raw), "VERSION = '([^']+)'")).Groups[1].Value

# Every panel host started from this folder (by its command line), so no copy is missed and nothing else is touched.
function Hosts { @(Get-CimInstance Win32_Process -Filter "Name like 'python%' or Name = 'py.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine -like "*$serverPy*" -and $_.CommandLine -notlike '*--test*' }) }
function RunningVersion { try { (& curl.exe -s -k --max-time 5 -H 'X-AIVB-Client: 1' "https://localhost:$port/api/status" | ConvertFrom-Json).server } catch { $null } }
function StopAll {
    $h = @(Hosts)
    foreach ($p in $h) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
    if ($h.Count) { Write-Host "Stopped $($h.Count) panel host process(es): $(($h | ForEach-Object ProcessId) -join ', ')." } else { Write-Host 'No panel host was running.' }
    Start-Sleep 1
}

if ($Status) {
    $h = @(Hosts); $v = RunningVersion
    Write-Host "On disk: $diskVersion. Answering on port ${port}: $(if ($v) { $v } else { 'nothing' }). Copies running: $($h.Count)."
    if ($v -and $v -ne $diskVersion) { Write-Host 'The running copy is outdated: run "Restart AI Visual Builder.bat".' -ForegroundColor Yellow }
    if ($h.Count -gt 1) { Write-Host 'More than one copy is running: run "Restart AI Visual Builder.bat".' -ForegroundColor Yellow }
    exit 0
}
if ($Stop) { StopAll; exit 0 }

$h = @(Hosts); $v = RunningVersion
if (-not $Restart -and $v -eq $diskVersion -and $h.Count -eq 1) {
    Write-Host "AI Visual Builder $v is running on https://localhost:$port/" -ForegroundColor Green; exit 0
}
if ($h.Count) {
    if ($v -and $v -ne $diskVersion) { Write-Host "The running panel host is version $v; the files are version $diskVersion. Replacing it." -ForegroundColor Yellow }
    elseif ($h.Count -gt 1) { Write-Host "$($h.Count) copies of the panel host were running. Replacing them with one." -ForegroundColor Yellow }
    StopAll
}
$owner = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($owner) {
    $p = Get-Process -Id $owner.OwningProcess -ErrorAction SilentlyContinue
    Write-Host "Port $port is used by $($p.ProcessName) (process $($p.Id)), which is not this panel host; close it and start again." -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path (Join-Path $Data 'cert.pem'))) { Write-Host 'Run "Set up AI Visual Builder.bat" once first (it creates the localhost certificate).' -ForegroundColor Yellow; exit 1 }
$py = $null
foreach ($c in @('pythonw', 'py', 'python')) { $cmd = Get-Command $c -ErrorAction SilentlyContinue; if ($cmd -and $cmd.Source -notmatch 'WindowsApps') { $py = $cmd.Source; break } }
if (-not $py) { Write-Host 'Python 3.9+ is needed: https://www.python.org/downloads/windows/' -ForegroundColor Yellow; exit 1 }
Start-Process $py -ArgumentList @('-u', "`"$serverPy`"") -WorkingDirectory $Here -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $Data 'server.log') -RedirectStandardError (Join-Path $Data 'server-err.log')
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep 1
    $v = RunningVersion
    if ($v -eq $diskVersion) { Write-Host "AI Visual Builder $v is running on https://localhost:$port/  In PowerPoint: close and reopen the AI Visual Builder V10 panel." -ForegroundColor Green; exit 0 }
}
Write-Host "It did not start. See $Data\server-err.log" -ForegroundColor Yellow
exit 1
