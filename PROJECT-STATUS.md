# AI Visual Builder — project status

## Current version: V10.16 (12 Nov 2026)
Authorized employee + Content Slide of the approved template → paste content → analyze → accurate infographic and
pictorial suggestions → preview → insert editable PowerPoint shapes. JavaScript panel + small Python host; no AI
models, no GPU. Three ways to generate: native infographics (built in, free), and optionally Napkin AI (single approved
Simplilearn brand style) or Claude AI (Anthropic API), both paid, confirmed per request, checked and rebuilt the same way.

| Part | File | Notes |
|---|---|---|
| Panel | `local-ai/v10.html` | reading, layout engine, insertion, access gate (user + Content Slide layout) |
| Suggestions | `local-ai/gallery.js` | infographic / pictorial / data generators, icon catalog, `contentPoints`, `proseScene` |
| Understanding | `local-ai/understand.js` | meaningful-text check, statements and relations, `conceptModel` (ideas of explanatory prose) |
| Brand standard | `local-ai/brand.js` | LVC/Simplilearn rules applied to every visual |
| SVG → native, quality checks | `local-ai/svg2ppt.js` | Napkin SVG conversion; `visualQuality` shared by all visuals |
| Napkin PPTX | `local-ai/pptx.js` | reading and checks |
| Napkin rebuild | `local-ai/rebuild.js` | `napkinFaithful`: Napkin's own arrangement (ring / fan / row / column / grid) and item look rebuilt natively; `napkinRebuild` (cards) for sequences and as a reported fallback |
| Designs, slides, edits | `local-ai/studio.js` | step 5, free (no AI request): more designs of a saved content plan, content density, several slides (logical split, overview, batch insertion with recovery), editing of inserted visuals (PowerPoint tags `AIVB_V`/`AIVB_F` + a record on the slide, one undo) |
| App (end users) | `local-ai/app.js` | 10.13: content → Generate visuals → gallery (10-20, filters, selection, large preview) → insert; More visuals, Several slides, Edit a visual; loading/empty/error/stale states; plain status words; developer mode (`?dev=1`, Ctrl+Alt+Shift+D) restores every technical section |
| Engine choice | `local-ai/orchestrator.js` | 10.13: engines builtin, designs (free), napkin, claude (paid, `registerEngine`); paid policy `never` / `when-needed` / `always` (config.json `paid_policy`, `paid_order`); kept results reused, 24-hour resend guard, one request + one fallback; ranking (accuracy, editability, richness, readability), dedupe, variety |
| Design pack "learning" | `local-ai/packs/learning-10.15.js` | 10.15: learner-style compositions in the spirit of the VisualX reference - learning map (hero panel, bracket, section panels of object columns), topic banner, skills to outcomes, icon rows, badge cards, section panels, learning poster, topic ribbon, colour tiles; 9 new native objects |
| Labelled sections | `local-ai/sections.js` | 10.15: "What you learn: ... / Best for: ..." read as a title, a short topic name and named sections; glued labels separated; list entries split into short items |
| SL Smart Design button | `local-ai/sl-smart-design/`, `local-ai/open-panel.ps1` | 10.15: "AI Visuals" beside Alternative Design (VBA callbacks + ribbon lines); the helper presses the add-in's Home-tab button through UI Automation |
| Design pack "showcase" | `local-ai/packs/showcase-10.14.js` | 10.14: hero-style educational compositions - spotlight (hero panel: topic object, headline, takeaway), storyboard (visual summary cards), callout (topic object with called-out points), journey (winding learning path) |
| Design pack "modern" | `local-ai/packs/modern-10.13.js` | 10.13: roadmap, pillars, quadrant framework; families say which content they `suits` (plan.js `planCandidates`) |
| Original editable | `local-ai/faithful.js` + `svg2ppt.js` (`svgToPrims(..., { faithful })`) | 10.12.2: the original design as native objects: curved outlines sampled and matched to box / rounded box / pill / circle / ellipse, open curved strokes as straight-segment connectors, text boxes at the design's place and size (`tight`: no margins, no wrap), brand colours and contrast, icons and illustrations as separate pictures; `faithfulSplit` (continuation slides at clean gaps, one scale), `faithfulJoin` (words broken by Napkin), checks and editability report |
| Original design | `local-ai/original.js` | 10.12.1: a drawn result's original (Napkin SVG, or the first slide of its PPTX drawn as SVG) as one SVG picture: cleaned (`cleanSvg` with embedded fonts kept), fitted by one factor and centred, readability (smallest text in pt; below 22 flagged, below `ORIGINAL_MIN_PT` 9 blocked) and content (its own text through `accuracy`) |
| Napkin AI + Claude AI | `local-ai/napkin.js` | one provider panel per AI (`makePanel`): 1 or 4 variations, checks, previews (as inserted and as returned), not-offered variations kept for inspection, re-check without a new request, insertion, Napkin/Claude comparison |
| Layout engine | `local-ai/plan.js`, `local-ai/packs/*.js` (`packs/README.txt`) | content plans (roles, groups, flow, sources), layout families registered in versioned design packs (core@10.10: 11, pro@10.11.0: 12), measured at 22 pt, checked |
| Claude AI backend | `local-ai/claude_visual.py`, `configure-claude.ps1`, `Configure Claude.bat` | one design-specification request for 1 or 4 visuals (drawings kept for cached results and tests), `max_retries=0`, no fallback model; model / effort / max_tokens / prices in `%LOCALAPPDATA%\AIVisualBuilder\claude.json` |
| Install / restart | `local-ai/start-ai-visual-builder.ps1` (+ `Restart AI Visual Builder.bat`), `install-v10-addin.ps1` (+ `Install V10 add-in.bat`, `Remove V10 add-in.bat`) | restart replaces every outdated copy; V10 registration by its own manifest Id, V9 never touched |
| Access | `local-ai/access.py`, `access.example.json` | administrator policy in `%ProgramData%\AIVisualBuilder\access.json` |
| Panel host | `local-ai/server.py` | 10.16.0 (large gallery: /api/gallery); `paid_order` "auto"; `orchestrate` in /api/status; ribbon icons; `--test` hosts refuse paid requests; exclusive port (a second copy cannot start); Claude endpoints with the same gates; forwards `context`, passes Napkin warnings; enforces access, template, caps, duplicates, approved style |
| Manifest | `manifest-v10.xml` | 10.16.0.0: group "AI Visual Builder" at the end of PowerPoint's Home tab (the button the SL Smart Design "AI Visuals" button presses), buttons Generate visuals / Several slides / Edit a visual (one task pane, `?open=`), local icons; (SSO entry to add once the app is registered, see README) |
| Diagnosis | `local-ai/tests/run_diag.py`, `diag.html`, `diag_cases.py` | every layout considered with its reason; every Napkin variation with arrangement, status and preview |

