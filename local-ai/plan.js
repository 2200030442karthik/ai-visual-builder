/* AI Visual Builder 10.12 - one content plan, several professional layouts, all drawn here.

   A plan is the content's structure, independent of any drawing:
     { title, relation, items: [{ id, label, detail, icon, group }], groups: [{ id, name, role }], flow: [item ids], layouts }
   - Claude's "content plan" (one request, claude_visual.py) gives it directly: which items form the main flow, which
     capabilities span it, which belong together, and the layouts it recommends.
   - A provider's drawing (Napkin or Claude SVG, read by rebuild.js napkinStructure) gives items and their order, so the
     same paid result can be shown in other layouts at no extra cost.
   Every layout below measures the text at the guideline sizes (labels 24 or 22 pt, descriptions 22 pt, Open Sans)
   before placing anything; each tries a few sizes and is then checked like every other result (svg2ppt.js
   visualQuality: overlaps, clipping, text on icons or connectors, outside the area) and for content (every label and
   every description on the slide). A layout that cannot pass is not offered, with the reason; nothing is shrunk below
   22 pt and no description is dropped to make it fit. Everything is native, editable PowerPoint shapes and text
   (icons from the catalogue in gallery.js). Loaded after rebuild.js, before napkin.js. */

const PLAN_DS = 22;
const planTH = (t, w, s) => linesAt(t, w, s) * s * 1.2 + 8;
// bold labels run wider than the 0.55 em per character estimate: measured as if their box were 5 % narrower (Open Sans Bold measures up to 0.58 em)
const planLH = (t, w, s) => planTH(t, w * 0.95, s);
const planWords = (t, w, s) => !String(t || '').split(/\s+/).some(x => x.length * s * 0.55 > w - 14.4);
const planFits = (it, w, s, maxLines) => w > 60 && planWords(it.label, w * 0.95, s) && linesAt(it.label, w * 0.95, s) <= (maxLines || 3) && (!it.detail || planWords(it.detail, w, PLAN_DS));
const planTextH = (it, w, s) => planLH(it.label, w, s) + (it.detail ? planTH(it.detail, w, PLAN_DS) - 6 : 0);
/* An item's label (bold) and its description under it. */
function planText(it, x, y, w, s, o) {
  o = o || {};
  const al = o.align || 'left', col = o.color || INK, h1 = planLH(it.label, w, s);
  const out = [label(x, y, w, h1, it.label, { size: s, bold: true, color: col, align: al, valign: 'top', grp: o.grp })];
  if (it.detail) out.push(label(x, y + h1 - 6, w, planTH(it.detail, w, PLAN_DS), it.detail, { size: PLAN_DS, color: col, align: al, valign: 'top', grp: o.grp }));
  return out;
}
/* The item's object on a disc (white on pale cards, pale on white).
   10.21.1: P.style.icons 'iso' - 2.5D: the object on the front face of a tile (a native cube: PowerPoint shades its top
   and side faces from the fill), a soft shadow under it. Every part stays an editable shape of the icon's group. */
let PLAN_ICONSTYLE = '';
function planIcon(key, x, y, D, col, bg, grp) {
  if (!D) return [];
  if (PLAN_ICONSTYLE === 'iso') {
    const d = D * 0.25, f = !bg || /^#?F{6}$/i.test(bg) ? '#EEF1F6' : bg, s = (D - d) * 0.72;
    return [box('ellipse', x - D * 0.02, y + D * 0.86, D * 1.04, D * 0.18, { fill: '#E2E5EC', grp, decor: true }),
      box('cube', x, y, D, D, { fill: f, line: col, lineW: 0.75, grp })]
      .concat(comp(key || 'none', x + (D - d - s) / 2, y + d + (D - d - s) / 2, s, col).map(q => Object.assign(q, { grp })));
  }
  return [box('ellipse', x, y, D, D, { fill: bg, grp })].concat(comp(key || 'none', x + D * 0.19, y + D * 0.19, D * 0.62, col).map(q => Object.assign(q, { grp })));
}
/* A step number on a rounded square (22 pt needs at least 40 pt of width). */
// a step's number: P.start continues the numbering of a sequence split across slides (V10.12)
let PLAN_NUM0 = 0, PLAN_OPT_ONLY = -1, PLAN_WHY_LAST = '';
const PLAN_SIZE_HINT = new Map();     // 10.26: library families - the size that fitted, per layout, holder, mark and content
const planN = i => String(i + 1 + PLAN_NUM0);
const planNum = (i, x, y, D, col, grp) => box('roundRect', x, y, D, D, { fill: col, text: planN(i), size: PLAN_DS, bold: true, color: textOn(col), align: 'center', valign: 'middle', grp });
const planGrp = (out, g, name) => { out.forEach(p => { if (!p.grp) p.grp = g; }); if (out[0]) out[0].grpName = name; return out; };

/* ---------- reading the plan ---------- */
const planItem = (P, id) => P.items.find(i => i.id === id);
const planFlow = P => (P.flow || []).map(id => planItem(P, id)).filter(Boolean);
const planSupport = it => /^support/.test(it.role || '');
// a sequence only when nothing in it applies across the others: cross-cutting functions never go on a timeline
const planSeq = P => !P.items.some(planSupport) && (P.relation === 'sequence' || (planFlow(P).length === P.items.length && P.items.length >= 3 && !/independent|categories|hub|comparison/.test(P.relation)));
const planOrder = P => { const f = planFlow(P); return f.length === P.items.length ? f : P.items; };
const planGroups = P => (P.groups || []).map(g => ({ g, items: P.items.filter(i => i.group === g.id) })).filter(x => x.items.length);
const planAllGrouped = P => P.items.every(i => i.group && (P.groups || []).some(g => g.id === i.group));

/* ---------- semantics: what each item is (V10.11) ----------
   stage (the main flow), output (what the flow serves: analytics, reports), support_control (coordinates the flow:
   orchestration, scheduling), support_quality (watches it: monitoring, quality), support_foundation (applies to all of
   it: security, governance, compliance). Read from the label (the item's name), the description only to confirm.
   Claude's plan may give the roles itself; its groups (flow / support / output) are used when it does not. */
const PLAN_ROLE_RULES = [
  ['support_foundation', /\b(?:secur\w*|governan\w*|complian\w*|privacy|access control\w*|audit\w*|encrypt\w*|regulat\w*)\b/i],
  ['support_quality', /\b(?:monitor\w*|observab\w*|alert\w*|anomal\w*)\b/i],
  ['support_control', /\b(?:orchestrat\w*|schedul\w*|coordinat\w*)\b/i],
  ['output', /\b(?:analytic\w*|report\w*|dashboard\w*|visuali[sz]\w*|insight\w*|business intelligence)\b/i],
];
const planRoleOf = it => (PLAN_ROLE_RULES.find(([, re]) => re.test(it.label)) || ['stage'])[0];
const PLAN_ROLES = ['source', 'stage', 'output', 'support_control', 'support_quality', 'support_foundation', 'component', 'concept'];
function planSemantics(P) {
  const gRole = id => ((P.groups || []).find(g => g.id === id) || {}).role;
  P.items.forEach(it => {
    if (PLAN_ROLES.includes(it.role)) return;
    const r = planRoleOf(it), g = gRole(it.group);
    it.role = g === 'support' ? (/^support/.test(r) ? r : 'support_control') : g === 'output' ? 'output' : g === 'flow' ? (r === 'output' ? 'output' : 'stage') : r;
  });
  const sup = P.items.filter(planSupport), stages = P.items.filter(i => i.role === 'stage'), outs = P.items.filter(i => i.role === 'output');
  // a flow with functions across it: the stages in their order, then what they serve; otherwise the roles are dropped
  // (a list of independent ideas has no stages)
  // 10.21.1: only a flow the content gives (a sequence, or a plan that says so) - an unordered list of principles that
  // happens to include "Monitoring" or "Encryption" stays a list of equals
  if (sup.length && stages.length >= 2 && (P.relation === 'sequence' || !P.relation || P.relation === 'pipeline_with_support')) {
    if (P.relation === 'sequence' || !P.relation) P.relation = 'pipeline_with_support';
    const f = planFlow(P).filter(i => i.role === 'stage' || i.role === 'output');
    P.flow = (f.length >= 2 ? f : stages.concat(outs)).map(i => i.id);
  } else if (!(P.relation === 'pipeline_with_support' && stages.length >= 2)) P.items.forEach(i => { if (i.role !== 'component' && i.role !== 'source') i.role = sup.length ? i.role : 'concept'; });
  // the data sources the text names for the first stage ("collects data from databases, APIs, logs and external files")
  const first = planFlow(P)[0];
  P.sources = [];
  if (first && /ingest|collect|acqui|captur/i.test(first.label)) {
    const m = /\bfrom\s+([^.;]+)/i.exec(first.detail || '') || (/,/.test(first.detail || '') ? [0, first.detail] : null);
    if (m) P.sources = m[1].split(/\s*,\s*(?:and\s+)?|\s+and\s+/).map(t => t.trim()).filter(t => t && t.split(/\s+/).length <= 3).slice(0, 5);
    if (P.sources.length < 2) P.sources = [];
  }
  return P;
}
/* The items by role (after planSemantics). */
const planRoles = P => ({ stages: planFlow(P).filter(i => i.role === 'stage'), outputs: P.items.filter(i => i.role === 'output'),
  control: P.items.filter(i => i.role === 'support_control'), quality: P.items.filter(i => i.role === 'support_quality'), foundation: P.items.filter(i => i.role === 'support_foundation'),
  supports: P.items.filter(planSupport) });
/* Domains for grouped layouts: the plan's own groups, else the roles (main flow, functions across it, output). */
function planDomains(P) {
  const G = planGroups(P);
  if (G.length >= 2 && planAllGrouped(P)) return G.map(x => ({ name: x.g.name, role: x.g.role, items: x.items }));
  const r = planRoles(P);
  if (!r.supports.length || r.stages.length < 2) return [];
  return [{ name: 'Main flow', role: 'flow', items: r.stages }, { name: 'Supporting functions', role: 'support', items: r.supports }].concat(r.outputs.length ? [{ name: 'Output', role: 'output', items: r.outputs }] : []);
}

/* ---------- layout families, in versioned design packs ----------
   Every family: key, name, kind (architecture | layered | pictorial | grouped | sequence | list: the four variations
   come from different kinds first, so they differ in composition), pack (id@version), needs(P) -> '' or the reason it
   does not suit the content, opts (sizes tried in order), build(P, R, opt) -> prims or null. A pack may also add
   families as data (zone grids, planZoneFamily) - see packs/README.txt. */
const PLAN_LAYOUTS = {}, PLAN_PACKS = {};
// a build that does not fit says why (planNo('...') returns null); planRender reports it
let PLAN_WHY = '';
const planNo = why => { PLAN_WHY = why; return null; };
let planPackId = 'core@10.10';
const regPlan = (key, o) => { PLAN_LAYOUTS[key] = Object.assign({ key, kind: 'list', pack: planPackId }, o); (PLAN_PACKS[planPackId] = PLAN_PACKS[planPackId] || []).push(key); };
function registerPack(id, version, fn) { const prev = planPackId; planPackId = id + '@' + version; try { fn(); } finally { planPackId = prev; } }

/* Widths for items side by side: each at least as wide as its longest word needs (bold label with `lab` beside it,
   description), the rest shared as evenly as possible. Null when they cannot fit. */
function planWidths(items, total, gap, s, lab) {
  // a description is drawn with the tile's padding on both sides (16 covers every family's padding)
  // the same measure as the fit checks: a bold label word in 95 % of its box, a description word inside the padding
  const need = items.map(it => Math.max(Math.max(...it.label.split(/\s+/).map(x => (x.length * s * 0.55 + 14.4) / 0.95)) + (lab || 0), ...(it.detail || '').split(/\s+/).map(x => x.length * PLAN_DS * 0.55 + 14.4 + 16)) + 4);
  let avail = total - gap * (items.length - 1);
  if (need.reduce((a, b) => a + b, 0) > avail) return null;
  const w = new Array(items.length).fill(0), fixed = new Set();
  for (let k = 0; k < items.length; k++) {
    const free = items.map((_, i) => i).filter(i => !fixed.has(i)), eq = (avail - [...fixed].reduce((a, i) => a + w[i], 0)) / free.length;
    const big = free.filter(i => need[i] > eq);
    if (!big.length) { free.forEach(i => { w[i] = eq; }); break; }
    big.forEach(i => { w[i] = need[i]; fixed.add(i); });
  }
  return w;
}
/* A tile: the object and the label on one line (side) or the object above a centred label (top); the description
   under them. planTileH: the height it needs; planTileFits: every word fits. */
