# SL Smart Design unified installer: test report (16 Nov 2026)

Package: `SLSD_Unified_Package\SL-Smart-Design-10.20.1-staging.zip`. The checksum is in `SHA256.txt` next to the zip.
Status: **STAGING.**

## Automated, isolated (`deploy/tests/test_slsd_installer.py`): 52 of 52 passed

All scenarios ran the real package scripts against an isolated environment:
- registry root `HKCU\Software\SLSD-InstallerTest`;
- temporary add-ins, templates and data folders;
- instance `SLSDInstallerTest`, port 44347;
- the trusted localhost certificate reused read-only.

The live development setup of this PC was verified unchanged afterwards. No paid AI request was possible: the package
ships `paid_policy: never`, and the only key used was a fake, disabled one.

| Area | Checks |
|---|---|
| Package | One versioned staging zip; SHA256 matches; all required files; no keys, certificates, usage data, add-in source or licence file; paid AI off; the app config is the committed one; labelled staging. |
| Refusals before any change | Download-marked package (asks for Unblock; never removes the mark); Catalog without a share path; SL Smart Design (licence) not installed; development setup registered (would duplicate the tab). The state was unchanged afterwards. |
| Fresh install (Catalog) | Panel host over HTTPS with normal certificate checking; serves the tab code; manifest Id and port; own trusted-catalog entry; old pilot (Home group) and V10.20 add-in retired; unrelated web add-in, catalog and SL Animation untouched; licensed add-in replaced by the tab-hidden copy and still loaded; missing templates added, an existing company template not overwritten; existing AI key kept; `Verify.ps1` passes. |
| Update (Developer registration) | Succeeds over the installed version; registration switched; previous version kept; service running; AI key kept. |
| Simulated failure during an update | Exit 1; add-ins, registry and templates restored exactly; the version that worked is running again. |
| Manual Roll back | Registrations and files back to the first installation; previous version running; a second Roll back refuses. |
| Uninstall | Registry and add-in files exactly as before the first install (original licensed add-in back); program folder removed; service stopped; data and templates kept. |
| Simulated failure on a fresh install | Registry and add-ins restored exactly; no program, service or Apps entry left. |
| Reinstall (Central) | Succeeds; nothing registered on the PC for the web add-in; `Verify.ps1` passes; final uninstall restores the original state. |

**Defect found and fixed by these tests:** a failed installation moved the "last installation" pointer, so a later
Roll back undid the wrong step. Now the pointer is written only on success, and a failed run deletes its own backup.

## Application regression (unchanged app; manifest generator gained `--id`)
- `local-ai/tests/test_slsd.py`: 151 passed, 1 skipped (that check needs PowerPoint closed).
- `local-ai/tests/test_v10_20.py`: passed.

## Real PowerPoint
- **Application:** verified on 13 and 16 Nov 2026 with the development registration. See `PROJECT-STATUS.md`.
- **The installed package in real PowerPoint: NOT yet verified.** On this PC it would show a second tab beside the
  development setup, which the installer refuses. A real-PowerPoint check of the package needs either:
  - this PC after `switch-slsd.ps1 -Action Rollback` (removes the development registration), or
  - a separate Windows test account or PC, with the licensed SL Smart Design installed.
- **Microsoft 365 Centralized Deployment, an IT share catalog, a second PC:** pending IT.
