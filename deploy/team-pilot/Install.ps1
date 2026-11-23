# AI Visual Builder (Team Pilot) - Easy 1-Click Installer
# Installs standalone AI Visual Builder for PowerPoint.
# Updates the SL Smart Design tab with the "AI Visual Builder" button!
# Automatically configures full Claude AI & Napkin AI access.
param(
    [string]$Instance = 'AIVisualBuilderPilot',
    [int]$Port = 44317,
    [string]$DataDir,
    [switch]$SkipKeys,
    [switch]$AskKeys,
    [string]$UseCertFrom,
    [switch]$NoAutostart
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')
$Src = $PSScriptRoot
$P = PilotPaths $Instance
if (-not $DataDir) { $DataDir = Join-Path $env:LOCALAPPDATA 'AIVisualBuilder' }
$state = [ordered]@{ instance = $Instance; port = $Port; data_dir = $DataDir; installed = (Get-Date).ToString('s') }
$old = ReadJson $P.State

Say ''
Say '===========================================================' Cyan
Say '  SL Smart Design + AI Visual Builder (Team Pilot Setup)  ' Cyan
Say '===========================================================' Cyan
Say ''

# 0. Prerequisites check
if (-not [Environment]::Is64BitOperatingSystem) { Say 'Error: This package requires 64-bit Windows.' Red; exit 1 }

if (Get-Process 'POWERPNT' -ErrorAction SilentlyContinue) {
    Say 'NOTICE: Microsoft PowerPoint is currently running.' Yellow
    Say 'Closing PowerPoint to register add-ins...' Yellow
    Stop-Process -Name 'POWERPNT' -Force -ErrorAction SilentlyContinue
    Start-Sleep 1
}

$ppt = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\POWERPNT.EXE' -ErrorAction SilentlyContinue).'(default)'
if ($ppt) { Say "PowerPoint: found ($ppt)" Green }

foreach ($f in 'app\server.py', 'runtime\pythonw.exe', 'manifest-pilot.template.xml') {
    if (-not (Test-Path (Join-Path $Src $f))) { Say "Package incomplete ($f missing). Extract the full ZIP before running." Red; exit 1 }
}

# 1. Protect & Update SL Smart Design Tab (Both Original + AI Visuals)
Say ''
Say 'Configuring SL Smart Design Ribbon Add-ins...' Cyan
$userAddinsDir = Join-Path $env:APPDATA 'Microsoft\AddIns'
if (-not (Test-Path $userAddinsDir)) { New-Item -ItemType Directory -Force $userAddinsDir | Out-Null }

$origSlsdFile = Join-Path $Src 'original_slsd\SL_Smart_Design_v2_Key_Dec_25.ppam'
$userSlsdFile = Join-Path $userAddinsDir 'SL_Smart_Design_v2_Key_Dec_25.ppam'
$slsdReg = 'HKCU:\Software\Microsoft\Office\16.0\PowerPoint\AddIns\SL_Smart_Design_v2_Key_Dec_25'

# 1a. Original SL Smart Design (ensure 57,600 bytes with visible tab)
if (Test-Path $userSlsdFile) {
    $curLen = (Get-Item $userSlsdFile).Length
    if ($curLen -eq 56435 -or ($curLen -ne 57600 -and (Test-Path $origSlsdFile))) {
        if (Test-Path $origSlsdFile) {
            Copy-Item $origSlsdFile $userSlsdFile -Force
            Say '  [REPAIRED] Original SL Smart Design add-in restored (visible tab).' Green
        }
    } else {
        Say '  [OK] Original SL Smart Design add-in is intact.' Green
    }
} elseif (Test-Path $origSlsdFile) {
    Copy-Item $origSlsdFile $userSlsdFile -Force
    Say '  [INSTALLED] Original SL Smart Design add-in placed in add-ins folder.' Green
}

if (-not (Test-Path $slsdReg)) { New-Item -Path $slsdReg -Force | Out-Null }
Set-ItemProperty -Path $slsdReg -Name 'Path' -Value 'SL_Smart_Design_v2_Key_Dec_25.ppam' -Force
New-ItemProperty -Path $slsdReg -Name 'AutoLoad' -Value 1 -PropertyType DWord -Force | Out-Null

# 1b. SLSD AI Visual Builder ribbon add-in (adds "AI Visual Builder" button onto the SL Smart Design tab)
$aiPpam = Join-Path $Src 'original_slsd\SLSD_AIVisualBuilder.ppam'
$userAiPpam = Join-Path $userAddinsDir 'SLSD_AIVisualBuilder.ppam'
$aiReg = 'HKCU:\Software\Microsoft\Office\16.0\PowerPoint\AddIns\SLSD_AIVisualBuilder'

if (Test-Path $aiPpam) {
    Copy-Item $aiPpam $userAiPpam -Force
    if (-not (Test-Path $aiReg)) { New-Item -Path $aiReg -Force | Out-Null }
    Set-ItemProperty -Path $aiReg -Name 'Path' -Value 'SLSD_AIVisualBuilder.ppam' -Force
    New-ItemProperty -Path $aiReg -Name 'AutoLoad' -Value 1 -PropertyType DWord -Force | Out-Null
    Say '  [OK] SL Smart Design tab updated with AI Visual Builder buttons.' Green
}

# 1c. Set VBA registry pointer for open-panel
$vbaReg = 'HKCU:\Software\VB and VBA Program Settings\AIVisualBuilder\Install'
if (-not (Test-Path $vbaReg)) { New-Item -Path $vbaReg -Force | Out-Null }
Set-ItemProperty -Path $vbaReg -Name 'Path' -Value $P.App -Force

# 2. Stop any previous instance of the pilot panel host
if ((StopPilot $P) -gt 0) { Say 'Stopped previous running pilot host (updating).' }
$owner = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($owner) {
    $pr = Get-Process -Id $owner.OwningProcess -ErrorAction SilentlyContinue
    if ($pr -and $pr.ProcessName -notlike 'python*') {
        Say "Port $Port is used by $($pr.ProcessName). Please free port $Port or restart." Red
        exit 1
    }
}

# 3. Copy Application & Runtime files
Say ''
Say 'Installing AI Visual Builder files...' Cyan
New-Item -ItemType Directory -Force $P.Dest | Out-Null
foreach ($d in 'app', 'runtime') {
    $to = Join-Path $P.Dest $d
    if (Test-Path $to) { Remove-Item $to -Recurse -Force }
    Copy-Item (Join-Path $Src $d) $to -Recurse
}
foreach ($f in 'common.ps1', 'Uninstall.ps1', 'Configure-Keys.ps1', 'Restart.ps1', 'Restore-Original-SLSD.ps1',
               'Uninstall AI Visual Builder.bat', 'Set AI keys.bat', 'Restart AI Visual Builder.bat', 'Restore-Original-SLSD.bat',
               'START HERE - Team Pilot Guide.txt') {
    if (Test-Path (Join-Path $Src $f)) { Copy-Item (Join-Path $Src $f) $P.Dest -Force }
}

# Ensure open-panel.ps1 is in app dir for the ribbon button
$openScript = Join-Path $PSScriptRoot '..\..\local-ai\open-panel.ps1'
if (Test-Path $openScript) { Copy-Item $openScript (Join-Path $P.App 'open-panel.ps1') -Force }

# Update config port
$cfgPath = Join-Path $P.App 'config.json'
$cfg = ReadJson $cfgPath
if ($cfg) {
    $cfg.port = $Port
    $cfg.paid_policy = 'when-needed'
    WriteJson $cfgPath $cfg
}

# Generate manifest for this installation
$tpl = [xml](Get-Content (Join-Path $Src 'manifest-pilot.template.xml') -Raw)
$AddinId = $tpl.OfficeApp.Id
$manifestContent = (Get-Content (Join-Path $Src 'manifest-pilot.template.xml') -Raw) -replace '__PORT__', "$Port"
[IO.File]::WriteAllText($P.Manifest, $manifestContent, (New-Object Text.UTF8Encoding $false))
Say "  Files installed to: $($P.Dest)" Green

# 4. Localhost SSL Certificate setup
New-Item -ItemType Directory -Force $DataDir | Out-Null
$certPem = Join-Path $DataDir 'cert.pem'; $keyPem = Join-Path $DataDir 'key.pem'
$Friendly = 'AI Visual Builder pilot (localhost)'

function CheckTrustedCert {
    if (-not ((Test-Path $certPem) -and (Test-Path $keyPem))) { return $null }
    try { $c = New-Object Security.Cryptography.X509Certificates.X509Certificate2 $certPem } catch { return $null }
    $t = Get-ChildItem Cert:\CurrentUser\Root | Where-Object { $_.Thumbprint -eq $c.Thumbprint -and $_.NotAfter -gt (Get-Date).AddDays(30) }
    if (-not $t) { $t = Get-ChildItem Cert:\LocalMachine\Root | Where-Object { $_.Thumbprint -eq $c.Thumbprint -and $_.NotAfter -gt (Get-Date).AddDays(30) } }
    if ($t) { $c.Thumbprint } else { $null }
}

if ($UseCertFrom) {
    Copy-Item (Join-Path $UseCertFrom 'cert.pem'), (Join-Path $UseCertFrom 'key.pem') $DataDir -Force
    Say '  Certificate: Reused existing certificate.' Green
} elseif (CheckTrustedCert) {
    Say '  Certificate: Already trusted for localhost.' Green
    if ($old -and $old.cert_thumbprint) { $state.cert_thumbprint = $old.cert_thumbprint }
} else {
    Say '  Creating localhost SSL certificate...' Cyan
    $cert = New-SelfSignedCertificate -Subject 'CN=localhost' -FriendlyName $Friendly `
        -TextExtension @('2.5.29.17={text}DNS=localhost&IPAddress=127.0.0.1', '2.5.29.19={text}CA=false', '2.5.29.37={text}1.3.6.1.5.5.7.3.1') `
        -KeyAlgorithm RSA -KeyLength 2048 -KeyExportPolicy Exportable -Provider 'Microsoft Software Key Storage Provider' `
        -CertStoreLocation 'Cert:\CurrentUser\My' -NotAfter (Get-Date).AddYears(2)
    $rsa = [Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($cert)
    $pkcs8 = $rsa.Key.Export([Security.Cryptography.CngKeyBlobFormat]::Pkcs8PrivateBlob)
    $b64 = { param($bytes) ([Convert]::ToBase64String($bytes) -split '(.{64})' | Where-Object { $_ }) -join "`n" }
    $pemHead = '-----BEGIN PRIVATE KEY-----'; $pemTail = '-----END PRIVATE KEY-----'
    [IO.File]::WriteAllText($keyPem, "$pemHead`n" + (& $b64 $pkcs8) + "`n$pemTail`n", [Text.Encoding]::ASCII)
    [IO.File]::WriteAllText($certPem, "-----BEGIN CERTIFICATE-----`n" + (& $b64 $cert.RawData) + "`n-----END CERTIFICATE-----`n", [Text.Encoding]::ASCII)
    icacls $keyPem /inheritance:r /grant:r "$($env:USERNAME):(R,W)" | Out-Null
    $pub = Join-Path $env:TEMP "aivb-team-pilot-$PID.cer"
    Export-Certificate -Cert $cert -FilePath $pub | Out-Null
    try { Import-Certificate -FilePath $pub -CertStoreLocation 'Cert:\CurrentUser\Root' | Out-Null }
    finally { Remove-Item $pub -ErrorAction SilentlyContinue; Remove-Item $cert.PSPath -ErrorAction SilentlyContinue }
    $state.cert_thumbprint = $cert.Thumbprint
    Say '  Certificate: Trusted successfully for this Windows user.' Green
}

# 5. Access Policy setup
$me = $(if ($env:USERDOMAIN) { "$env:USERDOMAIN\$env:USERNAME" } else { $env:USERNAME })
$template = ReadJson (Join-Path $Src 'access-template.json')
$shared = Join-Path $(if ($env:ProgramData) { $env:ProgramData } else { 'C:\ProgramData' }) 'AIVisualBuilder\access.json'
$own = Join-Path $DataDir 'access.json'
function CreatePolicy { [ordered]@{ _comment = 'AI Visual Builder: local user authorized; template = approved Simplilearn Content_Slide check.'; mode = 'windows'; allowed_users = @($me); napkin_max_per_day = 0; template = $template } }

try {
    New-Item -ItemType Directory -Force (Split-Path $shared) -ErrorAction Stop | Out-Null
    WriteJson $shared (CreatePolicy)
    $state.access_created = $shared
    Say "  Access Policy: Active for $me ($shared)" Green
} catch {
    WriteJson $own (CreatePolicy)
    $state.access_created = $own; $state.access_path = $own
    Say "  Access Policy: Active for $me ($own)" Green
}

# 6. AI Service Keys (Claude + Napkin)
Say ''
Say 'Configuring AI Service Keys...' Cyan
$imported = ImportAdminKeys $Src $DataDir
if ($imported.Count) {
    Say "  AI Keys: $($imported -join ' and ') configured and enabled." Green
} elseif ($AskKeys) {
    ConfigureKeys $DataDir
} else {
    $have = @('napkin.json', 'claude.json') | Where-Object { Test-Path (Join-Path $DataDir $_) }
    if ($have.Count) { Say '  AI Keys: Already configured for this user (kept active).' Green }
    else { Say '  AI Keys: None detected. Built-in designs are ready; run "Set AI keys.bat" anytime.' Yellow }
}

# 7. PowerPoint Add-in Registration
Say ''
Say 'Registering in Microsoft PowerPoint...' Cyan
$WefKey = 'HKCU:\Software\Microsoft\Office\16.0\WEF\Developer'
if (-not (Test-Path $WefKey)) { New-Item -Path $WefKey -Force | Out-Null }
New-ItemProperty -Path $WefKey -Name $AddinId -Value $P.Manifest -PropertyType String -Force | Out-Null
$state.addin_id = $AddinId

# Clean WEF Office cache for clean load
$cache = Join-Path $env:LOCALAPPDATA 'Microsoft\Office\16.0\Wef'
if (Test-Path $cache) {
    Get-ChildItem $cache -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}
Say '  PowerPoint: Registered Web Add-in.' Green

# 8. Autostart setup
if (-not $NoAutostart) {
    $sh = (New-Object -ComObject WScript.Shell).CreateShortcut($P.Startup)
    $sh.TargetPath = $P.Pythonw
    $sh.Arguments = '"' + $P.Launcher + '"'
    $sh.WorkingDirectory = $P.App
    $sh.WindowStyle = 7
    $sh.Description = "AI Visual Builder (Pilot) panel host, https://localhost:$Port"
    $sh.Save()
    $state.autostart = $P.Startup
    Say '  Autostart: Enabled (runs automatically at Windows sign-in).' Green
}

# 9. Register in Windows Apps & Features
New-Item -Path $P.UninstallKey -Force | Out-Null
$ver = ([regex]::Match((Get-Content (Join-Path $P.App 'server.py') -Raw), "VERSION = '([^']+)'")).Groups[1].Value
$un = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $P.Dest 'Uninstall.ps1')`" -Instance $Instance"
foreach ($kv in @(@('DisplayName', 'AI Visual Builder (Team Pilot)'), @('DisplayVersion', $ver), @('Publisher', 'AI Visual Builder'), @('InstallLocation', $P.Dest), @('UninstallString', $un))) {
    New-ItemProperty -Path $P.UninstallKey -Name $kv[0] -Value $kv[1] -PropertyType String -Force | Out-Null
}
New-ItemProperty -Path $P.UninstallKey -Name 'NoModify' -Value 1 -PropertyType DWord -Force | Out-Null
New-ItemProperty -Path $P.UninstallKey -Name 'NoRepair' -Value 1 -PropertyType DWord -Force | Out-Null

$pj = [ordered]@{ instance = $Instance; port = $Port; data_dir = $DataDir }
if ($state.access_path) { $pj.access_path = $state.access_path }
WriteJson $P.Pilot $pj
WriteJson $P.State $state

# 10. Start Server & Verify
Say ''
Say 'Starting AI Visual Builder service...' Cyan
$s = StartPilot $P $Port
if (-not $s) {
    Say "Service failed to start. Review $($DataDir)\server.log" Red
    exit 1
}

Say "  Service is running on https://localhost:$Port/ (v$($s.server))" Green
Say ("  Napkin AI: " + $(if ($s.napkin.configured) { 'ACTIVE (Key stored)' } else { 'no key' }))
Say ("  Claude AI: " + $(if ($s.claude.configured) { "ACTIVE (Key stored, model: $($s.claude.model))" } else { 'no key' }))
Say ("  Built-in Native Infographics: ACTIVE")

Say ''
Say '===========================================================' Green
Say '           INSTALLATION COMPLETED SUCCESSFULLY!            ' Green
Say '===========================================================' Green
Say ''
Say 'How to use in PowerPoint:' Cyan
Say '  1. Open PowerPoint and select a Content Slide.'
Say '  2. On the "SL Smart Design" tab: Click "AI Visual Builder" beside Alternative Design!'
Say '     (Or go to Home > Add-ins > AI Visual Builder).'
Say ''
