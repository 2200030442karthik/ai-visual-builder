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

## Real PowerPoint: installed package (Option B on the development PC, 16 Nov 2026, approved by the owner)

How it was run:
- Only the development tab registration was parked (one key, exported first).
- The package was installed on port **44318** with its own data folder (no AI keys) and an IT-style shared catalog
  folder on the PC's existing `D` share.
- The development service kept running on 44317 throughout.

| # | Check | Result | Evidence |
|---|---|---|---|
| 4 | Install, certificate Yes prompt (the owner clicked Yes) | PASS | exit 0; certificate created and trusted; templates complete (1,199); access policy kept |
| 5 | `Verify.ps1` | PASS 17/17 | including the catalog reachable on the share and autostart present |
| – | Paid AI blocked (`ANTHROPIC_API_KEY` is in the user's environment) | PASS | `/api/claude/visual` and `/api/napkin/visual` refused with 403; status shows both off. The owner's session made **no** paid request (service log). |
| 6 | One SL Smart Design tab, nothing on Home | PASS | ribbon read via UI Automation after the one-time Add |
| 7 | AI Visual Builder opens | PASS | panel loaded from the installed service (port 44318) |
| 8 | Alternative Design through the installed service (COM) | PASS | `slsd: alternative done in 12.3 s` |
| 9 | Original commands (SL Templates, Miscellaneous, Shape Rename) | PASS, as reported by the owner (manual) | Only Alternative Design is in the service log. The deck was a copy of an earlier test deck, so slide contents cannot attribute the rest. |
| 10 | Generate, insert, edit, Undo | PASS, as reported by the owner (manual) | They run inside PowerPoint (no service log). Paid requests: none. |
| 11 | Restart persistence | PASS | PowerPoint restarted at 13:28; the tab was present without a new Add |
| 12 | Autostart at Windows sign-in | NOT TESTED | the shortcut was verified present (Verify); no sign-out was done |
| 13 | Uninstall → exact previous state | PASS | `capture-state` after uninstall = before install: **identical**; certificate removed; program and data folders gone; port 44318 free |
| 14 | Restore development registration | PASS (registry) + one manual step | `capture-state` final = before the whole test: **identical**; temporary catalog folder deleted |

**Finding (Office behaviour, not an installer defect).** Starting PowerPoint while the development catalog was parked
made Office drop its cached command record for the development add-in. After the registry was restored, the
development tab needs the one-time **Add** again (Home > Add-ins > Advanced… > SHARED FOLDER). The product add-in's
cache entries remain in Office's cache, unused and harmless. `capture-state` covers the registry and files, not
Office's cache.

**Tool fix:** `park-dev-registration.ps1 -Action Restore` stopped after a successful import (reg.exe reports success on
its error stream). Fixed and verified on a scratch key.

## Pending
- Microsoft 365 Centralized Deployment, an IT share catalog, a second PC.
- Autostart after a real sign-in.

## Readiness for an authorized pilot
**Technically ready for an authorized pilot.** It passes 55/55 isolated tests and the real-PowerPoint installation test
with an exact restore. Before deploying, the approvals in `docs/SLSD-IT-DEPLOYMENT.md` are needed:
1. IT's registration choice (and the share);
2. the owner's approval to distribute the add-in copy, and the licence renewal before 31 Dec 2026;
3. a security review of the local service, the COM automation and the certificate, and a Cisco review;
4. the paid-AI decision.

See `docs/SLSD-IT-DEPLOYMENT.md`.
