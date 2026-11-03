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
   - V10.12: every result's plan is kept on this PC and drawn again in the panel's step 5 (studio.js: more designs,
     several slides, edits) with no new request; inserted visuals carry tags and a record so they can be edited later.
   - V10.11: one Generate action per provider, no format choice: Napkin's SVG (the most faithful and editable in our
     tests; its PowerPoint export stays available internally) and Claude's design specification (one request; plan.js
     and the design packs draw up to 4 structurally different layouts from it, each measured at 22 pt and checked).
     1 visual or 4 variations: a result with fewer usable variations than asked is completed with layouts drawn here
     from its own items, at no extra cost, and they are marked as such. Before a request, a free check shows which
     layouts the content fits at 22 pt. Loaded after v10.html's scripts, gallery.js, understand.js, brand.js, svg2ppt.js,
     rebuild.js and plan.js. */
const PANEL_VERSION = '10.12.0';      // must match server.py VERSION; a different host version is reported in the panel
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
  const items = (prep.points || []).map((p, i) => ({ id: 'p' + i, label: planClean(p.label), detail: planClean(p.exact || p.detail || ''), group: '' })).filter(i => i.label);
  planIcons(items);
  return planSemantics({ title: prep.title || '', relation: prep.ordered ? 'sequence' : 'independent', items, groups: [], flow: prep.ordered ? items.map(i => i.id) : [], layouts: [], from: 'text' });
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
  const usable = it => !!it && !it.check.excluded && !(it.quality && it.quality.excluded) && !it.sameAs;
  function napkinButtons() {
    const st = state.svc && state.svc[P.key], has = !!$('content').value.trim();
    $p('Go').disabled = !(st && st.enabled && (!P.branded || st.style_id)) || !$p('Ok').checked || !has || N.busy || !gateOK();
    $p('Last').hidden = !(st && st.enabled && st.last); $p('Last').disabled = !has || N.busy || !gateOK();
    const it = N.result && N.result.items[N.sel];
    $p('Insert').hidden = !N.result || !N.result.items.length;
    $p('Insert').disabled = !state.inOffice || N.busy || !usable(it) || !gateOK();
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
    const q = contentQuality(text);
    if (!q.ok) return { error: QUALITY_MSG };
    if (state.runText !== text || !state.sections.length) await analyseContent();
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
    const all = accuracy(prep, plan.items.flatMap(i => [i.label, i.detail]).concat(plan.groups.map(g => g.name), [plan.title]).filter(Boolean), { heading: plan.title });
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
    N.sel = Math.max(0, R.items.findIndex(usable));
    showChoices();
    renderCompare();
    if (typeof studioSaw === 'function') studioSaw(P.key);       // its plan kept on this PC and offered in step 5
    const ok = R.items.filter(usable).length;
    const local = R.items.filter(it => it.local).length;
    setStatus((fmt === 'plan' ? `${P.name} (1 request): ${R.items.length} visual${R.items.length === 1 ? '' : 's'} designed, ${ok} usable after the accuracy and layout checks` + (ok < variations ? ` (fewer than ${variations}: the other compositions do not fit this content at 22 pt; see “Not offered”)` : '') + '. '
      : `${P.name} returned ${R.items.length - local} of ${variations} requested${local ? `, and ${local} more layout${local > 1 ? 's were' : ' was'} drawn here from its items (no extra cost)` : ''}. ${ok} usable after the accuracy and layout checks. `) +
      (!ok ? 'None is good enough to insert (see the reasons under each); nothing is regenerated automatically and your own suggestions above are unaffected.'
        : `Pick one, click a Content_Slide, then press “Insert ${P.short} result” (tick “Insert on a new slide” to keep that slide unchanged).`));
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
    const hidden = R.items.filter(it => !usable(it));
    $p('Pick').innerHTML += hidden.length ? '<br>' + esc(`Not shown (not usable): ${hidden.map(it => `variation ${it.n} - ${hideReason(it)}`).join('; ')}.`) : '';
    $p('Preview').innerHTML = R.items.map((it, i) => {
      if (!usable(it)) return '';
      // the preview is the insertion itself: the same build, in the template's content area
      const bad = verdict(it), ed = !it.conv.report ? 'Not drawable' : it.conv.report.edit === 'full' ? 'Fully editable' : 'Editable, icons as pictures';
      const pic = it.conv.prims.length ? thumb(it.conv.prims) : '<div class="small" style="padding:8px">No preview: nothing in the file can be drawn.</div>';
      const orig = originalThumb(it);
      const more = [`request ${shortId(it.rid || '')}`].concat(it.pptInfo ? [it.pptInfo.slides > 1 ? `${it.pptInfo.slides} slides, the first used` : ''].concat(it.conv.rebuilt ? [] : it.pptInfo.notes.map(n => 'conversion: ' + n)).filter(Boolean) : []);
      return `<button type="button" class="gcard${i === N.sel ? ' sel' : ''}" data-i="${i}"${bad ? ' style="opacity:.7"' : ''} aria-pressed="${i === N.sel}" aria-label="Variation ${it.n}">` +
        `<div class="gthumb">${pic}</div><div class="gname">Variation ${it.n}${i === N.sel ? ' · selected' : ''} <span class="small">(as inserted${it.fmt === 'plan' ? ': ' + esc(it.conv.arrangement) + (it.local ? ` - local layout from ${P.short}'s variation ${it.fromN}` : '') + (it.conv.namesOnly ? ', point names only' : '')
          : it.conv.asDrawn ? `: ${P.short}'s design, kept as designed` : it.conv.rebuilt && /local replacement/.test(Object.keys(it.conv.report.notes).join(' ')) ? `: local replacement of ${P.short}'s design` : it.conv.rebuilt ? `: ${P.short}'s arrangement, rebuilt` : ''})</span></div>` +
        (orig ? `<div class="small" style="margin-top:4px">As ${P.short} returned it:</div><div class="gthumb" style="opacity:.85">${orig}</div>` : '') +
        `<span class="badge ${bad ? 'image' : it.check.status === 'partial' || (it.conv.added && it.conv.added.length) ? 'partial' : it.conv.report.edit}">${esc(bad || statusOf(it) + ' · ' + ed)}</span><div class="gwhy">${esc(reasons(it).concat(more).join('; '))}</div></button>`;
    }).join('');
    $p('Preview').hidden = false;
    const rej = R.items.filter(it => !usable(it));
    $p('RejectedBox').hidden = !rej.length;
    $p('RejectedSum').textContent = `Show the ${rej.length} variation${rej.length === 1 ? '' : 's'} not offered (${rej.length === 1 ? 'reason' : 'reasons'} and original)`;
    $p('Rejected').innerHTML = rej.map(it => `<div class="gcard" style="cursor:default"><div class="gthumb">${originalThumb(it) || '<div class="small" style="padding:8px">Nothing drawable.</div>'}</div>` +
      `<div class="gname">Variation ${it.n}</div><span class="badge image">${esc(verdict(it) || 'Not usable')}</span><div class="gwhy">${esc(hideReason(it) + '; ' + reasons(it).join('; '))}</div></div>`).join('');
    $p('Preview').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { N.sel = +b.dataset.i; showChoices(); napkinButtons(); }));
    showNote();
  }
  /* The result as the provider returned it (converted for display only: scripts and external content are dropped). */
  const originalThumb = it => { try {
      const R0 = Object.assign({}, TEMPLATE.contentArea), svg = it.fmt === 'ppt' ? (it.pptSlide && it.pptSlide.els.length ? pptxSvg(it.pptSlide, it.pptR) : null) : it.data;
      return svg ? thumb(svgToPrims(svg, R0).prims) : '';
    } catch (e) { return ''; } };
  const hideReason = it => it.sameAs ? `the same design as variation ${it.sameAs}`
    : it.check.excluded ? (it.check.missing && it.check.missing.length && it.check.coverage > 0 ? `shows only part of your content (missing ${it.check.missing.slice(0, 3).join(', ')}${it.check.missing.length > 3 ? ', …' : ''})` : 'does not show your content')
    : 'layout cannot be repaired (' + ((it.quality && it.quality.block[0]) || 'layout faults') + ')';
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
    el.innerHTML = h; el.hidden = !h;
  }

  /* ---------- insert ---------- */
  /* Rebuilt (or converted) for the free part of the selected slide, which keeps its approved layout; with "Insert on a new
     slide", a new slide on the selected slide's own layout and master (the template's Content_Slide), the selected one
     unchanged. Napkin's own slide and layout are never imported. All or nothing. */
  async function insertNapkin(it) {
    const onNew = $('newSlide').checked;
    let summary = '', note = '', rec = null;
    await PowerPoint.run(async context => {
      const sel = context.presentation.getSelectedSlides(), cnt = sel.getCount(), all = context.presentation.slides;
      all.load('items/id');
      await context.sync();
      if (!cnt.value) throw new Error('Click a slide in the slide list on the left first.');
      const slidesBefore = new Set(all.items.map(x => x.id));
      let slide = sel.getItemAt(0), before = null;
      try {
        if (onNew) slide = await newSlideAfter(context, slide, '');
        slide.load('id');
        before = new Set(await shapeIds(context, slide));
        const fa = freeArea(await readSlide(context, slide));
        if (!fa.rect || fa.rect.w < 520 || fa.rect.h < 260) throw Object.assign(new Error('full'), { full: true });
        const b = it.plan ? planBuildFor(it, fa.rect) : napkinBuild(it, fa.rect, it.check.add || [], it.ordered, it.order, it.drop), prims = b.prims, pics = prims.filter(p => p.t === 'image');
        if (!prims.length) throw new Error('nothing in this result can be drawn on a slide');
        // pictures behind (large backgrounds), native shapes and text, then pictures on top (icons sit on their badges)
        for (const p of pics.filter(q => q.under)) await insertSvgAt(p.svg, p);
        const meta = typeof studioMeta === 'function' ? studioMeta(it.plan ? (it.density === 'names' ? planNames(it.plan) : it.plan) : null) : null;
        await drawOnSlide(context, slide, prims.filter(p => p.t !== 'image'), P.name, meta);
        for (const p of pics.filter(q => !q.under)) await insertSvgAt(p.svg, p);
        const after = await shapeIds(context, slide);
        state.lastInsert = { slideId: slide.id, ids: after.filter(id => !before.has(id)), newSlide: onNew, extraSlides: [] };
        // V10.12: recorded for editing in step 5 (a plan layout: everything; a drawing: its texts, and its items for a redesign)
        if (meta) { const from = `${P.name} (request ${shortId(it.rid || '')}, variation ${it.n})`, rp = it.plan ? null : resultPlan();
          rec = await studioAfterInsert(context, slide, state.lastInsert.ids, meta, it.plan ? { plan: it.plan, layout: it.layout, name: it.conv.arrangement, density: it.density, rect: fa.rect, from }
            : { plan: rp && rp.plan, rect: fa.rect, from }); }
        const r = b.report;
        summary = `${r.rebuilt ? 'rebuilt in the template as ' : ''}${r.native} native objects${r.pictures ? ` and ${r.pictures} picture${r.pictures > 1 ? 's' : ''} (icons)` : ''}${onNew ? ' on a new slide with the same layout' : ''}`;
        note = b.missing.length ? `Partially complete: ${b.missing.join(', ')} missing (this design could not take ${b.missing.length > 1 ? 'them' : 'it'}).`
          : b.added.length ? `Corrected: added ${b.added.join(', ')} to the infographic.` : '';
      } catch (e) {
        try {   // all or nothing, as for the add-in's own visuals
          if (before && !onNew) (await shapeIds(context, slide)).filter(id => !before.has(id)).forEach(id => slide.shapes.getItem(id).delete());
          all.load('items/id');
          await context.sync();
          all.items.filter(x => !slidesBefore.has(x.id)).forEach(x => x.delete());
          await context.sync();
        } catch (e2) { console.warn('Clean-up after a failed insertion was incomplete', e2); }
        state.lastInsert = null;
        throw e;
      }
    });
    return { summary, note, rec };
  }
  async function insert() {
    const R = N.result, it = R && R.items[N.sel];
    if (!usable(it) || !state.inOffice || N.busy) return;
    N.busy = true; napkinButtons();
    try {
      if (!(await ensureGate())) return;
      const r = await insertNapkin(it);
      setStatus(`${r.note || 'Complete: every point of your content is in the visual.'} ${P.name} (request ${shortId(it.rid || '')}, variation ${it.n}${P.branded ? ', Simplilearn brand style' : ''}) inserted: ${r.summary}.${typeof editNote === 'function' ? editNote(r.rec) : ''} “Remove last inserted visual” takes it out again.`);
    } catch (e) { setStatus(`Could not insert the ${P.name} result, so nothing was added: ` + (e.full ? 'this slide has no free space.' : errText(e)), true); }
    finally { N.busy = false; napkinButtons(); updateButtons(); }
  }
  $p('Go').addEventListener('click', create);
  $p('Insert').addEventListener('click', insert);
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
  window['__' + P.key] = { accuracy, pptxInfo, prepared, preflight, N };     // for the test harness
  return { render, summary, prepared, plan: resultPlan };
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