const planTileLW = (w, o) => o.top ? w - 2 * o.pad : w - 2 * o.pad - (o.D ? o.D + 8 : 0);
const planTileFits = (it, w, o) => planWords(it.label, planTileLW(w, o) * 0.95, o.s) && linesAt(it.label, planTileLW(w, o) * 0.95, o.s) <= 3 && (!it.detail || planWords(it.detail, w - 2 * o.pad, PLAN_DS));
const planTileH = (it, w, o) => { const lw = planTileLW(w, o), lh = planLH(it.label, lw, o.s), dh = it.detail ? planTH(it.detail, w - 2 * o.pad, PLAN_DS) - 4 : 0;
  return o.top ? o.pad + (o.D ? o.D + 6 : 0) + lh + dh + o.pad : o.pad + Math.max(o.D, lh) + dh + o.pad; };
function planTile(it, x, y, w, h, o) {
  const g = o.grp, col = o.col, out = [], pad = o.pad, lw = planTileLW(w, o), lh = planLH(it.label, lw, o.s), need = planTileH(it, w, o), y0 = y + Math.max(0, (h - need) / 2);
  if (o.bg) out.push(box('roundRect', x, y, w, h, { fill: o.bg }));
  if (o.stripe) out.push(rule(x, y, 6, h, col));
  const al = o.top ? 'center' : 'left';
  if (o.top) {
    out.push(...planIcon(it.icon, x + (w - o.D) / 2, y0 + pad, o.D, col, o.iconBg || '#FFFFFF', g));
    out.push(label(x + pad, y0 + pad + (o.D ? o.D + 6 : 0), lw, lh, it.label, { size: o.s, bold: true, color: INK, align: al, valign: 'top' }));
    if (it.detail) out.push(label(x + pad, y0 + pad + (o.D ? o.D + 6 : 0) + lh - 4, w - 2 * pad, planTH(it.detail, w - 2 * pad, PLAN_DS), it.detail, { size: PLAN_DS, color: INK, align: al, valign: 'top' }));
  } else {
    const hh = Math.max(o.D, lh);
    out.push(...planIcon(it.icon, x + pad, y0 + pad + (hh - o.D) / 2, o.D, col, o.iconBg || '#FFFFFF', g));
    out.push(label(x + pad + (o.D ? o.D + 8 : 0), y0 + pad + (hh - lh) / 2, lw, lh, it.label, { size: o.s, bold: true, color: INK, align: al, valign: 'middle' }));
    if (it.detail) out.push(label(x + pad, y0 + pad + hh - 4, w - 2 * pad, planTH(it.detail, w - 2 * pad, PLAN_DS), it.detail, { size: PLAN_DS, color: INK, align: al, valign: 'top' }));
  }
  return planGrp(out, g, it.label);
}
// Approved colours only (brand.js maps anything else): accent blocks carry the colour, the light panel grey is the body,
// icons sit in their accent colour on a white disc. Text #404040 throughout (readable on every accent).
const PANEL = '#F2F2F2';
// extra height for a layout that is shorter than the area: part of the slack, at most `cap` (the rest stays as margin)
const planSlack = (need, R, cap) => Math.max(0, Math.min(cap, (R.h - need) * 0.7));

/* Architecture: the main flow as connected stages, the capabilities that apply to all of it as lanes spanning the flow. */
regPlan('architecture', { name: 'Architecture (flow with cross-cutting layers)', family: 'architecture',
  needs: P => { const f = planFlow(P), rest = P.items.filter(i => !(P.flow || []).includes(i.id));
    return f.length < 2 || f.length > 6 ? 'needs a main flow of 2 to 6 stages' : !rest.length ? 'needs capabilities that span the flow' : rest.length > 4 ? 'more than 4 cross-cutting capabilities'
      : rest.some(i => i.added) ? 'a point added to the plan has no place in its structure' : ''; },
  opts: [{ s: 24, D: 44, pad: 10 }, { s: 22, D: 40, pad: 8 }, { s: 22, D: 32, pad: 6 }],
  build: (P, R, o) => {
    const f = planFlow(P), rest = P.items.filter(i => !(P.flow || []).includes(i.id)), n = f.length, gap = 24, pad = o.pad;
    // each stage as wide as its longest word needs (bold, with the text box's insets), the rest of the width shared evenly
    const word = it => Math.max(...it.label.split(/\s+/).map(x => x.length * o.s * 0.58), ...(it.detail || '').split(/\s+/).map(x => x.length * PLAN_DS * 0.55)) + 14.4 + 2 * pad + 2;
    const need0 = f.map(word), spare = R.w - gap * (n - 1) - need0.reduce((a, b) => a + b, 0);
    if (spare < 0) return null;
    const cws = need0.map(w => w + spare / n), xs = cws.map((_, i) => R.x + cws.slice(0, i).reduce((a, b) => a + b, 0) + i * gap), tws = cws.map(w => w - 2 * pad);
    if (!f.every((it, i) => linesAt(it.label, tws[i] * 0.95, o.s) <= 3)) return null;
    const lab = Math.max(...f.map((it, i) => planLH(it.label, tws[i], o.s))), det = Math.max(0, ...f.map((it, i) => it.detail ? planTH(it.detail, tws[i], PLAN_DS) : 0));
    const hh = pad + o.D + 4 + lab + 2;
    // a lane's label on one line when it fits in a third of the width, its description beside it
    const D2 = Math.min(o.D, 34), bw = D2 + 20, lw = Math.max(170, Math.min(R.w * 0.36, Math.max(...rest.map(it => it.label.length * o.s * 0.6 + 18)))), dw = R.w - bw - 10 - lw - 8;
    if (!rest.every(it => planWords(it.label, lw * 0.95, o.s) && linesAt(it.label, lw * 0.95, o.s) <= 2 && (!it.detail || planWords(it.detail, dw, PLAN_DS)))) return null;
    const lh0 = rest.map(it => Math.max(D2 + 10, Math.max(planLH(it.label, lw, o.s), it.detail ? planTH(it.detail, dw, PLAN_DS) : 0) + 4)), lg = 8;
    let sh = hh + (det ? det + pad : pad);
    const need = sh + 20 + lh0.reduce((a, b) => a + b, 0) + lg * (rest.length - 1);
    if (need > R.h) return null;
    const extra = planSlack(need, R, 70), lh = lh0.map(h => h + extra * 0.3 / rest.length);
    sh += extra * 0.7;
    const total = sh + 20 + lh.reduce((a, b) => a + b, 0) + lg * (rest.length - 1), y0 = R.y + (R.h - total) / 2, out = [];
    f.forEach((it, i) => {
      const x = xs[i], cw = cws[i], tw = tws[i], col = accent(i), g = 'stage' + i;
      out.push(...planGrp([box('roundRect', x, y0, cw, sh, { fill: PANEL }), box('roundRect', x, y0, cw, hh, { fill: col }),
        ...planIcon(it.icon, x + (cw - o.D) / 2, y0 + pad, o.D, col, '#FFFFFF', g),
        label(x + pad, y0 + pad + o.D + 4, tw, lab, it.label, { size: o.s, bold: true, color: INK, align: 'center', valign: 'middle' })]
        .concat(it.detail ? [label(x + pad, y0 + hh + 4, tw, sh - hh - 8, it.detail, { size: PLAN_DS, color: INK, align: 'center', valign: 'middle' })] : []), g, it.label));
      if (i < n - 1) out.push(...arrowSeg(x + cw + 3, y0 + hh / 2, x + cw + gap - 3, y0 + hh / 2, CONNECTOR, 2.5, 14));
    });
    let y = y0 + sh + 20;
    rest.forEach((it, j) => {
      const col = accent(n + j), g = 'lane' + j, h = lh[j];
      out.push(...planGrp([box('roundRect', R.x, y, R.w, h, { fill: PANEL }), box('roundRect', R.x, y, bw, h, { fill: col }),
        ...planIcon(it.icon, R.x + 10, y + (h - D2) / 2, D2, col, '#FFFFFF', g),
        label(R.x + bw + 10, y, lw, h, it.label, { size: o.s, bold: true, color: INK, align: 'left', valign: 'middle' })]
        .concat(it.detail ? [label(R.x + bw + 10 + lw, y, dw, h, it.detail, { size: PLAN_DS, color: INK, align: 'left', valign: 'middle' })] : []), g, it.label));
      y += h + lg;
    });
    return out;
  } });

/* Layers: each group a horizontal band (its name on the left), its items side by side in it. */
regPlan('layers', { name: 'Layered system', family: 'layers',
  needs: P => { const G = planGroups(P); return G.length < 2 || G.length > 5 ? 'needs 2 to 5 groups' : !planAllGrouped(P) ? 'every item needs a group' : G.some(x => x.items.length > 5) ? 'a group has more than 5 items' : ''; },
  opts: [{ s: 24, D: 40 }, { s: 22, D: 36 }, { s: 22, D: 0 }],
  build: (P, R, o) => {
    const G = planGroups(P), gap = 8, lg = 10, pad = 8;
    const w0 = Math.max(150, Math.min(230, Math.max(...G.map(x => Math.max(...x.g.name.split(/\s+/).map(w => w.length)) * o.s * 0.6 + 36))));
    const bands = G.map(x => { const k = x.items.length, tw = (R.w - w0 - 8 - 6 - gap * (k - 1)) / k, txw = tw - 2 * pad - (o.D ? o.D + 8 : 0);
      if (!x.items.every(it => planFits(it, txw, o.s)) || !planWords(x.g.name, (w0 - 16) * 0.95, o.s)) return null;
      return { x, k, tw, txw, h: Math.max(o.D + 2 * pad, ...x.items.map(it => planTextH(it, txw, o.s) + 2 * pad), planLH(x.g.name, w0 - 16, o.s) + 12) + 12 }; });
    if (bands.some(b => !b)) return null;
    const need = bands.reduce((a, b) => a + b.h, 0) + lg * (bands.length - 1);
    if (need > R.h) return null;
    const extra = planSlack(need, R, 24 * bands.length);
    bands.forEach(b => { b.h += extra / bands.length; });
    let y = R.y + (R.h - need - extra) / 2;
    const out = [];
    bands.forEach((b, gi) => {
      const col = accent(gi), g = 'layer' + gi;
      out.push(...planGrp([box('roundRect', R.x, y, R.w, b.h, { fill: PANEL }), box('roundRect', R.x, y, w0, b.h, { fill: col, text: b.x.g.name, size: o.s, bold: true, color: INK, align: 'center', valign: 'middle' })], g, b.x.g.name));
      b.x.items.forEach((it, j) => {
        const x = R.x + w0 + 8 + j * (b.tw + gap), gg = g + '-' + j, th = b.h - 12;
        out.push(...planGrp([box('roundRect', x, y + 6, b.tw, th, { fill: '#FFFFFF' }), ...planIcon(it.icon, x + pad, y + 6 + (th - o.D) / 2, o.D, col, PANEL, gg),
          ...planText(it, x + pad + (o.D ? o.D + 8 : 0), y + 6 + (th - planTextH(it, b.txw, o.s)) / 2, b.txw, o.s, { grp: gg })], gg, it.label));
      });
      y += b.h + lg;
    });
    return out;
  } });

/* Capability map: one column per group, its name as the header, its items as tiles under it. */
regPlan('capability', { name: 'Capability map', family: 'capability',
  needs: P => { const G = planGroups(P); return G.length < 2 || G.length > 4 ? 'needs 2 to 4 groups' : !planAllGrouped(P) ? 'every item needs a group' : G.some(x => x.items.length > 4) ? 'a group has more than 4 items' : ''; },
  opts: [{ s: 24, D: 40 }, { s: 22, D: 36 }, { s: 22, D: 0 }],
  build: (P, R, o) => {
    const G = planGroups(P), k = G.length, gap = 16, cw = (R.w - gap * (k - 1)) / k, ip = 8, tg = 8, pad = 8, txw = cw - 2 * ip - 2 * pad - (o.D ? o.D + 8 : 0);
    if (!G.every(x => planWords(x.g.name, (cw - 20) * 0.95, o.s) && x.items.every(it => planFits(it, txw, o.s)))) return null;
    const hh = Math.max(48, ...G.map(x => planLH(x.g.name, cw - 20, o.s) + 8));
    const tileH = it => Math.max(o.D, planTextH(it, txw, o.s)) + 2 * pad;
    const colH = G.map(x => hh + ip + x.items.reduce((a, it) => a + tileH(it), 0) + tg * (x.items.length - 1) + ip), need = Math.max(...colH);
    if (need > R.h) return null;
    const H = need + planSlack(need, R, 60), y0 = R.y + (R.h - H) / 2, out = [];
    G.forEach((x, gi) => {
      const cx0 = R.x + gi * (cw + gap), col = accent(gi), g = 'cap' + gi, more = (H - colH[gi]) / x.items.length;
      out.push(...planGrp([box('roundRect', cx0, y0, cw, H, { fill: PANEL }), box('roundRect', cx0, y0, cw, hh, { fill: col, text: x.g.name, size: o.s, bold: true, color: INK, align: 'center', valign: 'middle' })], g, x.g.name));
      let y = y0 + hh + ip;
      x.items.forEach((it, j) => {
        const h = tileH(it) + Math.min(more, 40), gg = g + '-' + j;
        out.push(...planGrp([box('roundRect', cx0 + ip, y, cw - 2 * ip, h, { fill: '#FFFFFF' }), ...planIcon(it.icon, cx0 + ip + pad, y + (h - o.D) / 2, o.D, col, PANEL, gg),
          ...planText(it, cx0 + ip + pad + (o.D ? o.D + 8 : 0), y + (h - planTextH(it, txw, o.s)) / 2, txw, o.s, { grp: gg })], gg, it.label));
        y += h + tg;
      });
    });
    return out;
  } });

