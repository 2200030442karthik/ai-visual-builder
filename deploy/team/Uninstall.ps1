# SL Smart Design + AI Visual Builder (team installation) - removes everything Install.ps1 added for this Windows user,
# and puts the original SL Smart Design add-in back first (byte for byte, from the copy kept when its tab was hidden):
# the panel host, the SL Smart Design tab registration (catalog entry, share), autostart, the Apps & features entry, the
# certificate it created, the activation, AI keys and access policy (unless -KeepData), and the program folder.
# Other add-ins, PowerPoint settings and your presentations are not touched.
param([string]$Instance = 'AIVisualBuilderPilot', [switch]$KeepData)
. (Join-Path $PSScriptRoot 'common.ps1')
$P = PilotPaths $Instance
$st = ReadJson $P.State
Say ''
Say 'SL Smart Design + AI Visual Builder - uninstall' Cyan
if (-not $st) { Say "Not installed for this user ($($P.Dest) has no install record)." Yellow }
Set-Location $env:TEMP
$dd = $(if ($st -and $st.data_dir) { $st.data_dir } else { Join-Path $env:LOCALAPPDATA 'AIVisualBuilder' })

# 1. The original SL Smart Design tab back (needs PowerPoint closed while the add-in file is changed)
$n = StopPilot $P
Say "Panel host:  stopped ($n process(es))."
if ((Test-Path $P.Python) -and (Test-Path (Join-Path $P.App 'slsd_tab.py'))) {
    while ($true) {
        $r = & $P.Python (Join-Path $P.App 'slsd_tab.py') restore --data-dir $dd 2>$null | Select-Object -Last 1 | ConvertFrom-Json
        if ($r.ok) { if ($r.done -eq 'restored') { Say 'SL Smart Design: original add-in put back (its own tab is back).' Green }; break }
        Say 'SL Smart Design: close PowerPoint so its original add-in can be put back, then press Enter (or type S to skip).' Yellow
        if ("$(Read-Host)".Trim().ToUpper() -eq 'S') { Say '  Skipped: run "Restore SL Smart Design.bat" from the installation package later.' Yellow; break }
    }
}

# 2. Registrations of this installation only
$Office = 'HKCU:\Software\Microsoft\Office\16.0'
$WefKey = "$Office\WEF\Developer"
$ids = @($(if ($st) { $st.addin_id }), '2f01d600-c9ec-4d94-ade9-69b8b6f0bfa7', $(if (-not $st -and $Instance -eq 'AIVisualBuilderPilot') { '78643140-2b68-48d8-b072-3b253dddf2b8' }))
foreach ($id in ($ids | Where-Object { $_ } | Select-Object -Unique)) {
    if ((Get-ItemProperty $WefKey -ErrorAction SilentlyContinue).$id) { Remove-ItemProperty -Path $WefKey -Name $id }
}
$CatKey = "$Office\WEF\TrustedCatalogs\{EEBC6074-F7DB-4E1A-A3DC-BC2784D4BF34}"
if (Test-Path $CatKey) { Remove-Item $CatKey -Recurse }
Say 'PowerPoint:  SL Smart Design + AI Visual Builder tab removed (restart PowerPoint).'
if ($st -and $st.share) {
    Say 'Windows asks for permission to remove the add-in folder share: choose Yes.' Yellow
    $shareScript = Join-Path $P.Dest 'Share.ps1'
    try { Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList "-NoProfile -File `"$shareScript`" -Name `"$($st.share)`" -Remove" }
    catch { Say '  The share stays (read-only; its folder is removed below).' }
}
Remove-Item $P.Startup -ErrorAction SilentlyContinue
if (Test-Path $P.UninstallKey) { Remove-Item $P.UninstallKey -Recurse -Force }
Say 'Autostart and Apps & features entry removed.'

if ($st -and $st.cert_thumbprint) {
    Say 'Windows may ask to confirm removing the "localhost" certificate AI Visual Builder added: choose Yes.' Yellow
    foreach ($store in 'Root', 'My') {
        Get-ChildItem "Cert:\CurrentUser\$store" | Where-Object { $_.Thumbprint -eq $st.cert_thumbprint } | ForEach-Object { Remove-Item $_.PSPath }
    }
    Say 'Certificate: removed.'
}
if ($st -and -not $KeepData -and (Test-Path $dd)) {
    if ($st.data_dir_created) { Remove-Item $dd -Recurse -Force; Say "Activation, AI keys, usage and log removed ($dd)." }
    else {
        foreach ($f in 'activation.json', 'napkin.json', 'claude.json', 'access.json', 'slsd-tab.json') { Remove-Item (Join-Path $dd $f) -ErrorAction SilentlyContinue }
        if ($st.cert_thumbprint) { Remove-Item (Join-Path $dd 'cert.pem'), (Join-Path $dd 'key.pem') -ErrorAction SilentlyContinue }
        Say "Activation, AI keys and access policy removed ($dd)."
    }
}
if (Test-Path $P.Dest) { Remove-Item $P.Dest -Recurse -Force }
Say "Program folder removed ($($P.Dest))." Green
Say 'Done. Close and reopen PowerPoint.' Green
