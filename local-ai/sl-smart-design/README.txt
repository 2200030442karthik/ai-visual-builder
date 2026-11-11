AI VISUAL BUILDER ON THE SL SMART DESIGN RIBBON (V10.15)
=========================================================
Goal: an "AI Visuals" button beside "Alternative Design" (SL Smart Design tab, group "Design") that opens the AI
Visual Builder panel. It is a split button: click it to generate visuals; its arrow also offers Several slides and
Edit a visual.

WHY IT WORKS THIS WAY
- SL Smart Design is a VBA add-in (.ppam) with its own ribbon tab. AI Visual Builder is an Office web add-in. Office
  does not let a web add-in place buttons on another add-in's tab, and gives VBA no command to open a web add-in's
  panel. So the new button runs a small VBA macro, which starts local-ai\open-panel.ps1; that script presses AI Visual
  Builder's own "Generate visuals" button (Home tab) through Windows UI Automation and brings the SL Smart Design tab
  back. The presentation is never read or changed by it.
- The AI Visual Builder group on the Home tab stays: it is the button the script presses, and the entry on PCs that do
  not have SL Smart Design.

FILES HERE
  AIVisualBuilder.bas         the VBA module with the three button callbacks (AIVB_Generate, AIVB_Slides, AIVB_Edit)
  customUI-addition.xml       the ribbon lines (a splitButton) that go after the Alternative Design button
  add-to-sl-smart-design.ps1  writes a COPY of an SL Smart Design file with those ribbon lines added (no VBA change)

STEPS (for whoever maintains SL Smart Design; about 5 minutes)
1. On each PC: run "Install V10 add-in.bat" (local-ai folder) once more. Besides the add-in, it records where
   open-panel.ps1 is (registry: HKCU\Software\VB and VBA Program Settings\AIVisualBuilder\Install, Path).
2. Take the SL Smart Design SOURCE file - the macro-enabled presentation (.pptm) the .ppam is saved from
   (e.g. SL_Smart_Design_v2_Key_Dec_25.pptm). A .ppam cannot be edited in the VBA editor.
3. Add the ribbon lines to a copy of it:
     powershell -ExecutionPolicy Bypass -File add-to-sl-smart-design.ps1 -Source "C:\path\SL_Smart_Design_v2_Key_Dec_25.pptm"
   This writes SL_Smart_Design_v2_Key_Dec_25-AIVB.pptm next to it (the original is not changed). (Or paste
   customUI-addition.xml by hand with the Office RibbonX Editor, after the Template_Button1 line.)
4. Open the -AIVB.pptm copy in PowerPoint, press Alt+F11, File > Import File... > AIVisualBuilder.bas, then save.
5. File > Save As > PowerPoint Add-in (*.ppam), and deploy that .ppam the way SL Smart Design is deployed today
   (replace the old one; in PowerPoint: File > Options > Add-ins > Manage: PowerPoint Add-ins > Go, unload/load).
6. Check: SL Smart Design tab > AI Visuals opens the AI Visual Builder panel and the SL Smart Design tab stays shown.

IF THE BUTTON SAYS ...
- "AI Visual Builder is not installed on this PC": step 1 was not run on this PC.
- "... button was not found on the Home tab": the add-in is not installed or not loaded yet; open it once from
  Home > AI Visual Builder, then the SL Smart Design button works.

CHECK WITHOUT PRESSING ANYTHING
  powershell -ExecutionPolicy Bypass -File ..\open-panel.ps1 -List      (lists PowerPoint's ribbon tabs)