/* Hierarchy: the topic on top, its groups under it, each group's items listed under the group, all connected. */
regPlan('tree', { name: 'Hierarchy', family: 'tree',
  needs: P => { const G = planGroups(P); return !P.title ? 'needs a topic' : G.length < 2 || G.length > 4 ? 'needs 2 to 4 groups' : !planAllGrouped(P) ? 'every item needs a group' : G.some(x => x.items.length > 4) ? 'a group has more than 4 items' : ''; },
  opts: [{ s: 24 }, { s: 22 }],
  build: (P, R, o) => {
    const G = planGroups(P), k = G.length, gap = 18, cw = (R.w - gap * (k - 1)) / k, rh = 50, gh = Math.max(46, ...G.map(x => planLH(x.g.name, cw - 16, o.s) + 6)), ind = 26, txw = cw - ind - 16;
    const rw = Math.min(R.w * 0.6, P.title.length * 26 * 0.58 + 50);
    if (!planWords(P.title, rw, 26) || linesAt(P.title, rw, 26) > 1 || !G.every(x => planWords(x.g.name, (cw - 16) * 0.95, o.s) && x.items.every(it => planFits(it, txw, o.s)))) return null;
    const ih0 = it => planTextH(it, txw, o.s) + 8, colH = G.map(x => x.items.reduce((a, it) => a + ih0(it), 0) + 8 * (x.items.length - 1));
    const need = rh + 34 + gh + 14 + Math.max(...colH);
    if (need > R.h) return null;
    const extra = planSlack(need, R, 50), y0 = R.y + (R.h - need - extra) / 2, out = [], lines = [], gy = y0 + rh + 34 + extra * 0.4, mid = y0 + rh + (34 + extra * 0.4) / 2;
    const xs = G.map((_, gi) => R.x + gi * (cw + gap) + cw / 2);
    lines.push(seg(R.x + R.w / 2, y0 + rh, R.x + R.w / 2, mid, CONNECTOR, 2), seg(xs[0], mid, xs[k - 1], mid, CONNECTOR, 2), ...xs.map(x => seg(x, mid, x, gy, CONNECTOR, 2)));
    out.push(Object.assign(box('roundRect', R.x + (R.w - rw) / 2, y0, rw, rh, { fill: TEMPLATE.soft, text: P.title, size: 26, bold: true, color: INK, align: 'center', valign: 'middle' }), { grp: 'root', grpName: P.title }));
    G.forEach((x, gi) => {
      const x0 = R.x + gi * (cw + gap), col = accent(gi), g = 'branch' + gi, more = Math.min(16, extra * 0.6 / Math.max(...G.map(z => z.items.length)));
      out.push(Object.assign(box('roundRect', x0, gy, cw, gh, { fill: col, text: x.g.name, size: o.s, bold: true, color: INK, align: 'center', valign: 'middle' }), { grp: g, grpName: x.g.name }));
      let y = gy + gh + 14;
      const spine = x0 + 12, ys = [];
      x.items.forEach((it, j) => {
        const h = ih0(it) + more, gg = g + '-' + j;
        ys.push(y + h / 2);
        lines.push(seg(spine, y + h / 2, x0 + ind, y + h / 2, col, 2.5));
        out.push(...planGrp([box('roundRect', x0 + ind, y, cw - ind, h, { fill: PANEL }), rule(x0 + ind, y, 6, h, col), ...planText(it, x0 + ind + 10, y + (h - planTextH(it, txw, o.s)) / 2, txw - 2, o.s, { grp: gg })], gg, it.label));
        y += h + 8;
      });
      lines.push(seg(spine, gy + gh, spine, ys[ys.length - 1], col, 2.5));
    });
    return lines.concat(out);
  } });

/* Pipeline: numbered stage nodes on one connected path; 6 or more snake over two rows (the second runs back). */
regPlan('pipeline', { name: 'Pipeline', family: 'pipeline',
  needs: P => !planSeq(P) ? 'needs an order (a sequence in the content)' : P.items.length < 3 || P.items.length > 10 ? 'works for 3 to 10 stages' : '',
  opts: [{ s: 24, D: 64 }, { s: 22, D: 56 }, { s: 22, D: 48 }],
  build: (P, R, o) => {
    const L = planOrder(P), n = L.length, rows = n <= 5 ? 1 : 2, per = Math.ceil(n / rows), sw = R.w / per, tw = sw - 12, D = o.D;
    if (!L.every(it => planFits(it, tw, o.s))) return null;
    const th = r => Math.max(...L.slice(r * per, (r + 1) * per).map(it => planTextH(it, tw, o.s)));
    const need = rows === 1 ? D + 12 + th(0) : th(0) + 10 + D + 40 + D + 10 + th(1);
    if (need > R.h) return null;
    const mg = rows === 1 ? 0 : planSlack(need, R, 40), total = need + mg, y0 = R.y + (R.h - total) / 2, out = [], lines = [], pos = [];
    L.forEach((it, i) => {
      const r = Math.floor(i / per), j = i % per, x = r === 0 ? R.x + j * sw + sw / 2 : R.x + R.w - (j * sw + sw / 2);
      const ny = rows === 1 ? y0 : r === 0 ? y0 + th(0) + 10 : y0 + th(0) + 10 + D + 40 + mg;
      pos.push({ x, y: ny + D / 2, r });
      const col = accent(i), g = 'stage' + i, ty = rows === 1 || r === 1 ? ny + D + 12 : ny - 10 - planTextH(it, tw, o.s), di = D * 0.76;
      out.push(...planGrp([box('ellipse', x - D / 2, ny, D, D, { fill: col }), ...planIcon(it.icon, x - di / 2, ny + (D - di) / 2, di, col, '#FFFFFF', g),
        planNum(i, x - D / 2 - 24, ny - 14, 40, TEMPLATE.line, g), ...planText(it, x - tw / 2, ty, tw, o.s, { align: 'center', grp: g })], g, it.label));
    });
    pos.forEach((p, i) => { if (i === pos.length - 1) return; const q = pos[i + 1];
      if (p.r === q.r) { const d = q.x > p.x ? 1 : -1; lines.push(...arrowSeg(p.x + d * (D / 2 + 6), p.y, q.x - d * (D / 2 + 6), q.y, CONNECTOR, 2.5, 14)); }
      else lines.push(...arrowSeg(p.x, p.y + D / 2 + 4, q.x, q.y - D / 2 - 16, CONNECTOR, 2.5, 14)); });
    return lines.concat(out);
  } });

/* Timeline: numbered markers on one line, the steps alternating above and below it. */
regPlan('timeline', { name: 'Timeline', family: 'timeline',
  needs: P => !planSeq(P) ? 'needs an order (a sequence in the content)' : P.items.length < 3 || P.items.length > 8 ? 'works for 3 to 8 steps' : '',
  opts: [{ s: 24 }, { s: 22 }],
  build: (P, R, o) => {
    const L = planOrder(P), n = L.length, sw = R.w / n, tw = Math.min(n <= 4 ? sw - 16 : 1.6 * sw - 8, 330), D = 48, ay = R.y + R.h / 2;
    if (!L.every(it => planFits(it, tw, o.s, 2))) return null;
    const side = (R.h - D) / 2 - 16;
    if (L.some(it => planTextH(it, tw, o.s) > side)) return null;
    const out = [], lines = [...arrowSeg(R.x, ay, R.x + R.w, ay, CONNECTOR, 3, 18)];
    L.forEach((it, i) => {
      const x = R.x + i * sw + sw / 2, col = accent(i), g = 'step' + i, up = n > 4 ? i % 2 === 0 : true, h = planTextH(it, tw, o.s);
      const tx = Math.max(R.x, Math.min(x - tw / 2, R.x + R.w - tw)), ty = up ? ay - D / 2 - 16 - h : ay + D / 2 + 16;
      lines.push(seg(x, up ? ay - D / 2 : ay + D / 2, x, up ? ay - D / 2 - 12 : ay + D / 2 + 12, col, 2.5));
      out.push(...planGrp([box('ellipse', x - D / 2, ay - D / 2, D, D, { fill: col, text: planN(i), size: PLAN_DS, bold: true, color: INK, align: 'center', valign: 'middle' }),
        ...planText(it, tx, ty, tw, o.s, { align: Math.abs(tx - (x - tw / 2)) < 1 ? 'center' : 'left', grp: g })], g, it.label));
    });
    return lines.concat(out);
  } });

/* Staircase: one step per item rising from bottom-left to top-right, number, label and description on each step. */
regPlan('stair', { name: 'Rising steps', family: 'stair',
  needs: P => !planSeq(P) ? 'needs an order (a sequence in the content)' : P.items.length < 3 || P.items.length > 8 ? 'works for 3 to 8 steps' : '',
  opts: [{ s: 24 }, { s: 22 }],
  build: (P, R, o) => {
    const L = planOrder(P), n = L.length, g = n > 6 ? 6 : 8, bh = Math.min(96, (R.h - g * (n - 1)) / n);
    if (bh < 44) return null;
    const step = Math.min(44, R.w * 0.22 / (n - 1)), bw = R.w - step * (n - 1), sq = Math.min(bh, 56);
    const lw = Math.min(bw * 0.4, Math.max(...L.map(it => it.label.length * o.s * 0.6 + 20))), dw = bw - sq - lw - 12;
    if (!L.every(it => planWords(it.label, lw * 0.95, o.s) && planLH(it.label, lw, o.s) <= bh + 2 && (!it.detail || (planWords(it.detail, dw, PLAN_DS) && planTH(it.detail, dw, PLAN_DS) <= bh + 2)))) return null;
    const y0 = R.y + (R.h - n * bh - g * (n - 1)) / 2, out = [];
    L.forEach((it, i) => {
      const y = y0 + (n - 1 - i) * (bh + g), x = R.x + i * step, col = accent(i), gg = 'step' + i;
      out.push(...planGrp([box('roundRect', x, y, bw, bh, { fill: PANEL }), box('roundRect', x, y, sq, bh, { fill: col, text: planN(i), size: PLAN_DS, bold: true, color: INK, align: 'center', valign: 'middle' }),
        label(x + sq + 8, y, lw, bh, it.label, { size: o.s, bold: true, color: INK, align: 'left', valign: 'middle' })]
        .concat(it.detail ? [label(x + sq + 4 + lw, y, dw, bh, it.detail, { size: PLAN_DS, color: INK, align: 'left', valign: 'middle' })] : []), gg, it.label));
    });
    return out;
  } });

/* Hub: the topic in the centre, the items on both sides, each joined to it (object and label on one line, the
   description under them). */
regPlan('hub', { name: 'Hub and spokes', family: 'hub',
  needs: P => !P.title ? 'needs a topic' : P.items.length < 3 || P.items.length > 8 ? 'works for 3 to 8 items' : '',
  opts: [{ s: 24, D: 40 }, { s: 22, D: 34 }, { s: 22, D: 0 }],
  build: (P, R, o) => {
    const L = P.items, n = L.length, left = L.slice(0, Math.ceil(n / 2)), right = L.slice(Math.ceil(n / 2));
    const HW = Math.min(220, R.w * 0.21), HH = Math.min(170, R.h * 0.44), sp = 36, cw = (R.w - HW - 2 * sp) / 2, pad = 6, lw = cw - 2 * pad - 6 - (o.D ? o.D + 8 : 0), dw = cw - 2 * pad - 6;
    const t = textRect('ellipse', 0, 0, HW, HH);
    if (!fitsAt(P.title, t.w, t.h, 26) && !fitsAt(P.title, t.w, t.h, PLAN_DS)) return null;
    if (!L.every(it => planWords(it.label, lw * 0.95, o.s) && linesAt(it.label, lw * 0.95, o.s) <= 2 && (!it.detail || planWords(it.detail, dw, PLAN_DS)))) return null;
    const head = it => Math.max(o.D, planLH(it.label, lw, o.s)), ch0 = it => pad + head(it) + (it.detail ? planTH(it.detail, dw, PLAN_DS) - 4 : 0) + pad;
    const gap = 8, sideH = (s, m) => s.reduce((a, it) => a + ch0(it) + m, 0) + gap * (s.length - 1);
    const need = Math.max(sideH(left, 0), sideH(right, 0));
    if (need > R.h) return null;
    const more = planSlack(need, R, 18 * left.length) / left.length, hx = R.x + R.w / 2, hy = R.y + R.h / 2, out = [], lines = [];
    [[left, R.x, -1], [right, R.x + R.w - cw, 1]].forEach(([S, x, d], si) => {
      if (!S.length) return;
      let y = hy - sideH(S, more) / 2;
      const spine = d < 0 ? x + cw + sp / 2 : x - sp / 2, ys = [];
      S.forEach((it, j) => {
        const h = ch0(it) + more, i = si ? left.length + j : j, col = accent(i + 1), g = 'item' + i, top = y + more / 2 + pad, hd = head(it);
        ys.push(y + h / 2);
        lines.push(seg(spine, y + h / 2, d < 0 ? x + cw : x, y + h / 2, CONNECTOR, 2));
        out.push(...planGrp([box('roundRect', x, y, cw, h, { fill: PANEL }), rule(d < 0 ? x + cw - 6 : x, y, 6, h, col), ...planIcon(it.icon, x + pad + (d < 0 ? 0 : 6), top + (hd - o.D) / 2, o.D, col, '#FFFFFF', g),
          label(x + pad + (d < 0 ? 0 : 6) + (o.D ? o.D + 8 : 0), top, lw, hd, it.label, { size: o.s, bold: true, color: INK, align: 'left', valign: 'middle' })]
          .concat(it.detail ? [label(x + pad + (d < 0 ? 0 : 6), top + hd - 4, dw, planTH(it.detail, dw, PLAN_DS), it.detail, { size: PLAN_DS, color: INK, align: 'left', valign: 'top' })] : []), g, it.label));
        y += h + gap;
      });
      if (ys.length > 1) lines.push(seg(spine, ys[0], spine, ys[ys.length - 1], CONNECTOR, 2));
      lines.push(seg(spine, hy, d < 0 ? hx - HW / 2 : hx + HW / 2, hy, CONNECTOR, 2));
    });
    const ts = fitsAt(P.title, t.w, t.h, 26) ? 26 : PLAN_DS;
    out.push(Object.assign(box('ellipse', hx - HW / 2, hy - HH / 2, HW, HH, { fill: accent(0), text: P.title, size: ts, bold: true, color: INK, align: 'center', valign: 'middle' }), { grp: 'hub', grpName: P.title }));
    return lines.concat(out);
  } });

