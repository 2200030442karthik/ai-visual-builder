/* SL Editor design pack "showcase" 10.28.0 - layouts made for the colour icons (iconlib.js, Microsoft Fluent and flat
   colour icons): the icon is the hero of every point, large, on a white disc with a ring of the point's colour.
     scspot   spotlight cards: a row of white cards, the icon disc riding on each card's top edge, an accent foot
     sczig    zigzag timeline: a line across, a disc per point on it, the points above and below in turn
     scsteps  rising steps: columns that grow left to right, the icon disc on top of each, the text inside
     scnum    numbered cards: a big pale number and the icon on each card, an accent edge (two or three columns)
     scchev   chevron ribbon: a numbered arrow band, the icons above it and the points under it
     scquad   quadrant: four cards around the topic's disc, each icon on its outer side (four points and a topic)
   Every text at 22 pt and up, Open Sans; each layout in a colour per point (_m) and in one colour (_c), offered by the
   "reference" engine (orchestrator.js) ahead of the others. Loaded after packs/lesson2-10.27.js. */
registerPack('showcase', '10.28.0', () => {
  if (typeof REF === 'undefined') return;
  const W = '#FFFFFF';
  const flat = P => !planGroups(P).length;
  const allDet = P => P.items.every(it => it.detail);
  const textH = (it, tw, s) => planLH(it.label, tw, s) + (it.detail ? planTH(it.detail, tw, PLAN_DS) - 6 : 0);
  const fits = (it, tw, s, maxL) => tw > 80 && planWords(it.label, tw, s) && linesAt(it.label, tw * 0.95, s) <= (maxL || 3) && (!it.detail || planWords(it.detail, tw, PLAN_DS));
  const allFit = (P, tw, s, maxL) => P.items.every(it => fits(it, tw, s, maxL));
  const maxTH = (P, tw, s) => Math.max(...P.items.map(it => textH(it, tw, s)));
  let MONO = false;
  const col = i => accent(MONO ? 0 : i);
  const soft = c => tint(c, 0.88), edge = c => tint(c, 0.5), deep = c => shade(c, 0.25);
  /* the point's icon: a colour icon as drawn; an outline icon or a catalogue drawing in the point's deep colour */
  const ic = (key, x, y, s, c, g) => comp(key || 'none', x, y, s, deep(c)).map(p => Object.assign(p, { grp: g }));
  /* the icon on a white disc with a ring of its colour (two filled shapes: no outline-only shape) */
  const disc = (key, cx, cy, D, c, g) => [box('ellipse', cx - D / 2, cy - D / 2, D, D, { fill: c, grp: g }),
    box('ellipse', cx - D / 2 + 4, cy - D / 2 + 4, D - 8, D - 8, { fill: W, grp: g }), ...ic(key, cx - D * 0.31, cy - D * 0.31, D * 0.62, c, g)];
  function words(it, x, y, tw, s, out, al, g) {
    const lh = planLH(it.label, tw, s);
    out.push(label(x, y, tw, lh, it.label, { size: s, bold: true, color: INK, align: al || 'center', valign: 'top', grp: g }));
    if (it.detail) out.push(label(x, y + lh - 6, tw, planTH(it.detail, tw, PLAN_DS), it.detail, { size: PLAN_DS, color: INK, align: al || 'center', valign: 'top', grp: g }));
  }
  const L = {};

  // 1. spotlight cards: the icon disc on each card's top edge, an accent foot
  L.scspot = { name: 'Spotlight icon cards', n: [2, 5], build(P, R, o) {
    const out = [], n = P.items.length, gap = n > 4 ? 18 : 26, cw = Math.min(320, (R.w - gap * (n - 1)) / n), tw = cw - 28, D = Math.min(o.D, cw * 0.5);
    if (!allFit(P, tw, o.s, 3)) return planNo('a point does not fit its card');
    const th = maxTH(P, tw, o.s), H0 = D / 2 + 16 + th + 22 + 8;
    if (D / 2 + H0 > R.h) return planNo('the cards do not fit the height');
    const H = Math.max(H0, Math.min(R.h * 0.86 - D / 2, H0 + 90)), total = D / 2 + H, ty = (H - H0) / 2;
    if (total > R.h) return planNo('the cards do not fit the height');
    const rw = n * cw + (n - 1) * gap, x0 = R.x + (R.w - rw) / 2, top = R.y + (R.h - total) / 2 + D / 2;
    P.items.forEach((it, i) => {
      const x = x0 + i * (cw + gap), c = col(i), g = 'scs' + i;
      const parts = [box('roundRect', x, top, cw, H, { fill: W, line: edge(c), lineW: 1.25, keep: true, grp: g }),
        box('rect', x + 10, top + H - 8, cw - 20, 8, { fill: c, grp: g }), ...disc(it.icon, x + cw / 2, top, D, c, g)];
      words(it, x + 14, top + D / 2 + 16 + ty, tw, o.s, parts, 'center', g);
      out.push(...planGrp(parts, g, it.label));
    });
    return out; } };

  // 2. zigzag timeline: a line across, a disc per point on it, the points above and below in turn
  L.sczig = { name: 'Zigzag icon timeline', n: [3, 6], build(P, R, o) {
    const out = [], n = P.items.length, sw = R.w / n, tw = Math.min(330, sw * 2 - 24), D = Math.min(o.D, sw * 0.62);
    if (!allFit(P, tw, o.s, 2)) return planNo('a point does not fit beside its neighbours');
    const up = P.items.filter((_, i) => i % 2 === 0), dn = P.items.filter((_, i) => i % 2 === 1);
    const hA = Math.max(...up.map(it => textH(it, tw, o.s))), hB = dn.length ? Math.max(...dn.map(it => textH(it, tw, o.s))) : 0;
    const stem = Math.max(18, Math.min(56, (R.h * 0.86 - hA - D - hB) / 2)), total = hA + stem + D + stem + hB;
    if (total > R.h) return planNo('the timeline does not fit the height');
    const y0 = R.y + (R.h - total) / 2, my = y0 + hA + stem + D / 2;
    out.push(box('rect', R.x, my - 2, R.w, 4, { fill: CONNECTOR }));
    P.items.forEach((it, i) => {
      const c = col(i), g = 'scz' + i, cx = R.x + sw * (i + 0.5), above = i % 2 === 0, th = textH(it, tw, o.s);
      const tx = Math.max(R.x, Math.min(R.x + R.w - tw, cx - tw / 2));
      const parts = [box('rect', cx - 1.5, above ? my - D / 2 - stem : my + D / 2, 3, stem, { fill: c, grp: g }), ...disc(it.icon, cx, my, D, c, g)];
      words(it, tx, above ? my - D / 2 - stem - th : my + D / 2 + stem, tw, o.s, parts, 'center', g);
      out.push(...planGrp(parts, g, it.label));
    });
    return out; } };

  // 3. rising steps: columns that grow left to right, the icon disc on top of each, the text inside
  L.scsteps = { name: 'Rising icon steps', n: [3, 5], build(P, R, o) {
    const out = [], n = P.items.length, gap = 16, cw = Math.min(270, (R.w - gap * (n - 1)) / n), tw = cw - 24, D = Math.min(o.D, cw * 0.48);
    if (!allFit(P, tw, o.s, 3)) return planNo('a point does not fit its step');
    const base = D / 2 + 14 + maxTH(P, tw, o.s) + 22, room = R.h - D / 2 - base, rise = Math.min(60, room / (n - 1));
    if (room < 0 || rise < 14) return planNo('the steps do not fit the height');
    const rw = n * cw + (n - 1) * gap, x0 = R.x + (R.w - rw) / 2, foot = R.y + (R.h + D / 2 + base + rise * (n - 1)) / 2;
    P.items.forEach((it, i) => {
      const x = x0 + i * (cw + gap), c = col(i), g = 'sct' + i, h = base + rise * i, top = foot - h;
      const parts = [box('roundRect', x, top, cw, h, { fill: soft(c), line: edge(c), lineW: 1, keep: true, grp: g }), box('rect', x + 8, top, cw - 16, 6, { fill: c, grp: g }),
        ...disc(it.icon, x + cw / 2, top, D, c, g)];
      words(it, x + 12, top + D / 2 + 14, tw, o.s, parts, 'center', g);
      out.push(...planGrp(parts, g, it.label));
    });
    return out; } };

  // 4. numbered cards: a big pale number and the icon on each card, an accent edge
  L.scnum = { name: 'Numbered icon cards', n: [2, 6], build(P, R, o) {
    const out = [], n = P.items.length, cols = n <= 3 ? n : n === 4 ? 2 : 3, rows = Math.ceil(n / cols), gap = 20, cw = Math.min(480, (R.w - gap * (cols - 1)) / cols);
    const I = o.I, tw = cw - 40, NS = 44;
    if (!allFit(P, tw, o.s, 2)) return planNo('a point does not fit its card');
    const ch0 = 16 + Math.max(I, 52) + 10 + maxTH(P, tw, o.s) + 18;
    if (rows * ch0 + (rows - 1) * gap > R.h) return planNo('the cards do not fit the height');
    const ch = Math.max(ch0, Math.min((R.h * 0.86 - (rows - 1) * gap) / rows, ch0 + 50)), total = rows * ch + (rows - 1) * gap, pad0 = (ch - ch0) / 2;
    const y0 = R.y + (R.h - total) / 2;
    P.items.forEach((it, i) => {
      const r = Math.floor(i / cols), inRow = Math.min(cols, n - r * cols), xr = R.x + (R.w - (inRow * cw + (inRow - 1) * gap)) / 2;
      const x = xr + (i % cols) * (cw + gap), y = y0 + r * (ch + gap), c = col(i), g = 'scn' + i, num = String(i + 1).padStart(2, '0');
      const parts = [box('roundRect', x, y, cw, ch, { fill: W, line: edge(c), lineW: 1.25, keep: true, grp: g }), box('rect', x, y + 10, 6, ch - 20, { fill: c, grp: g }),
        ...ic(it.icon, x + 22, y + 16 + pad0, I, c, g),
        label(x + cw - 120, y + 10 + pad0, 100, 60, num, { size: NS, bold: true, color: tint(c, 0.45), align: 'right', valign: 'top', grp: g, keep: true })];
      words(it, x + 22, y + 16 + pad0 + Math.max(I, 52) + 10, tw, o.s, parts, 'left', g);
      out.push(...planGrp(parts, g, it.label));
    });
    return out; } };

  // 5. chevron ribbon: a numbered arrow band, the icons above it and the points under it
  L.scchev = { name: 'Chevron icon ribbon', n: [3, 6], build(P, R, o) {
    const out = [], n = P.items.length, sw = R.w / n, tw = sw - 16, D = Math.min(o.D, sw * 0.55), BH = 52;
    if (!allFit(P, tw, o.s, 3)) return planNo('a point does not fit under its arrow');
    const th = maxTH(P, tw, o.s);
    if (D + 28 + BH + th > R.h) return planNo('the ribbon does not fit the height');
    const gp = Math.max(14, Math.min(40, (R.h * 0.8 - D - BH - th) / 2)), total = D + gp + BH + gp + th, y0 = R.y + (R.h - total) / 2, by = y0 + D + gp;
    P.items.forEach((it, i) => {
      const c = col(i), g = 'scc' + i, x = R.x + i * sw, cx = x + sw / 2;
      const parts = [box(i === 0 ? 'homePlate' : 'chevron', x + 2, by, sw - 4, BH, { fill: c, grp: g }),
        label(x + sw * 0.25, by + (BH - 36) / 2, sw * 0.5, 36, String(i + 1), { size: 24, bold: true, color: W, align: 'center', valign: 'middle', grp: g }),
        ...disc(it.icon, cx, y0 + D / 2, D, c, g)];
      words(it, x + 8, by + BH + gp, tw, o.s, parts, 'center', g);
      out.push(...planGrp(parts, g, it.label));
    });
    return out; } };

  // 6. quadrant: four cards around the topic's disc, each icon on its outer side
  L.scquad = { name: 'Icon quadrant', n: [4, 4], why: P => (String(P.title || '').trim() ? '' : 'needs the topic for its centre'), build(P, R, o) {
    const out = [], t = String(P.title).trim(), gap = 26, cw = Math.min(540, (R.w - gap) / 2), C = 176, I = Math.min(o.I, 56), pad = 18;
    const tw = cw - pad - I - 16 - (C / 2 + 14) - pad;
    if (!planWords(t, C - 40, 22) || linesAt(t, (C - 40) * 0.95, 22) > 4) return planNo('the topic does not fit its disc');
    if (!allFit(P, tw, o.s, 3)) return planNo('a point does not fit its card');
    const ch0 = Math.max(I, maxTH(P, tw, o.s)) + 36, ch = Math.max(ch0, Math.min((R.h * 0.88 - gap) / 2, ch0 + 60)), total = ch * 2 + gap;
    if (total > R.h || ch * 2 + gap < C) return planNo('the quadrant does not fit the height');
    const x0 = R.x + (R.w - (cw * 2 + gap)) / 2, y0 = R.y + (R.h - total) / 2, mx = x0 + cw + gap / 2, my = y0 + ch + gap / 2;
    P.items.forEach((it, i) => {
      const left = i % 2 === 0, x = left ? x0 : x0 + cw + gap, y = i < 2 ? y0 : y0 + ch + gap, c = col(i), g = 'scq' + i, th = textH(it, tw, o.s);
      const ix = left ? x + pad : x + cw - pad - I, tx = left ? ix + I + 16 : x + C / 2 + 14 + pad;
      const parts = [box('roundRect', x, y, cw, ch, { fill: soft(c), line: edge(c), lineW: 1, keep: true, grp: g }), ...ic(it.icon, ix, y + (ch - I) / 2, I, c, g)];
      words(it, tx, y + (ch - th) / 2, tw, o.s, parts, left ? 'left' : 'left', g);
      out.push(...planGrp(parts, g, it.label));
    });
    const c0 = accent(MONO ? 0 : 6), lh = planLH(t, C - 40, 22);
    out.push(...planGrp([box('ellipse', mx - C / 2, my - C / 2, C, C, { fill: c0, grp: 'hub' }), box('ellipse', mx - C / 2 + 8, my - C / 2 + 8, C - 16, C - 16, { fill: W, grp: 'hub' }),
      label(mx - (C - 40) / 2, my - lh / 2, C - 40, lh, t, { size: 22, bold: true, color: INK, align: 'center', valign: 'top', grp: 'hub' })], 'hub', t));
    return out; } };

  /* ---------- registration: first among the reference layouts ---------- */
  const OPTS = [{ s: 24, D: 128, I: 76 }, { s: 24, D: 112, I: 68 }, { s: 24, D: 96, I: 60 }, { s: 22, D: 84, I: 52 }, { s: 22, D: 70, I: 46 }];
  const mine = [];
  Object.keys(L).forEach(k => {
    const S = L[k];
    const why = P => (!flat(P) ? 'not for grouped content' : '') || (P.items.length < S.n[0] || P.items.length > S.n[1] ? `works for ${S.n[0]} to ${S.n[1]} points` : '') || (S.why ? S.why(P) : '');
    mine.push({ key: k, name: S.name, why, boost: 8 });
    [['m', false], ['c', true]].forEach(([sfx, mono]) => {
      regPlan(`ref_${k}_${sfx}`, { name: S.name + (mono ? ' (one colour)' : ''), family: `ref_${k}_${sfx}`, kind: 'list', hidden: true, ref: k, appeal: 12, sizeFirst: true,
        hintKey: () => 'ref:' + k, needs: why, opts: OPTS,
        build: (P, R, o) => { MONO = mono; try { return S.build(P, R, o); } finally { MONO = false; } } });
    });
  });
  REF.layouts.unshift(...mine);
});
