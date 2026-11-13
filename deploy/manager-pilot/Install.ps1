# AI Visual Builder (Pilot) - installs the full desktop version for the current Windows user. No administrator rights.
#  - Copies the app and its own Python runtime to %LOCALAPPDATA%\Programs\AIVisualBuilderPilot (nothing else to install)
#  - Creates a certificate for https://localhost that only this PC trusts (Windows asks once: answer Yes)
#  - Sets who may generate (this Windows account) and the approved Simplilearn template check
#  - Asks for the organization's Napkin and Claude keys (hidden; stored for this Windows user only)
#  - Adds the add-in to PowerPoint (Home tab > AI Visual Builder), starts the panel host now and at every sign-in
# Remove everything with "Uninstall AI Visual Builder.bat" or Settings > Apps > AI Visual Builder (Pilot).
param(
    [string]$Instance = 'AIVisualBuilderPilot',
    [int]$Port = 44317,
    [string]$DataDir,                 # default %LOCALAPPDATA%\AIVisualBuilder (as on the desktop version)
    [switch]$SkipKeys,                # (kept for older instructions: the user is never asked any more)
    [switch]$AskKeys,                 # the administrator at the desk types the keys (hidden input)
    [string]$UseCertFrom,             # tests only: a folder with an already trusted localhost cert.pem/key.pem
    [switch]$NoAutostart
)
. (Join-Path $PSScriptRoot 'common.ps1')
$Src = $PSScriptRoot
$P = PilotPaths $Instance
if (-not $DataDir) { $DataDir = Join-Path $env:LOCALAPPDATA 'AIVisualBuilder' }
$state = [ordered]@{ instance = $Instance; port = $Port; data_dir = $DataDir; installed = (Get-Date).ToString('s') }
$old = ReadJson $P.State

Say ''
Say 'AI Visual Builder (Pilot) - installation' Cyan
Say '-----------------------------------------'

# 0. Checks
if (-not [Environment]::Is64BitOperatingSystem) { Say 'This package needs 64-bit Windows.' Red; exit 1 }
$ppt = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\POWERPNT.EXE' -ErrorAction SilentlyContinue).'(default)'
if ($ppt) { Say "PowerPoint: $ppt" Green } else { Say 'PowerPoint desktop was not found. Install Microsoft 365 PowerPoint first (the add-in needs it).' Yellow }
foreach ($f in 'app\server.py', 'runtime\pythonw.exe', 'manifest-pilot.template.xml') {
    if (-not (Test-Path (Join-Path $Src $f))) { Say "The package is incomplete ($f missing). Extract the whole zip first, then run Install again." Red; exit 1 }
}
$tpl = [xml](Get-Content (Join-Path $Src 'manifest-pilot.template.xml') -Raw)
$AddinId = $tpl.OfficeApp.Id
$WefKey = 'HKCU:\Software\Microsoft\Office\16.0\WEF\Developer'
$devId = '08d15d9d-8629-4583-b67d-5f80143dde6d'
if ((Get-ItemProperty $WefKey -ErrorAction SilentlyContinue).$devId -and $Port -eq 44317) {
    Say 'The development version of AI Visual Builder is registered on this PC and uses the same port. Install the pilot only on a PC without it.' Red; exit 1
}

# 1. Stop a running copy (upgrade), check the port
if ((StopPilot $P) -gt 0) { Say 'Stopped the running pilot panel host (upgrade).' }
$owner = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($owner) {
    $pr = Get-Process -Id $owner.OwningProcess -ErrorAction SilentlyContinue
    Say "Port $Port is used by $($pr.ProcessName) (process $($pr.Id)). Close it, then run Install again." Red; exit 1
}