/* Icon grid: tiles in rows; each tile's coloured header holds the object and the label, the description uses the full
   width under it (more text per tile than an icon column beside it). */
regPlan('grid', { name: 'Icon grid', family: 'grid',
  needs: P => P.items.length < 2 || P.items.length > 12 ? 'works for 2 to 12 items' : '',
  opts: [{ s: 24, D: 44 }, { s: 22, D: 38 }, { s: 22, D: 32 }],
  build: (P, R, o) => {
    const L = planOrder(P), n = L.length, gx = 14, gy = 14, pad = 8;
    for (const cols of n <= 4 ? [n, 2] : n <= 6 ? [3, 2] : n <= 9 ? [4, 3] : [4]) {
      const rows = Math.ceil(n / cols), cw = (R.w - gx * (cols - 1)) / cols, lw = cw - 2 * pad - o.D - 8, dw = cw - 2 * pad;
      if (!L.every(it => planWords(it.label, lw * 0.95, o.s) && linesAt(it.label, lw * 0.95, o.s) <= 2 && (!it.detail || planWords(it.detail, dw, PLAN_DS)))) continue;
      const hh0 = Math.max(...L.map(it => Math.max(o.D, planLH(it.label, lw, o.s)))) + 2 * pad, split = L.every(it => it.detail);
      const dh = Math.max(0, ...L.map(it => it.detail ? planTH(it.detail, dw, PLAN_DS) : 0)), ch0 = hh0 + (dh ? dh + 8 : 0), need = rows * ch0 + gy * (rows - 1);
      if (need > R.h) continue;
      const ch = ch0 + planSlack(need, R, 36 * rows) / rows, y0 = R.y + (R.h - rows * ch - gy * (rows - 1)) / 2, out = [], hh = dh ? hh0 : ch;   // no descriptions: one centred block
      L.forEach((it, i) => {
        const r = Math.floor(i / cols), k = Math.min(cols, n - r * cols), x = R.x + (R.w - k * cw - (k - 1) * gx) / 2 + (i % cols) * (cw + gx), y = y0 + r * (ch + gy), col = accent(i), g = 'tile' + i;
        out.push(...planGrp([box('roundRect', x, y, cw, ch, { fill: split ? PANEL : col }), box('roundRect', x, y, cw, hh, { fill: col }), ...planIcon(it.icon, x + pad, y + (hh - o.D) / 2, o.D, col, '#FFFFFF', g),
          label(x + pad + o.D + 8, y, lw, hh, it.label, { size: o.s, bold: true, color: INK, align: 'left', valign: 'middle' })]
          .concat(it.detail ? [label(x + pad, y + hh + 4, dw, ch - hh - 8, it.detail, { size: PLAN_DS, color: INK, align: 'left', valign: 'middle' })] : []), g, it.label));
      });
      return out;
    }
    return null;
  } });

/* Columns: one column per item, a coloured header with its object and label, its description under it. */
regPlan('columns', { name: 'Feature columns', family: 'columns',
  needs: P => P.items.length < 2 || P.items.length > 6 ? 'works for 2 to 6 items' : '',
  opts: [{ s: 24, D: 56 }, { s: 22, D: 48 }],
  build: (P, R, o) => {
    const L = planOrder(P), n = L.length, gap = 14, cw = (R.w - gap * (n - 1)) / n, tw = cw - 20;
    if (!L.every(it => planFits(it, tw, o.s))) return null;
    const lh = Math.max(...L.map(it => planLH(it.label, tw, o.s))), hh = 14 + o.D + 8 + lh + 8, dh = Math.max(0, ...L.map(it => it.detail ? planTH(it.detail, tw, PLAN_DS) : 0)), split = L.every(it => it.detail);
    const need = hh + (dh ? dh + 24 : 0);
    if (need > R.h) return null;
    const H = need + planSlack(need, R, 80), y0 = R.y + (R.h - H) / 2, out = [];
    L.forEach((it, i) => {
      const x = R.x + i * (cw + gap), col = accent(i), g = 'col' + i;
      out.push(...planGrp([box('roundRect', x, y0, cw, H, { fill: split ? PANEL : col }), box('roundRect', x, y0, cw, hh, { fill: col }), ...planIcon(it.icon, x + (cw - o.D) / 2, y0 + 14, o.D, col, '#FFFFFF', g),
        label(x + 10, y0 + 14 + o.D + 8, tw, lh, it.label, { size: o.s, bold: true, color: INK, align: 'center', valign: 'top' })]
        .concat(it.detail ? [label(x + 10, y0 + hh + 8, tw, H - hh - 16, it.detail, { size: PLAN_DS, color: INK, align: 'center', valign: 'middle' })] : []), g, it.label));
    });
    return out;
  } });

/* List: rows (two or three columns for longer lists), a number or object on the left, the label with its description
   beside it (one line per row: labelled values) or under it. */
regPlan('rows', { name: 'Structured list', family: 'rows',
  needs: P => P.items.length < 2 || P.items.length > 12 ? 'works for 2 to 12 items' : '',
  opts: [{ s: 24, D: 44 }, { s: 22, D: 40 }, { s: 22, D: 28 }],
  build: (P, R, o) => {
    const L = planOrder(P), n = L.length, seq = planSeq(P);
    for (const [cols, one] of (n >= 9 ? [[2, true], [2, false], [3, false]] : n >= 6 ? [[2, true], [2, false]] : [[1, true], [2, false]])) {
      const per = Math.ceil(n / cols), gx = cols > 2 ? 14 : 20, gap = 8, cw = (R.w - gx * (cols - 1)) / cols, sq = o.D + 16;
      const lw = one ? Math.min(cw * (cols > 1 ? 0.42 : 0.36), Math.max(...L.map(it => it.label.length * o.s * 0.6 + 24))) : cw - sq - 20, dw = one ? cw - sq - lw - 20 : lw;
      if (!L.every(it => planWords(it.label, lw * 0.95, o.s) && linesAt(it.label, lw * 0.95, o.s) <= (one && cols === 1 ? 2 : 3) && (!it.detail || planWords(it.detail, dw, PLAN_DS)))) continue;
      const rh0 = L.map(it => Math.max(sq, (one ? Math.max(planLH(it.label, lw, o.s), it.detail ? planTH(it.detail, dw, PLAN_DS) : 0) : planTextH(it, lw, o.s)) + 8));
      const colH = (c, m) => rh0.slice(c * per, (c + 1) * per).reduce((a, b) => a + b + m, 0) + gap * (Math.min(per, n - c * per) - 1);
      const need = Math.max(...Array.from({ length: cols }, (_, c) => colH(c, 0)));
      if (need > R.h) continue;
      const more = planSlack(need, R, 16 * per) / per, H = Math.max(...Array.from({ length: cols }, (_, c) => colH(c, more))), out = [];
      for (let c = 0; c < cols; c++) {
        let y = R.y + (R.h - H) / 2;
        L.slice(c * per, (c + 1) * per).forEach((it, j) => {
          const i = c * per + j, x = R.x + c * (cw + gx), h = rh0[i] + more, col = accent(i), g = 'row' + i;
          const mark = seq ? [box('roundRect', x, y, sq, h, { fill: col, text: planN(i), size: PLAN_DS, bold: true, color: INK, align: 'center', valign: 'middle' })]
            : [box('roundRect', x, y, sq, h, { fill: col }), ...planIcon(it.icon, x + 8, y + (h - o.D) / 2, o.D, col, '#FFFFFF', g)];
          out.push(...planGrp([box('roundRect', x, y, cw, h, { fill: PANEL }), ...mark].concat(one
            ? [label(x + sq + 12, y, lw, h, it.label, { size: o.s, bold: true, color: INK, align: 'left', valign: 'middle' })].concat(it.detail ? [label(x + sq + 12 + lw, y, dw, h, it.detail, { size: PLAN_DS, color: INK, align: 'left', valign: 'middle' })] : [])
            : planText(it, x + sq + 12, y + (h - planTextH(it, lw, o.s)) / 2, lw, o.s, { grp: g })), g, it.label));
          y += h + gap;
        });
      }
      return out;
    }
    return null;
  } });

/* The core pack's families by kind (V10.10 layouts; their names say what they are). */
Object.entries({ architecture: 'architecture', layers: 'layered', capability: 'grouped', tree: 'grouped', pipeline: 'sequence', timeline: 'sequence', stair: 'sequence',
  hub: 'list', grid: 'list', columns: 'list', rows: 'list' }).forEach(([k, kind]) => { PLAN_LAYOUTS[k].kind = kind; });
PLAN_LAYOUTS.capability.name = 'Grouped columns';

/* ---------- choosing and checking the layouts ---------- */
/* Layouts to try, best first: the provider's recommendation, then the ones the structure suits. */
const PLAN_UPGRADE = { architecture: 'platform', layers: 'stack3d', capability: 'capmap' };
/* ---------- Claude's own compositions (V10.16) ----------
   A concept is Claude's complete design for the content area (1079 x 435 pt): shapes from PowerPoint's presets, texts,
   catalogue objects and connector lines, in colour tokens (a1-a10 the template's accents, panel, rule, line, white,
   ink). It is drawn here as native shapes - nothing is rasterised - and then checked like every layout (planRender0):
   approved colours and 22 pt (brandPrims), overlaps, clipping and the content area (visualQuality), and every item's
   label and description on the slide. A text box Claude made too small for its words is made taller (never smaller
   text); a concept that still fails is not offered, with the reason. Scaled to a smaller free area when needed. */
const CONCEPT_COL = { panel: '#F2F2F2', rule: '#D9D9D9', line: '#7F7F7F', white: '#FFFFFF', ink: '#404040' };
const conceptCol = t => { const m = /^a(\d{1,2})$/.exec(t || ''); return m ? TEMPLATE.accents[(+m[1] + 9) % 10] : CONCEPT_COL[t] || null; };
function planConceptFamily(P, i) {
  const c = (P.concepts || [])[i];
  if (!c) return null;
  return { name: c.name, family: 'ai-concept', kind: 'ai', pack: 'claude', needs: () => '', opts: [{ s: PLAN_DS }],
    build: (P0, R) => {
      const sx = R.w / 1079, sy = R.h / 435, out = [], num = v => (isFinite(+v) ? +v : 0);
      for (const e of c.elements) {
        const x = R.x + num(e.x) * sx, y = R.y + num(e.y) * sy, w = Math.max(1, num(e.w) * sx), h = Math.max(1, num(e.h) * sy), col = conceptCol(e.color);
        const size = Math.max(PLAN_DS, Math.min(48, Math.round(num(e.size) || PLAN_DS))), txt = planClean(e.text || ''), al = e.align === 'left' ? 'left' : 'center';
        if (e.kind === 'line') { out.push(seg(x, y, R.x + num(e.x2) * sx, R.y + num(e.y2) * sy, col || '#7F7F7F', 2.5)); continue; }
        if (e.kind === 'object') {
          // 10.28.2: the point's own colour icon (the library's match for that point), the topic's for the hero;
          // Claude's catalogue object only when no library icon is there
          const it = e.item && (P0.items || []).find(q => q.id === String(e.item)), libKey = k => (/^L:/.test(String(k || '')) ? k : '');
          const key = libKey(it && it.icon) || (!e.item ? libKey(P0.hero) : '') || (CMP[e.object] ? e.object : 'none'), D = Math.min(w, h);
          out.push(...comp(key, x + (w - D) / 2, y + (h - D) / 2, D, col && col !== '#FFFFFF' ? col : accent(0))); continue;
        }
        if (e.kind === 'text') { if (txt) out.push(label(x, y, w, Math.max(h, linesAt(txt, w * 0.95, size) * size * 1.2 + 8), txt, { size, bold: !!e.bold, color: INK, align: al, valign: 'top' })); continue; }
        out.push(box(GEO[e.shape] ? e.shape : 'roundRect', x, y, w, h, Object.assign({ fill: col || PANEL }, txt ? { text: txt, size, bold: !!e.bold, color: INK, align: al, valign: 'middle' } : {})));
      }
      return out;
    } };
}
/* 10.18: a composition with a caption band - the topic (a statement's subject) and the heading (what it is or does)
   above it, the composition drawn in the space below. For compositions that do not show those facts themselves (a
   definition such as "Generative AI is a branch of artificial intelligence that creates ..."), so they are complete
   instead of left out. A real layout key ("cap:<family>"): inserting redraws exactly what the preview shows. The topic
   line is left out when the composition already shows the topic (no duplicated heading). */