## V10.16 — AI-first concepts, statements as pictures, distinct designs, large gallery (12 Nov)
Root causes found: (1) one statement ("Claude ai helps you create, organize, and edit ...") was rejected by the content
reader and marked "exact", so it got only two text banners and never reached the AI services; (2) V10.15 limited
sectioned content to grouped layouts and "More visuals" re-offered the same families in other colours, so galleries
were the same two-panel picture many times (benchmark: 14 and 17 look-alike pairs); (3) Claude only chose template
names, so its design intelligence was reduced to our templates; (4) ranking padded the gallery with plain designs.
Fixes: `sections.js` statementRead (subject, verbs, object, examples - the sentence's own words; the heading carries
what it does); `packs/concepts-10.16.js` (six concept compositions: concept tiles, orbit, hexagon cluster, layered
stack, bento grid, statement spotlight); orchestrator: shape-print look-alike check, completeness of facts (a
statement's subject, verbs and object; section names), no weak designs when six complete ones exist, More visuals
never repeats a family; Claude's plan answer adds 3-4 own compositions ("concepts") drawn as native shapes
(`plan.js` planConceptFamily, `orchestrator.js` orchConceptDesigns); the large gallery (`gallery-dialog.html`, Office
dialog, `server.py` /api/gallery). Benchmark (`tests/run_bench.py`, evidence in `local-ai/tests/evidence/v10.16-bench`):
Claude AI statement 2 text banners -> 8 complete designs in 7 categories; AI & ML look-alike pairs 14 -> 1, repeated
families 10 -> 0. SL Smart Design source reviewed from the installed .ppam (`local-ai/sl-smart-design/SOURCE-REVIEW.txt`;
the .pptm on SharePoint answers 403). Tests `tests/app.html` 21 of 21 (new A17-A20). **Not yet verified in real
PowerPoint; Claude's concepts not yet run against the real API.**

## V10.15 — learner-style visuals, labelled sections, hover-only preview, SL Smart Design button (11 Nov)
Why V10.14's visuals still looked basic for course summaries: (1) on this PC `config.json` had `"paid_policy": "never"`,
so Napkin and Claude were never asked; (2) "What you learn: ... Best for: ..." was read as one plain list - the first
section was dropped (Digital Marketing kept only the three "Best for" points) or each section became one card holding a
whole sentence (AI & ML), and a label glued to the title ("Social Media GrowthWhat you learn:") became the heading;
(3) there was no composition for named sections with an object per entry - the VisualX reference's structure (hero for
the topic, pill headings, object-and-label columns).
Now: sections.js reads labelled sections (title, short name, sections, short items in the text's words; glued labels
separated); the plan has one named group per section, and only layouts that show each section under its name are used;
the "learning" pack adds nine compositions and nine objects, ranked first for such content; Napkin and Claude are sent
the sections and their items (Claude's brief and schema: sections as groups, short labels, a short topic name, the new
layouts and objects); the app has no separate preview area (the hover popup is the preview), plain design names and an
Insert button that names the choice; the add-in's group moved from the Insert tab to the Home tab, and an "AI Visuals"
button for the SL Smart Design tab (VBA add-in) opens it through open-panel.ps1. Tests `tests/app.html` 17 of 17 (new
A15, A16). **Not yet verified in real PowerPoint.**

