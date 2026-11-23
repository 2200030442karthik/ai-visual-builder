# Builds Team_Pilot_Package\ : A completely self-contained, 1-click Windows installer
# for AI Visual Builder (v10.21.1) + Original SL Smart Design protector & repair tool.
# Pre-bundles Claude AI & Napkin AI keys for zero-friction team evaluation.
param(
    [string]$RuntimeFrom = 'D:\Karthik\ai-visual-builder-starter\Manager_Pilot_Package\AIVB Pilot\runtime',
    [string]$Out = 'D:\Karthik\ai-visual-builder-starter\Team_Pilot_Package'
)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Name = 'SLSD_AI_Visual_Builder_Team_Pilot'
$Stage = Join-Path $Out $Name
$Src = Join-Path $PSScriptRoot 'team-pilot'
$La = Join-Path $Root 'local-ai'

Write-Host ''
Write-Host '===================================================' -ForegroundColor Cyan
Write-Host '   Building AI Visual Builder Team Pilot Package   ' -ForegroundColor Cyan
Write-Host '===================================================' -ForegroundColor Cyan

if (Test-Path $Out) { Remove-Item $Out -Recurse -Force }
New-Item -ItemType Directory -Force $Stage | Out-Null

# 1. Runtime: Copy verified Python 3.14.7 runtime with anthropic SDK
Write-Host '1. Staging Python runtime...' -ForegroundColor Cyan
if (-not (Test-Path (Join-Path $RuntimeFrom 'python.exe'))) {
    throw "Runtime not found at $RuntimeFrom. Verify Manager_Pilot_Package runtime exists."
}
Copy-Item $RuntimeFrom (Join-Path $Stage 'runtime') -Recurse
Get-ChildItem (Join-Path $Stage 'runtime') -Recurse -Directory -Filter '__pycache__' | Remove-Item -Recurse -Force
Write-Host '   Python runtime staged.' -ForegroundColor Green

# 2. App: Staging latest local-ai files (V10.21.1)
Write-Host '2. Staging application files (v10.21.1)...' -ForegroundColor Cyan
$app = Join-Path $Stage 'app'
New-Item -ItemType Directory -Force $app | Out-Null
Get-ChildItem $La -File | Where-Object { $_.Extension -in '.py', '.js', '.html' } | Copy-Item -Destination $app

# Stage config.json with paid_policy: "when-needed"
$cfg = Get-Content (Join-Path $La 'config.json') -Raw | ConvertFrom-Json
$cfg.paid_policy = 'when-needed'
$cfg.paid_order = @('napkin', 'claude')
[IO.File]::WriteAllText((Join-Path $app 'config.json'), ($cfg | ConvertTo-Json -Depth 4), (New-Object Text.UTF8Encoding $false))

Copy-Item (Join-Path $La 'packs') (Join-Path $app 'packs') -Recurse
Copy-Item (Join-Path $La 'assets') (Join-Path $app 'assets') -Recurse
Copy-Item (Join-Path $Src 'run_server.pyw') $app
Remove-Item (Join-Path $app 'packs\README.txt') -ErrorAction SilentlyContinue
Get-ChildItem $app -Recurse -Directory -Filter '__pycache__' | Remove-Item -Recurse -Force
Write-Host "   Application files staged ($(@(Get-ChildItem $app -Recurse -File).Count) files)." -ForegroundColor Green

# 3. Approved template fingerprint
$pol = Join-Path $env:ProgramData 'AIVisualBuilder\access.json'
$tpl = if (Test-Path $pol) { (Get-Content $pol -Raw | ConvertFrom-Json).template } else { $null }
if (-not $tpl) { $tpl = (Get-Content (Join-Path $La 'access.example.json') -Raw | ConvertFrom-Json).template }
[IO.File]::WriteAllText((Join-Path $Stage 'access-template.json'), ($tpl | ConvertTo-Json -Depth 6), (New-Object Text.UTF8Encoding $false))

