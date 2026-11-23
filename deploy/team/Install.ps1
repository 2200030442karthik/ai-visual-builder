# SL Smart Design + AI Visual Builder - team installation (V10.22). One double-click, about a minute.
# Result: ONE "SL Smart Design" tab - Alternative Design, AI Visual Builder, Several slides, Edit a visual, SL Templates,
# Miscellaneous, Shape Rename - with the AI features unlocked by the activation key from the manager.
# For this Windows user:
#   - copies the app and its own Python runtime to %LOCALAPPDATA%\Programs\AIVisualBuilderPilot (nothing else to install)
#   - a certificate for https://localhost that only this PC trusts (Windows asks once: Yes)
#   - the SL Smart Design tab as a "shared folder" add-in, so it is there at every start: a hidden read-only share of the
#     installation's catalog folder on this PC (Windows asks once for permission: Yes) and its trusted-catalog entry.
#     Without administrator permission it falls back to a per-session registration and keeps the original tab.
#   - retires the older AI Visual Builder tabs/groups of this project (the V10.20 "SLSD_AIVisualBuilder" add-in and the
#     pilot's Home-tab group), never anything else
#   - asks for the activation key (it unlocks the organization's Claude and Napkin keys in this package for this user)
#   - starts the panel host now and at every sign-in
# SL Smart Design itself: this installer does not change it. The panel host hides the original add-in's own tab ONLY
# after PowerPoint really shows the new SL Smart Design tab, only while PowerPoint is closed, from this user's own file
# (only its ribbon XML changes; the original is kept byte for byte) - and puts the original back automatically if the
# new tab is ever missing (local-ai\slsd_tab.py). "Restore SL Smart Design.bat" and Uninstall put it back at once.
# If the earlier unified / "Easy Pilot" installer is on the PC, its own uninstaller runs first (asked; PowerPoint closed).
param(
    [string]$Instance = 'AIVisualBuilderPilot',     # same as the earlier pilots: an update replaces them in place
    [int]$Port = 44317,
    [string]$DataDir,                                # default %LOCALAPPDATA%\AIVisualBuilder
    [string]$ActivationKey,                          # unattended installation (otherwise asked)
    [int]$DailyLimit = 30,                           # Claude and Napkin requests per user per day (0 = no local cap)
    [switch]$SkipRepair,                             # do not look for the unified SL Smart Design installation
    [switch]$NoRegister,                             # tests: no PowerPoint registration, share or retirement
    [switch]$NoAutostart,
    [string]$UseCertFrom                             # tests: a folder with an already trusted localhost cert.pem/key.pem
)
. (Join-Path $PSScriptRoot 'common.ps1')
$Src = $PSScriptRoot
$P = PilotPaths $Instance
if (-not $DataDir) { $DataDir = Join-Path $env:LOCALAPPDATA 'AIVisualBuilder' }
$old = ReadJson $P.State
$state = [ordered]@{ instance = $Instance; port = $Port; data_dir = $DataDir; installed = (Get-Date).ToString('s'); edition = 'team' }
$t0 = Get-Date
$Office = 'HKCU:\Software\Microsoft\Office\16.0'
$WefKey = "$Office\WEF\Developer"
$ProductId = '2f01d600-c9ec-4d94-ade9-69b8b6f0bfa7'
$CatalogId = '{EEBC6074-F7DB-4E1A-A3DC-BC2784D4BF34}'
$CatKey = "$Office\WEF\TrustedCatalogs\$CatalogId"
$ShareName = 'SLSmartDesign$'

Say ''
Say 'SL Smart Design + AI Visual Builder - installation' Cyan
Say '--------------------------------------------------'

