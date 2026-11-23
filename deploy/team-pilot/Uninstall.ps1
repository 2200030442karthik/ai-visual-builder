# AI Visual Builder (Pilot) - removes everything Install.ps1 added for this Windows user:
# the panel host, the PowerPoint registration, autostart, the Apps & features entry, the certificate it created,
# the access policy it created, the stored keys and usage (unless -KeepData), and the program folder.
# Nothing else is touched (other add-ins, SL Smart Design, PowerPoint settings, your presentations).
param([string]$Instance = 'AIVisualBuilderPilot', [switch]$KeepData)
. (Join-Path $PSScriptRoot 'common.ps1')
$P = PilotPaths $Instance
$st = ReadJson $P.State
Say ''
Say 'AI Visual Builder (Pilot) - uninstall' Cyan
if (-not $st) { Say "Not installed for this user ($($P.Dest) has no install record)." Yellow }
Set-Location $env:TEMP

$n = StopPilot $P
Say "Panel host:  stopped ($n process(es))."
$WefKey = 'HKCU:\Software\Microsoft\Office\16.0\WEF\Developer'
$id = $(if ($st -and $st.addin_id) { $st.addin_id } else { '78643140-2b68-48d8-b072-3b253dddf2b8' })
if ((Get-ItemProperty $WefKey -ErrorAction SilentlyContinue).$id) { Remove-ItemProperty -Path $WefKey -Name $id; Say 'PowerPoint:  add-in removed (restart PowerPoint).' }
Remove-Item $P.Startup -ErrorAction SilentlyContinue
if (Test-Path $P.UninstallKey) { Remove-Item $P.UninstallKey -Recurse -Force }
Say 'Autostart and Apps & features entry removed.'

if ($st -and $st.cert_thumbprint) {
    Say 'Windows may ask to confirm removing the "localhost" certificate this pilot added: choose Yes.' Yellow
    foreach ($store in 'Root', 'My') {
        Get-ChildItem "Cert:\CurrentUser\$store" | Where-Object { $_.Thumbprint -eq $st.cert_thumbprint } | ForEach-Object { Remove-Item $_.PSPath }
    }
    Say 'Certificate: removed.'
}
if ($st -and $st.access_created -and (Test-Path $st.access_created)) {
    Remove-Item $st.access_created
    $dir = Split-Path $st.access_created
    if ((Split-Path $dir -Leaf) -eq 'AIVisualBuilder' -and -not (Get-ChildItem $dir -Force)) { Remove-Item $dir }
    Say "Access policy removed ($($st.access_created))."
}
if ($st -and -not $KeepData) {
    $dd = $st.data_dir
    if ($dd -and (Test-Path $dd)) {
        if ($st.data_dir_created) { Remove-Item $dd -Recurse -Force; Say "Keys, usage and log removed ($dd)." }
        elseif ($st.cert_thumbprint) { Remove-Item (Join-Path $dd 'cert.pem'), (Join-Path $dd 'key.pem') -ErrorAction SilentlyContinue }
    }
}
if (Test-Path $P.Dest) { Remove-Item $P.Dest -Recurse -Force }
Say "Program folder removed ($($P.Dest))." Green
Say 'Done. Close and reopen PowerPoint.' Green
