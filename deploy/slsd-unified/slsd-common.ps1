# SL Smart Design (unified) - helpers shared by Install / Rollback / Uninstall / Verify. Dot-sourced after common.ps1.
# Everything the installer changes outside its own program folder is listed here (Targets) and backed up and restored
# exactly from that list: two add-in files, the SL Smart Design add-in keys, this product's own web add-in registration
# (Developer value or trusted catalog subkey), and the older AI Visual Builder pilot's registration. No shared Office key
# is ever recreated or emptied, so every other add-in keeps its registration.

$SLSD = [ordered]@{
    ProductId  = '2f01d600-c9ec-4d94-ade9-69b8b6f0bfa7'            # this product's web add-in Id (manifest)
    CatalogId  = '{EEBC6074-F7DB-4E1A-A3DC-BC2784D4BF34}'          # this product's trusted catalog entry
    PilotId    = '78643140-2b68-48d8-b072-3b253dddf2b8'             # the older "AI Visual Builder (Pilot)" add-in
    VbaName    = 'SL_Smart_Design_v2_Key_Dec_25'                    # the company's SL Smart Design add-in
    V1020Name  = 'SLSD_AIVisualBuilder'                             # the V10.20 "SL Smart Design AI" VBA add-in
}

function OfficeTargets([string]$OfficeRoot, [string]$AddInsDir) {
    $wef = Join-Path $OfficeRoot 'WEF\Developer'
    [pscustomobject]@{
        OfficeRoot = $OfficeRoot
        AddInsDir  = $AddInsDir
        Wef        = $wef
        CatKey     = Join-Path $OfficeRoot "WEF\TrustedCatalogs\$($SLSD.CatalogId)"
        VbaKey     = Join-Path $OfficeRoot "PowerPoint\AddIns\$($SLSD.VbaName)"
        V1020Key   = Join-Path $OfficeRoot "PowerPoint\AddIns\$($SLSD.V1020Name)"
        VbaFile    = Join-Path $AddInsDir "$($SLSD.VbaName).ppam"
        V1020File  = Join-Path $AddInsDir "$($SLSD.V1020Name).ppam"
        Real       = ($OfficeRoot -eq 'HKCU:\Software\Microsoft\Office\16.0')
    }
}

# key items: whole subkeys with named values; value items: one value of a shared key (never the key itself)
function TargetList($T) {
    @(
        @{ kind = 'key'; key = $T.VbaKey; names = @('Path', 'AutoLoad') },
        @{ kind = 'key'; key = $T.V1020Key; names = @('Path', 'AutoLoad') },
        @{ kind = 'key'; key = $T.CatKey; names = @('Id', 'Url', 'Flags') },
        @{ kind = 'value'; key = $T.Wef; name = $SLSD.ProductId },
        @{ kind = 'value'; key = $T.Wef; name = $SLSD.PilotId }
    )
}
$DwordNames = @('AutoLoad', 'Flags')

function GetValue($key, $name) {
    if (-not (Test-Path $key)) { return $null }
    $p = Get-ItemProperty -Path $key -ErrorAction SilentlyContinue
    if ($p -and ($p.PSObject.Properties.Name -contains $name)) { return $p.$name }
    return $null
}

function EnsureKey([string]$key) {     # creates missing parents one by one; never -Force on an existing key
    if (Test-Path $key) { return }
    $parent = Split-Path $key -Parent
    if ($parent -and -not (Test-Path $parent)) { EnsureKey $parent }
    New-Item -Path $key | Out-Null
}

function SetValue($key, $name, $value) {
    EnsureKey $key
    if ($DwordNames -contains $name) { New-ItemProperty -Path $key -Name $name -Value ([int]$value) -PropertyType DWord -Force | Out-Null }
    else { New-ItemProperty -Path $key -Name $name -Value "$value" -PropertyType String -Force | Out-Null }
}

