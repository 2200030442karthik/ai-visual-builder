# SL Smart Design (with AI Visual Builder) - installs or updates the unified application for the current Windows user.
# No administrator rights. Built on the tested AI Visual Builder pilot installer (common.ps1).
#  - the panel host (AI Visual Builder, and the SL Smart Design commands) with its own Python runtime
#  - a certificate for https://localhost that only this PC trusts (Windows asks once: answer Yes)
#  - the SL Smart Design add-in copy whose own tab is hidden (VBA, forms and licence check byte-identical)
#  - the template library: checked; missing files added from the package (existing files never overwritten)
#  - the web add-in registration chosen by IT (deployment.json or -Registration): Central | Catalog | Developer | None
#  - older versions retired: the AI Visual Builder pilot's registration and autostart, the V10.20 "SL Smart Design AI"
# Everything changed outside the program folder is backed up first and restored if any step fails (Rollback / Uninstall
# use the same backups). Other add-ins are never touched.
param(
    [string]$Instance = 'SLSmartDesign',
    [int]$Port = 44317,
    [string]$DataDir,
    [ValidateSet('', 'Central', 'Catalog', 'Developer', 'None')][string]$Registration = '',
    [string]$CatalogUrl,
    [switch]$AskKeys,
    [switch]$InstallSlsdAddin,        # administrator, with the SL Smart Design owner's approval: also where it is not installed yet
    [switch]$NoAutostart,
    # isolation (tests / staging): the same code on another registry root and folders
    [string]$OfficeRoot = 'HKCU:\Software\Microsoft\Office\16.0',
    [string]$AddInsDir = (Join-Path $env:APPDATA 'Microsoft\AddIns'),
    [string]$TemplatesDir = (Join-Path $env:LOCALAPPDATA 'Microsoft\SLSD\Templates'),
    [string]$AppsKeyRoot = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
    [string]$UseCertFrom,
    [ValidateSet('', 'files', 'addin', 'registration', 'start')][string]$SimulateFailureAt = ''
)
. (Join-Path $PSScriptRoot 'common.ps1')
. (Join-Path $PSScriptRoot 'slsd-common.ps1')
$Src = $PSScriptRoot
$P = PilotPaths $Instance
$AppsKey = Join-Path $AppsKeyRoot $Instance
if (-not $DataDir) { $DataDir = Join-Path $env:LOCALAPPDATA 'AIVisualBuilder' }
$T = OfficeTargets $OfficeRoot $AddInsDir
$old = ReadJson $P.State
$dep = ReadJson (Join-Path $Src 'deployment.json')               # administrator: { "registration": "Catalog", "catalog_url": "\\\\server\\share" }
if (-not $Registration) { $Registration = $(if ($dep -and $dep.registration) { "$($dep.registration)" } else { 'Central' }) }
if (-not $CatalogUrl -and $dep -and $dep.catalog_url) { $CatalogUrl = "$($dep.catalog_url)" }
function Fail($m) { Say $m Red; exit 1 }
function Simulate($at) { if ($SimulateFailureAt -eq $at) { throw "simulated failure at '$at' (test)" } }

Say ''
Say 'SL Smart Design (with AI Visual Builder) - installation' Cyan
Say '-------------------------------------------------------'