function planCaptionFamily(base) {
  const B = PLAN_LAYOUTS[base];
  if (!B || /^cap:/.test(base)) return null;
  // 10.19: LVC sizes (24 pt headings); a paragraph read as sections (sections.js paragraphRead) is captioned with its topic
  const topic = P => P.statement ? (P.short || P.statement.subject) : P.paragraph ? P.title : '';
  const lines = (P, withShort) => [withShort && topic(P) ? { t: topic(P), s: 24, b: true } : null,
    P.sectionName ? { t: P.sectionName, s: 24 } : null].filter(Boolean);
  return { key: 'cap:' + base, name: B.name, family: B.family || base, kind: B.kind || 'list', pack: B.pack || '', groups: B.groups, appeal: B.appeal,
    needs: P => B.needs(P) || (P.sectionName || P.statement || P.paragraph ? '' : 'nothing to caption'),
    opts: B.opts,
    build: (P, R, o) => {
      for (const withShort of [true, false]) {
        const L = lines(P, withShort);
        if (!L.length || L.some(l => !planWords(l.t, R.w, l.s) || linesAt(l.t, R.w * 0.95, l.s) > 2)) return planNo('the caption does not fit');
        const hs = L.map(l => planLH(l.t, R.w, l.s)), h = hs.reduce((a, b) => a + b, 0);
        const R2 = { x: R.x, y: R.y + h + 20, w: R.w, h: R.h - h - 20 };
        if (R2.h < 240) return planNo('no room under the caption');
        const inner = B.build(P, R2, o);
        if (!inner) return null;
        const short = withShort && P.statement ? String(P.short || P.statement.subject) : '';
        if (short && inner.some(p => p.text && String(p.text) === short)) continue;       // the composition shows the topic itself
        let y = R.y; const cap = L.map((l, i) => { const p = label(R.x, y, R.w, hs[i], l.t, { size: l.s, bold: !!l.b, color: INK, align: 'left', valign: 'top', grp: 'caption' }); y += hs[i] - (i ? 0 : 4); return p; });
        return cap.concat([rule(R.x + 4, y + 6, 120, 5, accent(1))], inner);
      }
      return null;
    } };
}
function planCandidates(P) {
  const G = planGroups(P), grouped = G.length >= 2 && planAllGrouped(P), seq = planSeq(P), f = planFlow(P), r = planRoles(P);
  const support = r.supports.length > 0 && r.stages.length >= 2, arch = f.length >= 2 && P.items.some(i => !(P.flow || []).includes(i.id));
  const rel = P.relation || '';
  const base = [].concat(
    support ? ['platform', 'stack3d', 'scene', 'capmap', 'architecture', 'swimlanes', 'planes', 'layers'] : arch ? ['architecture'] : [],
    rel === 'cycle' ? ['cycle'] : [], rel === 'funnel' ? ['funnel'] : [], rel === 'comparison' ? ['versus'] : [],
    /layers|hierarchy/.test(rel) ? ['pyramid', 'stack3d'] : [],
    grouped ? ['capmap', 'stack3d', 'tree', 'capability', 'layers', 'swimlanes'] : [],
    seq ? ['pipeline', 'scene', 'timeline', 'stair'] : [],
    !seq && !support ? ['ecosystem', 'modules'] : [],
    // 10.13: families of later packs say which content they suit (suits(P)); they come before the general ones
    Object.values(PLAN_LAYOUTS).filter(L => L.suits && !L.hidden && (() => { try { return L.suits(P); } catch (e) { return false; } })()).map(L => L.key),
    ['hub', 'grid', 'columns', 'rows']);
  // Claude's own composition first, then its ranking (a core layout by its V10.11 successor), then what the structure suits
  const up = k => (PLAN_UPGRADE[k] && base.includes(PLAN_UPGRADE[k]) ? PLAN_UPGRADE[k] : k);
  const all = [...new Set((P.custom ? ['custom'] : []).concat((P.layouts || []).map(up).filter(k => PLAN_LAYOUTS[k] && base.includes(k)), base))].filter(k => k === 'custom' || PLAN_LAYOUTS[k]);
  // 10.15: named sections ("What you learn" / "Best for") only in layouts that show each section under its name; never
  // as levels, lanes or a flow they do not have
  return grouped && P.sections ? all.filter(k => k === 'custom' || PLAN_LAYOUTS[k].groups || ['capmap', 'tree', 'capability'].includes(k) || (k === 'versus' && rel === 'comparison')) : all;
}
/* V10.12: a plan's style applies while it is drawn: P.style.accent = the approved colour the palette starts at (a colour
   variant), P.style.spacing 'open' = more white space around the layout; P.start = the first step number. */
const PLAN_OPEN = { x: 0.045, y: 0.07 };
const PLAN_COMPACT = [0.6, 0.72, 0.86];       // 10.22: heights tried before the full area (planRender)
function planArea(P, R) {
  if (!(P.style && P.style.spacing === 'open')) return R;
  const dx = R.w * PLAN_OPEN.x, dy = R.h * PLAN_OPEN.y;
  return { x: R.x + dx, y: R.y + dy, w: R.w - 2 * dx, h: R.h - 2 * dy };
}
function planRender(P, key, R) {
  const st = P.style || {}, n = TEMPLATE.accents.length;
  ACCENT_SHIFT = (((st.accent | 0) % n) + n) % n; PLAN_NUM0 = P.start | 0;
  try {
    // 10.22: compact, as in the reference decks - the smallest height (from the top of the area) at which the layout
    // still passes every check at the template's text sizes; the full area only when nothing smaller does.
    // "More white space" (spacing 'open') keeps the whole area.
    const A = planArea(P, R), F = PLAN_LAYOUTS[key];
    let r = null;
    // 10.26: a library family (packs/library-10.26.js) keeps its largest size that fits: each size at the smallest
    // height first, then the next smaller size
    if (F && F.sizeFirst && !(st.spacing === 'open') && A.h > 200) {
      // the variants of a layout with the same holder and mark fit the same way: the size found first is tried first
      const sig = (F.hintKey ? F.hintKey() : key) + '|' + P.items.map(i => i.label + '/' + (i.detail || '')).join('|') + '|' + (P.title || '') + '|' + A.w + 'x' + A.h;
      const hint = PLAN_SIZE_HINT.get(sig), Fs = PLAN_COMPACT.concat([1]);
      if (hint === 'fail') return { ok: false, key, name: F.name, why: 'does not fit the content area at 22 pt' };
      const need = F.needs(P);
      if (need) return { ok: false, key, name: F.name, why: need };
      const tries = hint ? [[hint.k, hint.f]] : [];
      // compact first (the reference decks: visuals sit compactly under the title), each size largest first; then taller
      for (const band of [Fs.filter(f => f <= 0.72), Fs.filter(f => f > 0.72)])
        for (let k = 0; k < F.opts.length; k++) for (const f of band) if (!hint || k !== hint.k || f !== hint.f) tries.push([k, f]);
      for (const [k, f] of tries) {
        PLAN_OPT_ONLY = k;
        try { const c = planRender0(P, key, { x: A.x, y: A.y, w: A.w, h: Math.round(A.h * f) }); if (c.ok) { r = c; PLAN_SIZE_HINT.set(sig, { k, f }); break; } }
        finally { PLAN_OPT_ONLY = -1; }
      }
      if (!r) { if (PLAN_SIZE_HINT.size > 5000) PLAN_SIZE_HINT.clear(); PLAN_SIZE_HINT.set(sig, 'fail'); return { ok: false, key, name: F.name, why: 'does not fit the content area at 22 pt' }; }
    }
    if (!r && !(st.spacing === 'open') && A.h > 200) {
      for (const f of PLAN_COMPACT) {
        const c = planRender0(P, key, { x: A.x, y: A.y, w: A.w, h: Math.round(A.h * f) });
        if (c.ok) { r = c; break; }
      }
    }
    r = r || planRender0(P, key, A);
    r.style = Object.assign({ accent: ACCENT_SHIFT, spacing: st.spacing === 'open' ? 'open' : 'fill' }, st.icons ? { icons: st.icons } : {});   // 10.21.1: the icon style goes with the design (insertion draws it again)
    return r;
  } finally { ACCENT_SHIFT = 0; PLAN_NUM0 = 0; }
}
/* One layout in R: the first size that passes every check; { ok, prims, ... } or { ok: false, why }. */
function planRender0(P, key, R) {
  const L = key === 'custom' ? (P.custom && planZoneFamily(Object.assign({ key: 'custom', name: P.custom.name || "Claude's composition", kind: 'custom', items: true }, P.custom)))
    : /^ai:\d$/.test(key) ? planConceptFamily(P, +key.slice(3)) : /^cap:/.test(key) ? planCaptionFamily(key.slice(4)) : PLAN_LAYOUTS[key];
  if (!L) return { ok: false, key, why: 'unknown layout' };
  const need = L.needs(P);
  PLAN_WHY_LAST = need || '';
  if (need) return { ok: false, key, name: L.name, why: need };
  let why = 'does not fit the content area at 22 pt', first = '';
  for (const o of (PLAN_OPT_ONLY >= 0 && L.opts[PLAN_OPT_ONLY] ? [L.opts[PLAN_OPT_ONLY]] : L.opts)) {
    let prims;
    PLAN_WHY = ''; PLAN_ICONSTYLE = (P.style && P.style.icons) || '';
    try { prims = L.build(P, R, o); } catch (e) { why = 'could not be drawn (' + e.message + ')'; continue; } finally { PLAN_ICONSTYLE = ''; }
    if (!prims) { why = PLAN_WHY ? `${PLAN_WHY} at ${o.s} pt` : `too much text for this layout at ${o.s} pt`; continue; }
    prims = roundCorners(brandPrims(prims));
    // 10.24: a text drawn over several lines (a converted design keeps its own line breaks) is the same words
    const sp = t => String(t).replace(/\s+/g, ' ').trim(), q = visualQuality(qualityItems(prims), R), texts = new Set(prims.filter(p => p.text).map(p => sp(p.text)));
    const lost = P.items.filter(it => !texts.has(sp(it.label)) || (it.detail && !texts.has(sp(it.detail))));
    // 10.24: a lenient family (packs/antv: a converted design) is blocked by overlapping labels and text outside the
    // area; its 3D parts beside a number or its connectors are the design
    if (L.lenient) { const b = q.block.filter(x => /overlap|outside/.test(x)); q.block = b; q.excluded = b.length > 0; }
    if (q.excluded || lost.length) { why = q.block[0] || `"${lost[0].label}" is not fully shown`; first = first || why; continue; }   // the next size repairs it, or the layout is not offered
    return { ok: true, key, name: L.name, family: L.family || key, kind: L.kind || 'list', pack: L.pack || '', prims, quality: q };
  }
  return { ok: false, key, name: L.name, why: first && first !== why ? `${why} (larger sizes: ${first})` : why };
}
/* Up to `max` structurally different layouts that pass; `skipped` says why the others are not offered. */
/* Up to `max` layouts that pass, structurally different: one per kind first (architecture, layered, pictorial, grouped,
   sequence, list), then other families. o.names: when fewer pass with the descriptions (a drawing's full sentences),
   the point names alone are tried for the rest, and such a layout says so (r.namesOnly). */
