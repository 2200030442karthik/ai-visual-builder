/* SL Editor 10.27: the icon library (assets/iconlib/iconlib.json, made by deploy/make-iconlib.py from the team's asset
   share: Lucide and Tabler outline icons with their tags, brand logos) and the matcher that gives every point of a
   visual the icon that depicts it.

   A point is matched on its own name (weight 3) and description (weight 1):
     1. what this PC learned (learn.py: icons the user chose or kept for a name before) - the strongest signal
     2. a brand named in the point's name (Excel, Power BI, Salesforce ...) - its logo
     3. the slide vocabulary map (role -> id card, constraints -> settings, ...) and the concept catalogue (gallery.js)
     4. the icons' own names and tags (stemmed words; an icon whose name has words the point does not say ranks lower)
   The icons of one visual are chosen together, the strongest match first, each icon once. A point nothing matches gets
   an icon from the visual's topic, else a neutral one (sparkles, lightbulb ...) - never the empty "point marker".
   Icons are drawn as SVG pictures in the design's colour (prims t 'image', icon: true; recolourable in PowerPoint). */
const ICONLIB = { ready: false, icons: [], byName: new Map(), post: new Map(), words1: new Map(), wordsM: [], concept: {}, brands: [], learned: new Map(), promise: null };
const ICON_STOP = new Set('a an and the of for to in on at by with from into via vs or as is are be it its this that these those your our their my we you they use using used based other others key main more most less very well also etc new one two three four five six first second third each per all any some via what how why when where which way ways thing things part parts step steps type types kind kinds level levels basic simple good better best high low non get make'.split(' '));
function iconStem(w) {
  w = String(w).toLowerCase();
  if (w.length > 4 && /ies$/.test(w)) w = w.slice(0, -3) + 'y';
  else if (w.length > 4 && /sses$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && /s$/.test(w) && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);
  if (w.length > 5 && /ing$/.test(w)) { w = w.slice(0, -3); if (/(.)\1$/.test(w)) w = w.slice(0, -1); }
  else if (w.length > 4 && /ed$/.test(w) && !/eed$/.test(w)) { w = w.slice(0, -2); if (/(.)\1$/.test(w)) w = w.slice(0, -1); }
  return w;
}
/* general words that name no object ("Automating tasks": the automation is the picture, not the task) count half */
const ICON_GENERIC = new Set(['task', 'work', 'information', 'item', 'activity', 'content', 'aspect', 'area', 'element', 'factor', 'detail', 'other', 'everyday', 'effective']);
const iconToks = t => (String(t || '').toLowerCase().match(/[a-z0-9]+/g) || []).filter(w => !ICON_STOP.has(w)).map(iconStem);
const iconNorm = t => ' ' + (String(t || '').toLowerCase().match(/[a-z0-9]+/g) || []).map(iconStem).join(' ') + ' ';

function iconLibLoad() {
  if (ICONLIB.promise) return ICONLIB.promise;
  ICONLIB.promise = (async () => {
    try {
      const r = await fetch('/assets/iconlib/iconlib.json', { cache: 'force-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      ICONLIB.icons = d.icons.map(([name, set, words, vb, body, mode]) => {
        const nameT = (name.replace(/^(fl|fe|fc|logos|simple)-/, '').match(/[a-z0-9]+/g) || []).map(iconStem);
        return { name, set, vb, body, mode, nameT, tagT: [...new Set(iconToks(words))].filter(w => !nameT.includes(w)) };
      });
      ICONLIB.icons.forEach((ic, i) => {
        ICONLIB.byName.set(ic.name, i);
        const add = (w, k) => { const L = ICONLIB.post.get(w) || []; if (!L.some(x => x[0] === i)) L.push([i, k]); ICONLIB.post.set(w, L); };
        ic.nameT.forEach(w => add(w, 2)); ic.tagT.forEach(w => add(w, 1));
      });
      Object.entries(d.words || {}).forEach(([k, v]) => {
        const n = iconNorm(k).trim();
        if (n.includes(' ')) ICONLIB.wordsM.push([' ' + n + ' ', v]); else ICONLIB.words1.set(n, v);
      });
      ICONLIB.concept = d.concept || {};
      // 10.28: each outline icon's colour versions (best first), as library indexes
      ICONLIB.color = new Map(Object.entries(d.color || {}).map(([k, v]) => [ICONLIB.byName.get(k), v.map(n => ICONLIB.byName.get(n)).filter(i => i != null)]).filter(([k, v]) => k != null && v.length));
      ICONLIB.brands = Object.entries(d.brands || {}).map(([k, v]) => [new RegExp('(?:^|[^a-z0-9])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![a-z0-9])', 'i'), v]);
      ICONLIB.ready = true;
    } catch (e) { console.warn('icon library not loaded', e); }
    try { await learnLoad(); } catch (e) { /* learning is optional */ }
    return ICONLIB.ready;
  })();
  return ICONLIB.promise;
}
/* waits for the library (at most ms) - Generate calls this before it designs */
async function iconLibReady(ms) { return Promise.race([iconLibLoad(), new Promise(r => setTimeout(() => r(ICONLIB.ready), ms || 4000))]); }

