/* SL Editor design pack "lesson2" 10.27.0 - the layouts of the owner's "Lesson 2" course deck (Downloads\Reference):
   light tinted cards with a thin border of their colour, outline icons, slim colour dividers, label pills.
     l2rows    icon rows: icon in a white disc, a divider, the name and its description (s4 "Database data sources")
     l2cols    label | detail rows: icon, name, a colour divider, the description beside it (s5 "Role | Senior risk ...")
     l2pill    square and pill rows: a solid square with a white icon, the name in a pill, the description (s6 "Zero-shot")
     l2tall    linked tall cards: a solid disc icon, the name in a pill, the description, links between (s8, s13)
     l2grid    card grid: a solid disc icon, a divider, the name and description, two or three columns (s16)
     l2branch  topic branch: the topic card, a spine with coloured dots, a card per point (s9 "Weekly status report")
     l2flow    grouped flow: one card per group with its name on a tab, its points inside, links between (s3 Power BI)
   Every text at 22 pt and up (labels 24/22), Open Sans; icons from the icon library (iconlib.js). Each layout in a colour
   per point (_m) and in one colour (_c), offered by the "reference" engine (orchestrator.js) ahead of the others.
   Loaded after packs/reference-10.26.js. */
registerPack('lesson2', '10.27.0', () => {
  if (typeof REF === 'undefined') return;
  const W = '#FFFFFF';
  const flat = P => !planGroups(P).length;
  const allDet = P => P.items.every(it => it.detail);
  const textH = (it, tw, s) => planLH(it.label, tw, s) + (it.detail ? planTH(it.detail, tw, PLAN_DS) - 6 : 0);
  const fits = (it, tw, s, maxL) => tw > 80 && planWords(it.label, tw, s) && linesAt(it.label, tw * 0.95, s) <= (maxL || 3) && (!it.detail || planWords(it.detail, tw, PLAN_DS));
  const allFit = (P, tw, s, maxL) => P.items.every(it => fits(it, tw, s, maxL));
  const maxTH = (P, tw, s) => Math.max(...P.items.map(it => textH(it, tw, s)));
  const sum = a => a.reduce((x, y) => x + y, 0);
  let MONO = false;
  const col = i => accent(MONO ? 0 : i);
  const soft = c => tint(c, 0.86), pale = c => tint(c, 0.68), edge = c => tint(c, 0.4), deep = c => shade(c, 0.25);
  const card = (x, y, w, h, c, grp) => box('roundRect', x, y, w, h, { fill: soft(c), line: edge(c), lineW: 1, keep: true, grp });
  const vbar = (x, y, h, c, grp) => box('rect', x, y, 3, h, { fill: c, grp });
  const hbar = (x, y, w, c, grp) => box('rect', x, y, w, 3, { fill: c, grp });
  /* the point's icon: in its colour, or white on a solid shape (inv); a logo keeps its colours on a white plate */
  function icon(key, x, y, s, c, g, inv) {
    if (/^L:/.test(String(key))) {
      if (inv && iconIsBrand(key)) return [box('roundRect', x - s * 0.04, y - s * 0.04, s * 1.08, s * 1.08, { fill: W, grp: g }), ...comp(key, x + s * 0.1, y + s * 0.1, s * 0.8, c).map(p => Object.assign(p, { grp: g }))];
      return comp(key, x, y, s, inv ? W : c).map(p => Object.assign(p, { grp: g }));
    }
    return comp(key || 'none', x, y, s, c).map(p => Object.assign(p, { grp: g }));
  }
  function words(it, x, y, tw, s, out, o) {
    o = o || {};
    const lh = planLH(it.label, tw, s);
    out.push(label(x, y, tw, lh, it.label, { size: s, bold: o.bold !== false, color: INK, align: o.al || 'left', valign: 'top' }));
    if (it.detail && !o.noDetail) out.push(label(x, y + lh - 6, tw, planTH(it.detail, tw, PLAN_DS), it.detail, { size: PLAN_DS, color: INK, align: o.al || 'left', valign: 'top' }));
  }
  const L = {};

  // 1. icon rows (s4)
  L.l2rows = { name: 'Icon rows', n: [2, 6], build(P, R, o) {
    const out = [], n = P.items.length, W0 = Math.min(R.w, 1000), x = R.x + (R.w - W0) / 2, D = Math.min(o.D, n > 4 ? 56 : 66), pad = 16, tx = pad + D + 18 + 3 + 18, tw = W0 - tx - pad;
    if (!allFit(P, tw, o.s, 2)) return planNo('a point does not fit its row');
    const hs = P.items.map(it => Math.max(D, textH(it, tw, o.s)) + (n > 4 ? 10 : 18)), gap = n > 4 ? 6 : 12, total = sum(hs) + gap * (n - 1);
    if (total > R.h) return planNo('the rows do not fit the height');
    let y = R.y + (R.h - total) / 2;
    P.items.forEach((it, i) => {
      const h = hs[i], c = col(i), g = 'l2r' + i, th = textH(it, tw, o.s), dy = y + (h - D) / 2;
      const parts = [card(x, y, W0, h, c, g), box('ellipse', x + pad, dy, D, D, { fill: W, line: edge(c), lineW: 1, keep: true, grp: g }),
        ...icon(it.icon, x + pad + D * 0.22, dy + D * 0.22, D * 0.56, deep(c), g), vbar(x + pad + D + 18, y + 10, h - 20, edge(c), g)];
      words(it, x + tx, y + (h - th) / 2, tw, o.s, parts);
      out.push(...planGrp(parts, g, it.label));
      y += h + gap;
    });
    return out; } };

  // 2. label | detail rows (s5): needs a description for every point
  L.l2cols = { name: 'Label and detail columns', n: [2, 6], why: P => (allDet(P) ? '' : 'needs a description for every point'), build(P, R, o) {
    const out = [], n = P.items.length, W0 = Math.min(R.w, 1060), x = R.x + (R.w - W0) / 2, I = Math.min(o.I, 44), pad = 16;
    const lx = x + pad + I + 16 + 3 + 16;
    const lw = [190, 230, 270, 310, 350].find(w => P.items.every(it => planWords(it.label, w, o.s) && linesAt(it.label, w * 0.95, o.s) <= 2));
    if (!lw) return planNo('a name does not fit its column');
    const dx = lx + lw + 14 + 3 + 16, dtw = x + W0 - pad - dx;
    if (dtw < 260 || !P.items.every(it => planWords(it.detail, dtw, PLAN_DS))) return planNo('a description does not fit its column');
    const hs = P.items.map(it => Math.max(I, planLH(it.label, lw, o.s), planTH(it.detail, dtw, PLAN_DS)) + (n > 4 ? 10 : 18)), gap = n > 4 ? 6 : 12, total = sum(hs) + gap * (n - 1);
    if (total > R.h) return planNo('the rows do not fit the height');
    let y = R.y + (R.h - total) / 2;
    P.items.forEach((it, i) => {
      const h = hs[i], c = col(i), g = 'l2c' + i, lh = planLH(it.label, lw, o.s), dh = planTH(it.detail, dtw, PLAN_DS);
      out.push(...planGrp([card(x, y, W0, h, c, g), ...icon(it.icon, x + pad, y + (h - I) / 2, I, deep(c), g), vbar(x + pad + I + 16, y + 10, h - 20, edge(c), g),
        label(lx, y + (h - lh) / 2, lw, lh, it.label, { size: o.s, bold: true, color: INK, align: 'left', valign: 'top' }), vbar(lx + lw + 14, y + 10, h - 20, c, g),
        label(dx, y + (h - dh) / 2, dtw, dh, it.detail, { size: PLAN_DS, color: INK, align: 'left', valign: 'top' })], g, it.label));
      y += h + gap;
    });
    return out; } };

  // 3. square and pill rows (s6): needs a description for every point
  L.l2pill = { name: 'Icon square and pill rows', n: [2, 5], why: P => (allDet(P) ? '' : 'needs a description for every point'), build(P, R, o) {
    const out = [], n = P.items.length, W0 = Math.min(R.w, 1060), x = R.x + (R.w - W0) / 2, T = Math.min(o.D, n > 4 ? 50 : 62), pad = 14;
    const pw = [200, 240, 280, 320].find(w => P.items.every(it => planWords(it.label, w - 24, o.s) && linesAt(it.label, (w - 24) * 0.95, o.s) <= 2));
    if (!pw) return planNo('a name does not fit its pill');
    const px = x + pad + T + 14, dx = px + pw + 16 + 3 + 16, dtw = x + W0 - pad - dx;
    if (dtw < 260 || !P.items.every(it => planWords(it.detail, dtw, PLAN_DS))) return planNo('a description does not fit beside the pill');
    const hs = P.items.map(it => Math.max(T, planLH(it.label, pw - 24, o.s) + 8, planTH(it.detail, dtw, PLAN_DS)) + (n > 4 ? 12 : 22)), gap = n > 4 ? 8 : 14, total = sum(hs) + gap * (n - 1);
    if (total > R.h) return planNo('the rows do not fit the height');
    let y = R.y + (R.h - total) / 2;
    P.items.forEach((it, i) => {
      const h = hs[i], c = col(i), g = 'l2p' + i, lh = planLH(it.label, pw - 24, o.s), ph = lh + 8, dh = planTH(it.detail, dtw, PLAN_DS);
      out.push(...planGrp([card(x, y, W0, h, c, g), box('roundRect', x + pad, y + (h - T) / 2, T, T, { fill: c, grp: g }), ...icon(it.icon, x + pad + T * 0.2, y + (h - T) / 2 + T * 0.2, T * 0.6, c, g, true),
        box('roundRect', px, y + (h - ph) / 2, pw, ph, { fill: pale(c), keep: true, grp: g }),
        label(px + 12, y + (h - lh) / 2, pw - 24, lh, it.label, { size: o.s, bold: true, color: INK, align: 'center', valign: 'top' }),
        vbar(px + pw + 16, y + 10, h - 20, edge(c), g), label(dx, y + (h - dh) / 2, dtw, dh, it.detail, { size: PLAN_DS, color: INK, align: 'left', valign: 'top' })], g, it.label));
      y += h + gap;
    });
    return out; } };

  // 4. linked tall cards (s8, s13)
  L.l2tall = { name: 'Linked tall cards', n: [2, 4], build(P, R, o) {
    const out = [], n = P.items.length, gap = 40, cw = Math.min(300, (R.w - gap * (n - 1)) / n), tw = cw - 28, D = Math.min(o.D, 76);
    if (!P.items.every(it => planWords(it.label, tw - 16, o.s) && linesAt(it.label, (tw - 16) * 0.95, o.s) <= 3 && (!it.detail || planWords(it.detail, tw, PLAN_DS)))) return planNo('a point does not fit its card');
    const ph = Math.max(...P.items.map(it => planLH(it.label, tw - 16, o.s))) + 6, det = P.items.some(it => it.detail);
    const dh = det ? Math.max(...P.items.map(it => (it.detail ? planTH(it.detail, tw, PLAN_DS) : 0))) : 0, H = 18 + D + 14 + ph + (det ? 14 + dh : 0) + 18;
    if (H > R.h) return planNo('the cards do not fit the height');
    const rw = n * cw + (n - 1) * gap, x0 = R.x + (R.w - rw) / 2, y = R.y + (R.h - H) / 2;
    P.items.forEach((it, i) => {
      const x = x0 + i * (cw + gap), c = col(i), g = 'l2t' + i, lh = planLH(it.label, tw - 16, o.s), py = y + 18 + D + 14;
      const parts = [card(x, y, cw, H, c, g), box('ellipse', x + (cw - D) / 2, y + 18, D, D, { fill: c, grp: g }), ...icon(it.icon, x + (cw - D) / 2 + D * 0.22, y + 18 + D * 0.22, D * 0.56, c, g, true),
        box('roundRect', x + 14, py, cw - 28, ph, { fill: pale(c), keep: true, grp: g }),
        label(x + 22, py + (ph - lh) / 2, tw - 16, lh, it.label, { size: o.s, bold: true, color: INK, align: 'center', valign: 'top' })];
      if (it.detail) { const h2 = planTH(it.detail, tw, PLAN_DS); parts.push(hbar(x + 30, py + ph + 6, cw - 60, edge(c), g), label(x + 14, py + ph + 14, tw, h2, it.detail, { size: PLAN_DS, color: INK, align: 'center', valign: 'top' })); }
      out.push(...planGrp(parts, g, it.label));
      if (i < n - 1) out.push(box('rect', x + cw, y + 18 + D / 2 - 1.5, gap, 3, { fill: edge(accent(0)) }));
    });
    return out; } };

  // 5. card grid (s16): two or three columns
  L.l2grid = { name: 'Icon card grid', n: [2, 6], build(P, R, o) {
    const out = [], n = P.items.length, cols = n <= 3 ? n : n === 4 ? 2 : 3, rows = Math.ceil(n / cols), gap = 20, cw = Math.min(520, (R.w - gap * (cols - 1)) / cols);
    const D = Math.min(o.D, 60), tx = 16 + D + 14 + 3 + 14, tw = cw - tx - 14;
    if (!allFit(P, tw, o.s, 3)) return planNo('a point does not fit its card');
    const ch = Math.max(D, maxTH(P, tw, o.s)) + 28, total = rows * ch + (rows - 1) * gap;
    if (total > R.h) return planNo('the cards do not fit the height');
    const rw = cols * cw + (cols - 1) * gap, x0 = R.x + (R.w - rw) / 2, y0 = R.y + (R.h - total) / 2;
    P.items.forEach((it, i) => {
      const r = Math.floor(i / cols), inRow = Math.min(cols, n - r * cols), xr = R.x + (R.w - (inRow * cw + (inRow - 1) * gap)) / 2;   // a short last row centred
      const x = xr + (i % cols) * (cw + gap), y = y0 + r * (ch + gap), c = col(i), g = 'l2g' + i, th = textH(it, tw, o.s);
      const parts = [card(x, y, cw, ch, c, g), box('ellipse', x + 16, y + (ch - D) / 2, D, D, { fill: c, grp: g }), ...icon(it.icon, x + 16 + D * 0.22, y + (ch - D) / 2 + D * 0.22, D * 0.56, c, g, true),
        vbar(x + 16 + D + 14, y + 12, ch - 24, edge(c), g)];
      words(it, x + tx, y + (ch - th) / 2, tw, o.s, parts);
      out.push(...planGrp(parts, g, it.label));
    });
    return out; } };

  // 6. topic branch (s9): the topic's card, a spine with a dot per point, a card per point
  L.l2branch = { name: 'Topic branch', n: [2, 4], why: P => (String(P.title || '').trim() ? '' : 'needs the topic for its card'), build(P, R, o) {
    const out = [], n = P.items.length, t = String(P.title).trim(), HW = 210, sx = R.x + HW + 46, cx = sx + 40, cw = R.x + R.w - cx, D = Math.min(o.D, 56), tx = 14 + D + 16, tw = cw - tx - 14;
    if (!planWords(t, HW - 24, o.s) || linesAt(t, (HW - 24) * 0.95, o.s) > 4) return planNo('the topic does not fit its card');
    if (!allFit(P, tw, o.s, 2)) return planNo('a point does not fit its card');
    const hs = P.items.map(it => Math.max(D, textH(it, tw, o.s)) + 18), gap = 16, total = sum(hs) + gap * (n - 1);
    if (total > R.h) return planNo('the points do not fit the height');
    const y0 = R.y + (R.h - total) / 2, th = planLH(t, HW - 24, o.s), HI = 64, HH = Math.min(R.h, 20 + HI + 10 + th + 20), hy = R.y + (R.h - HH) / 2, c0 = accent(MONO ? 0 : 6);
    const topicKey = (typeof iconLibBest === 'function' && iconLibBest(t, 'layers')) || 'none';
    const hub = [card(R.x, hy, HW, HH, c0, 'hub'), ...icon(topicKey, R.x + (HW - HI) / 2, hy + 20, HI, deep(c0), 'hub'),
      label(R.x + 12, hy + 20 + HI + 10, HW - 24, th, t, { size: o.s, bold: true, color: INK, align: 'center', valign: 'top', grp: 'hub' })];
    const mids = []; let y = y0;
    hs.forEach(h => { mids.push(y + h / 2); y += h + gap; });
    out.push(box('rect', R.x + HW, hy + HH / 2 - 1.5, sx - R.x - HW, 3, { fill: CONNECTOR }));
    if (n > 1) out.push(box('rect', sx - 1.5, Math.min(mids[0], hy + HH / 2), 3, Math.max(mids[n - 1], hy + HH / 2) - Math.min(mids[0], hy + HH / 2), { fill: CONNECTOR }));
    y = y0;
    P.items.forEach((it, i) => {
      const h = hs[i], c = col(i), g = 'l2b' + i, m = mids[i], th2 = textH(it, tw, o.s);
      out.push(box('rect', sx, m - 1.5, cx - sx, 3, { fill: CONNECTOR }), box('ellipse', sx - 8, m - 8, 16, 16, { fill: c }));
      const parts = [card(cx, y, cw, h, c, g), box('ellipse', cx + 14, y + (h - D) / 2, D, D, { fill: c, grp: g }), ...icon(it.icon, cx + 14 + D * 0.22, y + (h - D) / 2 + D * 0.22, D * 0.56, c, g, true)];
      words(it, cx + tx, y + (h - th2) / 2, tw, o.s, parts);
      out.push(...planGrp(parts, g, it.label));
      y += h + gap;
    });
    out.push(...planGrp(hub, 'hub', t));
    return out; } };

  // 7. grouped flow (s3): one card per group (its name on a tab), its points inside, links between the cards
  L.l2flow = { name: 'Grouped flow cards', n: [2, 12], grouped: true,
    why: P => { const G = planGroups(P); return G.length < 2 || G.length > 3 ? 'needs two or three groups' : G.some(x => x.items.length > 5) ? 'a group has more than five points' : !P.items.every(i => i.group) ? 'every point needs its group' : ''; },
    build(P, R, o) {
      const out = [], G = planGroups(P), k = G.length, gap = 46, cw = (R.w - gap * (k - 1)) / k, I = Math.min(o.I, 40), pad = 16, tw = cw - pad * 2 - I - 14;
      const tabW = x => Math.min(cw - 40, Math.max(140, x.length * o.s * 0.62 + 40));
      if (!G.every(x => planWords(x.g.name, cw - 60, o.s) && linesAt(x.g.name, (cw - 60) * 0.95, o.s) <= 2)) return planNo('a group name does not fit its tab');
      const tabH = Math.max(...G.map(x => planLH(x.g.name, tabW(x.g.name) - 20, o.s))) + 8;
      // a group of one point: its icon large in the middle, the name under it
      const one = x => x.items.length === 1, BI = Math.min(96, o.D + 10);
      const inner = x => one(x) ? BI + 12 + textH(x.items[0], cw - 2 * pad, o.s) : sum(x.items.map(it => Math.max(I, textH(it, tw, o.s)) + 10));
      if (!G.every(x => one(x) ? fits(x.items[0], cw - 2 * pad, o.s, 3) : x.items.every(it => fits(it, tw, o.s, 2)))) return planNo('a point does not fit its group');
      const ch = Math.max(...G.map(inner)) + tabH / 2 + 24 + 16, total = tabH / 2 + ch;
      if (total > R.h) return planNo('the groups do not fit the height');
      const top = R.y + (R.h - total) / 2 + tabH / 2;
      G.forEach((x, j) => {
        const gx = R.x + j * (cw + gap), c = col(j), g = 'l2f' + j, tW = tabW(x.g.name), lh = planLH(x.g.name, tW - 20, o.s);
        const parts = [card(gx, top, cw, ch, c, g), box('roundRect', gx + (cw - tW) / 2, top - tabH / 2, tW, tabH, { fill: pale(c), line: edge(c), lineW: 1, keep: true, grp: g }),
          label(gx + (cw - tW) / 2 + 10, top - tabH / 2 + (tabH - lh) / 2, tW - 20, lh, x.g.name, { size: o.s, bold: true, color: INK, align: 'center', valign: 'top' })];
        const body = top + tabH / 2 + 16, avail = ch - tabH / 2 - 32;
        if (one(x)) {
          const it = x.items[0], th = textH(it, cw - 2 * pad, o.s), y = body + (avail - BI - 12 - th) / 2;
          parts.push(...icon(it.icon, gx + (cw - BI) / 2, y, BI, deep(c), g));
          words(it, gx + pad, y + BI + 12, cw - 2 * pad, o.s, parts, { al: 'center' });
        } else {
          const hs = x.items.map(it => Math.max(I, textH(it, tw, o.s)) + 10);
          let y = body + (avail - sum(hs)) / 2;
          x.items.forEach((it, i) => {
            const h = hs[i], th = textH(it, tw, o.s);
            parts.push(...icon(it.icon, gx + pad, y + (h - I) / 2, I, deep(c), g + 'i' + i));
            words(it, gx + pad + I + 14, y + (h - th) / 2, tw, o.s, parts, { bold: false });
            y += h;
          });
        }
        out.push(...planGrp(parts, g, x.g.name));
        if (j < k - 1) out.push(box('rect', gx + cw, top + ch / 2 - 1.5, gap, 3, { fill: CONNECTOR }));
      });
      return out; } };

  /* ---------- registration: first among the reference layouts ---------- */
  const OPTS = [{ s: 24, D: 92, T: 130, I: 56, H: 120 }, { s: 24, D: 80, T: 116, I: 50, H: 108 }, { s: 22, D: 70, T: 100, I: 44, H: 96 }, { s: 22, D: 60, T: 88, I: 40, H: 86 }];
  const mine = [];
  Object.keys(L).forEach(k => {
    const S = L[k];
    const why = P => (S.grouped ? '' : !flat(P) ? 'not for grouped content' : '') || (!S.grouped && (P.items.length < S.n[0] || P.items.length > S.n[1]) ? `works for ${S.n[0]} to ${S.n[1]} points` : '') || (S.why ? S.why(P) : '');
    mine.push({ key: k, name: S.name, why, lesson2: true });
    [['m', false], ['c', true]].forEach(([sfx, mono]) => {
      regPlan(`ref_${k}_${sfx}`, { name: S.name + (mono ? ' (one colour)' : ''), family: `ref_${k}_${sfx}`, kind: 'list', hidden: true, ref: k, appeal: 11, sizeFirst: true,
        hintKey: () => 'ref:' + k, needs: why, opts: OPTS,
        build: (P, R, o) => { MONO = mono; try { return S.build(P, R, o); } finally { MONO = false; } } });
    });
  });
  REF.layouts.unshift(...mine);
});