# 4. Original SL Smart Design backup (57,600 bytes clean licensed copy)
Write-Host '3. Staging original SL Smart Design repair source...' -ForegroundColor Cyan
$origDir = Join-Path $Stage 'original_slsd'
New-Item -ItemType Directory -Force $origDir | Out-Null
$cleanPpam = 'D:\Karthik\SL_Smart_Design_Source\Backup_before_V10.20\SL_Smart_Design_v2_Key_Dec_25.ppam'
if (Test-Path $cleanPpam) {
    Copy-Item $cleanPpam $origDir -Force
    Write-Host "   Original SL Smart Design PPAM included ($((Get-Item $cleanPpam).Length) bytes)." -ForegroundColor Green
} else {
    Write-Host "   Warning: $cleanPpam not found." -ForegroundColor Yellow
}

# 5. Pre-wire AI Service Keys for the Team (Claude + Napkin)
Write-Host '4. Bundling AI keys for team evaluation...' -ForegroundColor Cyan
$keysFile = Join-Path $Stage 'AIVB-keys.json'
$sourceClaude = Join-Path $env:LOCALAPPDATA 'AIVisualBuilder\claude.json'
$sourceNapkin = Join-Path $env:LOCALAPPDATA 'AIVisualBuilder\napkin.json'
$claudeKey = ''
$napkinKey = ''

if (Test-Path $sourceClaude) {
    try { $claudeKey = (Get-Content $sourceClaude -Raw | ConvertFrom-Json).api_key } catch {}
}
if (Test-Path $sourceNapkin) {
    try { $napkinKey = (Get-Content $sourceNapkin -Raw | ConvertFrom-Json).api_key } catch {}
}

if ($claudeKey -or $napkinKey) {
    $keysObj = [ordered]@{
        napkin_api_key    = $napkinKey
        anthropic_api_key = $claudeKey
    }
    [IO.File]::WriteAllText($keysFile, ($keysObj | ConvertTo-Json), (New-Object Text.UTF8Encoding $false))
    Write-Host '   Active Claude AI and Napkin AI keys bundled in AIVB-keys.json.' -ForegroundColor Green
} else {
    Write-Host '   No active keys found in local appdata; AIVB-keys.json skipped.' -ForegroundColor Yellow
}

# 6. Copy Scripts & Launchers
Write-Host '5. Staging 1-click launchers and scripts...' -ForegroundColor Cyan
foreach ($f in 'common.ps1', 'Install.ps1', 'INSTALL - AI Visual Builder.bat',
               'Restore-Original-SLSD.ps1', 'Restore-Original-SLSD.bat',
               'Configure-Keys.ps1', 'Set AI keys.bat',
               'Restart.ps1', 'Restart AI Visual Builder.bat',
               'Uninstall.ps1', 'Uninstall AI Visual Builder.bat',
               'manifest-pilot.template.xml', 'START HERE - Team Pilot Guide.txt') {
    Copy-Item (Join-Path $Src $f) $Stage -Force
}
Copy-Item (Join-Path $Src 'START HERE - Team Pilot Guide.txt') (Join-Path $Out 'README.txt') -Force

# 7. Package ZIP and Checksum
Write-Host '6. Creating final distributable ZIP archive...' -ForegroundColor Cyan
$Ver = ([regex]::Match((Get-Content (Join-Path $La 'server.py') -Raw), "VERSION = '([^']+)'")).Groups[1].Value
$zip = Join-Path $Out "SLSD-AI-Visual-Builder-$Ver-TeamPilot.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }

Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::CreateFromDirectory($Stage, $zip, [IO.Compression.CompressionLevel]::Optimal, $false)
$hash = (Get-FileHash $zip -Algorithm SHA256).Hash
"$hash  $(Split-Path $zip -Leaf)" | Set-Content (Join-Path $Out 'SHA256.txt') -Encoding Ascii

Write-Host ''
Write-Host '===================================================' -ForegroundColor Green
Write-Host '           BUILD COMPLETE SUCCESSFULLY!            ' -ForegroundColor Green
Write-Host '===================================================' -ForegroundColor Green
Write-Host "Output ZIP : $zip" -ForegroundColor Green
Write-Host ("Size       : {0:N1} MB" -f ((Get-Item $zip).Length / 1MB)) -ForegroundColor Green
Write-Host "SHA256     : $hash" -ForegroundColor Green
Write-Host ''
Write-Host 'Folder ready to share with team:' -ForegroundColor Cyan
Write-Host "  $Out" -ForegroundColor Cyan
