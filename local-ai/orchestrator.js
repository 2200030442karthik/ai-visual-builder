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
  const admin = state.svc && state.svc.orchestrate && state.svc.orchestrate.paid;
  if (admin === 'never') return 'never';                     // 10.24: the administrator's "never" always wins
  v = v || admin || 'when-needed';
  return ['never', 'when-needed', 'always'].includes(v) ? v : 'when-needed'; };
/* Which AI service first for this content (the other is the fallback), or the administrator's fixed order. */
function orchOrder(ctx) {
  const o = state.svc && state.svc.orchestrate && state.svc.orchestrate.order;
  if (Array.isArray(o) && o.length) return o.filter(k => ORCH.engines.some(e => e.id === k));
  const P = ctx && ctx.memo && ctx.memo.free.plan, sc = state.sec && state.sec.scene;
  const tech = !!P && (planRoles(P).supports.length > 0 || planGroups(P).length >= 2 || P.items.length >= 7 || P.items.some(i => /source|component|output/.test(i.role || '')));
  if (ctx) ctx.route = tech && !(sc && sc.prose) ? 'technical structure' : 'concepts';
  // with no order set by the administrator (config.json paid_order): Claude for technical structure, else Napkin first
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
/* 10.21.1: a deck is not the same design slide after slide - the families inserted last (ORCH.recent, newest first)
   step back a little; relevance (+30) still decides when the text states a relation */
const orchRecentPenalty = c => { const i = (ORCH.recent || []).indexOf(c.family); return i < 0 ? 0 : [12, 9, 6, 4][i] || 0; };
function orchScore(c) {
  let s = c.base - orchRecentPenalty(c);
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
/* 10.24: compositions retired from the gallery after review: text that collides in the layered stack, a lone title
   with a stray rule (poster), a small grey hub (ecosystem). Kept in the packs for editing visuals already inserted. */
// 10.26: the scenes pack and the concept tiles / bento grid ("Ring and cards", "Split panel", "Icon band", "Folder tabs",
// "Device links", "Circuit board", ...) are set aside: the built-in infographic library (packs/library-10.26.js) replaces them
const ORCH_RETIRED = /^(isostack|poster|ecosystem|concepttiles|bento|devicelinks|discgrid|hubcorners|treedown|mirrorlinks|sectionrows|splitpanel|zigzag|target|quadcircle|iconband|tabcards|callouts|chipboard|ribbontags|mindmap|circleheads)$/;
/* 10.25: the sentence in a box ("Key message", "Statement banner", "Statement with icon", "Key statement"): not an
   infographic. Shown only when no other design exists for the text (Claude breaks a paragraph into its key ideas). */
const ORCH_PLAIN = /^(statement|key_message|s-key|s-banner|s-icon)$/;
const ORCH_BASIC = /^(cards|split|grid|chevrons|stairs|vsteps|arrowband|columns|rows|numcards|keystatement|layers|layered|stair|lib_.*)$/;
const orchPlain = c => ORCH_PLAIN.test(String(c.family || '').replace(/:\d+$/, ''));
function orchRank(all, max, shown, strict) {
  const seen = new Set(), fam = new Set(), pool = [], prints = [];
  let live = all.filter(c => c && c.prims && c.prims.length && !ORCH_RETIRED.test(String(c.family || '').replace(/:\d+$/, '')));
  // 10.26 (owner's review): when the reference layouts fit the content (4 or more), the basic designs the owner rejected
  // (numbered cards, split panels, feature columns, vertical steps, chevrons, icon grid, structured list, staircase,
  // arrow band, statement spotlight, layered architecture) are left out; the richer built-in designs follow the
  // reference ones. Content the reference layouts cannot draw (sections, records) keeps every design.
  if (live.filter(c => c.ref).length >= 4) live = live.filter(c => c.ref || !ORCH_BASIC.test(String(c.family || '').replace(/:\d+$/, '')));
  const rich = live.filter(c => !orchPlain(c));
  (rich.length ? rich : live).map(c => Object.assign(c, { score: orchScore(c) })).sort((a, b) => b.score - a.score).forEach(c => {
    // an AI service's own drawings are each their own design; its plan drawn here competes by family like the rest
    const sig = orchSig(c.prims), fk = c.own ? c.id : c.category + '|' + c.family, fp = c.footprint || (c.footprint = orchFootprint(c.prims));
    const look = { fp, sp: c.shapeprint || (c.shapeprint = orchShapePrint(c.prims)), lib: c.lib, ref: c.ref };
    // 10.26: the library's variants of one layout are each their own design (other holders, cards, marks, tones);
    // two different layouts that look the same are still look-alikes
    if (seen.has(sig) || fam.has(fk) || (shown && shown.has(fk)) || prints.some(q => !(q.lib && q.lib === c.lib) && !(q.ref && c.ref) && (orchSame(q.fp, fp) || orchLooksSame(q, look)))) return;
    seen.add(sig); fam.add(fk); prints.push(look); pool.push(c);
  });
  // 10.16: never padded with weak designs - when six or more designs with objects and hierarchy exist, the plain
  // ones (text in boxes, richness under 3) are left out instead of filling the gallery to its maximum
  // and designs that leave out a fact of the text (a statement's subject, verbs or object, a section's name) or draw
  // no object at all are left out when six or more complete designs with objects exist
  const objs = c => c.objects != null ? c.objects : (c.objects = new Set(c.prims.filter(p => p.cmp && p.cmp !== 'none').map(p => p.grp)).size);
  // 10.21.1: a design that draws the relation the text states (a cycle as a cycle) is kept even without pictures
  const good = c => c.own || (c.richness >= 3 && c.complete !== false && objs(c) > 0) || (c.relevant && c.complete !== false && c.richness >= 2);
  const strong = pool.filter(c => c.richness >= 4 && good(c)).length, keep = strong >= 6 || strict ? pool.filter(good) : pool;
  const out = [], per = {};
  for (const cap of [1, 3, 99]) for (const c of keep) {
    if (out.length >= max) break;
    // 10.21.1: a design that draws the stated relation may take a second place in its category in the first round
    if (out.includes(c) || ((per[c.category] || 0) >= cap && !(c.relevant && cap === 1 && (per[c.category] || 0) < 2))) continue;
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
  if (typeof brandSource === 'function') brandSource(text);     // 10.19: names the text capitalises keep their capitals (sentence case)
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
  // 10.19, AI-first: with both services, Napkin and Claude design for the text at the same time (V10.18: one after the
  // other, up to 3 minutes); each one's designs join the gallery as soon as they arrive. The same cost rules hold: a kept
  // result is reused free, a text sent in the last 24 hours is not sent again, one request per service.
  if (!memo.paidChecked && both) {
    const seen = !!paidSeen()[hash], avail = order.map(id => ORCH.engines.find(x => x.id === id)).filter(e => e && e.available(ctx));
    order.filter(id => !avail.some(e => e.id === id)).forEach(id => orchNote(`${id}: not available`));
    let pending = avail.length;
    const one = async e => {
      let got = [];
      try {
        const cached = await e.cached(ctx);
        if (cached && cached.length) { got = cached; orchNote(`${e.id}: reused its kept result for this text (no request)`); }
        else if (want && !memo.paidTried && !seen) {
          requests++; paidMark(hash, e.id); paidUsed = true;
          onStage(`Adding AI-designed options (${pending} AI service${pending > 1 ? 's' : ''} designing)…`, orchRank(memo.cands.slice(), ORCH_MAX));
          got = await e.run(ctx);
          orchNote(`${e.id}: requested, ${got.length} usable`);
        } else if (want && seen) orchNote(`${e.id}: this text was sent in the last 24 hours; not sent again`);
      } catch (err) { orchNote(`${e.id} failed: ${errText(err)}`); got = []; }
      pending--;
      if (run !== ORCH.run) return;
      if (got.length) { memo.cands.push(...got); memo.paidFrom = memo.paidFrom || e.id; paidOK = true;
        if (pending) onStage(`Adding AI-designed options (${pending} AI service designing)…`, orchRank(memo.cands.slice(), ORCH_MAX)); }
    };
    await Promise.all(avail.map(one));
    if (run !== ORCH.run) return null;
    if (requests && !paidOK) note = 'The AI design services gave no usable design this time; these visuals are built in.';
  } else if (!memo.paidChecked) for (const id of order) {
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
  let fresh = orchRank(memo.cands.filter(c => !before.has(c.id)), ORCH_MAX, shownFam, strict);
  // 10.25: when the new layouts run out, the shown ones in other colour schemes and spacing (each look once), so
  // "More visuals" keeps giving new options click after click
  if (fresh.length < 6) {
    memo.variantRound = (memo.variantRound || 0) + 1;
    for (let k = 0; k < 3 && fresh.length < 6; k++) {
      for (const e of ORCH.engines.filter(x => x.kind === 'native' && x.more && x.available(ctx))) {
        try { memo.cands.push(...await e.more(ctx)); } catch (err) { /* nothing more from it */ }
      }
      const pool = memo.cands.filter(c => !before.has(c.id) && !fresh.includes(c));
      const extra = orchRank(pool, 8 - fresh.length, null, strict).filter(c => !fresh.some(f => f.family === c.family));
      fresh = fresh.concat(extra);
    }
  }
  memo.list = fresh.concat((memo.list || []).filter(c => !fresh.includes(c))).slice(0, ORCH_MAX * 4);
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
    fit: orchFits(R => c.base ? buildDiagram(R, s.model, c.key, 0) : buildChoice(R, s, c.key, 0)),
    insert: async () => { chooseSuggestion(c.key); const L0 = state.lastInsert; await insertVisual(); return !!state.lastInsert && state.lastInsert !== L0; } }));
}
/* 10.21.1: fit(R) - does this design lay out in the free area R of a slide (nothing outside, text kept at the template
   minimum)? Used to offer a design that fits when the chosen one does not; never inserts anything. */
const orchFits = build => R => typeof fitsIn === 'function' && !!fitsIn(build, R, nativeFloor(build));
const orchPlanBuild = (plan, key, style, density) => R => { const pl = Object.assign({}, plan, { style }), x = planRender(density === 'names' ? planNames(pl) : pl, key, R); return x.ok ? x : null; };
/* The design packs' compositions of the content's plan (the same plan Napkin and Claude get). */
registerEngine({ id: 'designs', kind: 'native', order: 20,
  available: () => true,
  // 10.17: every composition that fits is drawn (one Generate shows 20+ distinct designs; the ranking removes look-alikes)
  run: async ctx => orchDesigns(ctx, 20),   // 10.26: 20 (was 40) - the library engine gives most designs now
  more: async ctx => orchDesigns(ctx, 8) });
/* 10.16: the facts every design of a text must show (beyond its items, which planRender already requires): a statement's
   subject, verbs and object; labelled sections' names. */
const orchFacts = P => { const st = P && P.statement;
  return (st ? [st.subject].concat(st.verbs || [], [st.object]) : P && P.sections ? (P.paragraph ? [P.title] : []).concat(planGroups(P).map(x => x.g.name)) : []).filter(Boolean); };
const orchMissing = (prims, facts) => { const T = prims.filter(p => p.text).map(p => String(p.text)).join(' ').replace(/\s+/g, ' ').toLowerCase();
  return facts.filter(f => !T.includes(String(f).replace(/\s+/g, ' ').toLowerCase())); };
async function orchPlanInit(ctx) {
  const m = ctx.memo.free;
  if (!m.plan) {
    const prep = await PANELS.napkin.prepared(ctx.text);
    if (prep.error || prep.record || (prep.points || []).length < 2) return null;
    const plan = planFromPrep(prep), d = planAtDensity(plan, ctx.R, 'auto');
    Object.assign(m, { plan, d, seen: new Set() });
  }
  return m;
}
/* 10.26: the built-in infographic library (packs/library-10.26.js): 25 layouts x 120 variants. Each round offers the
   next variant of every layout that suits the text, so Generate shows one of each and every "More visuals" new ones. */
/* 10.26 (owner's review): the generic library variants read as basic - retired from the gallery (kept for editing
   visuals already inserted); the reference layouts (packs/reference-10.26.js) lead instead. */
registerEngine({ id: 'reference', kind: 'native', order: 14,
  available: () => typeof REF !== 'undefined' && REF.layouts.length > 0,
  run: async ctx => orchReference(ctx, 20),
  more: async ctx => orchReference(ctx, 10) });
async function orchReference(ctx, max) {
  const m = await orchPlanInit(ctx);
  if (!m) return [];
  const rf = m.ref || (m.ref = { round: 0, at: 0, P: m.d.plan, names: m.d.density === 'names', layouts: REF.layouts.filter(L => !L.why(m.d.plan)), bad: {} });
  if (!rf.layouts.length && !rf.names && m.plan.items.some(i => i.detail)) { rf.P = planNames(m.plan); rf.names = true; rf.layouts = REF.layouts.filter(L => !L.why(rf.P)); }
  const facts = orchFacts(m.plan), out = [];
  // round 0: every layout in a colour per point; round 1: in one colour; then other colour schemes
  for (let guard = 0; out.length < max && rf.round < 20 && guard < 200; guard++) {
    if (!rf.layouts.some(L => !rf.bad[L.key])) break;
    if (rf.at >= rf.layouts.length) { rf.at = 0; rf.round++; if (out.length) break; continue; }
    const L = rf.layouts[rf.at++];
    if (rf.bad[L.key]) continue;
    const key = `ref_${L.key}_${rf.round % 2 ? 'c' : 'm'}`, style = { accent: Math.floor(rf.round / 2) * 3 % 10, spacing: 'fill' };
    const Ps = Object.assign({}, rf.P, { style: Object.assign({}, rf.P.style, style) });
    let r = planRender(Ps, key, ctx.R);
    if (r.ok && orchMissing(r.prims, facts).length) { const c = planRender(Ps, 'cap:' + key, ctx.R); if (c.ok && orchMissing(c.prims, facts).length < orchMissing(r.prims, facts).length) r = c; }
    if (!r.ok) { if (rf.round < 2) rf.bad[L.key] = 1; continue; }
    const names = rf.names, plan = rf.P;
    out.push({ id: 'R:' + key + ':' + r.style.accent + (names ? ':n' : ''), engine: 'designs', ref: L.key, lib: 'ref:' + L.key, title: r.name + (names ? ' · point names only' : ''), family: key + ':' + r.style.accent,
      category: 'Reference: ' + L.name, prims: r.prims, edit: r.prims.some(p => p.t === 'image') ? 'partial' : 'full', complete: !names && !orchMissing(r.prims, facts).length, slides: 1, rich: true,
      relevant: true, base: 110 - (names ? 6 : 0) - Math.min(rf.round, 6), why: r.kind,
      fit: orchFits(orchPlanBuild(m.plan, r.key, r.style, names ? 'names' : 'full')),
      insert: async () => { ST.designs = [{ r, plan, full: m.plan, density: names ? 'names' : 'full', from: 'your text' }]; ST.sel = 0; const L0 = state.lastInsert; await insertDesign(); return !!state.lastInsert && state.lastInsert !== L0; } });
  }
  return out;
}
registerEngine({ id: 'library', kind: 'native', order: 15,
  available: () => false,      // 10.26: retired from the gallery (see "reference")
  run: async ctx => orchLibrary(ctx, 18),
  more: async ctx => orchLibrary(ctx, 12) });
async function orchLibrary(ctx, max) {
  const m = await orchPlanInit(ctx);
  if (!m) return [];
  const lib = m.lib || (m.lib = { round: 0, at: 0, fails: {}, P: m.d.plan, names: m.d.density === 'names', layouts: LIB.layouts.filter(L => !L.why(m.d.plan)) });
  const facts = orchFacts(m.plan), out = [], nV = LIB.variants.length;
  for (let guard = 0; out.length < max && lib.round < nV && guard < 600; guard++) {
    const live = lib.layouts.filter(L => (lib.fails[L.key] || 0) < 8), P = lib.P;
    if (!live.length && !(lib.round === 0 && !lib.names)) break;
    if (lib.at >= live.length) {
      // long content: when no layout fits with every description, the point names (said in the design's name)
      if (!out.length && lib.round === 0 && !lib.names && P.items.some(i => i.detail)) {
        lib.P = planNames(P); lib.names = true; lib.fails = {}; lib.at = 0; lib.layouts = LIB.layouts.filter(L => !L.why(lib.P)); continue; }
      lib.at = 0; lib.round++;
      if (out.length) break;          // one variant of each layout per click: two variants of one layout look alike
      continue;
    }
    const L = live[lib.at++], vi = (lib.round + LIB.layouts.indexOf(L) * 7) % nV, key = LIB.key(L.key, vi);
    const style = { accent: (lib.round * 3 + LIB.layouts.indexOf(L)) % 10, spacing: 'fill' };
    const Ps = Object.assign({}, P, { style: Object.assign({}, P.style, style) });
    let r = planRender(Ps, key, ctx.R);
    // a statement's subject or a paragraph's topic the layout leaves out: the same design with it as a caption above
    if (r.ok && orchMissing(r.prims, facts).length) { const c = planRender(Ps, 'cap:' + key, ctx.R); if (c.ok && orchMissing(c.prims, facts).length < orchMissing(r.prims, facts).length) r = c; }
    if (!r.ok) { if (!/numbers only/.test(r.why || '')) lib.fails[L.key] = (lib.fails[L.key] || 0) + 1; continue; }
    lib.fails[L.key] = 0;
    const names = lib.names, plan = lib.P;
    out.push({ id: 'L:' + key + ':' + r.style.accent + (names ? ':n' : ''), engine: 'designs', lib: L.key, title: r.name + (names ? ' · point names only' : ''), family: key,
      category: 'Library: ' + L.name, prims: r.prims, edit: r.prims.some(p => p.t === 'image') ? 'partial' : 'full', complete: !names && !orchMissing(r.prims, facts).length, slides: 1, rich: true,
      relevant: L.cat !== 'List' && L.cat !== 'Concept', base: 90 + (L.cat === 'Cycle' || L.cat === 'Hierarchy' ? 8 : L.cat === 'Process' ? 4 : 0) - (names ? 6 : 0), why: r.kind,
      fit: orchFits(orchPlanBuild(m.plan, r.key, r.style, names ? 'names' : 'full')),
      insert: async () => { ST.designs = [{ r, plan, full: m.plan, density: names ? 'names' : 'full', from: 'your text' }]; ST.sel = 0; const L0 = state.lastInsert; await insertDesign(); return !!state.lastInsert && state.lastInsert !== L0; } });
  }
  return out;
}
async function orchDesigns(ctx, max) {
  const m = await orchPlanInit(ctx);
  if (!m) return [];
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
  // 10.21.1: one of the leading designs with objects is offered with 2.5D icons (editable tiles) instead of flat discs -
  // the same composition is never shown twice, so it replaces its flat version
  if (typeof planIsoVariant === 'function') {
    for (const r of list.slice(1, 6)) { const v = planIsoVariant(m.d.plan, r, ctx.R); if (v && !m.seen.has(planDesignKey(v))) { m.seen.add(planDesignKey(v)); list[list.indexOf(r)] = v; break; } }
  }
  const packOf = r => PLAN_LAYOUTS[r.key] && PLAN_LAYOUTS[r.key].pack || '';
  const out = list.map(r => ({ id: 'd:' + planDesignKey(r), engine: 'designs', title: r.name + (planStyleName(r.style) ? ' · ' + planStyleName(r.style) : ''), family: r.family, category: orchCategory(r.family + ' ' + r.key),
    prims: r.prims, edit: r.prims.some(p => p.t === 'image') ? 'partial' : 'full', complete: m.d.density === 'full' && !orchMissing(r.prims, orchFacts(m.plan)).length, slides: 1, rich: /modern|pro|showcase|learning|concepts|scenes|antv|infographics/.test(packOf(r)),
    relevant: orchRelevance(r.key, m.d.plan) >= 30,
    base: 62 + orchPackBonus(r.key) + orchAppeal(r.key) + orchRelevance(r.key, m.d.plan) + orchVariety(ctx.text, r.family) - (m.d.density === 'names' ? 6 : 0) - (sec && !/learning|concepts|scenes/.test(packOf(r)) && orchRelevance(r.key, m.d.plan) <= 0 ? 8 : 0), why: r.kind,
    fit: orchFits(orchPlanBuild(m.plan, r.key, r.style, m.d.density)),
    insert: async () => { ST.designs = [{ r, plan: m.d.plan, full: m.plan, density: m.d.density, from: 'your text' }]; ST.sel = 0; const L0 = state.lastInsert; await insertDesign(); return !!state.lastInsert && state.lastInsert !== L0; } }));
  // 10.19: large content. When every description fits only few compositions on one slide, the gallery still offers 20+:
  // (1) the same design on two slides (every point and description, split where the content divides: by section, else
  // in half; the first part on the selected slide, the rest on a new slide after it), (2) condensed designs (the point
  // names only, said in their name). Neither leaves out a point; the condensed ones leave out the descriptions, visibly.
  // (target: some candidates are removed as look-alikes when the gallery is ranked)
  const complete = out.filter(c => c.complete).length, target = ORCH_MIN + 6;
  // 10.24: only for large content (7+ points) or when few one-slide designs fit - four short points are never split
  if (!ctx.more && complete < target && m.plan.items.length >= 4 && (m.plan.items.length >= 7 || complete < 6)) {
    if (!m.split) {
      const S = planSlides(m.plan, ctx.R, { slides: 'split', density: 'full', overview: false });
      // a part that is one section is drawn as a list captioned with the section's name (the topic too, on the first)
      const asList = (q, k) => { const g = (q.groups || []).length === 1 ? q.groups[0] : null;
        return g ? Object.assign({}, q, { groups: [], items: q.items.map(i => Object.assign({}, i, { group: '' })), sectionName: g.name, relation: 'independent',
          title: m.plan.title, paragraph: !!m.plan.paragraph && k === 0, statement: null }) : q; };
      m.split = S.parts && S.parts.length >= 2 && S.parts.length <= 3 ? S.parts.map(asList) : [];
    }
    if (m.split.length >= 2) {
      const n = m.split.length, seen2 = new Set(), first = planMoreDesigns(m.split[0], ctx.R, seen2, ORCH_MIN + 8);
      // each part: the design itself, or its captioned form when it would leave out the section's name or the topic
      const need = (q, k) => [q.sectionName, k === 0 && m.plan.paragraph ? m.plan.title : ''].filter(Boolean);
      const draw = (q, k, key, style) => { const p = Object.assign({}, q, { style }), r = planRender(p, key, ctx.R);
        if (r.ok && !orchMissing(r.prims, need(q, k)).length) return r;
        const c = planRender(p, 'cap:' + key, ctx.R); return c.ok && !orchMissing(c.prims, need(q, k)).length ? c : null; };
      let added = 0;
      first.forEach(r1x => {
        if (out.length >= max + ORCH_MIN || added >= target + 2 - complete) return;
        const r1 = draw(m.split[0], 0, r1x.key, r1x.style);
        if (!r1) return;
        const rest = m.split.slice(1).map((q, j) => draw(q, j + 1, r1x.key, r1x.style));
        if (rest.some(r => !r)) return;
        const parts = [{ r: r1, plan: m.split[0] }].concat(rest.map((r, k) => ({ r, plan: m.split[k + 1] })));
        const all = r1.prims.concat(...rest.map(r => r.prims)), ok = !orchMissing(all, orchFacts(m.plan)).length && planCoverage(m.plan, parts.map(p => p.r)).length === 0;
        if (!ok) return;
        added++;
        out.push({ id: `d${n}:` + planDesignKey(r1), engine: 'designs', title: `${r1.name} · ${n} slides`, family: r1.family + ':' + n, category: orchCategory(r1.family + ' ' + r1.key),
          prims: r1.prims, nextPrims: rest.map(r => r.prims), edit: 'full', complete: true, slides: n, rich: /modern|pro|showcase|learning|concepts|scenes|antv|infographics/.test(packOf(r1)),
          base: 50 + orchPackBonus(r1.key) + orchAppeal(r1.key) - 2 * (n - 2), why: `every point and description, on ${n} slides`,   // one-slide designs first
          insert: async () => { ST.designs = [{ r: r1, parts, plan: m.split[0], full: m.plan, density: 'full', from: 'your text' }]; ST.sel = 0; const L0 = state.lastInsert; await insertDesign(); return !!state.lastInsert && state.lastInsert !== L0; } });
      });
    }
    if (m.d.density === 'full' && m.plan.items.some(i => i.detail)) {
      if (!m.names) { m.names = planNames(m.plan); m.seenN = new Set(); }
      planMoreDesigns(m.names, ctx.R, m.seenN, Math.max(0, target + 2 - out.filter(c => c.complete).length)).forEach(r => {
        if (out.some(c => c.slides === 1 && c.family === r.family) || orchMissing(r.prims, orchFacts(m.plan)).length) return;
        out.push({ id: 'dn:' + planDesignKey(r), engine: 'designs', title: r.name + ' · names only', family: r.family, category: orchCategory(r.family + ' ' + r.key),
          prims: r.prims, edit: 'full', complete: true, condensed: true, slides: 1, rich: /modern|pro|showcase|learning|concepts|scenes|antv|infographics/.test(packOf(r)),
          base: 54 + orchPackBonus(r.key) + orchAppeal(r.key), why: 'condensed: every point name, without the descriptions',
          insert: async () => { ST.designs = [{ r, plan: m.names, full: m.plan, density: 'names', from: 'your text' }]; ST.sel = 0; const L0 = state.lastInsert; await insertDesign(); return !!state.lastInsert && state.lastInsert !== L0; } });
      });
    }
  }
  return out;
}
// the newer packs' compositions are the richer ones (hero-style showcase first)
// 10.17: learner appeal - the compositions closest to AI infographics (a hero object, connectors, icon tiles) first
const orchAppeal = k => (PLAN_LAYOUTS[k] && PLAN_LAYOUTS[k].appeal) | 0;
/* 10.21.1: among designs of equal standing, a different order for a different text (0..5 points, fixed for a text), so
   the same three compositions do not open every gallery of a deck */
const orchVariety = (text, fam) => { let h = 2166136261; for (const ch of String(text || '') + '|' + String(fam || '')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 6); };
/* 10.21.1: relevance before decoration. A design whose composition shows the relation the text states (a cycle drawn
   as a cycle, a comparison side by side, steps in order, levels as levels) ranks above the general compositions, which
   otherwise topped every gallery whatever the content said. Nothing changes for content that states no relation. */
const ORCH_SHAPES = { cycle: /^(cycle|cyclewheel|orbit|mirrorlinks|avcirclearrows|avring)$/, funnel: /^(funnel|avfunnel)$/, layers: /^(pyramid|isostack|stack3d|layers|stair|cylsteps|avpyramid)$/, comparison: /^(versus|contrast|splitpanel|splitpanels)$/,
  sequence: /^(pipeline|timeline|chevrons|zigzag|stair|roadmap|journey|scene|numcards|steps|cylsteps|arrowcards|avcylinders|avarrowrow|avstairsfront|avpucks|avdiamonds|avrise|avascending|avsnake|avtimeline)$/ };
/* 10.24: compositions that claim a relation of their own - a centre the points hang from, layers on top of each other,
   two sides - mislead when the text states a different one (steps drawn as spokes of a hub); they rank far below */
const ORCH_CLAIMS = /^(hub|hubcorners|ecosystem|orbit|callout|callouts|devicelinks|isostack|stack3d|layers|pyramid|quadrant|quadcircle|versus|contrast|target)$/;
function orchRelevance(k, P) {
  if (!P) return 0;
  const fam = String((PLAN_LAYOUTS[k] && PLAN_LAYOUTS[k].family) || k).replace(/^cap:/, ''), rel = /^(cycle|funnel|layers|comparison)$/.test(P.relation) ? P.relation : typeof planSeq === 'function' && planSeq(P) ? 'sequence' : '';
  // 10.23: a topic written as the course slides write it - the topic, its description, its named points and the
  // outcome - is drawn as such by the topic spotlight (packs/spotlight-10.23.js), first
  if (/^topic(?:spot|band)$/.test(fam)) return P.sections && P.intro && (P.groups || []).some(g => g.kind === 'outcome') ? 30 : 0;
  if (!rel) return 0;
  if (ORCH_SHAPES[rel].test(fam)) return 30;
  if (rel !== 'sequence' && ORCH_SHAPES.sequence.test(fam) && planSeq(P)) return 8;      // a cycle or a funnel is also an order
  return rel && ORCH_CLAIMS.test(fam) ? -20 : -6;
}
const orchPackBonus = k => { const p = (PLAN_LAYOUTS[k] && PLAN_LAYOUTS[k].pack) || ''; return /scenes|antv/.test(p) ? 12 : /learning|concepts/.test(p) ? 10 : /showcase/.test(p) ? 8 : /modern/.test(p) ? 4 : /pro/.test(p) ? 2 : 0; };
/* A provider's result as candidates: its designs as native, editable objects first (never the picture by default). */
function orchProvider(key) {
  return { id: key, kind: 'paid', order: key === 'napkin' ? 60 : 70,
    available: () => !!(PANELS[key] && PANELS[key].auto && PANELS[key].auto.available()),
    cached: async ctx => { const R = await PANELS[key].auto.cached(ctx.text); if (R && key === 'claude') await orchClaudeIcons(R, ctx && ctx.text, false); return R ? orchFrom(key, R) : null; },
    // 10.25: Claude's icons are asked for at the same time as its plan (from the points read here), not after it
    run: async ctx => {
      const early = key === 'claude' ? orchClaudeIconsEarly(ctx) : null;
      const R = await PANELS[key].auto.request(4);
      if (R && key === 'claude') { await early; await orchClaudeIcons(R, ctx && ctx.text, true); }
      return R ? orchFrom(key, R) : []; } };
}
/* 10.24: Claude's own icon for every point of its plan (one more request, with the plan's: the points it read), each
   an editable drawing of simple shapes (studio.js registerCustomIcon). Kept on this PC for the text, so the same text
   never asks again; a point Claude gives no usable icon for keeps the catalogue's object. */
const CLAUDE_ICONS_FOR = 'aivb.claude_icons_for.v1';
async function orchClaudeIcons(R, text, ask) {
  const plan = R.items && (R.items.plan || (R.items.find(i => i.plan) || {}).plan);
  if (!plan || !Array.isArray(plan.items) || !plan.items.length || typeof registerCustomIcon !== 'function') return;
  const h = hashText(String(text || '') + '|' + plan.items.map(i => i.label).join('|'));
  let kept = {};
  try { kept = JSON.parse(localStorage.getItem(CLAUDE_ICONS_FOR) || '{}'); } catch (e) { kept = {}; }
  let keys = kept[h];
  // 10.25: the icons asked for at the same time as the plan, by the point's label (no second wait)
  if (!keys) {
    let by = {}; try { by = JSON.parse(localStorage.getItem(CLAUDE_ICONS_BY) || '{}'); } catch (e) { by = {}; }
    const got = plan.items.map(i => { const k = by[iconLabelKey(i.label)]; return k && CMP[k] ? k : null; });
    if (got.filter(Boolean).length >= Math.ceil(plan.items.length * 0.6)) keys = got;
  }
  if (!keys && ask) {
    try {
      const res = await api('/api/claude/icons', { items: plan.items.map(i => ({ label: i.label, detail: i.detail || '' })) }, 120000);
      if (res && res.ok && Array.isArray(res.icons)) {
        keys = res.icons.map(ic => { if (!ic) return null; const k = registerCustomIcon(ic); if (k) saveCustomIcon(k, ic); return k; });
        kept[h] = keys;
        const all = Object.keys(kept); if (all.length > 200) delete kept[all[0]];
        try { localStorage.setItem(CLAUDE_ICONS_FOR, JSON.stringify(kept)); } catch (e) { /* not kept */ }
        orchNote(`claude icons: ${keys.filter(Boolean).length} of ${keys.length}`);
      } else orchNote('claude icons: ' + ((res && res.error) || 'none'));
    } catch (e) { orchNote('claude icons failed: ' + errText(e)); }
  }
  (keys || []).forEach((k, i) => { if (k && CMP[k] && plan.items[i]) plan.items[i].icon = k; });
}
/* 10.25: the icons for the points this panel reads in the text, asked for while Claude designs its plan; kept by label,
   so its plan's points (the same points, in the text's words) take them without another request. */
const CLAUDE_ICONS_BY = 'aivb.claude_icons_by.v1';
const iconLabelKey = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
async function orchClaudeIconsEarly(ctx) {
  try {
    if (typeof registerCustomIcon !== 'function') return;
    const prep = await PANELS.napkin.prepared(ctx.text);
    const pts = (prep && prep.points || []).filter(p => p && p.label).slice(0, 8);
    if (pts.length < 2) return;
    let by = {}; try { by = JSON.parse(localStorage.getItem(CLAUDE_ICONS_BY) || '{}'); } catch (e) { by = {}; }
    const want = pts.filter(p => !by[iconLabelKey(p.label)]);
    if (!want.length) return;
    const res = await api('/api/claude/icons', { items: want.map(p => ({ label: p.label, detail: String(p.detail || p.exact || '').slice(0, 160) })) }, 120000);
    if (!(res && res.ok && Array.isArray(res.icons))) { orchNote('claude icons (early): ' + ((res && res.error) || 'none')); return; }
    res.icons.forEach((ic, i) => { if (!ic || !want[i]) return; const k = registerCustomIcon(ic); if (k) { saveCustomIcon(k, ic); by[iconLabelKey(want[i].label)] = k; } });
    const all = Object.keys(by); all.slice(0, Math.max(0, all.length - 400)).forEach(k => delete by[k]);
    try { localStorage.setItem(CLAUDE_ICONS_BY, JSON.stringify(by)); } catch (e) { /* not kept */ }
    orchNote(`claude icons (early): ${res.icons.filter(Boolean).length} of ${want.length}`);
  } catch (e) { orchNote('claude icons (early) failed: ' + errText(e)); }
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
      category: cat === 'Infographic' ? 'AI concept' : cat, prims: r.prims, edit: 'full', complete: true, slides: 1, rich: true, base: 76, concept: true,   // 10.24: Claude's reading in the premium layouts ranks above its freehand compositions   // 10.17: above the built-in scenes (base up to 82)
      why: 'designed by AI' + (c.idea ? ': ' + c.idea : '') + ' - drawn as editable shapes',
      fit: orchFits(orchPlanBuild(plan, 'ai:' + i, r.style, 'full')),
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
    prims: r.prims, edit: 'full', complete: d.density === 'full', slides: 1, rich: true, base: 72 + orchPackBonus(r.key) + orchAppeal(r.key) + orchRelevance(r.key, d.plan) - (d.density === 'names' ? 6 : 0), why: 'designed with AI, drawn as editable shapes',
    fit: orchFits(orchPlanBuild(plan, r.key, r.style, d.density)),
    insert: async () => { ST.designs = [{ r, plan: d.plan, full: plan, density: d.density, from: 'AI design' }]; ST.sel = 0; const L0 = state.lastInsert; await insertDesign(); return !!state.lastInsert && state.lastInsert !== L0; } }));
}
/* 10.24: where a design comes from, shown on every card: Claude (its own composition, or its reading of the text drawn
   in a layout), Napkin (its design, rebuilt as editable shapes) or Built-in (this add-in's layouts, made locally). */
