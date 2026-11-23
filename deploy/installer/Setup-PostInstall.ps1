param(
    [string]$AppDir,
    [int]$Port = 44317
)
$ErrorActionPreference = 'Stop'
if (-not $AppDir) { $AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path }

$DataDir = Join-Path $env:LOCALAPPDATA 'AIVisualBuilder'
New-Item -ItemType Directory -Force $DataDir | Out-Null
$Catalog = Join-Path $AppDir 'catalog'
New-Item -ItemType Directory -Force $Catalog | Out-Null

# 1. Generate the final manifest with the port
$TemplateXml = Join-Path $AppDir 'manifest-slsd.template.xml'
$ManifestXml = Join-Path $Catalog 'manifest-slsd.xml'
if (Test-Path $TemplateXml) {
    $content = (Get-Content $TemplateXml -Raw) -replace '__PORT__', "$Port"
    [IO.File]::WriteAllText($ManifestXml, $content, (New-Object Text.UTF8Encoding $false))
}

# 2. Register in PowerPoint (WEF Developer sideloading)
$Office = 'HKCU:\Software\Microsoft\Office\16.0'
$WefKey = "$Office\WEF\Developer"
$ProductId = '2f01d600-c9ec-4d94-ade9-69b8b6f0bfa7'
if (-not (Test-Path $WefKey)) { New-Item -Path $WefKey -Force | Out-Null }
New-ItemProperty -Path $WefKey -Name $ProductId -Value $ManifestXml -PropertyType String -Force | Out-Null

# Clean up older/conflicting registrations if present
$oldVbaKey = "$Office\PowerPoint\AddIns\SLSD_AIVisualBuilder"
if (Test-Path $oldVbaKey) { Remove-Item $oldVbaKey -Recurse -Force -ErrorAction SilentlyContinue }

# Clear WEF cache so PowerPoint picks up the newly registered add-in immediately
$wefCache = Join-Path $env:LOCALAPPDATA 'Microsoft\Office\16.0\Wef'
if (Test-Path $wefCache) {
    Get-ChildItem $wefCache -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}

# 3. Setup certificate for https://localhost (CurrentUser\Root)
$certPem = Join-Path $DataDir 'cert.pem'
$keyPem = Join-Path $DataDir 'key.pem'
$thumb = $null
if ((Test-Path $certPem) -and (Test-Path $keyPem)) {
    try {
        $c = New-Object Security.Cryptography.X509Certificates.X509Certificate2 $certPem
        $thumb = (Get-ChildItem Cert:\CurrentUser\Root | Where-Object { $_.Thumbprint -eq $c.Thumbprint }).Thumbprint
    } catch { }
}

if (-not $thumb) {
    try {
        $cert = New-SelfSignedCertificate -Subject 'CN=localhost' -FriendlyName 'AI Visual Builder (localhost)' `
            -TextExtension @('2.5.29.17={text}DNS=localhost&IPAddress=127.0.0.1', '2.5.29.19={text}CA=false', '2.5.29.37={text}1.3.6.1.5.5.7.3.1') `
            -KeyAlgorithm RSA -KeyLength 2048 -KeyExportPolicy Exportable -Provider 'Microsoft Software Key Storage Provider' `
            -CertStoreLocation 'Cert:\CurrentUser\My' -NotAfter (Get-Date).AddYears(2)
        $rsa = [Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($cert)
        $pkcs8 = $rsa.Key.Export([Security.Cryptography.CngKeyBlobFormat]::Pkcs8PrivateBlob)
        $b64 = { param($bytes) ([Convert]::ToBase64String($bytes) -split '(.{64})' | Where-Object { $_ }) -join "`n" }
        $pemHead = '-----BEGIN PRIVATE KEY-----'; $pemTail = '-----END PRIVATE KEY-----'
        [IO.File]::WriteAllText($keyPem, "$pemHead`n" + (& $b64 $pkcs8) + "`n$pemTail`n", [Text.Encoding]::ASCII)
        [IO.File]::WriteAllText($certPem, "-----BEGIN CERTIFICATE-----`n" + (& $b64 $cert.RawData) + "`n-----END CERTIFICATE-----`n", [Text.Encoding]::ASCII)
        $pub = Join-Path $env:TEMP "aivb-cert-$PID.cer"
        Export-Certificate -Cert $cert -FilePath $pub | Out-Null
        Import-Certificate -FilePath $pub -CertStoreLocation 'Cert:\CurrentUser\Root' | Out-Null
        Remove-Item $pub -ErrorAction SilentlyContinue
        Remove-Item $cert.PSPath -ErrorAction SilentlyContinue
    } catch { }
}

# 4. Access policy
$me = $(if ($env:USERDOMAIN) { "$env:USERDOMAIN\$env:USERNAME" } else { $env:USERNAME })
$policyPath = Join-Path $DataDir 'access.json'
$tplFile = Join-Path $AppDir 'access-template.json'
$tpl = if (Test-Path $tplFile) { Get-Content $tplFile -Raw | ConvertFrom-Json } else { @{} }
$policy = [ordered]@{
    _comment = 'AI Visual Builder (team)'
    mode = 'windows'
    allowed_users = @($me)
    napkin_max_per_day = 0
    napkin_max_per_user_per_day = 30
    claude_max_per_user_per_day = 30
    template = $tpl
}
[IO.File]::WriteAllText($policyPath, ($policy | ConvertTo-Json -Depth 8), (New-Object Text.UTF8Encoding $false))

# 5. Pilot configuration for launcher
$pilotJson = Join-Path $AppDir 'app\pilot.json'
$pilot = [ordered]@{
    instance = 'AIVisualBuilderPilot'
    port = $Port
    data_dir = $DataDir
    access_path = $policyPath
    activation = $true
    slsd_unify = $false
}
[IO.File]::WriteAllText($pilotJson, ($pilot | ConvertTo-Json -Depth 8), (New-Object Text.UTF8Encoding $false))

# 6. Start the server
$pythonw = Join-Path $AppDir 'runtime\pythonw.exe'
$launcher = Join-Path $AppDir 'app\run_server.pyw'
if ((Test-Path $pythonw) -and (Test-Path $launcher)) {
    Start-Process -FilePath $pythonw -ArgumentList "`"$launcher`"" -WorkingDirectory (Join-Path $AppDir 'app') -WindowStyle Hidden
}
