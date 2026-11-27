# Builds SLSD_AIVisualBuilder.ppam (the "SL Smart Design AI" add-in: the AI Visual Builder buttons in the SL Smart
# Design tab's Design group) from SLSD_AIVisualBuilder.bas and SLSD_AIVisualBuilder.customUI.xml.
# PowerPoint must be closed. PowerPoint's "Trust access to the VBA project object model" is switched on only for the
# build and restored to what it was afterwards (also when the build fails). No other add-in is opened or changed.
param([Parameter(Mandatory)][string]$OutDir)
$ErrorActionPreference = 'Stop'
$Here = $PSScriptRoot
if (Get-Process POWERPNT -ErrorAction SilentlyContinue) { throw 'Close PowerPoint first.' }
New-Item -ItemType Directory -Force $OutDir | Out-Null
$out = Join-Path $OutDir 'SLSD_AIVisualBuilder.ppam'
$sec = 'HKCU:\Software\Microsoft\Office\16.0\PowerPoint\Security'
if (-not (Test-Path $sec)) { New-Item -Path $sec | Out-Null }
$before = (Get-ItemProperty $sec -ErrorAction SilentlyContinue).AccessVBOM
$pp = $null
try {
    New-ItemProperty -Path $sec -Name AccessVBOM -Value 1 -PropertyType DWord -Force | Out-Null
    $pp = New-Object -ComObject PowerPoint.Application
    $pres = $pp.Presentations.Add(0)                       # no window
    [void]$pres.VBProject.VBComponents.Import((Join-Path $Here 'SLSD_AIVisualBuilder.bas'))
    $base = Join-Path $env:TEMP 'SLSD_AIVisualBuilder.base.ppam'; if (Test-Path $base) { Remove-Item $base }
    $pres.SaveAs($base, 30)                                  # ppSaveAsOpenXMLAddin
    $pres.Close()
} finally {
    if ($pp) { try { $pp.Quit() } catch {}; [void][Runtime.InteropServices.Marshal]::ReleaseComObject($pp) }
    for ($i = 0; $i -lt 30 -and (Get-Process POWERPNT -ErrorAction SilentlyContinue); $i++) { Start-Sleep 1 }   # PowerPoint writes its settings when it exits
    if ($null -eq $before) { Remove-ItemProperty -Path $sec -Name AccessVBOM -ErrorAction SilentlyContinue }
    else { New-ItemProperty -Path $sec -Name AccessVBOM -Value $before -PropertyType DWord -Force | Out-Null }
    Write-Host ("Trust access to the VBA project object model: restored to " + $(if ($null -eq $before) { 'not set (off)' } else { $before }))
}
for ($i = 0; $i -lt 20 -and (Get-Process POWERPNT -ErrorAction SilentlyContinue); $i++) { Start-Sleep 1 }


# the ribbon: added by rewriting the package with Python's zipfile (PowerPoint refused packages updated in place by .NET's
# ZipArchive, and a ribbon XML with a comment before <ribbon>: both found in the real PowerPoint test, 13 Nov 2026)
python (Join-Path $Here 'add_customui.py') $base (Join-Path $Here 'SLSD_AIVisualBuilder.customUI.xml') $out
if ($LASTEXITCODE -ne 0) { throw 'Adding the ribbon failed.' }
Remove-Item $base -ErrorAction SilentlyContinue
Write-Host "Built: $out ($((Get-Item $out).Length) bytes)"