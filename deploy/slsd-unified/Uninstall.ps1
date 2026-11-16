# SL Smart Design - removes the unified application for this Windows user and restores the state from before its first
# installation: the SL Smart Design add-in file and registration as they were (the original licensed add-in comes back),
# its own web add-in registration removed, the panel host, autostart, Apps & features entry, the certificate and access
# policy it created, and (unless -KeepData) the keys, usage and log it created. Other add-ins are never touched.
param([string]$Instance = 'SLSmartDesign', [switch]$KeepData)
. (Join-Path $PSScriptRoot 'common.ps1')
. (Join-Path $PSScriptRoot 'slsd-common.ps1')
$P = PilotPaths $Instance
$st = ReadJson $P.State
Say ''
Say 'SL Smart Design - uninstall' Cyan
if (-not $st) { Say "Not installed for this user ($($P.Dest) has no install record)." Yellow; exit 0 }
$T = OfficeTargets $st.office_root $st.addins_dir
if ($T.Real -and (Get-Process POWERPNT -ErrorAction SilentlyContinue)) { Say 'Close PowerPoint first, then run Uninstall again.' Red; exit 1 }
Set-Location $env:TEMP

$n = StopPilot $P
Say "Panel host:  stopped ($n process(es))."
$baseline = Join-Path $P.Dest 'backups\baseline'
if (Test-Path (Join-Path $baseline 'state.json')) { RestoreState $baseline; Say 'Add-ins and registrations: restored to the state before SL Smart Design was installed.' Green }
else { Say 'No original-state backup was found; add-ins and registrations were left as they are.' Yellow }
if ($st.autostart) { Remove-Item $st.autostart -ErrorAction SilentlyContinue }
if ($st.apps_key -and (Test-Path $st.apps_key)) { Remove-Item $st.apps_key -Recurse }
Say 'Autostart and Apps & features entry removed.'
if ($st.cert_thumbprint) {
    Say 'Windows may ask to confirm removing the "localhost" certificate SL Smart Design added: choose Yes.' Yellow
    foreach ($store in 'Root', 'My') { Get-ChildItem "Cert:\CurrentUser\$store" | Where-Object { $_.Thumbprint -eq $st.cert_thumbprint } | ForEach-Object { Remove-Item $_.PSPath } }
    Say 'Certificate: removed.'
}
if ($st.access_created -and (Test-Path $st.access_created)) {
    Remove-Item $st.access_created
    $dir = Split-Path $st.access_created
    if ((Split-Path $dir -Leaf) -eq 'AIVisualBuilder' -and -not (Get-ChildItem $dir -Force)) { Remove-Item $dir }
    Say "Access policy removed ($($st.access_created))."
}
if (-not $KeepData -and $st.data_dir -and (Test-Path $st.data_dir)) {
    if ($st.data_dir_created) { Remove-Item $st.data_dir -Recurse -Force; Say "Keys, usage and log removed ($($st.data_dir))." }
    elseif ($st.cert_thumbprint) { Remove-Item (Join-Path $st.data_dir 'cert.pem'), (Join-Path $st.data_dir 'key.pem') -ErrorAction SilentlyContinue }
}
if (Test-Path $P.Dest) { Remove-Item $P.Dest -Recurse -Force }
Say "Program folder removed ($($P.Dest)). The template library was left in place." Green
Say 'Done. Start PowerPoint again.' Green
