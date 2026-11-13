# SL Smart Design V10.20.1 — attended PowerPoint checks (Track 2)

Everything below needs an unlocked desktop and real PowerPoint. None of it has been done yet.
Unattended checks already passed: `python local-ai/tests/test_slsd.py` (132) plus the full `run_tests.py` suite.

## 0. Switch this PC (PowerPoint closed, about 2 minutes)
1. `local-ai\Restart AI Visual Builder.bat`. The panel host must serve 10.20.1: open
   https://localhost:44317/slsd.js in a browser and expect JavaScript, not "Not found".
2. `powershell -ExecutionPolicy Bypass -File local-ai\sl-smart-design\switch-slsd.ps1 -Action Activate`.
   Note the backup folder it prints.
3. Start PowerPoint and open `C:\Users\SLI15795\Downloads\LVC_Template.pptx`.

If anything below fails badly, close PowerPoint and run
`switch-slsd.ps1 -Action Rollback`. That restores the V10.20 state exactly.

## 1. Ribbon
- [ ] Exactly one **SL Smart Design** tab, with the groups Design | SL Templates | Miscellaneous | Shape Rename.
- [ ] **Home** has no AI Visual Builder group.
- [ ] The SL Animation and SL Design tabs are present and unchanged.
- [ ] If PowerPoint says the add-in could not load, note the exact message (it may be a manifest schema detail) and roll back.

## 2. AI Visual Builder (first click)
- [ ] In a **fresh** PowerPoint session, click SL Smart Design → AI Visual Builder once. The task pane opens.
- [ ] Repeat in a new blank presentation (Ctrl+N, unsaved), then in a saved one, then with 2 presentations open (each opens its own pane).
- [ ] Close the pane and click again: it reopens.
- [ ] Generate visuals → preview → Insert. Then Edit a visual, Undo (Ctrl+Z), Several slides.

## 3. Alternative Design
On a content slide with a text box holding N points (one per line), click **Alternative Design**:
- [ ] N = 2, 3, 4, 5, 6, 7, 8, 9, 10: the Select Template window shows thumbnails (never an empty frame).
- [ ] Pick one → OK: the template replaces the text, the points fill Text_1..Text_N, the window closes, shapes stay editable.
- [ ] Cancel (close the window): the text box is back in its place with its own name (Selection Pane).
- [ ] 11 points, 1 point, Shift+Enter breaks, points in separate boxes, an empty slide: a short explanation; no empty gallery.
- [ ] Two text boxes with points: asks you to select one. Select one, then click again: it uses that box.
- [ ] Repeat once with an unsaved presentation.

## 4. Original SL Smart Design commands
- [ ] Add Footer Note, Add Blue Codebox, Add Black Codebox, Add Footer Info, Add Problem Solution, Add Problem Solution Image.
- [ ] Remove Animations, Delete Empty Boxes (on a copy of a deck).
- [ ] Shape Rename → Text and Heading, on selected shapes and on a group.
- [ ] The first click after PowerPoint starts works (it takes a moment while the add-in loads).

## 5. Persistence and security
- [ ] Restart PowerPoint: everything above is still there. Restart Windows: the panel host starts and the tab works.
- [ ] Cisco Secure Endpoint: no new notification during the whole test.
  If one appears, stop and write down the process, file and rule name (no content) for IT.
- [ ] `switch-slsd.ps1 -Action Status` shows the manifest-slsd.xml registration and "tab hidden: True".

## 6. Record the results
Write pass/fail for each item into `PROJECT-STATUS.md` (V10.20.1 section), then move on to the installer (Phase 7).
