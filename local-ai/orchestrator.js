/* AI Visual Builder 10.13 - one "Generate visuals": the engines behind it, chosen here, never by the user.
   An engine turns the content into candidates (a visual that can be previewed and inserted):
     { id, engine, title, category, family, prims (preview in the template's content area), edit: 'full'|'partial',
       complete, slides, score, insert: async () => true when it went in }
   Engines, in the order they run (registerEngine adds more, e.g. a future "VisualX" engine; see ENGINE NOTES below):
     builtin   free   the built-in suggestions (gallery.js) for the content's section: charts, records, pictorial views
     designs   free   the design packs' compositions (plan.js + packs/*.js) from the content's own plan
     napkin    paid   Napkin AI; its designs go in as native, editable objects (faithful.js; the rebuilt version when not)
     claude    paid   Claude AI's design specification, drawn here in the design packs
   Paid engines follow the administrator's policy (panel host config.json "paid_policy", shown nowhere in the app):
     never         only the free engines
     when-needed   (default) one paid request when the free engines give fewer than ORCH_STRONG strong visuals, or the
                   text is explanatory prose (where the built-in layouts are weakest); never for records of exact values
     always        one paid request for every new text
   Cost control: the result the panel host kept for the same text is reused (free); a text already sent in the last
   24 hours is not sent again (this PC); at most one paid request per Generate; the providers' own daily caps and
   duplicate guards stay in force (server.py). When the first paid engine fails or gives nothing usable, the next one
   is tried; when all fail, the free visuals are shown with a plain note.
   Ranking: content accuracy, editability, design richness and readability; duplicates removed (same layout, same
   family); variety enforced (categories in turn); 10-20 shown, the best first. */
const ORCH_MAX = 20, ORCH_MIN = 10, ORCH_STRONG = 10;
const ORCH = { engines: [], memo: new Map(), run: 0, last: null, log: [] };
const PAID_STORE = 'aivb.paid.v1';
function registerEngine(e) { ORCH.engines = ORCH.engines.filter(x => x.id !== e.id).concat([Object.assign({ kind: 'native', order: 50 }, e)]).sort((a, b) => a.order - b.order); }
const orchPolicy = () => { let v = ''; try { v = localStorage.getItem('aivb.paidPolicy') || ''; } catch (e) { /* none */ }
  v = v || (state.svc && state.svc.orchestrate && state.svc.orchestrate.paid) || 'when-needed';
  return ['never', 'when-needed', 'always'].includes(v) ? v : 'when-needed'; };
const orchOrder = () => ((state.svc && state.svc.orchestrate && state.svc.orchestrate.order) || ['napkin', 'claude']).filter(k => ORCH.engines.some(e => e.id === k));
const orchNote = (what, o) => { ORCH.log.push(Object.assign({ at: new Date().toISOString().slice(11, 19), what }, o || {})); if (ORCH.log.length > 200) ORCH.log.shift(); };

/* What a visual is, for the gallery's variety and its label. */
const ORCH_CATS = [['Roadmap', /roadmap/], ['Timeline', /timeline|milestone/], ['Cycle', /cycle/], ['Funnel', /funnel/],
  ['Comparison', /versus|split|compare|table|matrix2/], ['Hub and spoke', /hub|radial|ecosystem|spoke|wheel|orbit/], ['Pillars', /pillar|columns|p-col/],
  ['Framework', /quadrant|framework|capmap|capability|swot|matrix/], ['Hierarchy', /tree|pyramid|layers|stack|hierarch|org/],
  ['Architecture', /architecture|platform|modules|planes|swimlane/],
  ['Process', /chevron|stair|step|pipeline|flow|arrow|snake|process|circleflow|p-row|p-path|scene|staircase/],
  ['Chart', /(?:v?bar|hbar|chart|line|donut|kpi|scatter|heatmap|progress|distribution|grouped|stacked)/], ['Cards', /grid|card|rows|tile|list|record|fixed/]];
const orchCategory = s => { s = String(s || '').toLowerCase(); const c = ORCH_CATS.find(([, re]) => re.test(s)); return c ? c[0] : 'Infographic'; };
const orchSig = prims => typeof signature === 'function' ? signature(prims) : String(prims.length);
const orchMinPt = prims => Math.min(99, ...prims.filter(p => p.text).map(p => p.size || 99));

/* Score: accuracy first, then editability, richness and readability (0-100). */
function orchScore(c) {
  let s = c.base;
  s += c.complete === false ? -25 : 10;
  s += c.edit === 'full' ? 8 : 0;
  s += c.rich ? 6 : 0;
  const m = orchMinPt(c.prims);
  s += m >= BRAND.minPt ? 4 : m >= 14 ? -2 : -8;
  return Math.max(0, Math.min(100, Math.round(s)));
}
/* The best, varied list: duplicates (same layout signature, or the same family twice) removed; categories in turn,
   each at most 3 times before every other category had its turn. */