# 0. Checks (nothing changed yet)
if (-not [Environment]::Is64BitOperatingSystem) { Say 'This package needs 64-bit Windows.' Red; exit 1 }
foreach ($f in 'app\server.py', 'app\activation.py', 'app\slsd_tab.py', 'app\activation-bundle.json', 'runtime\python.exe', 'runtime\pythonw.exe',
               'manifest-slsd.template.xml', 'access-template.json', 'Share.ps1') {
    if (-not (Test-Path (Join-Path $Src $f))) { Say "The package is incomplete ($f missing). Right-click the zip > Extract All, then run Install from the extracted folder." Red; exit 1 }
}
$ppt = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\POWERPNT.EXE' -ErrorAction SilentlyContinue).'(default)'
if ($ppt) { Say "PowerPoint:  found" Green } else { Say 'PowerPoint:  desktop PowerPoint was not found (install Microsoft 365 PowerPoint to use the add-in).' Yellow }
$vba = Join-Path $env:APPDATA 'Microsoft\AddIns\SL_Smart_Design_v2_Key_Dec_25.ppam'
if (Test-Path $vba) { Say 'SL Smart Design: found (its licensed add-in is used as it is).' Green }
else { Say 'SL Smart Design: not installed for this user - the AI features work; ask the SL Smart Design administrator for its add-in to use its commands.' Yellow }
$devId = '08d15d9d-8629-4583-b67d-5f80143dde6d'
$devCat = "$Office\WEF\TrustedCatalogs\{5D7F6C1E-3B1A-4E5C-9C2E-51D051500001}"
if ($Port -eq 44317 -and (((Get-ItemProperty $WefKey -ErrorAction SilentlyContinue).$devId) -or (Test-Path $devCat))) {
    Say 'This PC has the AI Visual Builder development setup on the same port. Install the team version on another PC.' Red; exit 1
}

# 1. Undo the earlier unified / Easy Pilot installation if it is here (its own uninstaller; asked first)
if (-not $SkipRepair) { $state.slsd_repair = RepairSLSD -NoPrompt:([bool]$ActivationKey) }

# 2. Stop a running copy (update), check the port
if ((StopPilot $P) -gt 0) { Say 'Update:      the running version was stopped.' }
$owner = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($owner) {
    $pr = Get-Process -Id $owner.OwningProcess -ErrorAction SilentlyContinue
    Say "Port $Port is used by $($pr.ProcessName) (process $($pr.Id)). Close it (or sign out and in again), then run Install again." Red; exit 1
}

# 3. Files. An update keeps the previous version (app.prev, runtime.prev) until the new one answers (step 8).
New-Item -ItemType Directory -Force $P.Dest | Out-Null
foreach ($d in 'app', 'runtime') {
    $to = Join-Path $P.Dest $d; $bak = "$to.prev"
    if (Test-Path $bak) { Remove-Item $bak -Recurse -Force }
    if (Test-Path $to) { Rename-Item $to (Split-Path $bak -Leaf) }
    Copy-Item (Join-Path $Src $d) $to -Recurse
}
# files of the earlier team pilot that no longer apply (plain-text keys, the SL Smart Design copy tool, old manifest)
foreach ($f in 'AIVB-keys.json', 'Set AI keys.bat', 'Configure-Keys.ps1', 'Restore-Original-SLSD.bat', 'Restore-Original-SLSD.ps1', 'START HERE - Team Pilot Guide.txt', 'manifest-pilot.xml') {
    Remove-Item (Join-Path $P.Dest $f) -Force -ErrorAction SilentlyContinue
}
foreach ($f in 'common.ps1', 'Uninstall.ps1', 'Restart.ps1', 'Activate.ps1', 'Repair-SLSD.ps1', 'Share.ps1', 'Uninstall AI Visual Builder.bat', 'Restart AI Visual Builder.bat',
               'Activate AI Visual Builder.bat', 'Restore SL Smart Design.bat', 'START HERE.txt') {
    if (Test-Path (Join-Path $Src $f)) { Copy-Item (Join-Path $Src $f) $P.Dest -Force }
}
Get-ChildItem $P.Dest -Recurse -File | Unblock-File      # downloaded zip: the "from the internet" mark, for our own files only
$cfgPath = Join-Path $P.App 'config.json'
$cfg = ReadJson $cfgPath; $cfg.port = $Port; WriteJson $cfgPath $cfg
$Catalog = Join-Path $P.Dest 'catalog'
New-Item -ItemType Directory -Force $Catalog | Out-Null
$Manifest = Join-Path $Catalog 'manifest-slsd.xml'
[IO.File]::WriteAllText($Manifest, ((Get-Content (Join-Path $Src 'manifest-slsd.template.xml') -Raw) -replace '__PORT__', "$Port"), (New-Object Text.UTF8Encoding $false))
Say "Files:       $($P.Dest)" Green

