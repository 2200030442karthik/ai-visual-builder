# SL Smart Design (with AI Visual Builder): IT deployment guide

Package status: **STAGING**. It has been tested in isolated staging on the development PC. It has **not** been
validated by IT, by Microsoft 365 Centralized Deployment, or on a second PC.

## Package layout

| Path | Content |
|---|---|
| `SL Smart Design\` | Per-user installer: `Install SL Smart Design.bat` (no admin rights) and the scripts it uses. |
| `SL Smart Design\runtime\` | Python 3.14.7 embeddable (signed by the Python Software Foundation) and the `anthropic` SDK. |
| `SL Smart Design\app\` | Local HTTPS panel host and AI Visual Builder panel. The committed configuration; no keys. |
| `SL Smart Design\slsd\SL_Smart_Design_v2_Key_Dec_25.ppam` | The company add-in with only its own ribbon tab hidden. Every other part (VBA, forms, licence check) is byte-identical to the original; the build checks this. |
| `SL Smart Design\templates\` | Only when built with `-IncludeTemplates`: the template library, installed only where files are missing. |
| `SL Smart Design\admin-config.json` | AI settings. Shipped with `paid_policy: never` (paid AI off until approved). |
| `IT\manifest-slsd.xml` | Add-in manifest (Id `2f01d600-c9ec-4d94-ade9-69b8b6f0bfa7`, `https://localhost:44317`). |
| `IT\deployment.example.json` | Registration choice for the installer. |
| `SHA256.txt` | Checksum of the zip. |

## Choose the registration (copy `deployment.example.json` to `SL Smart Design\deployment.json`)

### A. Microsoft 365 Centralized Deployment: `"registration": "Central"`
1. Microsoft 365 admin center > Settings > Integrated apps > Upload custom apps > Office Add-in > upload
   `IT\manifest-slsd.xml`. Assign it to the pilot users.
2. Run the installer on each PC. It installs the panel host, certificate, add-in and templates, and registers
   nothing for the web add-in.
3. **To be verified by IT (not tested):**
   - whether the admin center accepts a manifest whose URLs are `https://localhost:44317` (each PC serves its own
     panel);
   - how long assignment takes to reach the users;
   - that the tab appears without a user step.

   If localhost is not accepted, the panel files must be hosted on an organisation HTTPS host and the manifest
   rebuilt: `python local-ai/sl-smart-design/make_manifest_slsd.py --id 2f01d600-c9ec-4d94-ade9-69b8b6f0bfa7 --base https://<host>`.

### B. IT-approved shared catalog: `"registration": "Catalog", "catalog_url": "\\\\server\\share"`
1. IT provides a read-only share holding **only** `IT\manifest-slsd.xml`. The installer never creates shares.
2. Either register the share as a Trusted Add-in Catalog by Group Policy (Office: Trust Center > Trusted Catalogs),
   or let the installer write its own subkey
   `HKCU\Software\Microsoft\Office\16.0\WEF\TrustedCatalogs\{EEBC6074-F7DB-4E1A-A3DC-BC2784D4BF34}`
   (Id, Url, Flags = 1). Nothing else is changed.
3. Each user once: Home > Add-ins > Advanced… > SHARED FOLDER > SL Smart Design > Add.
   Verified on the development PC on 13 and 16 Nov 2026: the tab then appears at every PowerPoint start.

The developer registration (`WEF\Developer`) is for testing only. With it, PowerPoint shows the ribbon only after
the add-in is opened from Home > Add-ins in each session.

## What the installer changes (and restores on failure, Rollback, Uninstall)

The program folder is `%LOCALAPPDATA%\Programs\SLSmartDesign`. Outside it, only:
- `%APPDATA%\Microsoft\AddIns\SL_Smart_Design_v2_Key_Dec_25.ppam` (replaced by the tab-hidden copy);
- `HKCU\…\PowerPoint\AddIns\SL_Smart_Design_v2_Key_Dec_25` (Path, AutoLoad, only if missing);
- `HKCU\…\PowerPoint\AddIns\SLSD_AIVisualBuilder` (V10.20 leftover: removed);
- `WEF\Developer` values: this product's Id (Developer mode only) and the old pilot's Id (removed);
- its own TrustedCatalogs subkey (Catalog mode);
- the old pilot's autostart shortcut (removed);
- its own autostart shortcut and Apps & features entry;
- its own localhost certificate (current user, after the user's Yes);
- `%ProgramData%\AIVisualBuilder\access.json`, only if no policy exists;
- missing template files.

Everything is backed up first (`backups\<time>`, plus `backups\baseline` from before the first installation).
Other add-ins, shared Office keys and the Office cache are never touched.

## Approval checklist

| # | Item | Owner | Status |
|---|---|---|---|
| 1 | Registration method A or B, and the share for B | IT | open |
| 2 | Distribution of the tab-hidden SL Smart Design add-in copy (VBA unchanged) | SL Smart Design owner | open |
| 3 | Licence renewal: the add-in stops Alternative Design after **31 Dec 2026** | SL Smart Design owner | open |
| 4 | Distribution of the template library in the package (`-IncludeTemplates`) | SL Smart Design owner | open |
| 5 | Local HTTPS service (pythonw.exe, localhost only) and per-user localhost certificate | IT security | open |
| 6 | COM automation from the panel host into PowerPoint: `Application.Run` of the 11 original SL Smart Design macros only | IT security | open |
| 7 | Cisco Secure Endpoint review of the panel host (no alerts seen during testing) | IT security | open |
| 8 | Paid AI: `paid_policy` (shipped `never`) and the organisation keys (administrator key file) | Budget owner | open |
| 9 | Pilot on a second PC (the manager's) after items 1–7 | IT + project | not started |