## V10.14 — richer, AI-designed visuals; hover preview; ribbon on the Insert tab (10 Nov)
Why V10.13's visuals looked basic: the AI services were practically never asked (only when the free engines gave fewer
than 10 strong designs, which they nearly always did); every layout was one visual language (tiles, panels, small icons,
one type size, no focal element); Claude's plan only reached those same layouts; ranking rewarded correctness, not
attractiveness, so near-identical lists crowded the gallery.
Now: (1) "when-needed" asks one AI service for every new text a design can show (never for exact records, data tables or
single statements), routed by content - Claude for technical structure, Napkin for concepts; the other as fallback;
(2) Claude's plan carries a headline, a takeaway and the topic's object and is drawn in every composition that suits it
(hybrid: AI design ideas, native editable result); (3) the showcase pack adds hero-style compositions; (4) ranking
measures richness and drops the same composition in another colour or as a near-identical list; (5) hover preview in
the gallery; (6) the ribbon group moved to PowerPoint's Insert tab. Tests `tests/app.html` 15 of 15 (new: hover,
routing, hybrid, richness and variety); V10.12.2 11/11, V10.12.1 13/13, V10.12 14/14, regression 29/29, server and
Claude ALL PASSED, ribbon check passed. No paid request during this work. **Not yet verified in real PowerPoint.**

## V10.13 — a simple app: one "Generate visuals", the engine chosen behind it (10 Nov)
The normal panel shows only: your content, Generate visuals, the gallery (10-20, best first, filters by kind, large
preview), Insert selected visual, More visuals, Several slides, Edit a visual. Hidden from it (developer mode only):
version, panel host status, setup and checks, the analysis step, timings, Napkin AI / Claude AI sections ("how many",
credit tick, usage, tokens, re-check, insertion choices), the design studio's plan source, raw messages.
Generate analyses the content itself, runs the free engines, then a paid one only by the administrator's policy
(default when-needed), ranks, dedupes and varies the result. New layout families: roadmap, pillars, quadrant
framework. Ribbon: own "Simplilearn" tab. Tests `tests/app.html` A1-A11 + no script errors: 12 of 12; ribbon check
(13 URLs) passed; V10.12.2 11/11, V10.12.1 13/13, V10.12 14/14, regression 29/29, server and Claude ALL PASSED.
A real Napkin request (4 variations, the Educational content sample) was sent once during development by a probe
that drove Generate against a test host with this PC's key; test hosts now refuse paid requests (`TEST_NO_PAID`).
**Not yet verified in real PowerPoint.**

