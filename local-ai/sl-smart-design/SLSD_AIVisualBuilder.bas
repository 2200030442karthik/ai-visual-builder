Attribute VB_Name = "SLSD_AIVisualBuilder"
' SL Smart Design - AI Visual Builder (V10.20): the AI Visual Builder buttons in the Design group of the SL Smart Design
' tab, beside Alternative Design. This module is the whole of the "SL Smart Design AI" add-in (SLSD_AIVisualBuilder.ppam);
' the SL Smart Design add-in itself is not changed (only its ribbon XML shares its tab and Design group, idQ).
'
' How a button opens the real AI Visual Builder task pane (Office.js, full PowerPoint access):
'   1. it asks the AI Visual Builder service on this PC (https://localhost:44317/api/bridge/open) for the view, naming the
'      active presentation;
'   2. the AI Visual Builder of that presentation (its shared runtime, local-ai\bridge.js) opens its task pane with
'      Office.addin.showAsTaskpane() and acknowledges - Office's supported API, no clicks;
'   3. when the AI Visual Builder has not been opened in this presentation yet (no runtime to answer), its own ribbon
'      command is pressed once through Windows UI Automation (open-panel.ps1); from then on step 2 serves.
' Nothing in the presentation is read or changed here; no key or licence is involved.
Option Explicit

#If VBA7 Then
Private Declare PtrSafe Sub Sleep Lib "kernel32" (ByVal ms As Long)
#Else
Private Declare Sub Sleep Lib "kernel32" (ByVal ms As Long)
#End If

Private Const SERVICE As String = "https://localhost:44317"

Public Sub SLSD_AIVB_Generate(control As IRibbonControl)
    SLSD_AIVB_Open "generate"
End Sub

Public Sub SLSD_AIVB_Slides(control As IRibbonControl)
    SLSD_AIVB_Open "slides"
End Sub

Public Sub SLSD_AIVB_Edit(control As IRibbonControl)
    SLSD_AIVB_Open "edit"
End Sub

Private Function Ask(ByVal verb As String, ByVal path As String, ByVal body As String) As String
    Dim h As Object
    Set h = CreateObject("WinHttp.WinHttpRequest.5.1")
    h.SetTimeouts 1500, 1500, 1500, 2500
    h.Open verb, SERVICE & path, False
    h.SetRequestHeader "X-AIVB-Client", "1"
    If verb = "POST" Then h.SetRequestHeader "Content-Type", "application/json"
    h.Send body
    If h.Status = 200 Then Ask = h.ResponseText
End Function

Private Function JsonText(ByVal s As String) As String
    s = Replace(s, "\", "\\")
    s = Replace(s, """", "\""")
    JsonText = """" & s & """"
End Function

Private Sub SLSD_AIVB_Open(ByVal view As String)
    Dim doc As String, r As String, id As String, st As String, t As Single, p As Long
    On Error Resume Next
    If Presentations.Count > 0 Then doc = ActivePresentation.FullName
    Err.Clear
    r = Ask("POST", "/api/bridge/open", "{""view"":" & JsonText(view) & ",""doc"":" & JsonText(doc) & "}")
    If Err.Number <> 0 Or Len(r) = 0 Then
        On Error GoTo 0
        MsgBox "AI Visual Builder is not running on this PC." & vbCrLf & vbCrLf & _
               "Start it with ""Restart AI Visual Builder"" (or sign out and in again), then press the button again.", _
               vbInformation, "SL Smart Design"
        Exit Sub
    End If
    p = InStr(r, """id"": """)
    If p = 0 Then Exit Sub
    id = Mid$(r, p + 7, 16)
    ' wait up to 3 s for the AI Visual Builder of this presentation to open its task pane
    t = Timer
    Do While Timer - t < 3
        DoEvents
        Sleep 100
        st = Ask("GET", "/api/bridge/status?id=" & id, "")
        If InStr(st, """acked"": true") > 0 Then Exit Sub
    Loop
    If InStr(st, """taken"": true") > 0 Then Exit Sub        ' it took the request and is opening
    FirstOpen view
End Sub

' The AI Visual Builder has not run in this presentation yet: its own ribbon command starts it (once per presentation).
Private Sub FirstOpen(ByVal view As String)
    Dim folder As String, script As String
    folder = GetSetting("AIVisualBuilder", "Install", "Path", "")
    script = folder & "\open-panel.ps1"
    If Len(folder) = 0 Or Len(Dir(script)) = 0 Then
        MsgBox "Open AI Visual Builder once in this presentation from Home > AI Visual Builder > Generate visuals;" & vbCrLf & _
               "after that, this button opens it directly.", vbInformation, "SL Smart Design"
        Exit Sub
    End If
    Shell "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & script & """ -View " & view, vbHide
End Sub
