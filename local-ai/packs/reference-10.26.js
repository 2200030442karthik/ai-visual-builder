/* SL Editor design pack "reference" 10.26.0 - the layouts of the course reference slides (the owner's examples), drawn
   from the text's own plan in the brand standard (22 pt and up, approved colours, Open Sans, native editable shapes):
     rtiles      process tiles: coloured rounded tiles with white icons, dashed arrows between, the words under (an order)
     rarcs       arc badges: icon discs in a thin ring, a small arrow down to the bold name and its description
     rsplit      label and detail rows: a coloured block (icon, name) beside a grey block with the description framed
     rhead       header cards: a coloured header (icon, name) over a grey body with the description
     rboxes      outlined icon boxes: thin coloured frames, an icon disc, the name under (any list)
     rlist       circle icon list: icon discs with the words beside them, one or two columns
     rfan        hub fan: the topic's icon, lines fanning out to ringed icons with the words beside them
     rpills      pill process: tall outlined pills with icon and name, arrows between (an order)
     rnum        numbered outlined rows: a coloured frame, the number in a ring, an icon, the words (an order)
     rhex        hexagon ring: white icons on coloured hexagons around the centre, the words outside
   Each layout comes in a colour per point and in one colour (key ref_<layout>_m / _c); "More visuals" gives them in
   other colour schemes (orchestrator.js engine "reference"). Loaded after plan.js. */