## V10.12.2 — "Original editable": Napkin's design as native, editable objects (3 Nov)
A fourth choice under "What to insert" (Editable / **Original editable** / Original / Both), no new request.
On the 14 saved real Napkin SVGs: 231 native objects and 103 pictures (icons and illustrations); 99 curved outlines
drawn as native shapes or lines; every text native and word for word (figures, formulas, special characters); 11 of
14 usable (the other 3 cover only 1-3 of the source points, as their original pictures do: blocked); the two tall
designs on 2 slides. Rendered against the original: ink overlap 0.37 -> 0.64, colour 0.70 -> 0.78 (V10.12.1 editable
version -> original editable). Evidence `tests/evidence/v10.12.2-faithful.png` (original / before / after).
Tests `tests/faithful.html` G1-G9 + no request + no script errors: 11 of 11; V10.12.1 13 of 13, V10.12 14 of 14,
regression 29 of 29, server and Claude ALL PASSED. **Not yet verified in real PowerPoint.**

## V10.12.1 — insert the editable version, the original Napkin design, or both (3 Nov)
"What to insert" in the Napkin section (`napkin.js`, `original.js`), no new request:

| Choice | What goes in |
|---|---|
| Editable version (default) | as in V10.12: native shapes and text, tagged and recorded for step 5 |
| Original design | the cleaned SVG as one picture through `setSelectedDataAsync` (XmlSvg), fitted into the slide's free content area, checked again there (readability), exactly one picture expected, placed where asked, named and tagged `AIVB_O` (step 5 says it is a picture) |
| Both | two new slides after the selected one (same layout and master): editable, then original; `AIVB_BATCH` running/done like step 5's slides; removed together; any failure removes both |

Each version validated separately; a variation is offered when either passes, and the other choices say "not available".
The original's preview is the inserted picture (same SVG, same place). Duplicate guard: the same version of the same
variation, just inserted, needs a second press. Tests: `tests/original.html` (O1-O11 + no request + no script errors,
13 of 13; evidence `tests/evidence/v10.12.1-original.png`); regression 29 of 29, V10.12 studio 14 of 14, server and
Claude ALL PASSED. **Not yet verified in real PowerPoint.**

## V10.12 — free design regeneration, editing inserted visuals, several slides (3 Nov)
All in step 5 "Designs, slides and edits" (`studio.js`, pure functions in `plan.js`), no AI request:

| Feature | How |
|---|---|
| More designs of a saved plan | Plans from Claude's design, Napkin's items, the panel's analysis or this PC's saved plans (last 12). `planMoreDesigns`: new layout families first (one per kind), then approved colour orders and more white space; nothing repeated. Provider panels: "More designs and slides from this result (no cost)". |
| Content density | Automatic: every description when a layout fits at 22 pt, else the point names (said) or several slides; or chosen (labels and descriptions / point names). |
| Edit inserted visuals | Every visual inserted from 10.12 carries tags (`AIVB_V` on its shapes, `AIVB_F` = the point a text shows) and a record on its slide (`AIVB_R_<id>`, in pieces; a copy on this PC). Labels, descriptions, icons, colours, spacing, density and layout: drawn again in the visual's own area, then exactly its old shapes removed; refused when another object overlaps that area or the text does not fit; hand edits read back; one undo (again = redo). Built-in suggestions and Napkin designs: texts in place (fit checked), redesign from their points. |
| Several slides | `planSlides`/`planSplit`: by role (main flow, functions across it), by group, consecutive steps with numbering continued, else even parts; optional overview of all point names; every label and description checked on the slides; per-slide layout choice; inserted after the selected slide all or nothing, removed together; an interrupted insertion (`AIVB_BATCH` running) found and removed. |

