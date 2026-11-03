AI VISUAL BUILDER V10.12.1
==========================
Authorized employee + Content Slide of the approved template -> paste content -> analyze -> accurate infographic and
pictorial suggestions -> preview -> insert editable PowerPoint shapes. Lightweight: JavaScript in the panel, a small
Python host, no AI models, no GPU. Optional Napkin AI (paid) with the approved Simplilearn brand style.

HOW TO USE
1. Once: double-click local-ai\Set up AI Visual Builder.bat (localhost certificate + start at sign-in).
2. If PowerPoint says "Sorry, we can't load the add-in": double-click local-ai\Start AI Visual Builder.bat, reopen the
   panel. After an update, restart it once (Stop, then Start AI Visual Builder.bat).
3. PowerPoint: select a slide that uses the template's "Content_Slide" layout (LVC_Template.pptx). Home > AI Visual Builder V10. Paste text (or "Use
   text from the selected slide") > Analyze content > pick a suggestion > Insert visual. "Remove last inserted visual"
   takes out exactly what was inserted.

FILES (local-ai)
  v10.html        panel: reading, layout engine, insertion, access gate (user + Content Slide)
  gallery.js      infographic, pictorial and data suggestions; icon catalog; points of a list (contentPoints);
                  explanatory prose read as ideas (proseScene)
  understand.js   meaningful-text check, statements and relations, statement layouts, ideas of a paragraph (conceptModel)
  brand.js        LVC/Simplilearn standard applied to every visual
  svg2ppt.js      Napkin SVG -> native shapes; the visual-quality checks shared by all visuals
  pptx.js         Napkin PowerPoint files: reading and checks
  rebuild.js      a Napkin result rebuilt in the template in Napkin's own arrangement (ring, fan, row, column, grid;
                  card, pillar, badge or plain items); cards only as a reported fallback
  original.js     a Napkin result's original design as one SVG picture (fitting, readability and content checks)
  napkin.js       optional Napkin AI and Claude AI sections
  studio.js       step 5 (free): more designs, several slides, editing inserted visuals
  server.py       panel host (https://localhost:44317), Napkin proxy; key never reaches the panel
  access.py       who may generate (the administrator's policy), checked in the panel host
  access.example.json  policy template for administrators
  config.json     port, optional Napkin daily cap (0 = none), timeout
  tests\run_tests.py   all tests incl. the V10.8 acceptance cases A-I (headless Edge, stand-ins for PowerPoint and
                       Napkin; no network, no credits)
  tests\run_diag.py    diagnosis: every layout considered with its reason, every Napkin variation with its preview

ACCESS (administrators)
The policy is %ProgramData%\AIVisualBuilder\access.json, outside the application source. Without it nobody can generate.
Make the folder writable for administrators only (by default Windows lets every user write there).
- mode "entra" (organization): Microsoft Entra ID via Office single sign-on. Register an app (Entra admin center >
  App registrations): Application ID URI api://localhost:44317/<client-id>, scope "access_as_user", pre-authorize the
  Office clients (ea5a67f6-b6f3-4338-b240-c655ddc3cc8e = all Microsoft Office endpoints), app role "Visuals.Generate"
  assigned to the approved security group. Add to manifest-v10.xml, inside <VersionOverrides> after <Resources>:
    <WebApplicationInfo><Id>CLIENT-ID</Id><Resource>api://localhost:44317/CLIENT-ID</Resource>
      <Scopes><Scope>openid</Scope><Scope>profile</Scope></Scopes></WebApplicationInfo>
  Set tenant_id, client_id and allowed_roles (or allowed_groups / allowed_users) in access.json. The panel host verifies
  every token (signature against the tenant's keys, issuer, audience, expiry, scope) before any Napkin call.
- mode "windows" (one PC): the Windows account running the panel host (allowed_users "DOMAIN\user").
- napkin_max_per_day / napkin_max_per_user_per_day: optional local caps; 0 (the default) = no cap of the application.
  Requests are counted either way and shown in the panel. Napkin's own plan limits and credits always apply.
- template: pinned to LVC_Template.pptx (read 30 Oct 2026): layout "Content_Slide" (underscores and spaces count the
  same), fingerprint = three shapes of that layout, each within 3 pt: the content placeholder (101.7, 205, 1078.5 x
  435.2), the heading placeholder (101.7, 119.1, 1078.5 x 71.2) and the section tag strip right of the slide (1287.2,
  0, 80.8 x 720.3), confirmed in PowerPoint Desktop on 30 Oct 2026. The panel reads them from PowerPoint for the
  selected slide, so a layout merely named like it in another deck is refused, and a rejection names what is missing.
  Not used: the number of layouts (importing slides from another file adds layouts; that wrongly rejected genuine
  slides) and layout/master ids (renumbered in saved copies).
  xml_ids (master 2147483673, layout 2147483736, creationId 189336738) are recorded for reference; PowerPoint's API
  does not report them. If the template is revised, re-read these values from the new file.
Important: the Napkin key lives with the panel host. In the current one-PC-per-user setup, whoever holds a PC's
napkin.json can use that key directly; install the key only on authorized users' PCs, or run one shared panel host
with the key and Entra mode for everyone.

WHAT THE TOOL ENFORCES (LVC and OSL Guidelines)
- Open Sans; body text 22 pt minimum, #404040 on white; Napkin labels 18 pt minimum (infographic text, guideline
  p. 43). Content that does not fit goes, in full, to continuation (detail) slides; text is never shrunk below that.
- Approved palette #8ECDB7 #62B7E4 #7EA2C8 #9B99C7 #DDB945 #E6A157 #E58F6D #B88968 #D98CA1 #C1A5C6 and neutrals;
  solid fills, no gradients, shadows or dashed lines, flat filled icons, round-cornered boxes, undistorted circles,
  no right-aligned text, content inside the template's content area (102, 205, 1079 x 435 pt).
- Layout checks before anything is offered: labels overlapping each other, icons or connectors; text cut off or
  overflowing; elements outside the area; overlapping circles; large decorative illustrations; empty outline
  graphics; missing points. A label inside its own box, an icon inside a labelled box and a box drawn as fill plus
  outline are normal and accepted. Black icons, framed labels and extra wording are warnings, not exclusions.
- Meaningless text: no suggestions, no Napkin request ("The content could not be understood...").

DESIGNS, SLIDES AND EDITS (V10.12, step 5, free: no AI request)
- Designs: choose a content plan (your text, the last Claude or Napkin result, or a plan saved on this PC) > Show
  designs / More designs (new layouts each time, then colour and spacing variants) > Insert selected design.
- Several slides: Plan the slides (split only when needed, or always) > check each preview ("Other layout") > Insert
  the slides (new slides after the selected one; "Remove last inserted visual" removes them all). An insertion that
  was interrupted is offered for removal.
- Edit a visual: click a visual inserted by 10.12 or later > Edit the selected visual > change texts, icons, colours,
  spacing or layout > Preview change > Apply to the slide; Undo last edit. Only that visual's shapes change.

CLAUDE AI (V10.11)
- One "Generate visuals with Claude AI" (1 visual or 4 variations, ONE request either way): Claude analyses the content
  (what each point is, how they relate, which object depicts it) and designs the visuals; the panel draws up to 4
  structurally different compositions (platform architecture, layered system, technical illustration, capability map,
  swimlanes, ...; see local-ai\packs\README.txt), only those that pass every check at 22 pt. Napkin: one "Generate
  visuals with Napkin AI" (SVG chosen internally).
- Before each request a free layout check shows which layouts the content fits. A result with fewer than 4 usable
  variations is completed with layouts drawn from its own items (no extra request; Napkin too).
- Off until you store your Anthropic API key: double-click local-ai\Configure Claude.bat and paste the key at the hidden
  prompt (never in chat, files or git). It goes to %LOCALAPPDATA%\AIVisualBuilder\claude.json, readable only by you.
  Check with: powershell -File local-ai\configure-claude.ps1 -Status (shows the settings, never the key).
- Options: -Model <id> (default claude-opus-5-5), -Effort low|medium|high|xhigh|max (default high; lower costs less),
  -MaxTokens <n> (default 32000), -Disable / -Enable, -Remove. Prices for the cost estimate can be set in claude.json as
  price_input_per_mtok / price_output_per_mtok (US$ per million tokens); the real bill is in platform.claude.com.
- Each request needs the tick and a click; 1 visual (default) or 4 variations = 1 or 4 requests; no automatic retries, no
  fallback model, the same request twice is stopped; the last result is kept ("Re-check last Claude result", no cost).
- Claude returns SVG; it goes through exactly the same checks, rebuild and insertion as Napkin's, so the comparison table
  under the two panels compares like with like (same text in step 1).

INSTALL, RESTART, RECOVER
- The panel host must be the current version: double-click local-ai\Restart AI Visual Builder.bat after every update
  (it stops every outdated or duplicate copy and starts one), then close and reopen the panel in PowerPoint.
  powershell -File local-ai\start-ai-visual-builder.ps1 -Status shows the running version, the version on disk and copies.
- The V10 add-in: local-ai\Install V10 add-in.bat registers it (by its own Id; V9 untouched), Remove V10 add-in.bat removes
  only V10. If PowerPoint still shows an old panel: close PowerPoint, run install-v10-addin.ps1 -ClearCache, start it again.

NAPKIN AI: WHAT TO INSERT (V10.12.1, no extra request)
Each variation shows two previews, each exactly as it goes in: the editable version and the original Napkin design.
"What to insert" (under the result):
- Editable version (the default): native PowerPoint shapes and text (Open Sans, 22 pt and up, approved colours);
  icons may be small pictures. Editable later in step 5.
- Original Napkin design: Napkin's own SVG as ONE picture (vector graphic): its illustrations, icons, connectors,
  text, colours and composition exactly as returned (fonts embedded in the file are kept; scripts and external links
  are removed). Scaled by one factor and centred in the free content area: never cropped or distorted. It is not
  editable as shapes; in PowerPoint, right-click > Convert to Shape turns its parts into shapes.
- Both: two new slides after the selected one, on its Content_Slide layout: the editable version, then the original.
  "Remove last inserted visual" removes both. An insertion interrupted half-way is offered for removal (step 5).
Each version is checked on its own. The original: its text against your content (a missing point is flagged on the
card and in the status after insertion; invented figures block it) and its readability: Napkin's text is usually
smaller than 22 pt once fitted (flagged, kept as designed); below 9 pt it is blocked (tall designs). When only one
version passes, only that one can be inserted ("not available for this variation" on the other choices). The same
version of the same variation pressed again right after inserting asks for a second press. Everything comes from the
files already kept on this PC: no request, no credits.

NAPKIN AI
- Off until "Configure Napkin AI.bat" stores your API token (in %LOCALAPPDATA%\AIVisualBuilder\napkin.json).
- Every request uses the approved style EHH64S9R64R64C9DCMSKCSHD6GTPADHDC4SKJC1D68WP6CK66DJ32RV4CGVG. Napkin
  answers an unknown style with its default style plus an "invalid_style_id" warning; such results are blocked.
- 1 visual or 4 variations (4 sends sort_strategy "variation"). The guidance (topic, the points, "independent, no
  numbering" or "in this order") goes in Napkin's documented `context` field, never into the drawn content. Napkin's
  warnings (e.g. not_enough_visuals) are shown. Each request needs the credit tick and a click;
  nothing is retried or regenerated automatically. The same request twice is stopped (its results are kept); press
  Create again to generate anyway.
- Only the actual points are required in a result (a title or introductory sentence is context, not a point; "when you
  ask it to" after a point is context too). A shortened label counts ("Code" for "Computer code"); a missing point does not.
  The last result is kept on this PC: "Re-check last Napkin result (no credits)" checks it again and lets you insert it.
- One content model for analysis, suggestions, the Napkin request and the checks: a point written as a whole
  statement ("A single cloud typically weighs around one million tonnes") is labelled by its subject ("Single cloud")
  and keeps the statement as its description; a short title-case line among such points ("More Quick Facts") is a
  heading, not a point; independent facts are never a sequence (no numbers or arrows unless the text states an order).
- Checks compare concepts: a described point is present when its own subject word is in the result ("Cloud weight"),
  word forms count as the same word ("weight"/"weighs"), Napkin's own heading is not checked for invented words, and a
  figure that is not in your text makes the result unusable.
- Repair before rejecting: a recognised design is rebuilt in the template, and the rebuilt slide is what is checked
  (Napkin's own overlaps are named as repaired). The rebuild is refused when one of its items would merge several of
  your points (overlapping labels read as one); then the design is judged as Napkin drew it.
- Status of each result: Complete; Corrected (categories Napkin left out become items of the same infographic);
  Partially complete (the design could not take them: inserted, the status says what is missing); Unusable (a step of a
  sequence missing, most points missing, or layout faults). Headings such as "How It Works" are not required points.
- Insertion (SVG and PowerPoint alike): Napkin's slide and layout are never imported. The result goes onto the selected
  Content_Slide (or, with "Insert on a new slide", a new slide on the same template layout; the selected one unchanged).
  A recognised design is rebuilt in the content area in Napkin's OWN ARRANGEMENT (V10.8): items around a hub stay a
  ring or a fan in the same directions, a row stays a row, a column a column, a grid a grid, and each item keeps its look
  (card, pillar, icon badge or plain text), icon, colour and wording; text is measured first, 22 pt and up, Open Sans,
  approved colours. Number badges Napkin adds to unordered content are dropped (no invented order). Only when the
  arrangement cannot be drawn readably is it rebuilt as cards, and the result says so. A sequence keeps your order
  with arrows. Any other design is converted shape by shape. The preview is exactly what is inserted.
- Only usable designs are shown. A variation that shows only part of your content, cannot be repaired, or repeats an
  earlier design is named in one line with the reason (no preview); its file stays on this PC. The request asks Napkin
  for the whole content in one professional visual; a question heading it invents ("Which ... ?") is replaced by your
  title. The content check runs again on the rebuilt objects.
- A record of labelled values ("Project ID: V10_TEST_2026", "Formula:" with the formula under it, a list of
  requirements): every value must appear exactly in a result; a usable result is redrawn from your text in Napkin's
  arrangement (field table, key-value pairs or cards) with its colours, so special characters and figures stay exact.
- Explanatory prose (Educational content): the result must show the ideas the text states (e.g. "Created by educators",
  "Engage, inspire and inform"), the same ones the built-in suggestions use; descriptive words ("Education-focused") are
  not required; a shortened form of a stated list ("Versatile and accessible") counts.
- Limits: no local cap unless the administrator sets one (access.json). Napkin limits requests per plan and reports them in
  X-RateLimit-* headers (shown when seen); 429 and 402 (no credits) are explained, never retried. Napkin has no API for
  the credit balance: see app.napkin.ai > Account settings.

LIMITATIONS
- The PowerPoint JavaScript API cannot draw curves or set paragraph line spacing; charts are native shapes, not
  chart objects. A rebuilt Napkin result keeps Napkin's arrangement, item look, wording, icons and colours, not its
  exact drawing: curved connectors and decorative illustrations (figures, globes) are not redrawn, a half-disc hub
  becomes a native ellipse; Napkin icons are pictures (right-click > Convert to Shape to edit).
- Text stays at 22 pt or more everywhere. The guidelines (p. 43) also allow 18 pt for infographic titles and
  descriptions; the tool does not use that exception.
- Checks are geometric and text-based; they cannot judge every design choice in a Napkin visual.
- The built-in suggestions are computed in the panel (no credits); the panel host enforces access for Napkin (paid).
