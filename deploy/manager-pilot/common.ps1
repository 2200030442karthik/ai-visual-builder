# Shared helpers for the AI Visual Builder (Pilot) scripts. Dot-sourced; not run directly.
$ErrorActionPreference = 'Stop'

function Say($m, $c) { if ($c) { Write-Host $m -ForegroundColor $c } else { Write-Host $m } }

function PilotPaths([string]$Instance) {
    $dest = Join-Path $env:LOCALAPPDATA "Programs\$Instance"
    [pscustomobject]@{
        Dest     = $dest
        App      = Join-Path $dest 'app'
        Runtime  = Join-Path $dest 'runtime'
        Pythonw  = Join-Path $dest 'runtime\pythonw.exe'
        Launcher = Join-Path $dest 'app\run_server.pyw'
        Pilot    = Join-Path $dest 'app\pilot.json'
        State    = Join-Path $dest 'install-state.json'
        Manifest = Join-Path $dest 'manifest-pilot.xml'
        Startup  = Join-Path ([Environment]::GetFolderPath('Startup')) "$Instance.lnk"
        UninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$Instance"
    }
}

function ReadJson($path) { if (Test-Path $path) { Get-Content $path -Raw -Encoding UTF8 | ConvertFrom-Json } else { $null } }

function WriteJson($path, $obj, [switch]$Private) {
    [IO.File]::WriteAllText($path, ($obj | ConvertTo-Json -Depth 8), (New-Object Text.UTF8Encoding $false))
    if ($Private) { icacls $path /inheritance:r /grant:r "$($env:USERNAME):(R,W)" | Out-Null }
}

# Panel host processes started from this install folder (matched by command line; nothing else is touched)
function PilotHosts($p) {
    @(Get-CimInstance Win32_Process -Filter "Name like 'python%'" | Where-Object { $_.CommandLine -and $_.CommandLine -like "*$($p.Dest)*" })
}

function StopPilot($p) {
    $h = @(PilotHosts $p)
    foreach ($x in $h) { Stop-Process -Id $x.ProcessId -Force -ErrorAction SilentlyContinue }
    if ($h.Count) { Start-Sleep 1 }
    return [int]$h.Count
}

# /api/status over HTTPS with normal certificate checking (no -k): proves the certificate is trusted on this PC
function PilotStatus([int]$Port) {
    try { (& curl.exe -s --max-time 5 -H 'X-AIVB-Client: 1' "https://localhost:$Port/api/status") | ConvertFrom-Json } catch { $null }
}

function StartPilot($p, [int]$Port) {
    Start-Process -FilePath $p.Pythonw -ArgumentList "`"$($p.Launcher)`"" -WorkingDirectory $p.App -WindowStyle Hidden
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep 1
        $s = PilotStatus $Port
        if ($s -and $s.server) { return $s }
    }
    $null
}

function ReadSecret([string]$prompt) {
    $sec = Read-Host $prompt -AsSecureString
    $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b).Trim() } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}

# Asks for the organization's Napkin and Claude keys (hidden input) and stores them for this Windows user only,
# in the same files and format as the desktop version (napkin.json, claude.json). Enter keeps or skips.
function ConfigureKeys([string]$DataDir) {
    New-Item -ItemType Directory -Force $DataDir | Out-Null
    $nf = Join-Path $DataDir 'napkin.json'; $cf = Join-Path $DataDir 'claude.json'
    Say ''
    Say 'AI service keys (provided by your organization). The input is hidden; press Enter to keep or skip.' Cyan
    $n = ReadJson $nf
    $k = ReadSecret ("Napkin AI API token" + $(if ($n -and $n.api_key) { ' [a key is stored: Enter keeps it]' } else { '' }))
    if ($k) {
        if ($k.Length -lt 10) { Say '  That does not look like a Napkin token; not saved.' Yellow }
        else { WriteJson $nf ([ordered]@{ api_key = $k; enabled = $true; style_id = $(if ($n -and $n.style_id) { $n.style_id } else { '' }) }) -Private; Say '  Napkin AI key saved for this Windows user.' Green }
    } elseif ($n -and $n.api_key) { Say '  Napkin AI: existing key kept.' } else { Say '  Napkin AI: skipped (Napkin designs stay off until a key is added).' Yellow }
    $c = ReadJson $cf
    $k = ReadSecret ("Anthropic (Claude) API key, sk-ant-..." + $(if ($c -and $c.api_key) { ' [a key is stored: Enter keeps it]' } else { '' }))
    if ($k) {
        if (-not $k.StartsWith('sk-ant-')) { Say '  That does not look like an Anthropic key (sk-ant-...); not saved.' Yellow }
        else {
            $j = [ordered]@{ api_key = $k; enabled = $true; model = 'claude-opus-5-5' }
            if ($c) { foreach ($q in 'model', 'effort', 'max_tokens') { if ($c.$q) { $j[$q] = $c.$q } } }
            WriteJson $cf $j -Private; Say '  Claude key saved for this Windows user.' Green
        }
    } elseif ($c -and $c.api_key) { Say '  Claude: existing key kept.' } else { Say '  Claude: skipped (Claude designs stay off until a key is added).' Yellow }
}
