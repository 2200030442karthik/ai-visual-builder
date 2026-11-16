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
- **The installed package in real PowerPoint: NOT RUN. Blocked (16 Nov 2026)** — no authorized separate test
  environment:
  - the other profiles on this PC are colleagues' accounts;
  - the local accounts are administrator/system;
  - this account cannot create users;
  - there is no Windows Sandbox.

  The development setup was not changed.
- **Prepared:** `docs/SLSD-REAL-PPT-VALIDATION.md` (14-step checklist with pass criteria, for a dedicated test account
  or, with approval, this PC on port 44318 with only the development tab registration parked).
  - `deploy/tests/capture-state.ps1`: read-only snapshot and compare, for exact-restore proof. Tested: two snapshots
    of the live setup compare identical.
  - `deploy/tests/park-dev-registration.ps1`: parks or restores the one development key. Mechanism proven on a scratch
    key; not run on the live key.
- **Pending IT:** Microsoft 365 Centralized Deployment, an IT share catalog, a second PC.

## Readiness for an authorized pilot
Not yet. The installer is technically complete and passes every isolated test, but a pilot needs, first:
1. the real-PowerPoint checklist passed (environment A or B);
2. IT's registration choice;
3. the owner's approval to distribute the add-in copy;
4. a security review of the local service.

See `docs/SLSD-IT-DEPLOYMENT.md`.
