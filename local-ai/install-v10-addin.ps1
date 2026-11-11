# Registers (or removes) ONLY the V10 add-in in PowerPoint desktop for the current Windows user, by its own manifest ID
# (manifest-v10.xml, Id 08d15d9d-...). Other add-ins (the V9 add-in, Id cab7b7e5-..., hosted on GitHub Pages) are never
# touched, and API keys and settings in %LOCALAPPDATA% are kept.
#   (no switch)    registers manifest-v10.xml (Office's developer sideload key)  -Remove   removes only that entry
#   -Status        shows what is registered                                    -ClearCache   empties Office's add-in
#                  cache (close PowerPoint first) so PowerPoint reloads the panel files; other add-ins re-download theirs
param([switch]$Remove, [switch]$Status, [switch]$ClearCache)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Manifest = Join-Path $Root 'manifest-v10.xml'
$xml = [xml](Get-Content $Manifest -Raw)
$Id = $xml.OfficeApp.Id; $Ver = $xml.OfficeApp.Version
$V9Id = 'cab7b7e5-...'      # the V9 add-in's Id (its files are no longer in this folder)
if ($Id -like 'cab7b7e5-*') { throw "manifest-v10.xml has the V9 add-in's Id ($Id); V10 must have its own." }
$Key = 'HKCU:\Software\Microsoft\Office\16.0\WEF\Developer'

function Registered { (Get-ItemProperty -Path $Key -ErrorAction SilentlyContinue).$Id }
if ($Status) {
    $r = Registered
    Write-Host "V10 add-in (Id $Id, version $Ver): $(if ($r) { "registered -> $r" } else { 'not registered' })"
    Write-Host "V9 add-in (Id $V9Id): separate and not changed here."
    exit 0
}
if ($ClearCache) {
    if (Get-Process POWERPNT -ErrorAction SilentlyContinue) { Write-Host 'Close PowerPoint first, then run this again.' -ForegroundColor Yellow; exit 1 }
    $cache = Join-Path $env:LOCALAPPDATA 'Microsoft\Office\16.0\Wef'
    if (Test-Path $cache) { Get-ChildItem $cache -Force | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue }
    Write-Host 'Office add-in cache emptied. Start PowerPoint again; the panel files are loaded fresh.' -ForegroundColor Green
    exit 0
}
# 10.15: where open-panel.ps1 is, for the "AI Visuals" button on the SL Smart Design tab (AIVisualBuilder.bas reads it
# with GetSetting("AIVisualBuilder", "Install", "Path"))
$VbaKey = 'HKCU:\Software\VB and VBA Program Settings\AIVisualBuilder\Install'
if ($Remove) {
    if (Registered) { Remove-ItemProperty -Path $Key -Name $Id; Write-Host 'The V10 add-in was removed from PowerPoint (V9 unchanged). Restart PowerPoint.' }
    else { Write-Host 'The V10 add-in was not registered.' }
    if (Test-Path $VbaKey) { Remove-Item -Path (Split-Path $VbaKey) -Recurse -Force }
    exit 0
}
New-Item -Path $Key -Force | Out-Null
New-ItemProperty -Path $Key -Name $Id -Value $Manifest -PropertyType String -Force | Out-Null
New-Item -Path $VbaKey -Force | Out-Null
New-ItemProperty -Path $VbaKey -Name 'Path' -Value (Join-Path $Root 'local-ai') -PropertyType String -Force | Out-Null
Write-Host "Registered AI Visual Builder V10 ($Ver) for PowerPoint desktop: $Manifest" -ForegroundColor Green
Write-Host 'Restart PowerPoint; the add-in is on the Home tab, group "AI Visual Builder" (Generate visuals, Several slides, Edit a visual),'
Write-Host 'and - once SL Smart Design has the "AI Visuals" button (local-ai\sl-smart-design\README.txt) - beside Alternative Design. V9 is unchanged.'
