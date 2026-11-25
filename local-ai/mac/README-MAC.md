# SL Smart Design on a Mac (10.21.1)

**Status: prepared, NOT yet tested on a Mac.** Nothing below has run on macOS. It was checked on Windows only: shell
syntax, path logic, and unit tests that simulate macOS. The Windows build is unchanged.

## What works where

| Part | Windows | Mac | Why |
|---|---|---|---|
| AI Visual Builder panel: Generate, gallery, insert, edit, same-slide fit | yes, tested | expected to work, untested | Office.js only; PowerPoint for Mac supports the same APIs (PowerPointApi 1.4+; line pictures need 1.10) |
| Large gallery window (Office dialog) | yes | expected, untested | Office.js dialog API |
| Local service (`server.py`, HTTPS on localhost) | yes | expected, untested | standard Python; data and policy paths are Mac-aware (`~/Library/Application Support/AIVisualBuilder`) |
| SL Smart Design commands from the **unified** tab (Alternative Design, SL Templates, Miscellaneous, Shape Rename) | yes (COM `Application.Run`) | **no by default.** The tab says to use the SL Smart Design add-in's own tab. Opt-in AppleScript bridge, untested (below) | COM does not exist on macOS |
| SL Smart Design add-in's **own** tab (VBA) | yes | the company add-in's VBA is expected to run there; not verified by us | VBA runs on PowerPoint for Mac; Windows-only calls inside the company code (if any) are unknown |
| Numbered Select Template gallery (`patch_altdesign.py`) | built, real-PowerPoint test pending | untested | MSForms on Mac support `WithEvents` on dynamic controls less reliably; check before rolling out |
| Installer (`Install.ps1` …), restart / rollback scripts | yes, tested | **no.** Use `setup-mac.sh` | PowerShell, registry, Windows certificate store |
| "AI Visuals" button helper (`open-panel.ps1`) | yes | **no** | Windows UI Automation |
| Shared-folder catalog registration | yes | **no.** Mac sideloads from the `wef` folder | Windows Trust Center catalog |
| Template library path (`%LocalAppData%\Microsoft\SLSD\Templates`) | yes | the company VBA decides; Mac has no `%LocalAppData%` | inside the company add-in |

## Set up (per user, no administrator rights)
1. Copy the `local-ai` folder to the Mac, for example `~/SLSmartDesign/local-ai`. Leave out `config.json` if it holds
   keys.
2. In Terminal, run `bash ~/SLSmartDesign/local-ai/mac/setup-mac.sh`. It does three things:
   - Creates a certificate for `https://localhost` in `~/Library/Application Support/AIVisualBuilder`. macOS asks for
     your password **once** to trust it in your login keychain. This is a visible step you approve.
   - Starts the service (`python3 server.py`) now and at log-in. Use `-n` to skip the log-in item.
   - Copies `manifest-slsd.xml` into PowerPoint's sideload folder
     (`~/Library/Containers/com.microsoft.Powerpoint/Data/Documents/wef`).
3. Quit and restart PowerPoint, then open **Home › Add-ins** (or **Insert › Add-ins › My Add-ins**) › **SL Smart Design**.

To undo everything, run `bash setup-mac.sh --remove`.

## Optional: run the SL Smart Design commands from the unified tab (opt-in, untested)
Set `"mac_vba_bridge": true` in `config.json`, then restart the service. The service then asks PowerPoint for Mac,
through AppleScript (`run VB macro`), to run the **same allow-listed macros** in the loaded SL Smart Design add-in. The
licence check stays in that add-in. macOS asks once to allow the automation (System Settings › Privacy & Security ›
Automation). If PowerPoint for Mac refuses the macro name form `<add-in>.ppam!Module1.<macro>`, the command shows that
reason and the add-in's own tab still works. **Test this on a Mac before enabling it for anyone.**

## Requirements and limits
- PowerPoint for Mac (Microsoft 365, version 16.x), `python3` and `openssl`. Both ship with macOS or the Xcode command
  line tools.
- Paid AI stays governed by the same `access.json` policy. On a Mac it is read from
  `~/Library/Application Support/AIVisualBuilder/access.json`.
- If the original SL Smart Design add-in is loaded with its own tab visible, a Mac shows both tabs.
- For IT-managed rollout, use Microsoft 365 Centralized Deployment with a central HTTPS host. Sideloading is for pilots
  only.