# 0. Checks (nothing is changed before they pass)
if (-not [Environment]::Is64BitOperatingSystem) { Fail 'This package needs 64-bit Windows.' }
$ppt = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\POWERPNT.EXE' -ErrorAction SilentlyContinue).'(default)'
if ($ppt) { Say "PowerPoint:  $ppt" Green } else { Say 'PowerPoint desktop was not found. Install Microsoft 365 PowerPoint first.' Yellow }
foreach ($f in 'app\server.py', 'app\slsd.js', 'runtime\pythonw.exe', 'manifest-slsd.template.xml', "slsd\$($SLSD.VbaName).ppam") {
    if (-not (Test-Path (Join-Path $Src $f))) { Fail "The package is incomplete ($f missing). Extract the whole zip first, then run Install again." }
}
if ($T.Real -and (Get-Process POWERPNT -ErrorAction SilentlyContinue)) { Fail 'Close PowerPoint first (its add-ins are replaced), then run Install again.' }
# A package downloaded from the internet carries Windows' download mark (Office would also block the add-in's macros).
# The mark is never removed by this script: whoever installs confirms the source and unblocks the zip (approved step).
$marked = Get-ChildItem $Src -Recurse -File | Where-Object { Get-Item -LiteralPath $_.FullName -Stream Zone.Identifier -ErrorAction SilentlyContinue } | Select-Object -First 1
if ($marked) { Fail "The package files carry Windows' 'downloaded from the internet' mark ($($marked.Name)). If the zip came from your IT department: right-click the zip > Properties > tick Unblock > OK, extract it again, then run Install." }
# The development setup of this project (same tab, development add-in Id) must not be doubled by the installed product
$devCat = Join-Path $OfficeRoot 'WEF\TrustedCatalogs\{5D7F6C1E-3B1A-4E5C-9C2E-51D051500001}'
if ((Test-Path $devCat) -or ($null -ne (GetValue $T.Wef '08d15d9d-8629-4583-b67d-5f80143dde6d'))) {
    Fail 'The SL Smart Design development setup is registered for this user. Remove it first (switch-slsd.ps1 -Action Rollback), so the tab is not shown twice.'
}
$licensed = (Test-Path $T.VbaKey) -or (Test-Path $T.VbaFile)
if (-not $licensed -and -not $InstallSlsdAddin) {
    Fail "SL Smart Design is not installed for this user (no $($SLSD.VbaName) add-in). Install it the usual way first (it holds the licence), or ask the administrator."
}
if ($Registration -eq 'Catalog') {
    if (-not $CatalogUrl -or $CatalogUrl -notmatch '^\\\\[^\\]+\\[^\\]+') { Fail 'Catalog registration needs the IT shared folder (\\server\share): deployment.json "catalog_url" or -CatalogUrl.' }
}
$owner = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($owner) {
    $isOurs = @(PilotHosts $P) | Where-Object { $_.ProcessId -eq $owner.OwningProcess }
    $oldPilot = PilotPaths 'AIVisualBuilderPilot'; $isPilot = $T.Real -and (@(PilotHosts $oldPilot) | Where-Object { $_.ProcessId -eq $owner.OwningProcess })
    if (-not $isOurs -and -not $isPilot) { $pr = Get-Process -Id $owner.OwningProcess -ErrorAction SilentlyContinue; Fail "Port $Port is used by $($pr.ProcessName) (process $($pr.Id)). Close it, then run Install again." }
}
$pkg = ReadJson (Join-Path $Src 'package.json')
Say "Package:     SL Smart Design $($pkg.version) (built $($pkg.built))"
Say "Registration: $Registration$(if ($Registration -eq 'Catalog') { " ($CatalogUrl)" })"
if ($old) { Say "Installed:   $($old.version) - this is an update." Green }

# 1. Backup of everything outside the program folder (restored on failure, by Rollback and by Uninstall)
New-Item -ItemType Directory -Force $P.Dest | Out-Null
$oldPilot = PilotPaths 'AIVisualBuilderPilot'
$pilotStartup = $(if ($T.Real) { $oldPilot.Startup } else { $null })      # isolated runs never touch the real pilot
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$bak = BackupState $T (Join-Path $P.Dest "backups\$stamp") $pilotStartup
$baseline = Join-Path $P.Dest 'backups\baseline'
$newBaseline = -not (Test-Path $baseline)
if ($newBaseline) { Copy-Item $bak $baseline -Recurse }        # the state before the very first install
# backups\latest.txt (what Roll back undoes) is written only when this run succeeds (end of the script)
Say "Backup:      $bak" Green
$state = [ordered]@{ pilot_startup = $pilotStartup; instance = $Instance; port = $Port; data_dir = $DataDir; installed = (Get-Date).ToString('s'); registration = $Registration
                     catalog_url = $CatalogUrl; office_root = $OfficeRoot; addins_dir = $AddInsDir; templates_dir = $TemplatesDir; apps_key = $AppsKey }
foreach ($k in 'cert_thumbprint', 'access_created', 'access_path', 'data_dir_created') { if ($old -and $old.$k) { $state[$k] = $old.$k } }
$hadApp = Test-Path (Join-Path $P.App 'server.py')