const REF = { layouts: [] };
registerPack('reference', '10.26.0', () => {
  const W = '#FFFFFF', GREY = '#7F7F7F', PANEL = '#F2F2F2';
  const ordered = P => typeof planSeq === 'function' && planSeq(P);
  const flat = P => !planGroups(P).length;
  const textH = (it, tw, s) => planTH(it.label, tw, s) + (it.detail ? planTH(it.detail, tw, PLAN_DS) - 6 : 0);
  const fits = (it, tw, s, maxL) => tw > 80 && planWords(it.label, tw, s) && linesAt(it.label, tw, s) <= (maxL || 3) && (!it.detail || planWords(it.detail, tw, PLAN_DS));
  const allFit = (P, tw, s, maxL) => P.items.every(it => fits(it, tw, s, maxL));
  const maxTH = (P, tw, s) => Math.max(...P.items.map(it => textH(it, tw, s)));
  function words(it, x, y, tw, s, out, o) {
    o = o || {};
    const lh = planTH(it.label, tw, s), col = o.color || INK;
    out.push(label(x, y, tw, lh, it.label, { size: s, bold: o.bold !== false, color: col, align: o.al || 'center', valign: 'top' }));
    if (it.detail && !o.noDetail) out.push(label(x, y + lh - 6, tw, planTH(it.detail, tw, PLAN_DS), it.detail, { size: PLAN_DS, color: col, align: o.al || 'center', valign: 'top' }));
  }
  function heading(P, R, out) {
    const t = String(P.title || '').trim();
    if (!t || !planWords(t, R.w, 24) || linesAt(t, R.w * 0.95, 24) > 2) return 0;
    const h = planLH(t, R.w, 24);
    out.push(label(R.x, R.y, R.w, h, t, { size: 24, bold: true, color: INK, align: 'left', valign: 'top' }));
    return h + 8;
  }
  let MONO = false;
  const col = i => accent(MONO ? 0 : i);
  /* the point's icon: white on its colour (inv) or in its colour on white */
  function icon(key, x, y, s, c, g, inv) {
    // 10.27: a library icon (iconlib.js) in white on its colour, or in its colour; a logo on a white plate
    if (/^L:/.test(String(key))) {
      if (inv && iconIsBrand(key)) return [box('roundRect', x - s * 0.04, y - s * 0.04, s * 1.08, s * 1.08, { fill: W, grp: g }), ...comp(key, x + s * 0.1, y + s * 0.1, s * 0.8, c).map(p => Object.assign(p, { grp: g }))];
      return comp(key, x, y, s, inv ? W : c).map(p => Object.assign(p, { grp: g }));
    }
    const flip = q => (q && String(q).toUpperCase() === W ? c : q ? W : q);
    return comp(key || 'none', x, y, s, c).map(p => {
      const q = Object.assign({}, p, { grp: g });
      if (inv) { if (q.fill) q.fill = flip(q.fill); if (q.line) q.line = flip(q.line); if (q.t === 'line' && q.color) q.color = flip(q.color); }
      return q;
    });
  }
  // a thin coloured frame (no outline-only shape: the colour, the fill 2 pt inside it)
  const frame = (g, x, y, w, h, c, fill, grp, t) => [box(g, x, y, w, h, { fill: c, grp }), box(g, x + t, y + t, w - 2 * t, h - 2 * t, { fill: fill || W, grp })];
  // a dashed connector with an open arrowhead (short native rectangles and a small chevron: no rotation needed)
  function dashed(x1, x2, y, c) {
    const out = [], end = x2 - 12;
    for (let x = x1; x < end - 2; x += 10) out.push(box('rect', x, y - 1, Math.min(6, end - x), 2, { fill: c }));
    out.push(box('chevron', x2 - 12, y - 7, 12, 14, { fill: c }));
    return out;
  }
  const L = {};

  // 1. process tiles (reference: "Capture unstructured data -> ..."): an order
  L.rtiles = { name: 'Process tiles', n: [3, 6], why: P => (ordered(P) ? '' : 'only for steps in a stated order'), build(P, R, o) {
    const out = [], n = P.items.length, gap = 44, cw = (R.w - gap * (n - 1)) / n, tw = cw;
    if (!allFit(P, tw, o.s)) return planNo('a step does not fit under its tile');
    const T = Math.min(o.T, cw), top = R.y + heading(P, R, out), th = maxTH(P, tw, o.s), total = T + 16 + th;
    if (top + total > R.y + R.h) return planNo('the tiles do not fit the height');
    const y = top + Math.max(0, (R.y + R.h - top - total) / 2);
    P.items.forEach((it, i) => {
      const x = R.x + i * (cw + gap), c = col(i), g = 'rt' + i, tx = x + (cw - T) / 2, parts = [box('roundRect', tx, y, T, T, { fill: c, grp: g }), ...icon(it.icon, tx + T * 0.2, y + T * 0.2, T * 0.6, c, g, true)];
      words(it, x, y + T + 16, tw, o.s, parts, { bold: false });
      out.push(...planGrp(parts, g, it.label));
      if (i < n - 1) out.push(...dashed(tx + T + 8, x + cw + gap + (cw - T) / 2 - 8, y + T / 2, CONNECTOR));
    });
    return out; } };

  // 2. arc badges (reference: "Pricing and strategy" / "Regulated content")
  L.rarcs = { name: 'Ringed badges', n: [2, 5], build(P, R, o) {
    const out = [], n = P.items.length, gap = 30, cw = (R.w - gap * (n - 1)) / n, tw = cw - 10;
    if (!allFit(P, tw, o.s)) return planNo('a point does not fit under its badge');
    const D = o.D, Rg = D + 22, top = R.y + heading(P, R, out), th = maxTH(P, tw, o.s), total = Rg + 26 + th;
    if (top + total > R.y + R.h) return planNo('the badges do not fit the height');
    const y = top + Math.max(0, (R.y + R.h - top - total) / 2);
    P.items.forEach((it, i) => {
      const x = R.x + i * (cw + gap), cx = x + cw / 2, c = col(i), g = 'ra' + i;
      const parts = [box('ellipse', cx - Rg / 2, y, Rg, Rg, { fill: c, grp: g }), box('ellipse', cx - Rg / 2 + 3, y + 3, Rg - 6, Rg - 6, { fill: W, grp: g }),
        box('ellipse', cx - D / 2, y + (Rg - D) / 2, D, D, { fill: c, grp: g }), ...icon(it.icon, cx - D * 0.3, y + (Rg - D) / 2 + D * 0.2, D * 0.6, c, g, true),
        box('downArrow', cx - 7, y + Rg + 4, 14, 18, { fill: c, grp: g })];
      words(it, x + 5, y + Rg + 26, tw, o.s, parts);
      out.push(...planGrp(parts, g, it.label));
    });
    return out; } };

  // 3. label and detail rows (reference: "Purchase order matching | Matches clean purchase orders ...")
  L.rsplit = { name: 'Label and detail rows', n: [2, 4], why: P => (P.items.every(it => it.detail) ? '' : 'needs a description for every point'), build(P, R, o) {
    const out = [], n = P.items.length, top = R.y + heading(P, R, out), I = Math.min(o.I, 48), lw = Math.min(380, R.w * 0.36), dw = R.w - lw, ltw = lw - I - 40, dtw = dw - 2 * 16 - 24;
    if (!P.items.every(it => planWords(it.label, ltw, o.s) && linesAt(it.label, ltw, o.s) <= 3 && planWords(it.detail, dtw, PLAN_DS))) return planNo('a point does not fit its row');
    const hs = P.items.map(it => Math.max(I, planTH(it.label, ltw, o.s), planTH(it.detail, dtw, PLAN_DS) + 16) + 22), total = hs.reduce((a, b) => a + b, 0) + 12 * (n - 1);
    if (top + total > R.y + R.h) return planNo('the rows do not fit the height');
    let y = top + Math.max(0, (R.y + R.h - top - total) / 2);
    P.items.forEach((it, i) => {
      const h = hs[i], c = col(i), g = 'rs' + i, ink = textOn(c), lh = planTH(it.label, ltw, o.s), dh = planTH(it.detail, dtw, PLAN_DS) + 12;
      const parts = [box('roundRect', R.x, y, R.w, h, { fill: GREY, grp: g }), box('rect', R.x, y, lw, h, { fill: c, grp: g }),
        ...icon(it.icon, R.x + 14, y + (h - I) / 2, I, c, g, true),
        label(R.x + I + 26, y + (h - lh) / 2, ltw, lh, it.label, { size: o.s, bold: true, color: ink, align: 'left', valign: 'top' }),
        ...frame('roundRect', R.x + lw + 16, y + (h - dh) / 2, dw - 32, dh, W, GREY, g, 2),
        label(R.x + lw + 28, y + (h - dh) / 2 + 6, dtw, dh - 12, it.detail, { size: PLAN_DS, color: W, align: 'left', valign: 'middle' })];
      out.push(...planGrp(parts, g, it.label));
      y += h + 12;
    });
    return out; } };

  // 4. header cards (reference: "One-time AI tasks" / "Repeatable AI workflows")
  L.rhead = { name: 'Header cards', n: [2, 4], why: P => (P.items.every(it => it.detail) ? '' : 'needs a description for every point'), build(P, R, o) {
    const out = [], n = P.items.length, gap = 36, cw = (R.w - gap * (n - 1)) / n, I = o.I, ltw = cw - I - 44, btw = cw - 36;
    if (!P.items.every(it => planWords(it.label, ltw, o.s) && linesAt(it.label, ltw, o.s) <= 2 && planWords(it.detail, btw, PLAN_DS))) return planNo('a point does not fit its card');
    const top = R.y + heading(P, R, out), hh = Math.max(I + 24, ...P.items.map(it => planTH(it.label, ltw, o.s) + 20)), bh = Math.max(...P.items.map(it => planTH(it.detail, btw, PLAN_DS))) + 32, total = hh + bh;
    if (top + total > R.y + R.h) return planNo('the cards do not fit the height');
    const y = top + Math.max(0, (R.y + R.h - top - total) / 2);
    P.items.forEach((it, i) => {
      const x = R.x + i * (cw + gap), c = col(i), g = 'rh' + i, ink = textOn(c), lh = planTH(it.label, ltw, o.s);
      const parts = [box('rect', x, y, cw, hh, { fill: c, grp: g }), ...icon(it.icon, x + 16, y + (hh - I) / 2, I, c, g, true),
        label(x + I + 30, y + (hh - lh) / 2, ltw, lh, it.label, { size: o.s, bold: false, color: ink, align: 'left', valign: 'top' }),
        box('rect', x, y + hh + 2, cw, bh - 2, { fill: GREY, grp: g }),
        label(x + 18, y + hh + 16, btw, bh - 30, it.detail, { size: PLAN_DS, color: W, align: 'center', valign: 'middle' })];
      out.push(...planGrp(parts, g, it.label));
    });
    return out; } };

  // 5. outlined icon boxes (reference: "Drafting emails", "Creating documents" ...)
  L.rboxes = { name: 'Outlined icon boxes', n: [3, 6], build(P, R, o) {
    const out = [], n = P.items.length, cols = n <= 4 ? n : 3, nr = Math.ceil(n / cols), gap = 26, cw = Math.min(250, (R.w - gap * (cols - 1)) / cols), tw = cw - 24;
    if (!allFit(P, tw, o.s, 3)) return planNo('a point does not fit its box');
    const D = o.D, top = R.y + heading(P, R, out), ch = 14 + D + 10 + maxTH(P, tw, o.s) + 10, total = nr * ch + (nr - 1) * 22;
    if (top + total > R.y + R.h) return planNo('the boxes do not fit the height');
    const y0 = top + Math.max(0, (R.y + R.h - top - total) / 2);
    P.items.forEach((it, i) => {
      const r = Math.floor(i / cols), inRow = r < nr - 1 ? cols : n - cols * (nr - 1), rw = inRow * cw + (inRow - 1) * gap;
      const x = R.x + (R.w - rw) / 2 + (i % cols) * (cw + gap), y = y0 + r * (ch + 22), c = col(i), g = 'rb' + i;
      const parts = [...frame('rect', x, y, cw, ch, c, W, g, 2), box('ellipse', x + (cw - D) / 2, y + 14, D, D, { fill: c, grp: g }), ...icon(it.icon, x + (cw - D) / 2 + D * 0.2, y + 14 + D * 0.2, D * 0.6, c, g, true)];
      words(it, x + 12, y + 14 + D + 10, tw, o.s, parts, { bold: false });
      out.push(...planGrp(parts, g, it.label));
    });
    return out; } };

  // 6. circle icon list (reference: "Sensitive HR communications" ...)
  L.rlist = { name: 'Circle icon list', n: [2, 8], build(P, R, o) {
    const out = [], n = P.items.length, cols = n > 4 ? 2 : 1, gap = 40, cw = cols > 1 ? (R.w - gap) / 2 : Math.min(R.w, 820), D = o.D, tw = cw - D - 22;
    if (!allFit(P, tw, o.s, 2)) return planNo('a point does not fit beside its icon');
    const top = R.y + heading(P, R, out), nr = Math.ceil(n / cols), rh = Math.max(D, maxTH(P, tw, o.s)) + 10, total = nr * rh + (nr - 1) * 12;
    if (top + total > R.y + R.h) return planNo('the list does not fit the height');
    const y0 = top + Math.max(0, (R.y + R.h - top - total) / 2), x0 = R.x + (R.w - (cols * cw + (cols - 1) * gap)) / 2;
    P.items.forEach((it, i) => {
      const x = x0 + (cols > 1 ? Math.floor(i / nr) : 0) * (cw + gap), y = y0 + (cols > 1 ? i % nr : i) * (rh + 12), c = col(i), g = 'rl' + i, th = textH(it, tw, o.s);
      const parts = [box('ellipse', x, y + (rh - D) / 2, D, D, { fill: c, grp: g }), ...icon(it.icon, x + D * 0.2, y + (rh - D) / 2 + D * 0.2, D * 0.6, c, g, true)];
      words(it, x + D + 22, y + (rh - th) / 2, tw, o.s, parts, { al: 'left', bold: !!it.detail });
      out.push(...planGrp(parts, g, it.label));
    });
    return out; } };

  // 7. hub fan (reference: "Drafting professional emails" ... from the email icon)
  const topicIcon = P => { const L0 = typeof iconLibBest === 'function' && iconLibBest(P.title, 'layers'); if (L0) return L0; try { const s = conceptScores(P.title || '', ''); const k = s && s.find(x => CMP[x.key]); return k ? k.key : 'none'; } catch (e) { return 'none'; } };
  L.rfan = { name: 'Hub fan', n: [3, 6], why: P => (String(P.title || '').trim() ? '' : 'needs the topic for its hub'), build(P, R, o) {
    const out = [], n = P.items.length, H = Math.min(150, R.h * 0.4), D = Math.min(o.D, n > 4 ? 56 : 72), tx = R.x + H + 180 + D + 20, tw = R.x + R.w - tx;
    if (!allFit(P, tw, o.s, 2)) return planNo('a point does not fit beside its icon');
    const t = String(P.title).trim();
    if (!planWords(t, H + 60, 22) || linesAt(t, H + 60, 22) > 3) return planNo('the topic does not fit under the hub');
    const rg = n > 4 ? 4 : 10, rh = Math.max(D, maxTH(P, tw, o.s)) + 6, total = n * rh + (n - 1) * rg;
    if (total > R.h) return planNo('the points do not fit the height');
    const y0 = R.y + (R.h - total) / 2, hy = R.y + R.h / 2 - H / 2 - 20, hx = R.x + 30, c0 = accent(MONO ? 0 : 6);
    const hub = [box('roundRect', hx, hy, H, H, { fill: c0, grp: 'hub' }), ...icon(topicIcon(P), hx + H * 0.18, hy + H * 0.18, H * 0.64, c0, 'hub', true),
      label(hx - 30, hy + H + 8, H + 60, planTH(t, H + 60, 22), t, { size: 22, bold: true, color: INK, align: 'center', valign: 'top', grp: 'hub' })];
    P.items.forEach((it, i) => {
      const y = y0 + i * (rh + rg), cy = y + rh / 2, cx = R.x + H + 180, c = col(i), g = 'rf' + i, th = textH(it, tw, o.s);
      out.push(seg(hx + H, hy + H / 2, cx, cy, c, 2));
      const parts = [box('ellipse', cx, cy - D / 2, D, D, { fill: c, grp: g }), box('ellipse', cx + 2.5, cy - D / 2 + 2.5, D - 5, D - 5, { fill: W, grp: g }), ...icon(it.icon, cx + D * 0.22, cy - D * 0.28, D * 0.56, c, g, false)];
      words(it, tx, y + (rh - th) / 2, tw, o.s, parts, { al: 'left', bold: !!it.detail });
      out.push(...planGrp(parts, g, it.label));
    });
    out.push(...planGrp(hub, 'hub', t));
    return out; } };

  // 8. pill process (reference: "Identify key tasks" -> "Select AI tools" -> ...): an order
  L.rpills = { name: 'Pill process', n: [3, 5], why: P => (ordered(P) ? '' : 'only for steps in a stated order'), build(P, R, o) {
    const out = [], n = P.items.length, aw = 22, gap = aw + 20, cw = Math.min(230, (R.w - gap * (n - 1)) / n), tw = cw - 36;
    if (!allFit(P, tw, o.s, 3)) return planNo('a step does not fit its pill');
    const top = R.y + heading(P, R, out), I = o.I, ph = Math.min(R.y + R.h - top, Math.max(...P.items.map(it => I + 30 + textH(it, tw, o.s) + 40)) + 40);
    if (ph > R.y + R.h - top || ph < I + 120) return planNo('the pills do not fit the height');
    const rw = n * cw + (n - 1) * gap, x0 = R.x + (R.w - rw) / 2, y = top + Math.max(0, (R.y + R.h - top - ph) / 2);
    P.items.forEach((it, i) => {
      const x = x0 + i * (cw + gap), c = col(i), g = 'rp' + i, th = textH(it, tw, o.s), up = i % 2 === 0;
      const iy = up ? y + 46 : y + ph - 46 - I, ty = up ? iy + I + 20 : y + 46;
      const parts = [...frame('roundRect', x, y, cw, ph, c, W, g, 2), ...icon(it.icon, x + (cw - I) / 2, iy, I, c, g, false)];
      words(it, x + 18, up ? ty : ty, tw, o.s, parts, { bold: false });
      out.push(...planGrp(parts, g, it.label));
      if (i < n - 1) out.push(box('rightArrow', x + cw + 10, y + ph / 2 - 10, aw, 20, { fill: GREY }));
    });
    return out; } };

  // 9. numbered outlined rows (reference: "01 Record-to-report" ...): an order
  L.rnum = { name: 'Numbered outlined rows', n: [3, 6], why: P => (ordered(P) ? '' : 'only for steps in a stated order'), build(P, R, o) {
    const out = [], n = P.items.length, N = 60, I = Math.min(o.I, 44), W0 = Math.min(R.w, 900), tw = W0 - 20 - N - 18 - I - 26 - 16;
    if (!allFit(P, tw, o.s, 2)) return planNo('a step does not fit its row');
    const top = R.y + heading(P, R, out), hs = P.items.map(it => Math.max(N, textH(it, tw, o.s)) + 14), total = hs.reduce((a, b) => a + b, 0) + 10 * (n - 1);
    if (top + total > R.y + R.h) return planNo('the rows do not fit the height');
    let y = top + Math.max(0, (R.y + R.h - top - total) / 2);
    const x = R.x + (R.w - W0) / 2;
    P.items.forEach((it, i) => {
      const h = hs[i], c = col(i), g = 'rn' + i, th = textH(it, tw, o.s), num = String((typeof PLAN_NUM0 !== 'undefined' ? PLAN_NUM0 : 0) + i + 1).padStart(2, '0');
      const parts = [...frame('roundRect', x, y, W0, h, c, W, g, 2),
        box('ellipse', x + 20, y + (h - N) / 2, N, N, { fill: c, grp: g }),
        box('ellipse', x + 22, y + (h - N) / 2 + 2, N - 4, N - 4, { fill: W, grp: g, text: num, size: 22, bold: false, color: INK, align: 'center', valign: 'middle' }),
        ...icon(it.icon, x + 20 + N + 18, y + (h - I) / 2, I, c, g, false)];
      words(it, x + 20 + N + 18 + I + 26, y + (h - th) / 2, tw, o.s, parts, { al: 'left', bold: !!it.detail });
      out.push(...planGrp(parts, g, it.label));
      y += h + 10;
    });
    return out; } };

  // 10. hexagon ring (reference: "Creating test cases", "Generating code templates" ...)
  L.rhex = { name: 'Hexagon ring', n: [4, 6], build(P, R, o) {
    const out = [], n = P.items.length, Hx = o.H, Hy = Hx * 0.88, top = R.y + heading(P, R, out), cx = R.x + R.w / 2, avail = R.y + R.h - top;
    const rows = Math.ceil(n / 2), gy = 14, ringH = rows * Hy + (rows - 1) * gy;
    if (ringH > avail) return planNo('the ring does not fit the height');
    const tw = R.w / 2 - Hx * (rows === 3 ? 1.45 : 1.1) - 30;
    if (!allFit(P, tw, o.s, 2)) return planNo('a point does not fit beside its hexagon');
    const y0 = top + (avail - ringH) / 2;
    // left column top to bottom, right column bottom to top (a ring); the middle row stands out
    P.items.forEach((it, i) => {
      const left = i < rows, r = left ? i : (n - 1 - i), mid = rows === 3 && r === 1, off = mid ? Hx * 0.35 : 0;
      const hx = left ? cx - Hx - 10 - off : cx + 10 + off, hy = y0 + r * (Hy + gy), c = col(i), g = 'rx' + i, th = textH(it, tw, o.s);
      const parts = [box('hexagon', hx, hy, Hx, Hy, { fill: c, grp: g }), ...icon(it.icon, hx + Hx * 0.27, hy + Hy * 0.2, Hy * 0.6, c, g, true)];
      words(it, left ? hx - 18 - tw : hx + Hx + 18, hy + (Hy - th) / 2, tw, o.s, parts, { al: left ? 'right' : 'left', bold: !!it.detail });
      out.push(...planGrp(parts, g, it.label));
    });
    return out; } };

  /* ---------- registration: each layout in a colour per point (_m) and in one colour (_c) ---------- */
  const OPTS = [{ s: 24, D: 92, T: 130, I: 56, H: 120 }, { s: 24, D: 80, T: 116, I: 50, H: 108 }, { s: 22, D: 70, T: 100, I: 44, H: 96 }, { s: 22, D: 60, T: 88, I: 40, H: 86 }];
  Object.keys(L).forEach(k => {
    const S = L[k];
    const why = P => !flat(P) ? 'not for grouped content' : P.items.length < S.n[0] || P.items.length > S.n[1] ? `works for ${S.n[0]} to ${S.n[1]} points` : S.why ? S.why(P) : '';
    REF.layouts.push({ key: k, name: S.name, why });
    [['m', false], ['c', true]].forEach(([sfx, mono]) => {
      regPlan(`ref_${k}_${sfx}`, { name: S.name + (mono ? ' (one colour)' : ''), family: `ref_${k}_${sfx}`, kind: 'list', hidden: true, ref: k, appeal: 10, sizeFirst: true,
        hintKey: () => 'ref:' + k, needs: why, opts: OPTS,
        build: (P, R, o) => { MONO = mono; try { return S.build(P, R, o); } finally { MONO = false; } } });
    });
  });
});
