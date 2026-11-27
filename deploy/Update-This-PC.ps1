# Updates the SL Editor installed on THIS PC from the working folder (local-ai), without running the installer.
# Copies the app code (Python, panel scripts, pages, design packs, icons), keeps this PC's own files (activation,
# settings, launcher config), refreshes the ribbon manifest and restarts the SL Editor service.
# Usage: double-click "Update SL Editor on this PC.bat" (or: powershell -File deploy\Update-This-PC.ps1)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$La = Join-Path $Root 'local-ai'
$AppDir = Join-Path $env:LOCALAPPDATA 'Programs\AIVisualBuilderPilot'
$App = Join-Path $AppDir 'app'
if (-not (Test-Path (Join-Path $App 'server.py'))) { throw "SL Editor is not installed on this PC ($App). Run SL-Editor-Setup.exe once first." }

# 1. stop the service of this installation
Get-CimInstance Win32_Process -Filter "Name='pythonw.exe' OR Name='python.exe'" |
    Where-Object { $_.CommandLine -like "*$AppDir*run_server.pyw*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Milliseconds 800

# 2. the code: what the installer would copy, except this PC's own files
$keep = 'config.json', 'pilot.json', 'activation-bundle.json', 'run_server.pyw'
$n = 0
Get-ChildItem $La -File | Where-Object { $_.Extension -in '.py', '.js', '.html' -and $_.Name -notin $keep } | ForEach-Object { Copy-Item $_.FullName $App -Force; $n++ }
foreach ($dir in 'packs', 'assets', 'vendor') {
    & robocopy.exe (Join-Path $La $dir) (Join-Path $App $dir) /E /XD __pycache__ /XF README.txt /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "Copying $dir failed (robocopy $LASTEXITCODE)." }
}

# 2b. the SL Design and SL Animation access bundle (encrypted; deploy\team-keys), so the access page works here
$fb = Join-Path $PSScriptRoot 'team-keys\features-bundle.json'
if (Test-Path $fb) { Copy-Item $fb (Join-Path $App 'features-bundle.json') -Force }
# 2c. 10.28: the access hub's settings (the share and the administrator's public key)
$hc = Join-Path $PSScriptRoot 'hub.json'
if (Test-Path $hc) { Copy-Item $hc (Join-Path $App 'hub.json') -Force }

# 3. the ribbon manifest (new buttons or a new version), with this installation's add-in Id and port
$py = Join-Path $AppDir 'runtime\python.exe'
$mf = Join-Path $AppDir 'catalog\manifest-slsd.xml'
$before = if (Test-Path $mf) { Get-Content $mf -Raw } else { '' }
$tmp = Join-Path $env:TEMP "sled-manifest-$PID.xml"
& $py -I (Join-Path $La 'sl-smart-design\make_manifest_slsd.py') --id '2f01d600-c9ec-4d94-ade9-69b8b6f0bfa7' --base 'https://localhost:44317' --out $tmp | Out-Null
$ribbon = $false
if ((Test-Path $tmp) -and ((Get-Content $tmp -Raw) -ne $before)) { Copy-Item $tmp $mf -Force; $ribbon = $true }
Remove-Item $tmp -ErrorAction SilentlyContinue

# 4. start the service again
Start-Process -FilePath (Join-Path $AppDir 'runtime\pythonw.exe') -ArgumentList "`"$(Join-Path $App 'run_server.pyw')`"" -WorkingDirectory $App -WindowStyle Hidden
$ok = $false
for ($i = 0; $i -lt 20 -and -not $ok; $i++) {
    Start-Sleep -Milliseconds 700
    try { $ok = (Invoke-WebRequest 'https://localhost:44317/api/status' -Headers @{ 'X-AIVB-Client' = '1' } -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 } catch { }
}
Write-Host "Updated: $n files plus packs, icons and libraries in $App." -ForegroundColor Green
if ($ok) { Write-Host 'SL Editor service restarted and answering.' -ForegroundColor Green } else { Write-Host 'The service did not answer yet; see %LOCALAPPDATA%\AIVisualBuilder\server.log' -ForegroundColor Yellow }
if ($ribbon) { Write-Host 'The ribbon changed: close and reopen PowerPoint.' -ForegroundColor Yellow }
else { Write-Host 'In PowerPoint, close the SL Editor panel and open it again (or right-click inside it > Reload) to see the changes.' -ForegroundColor Cyan }
