Attribute VB_Name = "AIVisualBuilder"
' AI Visual Builder (V10.15) - the "AI Visuals" button on the SL Smart Design ribbon, beside Alternative Design.
' Office gives a VBA add-in no way to open a web add-in's task pane, so these callbacks run the add-in's helper
' (open-panel.ps1 in the AI Visual Builder folder): it presses the add-in's own ribbon button through Windows UI
' Automation and comes back to the SL Smart Design tab. The helper's folder is recorded by "Install V10 add-in.bat"
' (HKCU\Software\VB and VBA Program Settings\AIVisualBuilder\Install, value Path). Nothing in the presentation is
' read or changed here. The helper runs without waiting: PowerPoint must stay free while it presses the ribbon.
Option Explicit

Public Sub AIVB_Generate(control As IRibbonControl)
    AIVB_Open "generate"
End Sub

Public Sub AIVB_Slides(control As IRibbonControl)
    AIVB_Open "slides"
End Sub

Public Sub AIVB_Edit(control As IRibbonControl)
    AIVB_Open "edit"
End Sub

Private Sub AIVB_Open(ByVal view As String)
    Dim folder As String, script As String
    folder = GetSetting("AIVisualBuilder", "Install", "Path", "")
    script = folder & "\open-panel.ps1"
    If Len(folder) = 0 Or Len(Dir(script)) = 0 Then
        MsgBox "AI Visual Builder is not installed on this PC." & vbCrLf & vbCrLf & _
               "Run ""Install V10 add-in.bat"" in the AI Visual Builder folder, restart PowerPoint and try again.", _
               vbInformation, "AI Visual Builder"
        Exit Sub
    End If
    Shell "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & script & """ -View " & view, vbHide
End Sub