function planVariations(P, R, max, o) {
  max = max || 4; o = o || {};
  const list = [], skipped = [], fam = new Set(), kinds = new Set(), done = {};
  const cands = planCandidates(P), render = k => (done[k] = done[k] || planRender(P, k, R));
  for (const pass of [0, 1]) for (const k of cands) {
    if (list.length >= max) break;
    const r = render(k);
    if (!r.ok) { if (!pass) skipped.push(r); continue; }
    if (fam.has(r.family) || (!pass && kinds.has(r.kind))) continue;
    list.push(r); fam.add(r.family); kinds.add(r.kind);
  }
  if (o.names && list.length < max && P.items.some(i => i.detail)) {
    const bare = Object.assign({}, P, { items: P.items.map(i => Object.assign({}, i, { detail: '' })) }), V = planVariations(bare, R, max);
    V.list.filter(r => !fam.has(r.family)).slice(0, max - list.length).forEach(r => { r.namesOnly = true; list.push(r); fam.add(r.family); });
  }
  return { list, skipped };
}

/* ---------- plans from what the providers return ---------- */
const planClean = t => String(t == null ? '' : t).replace(/\s+/g, ' ').replace(/^\s*(?:\d{1,2}[.)]|[-•*])\s*/, '').replace(/\s*[:;,]\s*$/, '').trim();
/* Objects for the items: the catalogue's best match for the provider's hint and the item's own words, each object once. */
function planIcons(items) {
  // 10.24: chosen for the whole set at once (gallery.js iconAssign): the strongest match anywhere first
  const lists = items.map(it => {
    const m = new Map();
    conceptScores(it.label, [it.hint, it.detail].filter(Boolean).join(' ')).concat(it.hint ? conceptScores(it.hint, '') : [])
      .forEach(x => { const o = m.get(x.key); if (!o || x.score > o.score) m.set(x.key, x); });
    return [...m.values()].sort((a, b) => b.score - a.score || a.order - b.order);
  });
  iconAssign(lists, 3).forEach((pick, i) => { items[i].icon = pick ? pick.key : 'none'; });
  // 10.27: the icon library's matching icons (iconlib.js): every point an icon that depicts it, never the empty marker
  if (typeof iconLibAssign === 'function') iconLibAssign(items, PLAN_TOPIC);
}
/* the topic of the plan being made (planIcons' fallback for a point nothing matches) */
let PLAN_TOPIC = '';
/* Claude's plan (the JSON of claude_visual.py PLAN_SCHEMA) -> a checked plan; problems name what was repaired. */
function planFromClaude(raw) {
  const problems = [];
  const items = (Array.isArray(raw && raw.items) ? raw.items : []).map((x, i) => ({ id: String(x.id || 'i' + i), label: planClean(x.label), detail: planClean(x.detail).replace(/\.$/, ''), hint: planClean(x.icon_hint),
    group: String(x.group || ''), role: PLAN_ROLES.includes(x.role) ? x.role : '', pictorial: String(x.pictorial || '') }))
    .filter(it => it.label);
  const ids = new Set();
  items.forEach((it, i) => { if (ids.has(it.id)) it.id = it.id + '_' + i; ids.add(it.id); });
  const groups = (Array.isArray(raw && raw.groups) ? raw.groups : []).map(g => ({ id: String(g.id || ''), name: planClean(g.name), role: String(g.role || 'category') })).filter(g => g.id && g.name && items.some(i => i.group === g.id));
  items.forEach(it => { if (it.group && !groups.some(g => g.id === it.group)) { it.group = ''; problems.push(`group of "${it.label}" unknown`); } });
  const flow = [...new Set((Array.isArray(raw && raw.flow) ? raw.flow : []).map(String))].filter(id => ids.has(id));
  const layouts = (Array.isArray(raw && raw.layouts) ? raw.layouts : []).map(String).filter(k => PLAN_LAYOUTS[k]);
  // 10.28.2: with the colour icon library (iconlib.js) Claude's object is a hint for the library's match (the point keeps a
  // realistic colour icon); without the library, Claude's catalogue object as before
  const lib = typeof ICONLIB !== 'undefined' && ICONLIB.ready;
  if (lib) items.forEach(it => { if (it.pictorial) it.hint = [it.hint, String(it.pictorial).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()].filter(Boolean).join(' '); });
  planIcons(items);
  if (!lib) items.forEach(it => { if (it.pictorial && CMP[it.pictorial] && !items.some(o => o !== it && o.icon === it.pictorial)) it.icon = it.pictorial; });   // Claude's object, when the catalogue has it
  // Claude's own composition (zone grid): kept when every zone is on the grid and names known items
  let custom = null;
  const c = raw && raw.custom;
  if (c && Array.isArray(c.zones) && c.zones.length >= 2) {
    const zones = c.zones.map(z => ({ id: String(z.id || ''), label: planClean(z.label), items: (Array.isArray(z.items) ? z.items : []).map(String).filter(id => ids.has(id)),
      col: +z.col, row: +z.row, w: +z.w, h: +z.h, style: String(z.style || 'panel') })).filter(z => z.items.length && z.col >= 0 && z.row >= 0 && z.w >= 1 && z.h >= 1 && z.col + z.w <= 12 && z.row + z.h <= 6);
    if (zones.length >= 2) custom = { name: planClean(c.name) || "Claude's composition", zones, connectors: (Array.isArray(c.connectors) ? c.connectors : []).map(x => ({ from: String(x.from), to: String(x.to) })).filter(x => ids.has(x.from) && ids.has(x.to)) };
    else problems.push("Claude's own composition was not usable (zones outside the grid or without items)");
  }
  const plan = planSemantics({ title: planClean(raw && raw.title), relation: String(raw && raw.relation || 'independent'), items, groups, flow, layouts, custom, from: 'claude' });
  // 10.14: the slide's message for learners (the showcase pack's headline and takeaway) and the topic's own object
  plan.headline = planClean(raw && raw.headline) || plan.title;
  plan.takeaway = planClean(raw && raw.takeaway).replace(/\.$/, '');
  plan.hero = raw && raw.hero && CMP[raw.hero] ? String(raw.hero) : '';
  plan.short = planClean(raw && raw.short);
  // 10.28.2: the topic's picture from the colour icon library (Claude's object as a hint), like every point's
  if (lib && typeof iconLibBest === 'function') {
    const h = iconLibBest([plan.short, plan.title, String(raw && raw.hero || '').replace(/([a-z])([A-Z])/g, '$1 $2')].filter(Boolean).join(' '), plan.hero ? null : 'layers');
    if (h) plan.hero = h;
  }
  // 10.15: labelled sections ("What you learn" / "Best for") as Claude grouped them: drawn under their names
  plan.short = planClean(raw && raw.short);
  // 10.16: Claude's own compositions ("concepts"): drawn as native shapes by planRender under the keys ai:0 .. ai:3
  plan.concepts = (Array.isArray(raw && raw.concepts) ? raw.concepts : []).filter(c => c && Array.isArray(c.elements) && c.elements.length >= 3).slice(0, 6)
    .map(c => ({ name: planClean(c.name) || 'AI concept', idea: planClean(c.idea), elements: c.elements }));
  if (typeof sectionKind === 'function' && groups.length >= 2 && groups.some(g => sectionKind(g.name) !== 'other')) {
    plan.sections = true; groups.forEach(g => { g.kind = sectionKind(g.name); });
  }
  return { plan, problems };
}
/* A provider's drawing (napkinStructure) -> a plan of its items, in the user's order for a sequence. */
function planFromStructure(st, o) {
  o = o || {};
  if (!st || !st.items || st.items.length < 2) return null;
  const items = (st.hub && st.hub.label ? [{ label: st.hub.label, detail: st.hub.detail }] : []).concat(st.items)
    .map((u, i) => ({ id: 'i' + i, label: planClean(u.label), detail: planClean(u.detail), group: '' })).filter(it => it.label);
  if (o.ordered && o.order && o.order.length) {
    const at = it => { const s = o.order.map(x => sharedWords(x, it.label)), m = Math.max(...s); return m > 0 ? s.indexOf(m) : o.order.length; };
    items.forEach((it, k) => { it.at = at(it) * 100 + k; });
    items.sort((a, b) => a.at - b.at);
  }
  planIcons(items);
  return planSemantics({ title: o.title || (st.head && st.head.text) || '', relation: o.ordered ? 'sequence' : 'independent', items, groups: [], flow: o.ordered ? items.map(i => i.id) : [], layouts: [], from: 'drawing' });
}
/* The prims of a rendered layout as a build result, the same object napkinBuild returns (preview = insertion). */
function planBuildResult(r, notes) {
  const prims = r.prims, report = { shapes: prims.filter(p => p.t === 'shape').length, lines: prims.filter(p => p.t === 'line').length,
    texts: prims.filter(p => p.t === 'text' || (p.t === 'shape' && p.text)).length, pictures: 0, edit: 'full', rebuilt: true, plan: true, arrangement: r.name, kind: r.kind, pack: r.pack, namesOnly: !!r.namesOnly, notes: notes || {} };
  report.native = report.shapes + report.lines + prims.filter(p => p.t === 'text').length;
  report.quality = r.quality;
  return { prims, report, rebuilt: true, plan: true, added: [], missing: [], labels: [], arrangement: r.name, kind: r.kind, namesOnly: !!r.namesOnly };
}

/* ---------- compositions as data: a zone grid (12 columns x 6 rows of the area) ----------
   A pack adds a family without code, and Claude may propose its own composition in the same form:
   { key, name, kind, zones: [{ id, label, items: [ids] or '@stage' '@output' '@support' '@control' '@quality'
     '@foundation' '@group:<id>' '@rest', col, row, w, h, style: band | panel | nodes_row | nodes_column }],
     connectors: 'flow' or [{ from, to }] }
   Every item must be placed exactly once; each zone draws its items as tiles measured at 22 pt; the result is checked
   like every other layout. */
function planZoneItems(P, sel, taken) {
  const pick = sel === '@stage' ? planRoles(P).stages : sel === '@output' ? planRoles(P).outputs : sel === '@support' ? planRoles(P).supports
    : sel === '@control' ? planRoles(P).control : sel === '@quality' ? planRoles(P).quality : sel === '@foundation' ? planRoles(P).foundation
    : /^@group:/.test(sel) ? P.items.filter(i => i.group === sel.slice(7)) : sel === '@rest' ? P.items : [planItem(P, sel)].filter(Boolean);
  return pick.filter(i => !taken.has(i.id));
}
function planZoneFamily(spec) {
  return { key: spec.key, name: spec.name, family: spec.key, kind: spec.kind || 'architecture', pack: spec.pack || planPackId,
    needs: P => {
      const taken = new Set();
      spec.zones.forEach(z => [].concat(z.items).forEach(sel => planZoneItems(P, sel, taken).forEach(i => taken.add(i.id))));
      return taken.size === P.items.length ? (spec.needs ? spec.needs(P) : '') : 'its zones do not place every point';
    },
    opts: [{ s: 24, D: 36, pad: 8 }, { s: 22, D: 32, pad: 7 }, { s: 22, D: 28, pad: 5 }, { s: 22, D: 0, pad: 5 }],
    build: (P, R, o) => {
      const cw = R.w / 12, rh = R.h / 6, gap = 8, out = [], lines = [], at = {}, taken = new Set();
      for (const [zi, z] of spec.zones.entries()) {
        const items = [].concat(z.items).flatMap(sel => { const got = planZoneItems(P, sel, taken); got.forEach(i => taken.add(i.id)); return got; });
        if (!items.length) continue;
        const zx = R.x + z.col * cw + (z.col ? gap / 2 : 0), zy = R.y + z.row * rh + (z.row ? gap / 2 : 0), zw = z.w * cw - (z.col ? gap / 2 : 0) - (z.col + z.w < 12 ? gap / 2 : 0), zh = z.h * rh - (z.row ? gap / 2 : 0) - (z.row + z.h < 6 ? gap / 2 : 0);
        const col = accent(zi), name = z.label && z.label !== '@group' ? z.label : z.label === '@group' && items[0].group ? ((P.groups || []).find(g => g.id === items[0].group) || {}).name || '' : '';
        let ix = zx, iy = zy, iw = zw, ih = zh;
        if (z.style === 'band' || z.style === 'panel') out.push(box('roundRect', zx, zy, zw, zh, { fill: PANEL }));
        if (name && z.style === 'band') { const tw = Math.min(170, zw * 0.25); if (!planWords(name, (tw - 12) * 0.95, o.s)) return planNo(`the name "${name}" does not fit its tab`); out.push(box('roundRect', zx, zy, tw, zh, { fill: col, text: name, size: o.s, bold: true, color: INK, align: 'center', valign: 'middle' })); ix += tw + 8; iw -= tw + 8; }
        else if (name) { const hh = planLH(name, zw - 20, o.s) + 6; out.push(box('roundRect', zx, zy, zw, hh, { fill: col, text: name, size: o.s, bold: true, color: INK, align: 'center', valign: 'middle' })); iy += hh + 6; ih -= hh + 6; }
        if (z.style === 'band' || z.style === 'panel') { ix += 6; iy += 6; iw -= 12; ih -= 12; }
        const across = z.style === 'band' || z.style === 'nodes_row' || (z.style === 'panel' && iw > ih * 1.6), tg = z.style === 'nodes_row' ? 30 : 8, k = items.length;
        const T = { s: o.s, D: o.D, pad: o.pad, top: false };
        const ws = across ? planWidths(items, iw, tg, o.s, o.D ? o.D + 8 + 2 * o.pad : 2 * o.pad) : items.map(() => iw);
        if (!ws) return planNo(`zone "${z.id}" is too narrow for its items`);
        const hs = items.map((it, i) => planTileH(it, ws[i], T));
        if (!items.every((it, i) => planTileFits(it, ws[i], T))) return planNo(`a word does not fit in zone "${z.id}"`);
        if (across ? Math.max(...hs) > ih : hs.reduce((a, b) => a + b, 0) + tg * (k - 1) > ih) return planNo(`zone "${z.id}" needs ${Math.round(across ? Math.max(...hs) : hs.reduce((a, b) => a + b, 0) + tg * (k - 1))} of ${Math.round(ih)} pt of height`);
        let x = ix, y = iy + (across ? 0 : (ih - hs.reduce((a, b) => a + b, 0) - tg * (k - 1)) / 2);
        items.forEach((it, i) => {
          const h = across ? ih : hs[i], g = 'z' + zi + '-' + i;
          out.push(...planTile(it, x, y, ws[i], h, Object.assign({ col: accent(P.items.indexOf(it)), bg: '#FFFFFF', stripe: true, grp: g }, T)));
          at[it.id] = { x, y, w: ws[i], h };
          if (across) x += ws[i] + tg; else y += h + tg;
        });
      }
      const pairs = spec.connectors === 'flow' ? planFlow(P).slice(1).map((it, i) => ({ from: planFlow(P)[i].id, to: it.id })) : spec.connectors || [];
      pairs.forEach(c => { const a = at[c.from], b = at[c.to]; if (!a || !b) return;
        if (Math.abs((a.y + a.h / 2) - (b.y + b.h / 2)) < 4 && (b.x > a.x + a.w || a.x > b.x + b.w)) { const d = b.x > a.x ? 1 : -1, y = a.y + a.h / 2; lines.push(...arrowSeg(d > 0 ? a.x + a.w + 3 : a.x - 3, y, d > 0 ? b.x - 3 : b.x + b.w + 3, y, CONNECTOR, 2.5, 12)); }
        else if (b.y > a.y + a.h || a.y > b.y + b.h) { const d = b.y > a.y ? 1 : -1, x = Math.max(a.x, b.x) + Math.min(a.w, b.w) / 2; if (x > Math.min(a.x + a.w, b.x + b.w)) return; lines.push(...arrowSeg(x, d > 0 ? a.y + a.h + 3 : a.y - 3, x, d > 0 ? b.y - 3 : b.y + b.h + 3, CONNECTOR, 2.5, 12)); } });
      return lines.concat(out);
    } };
}