/* Candidate icons for one point, best first: [{ i, s, why }] */
function iconCandidates(label, detail) {
  const S = new Map(), M = new Map(), why = new Map();
  const add = (i, s, m, w) => { if (i == null) return; S.set(i, (S.get(i) || 0) + s); if (m) M.set(i, true); if (w && !why.has(i)) why.set(i, w); };
  const byN = n => ICONLIB.byName.get(n);
  // 1. learned on this PC: the icon chosen for this very name before
  const lk = iconLearnKey(label), lr = ICONLIB.learned.get(lk);
  if (lr) Object.entries(lr).forEach(([n, c]) => add(byN(n), 30 + 6 * Math.min(c, 5), true, 'chosen before'));
  // 2. a brand named in the point's name
  ICONLIB.brands.forEach(([re, n]) => { if (re.test(String(label || ''))) add(byN(n), 40, true, 'brand'); });
  // 3. the vocabulary map and the concept catalogue
  const LN = iconNorm(label), DN = iconNorm(detail), LT = iconToks(label), DT = iconToks(detail);
  ICONLIB.wordsM.forEach(([k, v]) => { const w = LN.includes(k) ? 3 : DN.includes(k) ? 1 : 0; if (w) v.forEach((n, j) => add(byN(n), (3.4 - 0.4 * j) * w, true, k.trim())); });
  const gw = t => (ICON_GENERIC.has(t) ? 0.5 : 1);
  [[LT, 3], [DT, 1]].forEach(([T, w]) => T.forEach(t => { const v = ICONLIB.words1.get(t); if (v) v.forEach((n, j) => add(byN(n), (2.4 - 0.3 * j) * w * gw(t), true, t)); }));
  if (typeof conceptScores === 'function') {
    const cs = conceptScores(String(label || ''), String(detail || ''))[0];
    if (cs && ICONLIB.concept[cs.key]) ICONLIB.concept[cs.key].forEach((n, j) => add(byN(n), Math.min(cs.score, 9) * (0.8 - 0.15 * j), true, cs.name));
  }
  // 4. the icons' names and tags
  const P = new Map();
  [[LT, 3], [DT, 1]].forEach(([T, w]) => [...new Set(T)].forEach(t => (ICONLIB.post.get(t) || []).forEach(([i, k]) => P.set(i, (P.get(i) || 0) + (k === 2 ? 1.6 : 0.7) * w * gw(t)))));
  const said = new Set(LT.concat(DT));
  P.forEach((s, i) => {
    const ic = ICONLIB.icons[i], extra = ic.nameT.filter(w => !said.has(w)).length;
    let v = s - 0.9 * extra - (/\d/.test(ic.name) ? 0.8 : 0) - (ic.set === 'tabler' ? 0.3 : 0);
    if (M.has(i)) v = Math.max(v, s * 0.5);
    if (v > 0) add(i, v, false, ic.nameT.filter(w => said.has(w)).join(' '));
  });
  return [...S.entries()].map(([i, s]) => ({ i, s, why: why.get(i) || '' })).sort((a, b) => b.s - a.s).slice(0, 10);
}
const ICON_NEUTRAL = ['sparkles', 'lightbulb', 'star', 'target', 'rocket', 'bookmark', 'badge-check', 'compass', 'gem', 'puzzle'];
/* 10.28: colour icons by default (realistic Fluent icons); localStorage aivb.icon_style = 'outline' brings back the
   one-colour outline icons. */
