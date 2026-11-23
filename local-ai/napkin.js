/* AI Visual Builder 10.10 - optional generators: Napkin AI (https://api.napkin.ai/) and, for comparison, Claude (Anthropic
   API, claude_visual.py). Each is off until its key is configured, and each gets its own panel built by makePanel below.
   The keys stay in the panel host (server.py); this file only talks to /api/napkin/* and /api/claude/* on localhost.
   Every request is paid, so it needs the "paid" tick and a click; nothing is sent automatically, nothing is retried.
   Both go through the same process, so their results can be compared on equal terms:
   - Before sending: the text must be meaningful (understand.js) and is sent structured from the analysis (points in
     their order, in the text's own words), with the same guidance (`context`).
   - 1 visual or 4 variations (Napkin: more varied layouts; Claude: one arrangement per variation); all are listed.
   - After: each variation is checked for missing source points and for layout faults (overlapping labels, text on
     icons or connectors, overlapping circles, large decorative illustrations, outline-only graphics; svg2ppt.js
     visualQuality), rebuilt in the template (rebuild.js) and checked again. Unusable ones are excluded from insertion.
   - Napkin only: the one approved Simplilearn style, applied by server.py; the panel checks that the answer carries it.
     Claude gets the brand rules (palette, Open Sans, 22 pt) in its instructions and returns SVG only.
   - SVG output goes in as native PowerPoint shapes where possible (svg2ppt.js); PPT output as Napkin's own slides,
     with Open Sans applied to their text.
   - V10.12.2: "Original editable" - the original design drawn as native, editable objects (faithful.js): its look kept,
     text, boxes, circles and connectors editable, only icons and illustrations pictures (counted), continuation slides
     for a tall design.
   - V10.12.1: a drawn result (Napkin's SVG) goes in as the editable version (the default), as the original design (one
     SVG picture, original.js) or both, on two new slides; each version is validated on its own and the other can still
     be inserted when one fails.
   - V10.12: every result's plan is kept on this PC and drawn again in the panel's step 5 (studio.js: more designs,
     several slides, edits) with no new request; inserted visuals carry tags and a record so they can be edited later.
   - V10.11: one Generate action per provider, no format choice: Napkin's SVG (the most faithful and editable in our
     tests; its PowerPoint export stays available internally) and Claude's design specification (one request; plan.js
     and the design packs draw up to 4 structurally different layouts from it, each measured at 22 pt and checked).
     1 visual or 4 variations: a result with fewer usable variations than asked is completed with layouts drawn here
     from its own items, at no extra cost, and they are marked as such. Before a request, a free check shows which
     layouts the content fits at 22 pt. Loaded after v10.html's scripts, gallery.js, understand.js, brand.js, svg2ppt.js,
     rebuild.js and plan.js. */
const PANEL_VERSION = '10.20.0';      // must match server.py VERSION; a different host version is reported in the panel
const shortId = id => id ? `${id.slice(0, 4)}…${id.slice(-4)}` : '';
/* Claude's time, tokens and estimated cost (from the prices in claude.json; the bill is in platform.claude.com). */
const costText = c => `${c.model}${c.effort ? ' (effort ' + c.effort + ')' : ''}: ${c.seconds} s, ${c.usage.input_tokens} input + ${c.usage.output_tokens} output tokens` +
  (c.usd != null ? `, about US$ ${Number(c.usd).toFixed(c.usd < 0.1 ? 4 : 2)}` : '');
const PROVIDERS = {
  napkin: { key: 'napkin', name: 'Napkin AI', short: 'Napkin', branded: true, polls: 60, free: 'no credits',
    // the format is chosen here (the first): SVG keeps Napkin's composition, positions and icons most faithfully and
    // converts to native shapes; Napkin's PowerPoint export stays supported (cached results, tests)
    fmts: ['svg', 'ppt'],
    paid: 'uses Napkin credits (4 variations may use more)',
    info: st => st.enabled
      ? `Sends the text from step 1 to Napkin AI and uses your Napkin credits. Your key stays on this PC (never in this panel). The approved Simplilearn brand style (${shortId(st.style_id)}) is applied automatically.`
      : st.configured ? 'Napkin AI is switched off. Run configure-napkin.ps1 -Enable to switch it on.'
      : 'Not configured. To use it, double-click "Configure Napkin AI.bat" in the local-ai folder and paste your Napkin API token.',
    /* Local caps (the administrator's policy) and what Napkin itself last reported about its plan limits. */
    usage: st => {
      const r = st.rate || {}, out = [`This PC today: ${st.used_today} Napkin request${st.used_today === 1 ? '' : 's'} ` + (st.max_per_day ? `of ${st.max_per_day} (local cap set by the administrator)` : "(no local cap; Napkin's plan limits and credits apply)") +
        (st.max_per_user_per_day ? `; yours: ${st.mine_today} of ${st.max_per_user_per_day}` : '') + '.'];
      if (r['X-RateLimit-Limit']) out.push(`Napkin's plan limit (last seen ${r.seen_at}): ${r['X-RateLimit-Remaining']} of ${r['X-RateLimit-Limit']} left per ${r['X-RateLimit-Window'] || 'window'}.`);
      out.push('Credits per request depend on your Napkin plan; the balance is shown in app.napkin.ai › Account settings (Napkin has no API for it).');
      return out.join(' ');
    } },
  // Claude answers in one go (up to a few minutes for 4 variations), so the panel waits longer than for Napkin
  claude: { key: 'claude', name: 'Claude AI', short: 'Claude', branded: false, polls: 120, free: 'no cost',
    // the design specification (one request for 1 or 4 variations); Claude's own SVG drawings stay supported (cached results, tests)
    fmts: ['plan', 'svg'],
    paid: 'is billed to your Anthropic account by tokens (one request, whether 1 visual or 4 variations)',
    info: st => st.enabled
      ? `Sends the text from step 1 to Claude (${st.model}, effort ${st.effort}) through the Anthropic API, billed to your Anthropic account` +
        (st.prices ? ` (about US$ ${st.prices[0]} per million input and ${st.prices[1]} per million output tokens)` : '') +
        '. One request: Claude analyses the content (what each point is, how they relate, which objects depict them) and designs the visuals; they are drawn here as editable shapes, each checked before it is offered. No automatic retries. Your key stays on this PC (never in this panel).'
      : st.configured && !st.sdk ? 'The anthropic Python package is missing on this PC: run "py -m pip install anthropic", then restart the panel host.'
      : st.configured ? 'Claude is switched off. Run configure-claude.ps1 -Enable to switch it on.'
      : 'Not configured. To use it, double-click "Configure Claude.bat" in the local-ai folder and paste your Anthropic API key.',
    usage: st => `This PC today: ${st.used_today} Claude request${st.used_today === 1 ? '' : 's'} ` + (st.max_per_day ? `of ${st.max_per_day} (local cap set by the administrator)` : "(no local cap; your Anthropic account's limits apply)") +
      (st.max_per_user_per_day ? `; yours: ${st.mine_today} of ${st.max_per_user_per_day}` : '') + '. Token use per request is shown with each result; the cost is in platform.claude.com › Usage.' }
};
const PANELS = {};
/* The panel's own analysis as a plan (the free layout check before a request). */
function planFromPrep(prep) {
  // 10.15: content written as labelled sections ("What you learn" / "Best for"): one named group per section
  if (prep.sections && prep.sections.length && typeof sectionsPlan === 'function') return sectionsPlan({ title: prep.title, full: prep.full || prep.title, short: prep.short, sections: prep.sections, statement: prep.statement, paragraph: prep.paragraph, lead: prep.lead, intro: prep.intro });
  const sc = t => typeof sentenceCase === 'function' && !prep.record ? sentenceCase(t) : t;   // 10.19: LVC sentence case (brand.js); exact records as written
  const items = (prep.points || []).map((p, i) => ({ id: 'p' + i, label: sc(planClean(p.label)), detail: planClean(p.exact || p.detail || ''), group: '' })).filter(i => i.label);
  planIcons(items);
  // 10.21.1: two points whose descriptions are short lists ("SQL: fixed schema, vertical scaling" / "NoSQL: flexible schema,
  // horizontal scaling") are two sides with their attributes: compared side by side when the text compares them (a known
  // pair, "vs", or the same attributes on both sides), each attribute its own point, worded as written
  if (items.length === 2 && typeof sectionsPlan === 'function' && typeof planRelation === 'function') {
    const parts = items.map(i => String(i.detail || '').replace(/[.]\s*$/, '').split(/\s*[,;]\s*(?:and\s+)?|\s+and\s+/).map(t => t.trim()).filter(Boolean));
    if (parts.every(p => p.length >= 2 && p.length <= 6 && p.every(t => t.split(/\s+/).length <= 6))) {
      const r = planRelation({ title: prep.title, full: prep.full, items, groups: items.map(i => i.label), groupItems: parts });
      if (r.relation === 'comparison')
        return sectionsPlan({ title: prep.title, full: prep.full || prep.title, short: prep.short, sections: items.map((it, k) => ({ name: it.label, items: parts[k].map(t => ({ label: t.charAt(0).toUpperCase() + t.slice(1) })) })) });
    }
  }
  // 10.21.1: the relation the text states (planRelation: its structure first, then wording about the whole set) opens the
  // layouts made for it; the order is kept as the flow; the reason goes with the plan (relationWhy)
  const rel = typeof planRelation === 'function' ? planRelation({ title: prep.title, full: prep.full, items, ordered: !!prep.ordered }) : { relation: '', why: '' };
  const said = rel.relation;
  const relation = /^(cycle|funnel|layers)$/.test(said) ? said : prep.ordered || /^(sequence|timeline)$/.test(said) ? 'sequence' : 'independent';
  const flow = prep.ordered || /^(cycle|funnel|sequence|timeline)$/.test(said) ? items.map(i => i.id) : [];
  return planSemantics({ title: prep.title || '', relation, relationWhy: rel.why || '', items, groups: [], flow, layouts: [], from: 'text' });
}
/* A plan layout drawn again for the free part of the slide it goes on (the same measuring and checks as the preview). */
function planBuildFor(it, rect) {
  const r = planRender(it.density === 'names' ? planNames(it.plan) : it.plan, it.layout, Object.assign({}, rect));
  if (!r.ok) throw new Error(`the ${it.conv.arrangement} layout does not fit the free part of this slide (${r.why})`);
  return Object.assign(planBuildResult(r), { added: it.conv.added || [] });
}

