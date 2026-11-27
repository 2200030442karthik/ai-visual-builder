# Stages Build_Stage\SL Editor\ : everything the SL Editor installers carry (10.26: the only packaging there is).
#   - the full app (server.py, panel, packs, library, icons, Claude/Napkin integration and checks) and its Python runtime
#   - activation-bundle.json: the organization's Claude and Napkin keys, ENCRYPTED; only an activation key unlocks them
#     (made once with "python local-ai\activation.py issue ..."; reused for later versions so activations are kept)
#   - the company's SL Smart Design and SL_Audomation add-ins (addins\, unchanged), for SL Editor's tools
#   - no plain-text key, no certificate, usage or test data
# Called by Make-InstallerExe.ps1 (Windows: Dist_Installer\SL-Editor-Setup.exe; Mac: Dist_Installer\SL-Editor-Mac.zip).
# Usage:
#   powershell -File deploy\build-stage.ps1 -Bundle deploy\team-keys\activation-bundle.json
#     [-RuntimeFrom <folder with python.exe + Lib\site-packages\anthropic>]   (default: deploy\runtime-win)
#     [-PythonZip <python-3.14.7-embed-amd64.zip>]                            (build a fresh runtime instead)
param([Parameter(Mandatory = $true)][string]$Bundle, [string]$Features, [string]$RuntimeFrom, [string]$PythonZip, [string]$Out)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$La = Join-Path $Root 'local-ai'
$Src = Join-Path $PSScriptRoot 'installer'
$PyVer = '3.14.7'; $AnthropicVer = '2.3.0'
if (-not $Out) { $Out = Join-Path $Root 'Build_Stage' }
$Name = 'SL Editor'
$Stage = Join-Path $Out $Name
$t0 = Get-Date

$Bundle = (Resolve-Path $Bundle).Path
$bj = Get-Content $Bundle -Raw | ConvertFrom-Json
if ($bj.format -ne 1 -or -not $bj.payload -or -not @($bj.keys).Count) { throw "$Bundle is not an activation bundle (python local-ai\activation.py issue ...)." }
if ($Bundle -like "$Root\local-ai\*") { throw 'Keep the activation bundle outside local-ai (e.g. deploy\team-keys).' }

if (Test-Path $Out) { Remove-Item $Out -Recurse -Force }
New-Item -ItemType Directory -Force $Stage | Out-Null

