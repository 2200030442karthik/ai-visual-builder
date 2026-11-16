# Builds SLSD_Unified_Package\ : the unified SL Smart Design installer (SL Smart Design + AI Visual Builder), per user,
# no administrator rights. Reuses the tested pilot installer (deploy/manager-pilot) and its verified Python runtime.
# Never packaged: API keys, certificates, usage data, the developer's config.json changes, tests, the add-in source.
#   -RuntimeFrom <dir>     an already built runtime (default: the pilot package's), checked before use
#   -SlsdAddin <ppam>      the SL Smart Design copy with its own tab hidden (make_unified_slsd.py --hide-tab)
#   -OriginalAddin <ppam>  the company's original add-in: the copy must be identical to it except the hidden tab
#   -IncludeTemplates      also packs the template library from this PC (proprietary; only with the owner's approval)
param(
    [string]$RuntimeFrom,
    [string]$SlsdAddin = 'D:\Karthik\SL_Smart_Design_Source\Unified_V10.20.1\SL_Smart_Design_v2_Key_Dec_25.ppam',
    [string]$OriginalAddin = 'D:\Karthik\SL_Smart_Design_Source\Backup_before_V10.20\SL_Smart_Design_v2_Key_Dec_25.ppam',
    [switch]$IncludeTemplates,
    [string]$Out
)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$La = Join-Path $Root 'local-ai'
$Pilot = Join-Path $PSScriptRoot 'manager-pilot'
$Uni = Join-Path $PSScriptRoot 'slsd-unified'
if (-not $RuntimeFrom) { $RuntimeFrom = Join-Path $Root 'Manager_Pilot_Package\AIVB Pilot\runtime' }
if (-not $Out) { $Out = Join-Path $Root 'SLSD_Unified_Package' }
$ProductId = '2f01d600-c9ec-4d94-ade9-69b8b6f0bfa7'
$Ver = ([regex]::Match((Get-Content (Join-Path $La 'server.py') -Raw), "VERSION = '([^']+)'")).Groups[1].Value
$Name = 'SL Smart Design'
$Stage = Join-Path $Out $Name
if (Test-Path $Out) { Remove-Item $Out -Recurse -Force }
New-Item -ItemType Directory -Force $Stage | Out-Null
function Step($m) { Write-Host "- $m" }

# 1. Runtime: the pilot's (Python 3.14.7 embeddable, signed by the PSF, with the anthropic SDK), checked
$py = Join-Path $RuntimeFrom 'python.exe'
if (-not (Test-Path $py)) { throw "No runtime at $RuntimeFrom (build the pilot package first: build-manager-package.ps1)." }
$sig = Get-AuthenticodeSignature $py
if ($sig.Status -ne 'Valid' -or $sig.SignerCertificate.Subject -notmatch 'Python Software Foundation') { throw "python.exe is not validly signed by the Python Software Foundation ($($sig.Status))." }
$probe = & $py -c "import sys, ssl, json, anthropic; print(sys.version.split()[0], anthropic.__version__)" 2>&1
if ($LASTEXITCODE -ne 0 -or "$probe" -notmatch '^3\.14\.7 ') { throw "The runtime does not work as expected: $probe" }
Copy-Item $RuntimeFrom (Join-Path $Stage 'runtime') -Recurse
Get-ChildItem (Join-Path $Stage 'runtime') -Recurse -Directory -Filter '__pycache__' | Remove-Item -Recurse -Force
Step "runtime: Python and anthropic $probe (signature valid)"

# 2. App: what the panel host serves and runs; config.json as committed (not this PC's working copy)
$app = Join-Path $Stage 'app'
New-Item -ItemType Directory -Force $app | Out-Null
Get-ChildItem $La -File | Where-Object { $_.Extension -in '.py', '.js', '.html' } | Copy-Item -Destination $app
$cfg = & git -C $Root show HEAD:local-ai/config.json
if ($LASTEXITCODE -ne 0) { throw 'Could not read the committed config.json.' }
[IO.File]::WriteAllText((Join-Path $app 'config.json'), ($cfg -join "`n"), (New-Object Text.UTF8Encoding $false))
Copy-Item (Join-Path $La 'packs') (Join-Path $app 'packs') -Recurse
Copy-Item (Join-Path $La 'assets') (Join-Path $app 'assets') -Recurse
Remove-Item (Join-Path $app 'packs\README.txt') -ErrorAction SilentlyContinue
Copy-Item (Join-Path $Pilot 'run_server.pyw') $app
Step "app: $(@(Get-ChildItem $app -Recurse -File).Count) files"