function makePanel(P) {
  const $p = s => $(P.key + s);
  const panelEl = document.createElement('div');
  panelEl.className = 'panel';
  panelEl.id = P.key + 'Panel';
  panelEl.innerHTML = `<details id="${P.key}Box"><summary><b>${P.name}</b> <span class="small">AI generation (optional, paid)</span> <span class="small" id="${P.key}State"></span></summary>
    <div class="small" id="${P.key}Info" style="margin:6px 0"></div>
    <div id="${P.key}Controls" hidden>
      <div class="small" style="margin:6px 0 2px"><b>How many</b></div>
      <select id="${P.key}Var" aria-label="Number of visuals"><option value="1" selected>1 visual</option><option value="4">4 variations</option></select>
      <div id="${P.key}Pre" class="small" style="margin:4px 0" hidden></div>
      <label class="check"><input type="checkbox" id="${P.key}Ok"> <span>I understand this sends the text in step 1 to ${P.name} and ${P.paid}.</span></label>
      <div id="${P.key}ModeBox" class="small" style="margin:6px 0 2px" hidden><b>What to insert</b><br>
        <select id="${P.key}Mode" aria-label="What to insert"><option value="edit" selected>Editable version (native PowerPoint shapes)</option>
          <option value="origedit">Original ${P.short} design, editable (native shapes and text)</option>
          <option value="orig">Original ${P.short} design (one picture)</option><option value="both">Both: editable, then original, on two new slides</option></select></div>
      <div class="btn-row"><button id="${P.key}Go" class="secondary" type="button" disabled>Generate visuals with ${P.name}</button>
        <button id="${P.key}Insert" class="secondary" type="button" hidden>Insert ${P.short} result</button>
        <button id="${P.key}Last" class="secondary" type="button" hidden>Re-check last ${P.short} result (${P.free})</button></div>
      <button id="${P.key}More" class="secondary" type="button" hidden>More designs and slides from this result (no cost)</button>
      <details id="${P.key}SentBox" hidden><summary>Text sent to ${P.short}</summary><div id="${P.key}Sent" class="brief"></div></details>
      <div id="${P.key}Pick" class="small" hidden></div>
      <div id="${P.key}Preview" class="grid" hidden></div>
      <details id="${P.key}RejectedBox" hidden><summary id="${P.key}RejectedSum"></summary>
        <div class="small" style="margin:4px 0">For inspection only: these cannot be inserted. The picture is the result as ${P.short} returned it.</div>
        <div id="${P.key}Rejected" class="grid"></div></details>
      <div id="${P.key}Note" class="small" hidden></div>
      <div id="${P.key}Usage" class="small" style="margin-top:6px"></div>
    </div></details>`;
  const after = P.key === 'napkin' ? $('step3') : $('napkinPanel');
  after.parentNode.insertBefore(panelEl, after.nextSibling);
  // result: { fmt, asked, items: [{ n, data (svg text | base64 pptx), conv, check, pptInfo }], failed: [] }
  const N = { busy: false, result: null, sel: 0 };

  // Always shown, so a provider never disappears without a reason: with no panel host, or one that predates this
  // provider (an outdated copy still running), the section says so and how to fix it instead of being hidden.
  const render = () => {
    const st = state.svc && state.svc[P.key];
    $p('Panel').hidden = false;
    if (!st) {
      $p('State').textContent = '(not available)';
      $p('Info').textContent = !state.svc
        ? 'The panel host is not answering on this PC. Double-click "Start AI Visual Builder.bat" in the local-ai folder, then close and reopen this panel.'
        : `The panel host running on this PC is version ${state.svc.server || 'unknown'}, older than this panel (${PANEL_VERSION}), so it does not offer ${P.name}. ` +
          'Double-click "Restart AI Visual Builder.bat" in the local-ai folder, then close and reopen this panel.';
      $p('Controls').hidden = true;
      return;
    }
    $p('State').textContent = !st.enabled ? '(off)' : st.used_today == null ? '(on)' : `(on · ${st.used_today}${st.max_per_day ? ' of ' + st.max_per_day : ''} request${st.used_today === 1 ? '' : 's'} today)`;
    $p('Info').textContent = (state.svc.server !== PANEL_VERSION ? `Note: the panel host is version ${state.svc.server}, this panel ${PANEL_VERSION}; run "Restart AI Visual Builder.bat". ` : '') + P.info(st);
    $p('Controls').hidden = !st.enabled;
    $p('Usage').innerHTML = st.used_today == null ? '' : esc(P.usage(st));
    napkinButtons();
  };
  // the editable version can go in; the original design can go in (validated on its own, original.js); either can
  const usable = it => !!it && !it.check.excluded && !(it.quality && it.quality.excluded) && !it.sameAs;
  const origOK = it => !!it && !!it.orig && it.orig.ok && !it.orig.block.length && !it.sameAs;
  const feOK = it => !!it && !!it.fe && it.fe.ok && !it.fe.block.length && !it.sameAs;
  const offered = it => usable(it) || origOK(it) || feOK(it);
  const hasOrig = () => !!N.result && N.result.items.some(i => i.orig && i.orig.ok);
  const modeOf = () => hasOrig() ? $p('Mode').value : 'edit';
  const canMode = (it, m) => m === 'orig' ? origOK(it) : m === 'origedit' ? feOK(it) : m === 'both' ? usable(it) && origOK(it) : usable(it);
  const MODE_NAMES = { edit: 'Editable version (native PowerPoint shapes)', origedit: `Original ${P.short} design, editable (native shapes and text)`, orig: `Original ${P.short} design (one picture)`, both: 'Both: editable, then original, on two new slides' };
  const VERSION_NAMES = { edit: 'editable version', origedit: 'editable original design', orig: 'original design' };
  function napkinButtons() {
    const st = state.svc && state.svc[P.key], has = !!$('content').value.trim();
    $p('Go').disabled = !(st && st.enabled && (!P.branded || st.style_id)) || !$p('Ok').checked || !has || N.busy || !gateOK();
    $p('Last').hidden = !(st && st.enabled && st.last); $p('Last').disabled = !has || N.busy || !gateOK();
    const it = N.result && N.result.items[N.sel], mode = modeOf();
    $p('ModeBox').hidden = !hasOrig();
    [...$p('Mode').options].forEach(o => { o.textContent = MODE_NAMES[o.value] + (it && !canMode(it, o.value) ? ' - not available for this variation' : ''); });
    $p('Insert').hidden = !N.result || !N.result.items.length;
    $p('Insert').textContent = !hasOrig() ? `Insert ${P.short} result` : mode === 'orig' ? `Insert original ${P.short} design` : mode === 'both' ? 'Insert both (2 new slides)'
      : mode === 'origedit' ? `Insert original, editable${it && it.fe && it.fe.ok && it.fe.parts.length > 1 ? ` (${it.fe.parts.length} slides)` : ''}` : 'Insert editable version';
    $p('Insert').disabled = !state.inOffice || N.busy || !canMode(it, mode) || !gateOK();
    $p('More').hidden = !resultPlan(); $p('More').disabled = N.busy;
  }
  /* The result's content plan (drawn again in step 5 without a request): Claude's design, or the items of a drawing. */
  function resultPlan() {
    const R = N.result;
    if (!R || !R.items.length) return null;
    const it = R.items.find(i => i.plan && usable(i)) || R.items.find(i => i.plan);
    if (it) return { plan: it.plan, name: `${P.name} result (request ${shortId(it.rid || '')})${it.local ? `: the items of variation ${it.fromN}` : ''}` };
    const d = R.items.filter(usable).concat(R.items).find(i => !i.check.excluded);
    try {
      const st = d && napkinStructure(d, d.drop), plan = st && planFromStructure(st, { ordered: d.ordered, order: d.order, title: d.title || napkinHeading(d) });
      return plan ? { plan, name: `${P.name} result (request ${shortId(d.rid || '')}): the items of variation ${d.n}` } : null;
    } catch (e) { return null; }
  }
  // the format is the provider's own (N.fmt only for tests of the formats kept for compatibility)
  const fmtOf = () => N.fmt || P.fmts[0];
  /* Before a paid request: which layouts the content fits at 22 pt (free, local). With its full descriptions and with
     labels only; the content plan asks Claude for short descriptions in the text's own words. */
  let preFor = '', preRun = null;
  function preflight() {
    const text = $('content').value.trim(), el = $p('Pre');
    if (!$p('Ok').checked || !text) return Promise.resolve();
    const asked = +$p('Var').value === 4 ? 4 : 1;
    if (preFor === text + fmtOf() + asked) return preRun;          // the same check, still running or done
    preFor = text + fmtOf() + asked; el.textContent = 'Layout check before sending (free): checking…'; el.hidden = false;
    return (preRun = (async () => { try {
      const prep = await prepared(text);
      if (prep.error || prep.record || !(prep.points || []).length) { el.hidden = true; return; }
      const R = Object.assign({}, TEMPLATE.contentArea), P0 = planFromPrep(prep), full = planVariations(P0, R, 4).list;
      const bare = planVariations(Object.assign({}, P0, { items: P0.items.map(i => Object.assign({}, i, { detail: '' })) }), R, 4).list;
      el.innerHTML = esc(`Layout check before sending (free): ${prep.points.length} points. At 22 pt, ${full.length || 'no'} layout${full.length === 1 ? '' : 's'} fit${full.length === 1 ? 's' : ''} with your full descriptions` +
        (full.length ? ` (${full.map(r => r.name).join(', ')})` : '') + `; ${bare.length} with the point names only.` +
        (fmtOf() === 'plan' ? ` ${P.name} shortens each description to its key words, so it usually fits more layouts.` : !full.length && !bare.length ? ' This content is long for one slide; a result may not fit at 22 pt.' : ''));
      el.hidden = false;
    } catch (e) { el.hidden = true; } })());
  }
  $p('Ok').addEventListener('change', () => { napkinButtons(); preflight(); }); $('content').addEventListener('input', napkinButtons);

  /* ---------- before sending: meaningful text, structured from the analysis in its own words ---------- */
  async function prepared(text) {
    // 10.15/10.16: labelled sections, or one statement with a list (sections.js), are sent and checked as their parts
    const SX0 = typeof contentRead === 'function' ? contentRead(text) : null;
    if (SX0) { if (state.runText !== text || !state.sections.length) await analyseContent(); return Object.assign(sectionsPrep(SX0, text), { full: SX0.full }); }
    const q = contentQuality(text);
    if (!q.ok) return { error: QUALITY_MSG };
    if (state.runText !== text || !state.sections.length) await analyseContent();
    // 10.15: a title with labelled sections is sent (and checked) as its sections and their items (sections.js)
    const SX = typeof sectionsRead === 'function' ? sectionsRead(text) : null;
    if (SX) return Object.assign(sectionsPrep(SX, text), { full: SX.full });
    const S = state.sections.filter(s => s.status === 'ready' && s.model && s.model.type !== 'none');
    if (!S.length) return { error: QUALITY_MSG };
    const concepts = [], parts = [], points = [], headings = [], topics = [];
    let ordered = false, list = false, record = null;
    S.forEach(s => {
      const sc = s.scene || (s.scene = sceneOf(s));
      if (sc && sc.topic) topics.push(sc.topic);
      if (sc && sc.record) {
        // a record: sent as written; every field's value must appear exactly (special characters, figures, formula,
        // condition), every list item as a point; the rebuild draws them from the text itself
        parts.push(s.heading && !s.text.startsWith(s.heading) ? s.heading + '\n' + s.text : s.text);
        const rec = sc.record;
        concepts.push(...rec.fields.map(f => f.label), ...rec.lists.flatMap(l => l.items));
        points.push(...rec.fields.map(f => ({ label: f.label, detail: f.value, exact: f.value })), ...rec.lists.flatMap(l => l.items.map(t => ({ label: t, detail: '' }))));
        record = rec; list = true;
      } else if (sc && sc.prose && sc.n >= 2) {
        // explanatory prose: sent in its own words; the ideas it states (the same ones every built-in suggestion shows,
        // gallery.js proseScene) are what a result must show. Descriptive words ("Education-focused") are not ideas.
        parts.push(s.text);
        concepts.push(...sc.items.map(it => it.label));
        points.push(...sc.items.map(it => ({ label: it.label, detail: it.source || '', members: it.members || [] })));
        headings.push(...(s.heading ? [s.heading] : []));
        list = true;
      } else if (sc && sc.mode === 'items' && sc.n >= 2 && !sc.items.every(sentenceLike)) {
        // a list: each point exactly as written, numbered only when the text gives an order; an introduction is sent as
        // context but is not a point the result must show (gallery.js contentPoints)
        const intro = (sc.intro || []).filter(t => t.toLowerCase() !== String(s.heading).toLowerCase());
        parts.push((s.heading ? s.heading + '\n' : '') + (intro.length ? intro.join(' ') + '\n' : '') + sc.items.map((it, i) => (sc.ordered ? `${i + 1}. ` : '- ') + it.label + (it.detail ? ': ' + it.detail : '')).join('\n'));
        concepts.push(...sc.items.map(it => it.label));
        points.push(...sc.items.map(it => ({ label: it.label, detail: it.detail || '' })));
        headings.push(...(sc.headings || []), ...(s.heading ? [s.heading] : []));
        ordered = ordered || sc.ordered; list = true;
      } else {
        parts.push(s.text);                                      // statements, tables, data: the original wording
        concepts.push(...(sc && /relation|definition/.test(sc.mode) ? sc.items.map(it => it.label) : sc && sc.mode === 'items' ? keyTerms(s.text).slice(0, 6) : s.model.concepts.slice(0, 6)));
      }
    });
    const uniq = [...new Set(concepts)].filter(Boolean);
    // guidance for Napkin's `context` (documented: informs the generation, is not drawn as content)
    const context = (topics[0] ? `Topic: ${topics[0]}. ` : '') + (list ? (ordered
      ? `Show these ${uniq.length} steps in this order: ${uniq.join('; ')}.`
      : `Show these ${uniq.length} ideas as separate, independent items with no numbering and no sequence: ${uniq.join('; ')}.`) : '') +
      ' Show the whole content in one visual (never only a part of it), as a clean professional infographic: no question' +
      ' or quiz heading, no decorative illustrations or devices. Use the wording of the text; do not add facts, figures or items.';
    return { content: parts.join('\n\n'), concepts: uniq, ordered, list, points, headings, source: text, context: context.trim().slice(0, 900), record: S.length === 1 ? record : null, title: topics[0] || '' };
  }

  /* ---------- after: does the variation's text cover the source concepts? (no visual semantics are assumed) ---------- */
  /* A point is a concept: its label, and for a described point also what it is about. Covered when the result shows the
     label (most of its words, its distinctive words, or its head noun), or - for a point with a description - its own
     subject word ("Cloud weight" for "Single cloud: A single cloud typically weighs ...") or most of its description's
     distinctive words. Word forms count as the same word (v10.html sameWord). Napkin's own heading (`o.heading`) is not
     checked for invented words; a figure that is not in the source is an error. */
  function accuracy(prep, texts, o) {
    o = o || {};
    const { concepts, ordered } = prep, source = prep.content;
    // exact comparison: case, spaces (Napkin wraps "automation@exam ple.com") and typographic quotes do not count
    const flat = t => String(t).toLowerCase().replace(/[“”″]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, '');
    const all = texts.join(' \n '), outStems = new Set(words(all).map(stem)), fam = new Set([...outStems].map(family).filter(Boolean));
    // A point is covered by most of its words, or by all of its distinctive ones: "Preprocessing" for "Data preprocessing"
    // when "data" is shared with "Data collection".
    const stemsOf = c => words(c).map(stem).filter(w => w.length >= 3);
    const shared = w => concepts.filter(c => stemsOf(c).includes(w)).length > 1;
    // or by its head noun (the last word) when no other point has it: "Code" for "Computer code" and the reverse
    const outWords = texts.map(t => stemsOf(t)), headIn = (h, phrase) => phrase.length && phrase[phrase.length - 1] === h;
    const pointOf = c => (prep.points || []).find(p => p.label === c), has = w => inSource(w, outStems, fam);
    const detailWords = c => { const p = pointOf(c); return p && p.detail ? [...new Set(stemsOf(p.detail).filter(w => w.length >= 4 && !/^\d/.test(w)))] : []; };
    const otherDetails = c => new Set(concepts.filter(x => x !== c).flatMap(detailWords));
    const covered = c => { const ws = stemsOf(c), own = ws.filter(w => !shared(w)), head = ws[ws.length - 1], p = pointOf(c);
      // an idea stated as a list of qualities or actions ("Versatile, accessible and informational") is shown when one of
      // them is (a shortened label is the same idea)
      if (p && p.members && p.members.length >= 2 && p.members.some(m => stemsOf(m).some(has))) return true;
      if (p && p.exact) return flat(all).includes(flat(p.exact));     // a value is shown exactly or not at all
      if (!ws.length || ws.filter(has).length / ws.length >= 0.6 || own.length > 0 && own.every(has)
        || !!head && !shared(head) && outWords.some(o => headIn(head, o) || (o.length === 1 && ws.includes(o[0]) && !shared(o[0])))) return true;
      const dw = detailWords(c);
      if (!dw.length) return false;
      // a described point: its own subject word anywhere in the result, or most of the words only its description has
      if (own.some(w => w.length >= 4 && has(w) && !otherDetails(c).has(w))) return true;
      const mine = dw.filter(w => !otherDetails(c).has(w));
      return mine.length >= 2 && mine.filter(has).length / mine.length >= 0.5; };
    const missing = concepts.filter(c => !covered(c)), n = concepts.length || 1, coverage = (n - missing.length) / n;
    const srcStems = new Set(words(source).map(stem)), srcFam = new Set([...srcStems].map(family).filter(Boolean));
    // words of a short label whose head noun is a source point ("Computer code" for "Code") are the same label, not invented
    const heads = new Set(concepts.map(c => stemsOf(c).slice(-1)[0]).filter(Boolean)), variant = new Set(texts.filter(t => { const o = stemsOf(t); return o.length <= 3 && heads.has(o[o.length - 1]); }).flatMap(t => words(t)));
    const checked = texts.filter(t => !o.heading || t.trim() !== o.heading.trim()).join(' \n ');
    const extra = [...new Set(words(checked).filter(w => w.length >= 5 && !/^\d/.test(w) && !STRUCT_WORDS.has(w) && !variant.has(w) && !inSource(stem(w), srcStems, srcFam)))].slice(0, 8);
    // figures: a value with a decimal point or two or more digits that the source does not have (step numbers 01-10 aside)
    const nums = t => (String(t).match(/\d+(?:[.,]\d+)?/g) || []).map(x => x.replace(',', '.'));
    const srcNums = new Set(nums(prep.source || source).concat(nums(source)));
    const wrongNums = [...new Set(nums(all).filter(x => (/\./.test(x) || x.replace(/^0+/, '').length >= 2) && !/^0\d$|^10$/.test(x) && !srcNums.has(x)))];
    let order = '';
    if (ordered && texts.length && concepts.length >= 3 && !missing.length) {
      const at = concepts.map(c => texts.findIndex(t => { const ts = new Set(words(t).map(stem)), ws = stemsOf(c), own = ws.filter(w => !shared(w));
        return ws.length && (ws.filter(w => ts.has(w)).length / ws.length >= 0.6 || own.length > 0 && own.every(w => ts.has(w))); }));
      // a rising staircase or a bottom-up stack lists its steps last-to-first: the same order, read upwards
      order = at.every((v, i) => i === 0 || v >= at[i - 1]) ? 'the points appear in the stated order'
        : at.every((v, i) => i === 0 || v <= at[i - 1]) ? 'the points appear in the stated order (read upwards)' : 'check the order of the steps';
    }
    // complete: every point is there. correctable: some categories of an unordered list are missing; they are added on
    // insertion as editable cards. unusable: a step of a sequence is missing (adding it beside the visual would break the
    // order), most points are missing, or prose clearly misses its subject.
    const add = (prep.points || []).filter(p => missing.includes(p.label)), got = concepts.length - missing.length;
    // complete only with nothing missing. Correctable: independent items missing that can be added as items of the same
    // infographic, as long as Napkin's own part still carries the visual (at most one more missing than shown).
    // Unusable: a step of a sequence missing, or most of the content missing. Partial: text that is not a list misses
    // something (named, never hidden).
    const status = wrongNums.length ? 'unusable' : !missing.length ? 'complete'
      : prep.list ? (!prep.ordered && got >= 1 && missing.length <= got + 1 && add.length === missing.length ? 'correctable' : 'unusable')
      : coverage < 0.5 ? 'unusable' : 'partial';
    const excluded = status === 'unusable';
    const why = status === 'unusable' && prep.list && prep.ordered && missing.length ? ' (a step of the sequence cannot be added beside it)' : '';
    const notes = [`covers ${n - missing.length} of ${concepts.length} source points`].concat(missing.length ? [`missing: ${missing.slice(0, 4).join(', ')}` + (status === 'correctable' ? ' (added to the infographic on insertion)' : why)] : [],
      wrongNums.length ? [`figure${wrongNums.length > 1 ? 's' : ''} not in your content: ${wrongNums.join(', ')}`] : [],
      extra.length ? [`text not in your content: ${extra.join(', ')}`] : [], order ? [order] : []);
    return { coverage, missing, extra, excluded, status, add: status === 'correctable' ? add : [], flagged: !excluded && (missing.length > 0 || extra.length > 0 || /check/.test(order)), notes };
  }

  /* Text, fonts, layout checks and a preview of each slide of a .pptx (pptx.js). */
  async function pptxInfo(b64) {
    const m = await pptxRead(b64);
    if (!m) return null;
    const out = { texts: m.texts, small: m.small, fonts: m.fonts, quality: { block: [], warn: [], excluded: false }, slides: m.slides.length, notes: [] };
    m.slides.forEach((sl, i) => {
      const items = pptxQualityItems(sl.els), q = visualQuality(items, m.R);
      out.quality.block.push(...q.block); out.quality.warn.push(...q.warn);
      const dark = items.filter(x => x.dark).length;
      if (dark) out.quality.warn.push(`${dark} icon${dark > 1 ? 's are' : ' is'} black (the guidelines prefer flat colour icons)`);
      if (i === 0) { out.slide = sl; out.R = m.R; out.notes = sl.notes; }
    });
    out.quality.block = [...new Set(out.quality.block)]; out.quality.warn = [...new Set(out.quality.warn)];
    out.quality.excluded = out.quality.block.length > 0;
    return out;
  }

  /* ---------- create: one request with the approved style; the answer must confirm it ---------- */
  async function runNapkin(prep, fmt, variations, asked) {
    const st = state.svc[P.key];
    const slide = state.slide && { layout_name: state.slide.layout_name, layout_id: state.slide.layout_id, master_name: state.slide.master_name, master_id: state.slide.master_id, fingerprint_ok: state.slide.fingerprint_ok };
    const repeat = N.repeatOf === prep.content + '|' + fmt + '|' + variations;   // asked again after the duplicate notice
    const job = await api(`/api/${P.key}/visual`, { content: prep.content, context: prep.context, source: $('content').value.trim(), format: fmt, variations, confirmed: true, slide, repeat, ordered: !!prep.ordered }, 70000);
    N.repeatOf = null;
    if (!job.id) throw new Error(`${P.name} did not return a request id.`);
    if (P.branded && (job.style_id !== st.style_id || job.style_rejected)) throw new Error('the request did not carry the approved Simplilearn brand style (nothing inserted).');
    job.asked = asked || variations;
    return collect(job, prep, fmt);
  }
  /* The files of a request (new, or the last one kept by the panel host), each checked against the current text. */
  async function collect(job, prep, fmt) {
    if (fmt === 'plan') return collectPlan(job, prep, job.asked);
    let s = null;
    for (let i = 0; i < P.polls; i++) {                          // Napkin: at most ~3 minutes; Claude: ~6 minutes
      if (i || !job.last) await new Promise(r => setTimeout(r, 3000));
      s = await api(`/api/${P.key}/status?id=` + encodeURIComponent(job.id), null, 30000);
      job.style_id = job.style_id || s.style_id;
      setStatus(`${P.name} is working (${s.status || 'pending'})…`);
      if (s.style_rejected) throw new Error('Napkin did not accept the approved brand style; its default-style result is blocked (no credits are spent again).');
      if (/complete|done|success/i.test(s.status || '') && s.files) break;
      if (/fail|error/i.test(s.status || '')) throw new Error(`${P.name} reported: ` + (s.error && (s.error.message || s.error) || s.status));
    }
    if (!s || !s.files) throw new Error(`${P.name} did not finish within ${Math.round(P.polls * 3 / 60)} minutes.`);
    const items = [];
    for (let i = 0; i < s.files; i++) {
      const r = await fetch(`/api/${P.key}/file?id=${encodeURIComponent(job.id)}&i=${i}&format=${fmt}`, { headers: { 'X-AIVB-Client': '1' }, cache: 'no-store' });
      if (!r.ok) throw new Error(`Could not download result ${i + 1} (${r.status}).`);
      const it = { n: i + 1, styleId: job.style_id, rid: job.id, fmt, ordered: !!prep.ordered, order: prep.concepts, drop: prep.headings, source: prep.source, record: prep.record, title: prep.title };   // preview, checks and insertion all use this one item
      if (fmt === 'svg') {
        it.data = await r.text();
        if (!/<svg[\s>]/i.test(it.data)) throw new Error(`${P.name} returned something that is not an SVG picture.`);
        it.check = accuracy(prep, svgTexts(it.data), { heading: napkinHeading(it) });
      } else {
        const buf = new Uint8Array(await r.arrayBuffer());
        if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4B) throw new Error('Napkin AI returned something that is not a PowerPoint file.');
        let bin = '';
        for (let k = 0; k < buf.length; k += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(k, k + 0x8000));
        it.data = btoa(bin);
        it.pptInfo = await pptxInfo(it.data).catch(() => null);
        if (it.pptInfo) { it.pptSlide = it.pptInfo.slide; it.pptR = it.pptInfo.R; }
        // the first slide is the one that goes in, so it is the one checked
        it.check = it.pptInfo && it.pptInfo.slide && it.pptInfo.slide.texts.length ? accuracy(prep, it.pptInfo.slide.texts, { heading: napkinHeading(it) })
          : { coverage: 1, missing: [], extra: [], excluded: false, flagged: true, notes: ['its text could not be read for the accuracy check'] };
      }
      // what goes on the slide: rebuilt in the template (or converted), with the missing points in the same infographic
      const build = () => { try { return napkinBuild(it, Object.assign({}, TEMPLATE.contentArea), it.check.add || [], it.ordered, it.order, it.drop); }
        catch (e) { return { prims: [], report: null, rebuilt: false, added: [], missing: [], labels: [], empty: true }; } };
      it.conv = build();
      // the rebuild is checked against the content: every item stands for at most one point. Overlapping labels read as one
      // ("Data collection Model training") would merge points, so such a design is converted as drawn and judged as drawn.
      const merged = it.conv.rebuilt && prep.list ? it.conv.labels.filter(l => { const a = accuracy(Object.assign({}, prep, { points: [] }), [l]); return prep.concepts.length - a.missing.length >= 2; }) : [];
      if (merged.length) { it.convertOnly = true; it.conv = build(); it.check.notes.push(`not rebuilt: “${merged[0]}” combines several points`); }
      // checked again on what goes on the slide (after the rebuild and its repairs): a point Napkin showed but the rebuild
      // could not keep is named, so "Complete" always describes the inserted objects
      const onSlide = it.conv.prims.filter(p => p.text).map(p => String(p.text));
      if (onSlide.length && !it.check.excluded) {
        const after = accuracy(prep, onSlide, { heading: napkinHeading(it) }), lost = after.missing.filter(c => !(it.check.add || []).some(p => p.label === c) && !it.conv.added.includes(c));
        if (lost.length) { it.check.status = 'partial'; it.check.missing = lost; it.check.notes.push(`after the rebuild: ${lost.join(', ')} not shown on the slide`); }
      }
      if (it.conv.missing.length && it.check.status === 'correctable') {   // the design could not take them: said so, not hidden
        it.check.status = 'partial';
        it.check.notes.push(`Partially complete: ${it.conv.missing.join(', ')} could not be added to this design`);
      }
      let orig = it.pptInfo ? it.pptInfo.quality : null;
      if (fmt === 'svg') try { orig = svgToPrims(it.data, Object.assign({}, TEMPLATE.contentArea)).report.quality; } catch (e) { orig = null; }
      const q = it.conv.report ? it.conv.report.quality : { block: ['nothing in the file can be drawn on a slide'], warn: [], excluded: true };
      // Judged by what goes on the slide. Rebuilt: Napkin's own overlaps and clipping are repaired (named, not blocking);
      // converted shape by shape: they are on the slide, so they block.
      const fixed = it.conv.rebuilt && orig ? orig.block : [];
      it.quality = { block: [...new Set((it.conv.rebuilt || !orig ? [] : orig.block).concat(q.block))], warn: q.warn.concat(fixed.length ? [`repaired in the rebuild: ${fixed.join('; ')}`] : []) };
      it.quality.excluded = it.quality.block.length > 0;
      // the original design as returned (one SVG picture): its own text checked against the content, its readability
      it.orig = originalAsset(it);
      if (it.orig.ok) originalReview(it.orig, accuracy(prep, it.orig.texts, { heading: napkinHeading(it) }));
      // 10.12.2: the same design as native, editable objects (faithful.js), its text checked the same way
      it.fe = it.orig.ok ? faithfulBuild(it, Object.assign({}, TEMPLATE.contentArea)) : { ok: false, why: '' };
      if (it.fe.ok) faithfulReview(it.fe, accuracy(prep, it.fe.texts, { heading: napkinHeading(it) }));
      items.push(it);
    }
    // every variation stays listed (for inspection); one that goes on the slide exactly like an earlier one (same
    // arrangement, text and colours) is marked as the same design, so a cosmetic difference is not offered as a choice
    const seen = new Map();
    items.forEach(it => { const key = it.conv.prims.length ? signature(it.conv.prims) + it.conv.prims.map(p => (p.fill || '') + (p.text || '')).join('') : it.data.length + ':' + (it.pptInfo ? it.pptInfo.texts.join('|') : '');
      if (seen.has(key)) { it.sameAs = seen.get(key); it.check.notes.push(`the same design as variation ${it.sameAs} once rebuilt`); } else seen.set(key, it.n); });
    // fewer than 4 usable: layouts drawn here from the items of a variation whose content is right (no extra request)
    const more = moreLayouts(items, prep, job.asked || items.length);
    items.push(...more.items);
    items.skipped = more.skipped;
    items.warnings = (s.warnings || []).filter(w => !/invalid_style_id/.test(w));
    items.cost = s.usage ? { usage: s.usage, seconds: s.seconds, model: s.model, effort: s.effort, usd: s.cost_usd } : null;   // Claude: tokens, time, estimate
    return items;
  }
  /* Claude's content plan: one file (JSON). Completed with any source point it left out, then drawn in up to 4 layouts. */
  async function collectPlan(job, prep, asked) {
    let s = null;
    for (let i = 0; i < P.polls; i++) {
      if (i || !job.last) await new Promise(r => setTimeout(r, 3000));
      s = await api(`/api/${P.key}/status?id=` + encodeURIComponent(job.id), null, 30000);
      setStatus(`${P.name} is analysing the content (${s.status || 'pending'})…`);
      if (/complete|done|success/i.test(s.status || '') && s.files) break;
      if (/fail|error/i.test(s.status || '')) throw new Error(`${P.name} reported: ` + (s.error && (s.error.message || s.error) || s.status));
    }
    if (!s || !s.files) throw new Error(`${P.name} did not finish within ${Math.round(P.polls * 3 / 60)} minutes.`);
    const r = await fetch(`/api/${P.key}/file?id=${encodeURIComponent(job.id)}&i=0&format=plan`, { headers: { 'X-AIVB-Client': '1' }, cache: 'no-store' });
    if (!r.ok) throw new Error(`Could not download the content plan (${r.status}).`);
    let raw;
    try { raw = JSON.parse(await r.text()); } catch (e) { throw new Error('the content plan could not be read (not JSON).'); }
    const { plan } = planFromClaude(raw), base = { rid: job.id, source: prep.source, ordered: !!prep.ordered, order: prep.concepts, drop: prep.headings, title: prep.title, planFrom: 'Claude\'s design', max: asked || 4 };
    const done = planComplete(plan, prep), V = planItems(prep, plan, base, 1);
    // figures the plan invented: nothing of it is offered (the same rule as for drawn results)
    // the headline and takeaway too: a figure Claude invented anywhere blocks the plan
    const all = accuracy(prep, plan.items.flatMap(i => [i.label, i.detail]).concat(plan.groups.map(g => g.name), [plan.title, plan.headline, plan.takeaway]).filter(Boolean), { heading: plan.title });
    V.items.forEach(it => { if (done.length) it.conv.added = done; if (all.status === 'unusable' && /figure/.test(all.notes.join(' '))) { it.check = all; } });
    const items = V.items;
    items.skipped = V.skipped; items.plan = plan; items.warnings = (s.warnings || []).slice();
    items.cost = s.usage ? { usage: s.usage, seconds: s.seconds, model: s.model, effort: s.effort, usd: s.cost_usd } : null;
    if (!items.length) throw new Error('none of the layouts fits this content at 22 pt: ' + V.skipped.slice(0, 3).map(x => `${x.name || x.key} (${x.why})`).join('; '));
    return items;
  }
  /* Source points a plan left out become items of it, in their place (the panel draws every layout, so a step can go
     where it belongs; a full sequence keeps its flow). Returns the labels added. */
  function planComplete(plan, prep) {
    const pts = prep.points || [], shown = plan.items.flatMap(i => [i.label, i.detail]).filter(Boolean).concat([plan.title]);
    const miss = accuracy(prep, shown, { heading: plan.title }).missing, add = pts.filter(p => miss.includes(p.label));
    if (!add.length) return [];
    const fullFlow = (plan.flow || []).length === plan.items.length;
    const srcAt = i => { const s = pts.map(q => sharedWords(q.label, i.label)), m = Math.max(0, ...s); return m > 0 ? s.indexOf(m) : -1; };
    add.forEach((p, k) => {
      const d = String(p.exact || p.detail || ''), it = { id: 'add' + k, label: planClean(p.label), detail: d.length <= 60 ? planClean(d) : '', group: '', added: true };
      planIcons([it]); it.role = planRoleOf(it);
      const at = pts.indexOf(p), before = plan.items.findIndex(i => !i.added && srcAt(i) > at);
      plan.items.splice(before < 0 ? plan.items.length : before, 0, it);
    });
    if (fullFlow) plan.flow = plan.items.map(i => i.id);
    return add.map(p => p.label);
  }
  /* Layouts of a plan as panel items (preview = insertion: planRender in the slide's free area on insertion). */
  function planItems(prep, plan, base, n0) {
    const R = Object.assign({}, TEMPLATE.contentArea), V = planVariations(plan, R, base.max || 4, { names: !!base.local });
    const items = V.list.map((r, k) => {
      const it = Object.assign({ n: n0 + k, fmt: 'plan', plan, layout: r.key, data: '', density: r.namesOnly ? 'names' : 'full' }, base);
      it.conv = planBuildResult(r, { [`drawn here from ${base.planFrom}: ${r.name}`]: 1 });
      it.check = accuracy(prep, r.prims.filter(p => p.text).map(p => String(p.text)), { heading: plan.title });
      if (r.namesOnly) it.check.notes.push('the point names only: the descriptions do not fit this layout at 22 pt');
      // numbered points with functions across the flow: shown by role, not as one sequence (said, not flagged)
      if (plan.items.some(planSupport)) it.check.notes = it.check.notes.map(n => /check the order/.test(n) ? 'arranged by role: the flow in its order, the functions that apply across it beside it' : n);
      it.quality = { block: r.quality.block.slice(), warn: r.quality.warn.slice(), excluded: r.quality.excluded };
      return it;
    });
    return { items, skipped: V.skipped };
  }
  /* A drawn result's own items in other layouts, until as many are usable as were asked for: from the first variation
     whose content is right (a local replacement when the provider's own design cannot be used). */
  function moreLayouts(items, prep, asked) {
    const ok = items.filter(usable).length, want = Math.max(1, Math.min(4, asked || 4));
    if (ok >= want || prep.record) return { items: [], skipped: [] };
    const src = items.filter(it => !it.check.excluded && it.check.status !== 'partial').map(it => ({ it, st: napkinStructure(it, it.drop) }))
      .filter(x => x.st && x.st.items.length >= 2).sort((a, b) => b.st.items.length - a.st.items.length)[0];
    if (!src) return { items: [], skipped: [] };
    const plan = planFromStructure(src.st, { ordered: prep.ordered, order: prep.concepts, title: prep.title || napkinHeading(src.it) });
    if (!plan) return { items: [], skipped: [] };
    const added = planComplete(plan, prep), fam = new Set(items.filter(usable).map(it => it.conv.arrangement));
    const V = planItems(prep, plan, { rid: src.it.rid, source: prep.source, ordered: !!prep.ordered, order: prep.concepts, drop: prep.headings, title: prep.title, styleId: src.it.styleId,
      planFrom: `the items of variation ${src.it.n}`, fromN: src.it.n, local: true, max: 4 }, items.length + 1);
    const fresh = V.items.filter(it => !fam.has(it.conv.arrangement) && usable(it)).slice(0, want - ok);
    fresh.forEach((it, k) => { it.n = items.length + 1 + k; if (added.length) it.conv.added = added; });
    return { items: fresh, skipped: V.skipped };
  }
  async function create() {
    const fmt = fmtOf(), text = $('content').value.trim(), asked = +$p('Var').value === 4 ? 4 : 1, variations = fmt === 'plan' ? 1 : asked;
    if (N.busy) return;                                             // one click, one request
    N.busy = true; napkinButtons();
    $p('Ok').checked = false;                                 // one confirmation per request
    let prep = null;
    try {
      if (!(await ensureGate())) return;                            // authorized user on the approved Content Slide
      prep = await prepared(text);
      if (prep.error) { setStatus(prep.error, true); return; }       // nothing sent, no credits used
      N.result = null; N.sel = 0;
      ['Preview', 'Pick', 'Note'].forEach(id => { $p(id).hidden = true; $p(id).innerHTML = ''; });
      $p('Sent').textContent = prep.content;
      $p('SentBox').hidden = false;
      setStatus(`Sending the text to ${P.name}…`);
      const got = await runNapkin(prep, fmt, variations, asked);
      show({ fmt, asked, items: got, warnings: got.warnings, cost: got.cost, skipped: got.skipped, failed: [] });
    } catch (e) {
      if (/^duplicate:/.test(e.message) && prep) {   // the same request as the last one: its results are kept
        N.repeatOf = prep.content + '|' + fmt + '|' + variations;
        setStatus(`${P.name}: this exact request was already made, and its results are kept. Press “Re-check last ${P.short} result (${P.free})” to see them again. To generate new visuals anyway (paid), tick the box and press “Create with ${P.name}” again.`, true);
      } else setStatus(`${P.name}: ` + errText(e), true);
    }
    finally { N.busy = false; refreshStatus(); napkinButtons(); }
  }
  /* The last request again, from the files the panel host kept: checked against the text in step 1 as it is now, no new
     request and no credits (Napkin's own status is asked only if the files were not downloaded yet). */
  async function recheckLast() {
    let text = $('content').value.trim();
    if (N.busy || !(await ensureGate())) return;
    N.busy = true; N.result = null; N.sel = 0; napkinButtons();
    ['Preview', 'Pick', 'Note'].forEach(id => { $p(id).hidden = true; $p(id).innerHTML = ''; });
    try {
      const last = await api(`/api/${P.key}/last`, null, 10000);
      if (!last.id) { setStatus(`No earlier ${P.short} result is kept on this PC.`, true); return; }
      // checked against the text it was made from (step 1 may hold other text by now)
      let note = '';
      if (last.source && last.source !== text) { $('content').value = last.source; text = last.source; note = ' Step 1 now shows the text this result was made from.'; }
      const prep = await prepared(text);
      if (prep.error) { setStatus(prep.error, true); return; }
      setStatus(`Checking the last ${P.short} result again (no new request)…`);
      const got = await collect({ id: last.id, last: true, asked: last.format === 'plan' ? 4 : last.asked || 1 }, prep, last.format);
      show({ fmt: last.format, asked: last.asked || 1, items: got, warnings: got.warnings, cost: got.cost, skipped: got.skipped, failed: [] });
      if (note) setStatus($('status').textContent + note);
    } catch (e) { setStatus(`${P.name}: ` + errText(e), true); }
    finally { N.busy = false; napkinButtons(); }
  }
  function show(R) {
    const fmt = R.fmt, variations = R.asked;
    N.result = R;
    N.sel = Math.max(0, R.items.findIndex(usable) >= 0 ? R.items.findIndex(usable) : R.items.findIndex(offered));
    $p('Mode').value = 'edit';                                   // the editable version is the default for every result
    N.last = null;
    showChoices();
    renderCompare();
    if (typeof studioSaw === 'function') studioSaw(P.key);       // its plan kept on this PC and offered in step 5
    const ok = R.items.filter(usable).length, origs = R.items.filter(origOK).length;
    const local = R.items.filter(it => it.local).length;
    setStatus((fmt === 'plan' ? `${P.name} (1 request): ${R.items.length} visual${R.items.length === 1 ? '' : 's'} designed, ${ok} usable after the accuracy and layout checks` + (ok < variations ? ` (fewer than ${variations}: the other compositions do not fit this content at 22 pt; see “Not offered”)` : '') + '. '
      : `${P.name} returned ${R.items.length - local} of ${variations} requested${local ? `, and ${local} more layout${local > 1 ? 's were' : ' was'} drawn here from its items (no extra cost)` : ''}. ${ok} usable after the accuracy and layout checks. `) +
      (hasOrig() ? `${origs} original design${origs === 1 ? '' : 's'} can go in as ${P.short} drew ${origs === 1 ? 'it' : 'them'}` +
        `${R.items.some(feOK) ? ` (${R.items.filter(feOK).length} also as native, editable objects)` : ''}. ` : '') +
      (!ok && !origs ? 'None is good enough to insert (see the reasons under each); nothing is regenerated automatically and your own suggestions above are unaffected.'
        : !ok && (origs || R.items.some(feOK)) ? `No editable version passed the checks; the original design can still be inserted (choose it under “What to insert”). Nothing is regenerated automatically.`
        : `Pick one, click a Content_Slide, then press “${hasOrig() ? 'Insert editable version' : `Insert ${P.short} result`}” (tick “Insert on a new slide” to keep that slide unchanged)` +
          (hasOrig() ? '; “What to insert” also offers the original design (editable, or as one picture), or both on two new slides.' : '.')));
  }

  /* Every variation as a preview of exactly what goes on the slide, with its status and checks. */
  const reasons = it => it.check.notes.concat(it.quality ? it.quality.block.concat(it.quality.warn) : []);
  const verdict = it => it.check.excluded ? 'Unusable: content missing' : it.quality && it.quality.excluded ? 'Unusable: layout faults' : it.sameAs ? `Same design as variation ${it.sameAs}` : '';
  const statusOf = it => verdict(it) || (it.check.status === 'partial' ? 'Partially complete: ' + (it.conv.missing.length ? it.conv.missing : it.check.missing).join(', ') + ' missing'
    : it.conv.added && it.conv.added.length ? 'Will be corrected: adds ' + it.conv.added.join(', ') + ' to the infographic' : 'Complete');
  function showChoices() {
    const R = N.result;
    if (!R) return;
    const dup = R.items.filter(it => it.sameAs).length;
    const local = R.items.filter(it => it.local).length;
    $p('Pick').innerHTML = esc((R.fmt === 'plan' ? `1 request; ${R.items.length} of ${R.asked} structurally different visual${R.asked === 1 ? '' : 's'} designed and drawn here` : `Returned: ${R.items.length - local} of ${R.asked} requested${R.items.length - local < R.asked ? ` (${P.short} sent fewer)` : ''}` +
      (local ? `; ${local} more drawn here from the items of variation ${R.items.find(it => it.local).fromN} (no extra cost)` : '')) +
      `${dup ? `; ${dup} ${dup > 1 ? 'are' : 'is'} the same design as another once rebuilt` : ''}${R.warnings && R.warnings.length ? `. ${P.short} noted: ` + R.warnings.join('; ') : ''}.` +
      (R.cost ? ` ${costText(R.cost)}.` : '') +
      ((R.fmt === 'plan' || local) && R.skipped && R.skipped.length ? ` Not offered: ${R.skipped.slice(0, 5).map(x => `${x.name || x.key} (${x.why})`).join('; ')}.` : ''));
    $p('Pick').hidden = false;
    // only usable designs are shown (and can be selected); the others - a fragment of the content, a layout that cannot
    // be repaired, the same design again - are named in one line with the reason, without a picture (files are kept)
    const hidden = R.items.filter(it => !offered(it));
    $p('Pick').innerHTML += hidden.length ? '<br>' + esc(`Not shown (not usable): ${hidden.map(it => `variation ${it.n} - ${hideReason(it)}`).join('; ')}.`) : '';
    $p('Preview').innerHTML = R.items.map((it, i) => {
      if (!offered(it)) return '';
      // the preview is the insertion itself: the same build, in the template's content area
      const bad = verdict(it), ed = !it.conv.report ? 'Not drawable' : it.conv.report.edit === 'full' ? 'Fully editable' : 'Editable, icons as pictures';
      const pic = it.conv.prims.length ? thumb(it.conv.prims) : '<div class="small" style="padding:8px">No preview: nothing in the file can be drawn.</div>';
      const orig = originalThumb(it), o = it.orig && it.orig.ok ? it.orig : null, fe = it.fe && it.fe.ok ? it.fe : null;
      const more = [`request ${shortId(it.rid || '')}`].concat(it.pptInfo ? [it.pptInfo.slides > 1 ? `${it.pptInfo.slides} slides, the first used` : ''].concat(it.conv.rebuilt ? [] : it.pptInfo.notes.map(n => 'conversion: ' + n)).filter(Boolean) : []);
      return `<button type="button" class="gcard${i === N.sel ? ' sel' : ''}" data-i="${i}"${bad && !origOK(it) ? ' style="opacity:.7"' : ''} aria-pressed="${i === N.sel}" aria-label="Variation ${it.n}">` +
        `<div class="gthumb">${pic}</div><div class="gname">Variation ${it.n}${i === N.sel ? ' · selected' : ''} <span class="small">(${o ? 'editable version, ' : ''}as inserted${it.fmt === 'plan' ? ': ' + esc(it.conv.arrangement) + (it.local ? ` - local layout from ${P.short}'s variation ${it.fromN}` : '') + (it.conv.namesOnly ? ', point names only' : '')
          : it.conv.asDrawn ? `: ${P.short}'s design, kept as designed` : it.conv.rebuilt && it.conv.report && /local replacement/.test(Object.keys(it.conv.report.notes).join(' ')) ? `: local replacement of ${P.short}'s design` : it.conv.rebuilt ? `: ${P.short}'s arrangement, rebuilt` : ''})</span></div>` +
        `<span class="badge ${bad ? 'image' : it.check.status === 'partial' || (it.conv.added && it.conv.added.length) ? 'partial' : it.conv.report.edit}">${esc(bad ? (o ? 'Editable version: ' : '') + bad : (o ? 'Editable: ' : '') + statusOf(it) + ' · ' + ed)}</span>` +
        // the original as native objects (10.12.2): as inserted (its first slide), what is editable and what is a picture
        (fe ? `<div class="small" style="margin-top:6px">Original ${P.short} design, editable, as inserted${fe.parts.length > 1 ? ` (slide 1 of ${fe.parts.length})` : ''}:</div><div class="gthumb">${thumb(fe.parts[0])}</div>` +
          `<span class="badge ${fe.block.length ? 'image' : fe.report.pictures || fe.warn.length ? 'partial' : 'full'}">${esc(fe.block.length ? 'Original editable blocked: ' + fe.block[0]
            : `Original editable: ${fe.status} · ${fe.report.native} native objects, ` + (fe.report.pictures ? `${fe.report.pictures} picture${fe.report.pictures > 1 ? 's' : ''}` : 'no pictures'))}</span>` : '') +
        // the original as it goes in (one picture, fitted and centred): its own status, never "editable"
        (o ? `<div class="small" style="margin-top:6px">Original ${P.short} design, as inserted (one picture):</div><div class="gthumb">${orig}</div>` +
          `<span class="badge ${o.block.length ? 'image' : o.warn.length ? 'partial' : 'full'}">${esc((o.block.length ? 'Original blocked: ' + o.block[0] : 'Original: ' + o.status + ' · picture, not editable as shapes'))}</span>`
          : orig ? `<div class="small" style="margin-top:4px">As ${P.short} returned it:</div><div class="gthumb" style="opacity:.85">${orig}</div>` : '') +
        `<div class="gwhy">${esc(reasons(it).concat(fe && fe.warn.length && !fe.block.length ? ['original editable: ' + fe.warn.join('; ')] : [], o && o.warn.length && !o.block.length ? ['original: ' + o.warn.join('; ')] : [], more).join('; '))}</div></button>`;
    }).join('');
    $p('Preview').hidden = false;
    const rej = R.items.filter(it => !offered(it));
    $p('RejectedBox').hidden = !rej.length;
    $p('RejectedSum').textContent = `Show the ${rej.length} variation${rej.length === 1 ? '' : 's'} not offered (${rej.length === 1 ? 'reason' : 'reasons'} and original)`;
    $p('Rejected').innerHTML = rej.map(it => `<div class="gcard" style="cursor:default"><div class="gthumb">${originalThumb(it) || '<div class="small" style="padding:8px">Nothing drawable.</div>'}</div>` +
      `<div class="gname">Variation ${it.n}</div><span class="badge image">${esc(verdict(it) || 'Not usable')}</span><div class="gwhy">${esc(hideReason(it) + '; ' + reasons(it).join('; '))}</div></div>`).join('');
    $p('Preview').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { N.sel = +b.dataset.i; showChoices(); napkinButtons(); }));
    showNote();
  }
  /* The result as the provider returned it: the original picture exactly as it would be inserted (the cleaned SVG fitted
     into the content area), or, when it cannot be read as one, converted for display only. */
  const originalThumb = it => { try {
      const R0 = Object.assign({}, TEMPLATE.contentArea);
      if (it.orig && it.orig.ok) return thumb([originalPrim(it.orig, R0)]);
      const svg = it.fmt === 'ppt' ? (it.pptSlide && it.pptSlide.els.length ? pptxSvg(it.pptSlide, it.pptR) : null) : it.data;
      return svg ? thumb(svgToPrims(svg, R0).prims) : '';
    } catch (e) { return ''; } };
  const hideReason = it => it.sameAs ? `the same design as variation ${it.sameAs}`
    : it.check.excluded ? (it.check.missing && it.check.missing.length && it.check.coverage > 0 ? `shows only part of your content (missing ${it.check.missing.slice(0, 3).join(', ')}${it.check.missing.length > 3 ? ', …' : ''})` : 'does not show your content')
    : 'layout cannot be repaired (' + ((it.quality && it.quality.block[0]) || 'layout faults') + ')' +
      (it.orig && it.orig.ok && it.orig.block.length ? `; the original design is blocked too (${it.orig.block[0]})` : '') +
      (it.fe && it.fe.ok && it.fe.block.length ? `; its editable original too (${it.fe.block[0]})` : '');
  /* What will go in for the selected variation: editable parts, pictures, corrections; never "fully editable" with pictures. */
  function showNote() {
    const it = N.result && N.result.items[N.sel], el = $p('Note');
    if (!it) { el.hidden = true; return; }
    const c = it.conv.report;
    let h = '';
    if (c) {
      const fixes = Object.entries(c.notes).map(([k, v]) => c.rebuilt ? k : `${v} × ${k}`);
      h = (c.plan ? `<b>Drawn here</b> from ${esc(it.planFrom)} as ${esc(c.arrangement)}: every label and description measured at ${BRAND.minPt} pt and up, Open Sans, approved colours, all native shapes`
        : it.conv.asDrawn ? `<b>Kept as designed</b>: ${P.short}'s own design, made for the content area at ${BRAND.minPt} pt, converted shape by shape`
        : c.rebuilt ? `<b>Rebuilt in the template</b>: ${P.short}'s heading, items and icons as one editable infographic in the content area (Open Sans, ${BRAND.minPt} pt and up, approved colours)`
        : `<b>Converted</b>: ${P.short}'s design shape by shape in the content area`) +
        (c.plan || it.conv.asDrawn ? '' : c.rebuilt && c.arrangement && c.arrangement !== 'cards' ? ` (${P.short}'s ${c.arrangement} arrangement kept)` : c.rebuilt ? ' (as cards)' : '') +
        `: ${c.shapes} shapes, ${c.lines} lines and ${c.texts} texts are native PowerPoint objects` +
        (c.pictures ? `; ${c.pictures} icon${c.pictures > 1 ? 's' : ''} or curved part${c.pictures > 1 ? 's' : ''} go in as separate pictures (right-click › Convert to Shape to edit)` : '') + '.' +
        (it.conv.added.length ? `<br>Added to the infographic (${P.short} left ${it.conv.added.length > 1 ? 'them' : 'it'} out): ${esc(it.conv.added.join(', '))}.` : '') +
        (it.conv.missing.length ? `<br><span style="color:var(--warn)">Partially complete: ${esc(it.conv.missing.join(', '))} missing (this design could not take ${it.conv.missing.length > 1 ? 'them' : 'it'}; the suggestions above show every point).</span>` : '') +
        (!c.rebuilt && !it.conv.asDrawn && fixes.length ? `<br>Corrected or noted: ${esc(fixes.join('; '))}.` : '');
    }
    const o = it.orig && it.orig.ok ? it.orig : null;
    if (o) {
      // two versions: what each one is, and which can go in
      const at = originalPlace(o, Object.assign({}, TEMPLATE.contentArea));
      h = `<b>Editable version</b>${usable(it) ? '' : ` <span style="color:var(--warn)">(cannot be inserted: ${esc(verdict(it) || hideReason(it))})</span>`}: ` + (h || 'nothing in the file can be drawn as shapes.') +
        `<br><b>Original ${P.short} design</b>${o.block.length ? ` <span style="color:var(--warn)">(blocked: ${esc(o.block.join('; '))})</span>` : ''}: ${P.short}'s ${esc(o.from)} as one picture (a vector SVG graphic),` +
        ` ${Math.round(at.w)} × ${Math.round(at.h)} pt, centred in the content area, scaled without cropping or distortion; its illustrations, icons, connectors, text, colours and composition exactly as returned.` +
        ` It is <b>not</b> editable as shapes or text here (in PowerPoint: right-click › Convert to Shape makes its parts editable shapes). Content: ${esc(o.status)}` +
        (o.warn.length ? `<br><span style="color:var(--warn)">Original: ${esc(o.warn.join('; '))}.</span>` : '.') +
        (modeOf() === 'both' ? '<br>“Both”: two new slides after the selected one, the editable version first, then the original; “Remove last inserted visual” removes both.' : '');
    }
    const fe = it.fe && it.fe.ok ? it.fe : null;
    if (fe) {
      // the editability report: what is native and editable, what stays a picture and why
      const nn = fe.report.notes, list = re => Object.entries(nn).filter(([k]) => re.test(k)).map(([k, v]) => `${v} × ${k}`);
      h += `<br><b>Original ${P.short} design, editable</b>${fe.block.length ? ` <span style="color:var(--warn)">(blocked: ${esc(fe.block.join('; '))})</span>` : ''}: ${P.short}'s composition redrawn` +
        ` in the content area as ${esc(faithfulEditText(fe.report))}${fe.report.slides > 1 ? `, on ${fe.report.slides} slides` : ''}. Every text is its own text box (Open Sans, its place and size kept; click it to edit); boxes, circles and connectors are native shapes and lines.` +
        (list(/native/).length ? ` Recognised: ${esc(list(/native/).join('; '))}.` : '') +
        (fe.report.pictures ? ` <b>Not editable as shapes</b>: ${esc(list(/picture/).join('; ') || fe.report.pictures + ' pictures')} (PowerPoint's API cannot draw free curves; right-click › Convert to Shape in PowerPoint).` : ' Nothing is a picture.') +
        ` Content: ${esc(fe.status)}.` + (fe.warn.length ? `<br><span style="color:var(--warn)">Original editable: ${esc(fe.warn.join('; '))}.</span>` : '');
    }
    el.innerHTML = h; el.hidden = !h;
  }

  /* ---------- insert ---------- */
  /* What goes in, chosen under "What to insert" (the editable version by default):
     - edit: rebuilt (or converted) for the free part of the selected slide, which keeps its approved layout;
     - orig: the original design as one SVG picture, fitted into that free part (original.js), checked again there;
     - both: two new slides after the selected one, on its own layout and master (the template's Content_Slide): the
       editable version, then the original. Removed together; an interrupted insertion is recorded like step 5's slides
       (AIVB_BATCH), so it can be found and removed after a reload.
     "Insert on a new slide" keeps the selected slide unchanged. Napkin's own slide and layout are never imported. All
     or nothing: anything a failed insertion added - shapes, the picture, new slides - is removed again. */
  const fullErr = () => Object.assign(new Error('full'), { full: true });
  /* Primitives onto `slide`: pictures behind (large backgrounds), native shapes and text, then pictures on top (icons sit
     on their badges); recorded for editing in step 5 (V10.12: a plan layout everything; a drawing its texts, and its
     items for a redesign). */
  async function drawPrims(context, slide, prims, it, rect, name) {
    if (!prims.length) throw new Error('nothing in this result can be drawn on a slide');
    const before = new Set(await shapeIds(context, slide)), pics = prims.filter(p => p.t === 'image');
    slide.load('id');
    await context.sync();
    if (pics.length) { context.presentation.setSelectedSlides([slide.id]); await context.sync(); }   // pictures go in through the selection
    for (const p of pics.filter(q => q.under)) await insertSvgAt(p.svg, p);
    const meta = typeof studioMeta === 'function' ? studioMeta(it.plan ? (it.density === 'names' ? planNames(it.plan) : it.plan) : null) : null;
    await drawOnSlide(context, slide, prims.filter(p => p.t !== 'image'), name, meta);
    for (const p of pics.filter(q => !q.under)) await insertSvgAt(p.svg, p);
    const ids = (await shapeIds(context, slide)).filter(id => !before.has(id));
    let rec = null;
    if (meta) { const from = `${P.name} (request ${shortId(it.rid || '')}, variation ${it.n})`, rp = it.plan ? null : resultPlan();
      rec = await studioAfterInsert(context, slide, ids, meta, it.plan ? { plan: it.plan, layout: it.layout, name: it.conv.arrangement, density: it.density, rect, from }
        : { plan: rp && rp.plan, rect, from }); }
    return { ids, rec };
  }
  async function putEditable(context, slide, it) {
    // 10.19: the slide's free part (below its text), laid out there or scaled into it; else a new slide (app.js)
    const fit = await fitArea(context, slide);
    const b = fitBuild(fit, R => { try { return it.plan ? planBuildFor(it, R) : napkinBuild(it, R, it.check.add || [], it.ordered, it.order, it.drop); } catch (e) { return null; } });
    return Object.assign({ b, k: b.k }, await drawPrims(context, slide, b.prims, it, b.rect, P.name));
  }
  /* The original as one picture in the slide's free part: validated again for that space, exactly one picture added,
     at its fitted place; named and tagged (AIVB_O) so step 5 recognises it. */
  async function putOriginal(context, slide, it) {
    const a = it.orig;
    if (!origOK(it)) throw new Error(`the original design cannot be inserted (${a && (a.ok ? a.block[0] : a.why) || 'not available'})`);
    slide.load('id');
    const fit = await fitArea(context, slide);           // 10.19: any free part; the picture is fitted and its text size checked
    if (!fit.rect) throw fullErr();
    const at = originalPlace(a, fit.rect);
    if (at.minPt < ORIGINAL_MIN_PT) throw new Error(`in the free part of this slide the original's smallest text would be ${at.minPt} pt (below ${ORIGINAL_MIN_PT} pt, unreadable); use an empty Content_Slide or the editable version`);
    const before = new Set(await shapeIds(context, slide));
    context.presentation.setSelectedSlides([slide.id]);         // the picture goes in through the selection
    await context.sync();
    await insertSvgAt(a.svg, at);
    const ids = (await shapeIds(context, slide)).filter(id => !before.has(id));
    if (ids.length !== 1) throw new Error(ids.length ? `PowerPoint added ${ids.length} objects instead of one picture` : 'PowerPoint did not add the picture to this slide');
    const s = slide.shapes.getItem(ids[0]);
    s.load('left,top,width,height');
    await context.sync();
    if ([s.left - at.x, s.top - at.y, s.width - at.w, s.height - at.h].some(d => Math.abs(d) > 2)) {   // put where PowerPoint was asked to
      s.left = at.x; s.top = at.y; s.width = at.w; s.height = at.h;
      await context.sync();
    }
    try { s.name = `${P.name} original design (picture)`; s.tags.add('AIVB_O', `${it.rid || ''}|${it.n}`); await context.sync(); } catch (e) { /* the name and tag are optional */ }
    return { ids, at };
  }
  async function insertNapkin(it, mode) {
    const both = mode === 'both', onNew = both || $('newSlide').checked || !!state.forceNew;
    let out = null;
    await PowerPoint.run(async context => {
      const pres = context.presentation, sel = pres.getSelectedSlides(), cnt = sel.getCount(), all = pres.slides;
      all.load('items/id');
      await context.sync();
      if (!cnt.value) throw new Error('Click a slide in the slide list on the left first.');
      // the editable original, drawn for the free part of the slide it goes on (a new slide: the whole content area),
      // checked again there; a tall design continues on new slides after it
      let fe = null;
      if (mode === 'origedit') {
        // 10.19: the selected slide's free part (below its text): drawn for it, else drawn full size and scaled into it
        // (one-part designs), else a new slide (app.js)
        const fit = onNew ? null : await fitArea(context, sel.getItemAt(0)), R0 = onNew ? freeArea([]).rect : fit.rect;
        let ok = false;
        if (R0 && R0.w >= 520 && R0.h >= 260) { fe = faithfulBuild(it, R0); ok = fe.ok && !fe.block.length; if (ok) fe.rect = R0; }
        if (!ok && fit && !fit.full) {
          const f0 = faithfulBuild(it, fit.base);
          if (f0.ok && !f0.block.length && f0.parts.length === 1) { const sc = scalePrims(f0.parts[0], fit.base, fit.rect); fe = f0; fe.parts = [sc.prims]; fe.k = sc.k; fe.rect = fit.rect; ok = true; }
        }
        if (!ok) { if (!R0 || (fit && fit.full)) throw fullErr(); throw new Error(`the editable original design cannot be inserted here (${fe && fe.ok ? fe.block[0] : fe ? fe.why : 'no room'})`); }
        fe.check = it.fe.check; fe.status = it.fe.status;   // the same texts: the content check of the preview holds
      }
      const many = both || (fe && fe.parts.length > 1), n = both ? 2 : fe ? fe.parts.length : 1;
      const slidesBefore = new Set(all.items.map(x => x.id)), batch = many ? (typeof newId === 'function' ? newId('B') : 'B' + Date.now().toString(36)) : '';
      const mark = async (slide, v) => { if (!batch) return; try { if (slide) slide.tags.add('AIVB_BATCH', batch); else pres.tags.add('AIVB_BATCH', JSON.stringify(v)); await context.sync(); } catch (e) { /* no tags in this PowerPoint */ } };
      let slide = sel.getItemAt(0), before = null, made = [];
      try {
        await mark(null, { id: batch, state: 'running', n, at: new Date().toISOString() });
        if (onNew) slide = await newSlideAfter(context, slide, '');
        slide.load('id');
        before = new Set(await shapeIds(context, slide));
        if (onNew) { made.push(slide.id); await mark(slide); }
        if (fe) {
          const more = [];
          let f = null, prev = slide;
          for (let k = 0; k < fe.parts.length; k++) {
            let sl = slide;
            if (k) {
              setStatus(`Inserting slide ${k + 1} of ${fe.parts.length} (the design continues)…`);
              sl = await newSlideAfter(context, prev, '');
              sl.load('id');
              await context.sync();
              made.push(sl.id); more.push(sl.id); await mark(sl);
            }
            const d = await drawPrims(context, sl, fe.parts[k], it, fe.rect, `${P.name} original design (editable)`);
            if (!k) f = d;
            prev = sl;
          }
          await mark(null, { id: batch, state: 'done', n, slides: made });
          state.lastInsert = { slideId: slide.id, ids: f.ids, newSlide: onNew, extraSlides: more, extraWhat: more.length ? `${more.length} continuation slide${more.length > 1 ? 's' : ''}` : '' };
          out = { f: Object.assign(f, { fe }) };
          return;
        }
        const e = mode === 'orig' ? null : await putEditable(context, slide, it);
        let o = mode === 'orig' ? await putOriginal(context, slide, it) : null, slide2 = null;
        if (both) {
          setStatus(`Inserting the original ${P.short} design on the second slide…`);
          slide2 = await newSlideAfter(context, slide, '');
          slide2.load('id');
          await context.sync();
          made.push(slide2.id); await mark(slide2);
          o = await putOriginal(context, slide2, it);
        }
        await mark(null, { id: batch, state: 'done', n: 2, slides: made });
        state.lastInsert = { slideId: slide.id, ids: (e || o).ids, newSlide: onNew, extraSlides: slide2 ? [slide2.id] : [], extraWhat: slide2 ? `the slide with the original ${P.short} design` : '' };
        out = { e, o };
      } catch (e) {
        try {   // all or nothing, as for the add-in's own visuals
          if (before && !onNew) (await shapeIds(context, slide)).filter(id => !before.has(id)).forEach(id => slide.shapes.getItem(id).delete());
          all.load('items/id');
          await context.sync();
          all.items.filter(x => !slidesBefore.has(x.id)).forEach(x => x.delete());
          await context.sync();
        } catch (e2) { console.warn('Clean-up after a failed insertion was incomplete', e2); }
        if (batch) try { pres.tags.delete('AIVB_BATCH'); await context.sync(); } catch (e3) { /* nothing recorded */ }
        state.lastInsert = null;
        throw e;
      }
    });
    return out;
  }
  async function insert() {
    const R = N.result, it = R && R.items[N.sel], mode = modeOf();
    if (!canMode(it, mode) || !state.inOffice || N.busy) return;
    // the same version of the same variation, just inserted and still there: a second press is needed for another copy
    const key = `${it.rid || ''}|${it.n}`, vers = mode === 'both' ? ['edit', 'orig'] : [mode], L = N.last;   // edit, origedit, orig
    if (L && L.ref === state.lastInsert && L.key === key && vers.some(v => L.vers.includes(v)) && N.dupOk !== key + mode) {
      N.dupOk = key + mode;
      setStatus(`Variation ${it.n} (${vers.filter(v => L.vers.includes(v)).map(v => VERSION_NAMES[v]).join(' and ')}) was just inserted and is still in the presentation. Press “${$p('Insert').textContent}” again to insert another copy, or “Remove last inserted visual” to take it out.`, true);
      return;
    }
    N.dupOk = '';
    N.busy = true; napkinButtons();
    try {
      if (!(await ensureGate())) return;
      state.lastFull = false;
      const onNew = mode === 'both' || $('newSlide').checked || !!state.forceNew, r = await insertNapkin(it, mode), who = `${P.name} (request ${shortId(it.rid || '')}, variation ${it.n}${P.branded ? ', Simplilearn brand style' : ''})`;
      N.last = { ref: state.lastInsert, key, vers };
      const edit = r.e && (() => { const b = r.e.b, x = b.report;
        return { what: `${x.rebuilt ? 'rebuilt in the template as ' : ''}${x.native} native, editable objects${x.pictures ? ` and ${x.pictures} picture${x.pictures > 1 ? 's' : ''} (icons)` : ''}`,
          note: b.missing.length ? `Partially complete: ${b.missing.join(', ')} missing (this design could not take ${b.missing.length > 1 ? 'them' : 'it'}).`
            : b.added.length ? `Corrected: added ${b.added.join(', ')} to the infographic.` : 'Complete: every point of your content is in the visual.' }; })();
      const orig = r.o && (() => { const a = it.orig, at = r.o.at;
        return { what: `the original design as one picture (SVG graphic, ${Math.round(at.w)} × ${Math.round(at.h)} pt, centred in the free content area, not cropped or distorted; not editable as shapes: right-click › Convert to Shape in PowerPoint to edit its parts), smallest text ${at.minPt} pt` + (at.minPt < BRAND.minPt ? ` (${P.short}'s typography kept, below the ${BRAND.minPt} pt brand minimum)` : ''),
          note: a.check.missing.length ? `Original: partially complete, ${a.check.missing.join(', ')} missing in ${P.short}'s design${usable(it) && a.check.missing.every(m => (it.conv.added || []).includes(m)) ? ` (the editable version adds ${a.check.missing.length > 1 ? 'them' : 'it'})` : ''}.` : 'Original: every point of your content is in it.' }; })();
      const fed = r.f && (() => { const fe = r.f.fe, x = fe.report;
        return `${fe.check.missing.length ? `Original editable: partially complete, ${fe.check.missing.join(', ')} missing in ${P.short}'s design.` : 'Original editable: every point of your content is in it.'} ${who} inserted as the original design, editable` +
          `${onNew ? ' on a new slide with the same layout' : ''}${x.slides > 1 ? `, continued on ${x.slides - 1} more new slide${x.slides > 2 ? 's' : ''} after it (the design is tall)` : ''}: ${faithfulEditText(x)}; text from ${x.minPt} pt` +
          `${x.minPt < BRAND.minPt ? ` (${P.short}'s typography, scaled; below the ${BRAND.minPt} pt brand minimum)` : ''}. Click any text to edit it, any shape to restyle it${x.pictures ? '; pictures: right-click › Convert to Shape' : ''}.` +
          `${typeof editNote === 'function' ? editNote(r.f.rec) : ''} “Remove last inserted visual” takes ${x.slides > 1 ? 'all of it' : 'it'} out again.`; })();
      setStatus(mode === 'origedit' ? fed : mode === 'both' ? `Inserted ${who} on two new slides after the selected one: 1) editable version, ${edit.what}; 2) ${orig.what}. ${edit.note} ${orig.note}${typeof editNote === 'function' ? editNote(r.e.rec) : ''} “Remove last inserted visual” removes both slides.`
        : mode === 'orig' ? `${orig.note} ${who} inserted${onNew ? ' on a new slide with the same layout' : ''}: ${orig.what}. “Remove last inserted visual” takes it out again.`
        : `${edit.note} ${who} inserted: ${edit.what}${onNew ? ' on a new slide with the same layout' : ''}.${typeof editNote === 'function' ? editNote(r.e.rec) : ''} “Remove last inserted visual” takes it out again.`);
      state.lastFit = (r.e && r.e.k) || (r.f && r.f.fe && r.f.fe.k) || 1;
    } catch (e) { state.lastFull = !!e.full; setStatus(`Could not insert the ${P.name} result, so nothing was added${mode === 'both' ? ' (neither slide)' : mode === 'origedit' ? ' (no slide)' : ''}: ` + (e.full ? 'this slide has no free space.' : errText(e)), true); }
    finally { N.busy = false; napkinButtons(); updateButtons(); if (mode !== 'edit' && mode !== 'orig' && typeof checkBatch === 'function') checkBatch(); }
  }
  $p('Go').addEventListener('click', create);
  $p('Insert').addEventListener('click', insert);
  $p('Mode').addEventListener('change', () => { N.dupOk = ''; napkinButtons(); showNote(); });
  $p('Last').addEventListener('click', recheckLast);
  $p('More').addEventListener('click', () => studioOpen('designs', 'res:' + P.key));
  /* For the comparison: what this provider's last result gave on the text it was made from. */
  const summary = () => {
    const R = N.result;
    if (!R) return null;
    const ok = R.items.filter(usable);
    const cov = R.items.map(it => it.check.coverage).filter(x => typeof x === 'number');
    return { name: P.name, source: R.items[0] && R.items[0].source, returned: R.items.length, asked: R.asked, usable: ok.length,
      complete: ok.filter(it => it.check.status === 'complete' && !(it.conv.added && it.conv.added.length)).length, cost: R.cost,
      coverage: cov.length ? Math.round(100 * cov.reduce((a, b) => a + b, 0) / cov.length) : null,
      arrangements: [...new Set(ok.map(it => it.conv.arrangement || (it.conv.rebuilt ? 'cards' : 'converted')))],
      editable: ok.filter(it => it.conv.report && it.conv.report.edit === 'full').length,
      rejected: R.items.filter(it => !usable(it)).map(it => `${it.n}: ${verdict(it) || 'not usable'}`) };
  };
  /* 10.13: the app's one "Generate visuals" (orchestrator.js) drives this provider without its controls. Pressing
     Generate is the user's request; whether a paid provider is used at all is the administrator's policy there. */
  const auto = {
    key: P.key, name: P.name,
    available: () => { const st = state.svc && state.svc[P.key]; return !!(st && st.enabled && (!P.branded || st.style_id)); },
    // the result the panel host kept, when it was made from this very text: reused, no request and no credits
    async cached(text) {
      if (N.result && N.result.items[0] && N.result.items[0].source === text) return N.result;
      try { const last = await api(`/api/${P.key}/last`, null, 10000); if (!last.id || last.source !== text) return null; } catch (e) { return null; }
      await recheckLast();
      return N.result && N.result.items.length ? N.result : null;
    },
    // one request (4 variations); null when it did not give a result (the reason is in the status line)
    async request(asked) { $p('Var').value = String(asked === 1 ? 1 : 4); await create(); return N.result && N.result.items.length ? N.result : null; },
    usable, origOK, feOK, offered,
    async insert(i, mode) { N.sel = i; if (hasOrig()) $p('Mode').value = mode; N.dupOk = `${N.result.items[i].rid || ''}|${N.result.items[i].n}${mode}`; await insert(); },
    get busy() { return N.busy; }
  };
  window['__' + P.key] = { accuracy, pptxInfo, prepared, preflight, N, auto };     // for the test harness
  return { render, summary, prepared, plan: resultPlan, auto };
}

