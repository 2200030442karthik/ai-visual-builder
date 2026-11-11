# AI Visual Builder 10.15 - puts the "AI Visuals" button beside "Alternative Design" in a COPY of the SL Smart Design
# add-in's file (its .pptm source, or a .ppam): customUI/customUI.xml gets the lines of customUI-addition.xml after the
# Alternative Design button (group "Template_id"). The original file is never changed; the copy is written next to it
# as <name>-AIVB.<ext>. The VBA callbacks are NOT added here (Office has no supported way to add VBA code outside the
# VBA editor): import AIVisualBuilder.bas into the same project, as README.txt describes.
#   .\add-to-sl-smart-design.ps1 -Source "C:\...\SL_Smart_Design_v2_Key_Dec_25.pptm" [-Out "C:\...\copy.pptm"]
param([Parameter(Mandatory = $true)][string]$Source, [string]$Out)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
$Source = (Resolve-Path $Source).Path
if (-not $Out) { $Out = Join-Path (Split-Path $Source) ([IO.Path]::GetFileNameWithoutExtension($Source) + '-AIVB' + [IO.Path]::GetExtension($Source)) }
$add = Get-Content (Join-Path $PSScriptRoot 'customUI-addition.xml') -Raw
$add = ($add -replace '(?s)<!--.*?-->', '').Trim("`r", "`n")
# the copy is a new archive with every part as it was (an in-place update can damage empty parts)
$src = [IO.Compression.ZipFile]::OpenRead($Source)
try {
    $parts = foreach ($e in $src.Entries) { $ms = New-Object IO.MemoryStream; $st = $e.Open(); $st.CopyTo($ms); $st.Close(); [pscustomobject]@{ Name = $e.FullName; Bytes = $ms.ToArray() } }
} finally { $src.Dispose() }
$ui = $parts | Where-Object { $_.Name -match '^customUI/customUI(14)?\.xml$' } | Select-Object -First 1
if (-not $ui) { throw 'This file has no ribbon (customUI/customUI.xml).' }
$xml = (New-Object Text.UTF8Encoding($false)).GetString($ui.Bytes).TrimStart([char]0xFEFF)
if ($xml -match 'id="AIVB_Split"') { Write-Host 'The AI Visuals button is already there; nothing written.'; exit 0 }
$m = [regex]::Match($xml, '<button\s+id="Template_Button1"[^>]*/>')
if (-not $m.Success) { throw 'The "Alternative Design" button (id Template_Button1) was not found in the ribbon.' }
$new = $xml.Substring(0, $m.Index + $m.Length) + "`r`n" + $add + $xml.Substring($m.Index + $m.Length)
[void]([xml]$new)                                       # still well-formed XML
$ui.Bytes = (New-Object Text.UTF8Encoding($false)).GetBytes($new)
if (Test-Path $Out) { Remove-Item $Out -Force }
$zip = [IO.Compression.ZipFile]::Open($Out, 'Create')
try {
    foreach ($q in $parts) { $st = $zip.CreateEntry($q.Name, [IO.Compression.CompressionLevel]::Optimal).Open(); $st.Write($q.Bytes, 0, $q.Bytes.Length); $st.Close() }
} finally { $zip.Dispose() }
Write-Host "Written: $Out" -ForegroundColor Green
Write-Host 'Next: open it, import AIVisualBuilder.bas in the VBA editor (Alt+F11 > File > Import File), save, and save as a PowerPoint Add-in (.ppam). See README.txt.'
