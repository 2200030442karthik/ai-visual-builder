# AI Visual Builder 10.15 - opens the add-in's task pane from another ribbon (the SL Smart Design tab, a VBA add-in).
# Office has no way for a VBA add-in to open a web add-in's task pane, and a web add-in cannot put a button on a VBA
# add-in's tab. So the SL Smart Design button (sl-smart-design\AIVisualBuilder.bas) runs this script, which does what a
# user would do, through Windows UI Automation: shows the tab that holds the "AI Visual Builder" group (manifest-v10.xml:
# the Home tab), presses the button there, and goes back to the tab the user came from. Nothing in the presentation
# is read or changed.
#   -View generate | slides | edit      which button: Generate visuals | Several slides | Edit a visual
#   -HostTab Home                       the tab that holds the group (manifest-v10.xml OfficeTab TabHome)
#   -ReturnTab "SL Smart Design"        the tab to show again afterwards ('' = stay)
#   -List                               only list the ribbon's tabs (a check; nothing is pressed)
# Exit codes: 0 opened, 2 PowerPoint window not found, 3 tab not found, 4 button not found (add-in not installed or
# not loaded yet: open it once from Home > AI Visual Builder).
param([ValidateSet('generate', 'slides', 'edit')][string]$View = 'generate', [string]$HostTab = 'Home', [string]$ReturnTab = 'SL Smart Design',
      [string]$Group = 'AI Visual Builder', [switch]$List)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
Add-Type -Namespace AIVB -Name Win -MemberDefinition '[DllImport("user32.dll")] public static extern System.IntPtr GetForegroundWindow();
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(System.IntPtr h, out uint pid);'
$A = [System.Windows.Automation.AutomationElement]; $T = [System.Windows.Automation.TreeScope]; $C = [System.Windows.Automation.ControlType]
$Buttons = @{ generate = 'Generate visuals'; slides = 'Several slides'; edit = 'Edit a visual' }
# the VBA button cannot wait for this script (PowerPoint would be busy while the script presses its ribbon), so a
# problem is shown here, in a message box
function Fail($code, $msg) { Add-Type -AssemblyName PresentationFramework; [void][System.Windows.MessageBox]::Show($msg, 'AI Visual Builder', 'OK', 'Information'); exit $code }

# the PowerPoint window the user is in (the foreground one when it is PowerPoint, else PowerPoint's main window)
$h = [AIVB.Win]::GetForegroundWindow(); $procId = 0; [void][AIVB.Win]::GetWindowThreadProcessId($h, [ref]$procId)
$p = Get-Process -Id $procId -ErrorAction SilentlyContinue
if (-not $p -or $p.ProcessName -ne 'POWERPNT') {
    $p = Get-Process POWERPNT -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
    if (-not $p) { Fail 2 'PowerPoint is not open.' }
    $h = $p.MainWindowHandle
}
$root = $A::FromHandle($h)
function Find($scope, $name, $types) {
    $byName = New-Object System.Windows.Automation.PropertyCondition($A::NameProperty, $name)
    foreach ($e in $scope.FindAll($T::Descendants, $byName)) { if (-not $types -or $types -contains $e.Current.ControlType) { return $e } }
    return $null
}
function Tab($name) { $byType = New-Object System.Windows.Automation.PropertyCondition($A::ControlTypeProperty, $C::TabItem)
    foreach ($e in $root.FindAll($T::Descendants, $byType)) { if ($e.Current.Name -eq $name) { return $e } }; return $null }
function Press($e) {
    $pat = $null
    if ($e.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$pat)) { $pat.Invoke(); return $true }
    if ($e.TryGetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern, [ref]$pat)) { $pat.Expand(); return $true }
    if ($e.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$pat)) { $pat.Select(); return $true }
    return $false
}
if ($List) {
    $byType = New-Object System.Windows.Automation.PropertyCondition($A::ControlTypeProperty, $C::TabItem)
    Write-Host ('Ribbon tabs: ' + (($root.FindAll($T::Descendants, $byType) | ForEach-Object { $_.Current.Name }) -join ', ')); exit 0
}
$host_ = Tab $HostTab
if (-not $host_) { Fail 3 "The $HostTab tab was not found on PowerPoint's ribbon." }
$came = $null
$byType = New-Object System.Windows.Automation.PropertyCondition($A::ControlTypeProperty, $C::TabItem)
foreach ($e in $root.FindAll($T::Descendants, $byType)) { $s = $null; if ($e.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$s) -and $s.Current.IsSelected) { $came = $e.Current.Name } }
[void](Press $host_)
$types = @($C::Button, $C::SplitButton, $C::MenuItem)
$btn = $null
for ($i = 0; $i -lt 30 -and -not $btn; $i++) {
    Start-Sleep -Milliseconds 100
    $btn = Find $root $Buttons[$View] $types
    if (-not $btn -and $i -eq 5) { $g = Find $root $Group $types; if ($g) { [void](Press $g) } }   # a group PowerPoint collapsed (narrow window)
}
if (-not $btn) { if ($came) { $t = Tab $came; if ($t) { [void](Press $t) } }
    Fail 4 "AI Visual Builder's '$($Buttons[$View])' button was not found on the $HostTab tab.`n`nIf the add-in is not installed, run 'Install V10 add-in.bat' in the AI Visual Builder folder and restart PowerPoint. Otherwise open it once from $HostTab > AI Visual Builder." }
[void](Press $btn)
$back = if ($ReturnTab) { $ReturnTab } else { $came }
if ($back -and $back -ne $HostTab) { Start-Sleep -Milliseconds 300; $t = Tab $back; if ($t) { [void](Press $t) } }
exit 0