Fixed: a "point names only" local layout (V10.11) was re-drawn with its descriptions on insertion and could fail.
Tests: server and Claude ALL PASSED; regression 29 of 29 (+ Z: provider insertions carry edit records); V10.12
acceptance 14 of 14 (`tests/studio.html`, 0 AI requests; evidence `tests/evidence/v10.12-studio.png`).
**Verified in real PowerPoint by the user (3 Nov).**

## V10.11 — professional visual engine and one Generate action per provider (3 Nov)
Found in the PowerPoint tests of 3 Nov (8-concept data engineering text; real Claude design request US$ 0.03 and real
Napkin result saved as `tests/fixtures/claude-dataeng-plan.json`, `napkin-dataeng-0.svg`):

| Root cause | Change |
|---|---|
| Claude's plan was right (main flow, cross-cutting functions, output) but drawn as plain cards; the numbered source made cross-cutting functions steps of a timeline. | Semantic roles (`plan.js planSemantics`: stage, output, control / quality / foundation functions, sources named in the text); a sequence only when nothing applies across it. |
| Only list-like layouts existed. | Design packs (`packs/`, `registerPack`): 23 families in 6 kinds, among them platform architecture, layered system (stacked slabs), technical illustration (machines on a line, annotated), capability map (domains and a functions strip), swimlanes, control and data planes (defined as data), ecosystem, modular blocks, pyramid, cycle, funnel, comparison. One per kind first, so the four variations differ in composition. |
| Claude chose among a few layouts only. | Design specification: roles, pictorial objects from the panel's catalogue, ranked compositions and an optional composition of its own (zone grid), one request for 1 or 4 visuals. |
| Napkin's numbered designs were always rebuilt as cards; when nothing fitted, a cut-off layout (16 labels) excluded the result; local layouts reused its full sentences and failed. | Napkin's arrangement kept for a sequence when it reads in the user's order; titles only (named) instead of cut-off text; local layouts fall back to the point names (marked). The real Napkin result: 0 usable -> usable + 3 local layouts. |
| Format and mode choices the user had to understand. | One "Generate visuals with ..." per provider; Napkin SVG and Claude's design specification chosen internally (PowerPoint export and Claude drawings kept for cached results and tests); 1 visual (default) or 4 variations. |

