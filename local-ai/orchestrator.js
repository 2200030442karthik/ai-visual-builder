/* AI Visual Builder 10.14 - one "Generate visuals": the engines behind it, chosen here, never by the user.
   An engine turns the content into candidates (a visual that can be previewed and inserted):
     { id, engine, title, category, family, prims (preview in the template's content area), edit: 'full'|'partial',
       complete, slides, score, insert: async () => true when it went in }
   Engines, in the order they run (registerEngine adds more, e.g. a future "VisualX" engine; see ENGINE NOTES below):
     builtin   free   the built-in suggestions (gallery.js) for the content's section: charts, records, pictorial views
     designs   free   the design packs' compositions (plan.js + packs/*.js) from the content's own plan
     napkin    paid   Napkin AI; its designs go in as native, editable objects (faithful.js; the rebuilt version when not)
     claude    paid   Claude AI's design specification (content, roles, objects, headline, takeaway, the topic's
                      object), drawn here in every composition that suits it - the showcase pack's hero-style ones too
   10.14, hybrid: the AI services supply the design ideas, the add-in draws the result as native, editable objects.
   Which service first (paid_order "auto", the default): Claude for technical structure - a flow with functions across
   it, systems and architectures, named groups, 7 or more points; Napkin for concepts, categories, explanatory prose
   and short lists, where its illustrated compositions are strongest. The other is the fallback.
   Paid engines follow the administrator's policy (panel host config.json "paid_policy", shown nowhere in the app):
     never         only the free engines
     when-needed   (default) one request for every new text a design can show - not for records of exact values, data
                   tables or a single statement (the built-in views keep those exact)
     always        one request for every new text
   Cost control: the result the panel host kept for the same text is reused (free); a text already sent in the last
   24 hours is not sent again (this PC); at most one paid request per Generate; the providers' own daily caps and
   duplicate guards stay in force (server.py). When the first paid engine fails or gives nothing usable, the next one
   is tried; when all fail, the free visuals are shown with a plain note.
   Ranking: content accuracy, editability, design richness (measured: objects, a focal element, type hierarchy, colour)
   and readability; duplicates removed (same layout, same family, or the same composition - where its shapes are -
   with small changes); variety enforced (categories in turn); 10-20 shown, the best first. */
const ORCH_MAX = 24, ORCH_MIN = 20;   // 10.17: every distinct design up to 24 at once (V10.16: 20)
const ORCH = { engines: [], memo: new Map(), run: 0, last: null, log: [] };
const PAID_STORE = 'aivb.paid.v1';
function registerEngine(e) { ORCH.engines = ORCH.engines.filter(x => x.id !== e.id).concat([Object.assign({ kind: 'native', order: 50 }, e)]).sort((a, b) => a.order - b.order); }
const orchPolicy = () => { let v = ''; try { v = localStorage.getItem('aivb.paidPolicy') || ''; } catch (e) { /* none */ }
  v = v || (state.svc && state.svc.orchestrate && state.svc.orchestrate.paid) || 'when-needed';
  return ['never', 'when-needed', 'always'].includes(v) ? v : 'when-needed'; };
/* Which AI service first for this content (the other is the fallback), or the administrator's fixed order. */
function orchOrder(ctx) {
  const o = state.svc && state.svc.orchestrate && state.svc.orchestrate.order;
  if (Array.isArray(o) && o.length) return o.filter(k => ORCH.engines.some(e => e.id === k));
  const P = ctx && ctx.memo && ctx.memo.free.plan, sc = state.sec && state.sec.scene;
  const tech = !!P && (planRoles(P).supports.length > 0 || planGroups(P).length >= 2 || P.items.length >= 7 || P.items.some(i => /source|component|output/.test(i.role || '')));
  if (ctx) ctx.route = tech && !(sc && sc.prose) ? 'technical structure' : 'concepts';
  return tech && !(sc && sc.prose) ? ['claude', 'napkin'] : ['napkin', 'claude'];
}
const orchNote = (what, o) => { ORCH.log.push(Object.assign({ at: new Date().toISOString().slice(11, 19), what }, o || {})); if (ORCH.log.length > 200) ORCH.log.shift(); };

