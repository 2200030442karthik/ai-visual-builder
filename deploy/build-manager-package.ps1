# Builds Manager_Pilot_Package\ : a self-contained Windows installer of the full AI Visual Builder desktop version
# (same server.py, panel, packs, Claude/Napkin integration and checks) with its own Python runtime.
# No keys, certificates, usage data, kept AI results, SL Smart Design files or tests are put in the package.
#   -PythonZip <path>   the official python-3.14.7-embed-amd64.zip (downloaded from python.org when omitted)
param([string]$PythonZip, [string]$Out)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$PyVer = '3.14.7'
$AnthropicVer = '2.3.0'
if (-not $Out) { $Out = Join-Path $Root 'Manager_Pilot_Package' }
$Name = 'AIVB Pilot'      # short: keeps the deepest library path well under Windows' 260-character limit
$Stage = Join-Path $Out $Name
$Src = Join-Path $PSScriptRoot 'manager-pilot'
$La = Join-Path $Root 'local-ai'

if (Test-Path $Out) { Remove-Item $Out -Recurse -Force }
New-Item -ItemType Directory -Force $Stage | Out-Null

# 1. Python runtime (official embeddable distribution, signature checked)
if (-not $PythonZip) {
    $PythonZip = Join-Path $env:TEMP "python-$PyVer-embed-amd64.zip"
    if (-not (Test-Path $PythonZip)) { curl.exe -sSfL -o $PythonZip "https://www.python.org/ftp/python/$PyVer/python-$PyVer-embed-amd64.zip" }
}
$rt = Join-Path $Stage 'runtime'
Expand-Archive $PythonZip $rt
$sig = Get-AuthenticodeSignature (Join-Path $rt 'python.exe')
if ($sig.Status -ne 'Valid' -or $sig.SignerCertificate.Subject -notmatch 'Python Software Foundation') { throw "python.exe is not signed by the Python Software Foundation ($($sig.Status))." }
$pth = Get-ChildItem $rt -Filter 'python*._pth' | Select-Object -First 1
[IO.File]::WriteAllText($pth.FullName, "python314.zip`r`n.`r`nLib\site-packages`r`n..\app`r`n", [Text.Encoding]::ASCII)
# Claude's official SDK and its dependencies (binary wheels for this exact Python), same version as the desktop
$sp = Join-Path $rt 'Lib\site-packages'
& python -m pip install --quiet --disable-pip-version-check --no-cache-dir --no-compile --only-binary=:all: --target $sp `
    --python-version $PyVer --platform win_amd64 --implementation cp "anthropic==$AnthropicVer"
if ($LASTEXITCODE -ne 0) { throw 'pip could not fetch the anthropic package.' }
Get-ChildItem $sp -Directory -Filter 'bin' | Remove-Item -Recurse -Force
Get-ChildItem $Stage -Recurse -Directory -Filter '__pycache__' | Remove-Item -Recurse -Force

# 2. The app: exactly what the desktop panel host serves and runs (the same set as deploy/Dockerfile)
$app = Join-Path $Stage 'app'
New-Item -ItemType Directory -Force $app | Out-Null
Get-ChildItem $La -File | Where-Object { $_.Extension -in '.py', '.js', '.html' } | Copy-Item -Destination $app
Copy-Item (Join-Path $La 'config.json') $app
Copy-Item (Join-Path $La 'packs') (Join-Path $app 'packs') -Recurse
Copy-Item (Join-Path $La 'assets') (Join-Path $app 'assets') -Recurse
Copy-Item (Join-Path $Src 'run_server.pyw') $app
Remove-Item (Join-Path $app 'packs\README.txt') -ErrorAction SilentlyContinue

# 3. Pilot manifest: own add-in Id and name; the port is filled in by the installer
$m = Get-Content (Join-Path $Root 'manifest-v10.xml') -Raw
$m = $m -replace '<Id>[^<]+</Id>', '<Id>78643140-2b68-48d8-b072-3b253dddf2b8</Id>'
$m = $m -replace '<DisplayName DefaultValue="[^"]*"/>', '<DisplayName DefaultValue="AI Visual Builder (Pilot)"/>'
$m = $m -replace 'https://localhost:44317', 'https://localhost:__PORT__'
[IO.File]::WriteAllText((Join-Path $Stage 'manifest-pilot.template.xml'), $m, (New-Object Text.UTF8Encoding $false))
[void][xml]($m -replace '__PORT__', '44317')

# 4. The approved template check (Content_Slide fingerprint) from the desktop's access policy, or the built-in default
$pol = Join-Path $env:ProgramData 'AIVisualBuilder\access.json'
$tpl = if (Test-Path $pol) { (Get-Content $pol -Raw | ConvertFrom-Json).template } else { $null }
if (-not $tpl) { $tpl = (Get-Content (Join-Path $La 'access.example.json') -Raw | ConvertFrom-Json).template }
[IO.File]::WriteAllText((Join-Path $Stage 'access-template.json'), ($tpl | ConvertTo-Json -Depth 6), (New-Object Text.UTF8Encoding $false))

# 5. Scripts and guide
foreach ($f in 'common.ps1', 'Install.ps1', 'Uninstall.ps1', 'Configure-Keys.ps1', 'Restart.ps1', 'Make-KeyFile.ps1', 'Make key file (administrator).bat', 'Install AI Visual Builder.bat',
               'Uninstall AI Visual Builder.bat', 'Set AI keys.bat', 'Restart AI Visual Builder.bat', 'INSTALL-GUIDE.txt') {
    Copy-Item (Join-Path $Src $f) $Stage
}

# 6. Safety check: nothing secret or private in the package
$bad = Get-ChildItem $Stage -Recurse -File | Where-Object {
    $_.Name -match '^(napkin|claude)\.json$|\.pem$|\.pfx$|usage\.json$|^access\.json$|^AIVB-keys\.json$|\.bas$|\.frm$|\.frx$|\.pptm$|\.ppam$' }
if ($bad) { throw "Private files in the package: $($bad.FullName -join ', ')" }
$hit = Get-ChildItem $Stage -Recurse -File -Include *.py, *.js, *.html, *.json, *.ps1, *.txt, *.xml, *.pyw |
    Where-Object { $_.FullName -notlike "$sp*" } | Select-String -Pattern 'sk-ant-[A-Za-z0-9_\-]{20,}' -List
if ($hit) { throw "Something like an API key in: $($hit.Path -join ', ')" }

# 7. Zip (the one file to share) and checksum
$Ver = ([regex]::Match((Get-Content (Join-Path $La 'server.py') -Raw), "VERSION = '([^']+)'")).Groups[1].Value
$zip = Join-Path $Out "AI-Visual-Builder-Pilot-$Ver.zip"
Get-ChildItem $Stage -Recurse -Directory -Filter '__pycache__' | Remove-Item -Recurse -Force
Add-Type -AssemblyName System.IO.Compression.FileSystem     # standard zip (forward slashes), unlike Compress-Archive on PowerShell 5
[IO.Compression.ZipFile]::CreateFromDirectory($Stage, $zip, [IO.Compression.CompressionLevel]::Optimal, $true)
$longest = (Get-ChildItem $Stage -Recurse -File | ForEach-Object { $_.FullName.Length - $Out.Length } | Measure-Object -Maximum).Maximum
if ($longest -gt 170) { throw "A path in the package is $longest characters; extraction may hit Windows' 260-character limit." }
Copy-Item (Join-Path $Src 'INSTALL-GUIDE.txt') $Out
$h = (Get-FileHash $zip -Algorithm SHA256).Hash
"$h  $(Split-Path $zip -Leaf)" | Set-Content (Join-Path $Out 'SHA256.txt') -Encoding Ascii
Write-Host "Package: $zip ($([math]::Round((Get-Item $zip).Length / 1MB, 1)) MB)  SHA256 $h" -ForegroundColor Green