# Backup: files + registry items + the old pilot's autostart shortcut, into $Dir\state.json and copies
function BackupState($T, [string]$Dir, [string]$PilotStartup) {
    New-Item -ItemType Directory -Force $Dir | Out-Null
    $files = [ordered]@{}
    foreach ($f in @($T.VbaFile, $T.V1020File, $PilotStartup)) {
        if (-not $f) { continue }
        $leaf = Split-Path $f -Leaf
        if (Test-Path $f) { $s = [IO.File]::Open($f, 'Open', 'Read', 'ReadWrite'); try { $o = [IO.File]::Create((Join-Path $Dir $leaf)); try { $s.CopyTo($o) } finally { $o.Close() } } finally { $s.Close() }; $files[$f] = $leaf }
        else { $files[$f] = $null }
    }
    $reg = @()
    foreach ($it in TargetList $T) {
        if ($it.kind -eq 'key') {
            $vals = [ordered]@{}; foreach ($n in $it.names) { $vals[$n] = GetValue $it.key $n }
            $reg += [ordered]@{ kind = 'key'; key = $it.key; exists = [bool](Test-Path $it.key); values = $vals }
        } else {
            $reg += [ordered]@{ kind = 'value'; key = $it.key; name = $it.name; value = (GetValue $it.key $it.name) }
        }
    }
    WriteJson (Join-Path $Dir 'state.json') ([ordered]@{ made = (Get-Date).ToString('s'); files = $files; registry = $reg })
    return $Dir
}

# Restore exactly what BackupState saw (files back or removed, keys/values back or removed)
function RestoreState([string]$Dir) {
    $st = ReadJson (Join-Path $Dir 'state.json')
    if (-not $st) { throw "No backup in $Dir" }
    foreach ($p in $st.files.PSObject.Properties) {
        $dst = $p.Name; $leaf = $p.Value
        if ($leaf) { New-Item -ItemType Directory -Force (Split-Path $dst) | Out-Null; Copy-Item (Join-Path $Dir $leaf) $dst -Force }
        elseif (Test-Path $dst) { Remove-Item $dst -Force }
    }
    foreach ($r in $st.registry) {
        if ($r.kind -eq 'key') {
            if ($r.exists) { EnsureKey $r.key; foreach ($v in $r.values.PSObject.Properties) { if ($null -ne $v.Value) { SetValue $r.key $v.Name $v.Value } elseif ($null -ne (GetValue $r.key $v.Name)) { Remove-ItemProperty -Path $r.key -Name $v.Name } } }
            elseif (Test-Path $r.key) { Remove-Item -Path $r.key -Recurse }
        } else {
            if ($null -ne $r.value) { SetValue $r.key $r.name $r.value }
            elseif ($null -ne (GetValue $r.key $r.name)) { Remove-ItemProperty -Path $r.key -Name $r.name }
        }
    }
}

# Template library: the numbered N-point folders the Alternative Design window lists, and the SL Templates files
function TemplateReport([string]$Dir) {
    $r = [ordered]@{ dir = $Dir; points = 0; missing = @() }
    foreach ($n in 2..10) {
        $d = Join-Path $Dir "$($n)_point"
        if (-not (Test-Path (Join-Path $d '0001.pptx'))) { $r.missing += "$($n)_point" } else { $r.points += @(Get-ChildItem $d -Filter '*.pptx').Count }
    }
    foreach ($f in 'Notes\Note_Section.pptx', 'Info\Info_Section.pptx', 'BlueCodebox\BlueCodebox_Section.pptx', 'BlackCodebox\BlackCodebox_Section.pptx',
                   'ProblemSolution\ProblemSolution_Section.pptx', 'ProblemSolutionImage\ProblemSolutionImage_Section.pptx') {
        if (-not (Test-Path (Join-Path $Dir $f))) { $r.missing += $f }
    }
    [pscustomobject]$r
}

# Adds only the library files that are missing (never overwrites a file the company's Template Manager installed)
function InstallTemplates([string]$Zip, [string]$Dir) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $z = [IO.Compression.ZipFile]::OpenRead($Zip); $added = 0
    try {
        foreach ($e in $z.Entries) {
            if (-not $e.Name) { continue }
            $rel = $e.FullName -replace '/', '\'
            if ($rel -match '(^|\\)\.\.(\\|$)' -or [IO.Path]::IsPathRooted($rel)) { throw "Unsafe path in the template zip: $($e.FullName)" }
            $dst = Join-Path $Dir $rel
            if (Test-Path $dst) { continue }
            New-Item -ItemType Directory -Force (Split-Path $dst) | Out-Null
            [IO.Compression.ZipFileExtensions]::ExtractToFile($e, $dst); $added++
        }
    } finally { $z.Dispose() }
    return $added
}
