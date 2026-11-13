# AI Visual Builder — team pilot: hosting, sign-in and installation (V10.18)

**Status (12 Nov 2026):** the code for a hosted pilot is in place and tested on one Windows PC (hosted mode,
access checks, manifest generation). **Nothing is deployed yet.** A hosted pilot needs three things from IT that
this project cannot create on its own: an Azure web app, a Microsoft Entra app registration, and a Microsoft 365
admin to deploy the add-in to the pilot users. Until then, AI Visual Builder runs only on the PC where its local
server runs (see `local-ai/README-V10.txt`).

## 0. Single-PC pilot for the manager (available now, no IT needed)
Until the hosted service exists, `deploy/build-manager-package.ps1` builds `Manager_Pilot_Package/`. It holds the
full desktop version as one zip with its own Python runtime and a per-user installer: no administrator rights,
keys typed in at install time and a clean uninstall. See `deploy/manager-pilot/INSTALL-GUIDE.txt`. It runs entirely
on that PC (https://localhost:44317) and uses the keys entered there; nothing is shared between PCs.

## 1. Architecture

```
PowerPoint (Windows, Mac or web)               Azure (company subscription)
  task pane = the same Office.js panel   --->   App Service (Linux)  https://<name>.azurewebsites.net
  (loaded from the hosted URL;                    server.py in hosted mode (AIVB_HOSTED=1)
   Office single sign-on token on every             - serves the panel and its design packs
   request)                                         - checks the Entra sign-in token and the allowed users/roles
                                                    - per-user and per-day limits, usage counts
                                                    - calls Napkin / Claude with keys held only in the service
                                                  Key Vault: NAPKIN_API_KEY, ANTHROPIC_API_KEY
                                                  Storage mounted at /data: usage, kept results, log
```

- **One code base.** The panel and its design engine are the same files as the local version. Hosted mode is a
  setting of `local-ai/server.py`. The local version (localhost:44317, Windows sign-in) is unchanged and remains
  the development and recovery copy.
- **No keys in the add-in.** The keys are app settings that reference Key Vault. They never reach the panel, the
  manifest or the logs, and `/api/status` never shows them (tested: `local-ai/tests/test_hosted.py`).
- **Restricted access.** Hosted mode refuses to start unless the access policy is `entra`. Only signed-in users who
  are in `allowed_users` or `allowed_groups`, or who have the app role `Visuals.Generate`, may generate.
- **Cost controls (existing, now per hosted service):**
  - `napkin_max_per_day` and `napkin_max_per_user_per_day`, and the same limits for Claude;
  - the 24-hour duplicate guard;
  - a kept result is reused for free;
  - `paid_policy` is `never`, `when-needed` or `always`;
  - `paid_engines` is 1 (the second service is only a fallback) or 2 (both services design every new text, at
    twice the cost).
- **One instance.** Usage counts and kept results are files in `/data`, so run the pilot on **one** instance (no
  scale-out) until they move to a shared store.

## 2. What IT needs to do (once)

1. **Entra app registration** "AI Visual Builder (Pilot)", single tenant.
   - Expose an API: Application ID URI `api://<host>/<client id>`, scope `access_as_user`; pre-authorize the
     Office clients (`ea5a67f6-b6f3-4338-b240-c655ddc3cc8e`, which covers all Office hosts).
   - App role `Visuals.Generate`, assigned to the pilot users or to a pilot group.
2. **Key Vault** with secrets `napkin-api-key` and `anthropic-api-key`.
3. **App Service** (Linux, Python 3.12, B1 is enough for a pilot), HTTPS only, minimum TLS 1.2, one instance.
   - Either deploy the container (`deploy/Dockerfile`, built from the repository root) or the code, with the
     startup command `python local-ai/server.py`.
   - App settings: see `deploy/app-settings.example.json`. Keys use Key Vault references, and the app's managed
     identity needs "Get" on the secrets.
   - Mount Azure Files storage at `/data`.
   - Upload the access policy to `/data/access.json` (from `deploy/access-pilot.example.json`, with the tenant and
     client ids filled in).
4. **Manifest:**
   `python deploy/make-pilot-manifest.py --url https://<host> --client-id <client id>` writes
   `deploy/out/manifest-pilot.xml`. It has its own add-in Id, so it can sit beside the local development add-in.
5. **Deploy to users:** Microsoft 365 admin center → Settings → Integrated apps → Upload custom apps → the pilot
   manifest → assign to the pilot group. It then appears in PowerPoint on Windows, Mac and the web for those users,
   usually within 24 hours.

## 3. Installing without an admin (individual testers)

- **Windows:** put `manifest-pilot.xml` in a shared network folder, add that folder as a Trusted Add-in Catalog
  (File → Options → Trust Center → Trusted Add-in Catalogs), restart PowerPoint, then go to Insert → My Add-ins →
  Shared Folder.
- **Mac:** copy `manifest-pilot.xml` to `~/Library/Containers/com.microsoft.Powerpoint/Data/Documents/wef/`
  (create the folder if needed), restart PowerPoint, then go to Insert → My Add-ins → the add-in.
- **PowerPoint on the web:** Insert → Add-ins → My Add-ins → Upload My Add-in → the manifest.

## 4. Windows / Mac / web compatibility

| Area | Windows (Microsoft 365) | Mac (Microsoft 365) | PowerPoint on the web | Evidence |
|---|---|---|---|---|
| Panel, Generate, gallery, hover preview | Works (used daily on Windows) | Expected: the same Office.js code | Expected | Windows: tested. Mac/web: **not tested** |
| Insert native shapes and text (PowerPointApi 1.5, required) | Works | 1.5 is in current Mac builds | 1.5 is available | Mac/web: **not tested** |
| Grouping and native tables (1.8, optional: without them, separate shapes) | Works | Recent builds only | Yes | Checked at run time (`isSetSupported`) |
| Slide-size detection (1.10, optional: 16:9 assumed) | Works | Recent builds only | Yes | Checked at run time |
| Large gallery dialog (Dialog API) | Works | Supported by Office on Mac | Supported | Mac/web: **not tested** |
| Office single sign-on (hosted pilot) | Supported | Supported | Supported | **Not tested** (no app registration yet) |
| Ribbon buttons (add-in commands) | Works (Home tab group) | Supported | Supported | Mac/web: **not tested** |
| Local server, `.bat`/`.ps1` setup and start scripts | Works | **Windows only** (replaced by the hosted service) | n/a | — |
| "AI Visuals" on the SL Smart Design tab (VBA + UI Automation) | Kit ready, not yet in SL Smart Design | **Not possible** (UI Automation is Windows-only); use the add-in's own ribbon group | n/a | — |

**Do not announce Mac support until a Mac tester has run the checklist in section 5 on a real Mac.**

## 5. Pilot acceptance checklist (each platform)

1. The add-in loads and the panel shows (no "Sorry, we can't load the add-in").
2. Sign-in: a pilot user can Generate; a user outside the pilot sees "not authorized".
3. Generate with the sample texts in `docs/DEMO-GUIDE.md` gives 15–24 designs, best first.
4. Hover preview, large gallery, insert, Undo, Several slides, Edit a visual.
5. Inserted visuals are editable: click a text and type, move a shape, ungroup.
6. Limits: after the per-user daily limit, a clear message appears and no request is sent.

## 6. Files

| File | Purpose |
|---|---|
| `local-ai/server.py` | the service (hosted mode: `AIVB_HOSTED=1`) |
| `deploy/Dockerfile`, `deploy/requirements.txt` | container image (Python 3.12, `anthropic` SDK) |
| `deploy/app-settings.example.json` | App Service settings (no secrets; Key Vault references) |
| `deploy/access-pilot.example.json` | access policy for the pilot (entra mode, roles, limits) |
| `deploy/make-pilot-manifest.py` | writes the pilot manifest for the hosted URL |
| `local-ai/tests/test_hosted.py` | checks hosted mode on a PC (no network, no keys) |