const iconStyle = () => { try { return localStorage.getItem('aivb.icon_style') === 'outline' ? 'outline' : 'color'; } catch (e) { return 'color'; } };
/* the pictures one candidate can be drawn as, best first: its colour versions (colour style), else itself */
function iconViews(i) {
  const ic = ICONLIB.icons[i];
  if (!ic) return [];
  if (iconStyle() !== 'color' || ic.mode === 'c') return [i];
  return ICONLIB.color.get(i) || [];
}
/* Icons for the points of one visual (each picture once; the strongest match first). topic: the visual's title.
   The meaning is matched on the words (iconCandidates); the picture is the candidate's colour version. A point whose
   good matches have no colour version keeps the accurate outline icon rather than a colour icon that means less. */
function iconLibPick(items, topic) {
  if (!ICONLIB.ready) return items.map(() => null);
  const lists = items.map(it => iconCandidates(it.label, [it.hint, it.detail].filter(Boolean).join(' ')));
  const pick = items.map(() => null), used = new Set(), pairs = [];
  const take = (k, i) => { const v = iconViews(i).find(j => !used.has(j)); if (v == null) return false; pick[k] = v; used.add(v); return true; };
  lists.forEach((L, k) => { const best = L[0] ? L[0].s : 0; L.forEach(c => { if (c.s >= 2.5 && c.s >= best * 0.55) pairs.push({ k, c, d: best - c.s }); }); });
  pairs.sort((a, b) => b.c.s - a.c.s || a.d - b.d || a.k - b.k);
  pairs.forEach(p => { if (pick[p.k] == null) take(p.k, p.c.i); });
  // a weaker match of the point's own words, the topic's icons, then a neutral icon - never the empty marker
  const T = topic ? iconCandidates(topic, '') : [];
  const neutral = ICON_NEUTRAL.map(x => ICONLIB.byName.get(x)).filter(i => i != null);
  pick.forEach((p, k) => {
    if (p != null) return;
    if (lists[k].some(c => c.s >= 2.5 && take(k, c.i))) return;
    const own = lists[k].find(c => c.s >= 2.5 && !used.has(c.i));      // accurate, though it has no colour version
    if (own) { pick[k] = own.i; used.add(own.i); return; }
    if (T.some(c => take(k, c.i))) return;
    neutral.some(i => take(k, i)) || (() => { const n = neutral.find(i => !used.has(i)); if (n != null) { pick[k] = n; used.add(n); } })();
  });
  return pick.map(i => (i != null ? iconKeyOf(i) : null));
}
/* the picture for an icon chosen by name (Claude's choice, a learned one): its colour version not yet used, else itself */
function iconPictureKey(name, used) {
  const i = ICONLIB.byName.get(name);
  if (i == null) return null;
  const v = iconViews(i).find(j => !used.has(j));
  const n = v != null ? v : i;
  used.add(n);
  return iconKeyOf(n);
}
const iconKeyOf = i => { const k = 'L:' + ICONLIB.icons[i].name; iconRegister(k); return k; };
/* the best single icon for a phrase (a topic, a hub), or null */
function iconLibBest(text, neutral) {
  if (!ICONLIB.ready) return null;
  const c = String(text || '').trim() ? iconCandidates(text, '')[0] : null;
  const pic = i => iconKeyOf(iconViews(i)[0] != null ? iconViews(i)[0] : i);
  if (c && c.s >= 2.5) return pic(c.i);
  const n = neutral && ICONLIB.byName.get(neutral);
  return n != null ? pic(n) : null;
}

