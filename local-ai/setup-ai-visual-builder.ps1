# One-time setup for AI Visual Builder V10.12 for the current Windows user. No admin rights needed.
#  1. Checks Python 3 (runs the small panel host, server.py; no AI models).
#  2. Creates a certificate for https://localhost that only this PC trusts. PowerPoint only loads add-ins over HTTPS.
#     The private key is created on this PC and stays in %LOCALAPPDATA%\AIVisualBuilder (never in the shared folder).
#     Windows asks once to confirm adding it to your trusted certificates: answer Yes.
#  3. Starts the panel host automatically when you sign in (-NoAutostart to skip).
# Run with -Remove to undo all of it.
param([switch]$Remove, [switch]$NoAutostart)

$ErrorActionPreference = 'Stop'
$Data = Join-Path $env:LOCALAPPDATA 'AIVisualBuilder'
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$FriendlyName = 'AI Visual Builder local companion'   # name kept: the existing trusted certificate uses it
$Startup = Join-Path ([Environment]::GetFolderPath('Startup')) 'AI Visual Builder Local AI.lnk'

function Say($m, $c) { if ($c) { Write-Host $m -ForegroundColor $c } else { Write-Host $m } }
function OurCerts($store) { Get-ChildItem "Cert:\CurrentUser\$store" | Where-Object { $_.FriendlyName -eq $FriendlyName -or ($_.Subject -eq 'CN=localhost' -and $_.Issuer -eq 'CN=localhost' -and $_.FriendlyName -eq $FriendlyName) } }

if ($Remove) {
    OurCerts 'Root' | ForEach-Object { Remove-Item $_.PSPath }   # Windows may ask to confirm
    OurCerts 'My' | ForEach-Object { Remove-Item $_.PSPath }
    Remove-Item (Join-Path $Data 'cert.pem'), (Join-Path $Data 'key.pem') -ErrorAction SilentlyContinue
    Remove-Item $Startup -ErrorAction SilentlyContinue
    Say 'Setup removed (certificate and autostart).' Green
    exit 0
}

Say ''
Say 'AI Visual Builder V10.12 - setup' Cyan
Say '--------------------------------------'

# 1. Prerequisites
$py = $null
foreach ($c in @('py', 'python')) {
    $cmd = Get-Command $c -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source -notmatch 'WindowsApps') {
        $v = & $cmd.Source -c "import sys; print(sys.version_info >= (3, 9))" 2>$null
        if ($v -eq 'True') { $py = $cmd.Source; break }
    }
}
if (-not $py) {
    Say 'Python 3.9 or newer is needed (it runs the small panel host).' Yellow
    Say '  Install it from https://www.python.org/downloads/windows/ (tick "Add python.exe to PATH"), then run this again.'
    exit 1
}
Say "Python:   $py" Green

$cfg = Get-Content (Join-Path $Here 'config.json') -Raw | ConvertFrom-Json

# 2. Certificate for https://localhost
New-Item -ItemType Directory -Force $Data | Out-Null
$certPem = Join-Path $Data 'cert.pem'; $keyPem = Join-Path $Data 'key.pem'
$existing = OurCerts 'Root' | Where-Object { $_.NotAfter -gt (Get-Date).AddDays(30) } | Select-Object -First 1
if ($existing -and (Test-Path $certPem) -and (Test-Path $keyPem)) {
    Say "Certificate: already set up (valid until $($existing.NotAfter.ToString('yyyy-MM-dd')))." Green
} else {
    OurCerts 'My' | ForEach-Object { Remove-Item $_.PSPath }
    $cert = New-SelfSignedCertificate -Subject 'CN=localhost' -FriendlyName $FriendlyName `
        -TextExtension @('2.5.29.17={text}DNS=localhost&IPAddress=127.0.0.1', '2.5.29.19={text}CA=false', '2.5.29.37={text}1.3.6.1.5.5.7.3.1') `
        -KeyAlgorithm RSA -KeyLength 2048 -KeyExportPolicy Exportable -Provider 'Microsoft Software Key Storage Provider' `
        -CertStoreLocation 'Cert:\CurrentUser\My' -NotAfter (Get-Date).AddYears(2)
    # Private key -> PKCS#8 PEM (Python's ssl module reads PEM only)
    $rsa = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($cert)
    $pkcs8 = $rsa.Key.Export([System.Security.Cryptography.CngKeyBlobFormat]::Pkcs8PrivateBlob)
    $b64 = { param($bytes) ([Convert]::ToBase64String($bytes) -split '(.{64})' | Where-Object { $_ }) -join "`n" }
    Set-Content -Path $keyPem -Value ("-----BEGIN PRIVATE KEY-----`n" + (& $b64 $pkcs8) + "`n-----END PRIVATE KEY-----`n") -Encoding Ascii -NoNewline
    Set-Content -Path $certPem -Value ("-----BEGIN CERTIFICATE-----`n" + (& $b64 $cert.RawData) + "`n-----END CERTIFICATE-----`n") -Encoding Ascii -NoNewline
    # Only this user may read the key
    icacls $keyPem /inheritance:r /grant:r "$($env:USERNAME):(R,W)" | Out-Null
    # Trust it (public part only). Windows shows a confirmation dialog: choose Yes.
    $pub = Join-Path $Data 'cert.cer'
    Export-Certificate -Cert $cert -FilePath $pub | Out-Null
    Say 'Windows will now ask to install a certificate for "localhost". Choose YES.' Yellow
    Import-Certificate -FilePath $pub -CertStoreLocation 'Cert:\CurrentUser\Root' | Out-Null
    Remove-Item $pub
    Remove-Item $cert.PSPath     # the PEM copy in %LOCALAPPDATA% is what server.py uses
    Say 'Certificate: created and trusted for this user.' Green
}

# 3. Autostart at sign-in (hidden window)
if (-not $NoAutostart) {
    $pyw = Join-Path (Split-Path $py) 'pythonw.exe'
    if (-not (Test-Path $pyw)) { $pyw = $py }
    $sh = (New-Object -ComObject WScript.Shell).CreateShortcut($Startup)
    $sh.TargetPath = $pyw
    $sh.Arguments = '"' + (Join-Path $Here 'server.py') + '"'
    $sh.WorkingDirectory = $Here
    $sh.WindowStyle = 7
    $sh.Description = 'AI Visual Builder V10 panel host (https://localhost:' + $cfg.port + ')'
    $sh.Save()
    Say 'Autostart: the panel host starts automatically when you sign in.' Green
}

Say ''
Say 'Done. Next:' Cyan
Say '  1. Double-click "Start AI Visual Builder.bat" (or sign out and in again).'
Say '  2. In PowerPoint: Home > Add-ins > More Add-ins > SHARED FOLDER > "AI Visual Builder V10" > Add.'
Say ''
