# READ-ONLY snapshot of everything the SL Smart Design installer (or the development switch) can affect for the current
# Windows user, for the real-PowerPoint validation: take one before, one after install, one after uninstall/rollback,
# and compare. Changes nothing.
#   capture-state.ps1 -Out before.json
#   capture-state.ps1 -Before before.json -After after.json   (lists every difference; exit 1 when they differ)
param([string]$Out, [string]$Before, [string]$After)
$ErrorActionPreference = 'Stop'
if ($Before -and $After) {
    $a = Get-Content $Before -Raw | ConvertFrom-Json; $b = Get-Content $After -Raw | ConvertFrom-Json
    $ha = @{}; $a.items | ForEach-Object { $ha[$_.k] = $_.v }; $hb = @{}; $b.items | ForEach-Object { $hb[$_.k] = $_.v }
    $diff = @($ha.Keys + $hb.Keys | Sort-Object -Unique | Where-Object { $ha[$_] -ne $hb[$_] -and $_ -notmatch '^service\|' })
    foreach ($k in $diff) { Write-Host "  DIFF  $k`n        before: $($ha[$k])`n        after:  $($hb[$k])" -ForegroundColor Yellow }
    Write-Host ("service: before {0} / after {1}" -f $ha['service|status'], $hb['service|status'])
    if ($diff) { Write-Host "$($diff.Count) difference(s)." -ForegroundColor Yellow; exit 1 } else { Write-Host 'Identical (apart from the service state shown above).' -ForegroundColor Green; exit 0 }
}
$items = New-Object System.Collections.Generic.List[object]
function Add($k, $v) { $items.Add([pscustomobject]@{ k = $k; v = "$v" }) }
$O = 'HKCU:\Software\Microsoft\Office\16.0'
function Values($key, $label) {
    if (-not (Test-Path $key)) { return }
    $it = Get-Item $key; Add "reg|$label|<key>" 'present'
    foreach ($n in $it.GetValueNames()) { Add "reg|$label|$n" $it.GetValue($n) }
}
Values "$O\WEF\Developer" 'WEF\Developer'
if (Test-Path "$O\WEF\TrustedCatalogs") { Get-ChildItem "$O\WEF\TrustedCatalogs" | ForEach-Object { Values $_.PSPath "WEF\TrustedCatalogs\$($_.PSChildName)" } }
if (Test-Path "$O\PowerPoint\AddIns") { Get-ChildItem "$O\PowerPoint\AddIns" | ForEach-Object { Values $_.PSPath "PowerPoint\AddIns\$($_.PSChildName)" } }
$ad = Join-Path $env:APPDATA 'Microsoft\AddIns'
if (Test-Path $ad) { Get-ChildItem $ad -File | ForEach-Object { $s = [IO.File]::Open($_.FullName, 'Open', 'Read', 'ReadWrite'); try { $h = [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($s)) -replace '-' } finally { $s.Close() }; Add "file|AddIns\$($_.Name)" $h } }
$su = [Environment]::GetFolderPath('Startup'); Get-ChildItem $su -Filter *.lnk -ErrorAction SilentlyContinue | ForEach-Object { Add "startup|$($_.Name)" 'present' }
Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall' -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -match 'SLSmartDesign|AIVisualBuilder' } | ForEach-Object { Values $_.PSPath "Uninstall\$($_.PSChildName)" }
Get-ChildItem Cert:\CurrentUser\Root | Where-Object Subject -eq 'CN=localhost' | ForEach-Object { Add "cert|Root|$($_.Thumbprint)" $_.NotAfter.ToString('s') }
foreach ($d in 'SLSmartDesign', 'AIVisualBuilderPilot') { Add "program|$d" (Test-Path (Join-Path $env:LOCALAPPDATA "Programs\$d")) }
$pol = Join-Path $env:ProgramData 'AIVisualBuilder\access.json'; if (Test-Path $pol) { Add 'file|ProgramData access.json' (Get-FileHash $pol).Hash }
$t = Join-Path $env:LOCALAPPDATA 'Microsoft\SLSD\Templates'; Add 'templates|files' $(if (Test-Path $t) { @(Get-ChildItem $t -Recurse -File).Count } else { 0 })
$st = try { (& curl.exe -s --max-time 4 -H 'X-AIVB-Client: 1' 'https://localhost:44317/api/status' | ConvertFrom-Json).server } catch { $null }
Add 'service|status' $(if ($st) { "running $st" } else { 'not answering' })
$snap = [pscustomobject]@{ taken = (Get-Date).ToString('s'); user = $env:USERNAME; items = $items }
if ($Out) { $snap | ConvertTo-Json -Depth 4 | Set-Content $Out -Encoding UTF8; Write-Host "Snapshot: $Out ($($items.Count) items)" } else { $snap | ConvertTo-Json -Depth 4 }