# 4. Certificate for https://localhost (Office loads add-ins only over HTTPS)
$state.data_dir_created = -not (Test-Path $DataDir)
if ($old -and $old.data_dir_created) { $state.data_dir_created = $true }
New-Item -ItemType Directory -Force $DataDir | Out-Null
$certPem = Join-Path $DataDir 'cert.pem'; $keyPem = Join-Path $DataDir 'key.pem'
function TrustedThumb {
    if (-not ((Test-Path $certPem) -and (Test-Path $keyPem))) { return $null }
    try { $c = New-Object Security.Cryptography.X509Certificates.X509Certificate2 $certPem } catch { return $null }
    $t = Get-ChildItem Cert:\CurrentUser\Root | Where-Object { $_.Thumbprint -eq $c.Thumbprint -and $_.NotAfter -gt (Get-Date).AddDays(30) }
    if (-not $t) { $t = Get-ChildItem Cert:\LocalMachine\Root | Where-Object { $_.Thumbprint -eq $c.Thumbprint -and $_.NotAfter -gt (Get-Date).AddDays(30) } }
    if ($t) { $c.Thumbprint } else { $null }
}
if ($old -and $old.cert_thumbprint) { $state.cert_thumbprint = $old.cert_thumbprint }
if ($UseCertFrom) {
    Copy-Item (Join-Path $UseCertFrom 'cert.pem'), (Join-Path $UseCertFrom 'key.pem') $DataDir -Force
    Say 'Certificate: reused an existing trusted one (test option).' Green
} elseif (TrustedThumb) {
    Say 'Certificate: already set up and trusted.' Green
} else {
    $cert = New-SelfSignedCertificate -Subject 'CN=localhost' -FriendlyName 'AI Visual Builder (localhost)' `
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
    $pub = Join-Path $env:TEMP "aivb-team-$PID.cer"
    Export-Certificate -Cert $cert -FilePath $pub | Out-Null
    Say ''
    Say 'Windows now asks whether to install a certificate for "localhost". Choose YES.' Yellow
    Say '(Made on this PC, used only by AI Visual Builder at https://localhost; Uninstall removes it.)'
    try { Import-Certificate -FilePath $pub -CertStoreLocation 'Cert:\CurrentUser\Root' | Out-Null } catch { }
    finally { Remove-Item $pub -ErrorAction SilentlyContinue; Remove-Item $cert.PSPath -ErrorAction SilentlyContinue }
    if (-not (TrustedThumb)) { Say 'The certificate was not trusted (No was chosen, or company policy blocks it). Run Install again and choose Yes, or ask IT.' Red; exit 1 }
    $state.cert_thumbprint = $cert.Thumbprint
    Say 'Certificate: created and trusted for this Windows user.' Green
}

# 5. Who may generate: this Windows account, with a daily cap on the paid AI services; the approved template check.
$me = $(if ($env:USERDOMAIN) { "$env:USERDOMAIN\$env:USERNAME" } else { $env:USERNAME })
$policyPath = Join-Path $DataDir 'access.json'
WriteJson $policyPath ([ordered]@{
    _comment = 'AI Visual Builder (team): this Windows account may generate; daily caps per user; template = approved Simplilearn Content_Slide check.'
    mode = 'windows'; allowed_users = @($me); napkin_max_per_day = 0
    napkin_max_per_user_per_day = $DailyLimit; claude_max_per_user_per_day = $DailyLimit
    template = (ReadJson (Join-Path $Src 'access-template.json'))
})
$state.access_path = $policyPath
Say "Access:      $me$(if ($DailyLimit -gt 0) { " (up to $DailyLimit Claude and $DailyLimit Napkin requests a day)" })" Green

# 6. Activation: unlocks the AI keys for this user on this PC (asked here, or later in PowerPoint)
$state.activated = ActivateInteractive $P $DataDir $ActivationKey

# 7. PowerPoint: the SL Smart Design tab (shared-folder catalog on this PC), older tabs of this project retired
$unify = $false
if (-not $NoRegister) {
    # our own older entries only: the pilot's Home-tab group and the V10.20 "SLSD_AIVisualBuilder" VBA add-in
    $retired = @()
    if ((Get-ItemProperty $WefKey -ErrorAction SilentlyContinue).'78643140-2b68-48d8-b072-3b253dddf2b8') {
        Remove-ItemProperty -Path $WefKey -Name '78643140-2b68-48d8-b072-3b253dddf2b8'; $retired += 'AI Visual Builder Home-tab group' }
    if (Test-Path "$Office\PowerPoint\AddIns\SLSD_AIVisualBuilder") { Remove-Item "$Office\PowerPoint\AddIns\SLSD_AIVisualBuilder" -Recurse; $retired += 'old AI Visual Builder tab (SLSD_AIVisualBuilder)' }
    if ($retired) { Say "Retired:     $($retired -join ', ') (replaced by the SL Smart Design tab)." Green }

    $unc = "\\$env:COMPUTERNAME\$ShareName"
    $svc = Get-Service LanmanServer -ErrorAction SilentlyContinue
    if (-not (Test-Path (Join-Path $unc 'manifest-slsd.xml')) -and $svc -and $svc.Status -eq 'Running') {
        Say ''
        Say 'Windows now asks for permission to share the add-in folder with PowerPoint (read-only, only you). Choose YES.' Yellow
        try {
            $args3 = "-NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $P.Dest 'Share.ps1')`" -Path `"$Catalog`" -Name `"$ShareName`" -User `"$me`""
            Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList $args3      # visible window: endpoint security blocks hidden elevated scripts
        } catch { }
    }
    if (Test-Path (Join-Path $unc 'manifest-slsd.xml')) {
        if (-not (Test-Path $CatKey)) { New-Item -Path $CatKey -Force | Out-Null }
        New-ItemProperty -Path $CatKey -Name 'Id' -Value $CatalogId -PropertyType String -Force | Out-Null
        New-ItemProperty -Path $CatKey -Name 'Url' -Value $unc -PropertyType String -Force | Out-Null
        New-ItemProperty -Path $CatKey -Name 'Flags' -Value 1 -PropertyType DWord -Force | Out-Null
        if ((Get-ItemProperty $WefKey -ErrorAction SilentlyContinue).$ProductId) { Remove-ItemProperty -Path $WefKey -Name $ProductId }
        $state.registration = 'catalog'; $state.catalog_url = $unc; $state.share = $ShareName; $unify = $true
        Say "PowerPoint:  SL Smart Design tab registered (shared folder $unc)." Green
    } else {
        if (-not (Test-Path $WefKey)) { New-Item -Path $WefKey | Out-Null }   # never -Force on an existing key: it would wipe the other sideloaded add-ins
        New-ItemProperty -Path $WefKey -Name $ProductId -Value $Manifest -PropertyType String -Force | Out-Null
        $state.registration = 'developer'
        Say 'PowerPoint:  SL Smart Design tab registered for each session (no permission to share the folder);' Yellow
        Say '             the original SL Smart Design tab stays as well.' Yellow
    }
    $state.addin_id = $ProductId
}

