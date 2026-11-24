# Single-File Installer Builder for SL Smart Design + AI Visual Builder
# Produces: Dist_Installer\SL-Editor-Setup.exe (the ONLY file to share with the team)
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
Write-Host ' SL Smart Design + AI Visual Builder: Single-File Builder  ' -ForegroundColor Cyan
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
Write-Host 'Staging application files into Team_Package...' -ForegroundColor Yellow
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'build-team-package.ps1') -Bundle $BundlePath
if ($LASTEXITCODE -ne 0) { throw 'build-team-package.ps1 failed.' }

# 3. Compile single installer using Inno Setup
$IssPath = Join-Path $PSScriptRoot 'installer\Setup.iss'
Write-Host "Compiling single-file installer with Inno Setup ($IssPath)..." -ForegroundColor Yellow
& $InnoCompiler $IssPath
if ($LASTEXITCODE -ne 0) { throw 'Inno Setup compilation failed.' }

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
    Write-Host ''
    Write-Host 'WHAT THE USER EXPERIENCES:' -ForegroundColor Cyan
    Write-Host ' - User double-clicks SL-Editor-Setup.exe to install.' -ForegroundColor White
    Write-Host ' - User opens PowerPoint -> Home > SL Editor (and the SL Editor tab).' -ForegroundColor White
    Write-Host ' - User clicks SL Editor -> enters their activation key once.' -ForegroundColor White
    Write-Host " - Features unlock until the expiration date ($Expires)." -ForegroundColor White
} else {
    throw "Output file $OutExe was not created."
}
