# SL Smart Design installer: real PowerPoint validation checklist (V10.20.1 staging)

**Status: NOT RUN. Blocked: no authorized separate test environment (16 Nov 2026).**

On the development PC:
- the other user profiles belong to colleagues (not authorized for testing);
- the local accounts are administrator/system accounts;
- this account has no administrator rights (it cannot create a test user);
- Windows Sandbox is not installed.

The development setup was not changed.

## What the isolated tests (52/52) could not cover
1. PowerPoint loading the *product* manifest (Id `2f01d600-…`) through a real catalog or Microsoft 365, and showing
   exactly one SL Smart Design tab.
2. The installed tab-hidden add-in loading from `%APPDATA%\Microsoft\AddIns` with its macros enabled, and its licence
   check running as before.
3. The installed panel host (`%LOCALAPPDATA%\Programs\SLSmartDesign`, its own Python) running the original macros in
   PowerPoint through COM. In the tests the test host refuses COM by design.
4. The certificate Yes prompt on an account without a trusted localhost certificate. The tests reused one.
5. Autostart at Windows sign-in. The tests used `-NoAutostart`.
6. The real template library, a real downloaded zip (Unblock), uninstall from Settings > Apps, and Cisco Secure
   Endpoint's reaction to the installed service.

## Environment options (choose one; both need the owner's go-ahead)

**A. Dedicated test account or PC (preferred).** IT provides a test Windows account with Microsoft 365 PowerPoint and
SL Smart Design installed the usual way (licence activated). The development setup is not involved.

**B. This development PC, own account. Only with explicit approval; fully reversible.**
- Only the development tab registration is parked: one registry key, exported first.
- The development service keeps running on 44317; the package is installed on port **44318** with its own data folder
  (no AI keys, so paid AI is impossible).
- The catalog is a new folder on the PC's existing `D` share; no share is created.
- Snapshots before and after prove the exact restore.

## Procedure (B; for A skip steps 1, 3, 14 and use the defaults)

Use one PowerShell window in `D:\Karthik\ai-visual-builder-starter`, with PowerPoint closed throughout steps 1–5.

| # | Step | Pass criterion |
|---|---|---|
| 1 | `deploy\tests\capture-state.ps1 -Out C:\SLSDval\0-dev.json` | Snapshot written. |
| 2 | Extract `SLSD_Unified_Package\SL-Smart-Design-10.20.1-staging.zip` to `C:\SLSDval\pkg` | The folder `SL Smart Design` exists. |
| 3 | `deploy\tests\park-dev-registration.ps1 -Action Park`, then `capture-state.ps1 -Out C:\SLSDval\1-parked.json` | "Parked"; the only difference from 0 is the one catalog key. |
| 4 | `C:\SLSDval\pkg\SL Smart Design\Install.ps1 -Instance SLSmartDesign -Port 44318 -DataDir $env:LOCALAPPDATA\SLSmartDesignVal -Registration Catalog -CatalogUrl \\SL-DT-HD-017\D\Karthik\SLSD_Catalog_Product` | Answer **Yes** to the certificate. Exit 0; "running on https://localhost:44318". |
| 5 | Create `D:\Karthik\SLSD_Catalog_Product\` and copy `%LOCALAPPDATA%\Programs\SLSmartDesign\manifest-slsd.xml` into it (only that file). Then run `Check SL Smart Design.bat` | All PASS (the catalog check then passes too). |
| 6 | Start PowerPoint; open a **copy** of LVC_Template.pptx (Enable Editing). Home > Add-ins > Advanced… > SHARED FOLDER > SL Smart Design > Add | **Exactly one** SL Smart Design tab with Design / SL Templates / Miscellaneous / Shape Rename; **no** AI Visual Builder on Home; SL Animation and SL Design present. |
| 7 | AI Visual Builder (fresh session, first click) | The task pane opens. |
| 8 | Alternative Design on a 4-point content slide → select a template → Apply | The gallery is filled; the points are in the template; the window closes. Also a 1-point slide gives the message. |
| 9 | All 10 original commands (6 SL Templates, Remove Animations, Delete Empty Boxes, Shape Rename Text / Heading) | Each acts as in the 16 Nov test. |
| 10 | AI Visual Builder: Use text from the slide → **Generate visuals** → Insert → Edit a visual (change a label, Apply) → Undo last insert | 20+ built-in designs; **no Napkin/Claude request**: `%LOCALAPPDATA%\SLSmartDesignVal\server.log` has no `napkin create` / `claude create`. Native shapes; the edit applies; Undo removes the insert. |
| 11 | Close PowerPoint; start it again | The tab is there with no Add; the service still answers (`Check SL Smart Design.bat`). |
| 12 | Sign out of Windows and in again; `Check SL Smart Design.bat` | The service started by itself (autostart). |
| 13 | Close PowerPoint. `%LOCALAPPDATA%\Programs\SLSmartDesign\Uninstall SL Smart Design.bat` (or Settings > Apps > SL Smart Design), then `capture-state.ps1 -Out C:\SLSDval\2-after.json -Before…` (compare with 1-parked.json) | **Identical** to 1-parked; certificate removed; program folder gone. |
| 14 | `park-dev-registration.ps1 -Action Restore`; `capture-state.ps1 -Out C:\SLSDval\3-restored.json`; compare with 0-dev.json; start PowerPoint | **Identical** to 0-dev; the development tab is back and works. Delete `D:\Karthik\SLSD_Catalog_Product`. |

Rollback of an update (optional, after step 5): install the same package again (an update), then run `Roll back SL Smart Design.bat`.
Pass: `capture-state` equals the state after step 5.

Record the results (PASS / FAIL and notes) in `docs/SLSD-INSTALLER-TEST-REPORT.md`, under "Real PowerPoint".

## Stop rules
- Any Cisco Secure Endpoint alert: stop, note process / file / rule, run step 13 and 14, report to IT.
- Any difference in step 13 or 14 that is not explained: do not continue; keep the snapshots for analysis.