/* ---------- V10.12: more designs of a saved plan, content density, several slides (all free: no AI request) ----------
   A plan, once made (Claude's design, Napkin's items, the panel's own analysis), is drawn again as often as wanted:
   - planMoreDesigns: designs not shown yet - other families first (one per kind, as planVariations), then the same
     families with another colour order (approved accents only) or more white space. `seen` holds what was shown.
   - density: 'full' (every description), 'names' (the point names only; said, never silent), 'auto' (full when a
     layout fits at 22 pt, else the names on one slide, or every description on several slides - planSlides).
   - planSlides / planSplit: long content split where it divides logically (main flow / functions across it, the
     plan's groups, consecutive steps with their numbers continued, else even parts), each part measured at 22 pt,
     with an optional overview of all point names first. Every label and description stays on a slide (planCoverage). */
const PLAN_STYLES = [{ accent: 0, spacing: 'fill' }, { accent: 3, spacing: 'fill' }, { accent: 0, spacing: 'open' }, { accent: 6, spacing: 'fill' }, { accent: 3, spacing: 'open' }, { accent: 6, spacing: 'open' }];
const PLAN_COLOUR_NAMES = ['blue', 'orange', 'green', 'violet', 'coral', 'gold', 'steel blue', 'pink', 'brown', 'lilac'];
const planDesignKey = r => `${r.family}|${r.style ? r.style.accent : 0}|${r.style ? r.style.spacing : 'fill'}${r.style && r.style.icons ? '|' + r.style.icons : ''}`;
const planStyleName = st => [st && st.accent ? `colours from ${PLAN_COLOUR_NAMES[st.accent % 10]}` : '', st && st.spacing === 'open' ? 'more white space' : ''].filter(Boolean).join(', ');   // 2.5D icons: said in the design's own name
/* 10.21.1: the 2.5D-icon version of designs that show objects on discs (drawn by planIcon); null when it looks the same */
function planIsoVariant(P, r, R) {
  if (!r || !r.prims || !r.prims.some(p => p.cmp && p.cmp !== 'none')) return null;
  const x = planRender(Object.assign({}, P, { style: Object.assign({}, r.style, { icons: 'iso' }) }), r.key, R);
  if (!x.ok || !x.prims.some(p => p.g === 'cube' && p.grp)) return null;
  return Object.assign(x, { name: x.name + ' with 2.5D icons', family: x.family + '-25d' });   // its own design in the gallery (not a duplicate of the flat one)
}
function planMoreDesigns(P, R, seen, max) {
  max = max || 4;
  const out = [], fams = new Set(), kinds = new Set(), cands = planCandidates(P), failed = {}, a0 = (P.style && P.style.accent) | 0;
  for (const st of PLAN_STYLES) for (const pass of [0, 1]) for (const k of cands) {
    if (out.length >= max) return out;
    const fk = k + '|' + st.spacing;
    if (failed[fk]) continue;
    const r = planRender(Object.assign({}, P, { style: Object.assign({}, P.style, { accent: a0 + st.accent, spacing: st.spacing }) }), k, R);
    if (!r.ok) { failed[fk] = 1; continue; }
    const key = planDesignKey(r);
    if (seen.has(key) || fams.has(r.family) || (!pass && kinds.has(r.kind))) continue;
    out.push(r); fams.add(r.family); kinds.add(r.kind); seen.add(key);
  }
  return out;
}
const planNames = P => Object.assign({}, P, { items: P.items.map(i => Object.assign({}, i, { detail: '' })), density: 'names', custom: null });
const planFitsOne = (P, R) => planVariations(P, R, 1).list.length > 0;
/* A plan with the density asked for; 'auto': every description when a layout fits, else the names (`why` says so). */
function planAtDensity(P, R, density) {
  if (density === 'names') return { plan: planNames(P), density: 'names' };
  if (density === 'full' || !P.items.some(i => i.detail) || planFitsOne(P, R)) return { plan: P, density: 'full' };
  return { plan: planNames(P), density: 'names', why: 'the descriptions do not fit one slide at 22 pt (Several slides keeps them on the slides)' };
}
/* A part of a plan: its items (roles, groups, icons kept), the flow among them, numbering continued from `start`. */
function planPart(P, items, o) {
  const ids = new Set(items.map(i => i.id)), flow = (P.flow || []).filter(id => ids.has(id)), first = (P.flow || [])[0], st = Object.assign({}, P.style);
  if (o.start) st.accent = (st.accent | 0) + o.start;
  return Object.assign({}, P, { items: items.map(i => Object.assign({}, i)), groups: (P.groups || []).filter(g => items.some(i => i.group === g.id)), flow, custom: null,
    layouts: (o.layouts || P.layouts || []).slice(), sources: ids.has(first) ? (P.sources || []) : [], relation: o.relation || P.relation, start: o.start || 0, style: st, part: o.name || '' });
}
// a part that is a run of steps is shown as a flow first (the plan's own ranking was for the whole content)
const PLAN_SEQ_FIRST = ['scene', 'pipeline', 'timeline', 'stair'];
const planChunks = (a, k) => { const out = [], b = Math.floor(a.length / k), x = a.length % k; let at = 0; for (let j = 0; j < k; j++) { const n = b + (j < x ? 1 : 0); out.push(a.slice(at, at + n)); at += n; } return out; };
/* The fewest consecutive, balanced parts (at least o.min) that each fit with every description; null when none do. */
function planChunked(P, items, R, o) {
  for (let k = Math.max(1, o.min || 1); k <= Math.min(6, items.length); k++) {
    let at = o.start || 0;
    const parts = planChunks(items, k).map((c, j) => {
      const name = o.seq && k > 1 ? `${o.name ? o.name + ', ' : ''}steps ${at + 1}${c.length > 1 ? '-' + (at + c.length) : ''}` : k > 1 ? `${o.name ? o.name + ' ' : ''}(${j + 1} of ${k})` : (o.name || '');
      const q = planPart(P, c, { relation: o.relation, start: o.seq ? at : 0, name, layouts: o.seq ? PLAN_SEQ_FIRST : null });
      at += c.length;
      return q;
    });
    if (parts.every(q => planFitsOne(q, R))) return parts;
  }
  return null;
}
/* Long content in logical parts: { parts, how } or null (a point too long for a slide at 22 pt even on its own). */
function planSplit(P, R, min) {
  min = min || 2;
  const r = planRoles(P), G = planGroups(P), order = planOrder(P), fullFlow = (P.flow || []).length === P.items.length && P.items.length >= 2;
  const seqRel = items => { const ids = new Set(items.map(i => i.id)); return items.length >= 2 && (P.flow || []).filter(id => ids.has(id)).length === items.length ? 'sequence' : 'independent'; };
  const tries = [];
  if (r.supports.length && r.stages.length >= 2) tries.push(['by role: the main flow, then the functions that apply across it', () => {
    const inFlow = planFlow(P), main = inFlow.concat(P.items.filter(i => !planSupport(i) && !inFlow.includes(i))), sup = P.items.filter(planSupport);
    const a = planChunked(P, main, R, { relation: seqRel(main), seq: seqRel(main) === 'sequence', name: 'Main flow' });
    const b = a && planChunked(P, sup, R, { relation: 'independent', name: 'Functions across the flow' });
    return a && b ? a.concat(b) : null; }]);
  if (G.length >= 2 && planAllGrouped(P)) tries.push(['by group', () => {
    const out = [];
    let cur = [];
    const flush = () => { if (!cur.length) return true; const items = cur.flatMap(x => x.items), name = cur.map(x => x.g.name).join(' and ');
      const parts = planChunked(P, items, R, { relation: seqRel(items), name }); if (!parts) return false; out.push(...parts); cur = []; return true; };
    for (const x of G) {
      const next = cur.concat([x]), items = next.flatMap(y => y.items);
      if (cur.length && !planFitsOne(planPart(P, items, { relation: seqRel(items) }), R)) { if (!flush()) return null; cur = [x]; } else cur = next;
    }
    if (!flush()) return null;
    if (out.length >= min) return out;
    // asked for several slides although the groups fit together: one group per slide
    const each = G.map(x => planChunked(P, x.items, R, { relation: seqRel(x.items), name: x.g.name }));
    return each.every(Boolean) ? each.flat() : null; }]);
  if (planSeq(P) || fullFlow) tries.push(['in order: consecutive steps, numbers continued', () => planChunked(P, order, R, { relation: 'sequence', seq: true, min })]);
  tries.push(['in even parts', () => planChunked(P, order, R, { relation: P.relation === 'sequence' ? 'sequence' : 'independent', min })]);
  for (const [how, f] of tries) { const parts = f(); if (parts && parts.length >= min) return { parts, how }; }
  return null;
}
/* The slides for a plan. o.slides: 'auto' (one slide when it fits, else split) | 'one' | 'split'; o.density as above;
   o.overview (default true): a first slide with every point name when the content is split. */
function planSlides(P, R, o) {
  o = o || {};
  const density = o.density || 'auto', mode = o.slides || 'auto', base = density === 'names' ? planNames(P) : P;
  const one = q => Object.assign(q, { title: P.title || '' });
  if (mode !== 'split' && planFitsOne(base, R)) return { parts: [one(base)], density: density === 'names' ? 'names' : 'full', how: 'one slide' };
  if (mode === 'one') {
    if (density === 'auto' && planFitsOne(planNames(P), R)) return { parts: [one(planNames(P))], density: 'names', how: 'one slide', why: 'the descriptions do not fit one slide at 22 pt' };
    return { parts: [], why: 'too much content for one slide at 22 pt: choose several slides' };
  }
  const sp = planSplit(base, R, 2);
  if (!sp) return { parts: [], why: P.items.length < 2 ? 'a single point cannot be split' : 'a point is too long for a slide at 22 pt even on its own' };
  const parts = sp.parts.map((q, k) => Object.assign(q, { title: [P.title, q.part].filter(Boolean).join(': ') || `Part ${k + 1}` }));
  if (o.overview !== false && base.items.some(i => i.detail)) {
    const ov = Object.assign(planNames(P), { part: 'Overview', overview: true, title: [P.title, 'overview'].filter(Boolean).join(': ') });
    if (planFitsOne(ov, R)) parts.unshift(ov);
  }
  return { parts, density: density === 'names' ? 'names' : 'full', how: sp.how };
}
/* Every label and description of P that is not on the slides (an overview does not count). */
function planCoverage(P, rendered) {
  const texts = new Set(rendered.filter(x => !x.overview).flatMap(x => x.prims.filter(p => p.text).map(p => String(p.text))));
  return P.items.flatMap(i => [i.label].concat(i.detail ? [i.detail] : [])).filter(t => !texts.has(t));
}
/* 10.21.1: the relation a text STATES between its points - read from its structure first, then from wording that is
   about the whole set (title, introduction, closing line: never a point's own description), with technical phrases that
   only look like cues left out ("for loop", "continuous integration", "high levels of"). Nothing is inferred from the
   number or the look of the points.
   doc = { title, full, items: [{ label, detail }], groups: [names], groupItems: [[labels], [labels]], ordered }
   -> { relation: 'comparison' | 'funnel' | 'cycle' | 'layers' | 'timeline' | 'sequence' | '', ordered, why, evidence: [] } */
