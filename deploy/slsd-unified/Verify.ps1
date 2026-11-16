# SL Smart Design - checks an installation without changing anything (for the user, IT and the installer tests).
# Prints PASS / FAIL / WARN per check; exit code 1 when a check fails. It cannot see PowerPoint's ribbon itself: start
# PowerPoint and look for the one SL Smart Design tab (Design | SL Templates | Miscellaneous | Shape Rename).
param([string]$Instance = 'SLSmartDesign')
. (Join-Path $PSScriptRoot 'common.ps1')
. (Join-Path $PSScriptRoot 'slsd-common.ps1')
$P = PilotPaths $Instance
$st = ReadJson $P.State
$fails = 0
function Check($name, $ok, $detail = '', [switch]$Warn) {
    if ($ok) { Say "  PASS  $name" Green } elseif ($Warn) { Say "  WARN  $name  | $detail" Yellow } else { Say "  FAIL  $name  | $detail" Red; $script:fails++ }
}
Say ''
Say "SL Smart Design - installation check ($Instance)" Cyan
if (-not $st) { Say '  FAIL  not installed for this user' Red; exit 1 }
$T = OfficeTargets $st.office_root $st.addins_dir
foreach ($f in 'app\server.py', 'app\slsd.js', 'app\slsd_com.py', 'app\run_server.pyw', 'runtime\pythonw.exe') { Check "program file $f" (Test-Path (Join-Path $P.Dest $f)) }
$s = PilotStatus $st.port
Check "panel host answers on https://localhost:$($st.port) (certificate trusted)" ($s -and $s.server) 'not running: run "Restart SL Smart Design.bat"'
if ($s) { Check 'panel host version' ($s.server -eq ([regex]::Match((Get-Content (Join-Path $P.App 'server.py') -Raw), "VERSION = '([^']+)'")).Groups[1].Value) $s.server }
$mx = $null; try { $mx = [xml](Get-Content $st.manifest -Raw) } catch {}
Check 'manifest well-formed, product Id' ($mx -and $mx.OfficeApp.Id -eq $SLSD.ProductId) $st.manifest
Check 'manifest points at this panel host' ($mx -and $mx.OfficeApp.DefaultSettings.SourceLocation.DefaultValue -eq "https://localhost:$($st.port)/v10.html") ''
switch ($st.registration) {
    'Developer' { Check 'registration: Developer value' ((GetValue $T.Wef $SLSD.ProductId) -eq $st.manifest) '' }
    'Catalog'   { Check 'registration: trusted catalog' ((GetValue $T.CatKey 'Url') -eq $st.catalog_url -and (GetValue $T.CatKey 'Flags') -eq 1) $st.catalog_url
                  Check 'catalog folder reachable and holds this product' ((Test-Path (Join-Path $st.catalog_url 'manifest-slsd.xml')) -and ((Get-Content (Join-Path $st.catalog_url 'manifest-slsd.xml') -Raw) -match $SLSD.ProductId)) $st.catalog_url -Warn }
    'Central'   { Check 'registration: by IT (Microsoft 365); nothing registered on this PC' (($null -eq (GetValue $T.Wef $SLSD.ProductId)) -and -not (Test-Path $T.CatKey)) '' }
}
Check 'no older AI Visual Builder pilot registration (no Home tab group)' ($null -eq (GetValue $T.Wef $SLSD.PilotId)) ''
Check 'V10.20 "SL Smart Design AI" add-in not loaded' (-not (Test-Path $T.V1020Key)) ''
Check 'SL Smart Design add-in file installed (tab-hidden copy)' ((Test-Path $T.VbaFile) -and $st.addin_sha256 -and ((Get-FileHash $T.VbaFile).Hash -eq $st.addin_sha256)) $T.VbaFile
Check 'SL Smart Design add-in loads with PowerPoint' ((GetValue $T.VbaKey 'AutoLoad') -eq 1 -and (GetValue $T.VbaKey 'Path')) $T.VbaKey
$tr = TemplateReport $st.templates_dir
Check "template library ($($tr.points) point templates)" (-not $tr.missing.Count) ($tr.missing -join ', ')
if ($st.autostart) { Check 'starts with Windows' (Test-Path $st.autostart) $st.autostart }
Say ''
if ($fails) { Say "$fails check(s) failed." Red; exit 1 } else { Say 'All checks passed. In PowerPoint: one SL Smart Design tab; nothing from AI Visual Builder on Home.' Green }