# 8. Launcher settings, autostart, Apps & features entry
WriteJson $P.Pilot ([ordered]@{ instance = $Instance; port = $Port; data_dir = $DataDir; access_path = $policyPath; activation = $true; slsd_unify = $unify })
if (-not $NoAutostart) {
    $sh = (New-Object -ComObject WScript.Shell).CreateShortcut($P.Startup)
    $sh.TargetPath = $P.Pythonw; $sh.Arguments = '"' + $P.Launcher + '"'; $sh.WorkingDirectory = $P.App; $sh.WindowStyle = 7
    $sh.Description = "SL Smart Design + AI Visual Builder service, https://localhost:$Port"
    $sh.Save(); $state.autostart = $P.Startup
}
$ver = ([regex]::Match((Get-Content (Join-Path $P.App 'server.py') -Raw), "VERSION = '([^']+)'")).Groups[1].Value
New-Item -Path $P.UninstallKey -Force | Out-Null
$un = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $P.Dest 'Uninstall.ps1')`" -Instance $Instance"
foreach ($kv in @(@('DisplayName', 'SL Smart Design + AI Visual Builder'), @('DisplayVersion', $ver), @('Publisher', 'AI Visual Builder'), @('InstallLocation', $P.Dest), @('UninstallString', $un))) {
    New-ItemProperty -Path $P.UninstallKey -Name $kv[0] -Value $kv[1] -PropertyType String -Force | Out-Null
}
New-ItemProperty -Path $P.UninstallKey -Name 'NoModify' -Value 1 -PropertyType DWord -Force | Out-Null
New-ItemProperty -Path $P.UninstallKey -Name 'NoRepair' -Value 1 -PropertyType DWord -Force | Out-Null
WriteJson $P.State $state

# 9. Start and verify over HTTPS (normal certificate checking); an update that does not start puts the previous one back
$s = StartPilot $P $Port
if (-not $s -and (Test-Path "$($P.App).prev")) {
    [void](StopPilot $P)
    foreach ($d in 'app', 'runtime') { $to = Join-Path $P.Dest $d; if (Test-Path "$to.prev") { Remove-Item $to -Recurse -Force; Rename-Item "$to.prev" $d } }
    $s = StartPilot $P $Port
    if ($s) { Say "The new version did not start, so version $($s.server) was put back and is running. See $DataDir\server.log." Yellow; exit 1 }
}
if (-not $s) { Say "AI Visual Builder did not start. See $DataDir\server.log, then run Install again." Red; exit 1 }
foreach ($d in 'app', 'runtime') { $bak = (Join-Path $P.Dest $d) + '.prev'; if (Test-Path $bak) { Remove-Item $bak -Recurse -Force } }

Say ''
Say "Installed and running: version $($s.server) ($([int]((Get-Date) - $t0).TotalSeconds) s)." Green
if ($s.activation.ok) {
    Say ("  Claude: " + $(if ($s.claude.configured) { 'ready' } else { 'not in this package' }) + "   Napkin: " + $(if ($s.napkin.configured) { 'ready' } else { 'not in this package' }) + "   Built-in designs: ready") Green
} else { Say '  AI not activated yet: the panel asks for your activation key when you open it.' Yellow }
Say ''
Say 'Next (once):' Cyan
if ($state.registration -eq 'catalog') {
    Say '  1. Start PowerPoint.'
    Say '  2. Home > Add-ins > Advanced (or More Add-ins) > SHARED FOLDER > SL Smart Design > Add.'
    Say '  3. Close PowerPoint and start it again: from now on there is ONE SL Smart Design tab with everything.'
    Say '     (Until step 3, the original SL Smart Design tab is still there too - nothing is lost at any point.)'
} elseif ($state.registration -eq 'developer') {
    Say '  Start PowerPoint > Home > Add-ins > SL Smart Design (needed in each PowerPoint session).'
}
Say ''
exit 0