const REL_PAIRS = [[/^pros?\b/i, /^cons?\b/i], [/^advantages?/i, /^disadvantages?/i], [/^benefits?/i, /^(risks?|drawbacks?|challenges?|limitations?|costs?)\b/i],
  [/^before\b/i, /^after\b/i], [/^do'?s?\b/i, /^(don'?t|do not)/i], [/^strengths?/i, /^weaknesses?/i], [/^myths?/i, /^facts?/i],
  [/^(traditional|legacy|old|manual|conventional)\b/i, /^(modern|new|automated|ai|digital)\b/i], [/^(on-?prem\w*|on premises?)\b/i, /^cloud\b/i]];
// phrases that contain a cue word but name a thing, not the relation between the points
const REL_NOT = new RegExp([
  String.raw`\b(?:for|while|do[- ]while|event|nested|infinite|render|game|main|inner|outer|training)[- ]loops?\b`,
  String.raw`\bloop (?:statements?|variables?|counters?|body)\b`,
  String.raw`\bcontinuous (?:integration|delivery|deployment|testing|monitoring|learning|improvement|variables?|data|values?|distribution)\b`,
  String.raw`\biterations? (?:of training|per epoch)\b`,
  String.raw`\b(?:high|low|higher|lower|greater|increased|reduced|significant|varying|different|various|several|multiple|access|logging|log|privilege|skill|experience|confidence|noise|stress)\s+levels?\b`,
  String.raw`\blevels? of (?:accuracy|security|risk|detail|service|confidence|access|abstraction|support|performance|quality|protection|automation|experience)\b`,
  String.raw`\b(?:pricing|service|support|subscription|storage|free|premium) tiers?\b`,
  String.raw`\bcycle time\b`, String.raw`\bclock cycles?\b`].join('|'), 'gi');
const REL_ORDINAL = /^(?:step|phase|stage)\s*\d+\b|^(?:first(?:ly)?|second(?:ly)?|third(?:ly)?|then|next|finally|lastly|afterwards?)\b/i;
const REL_LEVEL = /^(?:level|tier|layer)\s*\d+\b/i;
const REL_DATE = /\b(?:(?:19|20)\d{2}|q[1-4]\s*(?:19|20)\d{2})\b/i;
const relNum = t => { const m = /(?:^|\s)(\d[\d,]*(?:\.\d+)?)\s*(%|k\b|m\b|million\b)?/i.exec(String(t || '')); if (!m) return null;
  let v = parseFloat(m[1].replace(/,/g, '')); if (/^k$/i.test(m[2] || '')) v *= 1e3; if (/^(m|million)$/i.test(m[2] || '')) v *= 1e6; return v; };
const relWords = t => String(t || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/)
  .filter(w => w.length > 3 && !/^(with|from|that|this|their|they|into|more|less|than|have|each|over|uses?|used|using|data)$/.test(w));
function planRelation(doc) {
  doc = doc || {};
  const items = (doc.items || []).filter(i => i && i.label), n = items.length, G = (doc.groups || []).map(g => String(g || '').trim()).filter(Boolean);
  const lab = items.map(i => String(i.label).trim()), det = items.map(i => String(i.detail || '').trim());
  // the scope: what the text says about the whole set - its title and the sentences that are not one of its points
  const keyOf = t => String(t).toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 40);
  const keys = lab.map(keyOf).filter(k => k.length >= 3);
  const sentences = String(doc.full || '').split(/\n+|(?<=[.!?])\s+/).map(x => x.trim()).filter(Boolean);
  const norm = s => s.toLowerCase().replace(/^[\s\-*•\d.)]+/, '').replace(/\s+/g, ' ').trim();
  const dets = det.map(norm).filter(d => d.length > 8);
  // a sentence that is one point (it starts with the point, or is its description) is the point's own text, not about the
  // set; a sentence that lists several points ("collect, train, evaluate, then repeat") keeps its words around the list
  const scopeParts = [String(doc.title || '')], listParts = [];
  sentences.forEach(s => {
    const t = norm(s), at = keys.map(k => t.indexOf(k)).filter(i => i >= 0);
    if (keys.some(k => t.startsWith(k)) && at.length < Math.min(3, n)) return;
    if (dets.some(d => d.includes(t) || t.includes(d))) return;
    if (at.length >= 3 && n >= 3) { const last = keys.filter(k => t.includes(k)).map(k => t.lastIndexOf(k) + k.length), part = t.slice(0, Math.min(...at)) + ' … ' + t.slice(Math.max(...last)); scopeParts.push(part); listParts.push(part); }
    else scopeParts.push(s);
  });
  const scope = scopeParts.join('\n').replace(REL_NOT, ' ');
  const head = (String(doc.title || '') + '\n' + (scopeParts[1] || '')).replace(REL_NOT, ' ');
  const ev = { comparison: [], funnel: [], cycle: [], layers: [], timeline: [], sequence: [] }, add = (k, w, why) => ev[k].push({ w, why });
  // comparison: two named sides that are a known pair, or say "vs", or describe the same attributes side by side
  if (G.length === 2) {
    if (REL_PAIRS.some(([a, b]) => (a.test(G[0]) && b.test(G[1])) || (a.test(G[1]) && b.test(G[0])))) add('comparison', 3, `the two sections are “${G[0]}” and “${G[1]}”`);
    const vs = /\b(vs\.?|versus|compared (?:to|with)|comparison of|differences? between|contrast(?:ed|ing)? with)(?=\s|$)/i.exec(scope + '\n' + G.join(' '));
    if (vs) add('comparison', 2, `the text says “${vs[0]}”`);
    if (doc.groupItems && doc.groupItems.length === 2) {
      const [A, B] = doc.groupItems.map(L => L.map(relWords)), shared = A.filter(a => B.some(b => b.some(w => a.includes(w)))).length;
      if (A.length >= 2 && B.length >= 2 && shared >= Math.ceil(Math.min(A.length, B.length) * 0.6)) add('comparison', 2, `both sections describe the same ${shared} attributes`);
    }
  }
  if (n >= 3) {
    // order: numbered or ordinal points, dates in order, "steps / process" said about the set
    if (doc.ordered) add('sequence', 2, 'the points are numbered or written as a chain');
    if (lab.filter(t => REL_ORDINAL.test(t)).length >= Math.ceil(n * 0.6)) add('sequence', 2, 'the points start with step words (first, then, step 1…)');
    const dates = lab.map((t, i) => REL_DATE.exec(t) || REL_DATE.exec(det[i])).map(m => m ? parseInt(String(m[0]).replace(/\D/g, '').slice(-4), 10) : null), dd = dates.filter(x => x);
    if (dd.length >= Math.ceil(n * 0.6) && dd.every((x, i) => !i || x >= dd[i - 1])) add('timeline', 3, 'the points carry dates in order');
    const proc = /\b(steps?|stages?|phases?|process|workflow|procedure|pipeline|how to|lifecycle|life cycle)\b/i.exec(head);
    if (proc) add('sequence', 1, `the title says “${proc[0]}”`);
    // cycle: said about the set, or the last point leads back to the first
    // "iterative" / "then repeat" only where the sentence lists the points themselves ("is iterative: collect, train, …")
    // every cue found, the strongest first ("lifecycle" alone names stages; it does not say they return)
    const allOf = (re, t) => [...t.matchAll(re)];
    const cues = allOf(/\b(cycle|cyclical|cyclic|life ?cycle|loops? back|feedback loop|iterative (?:process|cycle|loop)|repeats? (?:the|this|these|from)|repeated (?:until|for)|back to (?:the )?(?:start|beginning|first (?:step|stage|phase))|starts? (?:over|again)|pdca|plan[, ]+do[, ]+check[, ]+act)\b/gi, scope)
      .concat(allOf(/\b(iterative|(?:then|and) repeat(?:s|ed)?)\b/gi, listParts.join('\n').replace(REL_NOT, ' ')));
    const cyc = cues.find(m => !/life ?cycle/i.test(m[0])) || cues[0] || null;
    if (cyc && n <= 8) add('cycle', /life ?cycle/i.test(cyc[0]) ? 1 : 3, `the text says “${cyc[0].trim()}”`);
    const lastT = (lab[n - 1] + ' ' + det[n - 1]).toLowerCase(), firstW = relWords(lab[0])[0];
    if (n <= 8 && /\b(repeat|again|back to|loop back|restart|next cycle|next iteration)\b/.test(lastT) && (!firstW || lastT.includes(firstW) || /\b(repeat|next cycle|next iteration)\b/.test(lastT)))
      add('cycle', 3, 'the last point leads back to the start');
    // funnel: said about the set, the AIDA stages, or counts that narrow stage by stage
    const fun = /\b(funnel|narrows? (?:down|to)|narrowing|shortlist(?:ed|ing)?|conversion (?:funnel|stages?)|filters? down)\b/i.exec(scope);
    if (fun && n <= 6) add('funnel', 3, `the text says “${fun[0]}”`);
    if (n <= 6 && /\bawareness\b[\s\S]*\binterest\b[\s\S]*\b(desire|decision|consideration)\b[\s\S]*\b(action|purchase|conversion)\b/i.test(lab.join('\n'))) add('funnel', 3, 'the points are the AIDA stages');
    const nums = lab.map((t, i) => relNum(t) != null ? relNum(t) : relNum(det[i]));
    if (n <= 6 && fun && nums.every(x => x != null) && nums.every((x, i) => !i || x < nums[i - 1])) add('funnel', 1, 'the counts get smaller stage by stage');
    // layers: levels or tiers said about the set, or points named Level 1 / Tier 2…
    const lay = /\b(hierarch(?:y|ies|ical)|pyramid|maslow|(?:\d+|two|three|four|five|six) (?:levels|layers|tiers)\b|levels? of (?:the |a )?(?:hierarchy|pyramid|needs|maturity)|tiered|from the (?:base|bottom) (?:to|up to) the top|foundation(?:al)? (?:layer|level))/i.exec(scope);
    if (lay && n <= 6) add('layers', 3, `the text says “${lay[0]}”`);
    if (n <= 6 && lab.filter(t => REL_LEVEL.test(t)).length >= n - 1) add('layers', 3, 'the points are named by level');
  }
  const score = k => ev[k].reduce((a, x) => a + x.w, 0);
  // a stated shape (comparison, cycle, funnel, levels, timeline) wins over a plain sequence: a cycle is ordered as well
  const pick = ['comparison', 'cycle', 'funnel', 'layers', 'timeline'].filter(k => score(k) >= 2).sort((a, b) => score(b) - score(a))[0] || (score('sequence') >= 2 ? 'sequence' : '');
  // a cycle, a funnel or a timeline keeps the order; levels keep it only when it was given
  const ordered = (!!pick && !/^(comparison|layers)$/.test(pick)) || score('sequence') >= 2;
  return { relation: pick, ordered, why: pick ? ev[pick].map(x => x.why).join('; ') : '',
    evidence: Object.entries(ev).filter(([, v]) => v.length).map(([k, v]) => `${k}: ${v.map(x => x.why).join('; ')}`) };
}
/* 10.21 interface (kept): the relation only, from the whole text (first line its title) and the section names. */
function planTextRelation(text, n, groupNames) {
  const lines = String(text || '').split(/\n+/).map(t => t.trim()).filter(Boolean);
  const r = planRelation({ title: lines[0] || '', full: lines.slice(1).join('\n'), items: lines.slice(1).slice(-Math.max(0, n)).map(t => ({ label: t.replace(/^[-*•\d.)\s]+/, '') })), groups: groupNames || [] });
  return /^(comparison|funnel|cycle|layers)$/.test(r.relation) ? r.relation : '';
}
/* A plan from a list of points (built-in suggestions, edits): the same semantics as every other plan. */
function planFromItems(title, points, ordered) {
  const items = points.map((p, i) => ({ id: 'p' + i, label: planClean(p.label), detail: planClean(p.detail || ''), group: '' })).filter(i => i.label);
  planIcons(items);
  return planSemantics({ title: title || '', relation: ordered ? 'sequence' : 'independent', items, groups: [], flow: ordered ? items.map(i => i.id) : [], layouts: [], from: 'text' });
}
