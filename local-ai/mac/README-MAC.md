# SL Smart Design on a Mac (10.21)

**Status: prepared, not yet tested on a Mac.** The Windows build is unchanged.

## What works on a Mac
- **AI Visual Builder** (the panel, built-in visuals, design packs, same-slide insertion, alternative designs, icons) uses
  Office.js only, so it works in PowerPoint for Mac as it does on Windows.
- **SL Smart Design commands** (Alternative Design, SL Templates, Miscellaneous, Shape Rename) are the company's VBA.
  On Windows the unified tab runs them through the local service (COM). A Mac has no COM, so on a Mac those buttons
  show a short notice: *use the SL Smart Design add-in's own tab* (its VBA works on Mac). The service also refuses
  them on macOS. Licensing is not touched.

## Set up (per user, no administrator rights)
1. Copy the `local-ai` folder to the Mac (for example `~/SLSmartDesign/local-ai`). Leave out `config.json` if it holds keys.
2. In Terminal: `bash ~/SLSmartDesign/local-ai/mac/setup-mac.sh`
   - It creates a certificate for `https://localhost` in `~/Library/Application Support/AIVisualBuilder`. macOS asks
     for your password **once** to trust it in your login keychain. This is a visible step you approve.
   - It starts the service (`python3 server.py`) now and at log-in. Use `-n` to skip the log-in item.
   - It copies `manifest-slsd.xml` into PowerPoint's sideload folder
     (`~/Library/Containers/com.microsoft.Powerpoint/Data/Documents/wef`).
3. Quit and restart PowerPoint. Then open **Home › Add-ins** (or **Insert › Add-ins › My Add-ins**) › **SL Smart Design**.

To undo everything: `bash setup-mac.sh --remove`

## Requirements and limits
- PowerPoint for Mac (Microsoft 365, version 16.x), `python3`, and `openssl` (both ship with macOS or the Xcode
  command line tools).
- Paid AI stays governed by the same `access.json` policy. On a Mac it is read from
  `~/Library/Application Support/AIVisualBuilder/access.json`.
- If the original SL Smart Design add-in is also loaded, a Mac shows both tabs. That is expected.
- For IT-managed rollout, use Microsoft 365 Centralized Deployment with a central HTTPS host. Sideloading is for
  pilots only.
