# SL Editor installer builder: Windows (one exe) and Mac (one zip)
# Produces: Dist_Installer\SL-Editor-Setup.exe (Windows) and Dist_Installer\SL-Editor-Mac.zip (Mac): the only files to share
# And:      deploy\team-keys\activation-keys.csv   (PRIVATE: kept by manager to issue individual keys)

param(
    [int]$Count = 25,
    [string]$Expires = '2027-03-31',
    [string]$Names,
    [switch]$NewKeys
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Keys = Join-Path $PSScriptRoot 'team-keys'
$BundlePath = Join-Path $Keys 'activation-bundle.json'
$InnoCompiler = "C:\Users\$($env:USERNAME)\AppData\Local\Programs\Inno Setup 6\iscc.exe"

if (-not (Test-Path $InnoCompiler)) {
    $alt = (Get-Command iscc.exe -ErrorAction SilentlyContinue).Source
    if ($alt) { $InnoCompiler = $alt }
    else { throw "Inno Setup compiler (iscc.exe) not found at $InnoCompiler" }
}

Set-Location $Root
Write-Host ''
Write-Host '===========================================================' -ForegroundColor Cyan
Write-Host ' SL Editor: installer builder (Windows exe + Mac zip)      ' -ForegroundColor Cyan
Write-Host '===========================================================' -ForegroundColor Cyan

# 1. Generate or reuse activation bundle
if ($NewKeys -and (Test-Path $Keys)) {
    $old = "$Keys-retired-$(Get-Date -Format yyyyMMdd-HHmmss)"
    Move-Item $Keys $old
    Write-Host "Old keys backed up to $old." -ForegroundColor Yellow
}

if (-not (Test-Path $BundlePath)) {
    Write-Host "Creating new encrypted activation bundle (expires: $Expires)..." -ForegroundColor Yellow
    $argsList = @('local-ai\activation.py', 'issue', '--count', "$Count", '--expires', $Expires, '--out', $Keys)
    if ($Names) { $argsList += @('--names', $Names) }
    & python @argsList
    if ($LASTEXITCODE -ne 0) { throw 'Failed to generate activation keys.' }
    Write-Host "Keys created in $Keys\activation-keys.csv" -ForegroundColor Green
} else {
    Write-Host "Reusing existing activation keys from $Keys." -ForegroundColor Green
}

# 2. Stage files into Team_Package
Write-Host 'Staging application files into Build_Stage...' -ForegroundColor Yellow
# 1b. 10.26: SL Design and SL Animation access keys (separate from the AI activation keys), made once and reused
$FeatPath = Join-Path $Keys 'features-bundle.json'
if (-not (Test-Path $FeatPath)) {
    $orig = $null
    foreach ($c in (Join-Path $env:LOCALAPPDATA 'AIVisualBuilder\addins-original\SL_Audomation.ppam'), (Join-Path $env:APPDATA 'Microsoft\AddIns\SL_Audomation.ppam')) {
        if (-not (Test-Path $c)) { continue }
        & python -I -c "import sys,zipfile;sys.exit(0 if len(zipfile.ZipFile(sys.argv[1]).read('ppt/vbaProject.bin'))>20000 else 1)" $c
        if ($LASTEXITCODE -eq 0) { $orig = $c; break }          # the real add-in (its macros), not a locked copy
    }
    if (-not $orig) { throw 'No original SL_Audomation.ppam on this PC to protect.' }
    Write-Host "Creating the SL Design and SL Animation access keys (expires: $Expires)..." -ForegroundColor Yellow
    & python (Join-Path $Root 'local-ai\features.py') issue --addin $orig --count $Count --expires $Expires --out $Keys
    if ($LASTEXITCODE -ne 0) { throw 'Failed to create the SL Design and SL Animation access keys.' }
}
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'build-stage.ps1') -Bundle $BundlePath -Features $FeatPath
if ($LASTEXITCODE -ne 0) { throw 'build-stage.ps1 failed.' }

# 3. Compile single installer using Inno Setup
$IssPath = Join-Path $PSScriptRoot 'installer\Setup.iss'
Write-Host "Compiling single-file installer with Inno Setup ($IssPath)..." -ForegroundColor Yellow
& $InnoCompiler $IssPath
if ($LASTEXITCODE -ne 0) { throw 'Inno Setup compilation failed.' }

# 4. 10.26: the Mac installer from the same staged files (Dist_Installer\SL-Editor-Mac.zip)
Write-Host 'Making the Mac installer...' -ForegroundColor Yellow
& python -I (Join-Path $PSScriptRoot 'make-mac-installer.py')
if ($LASTEXITCODE -ne 0) { throw 'The Mac installer was not made.' }

$OutExe = Join-Path $Root 'Dist_Installer\SL-Editor-Setup.exe'
if (Test-Path $OutExe) {
    $fileInfo = Get-Item $OutExe
    $sizeMb = [math]::Round($fileInfo.Length / 1MB, 2)
    Write-Host ''
    Write-Host '-----------------------------------------------------------' -ForegroundColor Green
    Write-Host " SUCCESS! Standalone installer built successfully!" -ForegroundColor Green
    Write-Host " Output File:  $OutExe ($sizeMb MB)" -ForegroundColor White
    Write-Host '-----------------------------------------------------------' -ForegroundColor Green
    Write-Host ''
    Write-Host 'HOW TO DISTRIBUTE:' -ForegroundColor Cyan
    Write-Host " 1. Share ONLY this one file with users: $OutExe" -ForegroundColor White
    Write-Host " 2. Give each user ONE personal activation key from: $Keys\activation-keys.csv" -ForegroundColor White
    Write-Host '    (Keep activation-keys.csv private - never share that file directly!)' -ForegroundColor Yellow
    Write-Host " 3. SL Design and SL Animation: give an access key from $Keys\sled-keys.csv only to users who may use them." -ForegroundColor White
    Write-Host ''
    Write-Host 'WHAT THE USER EXPERIENCES:' -ForegroundColor Cyan
    Write-Host ' - User double-clicks SL-Editor-Setup.exe to install.' -ForegroundColor White
    Write-Host ' - User opens PowerPoint -> Home > SL Editor (and the SL Editor tab).' -ForegroundColor White
    Write-Host ' - User clicks SL Editor -> enters their activation key once.' -ForegroundColor White
    Write-Host " - Features unlock until the expiration date ($Expires)." -ForegroundColor White
} else {
    throw "Output file $OutExe was not created."
}
