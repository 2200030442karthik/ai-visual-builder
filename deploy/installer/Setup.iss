; Inno Setup Script for AI SL Smart Design
; Produces a single, standalone Setup executable (AI-SL-Smart-Design-Setup.exe)
; Installs per-user without requiring administrator rights

#define MyAppName "SL Editor"
#define MyAppVersion "10.25"
#define MyAppPublisher "Simplilearn"
#define MyAppURL "https://www.simplilearn.com"
#define MyAppExeName "run_server.pyw"

[Setup]
AppId={{2F01D600-C9EC-4D94-ADE9-69B8B6F0BFA7}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={localappdata}\Programs\AIVisualBuilderPilot
DefaultGroupName=SL Editor
DisableProgramGroupPage=yes
DisableDirPage=yes
PrivilegesRequired=lowest
OutputBaseFilename=SL-Editor-Setup
OutputDir=..\..\Dist_Installer
Compression=lzma2/ultra64
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64compatible
WizardStyle=modern
UninstallDisplayIcon={app}\app\assets\icon-32.png
UninstallDisplayName={#MyAppName}
CloseApplications=force
RestartApplications=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
; Copy all files from the built Team Package
Source: "..\..\Team_Package\AI Visual Builder\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "Setup-PostInstall.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "Setup-Uninstall.ps1"; DestDir: "{app}"; Flags: ignoreversion

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Office\16.0\WEF\Developer"; ValueType: string; ValueName: "2f01d600-c9ec-4d94-ade9-69b8b6f0bfa7"; ValueData: "{app}\catalog\manifest-slsd.xml"; Flags: uninsdeletevalue

[Icons]
; Startup shortcut so the local service runs automatically on login
Name: "{userstartup}\SL Editor Service"; Filename: "{app}\runtime\pythonw.exe"; Parameters: """{app}\app\run_server.pyw"""; WorkingDir: "{app}\app"

[Run]
; Run the automated registration script silently during install
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File ""{app}\Setup-PostInstall.ps1"" -AppDir ""{app}"""; Flags: waituntilterminated; Description: "Setting up SL Editor in PowerPoint"

[UninstallRun]
; Clean up PowerPoint registration and certificates on uninstall
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File ""{app}\Setup-Uninstall.ps1"" -AppDir ""{app}"""; Flags: waituntilterminated; RunOnceId: "SLEditorUninstall"

[Code]
procedure StopRunningProcesses();
var
  ResultCode: Integer;
begin
  // Terminate any running python/pythonw instances of AI Visual Builder before file copying
  Exec('powershell.exe', '-NoProfile -ExecutionPolicy Bypass -Command "Get-Process python*, pythonw* -ErrorAction SilentlyContinue | Where-Object { $_.Path -like ''*AIVisualBuilder*'' } | Stop-Process -Force -ErrorAction SilentlyContinue"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Sleep(600);
end;

// 10.25: the company's add-ins are changed only while PowerPoint is closed (it holds them open)
function PowerPointRunning(): Boolean;
var
  ResultCode: Integer;
begin
  Exec('cmd.exe', '/c tasklist /FI "IMAGENAME eq POWERPNT.EXE" | find /I "POWERPNT.EXE" >nul', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Result := (ResultCode = 0);
end;

function WaitForPowerPoint(): Boolean;
begin
  Result := True;
  while PowerPointRunning() do
  begin
    if MsgBox('Please save your work and close PowerPoint, then press OK to continue.' + #13#10 + 'SL Editor sets itself up in PowerPoint while it is closed.', mbInformation, MB_OKCANCEL) = IDCANCEL then
    begin
      Result := False;
      exit;
    end;
  end;
end;

function InitializeSetup(): Boolean;
begin
  StopRunningProcesses();
  Result := WaitForPowerPoint();
end;

function InitializeUninstall(): Boolean;
begin
  Result := WaitForPowerPoint();
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  StopRunningProcesses();
  Result := '';
end;