# 3. Manifests: the installer's template (port filled in at install) and the one IT uploads / puts in the catalog
$gen = Join-Path $La 'sl-smart-design\make_manifest_slsd.py'
& python -I $gen --id $ProductId --base 'https://localhost:__PORT__' --out (Join-Path $Stage 'manifest-slsd.template.xml') | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Manifest generation failed.' }
$it = Join-Path $Out 'IT'
New-Item -ItemType Directory -Force $it | Out-Null
$m = (Get-Content (Join-Path $Stage 'manifest-slsd.template.xml') -Raw) -replace '__PORT__', '44317'
[IO.File]::WriteAllText((Join-Path $it 'manifest-slsd.xml'), $m, (New-Object Text.UTF8Encoding $false))
$x = [xml]$m
if ($x.OfficeApp.Id -ne $ProductId) { throw 'Manifest Id is not the product Id.' }
$urls = @([regex]::Matches($m, '(?<=DefaultValue=")https?://[^"]+|(?<=<AppDomain>)[^<]+') | ForEach-Object Value | Where-Object { $_ -notmatch 'github\.io' } | Sort-Object -Unique)
$badUrl = $urls | Where-Object { $_ -notmatch '^https://localhost:44317(/|$)' }
if ($badUrl) { throw "Manifest URLs outside the panel host: $($badUrl -join ', ')" }
foreach ($u in $urls) { $rel = ($u -replace '^https://localhost:44317/?', '') -replace '^assets/v\d+/', 'assets/'; if ($rel -and $rel -ne 'v10.html' -and -not (Test-Path (Join-Path $app $rel))) { throw "Manifest refers to a file the package does not have: $u" } }
Step "manifests: product Id $ProductId, $($urls.Count) URLs, every file present"

# 4. SL Smart Design add-in: the tab-hidden copy, checked against the company's original (VBA / licence untouched)
Add-Type -AssemblyName System.IO.Compression.FileSystem
function Parts($f) { $z = [IO.Compression.ZipFile]::OpenRead($f); try { $h = @{}; foreach ($e in $z.Entries) { $s = $e.Open(); try { $h[$e.FullName] = [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($s)) } finally { $s.Close() } }; $h } finally { $z.Dispose() } }
$a = Parts $OriginalAddin; $b = Parts $SlsdAddin
$diff = @($a.Keys + $b.Keys | Sort-Object -Unique | Where-Object { $a[$_] -ne $b[$_] })
if (($diff -join ',') -ne 'customUI/customUI.xml') { throw "The add-in copy differs from the original in more than its ribbon: $($diff -join ', ')" }
$z = [IO.Compression.ZipFile]::OpenRead($SlsdAddin); try { $r = New-Object IO.StreamReader($z.GetEntry('customUI/customUI.xml').Open()); $ui = $r.ReadToEnd(); $r.Close() } finally { $z.Dispose() }
if ($ui -notmatch 'id="Template_Selector"[^>]*visible="false"') { throw 'The add-in copy does not hide its own tab.' }
New-Item -ItemType Directory -Force (Join-Path $Stage 'slsd') | Out-Null
Copy-Item $SlsdAddin (Join-Path $Stage 'slsd')
Step 'SL Smart Design add-in: tab hidden; every other part (VBA project, forms, licence check) identical to the original'

# 5. Template library (optional; proprietary)
$tplCount = 0
if ($IncludeTemplates) {
    $src = Join-Path $env:LOCALAPPDATA 'Microsoft\SLSD\Templates'
    New-Item -ItemType Directory -Force (Join-Path $Stage 'templates') | Out-Null
    $tz = Join-Path $Stage 'templates\SLSD-Templates.zip'
    $tmp = Join-Path $env:TEMP "slsd-tpl-$PID"; if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
    New-Item -ItemType Directory $tmp | Out-Null
    Get-ChildItem $src -Directory | ForEach-Object { Copy-Item $_.FullName (Join-Path $tmp $_.Name) -Recurse }    # folders only (no stray zips)
    Get-ChildItem $tmp -Recurse -File -Filter 'Thumbs.db' -Force | Remove-Item -Force
    [IO.Compression.ZipFile]::CreateFromDirectory($tmp, $tz, [IO.Compression.CompressionLevel]::Optimal, $false)
    $tplCount = @(Get-ChildItem $tmp -Recurse -File).Count
    Remove-Item $tmp -Recurse -Force
    Step "templates: $tplCount files ($([math]::Round((Get-Item $tz).Length / 1MB)) MB zipped)"
}