function orchRank(all, max) {
  const seen = new Set(), fam = new Set(), pool = [];
  all.filter(c => c && c.prims && c.prims.length).map(c => Object.assign(c, { score: orchScore(c) })).sort((a, b) => b.score - a.score).forEach(c => {
    const sig = orchSig(c.prims), fk = c.engine === 'napkin' || c.engine === 'claude' ? c.id : c.category + '|' + c.family;
    if (seen.has(sig) || fam.has(fk)) return;
    seen.add(sig); fam.add(fk); pool.push(c);
  });
  const out = [], per = {};
  for (const cap of [1, 3, 99]) for (const c of pool) {
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
  const record = !!(sc && (sc.record || sc.mode === 'fixed' || sc.mode === 'data'));
  const want = policy === 'always' || (policy === 'when-needed' && !record && (strong < ORCH_STRONG || !!(sc && sc.prose)));
  orchNote(`paid policy ${policy}: ${want ? 'wanted' : 'not needed'} (${strong} strong free visuals${record ? ', exact values' : ''})`);
  // a result a provider kept for this very text costs nothing: always taken; a new request only when wanted, at most
  // one, and a second provider only when the first gave nothing usable (fallback)
  let requests = 0, paidOK = false;
  if (!memo.paidChecked) for (const id of orchOrder()) {
    const e = ORCH.engines.find(x => x.id === id);
    if (!e || !e.available(ctx)) { orchNote(`${id}: not available`); continue; }
    let got = [];
    try {
      const cached = await e.cached(ctx);
      if (cached && cached.length) { got = cached; orchNote(`${id}: reused its kept result for this text (no request)`); }
      else if (want && !memo.paidTried && !paidOK && requests < 2 && !(requests === 0 && paidSeen()[hash])) {
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
  // new ones first, then the ones already shown
  const fresh = orchRank(memo.cands.filter(c => !before.has(c.id)), ORCH_MAX);
  memo.list = fresh.concat((memo.list || []).filter(c => !fresh.includes(c))).slice(0, ORCH_MAX * 2);
  return { list: memo.list, fresh: fresh.length, note: fresh.length ? '' : 'Every layout that suits this content is already shown.' };
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
  run: async ctx => orchDesigns(ctx, 10),
  more: async ctx => orchDesigns(ctx, 8) });
async function orchDesigns(ctx, max) {
  const m = ctx.memo.free;
  if (!m.plan) {
    const prep = await PANELS.napkin.prepared(ctx.text);
    if (prep.error || prep.record || (prep.points || []).length < 2) return [];
    const plan = planFromPrep(prep), d = planAtDensity(plan, ctx.R, 'auto');
    Object.assign(m, { plan, d, seen: new Set() });
  }
  const list = planMoreDesigns(m.d.plan, ctx.R, m.seen, max);
  return list.map(r => ({ id: 'd:' + planDesignKey(r), engine: 'designs', title: r.name + (planStyleName(r.style) ? ' · ' + planStyleName(r.style) : ''), family: r.family, category: orchCategory(r.family + ' ' + r.key),
    prims: r.prims, edit: 'full', complete: m.d.density === 'full', slides: 1, rich: /modern|pro/.test(PLAN_LAYOUTS[r.key] && PLAN_LAYOUTS[r.key].pack || ''),
    base: 64 + (/modern/.test(PLAN_LAYOUTS[r.key] && PLAN_LAYOUTS[r.key].pack || '') ? 4 : 0) - (m.d.density === 'names' ? 6 : 0), why: r.kind,
    insert: async () => { ST.designs = [{ r, plan: m.d.plan, full: m.plan, density: m.d.density, from: 'your text' }]; ST.sel = 0; const L0 = state.lastInsert; await insertDesign(); return !!state.lastInsert && state.lastInsert !== L0; } }));
}
/* A provider's result as candidates: its designs as native, editable objects first (never the picture by default). */
function orchProvider(key) {
  return { id: key, kind: 'paid', order: key === 'napkin' ? 60 : 70,
    available: () => !!(PANELS[key] && PANELS[key].auto && PANELS[key].auto.available()),
    cached: async ctx => { const R = await PANELS[key].auto.cached(ctx.text); return R ? orchFrom(key, R) : null; },
    run: async () => { const R = await PANELS[key].auto.request(4); return R ? orchFrom(key, R) : []; } };
}
function orchFrom(key, R) {
  const A = PANELS[key].auto, out = [];
  R.items.forEach((it, i) => {
    const fe = A.feOK(it), ed = A.usable(it);
    if (!fe && !ed) return;
    const mode = fe ? 'origedit' : 'edit', prims = fe ? it.fe.parts[0] : it.conv.prims, rep = fe ? it.fe.report : it.conv.report || {};
    const complete = fe ? !it.fe.check.missing.length : it.check.status !== 'partial';
    out.push({ id: `${key}:${it.rid || ''}:${it.n}:${mode}`, engine: key, title: fe ? 'AI-designed infographic' : 'AI-designed layout' + (it.conv.arrangement ? ': ' + it.conv.arrangement : ''),
      family: (it.conv && it.conv.arrangement) || 'design', category: orchCategory((it.conv && it.conv.arrangement) || it.layout || ''),
      prims, edit: rep.pictures ? 'partial' : 'full', complete, slides: fe ? it.fe.parts.length : 1, rich: true,
      base: (fe ? 72 : 66) - (fe ? Math.min(6, it.fe.warn.length) : 0), why: fe ? 'designed by AI, drawn as editable shapes and text' : 'designed by AI, rebuilt in the template',
      insert: async () => { const L0 = state.lastInsert; await A.insert(i, mode); return !!state.lastInsert && state.lastInsert !== L0; } });
  });
  return out;
}
registerEngine(orchProvider('napkin'));
registerEngine(orchProvider('claude'));
/* ENGINE NOTES - a future engine (e.g. "VisualX": richer AI infographic compositions that stay editable) registers
   itself the same way: registerEngine({ id: 'visualx', kind: 'native'|'paid', order, available(ctx), run(ctx) ->
   candidates, cached?(ctx), more?(ctx) }). Its candidates are ranked with all others; the app needs no change. A
   candidate with style: 'rich' is shown under the gallery's "Rich" filter once one exists (app.js ORCH_FILTERS). */
