# AI Visual Builder (team installation) - run ELEVATED by Install.ps1 / Uninstall.ps1 (Windows asks once).
# PowerPoint keeps a web add-in's tab at every start only when the add-in comes from a "shared folder" catalog, which
# must be a network path. This makes one on this PC: a hidden, read-only share of the installation's catalog folder
# (only the SL Smart Design manifest is in it), readable by the installing user only. -Remove deletes it again.
param([string]$Path, [string]$Name = 'SLSmartDesign$', [string]$User, [switch]$Remove)
$ErrorActionPreference = 'Stop'
$ex = Get-SmbShare -Name $Name -ErrorAction SilentlyContinue
if ($Remove) { if ($ex) { Remove-SmbShare -Name $Name -Force }; exit 0 }
if ($ex -and $ex.Path -ne $Path) { Remove-SmbShare -Name $Name -Force; $ex = $null }
if (-not $ex) { New-SmbShare -Name $Name -Path $Path -ReadAccess $User -Description 'SL Smart Design add-in catalog (AI Visual Builder)' | Out-Null }
exit 0