# 1. Python runtime with Claude's official SDK
$rt = Join-Path $Stage 'runtime'
if (-not $PythonZip) {
    if (-not $RuntimeFrom) {
        $candidates = @(
            (Join-Path $PSScriptRoot 'runtime-win'),                 # kept on this PC, never committed
            (Join-Path $Root 'Manager_Pilot_Package\AIVB Pilot\runtime'),
            'D:\Karthik\SLSD_NoNumber_Pilot\SL Smart Design\runtime',
            'D:\Karthik\_slsd_gallery_pkg\SL Smart Design\runtime'
        )
        $RuntimeFrom = $candidates | Where-Object { Test-Path (Join-Path $_ 'Lib\site-packages\anthropic') } | Select-Object -First 1
    }
    if (-not (Test-Path (Join-Path $RuntimeFrom 'Lib\site-packages\anthropic'))) { throw "No runtime at ${RuntimeFrom}: pass -PythonZip (official embeddable zip) or -RuntimeFrom." }
    & robocopy.exe $RuntimeFrom $rt /E /XD __pycache__ /NFL /NDL /NJH /NJS /NP | Out-Null      # long library paths; no caches
    if ($LASTEXITCODE -ge 8) { throw "Copying the runtime failed (robocopy $LASTEXITCODE)." }
} else {
    Expand-Archive $PythonZip $rt
    $pth = Get-ChildItem $rt -Filter 'python*._pth' | Select-Object -First 1
    [IO.File]::WriteAllText($pth.FullName, "python314.zip`r`n.`r`nLib\site-packages`r`n..\app`r`n", [Text.Encoding]::ASCII)
    & python -m pip install --quiet --disable-pip-version-check --no-cache-dir --no-compile --only-binary=:all: --target (Join-Path $rt 'Lib\site-packages') `
        --python-version $PyVer --platform win_amd64 --implementation cp "anthropic==$AnthropicVer"
    if ($LASTEXITCODE -ne 0) { throw 'pip could not fetch the anthropic package.' }
}
$sig = Get-AuthenticodeSignature (Join-Path $rt 'python.exe')
if ($sig.Status -ne 'Valid' -or $sig.SignerCertificate.Subject -notmatch 'Python Software Foundation') { throw "python.exe is not signed by the Python Software Foundation ($($sig.Status))." }
Get-ChildItem $rt -Recurse -Directory -Filter '__pycache__' | Remove-Item -Recurse -Force
Get-ChildItem $rt -Recurse -Directory -Filter 'bin' | Where-Object { $_.Parent.Name -eq 'site-packages' } | Remove-Item -Recurse -Force

# 2. The app: exactly what the panel host serves and runs, the launcher and the encrypted bundle
$app = Join-Path $Stage 'app'
New-Item -ItemType Directory -Force $app | Out-Null
Get-ChildItem $La -File | Where-Object { $_.Extension -in '.py', '.js', '.html' } | Copy-Item -Destination $app
Copy-Item (Join-Path $La 'packs') (Join-Path $app 'packs') -Recurse
Copy-Item (Join-Path $La 'assets') (Join-Path $app 'assets') -Recurse
Copy-Item (Join-Path $La 'vendor') (Join-Path $app 'vendor') -Recurse          # 10.24: AntV Infographic (MIT), served locally
Remove-Item (Join-Path $app 'packs\README.txt') -ErrorAction SilentlyContinue
Copy-Item (Join-Path $Src 'run_server.pyw') $app
Copy-Item $Bundle (Join-Path $app 'activation-bundle.json')
# 10.28: the access hub (hub.py): the share and the administrator's PUBLIC key; no secret (python local-ai\hub.py init)
$hubCfg = Join-Path $PSScriptRoot 'hub.json'
if (Test-Path $hubCfg) { Copy-Item $hubCfg (Join-Path $app 'hub.json') }
$cfg = Get-Content (Join-Path $La 'config.json') -Raw | ConvertFrom-Json
$cfg.paid_policy = 'always'               # 10.24: Claude designs for every new text (the owner's choice); keys only work after activation
[IO.File]::WriteAllText((Join-Path $app 'config.json'), ($cfg | ConvertTo-Json -Depth 4), (New-Object Text.UTF8Encoding $false))

# 2b. 10.25 SL Editor: the company's VBA add-ins (SL Smart Design; SL Design and SL Animation) so one setup gives every
#     tool. Unchanged originals from this PC (PowerPoint's add-in folder, or the originals an earlier install kept); the
#     installer (addin_tabs.py) hides their own ribbon tabs in a checked copy and keeps the originals for the uninstaller.
$ad = Join-Path $Stage 'addins'
New-Item -ItemType Directory -Force $ad | Out-Null
foreach ($n in 'SL_Smart_Design_v2_Key_Dec_25', 'SL_Audomation') {
    $from = @((Join-Path $env:LOCALAPPDATA "AIVisualBuilder\addins-original\$n.ppam"), (Join-Path $env:APPDATA "Microsoft\AddIns\$n.ppam"),
              (Join-Path $env:LOCALAPPDATA "AIVisualBuilder\slsd-original\$n.ppam")) | Where-Object { Test-Path $_ }
    $ok = $null
    foreach ($f in $from) {
        $st = & python -I -c "import sys,json; sys.path.insert(0, sys.argv[2]); import addin_tabs as A; t = A.tabs(open(sys.argv[1], 'rb').read()); print(json.dumps(t))" $f $La
        if ($st -and $st -ne 'null' -and $st -match 'true') { $ok = $f; break }        # an original: its tabs visible
    }
    if (-not $ok) { throw "No original $n.ppam on this PC (PowerPoint's add-in folder): SL Editor needs it for its tabs." }
    if ($n -eq 'SL_Audomation') {
        # 10.26: SL Design and SL Animation ship LOCKED (ribbon visible, buttons disabled, no macro code); the real add-in
        # is only in features-bundle.json, encrypted - an SLDA access key unlocks it (local-ai\features.py)
        & python (Join-Path $La 'features.py') locked --addin $ok --out (Join-Path $ad "$n.ppam") | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'The locked SL_Audomation could not be made.' }
        if (-not $Features) { throw 'SL Editor needs the SL Design and SL Animation bundle (-Features features-bundle.json).' }
        Copy-Item $Features (Join-Path $app 'features-bundle.json')
    } else { Copy-Item $ok (Join-Path $ad "$n.ppam") }
}

# 3. Manifest: the ONE SL Smart Design tab (Alternative Design, AI Visual Builder, Several slides, Edit a visual,
#    SL Templates, Miscellaneous, Shape Rename), the product's own add-in Id; the port is filled in by the installer
$mf = Join-Path $Stage 'manifest-slsd.template.xml'
& python -I (Join-Path $La 'sl-smart-design\make_manifest_slsd.py') --id '2f01d600-c9ec-4d94-ade9-69b8b6f0bfa7' --base 'https://localhost:__PORT__' --out $mf | Out-Null
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $mf)) { throw 'The SL Smart Design manifest was not made.' }
$m = Get-Content $mf -Raw
[void][xml]($m -replace '__PORT__', '44317')
if ($m -notmatch '<CustomTab id="AISLSD.Tab"' -or $m -notmatch '2f01d600-c9ec-4d94-ade9-69b8b6f0bfa7') { throw 'The SL Smart Design manifest is not the expected one.' }

# 4. The approved template check (Content_Slide fingerprint)
$tpl = (Get-Content (Join-Path $La 'access.example.json') -Raw | ConvertFrom-Json).template
$pol = Join-Path $env:ProgramData 'AIVisualBuilder\access.json'
if (Test-Path $pol) { $t2 = (Get-Content $pol -Raw | ConvertFrom-Json).template; if ($t2) { $tpl = $t2 } }
[IO.File]::WriteAllText((Join-Path $Stage 'access-template.json'), ($tpl | ConvertTo-Json -Depth 6), (New-Object Text.UTF8Encoding $false))

# 6. Safety: nothing secret, licensed or private in the package
$bad = Get-ChildItem $Stage -Recurse -File | Where-Object { -not ($_.DirectoryName -eq $ad -and $_.Name -match '^(SL_Smart_Design_v2_Key_Dec_25|SL_Audomation)\.ppam$') -and
    $_.Name -match '^(napkin|claude|activation|access)\.json$|\.pem$|\.pfx$|usage\.json$|^AIVB-keys\.json$|activation-keys\.csv$|\.bas$|\.frm$|\.frx$|\.pptm$|\.ppam$|\.pptx$' }
if ($bad) { throw "Private or licensed files in the package: $($bad.FullName -join ', ')" }
$scan = Get-ChildItem $Stage -Recurse -File -Include *.py, *.pyw, *.js, *.html, *.json, *.ps1, *.txt, *.xml, *.bat | Where-Object { $_.FullName -notlike "$rt\*" }
if ($scan | Select-String -Pattern 'sk-ant-[A-Za-z0-9_\-]{20,}' -List) { throw 'Something like an Anthropic key is in the package.' }
foreach ($kf in 'claude.json', 'napkin.json') {          # this PC's real keys must not appear anywhere, even in the runtime
    $k = $null; try { $k = (Get-Content (Join-Path $env:LOCALAPPDATA "AIVisualBuilder\$kf") -Raw | ConvertFrom-Json).api_key } catch { }
    if ($k -and "$k".Length -ge 10 -and (Get-ChildItem $Stage -Recurse -File | Select-String -SimpleMatch "$k" -List)) { throw "A real AI key ($kf) is in the package." }
}

# 7. Done (the installers are made from this folder)
Write-Host "Staged: $Stage ($([int]((Get-Date) - $t0).TotalSeconds) s). Activation keys in the bundle: $(@($bj.keys).Count) (withdrawn: $(@($bj.revoked).Count))." -ForegroundColor Green
