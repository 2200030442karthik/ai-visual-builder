SL SMART DESIGN - ONE TAB, BOTH DESIGN TOOLS (V10.20.1, 13 Nov 2026)
=====================================================================
This section supersedes the V10.15-V10.20 notes below (kept for history and rollback).

WHAT CHANGED AND WHY
- V10.20 put AI Visual Builder on the SL Smart Design tab as a VBA button that asked the web add-in to open its panel.
  That cannot work on the first click in a fresh presentation by any supported means (Microsoft documentation, Sep
  2026): a web add-in's runtime is not running until the add-in is opened in that presentation;
  Office.addin.setStartupBehavior is per document and needs one manual open first; OnDocumentOpened needs admin
  deployment in the Microsoft 365 admin center and its handler may not show UI. The V10.20 fallback pressed the
  Home-tab button through Windows UI Automation, started from VBA as a hidden "powershell -ExecutionPolicy Bypass"
  (the pattern endpoint security watches for).
- V10.20.1 turns it around: the SL Smart Design tab belongs to the AI Visual Builder web add-in (manifest-slsd.xml).
    AI Visual Builder         a ShowTaskpane button: Office opens the real task pane on the first click, every time.
    Alternative Design,       functions of the add-in (slsd.js) that ask the panel host (server.py /api/slsd/run,
    SL Templates (6),         a fixed list) to run the ORIGINAL macro of the SL Smart Design VBA add-in through
    Miscellaneous (2),        PowerPoint's documented Application.Run (slsd_com.py, ctypes, no new process, no
    Shape Rename (2)          PowerShell). Licence check, Select Template window and template library unchanged.
  The SL Smart Design VBA add-in stays installed (its macros are needed) with its own tab hidden: a copy made by
  make_unified_slsd.py --hide-tab (only visible="false" changes; VBA project byte-identical, checked).
- Alternative Design's blank gallery (traced, LVC_Template.pptx): the original window takes the BOTTOM-MOST shape of
  the slide as the content (RenamePlaceholder). On LVC slides that is an empty body placeholder, a group or a
  background shape, so it counts 0 or 1 points, looks in 0_point / 1_point (which do not exist) and shows an empty
  frame. The thumbnails are fine (all 1,198 load; checked with Windows' own picture loader). Now slsd.js first finds
  the content (the selected text box, else the one text box with 2-10 points, else the content placeholder), checks
  the number of points exactly as the original counts them, explains in plain words when it cannot be used (1 point,
  11+ points, Shift+Enter breaks, points in separate boxes, nothing selected among several), and sends the content to
  the back so the original window reads it. If the window is cancelled, the shape's place and name are restored.

FILES
  ../manifest-slsd.xml        the ribbon (written by make_manifest_slsd.py; do not edit by hand)
  ../slsd.js                  the tab's functions, Alternative Design preparation
  ../slsd_com.py              Application.Run through COM (standard library)
  ../slsd-notice.html         the short message window
  make_icons.py               the tab's icons (assets/slsd)
  make_unified_slsd.py        --hide-tab: the SL Smart Design copy with its own tab hidden
  switch-slsd.ps1             Activate / Rollback / Status on this PC (backs up first; only its own values)
  ../tests/test_slsd.py       unattended checks (132), incl. tests/slsd.html in headless Edge

SWITCH THIS PC (PowerPoint closed)
  1. Restart AI Visual Builder.bat            (the panel host must serve the new files)
  2. powershell -ExecutionPolicy Bypass -File switch-slsd.ps1 -Action Activate
  3. Start PowerPoint: one SL Smart Design tab: Design | SL Templates | Miscellaneous | Shape Rename; nothing on Home.
  Back:   powershell -ExecutionPolicy Bypass -File switch-slsd.ps1 -Action Rollback   (restores the V10.20 state)
  Check:  powershell -ExecutionPolicy Bypass -File switch-slsd.ps1 -Action Status

KNOWN LIMITS
- The SL Smart Design commands need the panel host running (it starts with Windows); if it is not, the buttons say so.
- The Select Template window itself is the company's VBA form: unchanged (its source .pptm and the owner's approval are
  needed to restyle it).
- LICENCE: the installed SL Smart Design add-in stops Alternative Design after 31 Dec 2026 ("License expired"). Only the
  SL Smart Design owner can issue an updated add-in; nothing here changes the licence check.


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