/* Napkin and Claude side by side for the same text: how many variations came back, how many are usable and complete
   after the same checks, and (Claude) the time and tokens used. Shown once both have a result. */
function renderCompare() {
  let el = $('compareBox');
  if (!el) {
    el = document.createElement('div');
    el.className = 'panel small'; el.id = 'compareBox'; el.hidden = true;
    const after = $('claudePanel');
    after.parentNode.insertBefore(el, after.nextSibling);
  }
  const a = PANELS.napkin.summary(), b = PANELS.claude.summary();
  el.hidden = !(a && b);
  if (el.hidden) return;
  const row = (k, f) => `<tr><td>${k}</td><td>${f(a)}</td><td>${f(b)}</td></tr>`;
  el.innerHTML = '<b>Napkin AI and Claude AI compared</b> (same text, same checks, same rebuild)' +
    (a.source !== b.source ? ' <span style="color:var(--warn)">- made from different text in step 1, so not a like-for-like comparison</span>' : '') +
    '<table class="cmp" style="width:100%;border-collapse:collapse;margin-top:4px"><tr><th></th><th>Napkin AI</th><th>Claude AI</th></tr>' +
    row('Returned', x => `${x.returned} of ${x.asked}`) +
    row('Content covered (average)', x => x.coverage == null ? '-' : x.coverage + ' %') +
    row('Usable / complete without corrections', x => `${x.usable} / ${x.complete}`) +
    row('Arrangements (layout variety)', x => esc(x.arrangements.join(', ') || '-')) +
    row('Fully editable (no pictures)', x => `${x.editable} of ${x.usable}`) +
    row('Not offered', x => esc(x.rejected.join('; ') || 'none')) +
    row('Usage', x => x.cost ? esc(costText(x.cost)) : 'Napkin credits (plan-based)') + '</table>';
}

PANELS.napkin = makePanel(PROVIDERS.napkin);
PANELS.claude = makePanel(PROVIDERS.claude);
window.renderNapkin = () => { PANELS.napkin.render(); PANELS.claude.render(); };   // v10.html calls this on status changes
{
  const foot = document.querySelector('footer'), pad = () => { document.body.style.paddingBottom = (foot.offsetHeight + 16) + 'px'; };
  if (window.ResizeObserver) new ResizeObserver(pad).observe(foot);
  pad();
}
renderNapkin();