# 6. Access template, scripts, guides, administrator settings (no keys)
$pol = Join-Path $env:ProgramData 'AIVisualBuilder\access.json'
$tpl = if (Test-Path $pol) { (Get-Content $pol -Raw | ConvertFrom-Json).template } else { $null }
if (-not $tpl) { $tpl = (Get-Content (Join-Path $La 'access.example.json') -Raw | ConvertFrom-Json).template }
[IO.File]::WriteAllText((Join-Path $Stage 'access-template.json'), ($tpl | ConvertTo-Json -Depth 6), (New-Object Text.UTF8Encoding $false))
foreach ($f in 'common.ps1', 'Restart.ps1', 'Configure-Keys.ps1', 'Make-KeyFile.ps1', 'Make key file (administrator).bat') { Copy-Item (Join-Path $Pilot $f) $Stage }
Get-ChildItem $Uni -File | Copy-Item -Destination $Stage
Copy-Item (Join-Path $Uni 'admin-config.example.json') (Join-Path $Stage 'admin-config.json')     # paid AI off until approved
Copy-Item (Join-Path $Root 'docs\SLSD-INSTALL-GUIDE.txt') (Join-Path $Stage 'INSTALL-GUIDE.txt')
Copy-Item (Join-Path $Root 'docs\SLSD-IT-DEPLOYMENT.md') $it
Copy-Item (Join-Path $Uni 'deployment.example.json') $it
$pkg = [ordered]@{ product = 'SL Smart Design (with AI Visual Builder)'; version = $Ver; built = (Get-Date).ToString('s'); product_id = $ProductId
                   status = 'staging'; templates_included = [bool]$IncludeTemplates; template_files = $tplCount
                   addin_sha256 = (Get-FileHash $SlsdAddin).Hash; source_commit = ((& git -C $Root rev-parse --short HEAD) -join '') }
[IO.File]::WriteAllText((Join-Path $Stage 'package.json'), ($pkg | ConvertTo-Json), (New-Object Text.UTF8Encoding $false))

# 7. Safety: nothing secret or private; the only add-in file is the approved copy
$bad = Get-ChildItem $Out -Recurse -File | Where-Object {
    $_.Name -match '^(napkin|claude)\.json$|\.pem$|\.pfx$|\.key$|usage\.json$|^access\.json$|^AIVB-keys\.json$|^deployment\.json$|\.bas$|\.frm$|\.frx$|\.pptm$|lnc\.ln$' -or
    ($_.Extension -eq '.ppam' -and $_.FullName -ne (Join-Path $Stage "slsd\$(Split-Path $SlsdAddin -Leaf)")) }
if ($bad) { throw "Private files in the package: $($bad.FullName -join ', ')" }
$sp = Join-Path $Stage 'runtime\Lib\site-packages'
$hit = Get-ChildItem $Out -Recurse -File -Include *.py, *.js, *.html, *.json, *.ps1, *.txt, *.xml, *.pyw, *.md, *.bat | Where-Object { $_.FullName -notlike "$sp*" } |
    Select-String -Pattern 'sk-ant-[A-Za-z0-9_\-]{20,}', 'RCSXS68', '"api_key"\s*:\s*"[^"]{8,}' -List
if ($hit) { throw "Something like a key in: $($hit.Path -join ', ')" }
Step 'safety: no keys, certificates, usage data, licence file or add-in source; one approved add-in file'

# 8. Zip and checksum
$zip = Join-Path $Out "SL-Smart-Design-$Ver-staging.zip"
Get-ChildItem $Stage -Recurse -Directory -Filter '__pycache__' | Remove-Item -Recurse -Force
[IO.Compression.ZipFile]::CreateFromDirectory($Stage, $zip, [IO.Compression.CompressionLevel]::Optimal, $true)
$longest = (Get-ChildItem $Stage -Recurse -File | ForEach-Object { $_.FullName.Length - $Out.Length } | Measure-Object -Maximum).Maximum
if ($longest -gt 170) { throw "A path in the package is $longest characters; extraction may hit Windows' 260-character limit." }
Copy-Item (Join-Path $Root 'docs\SLSD-INSTALL-GUIDE.txt') (Join-Path $Out 'INSTALL-GUIDE.txt')
$h = (Get-FileHash $zip -Algorithm SHA256).Hash
"$h  $(Split-Path $zip -Leaf)" | Set-Content (Join-Path $Out 'SHA256.txt') -Encoding Ascii
Write-Host "Package (STAGING): $zip ($([math]::Round((Get-Item $zip).Length / 1MB, 1)) MB)  SHA256 $h" -ForegroundColor Green