# 2. Files: app and runtime (keys and usage live in the data folder and are kept). 10.19: an update keeps the previous
# version (app.prev, runtime.prev) until the new one has started and answered; if it does not, the previous one is put
# back and started again (step 7).
New-Item -ItemType Directory -Force $P.Dest | Out-Null
$prevVer = ''
if (Test-Path (Join-Path $P.App 'server.py')) { $prevVer = ([regex]::Match((Get-Content (Join-Path $P.App 'server.py') -Raw), "VERSION = '([^']+)'")).Groups[1].Value }
foreach ($d in 'app', 'runtime') {
    $to = Join-Path $P.Dest $d; $bak = "$to.prev"
    if (Test-Path $bak) { Remove-Item $bak -Recurse -Force }
    if (Test-Path $to) { Rename-Item $to (Split-Path $bak -Leaf) }
    Copy-Item (Join-Path $Src $d) $to -Recurse
}
if ($prevVer) { Say "Update:      $prevVer -> $(([regex]::Match((Get-Content (Join-Path $P.App 'server.py') -Raw), "VERSION = '([^']+)'")).Groups[1].Value) (the previous version is kept until this one runs)" Green }
foreach ($f in 'common.ps1', 'Uninstall.ps1', 'Configure-Keys.ps1', 'Restart.ps1', 'Uninstall AI Visual Builder.bat', 'Set AI keys.bat', 'Restart AI Visual Builder.bat', 'INSTALL-GUIDE.txt') {
    if (Test-Path (Join-Path $Src $f)) { Copy-Item (Join-Path $Src $f) $P.Dest -Force }
}
Get-ChildItem $P.Dest -Recurse -File | Unblock-File      # downloaded zip: remove the "from the internet" mark
$cfgPath = Join-Path $P.App 'config.json'
$cfg = ReadJson $cfgPath; $cfg.port = $Port; WriteJson $cfgPath $cfg
[IO.File]::WriteAllText($P.Manifest, ((Get-Content (Join-Path $Src 'manifest-pilot.template.xml') -Raw) -replace '__PORT__', "$Port"), (New-Object Text.UTF8Encoding $false))
Say "Files:       $($P.Dest)" Green