Tests (no network, no paid calls): server ALL PASSED, Claude ALL PASSED (+ the design lists match the panel's), browser
acceptance **28 of 28** (W real Claude design: platform architecture, layered system, technical illustration, capability
map, complete and editable, insert = preview; structural similarity of every pair 0.36-0.57; X simplified interface;
Y real Napkin result usable). **Verified in real PowerPoint by the user (3 Nov): results satisfactory.** Not made: a new
paid request. Committed and tagged `v10.11`.

## V10.10 — professional, distinct, usable AI variations (3 Nov)
Found on the real Claude request of 3 Nov (8-concept data engineering text, 4 variations, about US$ 0.70; saved as
`tests/fixtures/claude-dataeng-0..3.svg`): only 1 of 4 offered, labels with colons and without their descriptions.

| Root cause | Change |
|---|---|
| Every ordered result was rebuilt as the same coloured cards (`napkinFaithful` refuses sequences), so a staircase, a timeline and a list all became cards; Claude draws in the content area at 22 pt, and the rebuild replaced good designs (crushed 8 cards in one row, 16 labels cut off). | `rebuild.js asDrawn`: a drawing made for the template (text needed no raising, no layout faults, fills >= 60 % of the area) goes in as designed, shape by shape; a rebuild with faults falls back to it. Real Claude result: **4 of 4 usable** (was 1). |
| `svg2ppt.js` dropped plain text after an inline bold `<tspan>` ("Data ingestion:" without "databases, APIs..."), and `svgTexts` too. | Text children read in order; a bold lead run becomes its own bold text box at its measured position. |
| Two-point connector paths without `fill` were taken as filled polygons (pictures); a line under a numbered badge counted as "connector crosses a label". | Lines stay lines; the crossing check ignores parts covered by a filled shape drawn later. |
| No structural layouts: every layout was a flat list of points; nothing captured groups, a main flow or cross-cutting capabilities. | `plan.js`: one content plan, 11 layout families (architecture with cross-cutting lanes, layers, capability map, hierarchy, pipeline, timeline, rising steps, hub, icon grid, feature columns, structured list), each measured at 22 pt before drawing, tried at several sizes (repair), then checked (visualQuality + every label and description on the slide); not offered with the reason when nothing passes. Approved colours only, native shapes. |
| Claude was asked to draw (4 requests); drawing is where generated SVG fails. | Claude's default is the **content plan**: 1 request, structured output (JSON schema), the structure and short descriptions in the text's own words; up to 4 layouts drawn here. Missing points added in place; invented figures exclude the plan. Claude's own drawings remain an option. |
| A result with fewer than 4 usable variations stayed so. | Layouts drawn here from the items of a variation whose content is right complete the set to 4 (no extra request), Napkin and Claude alike. |
| Nothing told the user before paying whether the content fits. | Free layout check before each request (layouts that fit at 22 pt with full descriptions / names only). |

Tests (3 Nov, no network, no paid calls): server ALL PASSED, Claude ALL PASSED (+ plan request shape, schema closed, bad
plans, plan job and duplicate key), browser acceptance **24 of 24** (A-P as before, adjusted for the added local layouts;
Q content plan 8 concepts: 1 request, 4 distinct complete fully editable layouts, insert = preview; R missing step added in
place, invented figure refused; S real Claude drawings 4 of 4 as designed; T one Napkin visual completed to 4; U layout
check before sending; V layout diversity over the brief's content types). Not verified live: a real content-plan request
and the new layouts in real PowerPoint.

## Status
| Area | Status |
|---|---|
| Napkin false rejections | Fixed. Real Napkin output (saved as `tests/fixtures/napkin-ml5.svg`) was excluded for "5 outline-only graphics": Napkin draws each box as a fill plus a separate outline of the same rectangle. PPTX checks never saw real shapes at all (`/spPr$/` also matched `p:nvSpPr`), and treated theme-styled fills as outlines and a text box's whole rectangle as its text. Now: duplicate outlines merged, styled fills read, text measured by its real area, icons inside labelled boxes accepted, bottom-up staircases accepted as ordered. |
| Points of a list | Titles and introductory or closing sentences are context, not points. Labels lose a trailing "when/if …" clause and a lead-in ("It can produce text" → "Text", "Code when you ask it to" → "Code"); inline lists start after "create/produce/generate/such as". The model itself is cleaned, so every view, the gallery and the Napkin check use the same points. |
| Napkin result status | **Complete** (every point), **Corrected** (unordered categories missing, at most half: each added as one more item of the same rebuilt infographic; "Prompts" in the real 12:22 result, `tests/fixtures/napkin-genai-prompts.pptx`), **Partially complete** (the design could not be rebuilt to take it: inserted, status names what is missing), **Unusable** (a step of a sequence missing, most points missing, real layout faults). Section headings inside lists ("How It Works") are structure, not points. Status names the request id and variation inserted. |
| Generative AI (real Napkin PPT, 30 Oct, saved as `tests/fixtures/napkin-genai.pptx`) | Was "0 usable": the source points were wrong (key words, "It can produce text", "Code when you ask it to"). Now Text, Images, Music, Videos, Code; "Computer code" ≈ "Code" (distinctive head noun); usable and inserted; a genuinely missing category is still excluded. Built-in: icons text/image/music/video/code; categories never get numbers, steps or arrows (numbered layouts need a stated order). |
| PPT previews | Thumbnails drawn from the downloaded PPTX (shapes incl. custom geometry, theme colours, text, pictures incl. SVG icons, connectors); what cannot be drawn exactly is named. Every variation selectable; the selected one is inserted. |
| Napkin insertion (30 Oct, second round) | **Root cause of the plain-white slide:** the PPT import (`insertSlidesFromBase64`) brought Napkin's own layout into the deck (renamed `Content_Slide`, empty), so the slide lost the template design; its 4:3 design shrank into the wide content area with 7–15 pt text. **Now:** nothing is imported. The result goes onto the selected Content_Slide or a new slide on the same layout and master; a recognised design (heading + items with title, description, icon, colour) is rebuilt natively in the content area (Open Sans, ≥ 22 pt, palette, cards in one or two rows, heading linked, sequences with arrows in source order); Napkin's icons stay as small pictures; missing points become items of the same infographic; other designs are converted shape by shape. Preview = insertion (same build). All or nothing; removable. |
| Content Slide gate | Pinned to `LVC_Template.pptx` (read 30 Oct): layout `Content_Slide` (the name has an underscore; spaces/underscores count the same), fingerprint = three shapes of the layout (content placeholder 101.7, 205, 1078.5 × 435.2; heading placeholder 101.7, 119.1, 1078.5 × 71.2; tag strip 1287.2, 0, 80.8 × 720.3; ±3 pt), read through PowerPoint's API for the selected slide (a same-named layout from another deck, or the empty one a slide import brings, is refused; the message names what is missing). **Root cause of the false rejection (30 Oct):** the fingerprint also required exactly 19 layouts; the Napkin import had added a 20th to the user's deck (confirmed in PowerPoint Desktop via its object model), so every genuine slide failed. Layout count and ids are no longer used. Analysis, suggestions, Napkin and insertion only there; rechecked before every paid request and insertion and on selection change; new slides use the selected Content_Slide layout; server refuses Napkin requests without the layout and fingerprint. Template facts: 1280 × 720 pt, Open Sans, content area = the tool's (102, 205, 1079 × 435). Fingerprint values confirmed in PowerPoint Desktop (object model, read-only); **the add-in's own check in PowerPoint still to be confirmed by the user.** |
| Authorized users | Panel host enforces the policy on every Napkin endpoint (create, status, download, kept results); no policy = denied. Entra ID mode (Office SSO token verified: RS256 signature, tenant, audience, expiry, scope; users / app role / group) tested with test tokens. **Organization app registration not done: Entra mode not tested live.** This PC runs in Windows mode (your account). |
| Napkin quota | No application cap (30 Oct): `napkin_max_per_day` 0 = none (default in config.json and the live policy); an administrator may set one (and `napkin_max_per_user_per_day`) in access.json. Usage is still counted and shown. Napkin: plan-based limits per second/minute/hour/day on create only, `X-RateLimit-*` headers (shown when seen), 429 `rate_limit_exceeded`/`generation_limit_exceeded`, 402 `no_credits`; no balance API. Duplicates stopped; results kept and re-checked without credits; no automatic retries. |

| Repeated Napkin rejections (30 Oct, Quick Facts, request c75606d0, 4 SVG variations saved as `tests/fixtures/napkin-facts-0..3.svg`) | All 4 were rejected. Root causes in the shared model: points written as whole statements exceeded the 80-character label limit, so the list fell to a generic reader that defaulted to a process diagram (ordered, numbered "1. 2. 3."), moved the last fact into the "intro" and counted "More Quick Facts" as a point; validation then compared whole sentences with Napkin's short labels ("Cloud weight") and counted "weight" (vs "weighs") and Napkin's own heading words as invented; rebuilt results were still blocked by faults of Napkin's original drawing. Now: statement points get a subject label + the statement as description; title-case lines among them are headings; concept-level matching (subject word, word forms, description words); wrong figures block; the rebuilt slide is checked, and the rebuild is refused when an item would merge several points. Result: variations 1, 2, 4 Complete (4 facts, no order); variation 3 (only the Earth fact) Unusable. |

## Limitations
- PowerPoint's JS API cannot draw curves or set line spacing; curved Napkin icons stay separate pictures.
- A rebuilt Napkin result keeps its arrangement, item look, wording, icons and colours, not its exact drawing (curved connectors, figures and globes are not redrawn; a half-disc hub becomes an ellipse).
- Ribbon: an add-in's group goes at the end of a built-in tab (Home, here); it cannot join a built-in group or another add-in's tab. The SL Smart Design button works around this through UI Automation (open-panel.ps1): it needs the add-in's Home-tab group to exist, English tab and button names, and the VBA module imported into SL Smart Design's source file; the three buttons share one task pane - when it is already open, PowerPoint may keep its current page instead of opening the section asked for (the panel's own buttons do the same). The ribbon icons are served by the panel host: if it is not running when PowerPoint starts, generic icons are shown. A changed manifest needs "Install V10 add-in.bat" again and a PowerPoint restart.
- Richer visuals are composed of solid-colour native shapes: PowerPoint's API sets no gradients, shadows or free-form shapes, so the "VisualX" look is approached through composition (focal objects, hero panels, big icons, headline hierarchy), not effects. The topic's large object is drawn only when the icon catalogue has an accurate one.
- With "when-needed", every new suitable text uses one AI request (credits); set "paid_policy": "never" to keep Generate free.
- Original editable: icons and illustrations stay pictures (PowerPoint's JavaScript API has no free-form shapes); rounded boxes use PowerPoint's default corner radius (slightly rounder than Napkin's); text uses PowerPoint's single line spacing (the API cannot set it), so multi-line text can sit a little taller; Napkin's bold renders as Open Sans Bold (Napkin embeds only the regular face, so its own picture shows a synthesised bold); small text on the mid-tone palette colours cannot reach WCAG 4.5:1 with an approved text colour (flagged); its text is Napkin's size (10-15 pt, below the 22 pt of the editable version; flagged); continuation slides only where the design has a clean horizontal gap.
- The original Napkin design is a picture: its text keeps Napkin's sizes (usually 10-13 pt once fitted; flagged), it is not editable as shapes in the panel, and PowerPoint draws its SVG with its own renderer (Convert to Shape needs Microsoft 365).
- Text is 22 pt or more everywhere in the editable versions; the guidelines' 18 pt infographic exception (p. 43) is not used.
- The Test C original was not kept; its regression case is a reconstruction from the screenshot.
- Designs that are not recognised (charts, matrices, labels around a picture) are converted shape by shape; a missing point is then reported (Partially complete), not added.
- Built-in suggestions run in the panel (free); only paid Napkin calls are enforced server-side.
- In Windows mode the PC's user, who holds the Napkin key, cannot be restricted; Entra mode with one shared host can.

## Change log
- **V10.16** (12 Nov) — statementRead, concepts pack (6 compositions, 2 objects), look-alike and completeness ranking, Claude concepts (schema, brief, renderer), large gallery dialog, visual benchmark, SL Smart Design source review; tests A17-A20, concept schema check.
- **V10.15** (11 Nov) — sections.js (labelled sections), learning pack (9 compositions, 9 objects), Claude brief for sections, hover-only preview, Home-tab group, SL Smart Design "AI Visuals" kit (VBA module, ribbon lines, copy script, open-panel.ps1); tests A15-A16, ribbon check covers the kit.
- **V10.14** (10 Nov) — showcase design pack, Claude headline/takeaway/hero, AI services routed by content and used for every suitable new text, Claude plan drawn in all suitable compositions, richness ranking and composition-level dedupe, hover preview, ribbon group on the Insert tab; tests A12-A14.
- **V10.13** (10 Nov) — simple app (app.js), hidden engine choice with policy and cost control (orchestrator.js), modern design pack, ribbon tab, developer mode; tests A1-A11 and the ribbon check.
- **V10.12.2** (3 Nov) — "Original editable": Napkin's design as native objects (curved shapes recognised, tight text boxes, contrast, continuation slides, word joins), editability report; pills drawn as PowerPoint's stadium shape; tests G1-G9.
- **V10.12.1** (3 Nov) — insert the editable version, the original Napkin design (one SVG picture) or both on two slides; separate validation, readability floor, duplicate guard; tests O1-O11.
- **V10.12** (3 Nov 2026) — step 5: more designs of saved plans, content density, several slides with recovery, editing of inserted visuals (tags + records, undo); names-only insertion fix; tests Z and studio D1-S4.
- **V10.11** (3 Nov) — design packs (23 families, 6 kinds), semantic roles, Claude design specification, one Generate action per provider.
- **V10.10** (3 Nov) — Claude content plan, plan.js layout engine measured at 22 pt.
- Earlier versions (V10.4-V10.9) and V9 were removed from this repository on 3 Nov 2026; their full history is kept in the
  backup bundle `ai-visual-builder-history-backup-2026-11-03.bundle` (outside the project folder; `git clone <bundle>` restores it).
  V9 still runs from the `main` branch on GitHub (GitHub Pages).
