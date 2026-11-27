/* SL Editor design pack "library" 10.26.0 - the built-in infographic library: 3,000 designs in the brand standard.
   25 layouts (the structures of professional infographic catalogues: columns, rows, zigzag, stairs, timeline, hub,
   tree, chevrons, arrows, ladder, spine, pyramid, funnel, header tabs, quadrants, bands, milestones, icon strip, side
   cards, top cards, loop, target, speech bubbles, cascade, two-column cards) x 120 variants of each:
     holder  disc | ring | rounded square | hexagon | diamond      (what carries the point's icon or number)
     card    none | soft tint | coloured frame | panel with accent bar
     mark    icon | number | icon with a number tag               (numbers only for steps in a stated order)
     tone    one colour per point | one colour for all
   Drawn here, from the text's own plan (no picture, no download): every key lib_<layout>_<0..119> is a family of its own
   (hidden from planCandidates; orchestrator.js engine "library" offers them, a round of layouts at a time, so "More
   visuals" keeps giving new designs). The same rules as every family (packs/README.txt): every label and description
   at 22 pt and up, approved colours, Open Sans, native editable shapes only, no outline-only shapes, and only the
   relationships the content states (arrows, lines, numbers, levels and loops only when the plan has them). */
const LIB = { layouts: [], variants: [], key: (L, v) => `lib_${L}_${v}` };
registerPack('library', '10.26.0', () => {
  const W = '#FFFFFF', PANEL = '#F2F2F2', DARK = '#404040', FLOOR_LIB = '#D9D9D9';
  const HOLD = ['disc', 'ring', 'square', 'hex', 'diamond'], CARD = ['none', 'tint', 'frame', 'bar'], MARK = ['icon', 'num', 'both'], TONE = ['multi', 'mono'];
  const HOLDN = { disc: 'discs', ring: 'rings', square: 'rounded squares', hex: 'hexagons', diamond: 'diamonds' };
  const CARDN = { none: 'open', tint: 'soft cards', frame: 'framed cards', bar: 'accent-bar cards' };
  // variant order: the first variants of a layout differ most from each other (holder, card, mark and tone all change)
  for (let i = 0; i < 120; i++) LIB.variants.push({ h: HOLD[i % 5], c: CARD[(i + Math.floor(i / 5)) % 4], m: MARK[Math.floor(i / 20) % 3], t: TONE[Math.floor(i / 60) % 2] });
  const vname = v => `${HOLDN[v.h]}, ${CARDN[v.c]}${v.m === 'num' ? ', numbered' : v.m === 'both' ? ', icons and numbers' : ''}${v.t === 'mono' ? ', one colour' : ''}`;

  /* ---------- shared pieces ---------- */
  const ordered = P => typeof planSeq === 'function' && planSeq(P);
  const flat = P => !planGroups(P).length;
  const rel = P => String(P.relation || '');
  const leveled = P => /layers|hierarchy/.test(rel(P));
  const textH = (it, tw, s) => planTH(it.label, tw, s) + (it.detail ? planTH(it.detail, tw, PLAN_DS) - 6 : 0);
  const fits = (it, tw, s, maxL) => tw > 90 && planWords(it.label, tw, s) && linesAt(it.label, tw, s) <= maxL && (!it.detail || planWords(it.detail, tw, PLAN_DS));
  const allFit = (P, tw, s, maxL) => P.items.every(it => fits(it, tw, s, maxL || 3));
  const maxTH = (P, tw, s) => Math.max(...P.items.map(it => textH(it, tw, s)));
  function words(it, x, y, tw, s, out, al) {
    const lh = planTH(it.label, tw, s);
    out.push(label(x, y, tw, lh, it.label, { size: s, bold: true, color: INK, align: al || 'center', valign: 'top' }));
    if (it.detail) out.push(label(x, y + lh - 6, tw, planTH(it.detail, tw, PLAN_DS), it.detail, { size: PLAN_DS, color: INK, align: al || 'center', valign: 'top' }));
  }
  function heading(P, R, out) {
    const t = String(P.title || '').trim();
    if (!t || !planWords(t, R.w, 24) || linesAt(t, R.w * 0.95, 24) > 2) return 0;
    const h = planLH(t, R.w, 24);
    out.push(label(R.x, R.y, R.w, h, t, { size: 24, bold: true, color: INK, align: 'left', valign: 'top' }));
    return h + 6;
  }
  const topic = P => { const t = String(P.title || '').trim(); return t && t.split(/\s+/).length <= 8 ? t : ''; };
  let C0 = 0, GP = '';          // a section's colour and group prefix while sectioned content is drawn (groupBuild)
  const col = (i, v) => accent((v.t === 'mono' ? 0 : i) + C0);
  const num = i => (typeof planN === 'function' ? planN(i) : String(i + 1));
  /* the card behind a point (geo: its shape) */
  function card(r, c, v, geo) {
    geo = geo || 'roundRect';
    switch (v.c) {
      case 'tint': return [box(geo, r.x, r.y, r.w, r.h, { fill: tint(c, SOFT_T) })];
      case 'frame': return [box(geo, r.x, r.y, r.w, r.h, { fill: c }), box(geo, r.x + 2, r.y + 2, r.w - 4, r.h - 4, { fill: W })];
      case 'bar': return [box(geo === 'roundRect' ? 'rect' : geo, r.x, r.y, r.w, r.h, { fill: PANEL }),
        r.bar === 'top' || geo !== 'roundRect' ? box('rect', r.x + (geo === 'roundRect' ? 0 : 14), r.y, r.w - (geo === 'roundRect' ? 0 : 28), 6, { fill: c }) : box('rect', r.x, r.y, 6, r.h, { fill: c })];
      default: return geo === 'roundRect' ? [] : [box(geo, r.x, r.y, r.w, r.h, { fill: PANEL })];
    }
  }
  /* the holder: the point's icon (white on colour, or colour on white for rings and light grounds) or its number */
  const GEO = { disc: 'ellipse', ring: 'ellipse', square: 'roundRect', hex: 'hexagon', diamond: 'diamond' };
  function holder(key, i, x, y, D, c, v, g, onColour) {
    const out = [], geo = GEO[v.h], light = onColour || v.h === 'ring';
    const H = v.h === 'hex' ? D * 0.88 : D, Y = y + (D - H) / 2;
    out.push(box(geo, x, Y, D, H, { fill: onColour ? W : c, grp: g }));
    if (v.h === 'ring') { const k = D * 0.13; out.push(box('ellipse', x + k, y + k, D - 2 * k, D - 2 * k, { fill: onColour ? c : W, grp: g })); }
    const ink = v.h === 'ring' && onColour ? W : light ? c : W;
    if (v.m === 'num') {
      const top = out[out.length - 1];
      Object.assign(top, { text: num(i), size: D >= 60 ? 28 : 22, bold: true, color: v.h === 'ring' && !onColour ? DARK : light ? DARK : textOn(c), align: 'center', valign: 'middle' });
    } else {
      const f = v.h === 'diamond' ? 0.5 : v.h === 'ring' ? 0.5 : 0.62, s = D * f;
      const inv = q => (q && String(q).toUpperCase() === W ? c : q ? W : q);
      comp(key || 'none', x + (D - s) / 2, y + (D - s) / 2, s, c).forEach(p => {
        const q = Object.assign({}, p, { grp: g });
        if (ink === W) { if (q.fill) q.fill = inv(q.fill); if (q.line) q.line = inv(q.line); if (q.t === 'line' && q.color) q.color = inv(q.color); }
        out.push(q);
      });
      if (v.m === 'both') out.push(box('roundRect', x + D - 12, y - 10, 36, 30, { fill: DARK, text: num(i), size: 22, bold: true, color: W, align: 'center', valign: 'middle', grp: g }));
    }
    return out;
  }
  /* one point: card, holder, words (slot: hx, hy, D, tx, ty, tw, al, card {x, y, w, h, bar}, geo, onColour) */
  function point(P, i, sl, v, o, out) {
    const it = P.items[i], c = col(i, v), g = GP + 'lb' + i, parts = [];
    if (sl.card) parts.push(...card(sl.card, c, v, sl.geo));
    if (sl.D) parts.push(...holder(it.icon, i, sl.hx, sl.hy, sl.D, c, v, g, sl.onColour));
    words(it, sl.tx, sl.ty, sl.tw, o.s, parts, sl.al);
    out.push(...planGrp(parts, g, it.label));
  }
  const lift = v => (v.m === 'both' ? 12 : 0);
  const conn = (x1, y1, x2, y2) => seg(x1, y1, x2, y2, CONNECTOR, 2);
  const arrowR = (x, y, h) => box('rightArrow', x, y - h / 2, 26, h, { fill: CONNECTOR });

  /* ---------- the 25 layouts: (P, R, o, v) -> primitives, or planNo(why) ---------- */
  const L = {};
  // 1. icon columns: holder over the words, one card per column
  L.cols = { name: 'Icon columns', cat: 'List', n: [2, 6], build(P, R, o, v) {
    const out = [], n = P.items.length, gap = n >= 5 ? 12 : 18, cw = (R.w - gap * (n - 1)) / n, tw = cw - 2 * o.pad;
    if (!allFit(P, tw, o.s)) return planNo('a point does not fit its column');
    const top = R.y + heading(P, R, out) + lift(v), ch = o.pad + 4 + o.D + 10 + maxTH(P, tw, o.s) + o.pad;
    if (top + ch > R.y + R.h) return planNo('the columns do not fit the height');
    const y = top + Math.max(0, (R.y + R.h - top - ch) / 2);
    P.items.forEach((it, i) => { const x = R.x + i * (cw + gap);
      point(P, i, { card: { x, y, w: cw, h: ch, bar: 'top' }, hx: x + (cw - o.D) / 2, hy: y + o.pad + 4, D: o.D, tx: x + o.pad, ty: y + o.pad + 4 + o.D + 10, tw }, v, o, out); });
    return out; } };
  // 2. icon rows: one full-width row per point, holder at the left
  L.rows = { name: 'Icon rows', cat: 'List', n: [2, 6], build(P, R, o, v) {
    const out = [], n = P.items.length, top = R.y + heading(P, R, out) + lift(v), gap = 10, tx0 = o.pad + 8 + o.D + 18 + (v.m === 'both' ? 14 : 0), tw = R.w - tx0 - o.pad;
    if (!allFit(P, tw, o.s, 2)) return planNo('a point does not fit its row');
    const hs = P.items.map(it => Math.max(o.D, textH(it, tw, o.s)) + 2 * o.pad - 8), total = hs.reduce((a, b) => a + b, 0) + gap * (n - 1);
    if (top + total > R.y + R.h) return planNo('the rows do not fit the height');
    let y = top;
    P.items.forEach((it, i) => { const h = hs[i];
      point(P, i, { card: { x: R.x, y, w: R.w, h, bar: 'left' }, hx: R.x + o.pad + 8, hy: y + (h - o.D) / 2, D: o.D, tx: R.x + tx0, ty: y + (h - textH(it, tw, o.s)) / 2 + 2, tw, al: 'left' }, v, o, out);
      y += h + gap; });
    return out; } };
  // 3. two columns of horizontal cards
  L.grid = { name: 'Two-column cards', cat: 'List', n: [4, 8], build(P, R, o, v) {
    const out = [], n = P.items.length, gap = 14, cw = (R.w - gap) / 2, top = R.y + heading(P, R, out) + lift(v), tx0 = o.pad + 6 + o.D + 14 + (v.m === 'both' ? 14 : 0), tw = cw - tx0 - o.pad;
    if (!allFit(P, tw, o.s, 3)) return planNo('a point does not fit its card');
    const nr = Math.ceil(n / 2), rh = Math.max(o.D, maxTH(P, tw, o.s)) + 2 * o.pad - 6, total = nr * rh + (nr - 1) * 12;
    if (top + total > R.y + R.h) return planNo('the cards do not fit the height');
    const y0 = top + Math.max(0, (R.y + R.h - top - total) / 2);
    P.items.forEach((it, i) => { const x = R.x + (i % 2) * (cw + gap), y = y0 + Math.floor(i / 2) * (rh + 12);
      point(P, i, { card: { x, y, w: cw, h: rh, bar: 'left' }, hx: x + o.pad + 6, hy: y + (rh - o.D) / 2, D: o.D, tx: x + tx0, ty: y + (rh - textH(it, tw, o.s)) / 2 + 2, tw, al: 'left' }, v, o, out); });
    return out; } };
  // 4. zigzag: holders on one axis, the words above and below in turn (the axis is a line only for an order)
  L.zigzag = { name: 'Zigzag', cat: 'Process', n: [3, 6], build(P, R, o, v) {
    const out = [], n = P.items.length, cw = R.w / n, tw = Math.min(cw * 1.55, R.w / 2 - 12) - 2 * o.pad;
    if (!allFit(P, tw, o.s, 3)) return planNo('a point does not fit beside its neighbours');
    const top = R.y + heading(P, R, out), up = P.items.filter((_, i) => i % 2 === 0), dn = P.items.filter((_, i) => i % 2);
    const hu = Math.max(...up.map(it => textH(it, tw, o.s))) + 2 * o.pad, hd = dn.length ? Math.max(...dn.map(it => textH(it, tw, o.s))) + 2 * o.pad : 0;
    const total = hu + 12 + lift(v) + o.D + 12 + hd;
    if (top + total > R.y + R.h) return planNo('the zigzag does not fit the height');
    const y0 = top + Math.max(0, (R.y + R.h - top - total) / 2), ay = y0 + hu + 12 + lift(v) + o.D / 2;
    if (ordered(P)) out.push(conn(R.x + cw / 2, ay, R.x + R.w - cw / 2, ay));
    P.items.forEach((it, i) => { const cx = R.x + cw * (i + 0.5), x = Math.max(R.x, Math.min(R.x + R.w - tw - 2 * o.pad, cx - tw / 2 - o.pad)), upper = i % 2 === 0;
      const ch = (upper ? hu : hd), cy = upper ? y0 : ay + o.D / 2 + 12;
      point(P, i, { card: { x, y: cy, w: tw + 2 * o.pad, h: ch, bar: 'top' }, hx: cx - o.D / 2, hy: ay - o.D / 2, D: o.D, tx: x + o.pad, ty: cy + o.pad, tw }, v, o, out); });
    return out; } };
  // 5. stairs: columns rising step by step (an order or rising levels)
  L.stairs = { name: 'Rising stairs', cat: 'Process', n: [3, 6], why: P => (ordered(P) || leveled(P) ? '' : 'only for steps in a stated order or rising levels'), build(P, R, o, v) {
    const out = [], n = P.items.length, gap = 10, cw = (R.w - gap * (n - 1)) / n, tw = cw - 2 * o.pad;
    if (!allFit(P, tw, o.s, 3)) return planNo('a point does not fit its step');
    const top = R.y + heading(P, R, out) + lift(v), bh = o.pad + o.D + 10 + maxTH(P, tw, o.s) + o.pad, step = Math.min(44, (R.y + R.h - top - bh) / Math.max(1, n - 1));
    if (step < 18) return planNo('no room for the steps');
    const base = R.y + R.h;
    P.items.forEach((it, i) => { const x = R.x + i * (cw + gap), y = base - bh - step * i;
      point(P, i, { card: { x, y, w: cw, h: base - y, bar: 'top' }, hx: x + (cw - o.D) / 2, hy: y + o.pad, D: o.D, tx: x + o.pad, ty: y + o.pad + o.D + 10, tw }, v, o, out); });
    return out; } };
  // 6. timeline: holders on a line, the words under each (an order)
  L.timeline = { name: 'Icon timeline', cat: 'Process', n: [3, 6], why: P => (ordered(P) ? '' : 'only for steps in a stated order'), build(P, R, o, v) {
    const out = [], n = P.items.length, gap = 12, cw = (R.w - gap * (n - 1)) / n, tw = cw - 2 * o.pad;
    if (!allFit(P, tw, o.s)) return planNo('a step does not fit under the line');
    const top = R.y + heading(P, R, out) + lift(v), th = maxTH(P, tw, o.s), total = o.D + 16 + th + 2 * o.pad;
    if (top + total > R.y + R.h) return planNo('the timeline does not fit the height');
    const y0 = top + Math.max(0, (R.y + R.h - top - total) / 2), ay = y0 + o.D / 2;
    out.push(box('rect', R.x, ay - 3, R.w, 6, { fill: tint(accent(0), 0.5) }));
    P.items.forEach((it, i) => { const x = R.x + i * (cw + gap), cy = y0 + o.D + 16;
      point(P, i, { card: { x, y: cy, w: cw, h: th + 2 * o.pad, bar: 'top' }, hx: x + (cw - o.D) / 2, hy: y0, D: o.D, tx: x + o.pad, ty: cy + o.pad, tw }, v, o, out); });
    return out; } };
  // 7. hub: the topic in the centre, the points on both sides
  L.hub = { name: 'Topic hub', cat: 'Concept', n: [2, 6], why: P => (topic(P) ? '' : 'needs the topic for its centre'), build(P, R, o, v) {
    const out = [], n = P.items.length, t = topic(P), Dc = Math.min(210, R.h - 10), side = (R.w - Dc - 60) / 2, tx0 = o.D + 14 + (v.m === 'both' ? 14 : 0), tw = side - tx0 - o.pad;
    const tr = textRect('ellipse', 0, 0, Dc, Dc);
    if (!planWords(t, tr.w, 24) || linesAt(t, tr.w, 24) > 3) return planNo('the topic does not fit the centre');
    if (!allFit(P, tw, o.s, 3)) return planNo('a point does not fit beside the centre');
    const L2 = P.items.slice(0, Math.ceil(n / 2)), R2 = P.items.slice(Math.ceil(n / 2));
    const hOf = list => list.reduce((a, it) => a + Math.max(o.D, textH(it, tw, o.s)) + 2 * o.pad - 6, 0) + 12 * (list.length - 1);
    const H = Math.max(hOf(L2), hOf(R2), Dc);
    if (H > R.h) return planNo('the points do not fit the height');
    const y0 = R.y + (R.h - H) / 2, cx = R.x + R.w / 2, cy = y0 + H / 2;
    const place = (list, start, left) => { let y = y0 + (H - hOf(list)) / 2;
      list.forEach((it, k) => { const i = start + k, h = Math.max(o.D, textH(it, tw, o.s)) + 2 * o.pad - 6, x = left ? R.x : cx + Dc / 2 + 30, w = side;
        const hx = left ? x + w - o.pad - o.D : x + o.pad, hy = y + (h - o.D) / 2;
        const dy = hy + o.D / 2 - cy, r = Dc / 2, ex = Math.abs(dy) < r - 8 ? Math.sqrt(r * r - dy * dy) : 0;
        if (ex) out.push(conn(left ? hx + o.D : cx + ex, hy + o.D / 2, left ? cx - ex : hx, hy + o.D / 2));
        point(P, i, { card: { x, y, w, h, bar: 'left' }, hx, hy, D: o.D, tx: left ? x + o.pad : hx + tx0, ty: y + (h - textH(it, tw, o.s)) / 2 + 2, tw, al: left ? 'right' : 'left' }, v, o, out);
        y += h + 12; }); };
    place(L2, 0, true); place(R2, L2.length, false);
    const c0 = accent(v.t === 'mono' ? 0 : 6);
    out.push(box('ellipse', cx - Dc / 2, cy - Dc / 2, Dc, Dc, { fill: c0, text: t, size: 24, bold: true, color: textOn(c0), align: 'center', valign: 'middle', grp: 'centre' }));
    return out; } };
  // 8. tree: the topic above, the points below it
  L.tree = { name: 'Topic tree', cat: 'Hierarchy', n: [2, 5], why: P => (topic(P) ? '' : 'needs the topic for its top'), build(P, R, o, v) {
    const out = [], n = P.items.length, t = topic(P), gap = 16, cw = (R.w - gap * (n - 1)) / n, tw = cw - 2 * o.pad;
    if (!planWords(t, 460, 24) || linesAt(t, 460, 24) > 2) return planNo('the topic does not fit its box');
    if (!allFit(P, tw, o.s)) return planNo('a point does not fit its column');
    const th0 = planLH(t, 460, 24) + 16, ch = o.pad + o.D + 10 + maxTH(P, tw, o.s) + o.pad + lift(v), total = th0 + 40 + ch;
    if (total > R.h) return planNo('the tree does not fit the height');
    const y0 = R.y + (R.h - total) / 2, cx = R.x + R.w / 2, by = y0 + th0 + 20, c0 = accent(v.t === 'mono' ? 0 : 6);
    out.push(box('roundRect', cx - 240, y0, 480, th0, { fill: c0, text: t, size: 24, bold: true, color: textOn(c0), align: 'center', valign: 'middle', grp: 'top' }));
    out.push(conn(cx, y0 + th0, cx, by), conn(R.x + cw / 2, by, R.x + R.w - cw / 2, by));
    P.items.forEach((it, i) => { const x = R.x + i * (cw + gap), y = by + 20;
      out.push(conn(x + cw / 2, by, x + cw / 2, y));
      point(P, i, { card: { x, y, w: cw, h: ch, bar: 'top' }, hx: x + (cw - o.D) / 2, hy: y + o.pad + lift(v), D: o.D, tx: x + o.pad, ty: y + o.pad + lift(v) + o.D + 10, tw }, v, o, out); });
    return out; } };
  // 9. chevrons: a band of chevrons carrying the holders, the words under each (an order)
  L.chevrons = { name: 'Chevron band', cat: 'Process', n: [3, 6], why: P => (ordered(P) ? '' : 'only for steps in a stated order'), build(P, R, o, v) {
    const out = [], n = P.items.length, cw = R.w / n, tw = cw - 2 * o.pad - 6;
    if (!allFit(P, tw, o.s)) return planNo('a step does not fit under its chevron');
    const top = R.y + heading(P, R, out) + lift(v), bh = o.D + 20, th = maxTH(P, tw, o.s), total = bh + 12 + th + 2 * o.pad;
    if (top + total > R.y + R.h) return planNo('the chevrons do not fit the height');
    const y0 = top + Math.max(0, (R.y + R.h - top - total) / 2);
    P.items.forEach((it, i) => { const x = R.x + i * cw, c = col(i, v);
      out.push(box(i ? 'chevron' : 'homePlate', x, y0, cw + (i < n - 1 ? 14 : 0), bh, { fill: c, grp: 'lb' + i }));
      point(P, i, { card: { x: x + 3, y: y0 + bh + 12, w: cw - 6, h: th + 2 * o.pad, bar: 'top' }, hx: x + (cw - o.D) / 2 + (i ? 8 : 0), hy: y0 + 10, D: o.D, onColour: true, tx: x + o.pad + 3, ty: y0 + bh + 12 + o.pad, tw }, v, o, out); });
    return out; } };
  // 10. cards joined by arrows (an order)
  L.arrows = { name: 'Cards with arrows', cat: 'Process', n: [3, 5], why: P => (ordered(P) ? '' : 'only for steps in a stated order'), build(P, R, o, v) {
    const out = [], n = P.items.length, aw = 26, gap = aw + 14, cw = (R.w - gap * (n - 1)) / n, tw = cw - 2 * o.pad;
    if (!allFit(P, tw, o.s)) return planNo('a step does not fit its card');
    const top = R.y + heading(P, R, out) + lift(v), ch = o.pad + o.D + 10 + maxTH(P, tw, o.s) + o.pad;
    if (top + ch > R.y + R.h) return planNo('the cards do not fit the height');
    const y = top + Math.max(0, (R.y + R.h - top - ch) / 2);
    P.items.forEach((it, i) => { const x = R.x + i * (cw + gap);
      point(P, i, { card: { x, y, w: cw, h: ch, bar: 'top' }, hx: x + (cw - o.D) / 2, hy: y + o.pad, D: o.D, tx: x + o.pad, ty: y + o.pad + o.D + 10, tw }, v, o, out);
      if (i < n - 1) out.push(arrowR(x + cw + 7, y + ch / 2, 26)); });
    return out; } };
  // 11. ladder: a vertical line of holders, the words beside them (the line only for an order)
  L.ladder = { name: 'Vertical steps', cat: 'Process', n: [3, 6], build(P, R, o, v) {
    const out = [], n = P.items.length, top = R.y + heading(P, R, out) + lift(v), x0 = R.x + 4, tx0 = o.D + 22 + (v.m === 'both' ? 14 : 0), tw = R.w - tx0 - 2 * o.pad - 4;
    if (!allFit(P, tw, o.s, 2)) return planNo('a point does not fit its row');
    const hs = P.items.map(it => Math.max(o.D, textH(it, tw, o.s) + 2 * o.pad - 8)), total = hs.reduce((a, b) => a + b, 0) + 10 * (n - 1);
    if (top + total > R.y + R.h) return planNo('the steps do not fit the height');
    if (ordered(P)) out.push(conn(x0 + o.D / 2, top + hs[0] / 2, x0 + o.D / 2, top + total - hs[n - 1] / 2));
    let y = top;
    P.items.forEach((it, i) => { const h = hs[i];
      point(P, i, { card: { x: x0 + tx0 - 10, y, w: R.x + R.w - (x0 + tx0 - 10), h, bar: 'left' }, hx: x0, hy: y + (h - o.D) / 2, D: o.D, tx: x0 + tx0 + o.pad - 4, ty: y + (h - textH(it, tw, o.s)) / 2 + 2, tw, al: 'left' }, v, o, out);
      y += h + 10; });
    return out; } };
  // 12. spine: holders on a centre line, the words left and right in turn
  L.spine = { name: 'Centre spine', cat: 'Process', n: [3, 8], build(P, R, o, v) {
    const out = [], n = P.items.length, top = R.y + heading(P, R, out) + lift(v), cx = R.x + R.w / 2, tw = R.w / 2 - o.D / 2 - 24 - 2 * o.pad;
    if (!allFit(P, tw, o.s, 2)) return planNo('a point does not fit beside the spine');
    const rh = Math.max(o.D, maxTH(P, tw, o.s) + 2 * o.pad - 8), step = Math.max(rh / 2 + 8, o.D + 10), total = step * (n - 1) + rh;
    if (top + total > R.y + R.h) return planNo('the spine does not fit the height');
    const y0 = top + Math.max(0, (R.y + R.h - top - total) / 2);
    out.push(ordered(P) ? conn(cx, y0 + rh / 2, cx, y0 + total - rh / 2) : box('rect', cx - 2, y0, 4, total, { fill: FLOOR_LIB }));
    P.items.forEach((it, i) => { const y = y0 + i * step, left = i % 2 === 0, w = R.w / 2 - o.D / 2 - 18, x = left ? R.x : cx + o.D / 2 + 18;
      point(P, i, { card: { x, y, w, h: rh, bar: 'left' }, hx: cx - o.D / 2, hy: y + (rh - o.D) / 2, D: o.D, tx: x + o.pad, ty: y + (rh - textH(it, tw, o.s)) / 2 + 2, tw, al: left ? 'right' : 'left' }, v, o, out); });
    return out; } };
  // 13. pyramid: levels from the top, the words beside each (levels or an order)
  L.pyramid = { name: 'Pyramid levels', cat: 'Hierarchy', n: [3, 5], why: P => (leveled(P) || ordered(P) ? '' : 'only for levels or steps in a stated order'), build(P, R, o, v) {
    const out = [], n = P.items.length, top = R.y + heading(P, R, out), pw = Math.min(380, R.w * 0.36), tx = R.x + pw + 24, tw = R.x + R.w - tx - 2 * o.pad;
    if (!allFit(P, tw, o.s, 2)) return planNo('a level does not fit beside the pyramid');
    const lh = Math.max(o.D + 12, maxTH(P, tw, o.s) + 2 * o.pad - 8), total = n * lh + (n - 1) * 6;
    if (top + total > R.y + R.h) return planNo('the pyramid does not fit the height');
    const y0 = top + Math.max(0, (R.y + R.h - top - total) / 2), cx = R.x + pw / 2;
    P.items.forEach((it, i) => { const y = y0 + i * (lh + 6), w0 = pw * (0.22 + 0.78 * i / n), w1 = pw * (0.22 + 0.78 * (i + 1) / n), c = col(i, v);
      out.push(i === 0 ? box('triangle', cx - w1 / 2, y, w1, lh, { fill: c, grp: 'lb' + i }) : box('trapezoid', cx - w1 / 2, y, w1, lh, { fill: c, grp: 'lb' + i }));
      const D = Math.min(o.D, lh - 12);
      point(P, i, { card: { x: tx - 8, y, w: R.x + R.w - tx + 8, h: lh, bar: 'left' }, hx: cx - D / 2, hy: y + lh - D - 4, D: i === 0 ? 0 : D, onColour: true, tx: tx + o.pad - 6, ty: y + (lh - textH(it, tw, o.s)) / 2 + 2, tw, al: 'left' }, v, o, out); });
    return out; } };
  // 14. funnel: bars narrowing downwards, the words beside each (a funnel or an order)
  L.funnel = { name: 'Funnel bars', cat: 'Process', n: [3, 5], why: P => (rel(P) === 'funnel' || ordered(P) ? '' : 'only for a funnel or steps in a stated order'), build(P, R, o, v) {
    const out = [], n = P.items.length, top = R.y + heading(P, R, out), fw = Math.min(420, R.w * 0.4), tx = R.x + fw + 24, tw = R.x + R.w - tx - 2 * o.pad;
    if (!allFit(P, tw, o.s, 2)) return planNo('a stage does not fit beside the funnel');
    const lh = Math.max(o.D + 12, maxTH(P, tw, o.s) + 2 * o.pad - 8), total = n * lh + (n - 1) * 8;
    if (top + total > R.y + R.h) return planNo('the funnel does not fit the height');
    const y0 = top + Math.max(0, (R.y + R.h - top - total) / 2), cx = R.x + fw / 2;
    P.items.forEach((it, i) => { const y = y0 + i * (lh + 8), w = fw * (1 - 0.55 * i / Math.max(1, n - 1)), c = col(i, v), D = Math.min(o.D, lh - 12);
      out.push(box('roundRect', cx - w / 2, y, w, lh, { fill: c, grp: 'lb' + i }));
      point(P, i, { card: { x: tx - 8, y, w: R.x + R.w - tx + 8, h: lh, bar: 'left' }, hx: cx - D / 2, hy: y + (lh - D) / 2, D, onColour: true, tx: tx + o.pad - 6, ty: y + (lh - textH(it, tw, o.s)) / 2 + 2, tw, al: 'left' }, v, o, out); });
    return out; } };
  // 15. header tabs: a coloured header band over each card
  L.tabs = { name: 'Header cards', cat: 'List', n: [2, 5], build(P, R, o, v) {
    const out = [], n = P.items.length, gap = 16, cw = (R.w - gap * (n - 1)) / n, tw = cw - 2 * o.pad;
    if (!allFit(P, tw, o.s)) return planNo('a point does not fit its card');
    const top = R.y + heading(P, R, out), hh = o.D + 20 + lift(v), ch = hh + o.pad + maxTH(P, tw, o.s) + o.pad;
    if (top + ch > R.y + R.h) return planNo('the cards do not fit the height');
    const y = top + Math.max(0, (R.y + R.h - top - ch) / 2);
    P.items.forEach((it, i) => { const x = R.x + i * (cw + gap), c = col(i, v);
      const parts = card({ x, y: y + hh, w: cw, h: ch - hh, bar: 'top' }, c, Object.assign({}, v, { c: v.c === 'none' ? 'tint' : v.c }));
      out.push(box('tab', x, y, cw, hh, { fill: c, grp: 'lb' + i }), ...parts.map(p => Object.assign(p, { grp: 'lb' + i })));
      point(P, i, { hx: x + (cw - o.D) / 2, hy: y + 10 + lift(v), D: o.D, onColour: true, tx: x + o.pad, ty: y + hh + o.pad, tw }, v, o, out); });
    return out; } };
  // 16. quadrants: four points around the topic
  L.quad = { name: 'Quadrants around the topic', cat: 'Concept', n: [4, 4], why: P => (topic(P) ? '' : 'needs the topic for its centre'), build(P, R, o, v) {
    const out = [], t = topic(P), Dc = Math.min(170, R.h * 0.45), gap = Dc * 0.55, cw = (R.w - gap) / 2, tx0 = o.D + 14 + (v.m === 'both' ? 14 : 0), tw = cw - tx0 - 2 * o.pad - Dc * 0.25;
    const tr = textRect('ellipse', 0, 0, Dc, Dc);
    if (!planWords(t, tr.w, 22) || linesAt(t, tr.w, 22) > 3) return planNo('the topic does not fit the centre');
    if (!allFit(P, tw, o.s, 3)) return planNo('a point does not fit its quadrant');
    const rh = Math.max(o.D, maxTH(P, tw, o.s)) + 2 * o.pad, total = 2 * rh + 20;
    if (total > R.h) return planNo('the quadrants do not fit the height');
    const y0 = R.y + (R.h - total) / 2, cx = R.x + R.w / 2, cy = y0 + total / 2;
    P.items.forEach((it, i) => { const left = i % 2 === 0, y = y0 + (i < 2 ? 0 : rh + 20), x = left ? R.x : cx + gap / 2;
      const hx = left ? x + cw - o.pad - o.D - Dc * 0.25 : x + o.pad + Dc * 0.25, hy = y + (rh - o.D) / 2;
      point(P, i, { card: { x, y, w: cw, h: rh, bar: 'left' }, hx, hy, D: o.D, tx: left ? x + o.pad : hx + tx0, ty: y + (rh - textH(it, tw, o.s)) / 2 + 2, tw, al: left ? 'right' : 'left' }, v, o, out); });
    const c0 = accent(v.t === 'mono' ? 0 : 6);
    out.push(box('ellipse', cx - Dc / 2, cy - Dc / 2, Dc, Dc, { fill: W, grp: 'centre' }), box('ellipse', cx - Dc / 2 + 8, cy - Dc / 2 + 8, Dc - 16, Dc - 16, { fill: c0, text: t, size: 22, bold: true, color: textOn(c0), align: 'center', valign: 'middle', grp: 'centre' }));
    return out; } };
  // 17. bands: full-width bands, the name in a column of its own and the description beside it
  L.bands = { name: 'Name and description bands', cat: 'List', n: [2, 5], why: P => (P.items.some(it => it.detail) ? '' : 'needs descriptions'), build(P, R, o, v) {
    const out = [], n = P.items.length, top = R.y + heading(P, R, out) + lift(v), nx = o.pad + 8 + o.D + 14 + (v.m === 'both' ? 14 : 0), nw = Math.min(300, R.w * 0.3), dx = nx + nw + 16, dw = R.w - dx - o.pad;
    if (!P.items.every(it => nw > 90 && planWords(it.label, nw, o.s) && linesAt(it.label, nw, o.s) <= 2 && (!it.detail || planWords(it.detail, dw, PLAN_DS)))) return planNo('a point does not fit its band');
    const hs = P.items.map(it => Math.max(o.D, planTH(it.label, nw, o.s), it.detail ? planTH(it.detail, dw, PLAN_DS) : 0) + 2 * o.pad - 8), total = hs.reduce((a, b) => a + b, 0) + 8 * (n - 1);
    if (top + total > R.y + R.h) return planNo('the bands do not fit the height');
    let y = top;
    P.items.forEach((it, i) => { const h = hs[i], c = col(i, v), g = GP + 'lb' + i, parts = [];
      parts.push(...card({ x: R.x, y, w: R.w, h, bar: 'left' }, c, v), ...holder(it.icon, i, R.x + o.pad + 8, y + (h - o.D) / 2, o.D, c, v, g));
      const lh = planTH(it.label, nw, o.s);
      parts.push(label(R.x + nx, y + (h - lh) / 2 + 2, nw, lh, it.label, { size: o.s, bold: true, color: INK, align: 'left', valign: 'top' }));
      if (it.detail) { const dh = planTH(it.detail, dw, PLAN_DS); parts.push(label(R.x + dx, y + (h - dh) / 2 + 2, dw, dh, it.detail, { size: PLAN_DS, color: INK, align: 'left', valign: 'top' })); }
      out.push(...planGrp(parts, g, it.label));
      y += h + 8; });
    return out; } };
  // 18. milestones: pins above a line, the words under it (an order)
  L.milestones = { name: 'Milestone pins', cat: 'Process', n: [3, 6], why: P => (ordered(P) ? '' : 'only for steps in a stated order'), build(P, R, o, v) {
    const out = [], n = P.items.length, gap = 12, cw = (R.w - gap * (n - 1)) / n, tw = cw - 2 * o.pad;
    if (!allFit(P, tw, o.s)) return planNo('a step does not fit under the line');
    const top = R.y + heading(P, R, out) + lift(v), th = maxTH(P, tw, o.s), total = o.D + 14 + 20 + th + 2 * o.pad;
    if (top + total > R.y + R.h) return planNo('the milestones do not fit the height');
    const y0 = top + Math.max(0, (R.y + R.h - top - total) / 2), ly = y0 + o.D + 18;
    out.push(box('rect', R.x, ly - 2, R.w, 4, { fill: CONNECTOR }));
    P.items.forEach((it, i) => { const x = R.x + i * (cw + gap), cx = x + cw / 2, c = col(i, v);
      out.push(box('merge', cx - 9, y0 + o.D + 2, 18, 12, { fill: c, grp: 'lb' + i }), box('ellipse', cx - 7, ly - 7, 14, 14, { fill: c, grp: 'lb' + i }));
      point(P, i, { card: { x, y: ly + 16, w: cw, h: th + 2 * o.pad, bar: 'top' }, hx: cx - o.D / 2, hy: y0, D: o.D, tx: x + o.pad, ty: ly + 16 + o.pad, tw }, v, o, out); });
    return out; } };
  // 19. icon strip: the holders on one band, the words under each
  L.strip = { name: 'Icon strip', cat: 'List', n: [3, 6], build(P, R, o, v) {
    const out = [], n = P.items.length, gap = 12, cw = (R.w - gap * (n - 1)) / n, tw = cw - 2 * o.pad;
    if (!allFit(P, tw, o.s)) return planNo('a point does not fit under the strip');
    const top = R.y + heading(P, R, out) + lift(v), th = maxTH(P, tw, o.s), sh = o.D + 24, total = sh + 12 + th + 2 * o.pad;
    if (top + total > R.y + R.h) return planNo('the strip does not fit the height');
    const y0 = top + Math.max(0, (R.y + R.h - top - total) / 2);
    out.push(box('roundRect', R.x, y0, R.w, sh, { fill: v.t === 'mono' ? accent(0) : PANEL, grp: 'strip' }));
    P.items.forEach((it, i) => { const x = R.x + i * (cw + gap);
      point(P, i, { card: { x, y: y0 + sh + 12, w: cw, h: th + 2 * o.pad, bar: 'top' }, hx: x + (cw - o.D) / 2, hy: y0 + 12, D: o.D, onColour: v.t === 'mono', tx: x + o.pad, ty: y0 + sh + 12 + o.pad, tw }, v, o, out); });
    return out; } };
  // 20. side cards: the holder half outside each card's left edge
  L.side = { name: 'Side-badge cards', cat: 'List', n: [2, 8], build(P, R, o, v) {
    const out = [], n = P.items.length, cols = n >= 4 ? 2 : 1, gap = 18, cw = (R.w - gap * (cols - 1)) / cols, tw = cw - o.D / 2 - 14 - 2 * o.pad - (v.m === 'both' ? 14 : 0);
    if (!allFit(P, tw, o.s, cols > 1 ? 3 : 2)) return planNo('a point does not fit its card');
    const top = R.y + heading(P, R, out) + lift(v), nr = Math.ceil(n / cols), rh = Math.max(o.D + 8, maxTH(P, tw, o.s) + 2 * o.pad - 8), total = nr * rh + (nr - 1) * 12;
    if (top + total > R.y + R.h) return planNo('the cards do not fit the height');
    const y0 = top + Math.max(0, (R.y + R.h - top - total) / 2);
    P.items.forEach((it, i) => { const x = R.x + (i % cols) * (cw + gap), y = y0 + Math.floor(i / cols) * (rh + 12), cx = x + o.D / 2;
      point(P, i, { card: { x: cx, y, w: cw - o.D / 2, h: rh, bar: 'top' }, hx: x, hy: y + (rh - o.D) / 2, D: o.D, tx: cx + o.D / 2 + 14 + (v.m === 'both' ? 14 : 0), ty: y + (rh - textH(it, tw, o.s)) / 2 + 2, tw, al: 'left' }, v, o, out); });
    return out; } };
  // 21. top-badge cards: the holder half above each card
  L.topbadge = { name: 'Top-badge cards', cat: 'List', n: [2, 5], build(P, R, o, v) {
    const out = [], n = P.items.length, gap = 18, cw = (R.w - gap * (n - 1)) / n, tw = cw - 2 * o.pad;
    if (!allFit(P, tw, o.s)) return planNo('a point does not fit its card');
    const top = R.y + heading(P, R, out) + lift(v), ch = o.D / 2 + 10 + maxTH(P, tw, o.s) + o.pad, total = o.D / 2 + ch;
    if (top + total > R.y + R.h) return planNo('the cards do not fit the height');
    const y0 = top + Math.max(0, (R.y + R.h - top - total) / 2);
    P.items.forEach((it, i) => { const x = R.x + i * (cw + gap), y = y0 + o.D / 2;
      point(P, i, { card: { x, y, w: cw, h: ch, bar: 'top' }, hx: x + (cw - o.D) / 2, hy: y0, D: o.D, tx: x + o.pad, ty: y + o.D / 2 + 10, tw }, v, o, out); });
    return out; } };
  // 22. loop: two rows joined into a loop by arrows (a cycle)
  L.loop = { name: 'Loop', cat: 'Cycle', n: [4, 6], why: P => (rel(P) !== 'cycle' ? 'only for a cycle' : P.items.length % 2 ? 'works for 4 or 6 points' : ''), build(P, R, o, v) {
    const out = [], n = P.items.length, k = Math.ceil(n / 2), ag = 40, cw = (R.w - 2 * ag - ag * (k - 1)) / k, tw = cw - o.D - 14 - 2 * o.pad + 6;
    if (!allFit(P, tw, o.s, 3)) return planNo('a point does not fit the loop');
    const top = R.y + heading(P, R, out) + lift(v), rh = Math.max(o.D, maxTH(P, tw, o.s)) + 2 * o.pad - 6, total = 2 * rh + 48;
    if (top + total > R.y + R.h) return planNo('the loop does not fit the height');
    const y0 = top + Math.max(0, (R.y + R.h - top - total) / 2);
    const at = i => i < k ? { x: R.x + ag + i * (cw + ag), y: y0 } : { x: R.x + ag + (n - 1 - i) * (cw + ag), y: y0 + rh + 48 };
    P.items.forEach((it, i) => { const p = at(i);
      point(P, i, { card: { x: p.x, y: p.y, w: cw, h: rh, bar: 'left' }, hx: p.x + o.pad, hy: p.y + (rh - o.D) / 2, D: o.D, tx: p.x + o.pad + o.D + 12, ty: p.y + (rh - textH(it, tw, o.s)) / 2 + 2, tw, al: 'left' }, v, o, out);
      if (i < k - 1) out.push(arrowR(p.x + cw + 7, p.y + rh / 2, 24));
      if (i >= k && i < n - 1) out.push(box('leftArrow', p.x - ag + 7, p.y + rh / 2 - 12, 26, 24, { fill: CONNECTOR })); });
    const last = at(k - 1), first = at(0);
    out.push(box('downArrow', last.x + cw + 8, y0 + rh / 2 - 13, 24, rh + 48 - 0, { fill: CONNECTOR }));
    out.push(box('upArrow', first.x - 32, y0 + rh / 2 - 13, 24, rh + 48, { fill: CONNECTOR }));
    return out; } };
  // 23. target: rings for the levels, the words beside them (levels)
  L.target = { name: 'Target levels', cat: 'Hierarchy', n: [3, 5], why: P => (leveled(P) ? '' : 'only for levels'), build(P, R, o, v) {
    const out = [], n = P.items.length, top = R.y + heading(P, R, out), Dt = Math.min(R.y + R.h - top, 330), tx = R.x + Dt + 30, tw = R.x + R.w - tx - o.D - 14 - 2 * o.pad - (v.m === 'both' ? 14 : 0);
    if (!allFit(P, tw, o.s, 2)) return planNo('a level does not fit beside the target');
    const rh = Math.max(o.D, maxTH(P, tw, o.s)) + 2 * o.pad - 8, total = n * rh + (n - 1) * 8;
    if (top + total > R.y + R.h || Dt < 200) return planNo('the target does not fit the height');
    const ty0 = top + Math.max(0, (R.y + R.h - top - Dt) / 2), y0 = top + Math.max(0, (R.y + R.h - top - total) / 2), cx = R.x + Dt / 2, cy = ty0 + Dt / 2;
    P.items.forEach((it, i) => { const d = Dt * (1 - i / n), c = col(i, v);
      out.push(box('ellipse', cx - d / 2, cy - d / 2, d, d, { fill: i % 2 && v.t === 'mono' ? tint(c, 0.4) : c, grp: 'lb' + i })); });
    P.items.forEach((it, i) => { const y = y0 + i * (rh + 8);
      point(P, i, { card: { x: tx - 6, y, w: R.x + R.w - tx + 6, h: rh, bar: 'left' }, hx: tx + 4, hy: y + (rh - o.D) / 2, D: o.D, tx: tx + 4 + o.D + 14 + (v.m === 'both' ? 14 : 0), ty: y + (rh - textH(it, tw, o.s)) / 2 + 2, tw, al: 'left' }, v, o, out); });
    return out; } };
  // 24. speech bubbles: the words in a bubble over each holder
  L.bubbles = { name: 'Speech bubbles', cat: 'Concept', n: [2, 4], build(P, R, o, v) {
    const out = [], n = P.items.length, gap = 22, cw = (R.w - gap * (n - 1)) / n, tw = cw - 2 * o.pad - 6;
    if (!allFit(P, tw, o.s)) return planNo('a point does not fit its bubble');
    const top = R.y + heading(P, R, out), bh = maxTH(P, tw, o.s) + 2 * o.pad + 6, total = bh + 26 + o.D + lift(v);
    if (top + total > R.y + R.h) return planNo('the bubbles do not fit the height');
    const y0 = top + Math.max(0, (R.y + R.h - top - total) / 2);
    P.items.forEach((it, i) => { const x = R.x + i * (cw + gap);
      point(P, i, { card: { x, y: y0, w: cw, h: bh, bar: 'top' }, geo: 'callout', hx: x + (cw - o.D) / 2, hy: y0 + bh + 26 + lift(v), D: o.D, tx: x + o.pad + 3, ty: y0 + o.pad, tw }, v, o, out); });
    return out; } };
  // 25. cascade: rows stepping to the right (an order)
  L.cascade = { name: 'Cascade', cat: 'Process', n: [3, 5], why: P => (ordered(P) ? '' : 'only for steps in a stated order'), build(P, R, o, v) {
    const out = [], n = P.items.length, off = Math.min(70, R.w * 0.3 / (n - 1)), w = R.w - off * (n - 1), tx0 = o.pad + 8 + o.D + 16 + (v.m === 'both' ? 14 : 0), tw = w - tx0 - o.pad;
    if (!allFit(P, tw, o.s, 2)) return planNo('a step does not fit its row');
    const top = R.y + heading(P, R, out) + lift(v), hs = P.items.map(it => Math.max(o.D, textH(it, tw, o.s)) + 2 * o.pad - 10), total = hs.reduce((a, b) => a + b, 0) + 8 * (n - 1);
    if (top + total > R.y + R.h) return planNo('the cascade does not fit the height');
    let y = top;
    P.items.forEach((it, i) => { const h = hs[i], x = R.x + i * off;
      point(P, i, { card: { x, y, w, h, bar: 'left' }, hx: x + o.pad + 8, hy: y + (h - o.D) / 2, D: o.D, tx: x + tx0, ty: y + (h - textH(it, tw, o.s)) / 2 + 2, tw, al: 'left' }, v, o, out);
      y += h + 8; });
    return out; } };

  /* ---------- sectioned content ("What you learn" / "Best for"): each section under its name, in its own colour ---------- */
  const GROUPABLE = new Set(['rows', 'ladder', 'side', 'bands', 'cascade', 'grid', 'cols', 'topbadge', 'strip', 'tabs']);
  function groupBuild(S, k, P, R, o, v) {
    const G = planGroups(P), out = [], top = R.y + heading(P, R, out), gap = 26;
    const vertical = ['rows', 'ladder', 'side', 'bands', 'cascade'].includes(k);
    const cols = vertical ? G.length : 1, cw = (R.w - gap * (cols - 1)) / cols;
    const hh = G.map(x => planTH(x.g.name, cw - 24, 24) + 6), H0 = Math.max(...hh);
    if (G.some(x => !planWords(x.g.name, cw - 24, 24) || linesAt(x.g.name, cw - 24, 24) > 2)) return planNo('a section name does not fit');
    let y = top;
    const rowH = vertical ? (R.y + R.h - top - H0 - 12) : (R.y + R.h - top - G.length * (H0 + 10)) / G.length;
    for (let gi = 0; gi < G.length; gi++) {
      const x = R.x + (vertical ? gi * (cw + gap) : 0), y0 = vertical ? top : y, c = accent(gi * 3);
      out.push(box('rect', x, y0 + H0 - 4, Math.min(120, cw), 4, { fill: c, grp: 'sec' + gi }),
        label(x, y0, cw, H0 - 6, G[gi].g.name, { size: 24, bold: true, color: INK, align: 'left', valign: 'top', grp: 'sec' + gi }));
      const sub = Object.assign({}, P, { items: G[gi].items, groups: [], title: '', statement: null, paragraph: false, sections: false });
      C0 = gi * 3; GP = 'g' + gi;
      let prims;
      try { prims = S.build(sub, { x, y: y0 + H0 + 10, w: cw, h: Math.max(60, rowH) }, o, v.t === 'multi' ? Object.assign({}, v, { t: 'mono' }) : v); }
      finally { C0 = 0; GP = ''; }
      if (!prims) return null;
      out.push(...prims);
      if (!vertical) y = Math.max(...prims.map(p => p.y + p.h)) + 14;
    }
    return out;
  }

  /* ---------- 25 x 120 = 3,000 families ---------- */
  const OPTS = [{ s: 24, D: 76, pad: 18 }, { s: 24, D: 64, pad: 16 }, { s: 22, D: 56, pad: 14 }, { s: 22, D: 48, pad: 12 }, { s: 22, D: 42, pad: 10 }];
  Object.keys(L).forEach(k => {
    const S = L[k];
    const G = P => planGroups(P);
    const why = P => !flat(P) ? (!GROUPABLE.has(k) ? 'not for grouped content' : G(P).length > 3 || !planAllGrouped(P) ? 'works for 2 or 3 sections' : G(P).some(x => x.items.length < 1 || x.items.length > 5) ? 'works for 1 to 5 points a section' : '')
      : P.items.length < S.n[0] || P.items.length > S.n[1] ? `works for ${S.n[0]} to ${S.n[1]} points` : S.why ? S.why(P) : '';
    LIB.layouts.push({ key: k, name: S.name, cat: S.cat, why });
    LIB.variants.forEach((v, vi) => {
      const key = LIB.key(k, vi);
      regPlan(key, { name: `${S.name} (${vname(v)})`, family: key, kind: S.cat === 'Process' ? 'sequence' : S.cat === 'Hierarchy' ? 'layered' : 'list', hidden: true, lib: k, sizeFirst: true, hintKey: () => k + ':' + v.h + ':' + v.m, appeal: 6,
        needs: P => why(P) || (v.m !== 'icon' && !ordered(P) ? 'numbers only for steps in a stated order' : ''),
        opts: OPTS, groups: GROUPABLE.has(k), build: (P, R, o) => (flat(P) ? S.build(P, R, o, v) : groupBuild(S, k, P, R, o, v)) });
    });
  });
});