try {
    # 2. Stop running copies (this product, and the older pilot which used the same port)
    $n = (StopPilot $P) + $(if ($T.Real) { StopPilot $oldPilot } else { 0 })
    if ($n) { Say "Stopped:     $n running panel host process(es) (update)." }

    # 3. Program files; the previous version is kept (app.prev / runtime.prev) until this one has started
    foreach ($d in 'app', 'runtime') {
        $to = Join-Path $P.Dest $d; $prev = "$to.prev"
        if (Test-Path $prev) { Remove-Item $prev -Recurse -Force }
        if (Test-Path $to) { Rename-Item $to (Split-Path $prev -Leaf) }
        Copy-Item (Join-Path $Src $d) $to -Recurse
    }
    foreach ($f in 'common.ps1', 'slsd-common.ps1', 'Install.ps1', 'Uninstall.ps1', 'Rollback.ps1', 'Verify.ps1', 'Restart.ps1', 'Configure-Keys.ps1', 'package.json',
                   'Uninstall SL Smart Design.bat', 'Roll back SL Smart Design.bat', 'Restart SL Smart Design.bat', 'Set AI keys.bat', 'Check SL Smart Design.bat', 'INSTALL-GUIDE.txt') {
        if (Test-Path (Join-Path $Src $f)) { Copy-Item (Join-Path $Src $f) $P.Dest -Force }
    }
    $cfgPath = Join-Path $P.App 'config.json'
    $cfg = ReadJson $cfgPath; $cfg.port = $Port
    $adm = ReadJson (Join-Path $Src 'admin-config.json')                   # administrator-managed settings (no keys)
    if ($adm) { foreach ($k in 'paid_policy', 'paid_order', 'paid_engines', 'napkin_max_per_day', 'claude_max_per_day', 'soft_tints') { if ($adm.PSObject.Properties.Name -contains $k) { $cfg | Add-Member -NotePropertyName $k -NotePropertyValue $adm.$k -Force } } }
    WriteJson $cfgPath $cfg
    $manifest = Join-Path $P.Dest 'manifest-slsd.xml'
    [IO.File]::WriteAllText($manifest, ((Get-Content (Join-Path $Src 'manifest-slsd.template.xml') -Raw) -replace '__PORT__', "$Port"), (New-Object Text.UTF8Encoding $false))
    $state.manifest = $manifest
    Say "Files:       $($P.Dest)" Green
    Simulate 'files'

    # 4. Certificate for https://localhost, access policy, AI keys - as in the pilot
    $state.data_dir_created = $state.data_dir_created -or -not (Test-Path $DataDir)
    New-Item -ItemType Directory -Force $DataDir | Out-Null
    $certPem = Join-Path $DataDir 'cert.pem'; $keyPem = Join-Path $DataDir 'key.pem'
    function TrustedThumb {
        if (-not ((Test-Path $certPem) -and (Test-Path $keyPem))) { return $null }
        try { $c = New-Object Security.Cryptography.X509Certificates.X509Certificate2 $certPem } catch { return $null }
        $t = @(Get-ChildItem Cert:\CurrentUser\Root) + @(Get-ChildItem Cert:\LocalMachine\Root) | Where-Object { $_.Thumbprint -eq $c.Thumbprint -and $_.NotAfter -gt (Get-Date).AddDays(30) }
        if ($t) { $c.Thumbprint } else { $null }
    }
    if ($UseCertFrom) { Copy-Item (Join-Path $UseCertFrom 'cert.pem'), (Join-Path $UseCertFrom 'key.pem') $DataDir -Force; Say 'Certificate: reused an existing trusted one (test option).' Green }
    elseif (TrustedThumb) { Say 'Certificate: already set up and trusted.' Green }
    else {
        $cert = New-SelfSignedCertificate -Subject 'CN=localhost' -FriendlyName 'SL Smart Design (localhost)' `
            -TextExtension @('2.5.29.17={text}DNS=localhost&IPAddress=127.0.0.1', '2.5.29.19={text}CA=false', '2.5.29.37={text}1.3.6.1.5.5.7.3.1') `
            -KeyAlgorithm RSA -KeyLength 2048 -KeyExportPolicy Exportable -Provider 'Microsoft Software Key Storage Provider' `
            -CertStoreLocation 'Cert:\CurrentUser\My' -NotAfter (Get-Date).AddYears(2)
        $rsa = [Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($cert)
        $pkcs8 = $rsa.Key.Export([Security.Cryptography.CngKeyBlobFormat]::Pkcs8PrivateBlob)
        $b64 = { param($bytes) ([Convert]::ToBase64String($bytes) -split '(.{64})' | Where-Object { $_ }) -join "`n" }
        $pemHead = '-----BEGIN ' + 'PRIVATE KEY-----'; $pemTail = '-----END ' + 'PRIVATE KEY-----'
        [IO.File]::WriteAllText($keyPem, "$pemHead`n" + (& $b64 $pkcs8) + "`n$pemTail`n", [Text.Encoding]::ASCII)
        [IO.File]::WriteAllText($certPem, "-----BEGIN CERTIFICATE-----`n" + (& $b64 $cert.RawData) + "`n-----END CERTIFICATE-----`n", [Text.Encoding]::ASCII)
        icacls $keyPem /inheritance:r /grant:r "$($env:USERNAME):(R,W)" | Out-Null
        $pub = Join-Path $env:TEMP "slsd-$PID.cer"; Export-Certificate -Cert $cert -FilePath $pub | Out-Null
        Say 'Windows will now ask whether to install a certificate for "localhost". Choose YES.' Yellow
        try { Import-Certificate -FilePath $pub -CertStoreLocation 'Cert:\CurrentUser\Root' | Out-Null } finally { Remove-Item $pub -ErrorAction SilentlyContinue; Remove-Item $cert.PSPath -ErrorAction SilentlyContinue }
        if (-not (TrustedThumb)) { throw 'The certificate was not trusted (No was chosen, or company policy blocks it).' }
        $state.cert_thumbprint = $cert.Thumbprint
        Say 'Certificate: created and trusted for this Windows user.' Green
    }
    $me = $(if ($env:USERDOMAIN) { "$env:USERDOMAIN\$env:USERNAME" } else { $env:USERNAME })
    $template = ReadJson (Join-Path $Src 'access-template.json')
    $shared = Join-Path $(if ($env:ProgramData) { $env:ProgramData } else { 'C:\ProgramData' }) 'AIVisualBuilder\access.json'
    $pol = ReadJson $shared
    if ($pol) { Say "Access:      existing policy kept ($shared)." Green }
    elseif (-not $state.access_created) {
        $np = [ordered]@{ _comment = 'SL Smart Design: only this Windows account may generate; template = approved Simplilearn Content_Slide check.'; mode = 'windows'; allowed_users = @($me); napkin_max_per_day = 0; template = $template }
        try { New-Item -ItemType Directory -Force (Split-Path $shared) -ErrorAction Stop | Out-Null; WriteJson $shared $np; $state.access_created = $shared }
        catch { $own = Join-Path $DataDir 'access.json'; WriteJson $own $np; $state.access_created = $own; $state.access_path = $own }
        Say "Access:      $me may generate." Green
    }
    $imported = ImportAdminKeys $Src $DataDir
    if ($imported.Count) { Say "AI keys:     $($imported -join ' and ') set up by the administrator (key file imported and deleted)." Green }
    elseif ($AskKeys) { ConfigureKeys $DataDir }
    elseif (@('napkin.json', 'claude.json') | Where-Object { Test-Path (Join-Path $DataDir $_) }) { Say 'AI keys:     already set up for this user (kept).' Green }
    else { Say 'AI keys:     none - built-in designs only until the administrator adds the AI services ("Set AI keys.bat").' Yellow }
    $pj = [ordered]@{ instance = $Instance; port = $Port; data_dir = $DataDir }
    if ($state.access_path) { $pj.access_path = $state.access_path }
    WriteJson $P.Pilot $pj

    # 5. SL Smart Design add-in: the copy with its own tab hidden, under the original name (same registration)
    $srcPpam = Join-Path $Src "slsd\$($SLSD.VbaName).ppam"
    New-Item -ItemType Directory -Force $T.AddInsDir | Out-Null
    Copy-Item $srcPpam $T.VbaFile -Force
    if ((Get-FileHash $srcPpam).Hash -ne (Get-FileHash $T.VbaFile).Hash) { throw 'The SL Smart Design add-in was not written correctly.' }
    if ($null -eq (GetValue $T.VbaKey 'Path')) { SetValue $T.VbaKey 'Path' "$($SLSD.VbaName).ppam" }
    if ($null -eq (GetValue $T.VbaKey 'AutoLoad')) { SetValue $T.VbaKey 'AutoLoad' 1 }
    if (Test-Path $T.V1020Key) { Remove-Item -Path $T.V1020Key -Recurse; Say 'Retired:     V10.20 "SL Smart Design AI" add-in (no longer loaded).' }
    $state.addin_sha256 = (Get-FileHash $srcPpam).Hash
    Say 'SL Smart Design add-in: installed (its own tab hidden; VBA and licence check unchanged).' Green
    Simulate 'addin'

    # 6. Template library: checked; missing files added from the package (never overwritten)
    $tr = TemplateReport $TemplatesDir
    $tz = Join-Path $Src 'templates\SLSD-Templates.zip'
    if ($tr.missing.Count -and (Test-Path $tz)) { $a = InstallTemplates $tz $TemplatesDir; Say "Templates:   $a missing file(s) added from the package." Green; $tr = TemplateReport $TemplatesDir }
    if ($tr.missing.Count) { Say "Templates:   incomplete ($($tr.missing -join ', ')). Run the company's Template Manager, or ask the administrator." Yellow }
    else { Say "Templates:   $($tr.points) point templates and the SL Templates sections present." Green }
    $state.templates = $tr.points

    # 7. Older versions retired, then the registration chosen by IT
    if ($null -ne (GetValue $T.Wef $SLSD.PilotId)) { Remove-ItemProperty -Path $T.Wef -Name $SLSD.PilotId; Say 'Retired:     AI Visual Builder (Pilot) registration (its Home tab group).' }
    if ($pilotStartup -and (Test-Path $pilotStartup)) { Remove-Item $pilotStartup; Say 'Retired:     AI Visual Builder (Pilot) autostart.' }
    switch ($Registration) {
        'Developer' { SetValue $T.Wef $SLSD.ProductId $manifest; if (Test-Path $T.CatKey) { Remove-Item $T.CatKey -Recurse } }
        'Catalog'   { SetValue $T.CatKey 'Id' $SLSD.CatalogId; SetValue $T.CatKey 'Url' $CatalogUrl; SetValue $T.CatKey 'Flags' 1
                      if ($null -ne (GetValue $T.Wef $SLSD.ProductId)) { Remove-ItemProperty -Path $T.Wef -Name $SLSD.ProductId } }
        'Central'   { if ($null -ne (GetValue $T.Wef $SLSD.ProductId)) { Remove-ItemProperty -Path $T.Wef -Name $SLSD.ProductId }
                      if (Test-Path $T.CatKey) { Remove-Item $T.CatKey -Recurse } }
    }
    Say "Registration: $Registration$(switch ($Registration) { 'Central' { ' (the SL Smart Design tab is deployed by IT through Microsoft 365)' } 'Catalog' { " ($CatalogUrl)" } 'Developer' { ' (testing only)' } default { '' } })" Green
    Simulate 'registration'

    # 8. Autostart, Apps & features entry, install record
    if (-not $NoAutostart) {
        $sh = (New-Object -ComObject WScript.Shell).CreateShortcut($P.Startup)
        $sh.TargetPath = $P.Pythonw; $sh.Arguments = '"' + $P.Launcher + '"'; $sh.WorkingDirectory = $P.App; $sh.WindowStyle = 7
        $sh.Description = "SL Smart Design panel host, https://localhost:$Port"; $sh.Save(); $state.autostart = $P.Startup
    }
    EnsureKey $AppsKey
    $state.version = "$($pkg.version)"
    $un = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $P.Dest 'Uninstall.ps1')`" -Instance $Instance"
    foreach ($kv in @(@('DisplayName', 'SL Smart Design'), @('DisplayVersion', $state.version), @('Publisher', 'Simplilearn'), @('InstallLocation', $P.Dest), @('UninstallString', $un))) {
        New-ItemProperty -Path $AppsKey -Name $kv[0] -Value $kv[1] -PropertyType String -Force | Out-Null
    }
    New-ItemProperty -Path $AppsKey -Name 'NoModify' -Value 1 -PropertyType DWord -Force | Out-Null
    New-ItemProperty -Path $AppsKey -Name 'NoRepair' -Value 1 -PropertyType DWord -Force | Out-Null

    # 9. Start and verify over HTTPS (normal certificate checking)
    Simulate 'start'
    $s = StartPilot $P $Port
    if (-not $s) { throw "The panel host did not start (see $DataDir\server.log)." }
    WriteJson $P.State $state
} catch {
    Say ''
    Say "Installation failed: $($_.Exception.Message)" Red
    Say 'Putting back what was there before...' Yellow
    [void](StopPilot $P)
    try { RestoreState $bak; Say '  add-ins and registrations restored.' } catch { Say "  restore failed: $($_.Exception.Message). Use 'Roll back SL Smart Design.bat'." Red }
    foreach ($d in 'app', 'runtime') {
        $to = Join-Path $P.Dest $d
        if (Test-Path "$to.prev") { if (Test-Path $to) { Remove-Item $to -Recurse -Force }; Rename-Item "$to.prev" $d }
        elseif (-not $hadApp -and (Test-Path $to)) { Remove-Item $to -Recurse -Force }
    }
    if (-not $old) {
        Remove-Item $P.Startup -ErrorAction SilentlyContinue
        if (Test-Path $AppsKey) { Remove-Item $AppsKey -Recurse }
    } elseif ($hadApp) {
        $s = StartPilot $P $Port
        if ($s) { Say "  the previous version $($s.server) is running again." Green }
        if ($old.autostart -and -not (Test-Path $P.Startup) -and $NoAutostart) { }   # autostart untouched on failure
    }
    if ($old) { WriteJson $P.State $old }
    # this run's backup is not a state to roll back to (Roll back keeps undoing the last successful installation)
    Remove-Item $bak -Recurse -Force -ErrorAction SilentlyContinue
    if ($newBaseline) { Remove-Item $baseline -Recurse -Force -ErrorAction SilentlyContinue }
    Say 'Nothing else was changed. Fix the cause above and run Install again.' Yellow
    exit 1
}

# 10. Keep the previous version for "Roll back" (one generation); report
Set-Content (Join-Path $P.Dest 'backups\latest.txt') $stamp -Encoding ASCII
$prevDir = Join-Path $P.Dest 'previous'
if (Test-Path "$($P.App).prev") {
    if (Test-Path $prevDir) { Remove-Item $prevDir -Recurse -Force }
    New-Item -ItemType Directory -Force $prevDir | Out-Null
    foreach ($d in 'app', 'runtime') { $pv = (Join-Path $P.Dest $d) + '.prev'; if (Test-Path $pv) { Move-Item $pv (Join-Path $prevDir $d) } }
    if ($old) { WriteJson (Join-Path $prevDir 'install-state.json') $old }
}
Say ''
Say "SL Smart Design $($state.version) - panel host $($s.server) running on https://localhost:$Port/" Green
Say ("  Generate allowed for this account: " + $(if ($s.access.authorized) { 'yes' } else { "NO - $($s.access.reason)" }))
Say ''
Say 'Next:' Cyan
Say '  1. Start PowerPoint (close it first if it is open).'
switch ($Registration) {
    'Catalog' { Say '  2. Once only: Home > Add-ins > Advanced... > SHARED FOLDER > SL Smart Design > Add.'; Say '     From then on the SL Smart Design tab is there at every start.' }
    'Central' { Say '  2. The SL Smart Design tab appears once IT has assigned the add-in to you in Microsoft 365.' }
    'Developer' { Say '  2. Home > Add-ins > SL Smart Design (testing registration: needed in each session).' }
}
Say '  3. SL Smart Design tab: Alternative Design | AI Visual Builder | SL Templates | Miscellaneous | Shape Rename.'
Say ''