/* What a visual is, for the gallery's variety and its label. */
const ORCH_CATS = [['Concept scene', /devicelinks|chipboard/], ['Concept map', /discgrid|mirrorlinks/], 
  ['Hub and spoke', /hubcorners/], ['Mind map', /mindmap/], ['Hierarchy', /treedown/], ['Learning map', /sectionrows/], ['Section columns', /circleheads/], ['Cards', /tabcards/], ['Hero', /splitpanel/], ['Story flow', /zigzag|callouts/],
  ['Focus', /target/], ['Framework', /quadcircle/], ['Icon summary', /iconband/], ['Ribbons', /ribbontags/],
  ['Concept map', /concepttiles/], ['Orbit', /orbit/], ['Honeycomb', /honeycomb/], ['Layered', /isostack/], ['Bento grid', /bento/],
  ['Learning map', /learnmap|bridge/], ['Hero', /herobanner|spotlight|callout|poster|ribbon|keystatement/], ['Icon summary', /iconrows|badges|storyboard|colortiles/], ['Roadmap', /roadmap/], ['Timeline', /timeline|milestone/], ['Cycle', /cycle/], ['Funnel', /funnel/],
  ['Comparison', /versus|splitpanels|split|compare|table|matrix2/], ['Hub and spoke', /hub|radial|ecosystem|spoke|wheel|orbit/], ['Pillars', /pillar|columns|p-col/],
  ['Framework', /quadrant|framework|capmap|capability|swot|matrix/], ['Hierarchy', /tree|pyramid|layers|stack|hierarch|org/],
  ['Architecture', /architecture|platform|modules|planes|swimlane/],
  ['Process', /chevron|stair|step|pipeline|flow|arrow|snake|process|circleflow|p-row|p-path|scene|staircase/],
  ['Chart', /\b(?:v?bar|hbar|chart|line|donut|kpi|scatter|heatmap|progress|distribution|grouped|stacked)\b/], ['Cards', /grid|card|rows|tile|list|record|fixed/]];
const orchCategory = s => { s = String(s || '').toLowerCase(); const c = ORCH_CATS.find(([, re]) => re.test(s)); return c ? c[0] : 'Infographic'; };
const orchSig = prims => typeof signature === 'function' ? signature(prims) : String(prims.length);
const orchMinPt = prims => Math.min(99, ...prims.filter(p => p.text).map(p => p.size || 99));

/* How rich a design looks, measured on what it draws (0-14): pictorial objects, a focal element (one shape much larger
   than the rest), a type hierarchy (a headline above the body size), colour variety. */
function orchRichness(prims) {
  const R = TEMPLATE.contentArea, A = R.w * R.h, sh = prims.filter(p => p.t === 'shape' && p.fill && !p.cmp);
  const objects = new Set(prims.filter(p => p.cmp && p.cmp !== 'none').map(p => p.grp)).size + prims.filter(p => p.t === 'image').length;
  const focal = sh.some(p => p.w * p.h > A * 0.09 && p.w * p.h < A * 0.7);
  const sizes = new Set(prims.filter(p => p.text).map(p => Math.round(p.size))), fills = new Set(sh.map(p => p.fill));
  return Math.min(14, Math.min(6, objects) + (focal ? 4 : 0) + (Math.max(0, ...sizes) >= 28 ? 2 : sizes.size >= 2 ? 1 : 0) + (fills.size >= 4 ? 2 : fills.size >= 3 ? 1 : 0));
}
/* Where a design puts its texts: the centre of every text on a 16 x 8 grid of the content area. Two designs whose texts
   sit in the same places are the same composition (a colour or spacing variant, or a list drawn twice), whatever their
   frames and panels look like. */