# 3. Certificate for https://localhost (Office loads add-ins only over HTTPS)
$state.data_dir_created = -not (Test-Path $DataDir)
New-Item -ItemType Directory -Force $DataDir | Out-Null
$certPem = Join-Path $DataDir 'cert.pem'; $keyPem = Join-Path $DataDir 'key.pem'
$Friendly = 'AI Visual Builder pilot (localhost)'
function TrustedThumb {
    if (-not ((Test-Path $certPem) -and (Test-Path $keyPem))) { return $null }
    try { $c = New-Object Security.Cryptography.X509Certificates.X509Certificate2 $certPem } catch { return $null }
    $t = Get-ChildItem Cert:\CurrentUser\Root | Where-Object { $_.Thumbprint -eq $c.Thumbprint -and $_.NotAfter -gt (Get-Date).AddDays(30) }
    if (-not $t) { $t = Get-ChildItem Cert:\LocalMachine\Root | Where-Object { $_.Thumbprint -eq $c.Thumbprint -and $_.NotAfter -gt (Get-Date).AddDays(30) } }
    if ($t) { $c.Thumbprint } else { $null }
}
if ($UseCertFrom) {
    Copy-Item (Join-Path $UseCertFrom 'cert.pem'), (Join-Path $UseCertFrom 'key.pem') $DataDir -Force
    Say 'Certificate: reused an existing trusted one (test option).' Green
} elseif (TrustedThumb) {
    Say 'Certificate: already set up and trusted.' Green
    if ($old -and $old.cert_thumbprint) { $state.cert_thumbprint = $old.cert_thumbprint }
} else {
    $cert = New-SelfSignedCertificate -Subject 'CN=localhost' -FriendlyName $Friendly `
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
    $pub = Join-Path $env:TEMP "aivb-pilot-$PID.cer"
    Export-Certificate -Cert $cert -FilePath $pub | Out-Null
    Say ''
    Say 'Windows will now ask whether to install a certificate for "localhost". Choose YES.' Yellow
    Say '(It is created on this PC, used only by AI Visual Builder at https://localhost, and removed by Uninstall.)'
    try { Import-Certificate -FilePath $pub -CertStoreLocation 'Cert:\CurrentUser\Root' | Out-Null }
    finally { Remove-Item $pub -ErrorAction SilentlyContinue; Remove-Item $cert.PSPath -ErrorAction SilentlyContinue }
    if (-not (TrustedThumb)) { Say 'The certificate was not trusted (No was chosen, or company policy blocks it). Run Install again and choose Yes, or ask IT.' Red; exit 1 }
    $state.cert_thumbprint = $cert.Thumbprint
    Say 'Certificate: created and trusted for this Windows user.' Green
}

# 4. Who may generate (Windows account) and the approved template check, same as the desktop version
$me = $(if ($env:USERDOMAIN) { "$env:USERDOMAIN\$env:USERNAME" } else { $env:USERNAME })
$template = ReadJson (Join-Path $Src 'access-template.json')
$shared = Join-Path $(if ($env:ProgramData) { $env:ProgramData } else { 'C:\ProgramData' }) 'AIVisualBuilder\access.json'
$own = Join-Path $DataDir 'access.json'
function NewPolicy { [ordered]@{ _comment = 'AI Visual Builder (Pilot): only this Windows account may generate; template = approved Simplilearn Content_Slide check.'; mode = 'windows'; allowed_users = @($me); napkin_max_per_day = 0; template = $template } }
$pol = ReadJson $shared
if ($pol) {
    $listed = @($pol.allowed_users) | Where-Object { $_ -and ($_.ToLower() -eq $me.ToLower() -or $_.ToLower() -eq $env:USERNAME.ToLower()) }
    if ($pol.mode -eq 'windows' -and -not $listed) { Say "Access: $shared exists but does not list $me; ask the person who set it up to add this account." Yellow }
    else { Say "Access:      existing policy kept ($shared)." Green }
} else {
    try {
        New-Item -ItemType Directory -Force (Split-Path $shared) -ErrorAction Stop | Out-Null
        WriteJson $shared (NewPolicy)
        $state.access_created = $shared
        Say "Access:      $me may generate ($shared)." Green
    } catch {
        WriteJson $own (NewPolicy)
        $state.access_created = $own; $state.access_path = $own
        Say "Access:      $me may generate (policy kept with the pilot: $own)." Green
    }
}
if ($old -and $old.access_created -and -not $state.access_created) { $state.access_created = $old.access_created; if ($old.access_path) { $state.access_path = $old.access_path } }
if ($old -and $old.cert_thumbprint -and -not $state.cert_thumbprint) { $state.cert_thumbprint = $old.cert_thumbprint }
if ($old -and $old.data_dir_created) { $state.data_dir_created = $true }

# 5. Organization keys for Napkin and Claude (this Windows user only; never in the package or the add-in).
# 10.19: the user is never asked. The administrator's key file (AIVB-keys.json beside this script, for this installation
# only) is imported and deleted; keys already stored are kept; -AskKeys asks (the administrator at the desk).
$imported = ImportAdminKeys $Src $DataDir
if ($imported.Count) { Say "AI keys:     $($imported -join ' and ') set up by the administrator (key file imported and deleted)." Green }
elseif ($AskKeys) { ConfigureKeys $DataDir }
else {
    $have = @('napkin.json', 'claude.json') | Where-Object { Test-Path (Join-Path $DataDir $_) }
    if ($have) { Say 'AI keys:     already set up for this user (kept).' Green }
    else { Say 'AI keys:     none yet - the built-in designs work now; your administrator adds the AI services ("Set AI keys.bat").' Yellow }
}

# 6. Pilot settings for the launcher, PowerPoint registration, autostart, Apps & features entry
$pj = [ordered]@{ instance = $Instance; port = $Port; data_dir = $DataDir }
if ($state.access_path) { $pj.access_path = $state.access_path }
WriteJson $P.Pilot $pj
if (-not (Test-Path $WefKey)) { New-Item -Path $WefKey | Out-Null }   # never -Force on an existing key: it would wipe the other sideloaded add-ins
New-ItemProperty -Path $WefKey -Name $AddinId -Value $P.Manifest -PropertyType String -Force | Out-Null
$state.addin_id = $AddinId
Say 'PowerPoint:  add-in registered (Home tab > AI Visual Builder).' Green
if (-not $NoAutostart) {
    $sh = (New-Object -ComObject WScript.Shell).CreateShortcut($P.Startup)
    $sh.TargetPath = $P.Pythonw; $sh.Arguments = '"' + $P.Launcher + '"'; $sh.WorkingDirectory = $P.App; $sh.WindowStyle = 7
    $sh.Description = "AI Visual Builder (Pilot) panel host, https://localhost:$Port"
    $sh.Save(); $state.autostart = $P.Startup
    Say 'Autostart:   starts automatically when you sign in to Windows.' Green
}
New-Item -Path $P.UninstallKey -Force | Out-Null
$ver = ([regex]::Match((Get-Content (Join-Path $P.App 'server.py') -Raw), "VERSION = '([^']+)'")).Groups[1].Value
$un = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $P.Dest 'Uninstall.ps1')`" -Instance $Instance"
foreach ($kv in @(@('DisplayName', 'AI Visual Builder (Pilot)'), @('DisplayVersion', $ver), @('Publisher', 'AI Visual Builder'), @('InstallLocation', $P.Dest), @('UninstallString', $un))) {
    New-ItemProperty -Path $P.UninstallKey -Name $kv[0] -Value $kv[1] -PropertyType String -Force | Out-Null
}
New-ItemProperty -Path $P.UninstallKey -Name 'NoModify' -Value 1 -PropertyType DWord -Force | Out-Null
New-ItemProperty -Path $P.UninstallKey -Name 'NoRepair' -Value 1 -PropertyType DWord -Force | Out-Null
WriteJson $P.State $state

# 7. Start and verify over HTTPS (normal certificate checking)
$s = StartPilot $P $Port
if (-not $s -and (Test-Path "$($P.App).prev")) {
    # 10.19: roll back to the version that worked
    [void](StopPilot $P)
    foreach ($d in 'app', 'runtime') { $to = Join-Path $P.Dest $d; if (Test-Path "$to.prev") { Remove-Item $to -Recurse -Force; Rename-Item "$to.prev" $d } }
    $s = StartPilot $P $Port
    if ($s) { Say "The new version did not start, so version $($s.server) was put back and is running. See $DataDir\server.log." Yellow; exit 1 }
}
if (-not $s) { Say "The panel host did not start. See $DataDir\server.log, then run Install again." Red; exit 1 }
foreach ($d in 'app', 'runtime') { $bak = (Join-Path $P.Dest $d) + '.prev'; if (Test-Path $bak) { Remove-Item $bak -Recurse -Force } }
Say ''
Say "AI Visual Builder $($s.server) is running on https://localhost:$Port/" Green
Say ("  Generate allowed for this account: " + $(if ($s.access.authorized) { 'yes' } else { "NO - $($s.access.reason)" }))
Say ("  Napkin AI: " + $(if ($s.napkin.configured) { 'key stored' } else { 'no key (built-in designs only)' }) + "   Claude: " + $(if ($s.claude.configured) { 'key stored' } else { 'no key' }) + $(if ($s.claude.sdk) { '' } else { ' (Claude library missing: reinstall)' }))
Say ''
Say 'Next:' Cyan
Say '  1. Close PowerPoint completely if it is open, then start it again.'
Say '  2. Open a deck on the Simplilearn LVC template and select a Content_Slide.'
Say '  3. Home tab > AI Visual Builder > Generate visuals.'
Say '     If the group is missing: Home > Add-ins > More Add-ins > MY ADD-INS > Upload My Add-in > Browse, choose'
Say "     $($P.Manifest)"
Say '     and Upload (once).'
Say ''