function orchSource(c) {
  // 10.24: in detail - which service designed it, and how it reached the slide
  const pack = (PLAN_LAYOUTS[c.family] && PLAN_LAYOUTS[c.family].pack) || '';
  // 10.26: three sources only - Built-in design pack, Claude, Napkin (the detail stays in the tooltip)
  if (c.engine === 'claude') return c.concept ? { src: 'claude', srcName: 'Claude', srcWhy: 'Composed by Claude for this text (its own layout), drawn as editable shapes' }
    : { src: 'claude', srcName: 'Claude', srcWhy: 'Claude read the text (points, order, groups, icons); drawn in a built-in layout as editable shapes' };
  if (c.engine === 'napkin') return /:origedit$/.test(c.id) ? { src: 'napkin', srcName: 'Napkin', srcWhy: 'Napkin’s own design, drawn as editable shapes and text' }
    : { src: 'napkin', srcName: 'Napkin', srcWhy: 'Designed by Napkin, rebuilt in the template as editable shapes' };
  return { src: 'builtin', srcName: 'Built-in design pack', srcWhy: c.lib ? 'From the built-in infographic library (3,000 designs), made on this PC from your text (no AI service)' : 'Made on this PC from your text by the add-in’s own layouts (no AI service)' };
}
registerEngine(orchProvider('napkin'));
registerEngine(orchProvider('claude'));
/* ENGINE NOTES - a future engine (e.g. "VisualX": richer AI infographic compositions that stay editable) registers
   itself the same way: registerEngine({ id: 'visualx', kind: 'native'|'paid', order, available(ctx), run(ctx) ->
   candidates, cached?(ctx), more?(ctx) }). Its candidates are ranked with all others; the app needs no change. A
   candidate with style: 'rich' is shown under the gallery's "Rich" filter once one exists (app.js ORCH_FILTERS). */
