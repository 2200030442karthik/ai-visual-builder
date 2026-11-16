# SL Smart Design (with AI Visual Builder) — installer architecture

Status: **design, ready for IT review. Not built and not deployed.** The manager's PC has not been touched.
Version: V10.20.1, 16 Nov 2026.

## 1. What has to be installed on each PC

| Component | What it is | Where it goes | Admin rights? |
|---|---|---|---|
| A. Panel host | Local HTTPS service (Python, bundled runtime) on `https://localhost`. It serves the AI Visual Builder panel and runs the SL Smart Design commands. | `%LOCALAPPDATA%\Programs\…`, starts at sign-in | No |
| B. Localhost certificate | Created on the PC and trusted for the current user only. Office loads add-ins only over HTTPS. | Current user's certificate store | No (Windows asks once) |
| C. SL Smart Design VBA add-in | The company add-in, **with its own tab hidden**. VBA, forms and the licence check are byte-identical to the original. | `%APPDATA%\Microsoft\AddIns` + its PowerPoint AddIns key | No |
| D. Template library | About 1,200 Alternative Design templates. Installed only if missing; never overwritten. | `%LOCALAPPDATA%\Microsoft\SLSD\Templates` | No |
| E. Web add-in registration | The manifest that shows the one **SL Smart Design** tab. **IT chooses the method: see section 2.** | — | Depends on the method |
| F. AI service keys | Napkin / Claude organisation keys from the administrator's key file. Users are never asked. | Current user's data folder (DPAPI) | No |

Components A, B, F, update with automatic rollback, autostart and uninstall already exist in the tested pilot
installer (`deploy/manager-pilot`). The unified installer adds C, D and E to it.

## 2. Registration of the web add-in (component E): an IT decision

Tested on 13 Nov 2026: with the developer registry key used so far, PowerPoint shows the add-in's ribbon only after
the user opens it from Home > Add-ins, **in every session**. That is not acceptable for production.

### Option 1: Microsoft 365 Centralized Deployment (recommended)
- IT uploads `manifest-slsd.xml` in the Microsoft 365 admin center (Settings > Integrated apps > Upload custom apps >
  Office Add-in) and assigns it to the users or group.
- Users get the SL Smart Design tab automatically. There is no per-user step and no registry change.
- The installer then installs A–D and F only.
- **Open questions for IT:**
  1. Does the admin center accept a manifest whose URLs point to `https://localhost:44317`? Each PC serves its own
     panel. If not, the panel files must be hosted on an organisation HTTPS host. The manifest generator supports this:
     `python make_manifest_slsd.py --base https://<host>`.
  2. The ribbon icons are expected to render there. On this PC, with a self-signed localhost certificate, they show as
     generic icons. That is cosmetic and not yet resolved.
  3. Manifest updates need admin re-approval in the admin center.

### Option 2: IT-approved shared catalog
- IT provides a read-only network share holding **only** `manifest-slsd.xml`, for example `\\fileserver\SLSDCatalog`.
- The share is registered as a Trusted Add-in Catalog. Two ways:
  - **Group Policy** (Office administrative templates: Trust Center > Trusted Catalogs). This is preferred.
  - **The installer:** one registry subkey of its own, `HKCU\…\WEF\TrustedCatalogs\{5D7F6C1E-…}`. This is what
    `switch-slsd.ps1 -Registration Catalog` does today, with exact rollback.
- **Each user adds it once:** Home > Add-ins > Advanced… > SHARED FOLDER > SL Smart Design > Add.
  Verified 13 and 16 Nov 2026: the tab then appears at every PowerPoint start.
- Caveat (verified 16 Nov 2026): if Office's add-in cache for this add-in is cleared, the user must Add it once more.
- The installer never creates network shares. The share and its permissions are IT's.

### Not for production
- The developer key (`WEF\Developer`). It is kept only for development and rollback.

## 3. Installer flow (per user, no administrator rights)

1. **Checks:** 64-bit Windows, PowerPoint desktop, and the licensed SL Smart Design add-in present (it is never
   replaced by an unlicensed copy).
2. **Backup:** the current add-in files and the registry values this installer will change go to
   `%LOCALAPPDATA%\SLSmartDesign\rollback\<time>`.
3. **Components:** install A, B, C, D and F (sections 1 and 4).
4. **Register (E)** according to `-Registration Central | Catalog -CatalogUrl \\server\share`:
   - Central: nothing on the PC.
   - Catalog: the catalog subkey only.
5. **Remove the V10.20 leftovers:** the "SL Smart Design AI" VBA add-in key and the old developer registration of
   this Id only. Other add-ins are never touched; no shared Office key is recreated (regression-tested).
6. **Start and verify:** the panel host answers over HTTPS with normal certificate checking. If not, roll back
   automatically.
7. **Tell the user the one remaining step**, if any (Catalog: Add once).

**Uninstall / rollback:** restore the backup of step 2 exactly (`switch-slsd.ps1 -Action Rollback` logic), stop and
remove the panel host, remove the certificate. The template library is left in place.

## 4. Approvals needed before building the package

| Item | Who |
|---|---|
| Registration option 1 or 2 (and the share for option 2) | IT |
| Distributing the SL Smart Design copy with its tab hidden (VBA untouched) | SL Smart Design owner |
| **Licence:** the installed add-in stops Alternative Design after **31 Dec 2026**. A new licence build is needed for 2027. | SL Smart Design owner |
| Local HTTPS service and per-user localhost certificate | IT / security |
| COM automation from the panel host into PowerPoint (`Application.Run` of the 11 original macros only, fixed list) | IT / security |
| Cisco Secure Endpoint: no alerts were seen in testing on 13 or 16 Nov. A review of the panel host (pythonw.exe) is advisable. | IT / security |
| Paid AI use: with the current settings, Generate visuals sends a Napkin request **without asking** (`paid_policy: when-needed`). Confirm or change. | Budget owner |

## 5. What is verified, what is not

Verified in real PowerPoint on this PC (13 and 16 Nov 2026), with the catalog registration:
- one SL Smart Design tab; no AI Visual Builder entry on Home; still present after restarting PowerPoint;
- AI Visual Builder opens on the first click;
- Alternative Design with 2–10 points, a misnamed template, cancel, and unsupported content;
- all 10 other original commands;
- AI generate, insert, Edit a visual, Several slides, and Undo last insert.

Not verified:
- the installer itself (not built);
- Centralized Deployment;
- a second PC;
- the ribbon icons;
- grouped Ctrl+Z after Edit a visual (it took 19 presses; the panel's own "Undo last edit" is the supported path).