/* ---------- drawing ---------- */
const ICON_SVG_CACHE = new Map();
function iconSvg(key, color) {
  const ic = ICONLIB.icons[ICONLIB.byName.get(String(key).slice(2))];
  if (!ic) return null;
  const ck = key + '|' + color;
  if (ICON_SVG_CACHE.has(ck)) return ICON_SVG_CACHE.get(ck);
  const svg = ic.mode === 's'
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ic.vb}" width="96" height="96" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ic.body.replace(/currentColor/g, color)}</svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ic.vb}" width="96" height="96">${ic.body}</svg>`;
  ICON_SVG_CACHE.set(ck, svg);
  return svg;
}
const iconIsLogo = key => { const ic = ICONLIB.icons[ICONLIB.byName.get(String(key).slice(2))]; return !!ic && ic.mode === 'c'; };
/* 10.28: a brand logo (keeps its white plate on a coloured shape); colour icons are not brands */
const iconIsBrand = key => { const ic = ICONLIB.icons[ICONLIB.byName.get(String(key).slice(2))]; return !!ic && (ic.set === 'logos' || ic.set === 'simple'); };
/* CMP entry for a library icon: (x, y, s, c) -> one picture prim in colour c */
function iconFn(key) {
  if (!/^L:/.test(String(key)) || !ICONLIB.ready || !ICONLIB.byName.has(String(key).slice(2))) return null;
  return (x, y, s, c) => {
    // 10.28: a colour icon asked for in white (it sits on a coloured badge) goes on a white disc, so it always reads
    if (iconIsLogo(key) && /^#?f{3}(f{3})?$/i.test(String(c || ''))) {
      const ic = ICONLIB.icons[ICONLIB.byName.get(String(key).slice(2))], [vx, vy, vw, vh] = String(ic.vb).split(/[\s,]+/).map(Number), m = Math.max(vw, vh);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="96" height="96"><circle cx="50" cy="50" r="50" fill="#FFFFFF"/>` +
        `<svg x="13" y="13" width="74" height="74" viewBox="${vx} ${vy} ${m} ${m}">${ic.body}</svg></svg>`;
      // the disc fills most of the badge around the icon's place; the icon itself keeps the size asked for
      const S = s * 1.36, o = (S - s) / 2;
      return [{ t: 'image', svg, href: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), x: x - o, y: y - o, w: S, h: S, icon: true, libIcon: key }];
    }
    const svg = iconSvg(key, c || '#404040');
    return svg ? [{ t: 'image', svg, href: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), x, y, w: s, h: s, icon: true, libIcon: key }] : [];
  };
}
function iconRegister(key) {
  if (typeof CMP !== 'object' || CMP[key]) return;
  const f = iconFn(key);
  if (!f) return;
  CMP[key] = f;
  if (typeof CMP_NAMES === 'object') CMP_NAMES[key] = String(key).slice(2).replace(/^(logos|simple)-/, '').replace(/-/g, ' ') + ' icon';
}
/* Every plan's items (planIcons): the library's icons replace the catalogue's drawings and the empty marker */
function iconLibAssign(items, topic) {
  if (!ICONLIB.ready || !Array.isArray(items) || !items.length) return;
  iconLibPick(items, topic).forEach((k, i) => { if (k) items[i].icon = k; });
}

/* ---------- learning: what this PC chose before (learn.py, /api/learn) ---------- */
const iconLearnKey = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
async function learnLoad() {
  try {
    const r = await fetch('/api/learn', { headers: { 'X-AIVB-Client': '1' } });
    if (!r.ok) return;
    const d = await r.json();
    ICONLIB.learned = new Map(Object.entries(d.icons || {}));
    LEARN.layouts = d.layouts || {};
    LEARN.recent = d.recent || [];
  } catch (e) { /* the service may be older */ }
}
const LEARN = { layouts: {}, recent: [] };
/* Tell the service what was used: an inserted design (its layout and the icons of its points) or a replaced icon. */
function learnSend(ev) {
  try {
    fetch('/api/learn', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-AIVB-Client': '1' }, body: JSON.stringify(ev) }).catch(() => {});
    if (ev.icons) ev.icons.forEach(([label, key]) => { const k = iconLearnKey(label), n = String(key || '').replace(/^L:/, ''); if (!k || !n) return; const m = ICONLIB.learned.get(k) || {}; m[n] = (m[n] || 0) + 1; ICONLIB.learned.set(k, m); });
    if (ev.layout) { const L = LEARN.layouts[ev.layout] || { used: 0 }; L.used++; LEARN.layouts[ev.layout] = L; LEARN.recent = [ev.layout].concat(LEARN.recent.filter(x => x !== ev.layout)).slice(0, 12); }
  } catch (e) { /* never in the way */ }
}
/* +points for a layout this user inserts often (at most +12), -points for one inserted in the last few visuals (variety) */
function learnBoost(layout) {
  const L = LEARN.layouts[layout], used = L ? L.used : 0, shown = L ? (L.shown || 0) : 0, recent = LEARN.recent.indexOf(layout);
  return Math.min(12, used * 3) - (shown >= 8 && !used ? 4 : 0) - (recent >= 0 && recent < 3 ? 8 - recent * 2 : 0);
}
iconLibLoad();