function orchFootprint(prims) {
  const R = TEMPLATE.contentArea, G = new Set();
  prims.forEach(p => { if (!p.text || !(p.w > 0)) return; G.add(Math.round((p.x + p.w / 2 - R.x) / R.w * 16) + ',' + Math.round((p.y + p.h / 2 - R.y) / R.h * 8)); });
  return G;
}
const orchSame = (a, b) => { if (a.size < 2 || b.size < 2) return false; let n = 0; a.forEach(k => { if (b.has(k)) n++; }); return n / (a.size + b.size - n) >= 0.8; };
/* 10.16: what a design looks like, beyond where its texts are: the cells of a 24 x 10 grid of the content area that its
   coloured shapes cover (white and the slide's white excluded). Two designs that cover the same cells AND put their
   texts in similar places read as the same picture (V10.15: "Capability map", "Grouped columns" and "Hierarchy" were
   all two text panels side by side), whatever their names. Used by the ranking and by the visual benchmark. */
// 10.17: each cell also says whether what shows there (the shape drawn last) is a light neutral panel or a palette
// colour, so a composition of solid colour tabs and one of grey panels in the same places differ, while the same
// composition in other colours (a colour variant) is still the same picture
function orchShapePrint(prims) {
  const R = TEMPLATE.contentArea, M = new Map(), CW = R.w / 24, CH = R.h / 10;
  prims.forEach(p => { if (p.t !== 'shape' || !p.fill || /^#F{6}$/i.test(p.fill) || p.cmp) return;
    const cls = /^#(?:F2F2F2|D9D9D9|7F7F7F)$/i.test(p.fill) || luminance(p.fill) > 0.6 ? 'n' : 'a';
    for (let i = Math.max(0, Math.floor((p.x - R.x) / CW)); i < Math.min(24, Math.ceil((p.x + p.w - R.x) / CW)); i++)
      for (let j = Math.max(0, Math.floor((p.y - R.y) / CH)); j < Math.min(10, Math.ceil((p.y + p.h - R.y) / CH)); j++) {
        const cx = R.x + (i + 0.5) * CW, cy = R.y + (j + 0.5) * CH; if (cx >= p.x && cx <= p.x + p.w && cy >= p.y && cy <= p.y + p.h) M.set(i + ',' + j, cls); } });
  return new Set([...M].map(([k, c]) => k + c));
}
const orchJac = (a, b) => { if (!a.size && !b.size) return 1; let n = 0; a.forEach(k => { if (b.has(k)) n++; }); return n / (a.size + b.size - n); };
const orchLooksSame = (a, b) => orchJac(a.sp, b.sp) >= 0.72 && orchJac(a.fp, b.fp) >= 0.45;
/* Score: accuracy first, then editability, richness and readability (0 and up). */
function orchScore(c) {
  let s = c.base;
  s += c.complete === false ? -25 : 10;
  s += c.edit === 'full' ? 8 : 0;
  c.richness = c.richness != null ? c.richness : orchRichness(c.prims);
  s += c.richness + (c.rich ? 2 : 0);
  const m = orchMinPt(c.prims);
  s += m >= BRAND.minPt ? 4 : m >= 14 ? -2 : -8;
  // 10.17: not capped at 100 - with the newer packs many designs reached the cap and the order among them was lost
  return Math.max(0, Math.round(s));
}
/* The best, varied list: duplicates (same layout signature, or the same family twice) removed; categories in turn,
   each at most 3 times before every other category had its turn. */
function orchRank(all, max, shown, strict) {
  const seen = new Set(), fam = new Set(), pool = [], prints = [];
  all.filter(c => c && c.prims && c.prims.length).map(c => Object.assign(c, { score: orchScore(c) })).sort((a, b) => b.score - a.score).forEach(c => {
    // an AI service's own drawings are each their own design; its plan drawn here competes by family like the rest
    const sig = orchSig(c.prims), fk = c.own ? c.id : c.category + '|' + c.family, fp = c.footprint || (c.footprint = orchFootprint(c.prims));
    const look = { fp, sp: c.shapeprint || (c.shapeprint = orchShapePrint(c.prims)) };
    if (seen.has(sig) || fam.has(fk) || (shown && shown.has(fk)) || prints.some(q => orchSame(q.fp, fp) || orchLooksSame(q, look))) return;
    seen.add(sig); fam.add(fk); prints.push(look); pool.push(c);
  });
  // 10.16: never padded with weak designs - when six or more designs with objects and hierarchy exist, the plain
  // ones (text in boxes, richness under 3) are left out instead of filling the gallery to its maximum
  // and designs that leave out a fact of the text (a statement's subject, verbs or object, a section's name) or draw
  // no object at all are left out when six or more complete designs with objects exist
  const objs = c => c.objects != null ? c.objects : (c.objects = new Set(c.prims.filter(p => p.cmp && p.cmp !== 'none').map(p => p.grp)).size);
  const good = c => c.own || (c.richness >= 3 && c.complete !== false && objs(c) > 0);
  const strong = pool.filter(c => c.richness >= 4 && good(c)).length, keep = strong >= 6 || strict ? pool.filter(good) : pool;
  const out = [], per = {};
  for (const cap of [1, 3, 99]) for (const c of keep) {
    if (out.length >= max) break;
    if (out.includes(c) || (per[c.category] || 0) >= cap) continue;
    out.push(c); per[c.category] = (per[c.category] || 0) + 1;
  }
  return out;
}

/* Paid requests made from this PC, by text (cost control). */
const paidSeen = () => { try { const m = JSON.parse(localStorage.getItem(PAID_STORE) || '{}'), now = Date.now(); Object.keys(m).forEach(k => { if (now - m[k].at > 864e5) delete m[k]; }); return m; } catch (e) { return {}; } };
const paidMark = (hash, engine) => { try { const m = paidSeen(); m[hash] = { engine, at: Date.now() }; localStorage.setItem(PAID_STORE, JSON.stringify(m)); } catch (e) { /* not kept */ } };

/* One Generate. o.more: more visuals for the same text (the next designs; the paid engines may be asked once).
   onStage(text, partial list) reports progress in plain words. Returns { list, note, paid: { used, from } }. */
async function orchGenerate(text, o, onStage) {
  o = o || {}; onStage = onStage || (() => {});
  const run = ++ORCH.run, hash = hashText(text), ctx = { text, hash, more: !!o.more, R: Object.assign({}, TEMPLATE.contentArea) };
  const memo = ORCH.memo.get(hash) || { cands: [], free: {}, paidTried: false, paidFrom: '' };
  ORCH.memo.set(hash, memo);
  if (!o.more && memo.list && memo.list.length) { orchNote('reused the visuals made for this text', { n: memo.list.length }); return { list: memo.list, note: '', paid: { used: false, from: memo.paidFrom }, reused: true }; }
  ctx.memo = memo;
  onStage('Reading your content…');
  const free = ORCH.engines.filter(e => e.kind === 'native' && e.available(ctx));
  for (const e of free) {
    try { const got = await e.run(ctx); orchNote(`${e.id}: ${got.length} candidates`); memo.cands.push(...got); }
    catch (err) { orchNote(`${e.id} failed: ${errText(err)}`); }
    if (run !== ORCH.run) return null;
    onStage('Designing layouts…', orchRank(memo.cands.slice(), ORCH_MAX));
  }
  // the paid engines, by the administrator's policy and only when they add something
  let note = '', paidUsed = false;
  const policy = orchPolicy(), strong = orchRank(memo.cands.slice(), ORCH_MAX).filter(c => c.score >= 70).length, sc = state.sec && state.sec.scene;
  // 10.16: a statement with a list (sections.js statementRead) is drawn from its parts, so the AI services may design it
  const exact = !!(sc && (sc.record || sc.mode === 'fixed' || sc.mode === 'data' || /^(?:relation|definition|statement)$/.test(sc.mode))) && !(typeof contentRead === 'function' && contentRead(text));
  const want = policy === 'always' || (policy === 'when-needed' && !exact && !!memo.free.plan);
  const order = orchOrder(ctx);
  orchNote(`paid policy ${policy}: ${want ? 'wanted' : 'not needed'} (${strong} strong free visuals${exact ? ', exact values or one statement' : ''}; ${ctx.route || 'fixed order'}: ${order.join(' then ')})`);
  // a result a provider kept for this very text costs nothing: always taken; a new request only when wanted, at most
  // one, and a second provider only when the first gave nothing usable (fallback)
  // 10.18: the administrator may have both AI services design for a new text (orchestrate.engines 2): Napkin's original
  // infographics and Claude's own compositions in one gallery; otherwise the second service is only the fallback
  let requests = 0, paidOK = false;
  const both = !!(state.svc && state.svc.orchestrate && state.svc.orchestrate.engines === 2);
  if (!memo.paidChecked) for (const id of order) {
    const e = ORCH.engines.find(x => x.id === id);
    if (!e || !e.available(ctx)) { orchNote(`${id}: not available`); continue; }
    let got = [];
    try {
      const cached = await e.cached(ctx);
      if (cached && cached.length) { got = cached; orchNote(`${id}: reused its kept result for this text (no request)`); }
      else if (want && !memo.paidTried && (!paidOK || both) && requests < 2 && !(requests === 0 && paidSeen()[hash])) {
        onStage('Adding AI-designed options…', orchRank(memo.cands.slice(), ORCH_MAX));
        requests++; paidMark(hash, id); paidUsed = true;
        got = await e.run(ctx);
        orchNote(`${id}: requested, ${got.length} usable`);
        if (!got.length) note = 'The AI design service gave no usable design this time; these visuals are built in.';
      } else if (want && requests === 0 && paidSeen()[hash]) orchNote(`${id}: this text was sent in the last 24 hours; not sent again`);
    } catch (err) { orchNote(`${id} failed: ${errText(err)}`); got = []; }
    if (run !== ORCH.run) return null;
    if (got.length) { memo.cands.push(...got); memo.paidFrom = memo.paidFrom || id; paidOK = true; note = ''; }
  }
  memo.paidChecked = true;
  if (requests) memo.paidTried = true;
  const list = orchRank(memo.cands.slice(), ORCH_MAX);
  memo.list = list;
  ORCH.last = { text, list, policy, log: ORCH.log.slice(-20) };
  return { list, note: list.length ? note : '', paid: { used: paidUsed, from: memo.paidFrom } };
}
/* More visuals for the text: the next designs of the free engines (new layouts, then colour and spacing variants). */
async function orchMore(text, onStage) {
  const hash = hashText(text), memo = ORCH.memo.get(hash);
  if (!memo) return orchGenerate(text, {}, onStage);
  const before = new Set((memo.list || []).map(c => c.id)), ctx = { text, hash, more: true, memo, R: Object.assign({}, TEMPLATE.contentArea) };
  onStage('Designing more layouts…');
  for (const e of ORCH.engines.filter(x => x.kind === 'native' && x.more && x.available(ctx))) {
    try { memo.cands.push(...await e.more(ctx)); } catch (err) { orchNote(`${e.id} more failed: ${errText(err)}`); }
  }
  // new ones first, then the ones already shown; 10.16: a family already in the gallery is not offered again in other
  // colours or spacing (V10.15's "More visuals" repeated Topic banner, Section panels, ... in other colours)
  const shownFam = new Set((memo.list || []).map(c => c.own ? c.id : c.category + '|' + c.family));
  // the gallery's standard holds for the additions too: when Generate had enough complete designs with objects, More
  // visuals adds only such designs (or none, with a note) - never the weaker ones it left out
  const strict = (memo.list || []).filter(c => c.complete !== false && !c.own).length >= 6 || (memo.list || []).every(c => c.complete !== false);
  const fresh = orchRank(memo.cands.filter(c => !before.has(c.id)), ORCH_MAX, shownFam, strict);
  memo.list = fresh.concat((memo.list || []).filter(c => !fresh.includes(c))).slice(0, ORCH_MAX * 2);
  return { list: memo.list, fresh: fresh.length, note: fresh.length ? '' : 'Every distinct design for this content is already shown.' };
}

/* ---------- the engines ---------- */
/* Built-in suggestions for the selected section (analysis done by Generate; gallery.js suggest). */
registerEngine({ id: 'builtin', kind: 'native', order: 10,
  available: () => true,
  run: async () => orchBuiltin(0),
  more: async ctx => { const s = state.sec; if (!s || !s.gallery) return []; ctx.memo.free.page = (ctx.memo.free.page || 0) + 1; return orchBuiltin(ctx.memo.free.page); } });
function orchBuiltin(page) {
  const s = state.sec;
  if (!s || !s.model || s.status !== 'ready' || s.model.type === 'none') return [];
  // 10.15: labelled sections are drawn from their plan (designs engine); the single-list views would drop a section
  // 10.16: so is one statement with a list (its banner would repeat the sentence as a block of text)
  if (typeof contentRead === 'function' && contentRead(state.runText || '')) return [];
  if (!s.gallery) s.gallery = suggest(s);
  const L = s.gallery.list.slice(page * 12, page * 12 + 12);
  return L.map(c => ({ id: 'b:' + s.index + ':' + c.key, engine: 'builtin', title: c.name, family: c.family || c.key, category: orchCategory((c.family || '') + ' ' + c.key + ' ' + c.name),
    prims: c.prims, edit: c.edit === 'full' ? 'full' : 'partial', complete: true, slides: 1 + (c.hidden ? 1 : 0), rich: c.engine === 'B' || (c.objects || []).length > 0,
    base: c.base ? 70 : 62 + (c.engine === 'B' ? 4 : 0), why: c.why,
    insert: async () => { chooseSuggestion(c.key); const L0 = state.lastInsert; await insertVisual(); return !!state.lastInsert && state.lastInsert !== L0; } }));
}
/* The design packs' compositions of the content's plan (the same plan Napkin and Claude get). */
registerEngine({ id: 'designs', kind: 'native', order: 20,
  available: () => true,
  // 10.17: every composition that fits is drawn (one Generate shows 20+ distinct designs; the ranking removes look-alikes)
  run: async ctx => orchDesigns(ctx, 40),
  more: async ctx => orchDesigns(ctx, 8) });
/* 10.16: the facts every design of a text must show (beyond its items, which planRender already requires): a statement's
   subject, verbs and object; labelled sections' names. */
const orchFacts = P => { const st = P && P.statement;
  return (st ? [st.subject].concat(st.verbs || [], [st.object]) : P && P.sections ? planGroups(P).map(x => x.g.name) : []).filter(Boolean); };
const orchMissing = (prims, facts) => { const T = prims.filter(p => p.text).map(p => String(p.text)).join(' ').replace(/\s+/g, ' ').toLowerCase();
  return facts.filter(f => !T.includes(String(f).replace(/\s+/g, ' ').toLowerCase())); };
async function orchDesigns(ctx, max) {
  const m = ctx.memo.free;
  if (!m.plan) {
    const prep = await PANELS.napkin.prepared(ctx.text);
    if (prep.error || prep.record || (prep.points || []).length < 2) return [];
    const plan = planFromPrep(prep), d = planAtDensity(plan, ctx.R, 'auto');
    Object.assign(m, { plan, d, seen: new Set() });
  }
  // 10.15: labelled sections have no built-in single-list views, so more of their compositions are drawn here; the
  // learner-style ones (learning pack) rank above the general grouped layouts
  const sec = !!m.d.plan.sections, facts = orchFacts(m.plan);
  // 10.18: a composition that leaves out the topic or the heading gets them as a caption band above it (plan.js
  // planCaptionFamily) instead of being left out of the gallery
  const list = planMoreDesigns(m.d.plan, ctx.R, m.seen, sec ? max + 10 : max).map(r => {
    if (m.d.density !== 'full' || !orchMissing(r.prims, facts).length) return r;
    const c = planRender(Object.assign({}, m.d.plan, { style: r.style }), 'cap:' + r.key, ctx.R);
    return c.ok && !orchMissing(c.prims, facts).length ? c : r;
  });
  return list.map(r => ({ id: 'd:' + planDesignKey(r), engine: 'designs', title: r.name + (planStyleName(r.style) ? ' · ' + planStyleName(r.style) : ''), family: r.family, category: orchCategory(r.family + ' ' + r.key),
    prims: r.prims, edit: 'full', complete: m.d.density === 'full' && !orchMissing(r.prims, orchFacts(m.plan)).length, slides: 1, rich: /modern|pro|showcase|learning|concepts|scenes/.test(PLAN_LAYOUTS[r.key] && PLAN_LAYOUTS[r.key].pack || ''),
    base: 62 + orchPackBonus(r.key) + orchAppeal(r.key) - (m.d.density === 'names' ? 6 : 0) - (sec && !/learning|concepts|scenes/.test(PLAN_LAYOUTS[r.key] && PLAN_LAYOUTS[r.key].pack || '') ? 8 : 0), why: r.kind,
    insert: async () => { ST.designs = [{ r, plan: m.d.plan, full: m.plan, density: m.d.density, from: 'your text' }]; ST.sel = 0; const L0 = state.lastInsert; await insertDesign(); return !!state.lastInsert && state.lastInsert !== L0; } }));
}
// the newer packs' compositions are the richer ones (hero-style showcase first)
// 10.17: learner appeal - the compositions closest to AI infographics (a hero object, connectors, icon tiles) first
const orchAppeal = k => (PLAN_LAYOUTS[k] && PLAN_LAYOUTS[k].appeal) | 0;
const orchPackBonus = k => { const p = (PLAN_LAYOUTS[k] && PLAN_LAYOUTS[k].pack) || ''; return /scenes/.test(p) ? 12 : /learning|concepts/.test(p) ? 10 : /showcase/.test(p) ? 8 : /modern/.test(p) ? 4 : /pro/.test(p) ? 2 : 0; };
/* A provider's result as candidates: its designs as native, editable objects first (never the picture by default). */
function orchProvider(key) {
  return { id: key, kind: 'paid', order: key === 'napkin' ? 60 : 70,
    available: () => !!(PANELS[key] && PANELS[key].auto && PANELS[key].auto.available()),
    cached: async ctx => { const R = await PANELS[key].auto.cached(ctx.text); return R ? orchFrom(key, R) : null; },
    run: async () => { const R = await PANELS[key].auto.request(4); return R ? orchFrom(key, R) : []; } };
}
function orchFrom(key, R) {
  const A = PANELS[key].auto, out = [];
  // Claude: its plan in every composition that suits it (the hybrid flow), drawn here as native shapes
  const plan = key === 'claude' && (R.items.plan || (R.items.find(i => i.plan) || {}).plan);
  if (plan) out.push(...orchConceptDesigns(key, plan), ...orchPlanDesigns(key, plan));
  R.items.forEach((it, i) => {
    if (plan && it.fmt === 'plan') return;               // its layouts are among the plan's designs above
    const fe = A.feOK(it), ed = A.usable(it);
    if (!fe && !ed) return;
    const mode = fe ? 'origedit' : 'edit', prims = fe ? it.fe.parts[0] : it.conv.prims, rep = fe ? it.fe.report : it.conv.report || {};
    const complete = fe ? !it.fe.check.missing.length : it.check.status !== 'partial';
    out.push({ id: `${key}:${it.rid || ''}:${it.n}:${mode}`, engine: key, own: true, title: fe ? 'AI-designed infographic' : 'AI-designed layout' + (it.conv.arrangement ? ': ' + it.conv.arrangement : ''),
      family: (it.conv && it.conv.arrangement) || 'design', category: orchCategory((it.conv && it.conv.arrangement) || it.layout || ''),
      prims, edit: rep.pictures ? 'partial' : 'full', complete, slides: fe ? it.fe.parts.length : 1, rich: true,
      base: (fe ? 72 : 66) - (fe ? Math.min(6, it.fe.warn.length) : 0), why: fe ? 'designed by AI, drawn as editable shapes and text' : 'designed by AI, rebuilt in the template',
      insert: async () => { const L0 = state.lastInsert; await A.insert(i, mode); return !!state.lastInsert && state.lastInsert !== L0; } });
  });
  return out;
}
/* 10.16: Claude's own compositions (its plan's "concepts"): its design, drawn as native shapes and checked like every
   layout (plan.js planConceptFamily). Each is its own design in the gallery, ranked above the template layouts. */
function orchConceptDesigns(key, plan) {
  const R = Object.assign({}, TEMPLATE.contentArea), out = [];
  (plan.concepts || []).forEach((c, i) => {
    const r = planRender(plan, 'ai:' + i, R);
    if (!r.ok) { orchNote(`${key} concept "${c.name}" not offered: ${r.why}`); return; }
    const cat = orchCategory(c.name + ' ' + c.idea);
    out.push({ id: `${key}:c:${i}:${hashText(JSON.stringify(c.elements)).slice(0, 10)}`, engine: key, own: true, title: c.name, family: 'ai-concept-' + i,
      category: cat === 'Infographic' ? 'AI concept' : cat, prims: r.prims, edit: 'full', complete: true, slides: 1, rich: true, base: 90, concept: true,   // 10.17: above the built-in scenes (base up to 82)
      why: 'designed by AI' + (c.idea ? ': ' + c.idea : '') + ' - drawn as editable shapes',
      insert: async () => { ST.designs = [{ r, plan, full: plan, density: 'full', from: 'AI design' }]; ST.sel = 0; const L0 = state.lastInsert; await insertDesign(); return !!state.lastInsert && state.lastInsert !== L0; } });
  });
  return out;
}
/* An AI plan's compositions (up to 12, the richest first), each insertable like a design of the packs. */
function orchPlanDesigns(key, plan) {
  const R = Object.assign({}, TEMPLATE.contentArea), d = planAtDensity(plan, R, 'auto'), seen = new Set();
  return planMoreDesigns(d.plan, R, seen, 12).map(r => ({ id: `${key}:p:${planDesignKey(r)}`, engine: key, title: r.name, family: r.family, category: orchCategory(r.family + ' ' + r.key),
    // 10.16: above the built-in suggestions (base 70): where the AI's plan and the built-in analysis give the same picture,
    // the look-alike check keeps the AI-designed one
    prims: r.prims, edit: 'full', complete: d.density === 'full', slides: 1, rich: true, base: 72 + orchPackBonus(r.key) + orchAppeal(r.key) - (d.density === 'names' ? 6 : 0), why: 'designed with AI, drawn as editable shapes',
    insert: async () => { ST.designs = [{ r, plan: d.plan, full: plan, density: d.density, from: 'AI design' }]; ST.sel = 0; const L0 = state.lastInsert; await insertDesign(); return !!state.lastInsert && state.lastInsert !== L0; } }));
}
registerEngine(orchProvider('napkin'));
registerEngine(orchProvider('claude'));
/* ENGINE NOTES - a future engine (e.g. "VisualX": richer AI infographic compositions that stay editable) registers
   itself the same way: registerEngine({ id: 'visualx', kind: 'native'|'paid', order, available(ctx), run(ctx) ->
   candidates, cached?(ctx), more?(ctx) }). Its candidates are ranked with all others; the app needs no change. A
   candidate with style: 'rich' is shown under the gallery's "Rich" filter once one exists (app.js ORCH_FILTERS). */
