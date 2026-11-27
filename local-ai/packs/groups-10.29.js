/* SL Editor design pack "groups" 10.29.0 - layouts for content in named groups (two or three sections of points, e.g.
   "Internal customers - expectations" / "External customers - expectations"), in the style of the showcase pack: each
   group under its own name, every point with its colour icon (iconlib.js), the group's colour throughout.
     gpanels  header panels: a column per group, its name in a solid header band, icon rows below
     ghub     topic between groups: the topic's disc in the middle, one group on each side (two groups and a topic)
     gbands   group bands: a band per group, its name in a solid block on the left, its points as icon tiles across
     gcols    numbered columns: a column per group, its points as numbered cards under a header pill
     gtiles   group tiles: every point a tile with a large icon, tiles in their group's colour, group names above
   Every text at 22 pt and up, Open Sans. Each layout in a colour per group (_m) and in one colour (_c), offered by the
   "reference" engine (orchestrator.js) ahead of the others. Loaded after packs/showcase-10.28.js. */
registerPack('groups', '10.29.0', () => {
  if (typeof REF === 'undefined') return;
  const W = '#FFFFFF';
  const textH = (it, tw, s) => planLH(it.label, tw, s) + (it.detail ? planTH(it.detail, tw, PLAN_DS) - 6 : 0);
  const fits = (it, tw, s, maxL) => tw > 80 && planWords(it.label, tw, s) && linesAt(it.label, tw * 0.95, s) <= (maxL || 3) && (!it.detail || planWords(it.detail, tw, PLAN_DS));
  const sum = a => a.reduce((x, y) => x + y, 0);
  let MONO = false;
  const col = j => accent(MONO ? 0 : j);
  const soft = c => tint(c, 0.88), pale = c => tint(c, 0.7), edge = c => tint(c, 0.5), deep = c => shade(c, 0.25);
  const ic = (key, x, y, s, c, g) => comp(key || 'none', x, y, s, deep(c)).map(p => Object.assign(p, { grp: g }));
  const disc = (key, cx, cy, D, c, g) => [box('ellipse', cx - D / 2, cy - D / 2, D, D, { fill: c, grp: g }),
    box('ellipse', cx - D / 2 + 3, cy - D / 2 + 3, D - 6, D - 6, { fill: W, grp: g }), ...ic(key, cx - D * 0.31, cy - D * 0.31, D * 0.62, c, g)];
  function words(it, x, y, tw, s, out, al, g, bold) {
    const lh = planLH(it.label, tw, s);
    out.push(label(x, y, tw, lh, it.label, { size: s, bold: bold !== false, color: INK, align: al || 'left', valign: 'top', grp: g }));
    if (it.detail) out.push(label(x, y + lh - 6, tw, planTH(it.detail, tw, PLAN_DS), it.detail, { size: PLAN_DS, color: INK, align: al || 'left', valign: 'top', grp: g }));
  }
  const nameFits = (t, w, s, maxL) => planWords(t, w, s) && linesAt(t, w * 0.95, s) <= (maxL || 2);
  const L = {};

  // 1. header panels: a column per group, its name in a solid band, icon rows below
  L.gpanels = { name: 'Header panels', build(P, R, o) {
    const G = planGroups(P), k = G.length, gap = 28, cw = (R.w - gap * (k - 1)) / k, I = Math.min(o.I, 52), pad = 18, tw = cw - pad * 2 - I - 14;
    if (!G.every(x => nameFits(x.g.name, cw - 32, o.s))) return planNo('a group name does not fit its header');
    if (!G.every(x => x.items.every(it => fits(it, tw, o.s, 2)))) return planNo('a point does not fit its panel');
    const hh = Math.max(...G.map(x => planLH(x.g.name, cw - 32, o.s))) + 22, rows = x => x.items.map(it => Math.max(I, textH(it, tw, o.s)) + 14);
    const body = Math.max(...G.map(x => sum(rows(x)))) + 24, H0 = hh + body;
    if (H0 > R.h) return planNo('the panels do not fit the height');
    const H = Math.min(R.h * 0.9, H0 + 40), y0 = R.y + (R.h - H) / 2, out = [];
    G.forEach((x, j) => {
      const gx = R.x + j * (cw + gap), c = col(j), g = 'gp' + j, lh = planLH(x.g.name, cw - 32, o.s);
      const parts = [box('roundRect', gx, y0, cw, H, { fill: W, line: edge(c), lineW: 1.25, keep: true, grp: g }), box('roundRect', gx, y0, cw, hh, { fill: c, grp: g }),
        label(gx + 16, y0 + (hh - lh) / 2, cw - 32, lh, x.g.name, { size: o.s, bold: true, color: W, align: 'center', valign: 'top', grp: g })];
      const hs = rows(x);
      let y = y0 + hh + (H - hh - sum(hs)) / 2;
      x.items.forEach((it, i) => {
        const h = hs[i], th = textH(it, tw, o.s);
        parts.push(...ic(it.icon, gx + pad, y + (h - I) / 2, I, c, g + 'i' + i));
        words(it, gx + pad + I + 14, y + (h - th) / 2, tw, o.s, parts, 'left', g, false);
        if (i < x.items.length - 1) parts.push(box('rect', gx + pad, y + h - 1, cw - pad * 2, 1.5, { fill: soft(c), keep: true, grp: g }));
        y += h;
      });
      out.push(...planGrp(parts, g, x.g.name));
    });
    return out; } };

  // 2. topic between groups: two groups, the topic's disc in the middle, connectors to each group's header
  L.ghub = { name: 'Topic between groups', two: true, why: P => (String(P.title || '').trim() ? '' : 'needs the topic for its centre'), build(P, R, o) {
    const G = planGroups(P), t = String(P.title).trim(), C = 180, gap = 40, cw = (R.w - C - gap * 2) / 2, I = Math.min(o.I, 48), pad = 14, tw = cw - pad * 2 - I - 12;
    if (!nameFits(t, C - 44, 22, 3)) return planNo('the topic does not fit its disc');
    if (!G.every(x => nameFits(x.g.name, cw - 28, o.s))) return planNo('a group name does not fit');
    if (!G.every(x => x.items.every(it => fits(it, tw, o.s, 2)))) return planNo('a point does not fit beside its icon');
    const hh = Math.max(...G.map(x => planLH(x.g.name, cw - 28, o.s))) + 14, rows = x => x.items.map(it => Math.max(I, textH(it, tw, o.s)) + 12);
    const H = hh + 14 + Math.max(...G.map(x => sum(rows(x))));
    if (H > R.h || C > R.h) return planNo('the groups do not fit the height');
    const y0 = R.y + (R.h - Math.max(H, C)) / 2, cx = R.x + R.w / 2, cy = y0 + Math.max(H, C) / 2, out = [];
    G.forEach((x, j) => {
      const gx = j === 0 ? R.x : cx + C / 2 + gap, c = col(j), g = 'gh' + j, lh = planLH(x.g.name, cw - 28, o.s), al = j === 0 ? 'right' : 'left';
      const parts = [box('roundRect', gx, y0, cw, hh, { fill: pale(c), keep: true, grp: g }), label(gx + 14, y0 + (hh - lh) / 2, cw - 28, lh, x.g.name, { size: o.s, bold: true, color: INK, align: 'center', valign: 'top', grp: g })];
      const hs = rows(x);
      let y = y0 + hh + 14;
      x.items.forEach((it, i) => {
        const h = hs[i], th = textH(it, tw, o.s), ix = j === 0 ? gx + cw - pad - I : gx + pad, tx = j === 0 ? gx + pad : gx + pad + I + 12;
        parts.push(...ic(it.icon, ix, y + (h - I) / 2, I, c, g + 'i' + i));
        words(it, tx, y + (h - th) / 2, tw, o.s, parts, al, g, false);
        y += h;
      });
      out.push(...planGrp(parts, g, x.g.name));
      out.push(box('rect', j === 0 ? gx + cw : cx + C / 2, cy - 1.5, gap, 3, { fill: CONNECTOR }));
    });
    const c0 = accent(MONO ? 0 : 6), lh = planLH(t, C - 44, 22), hk = P.hero || (typeof iconLibBest === 'function' && iconLibBest(t, 'layers')) || 'none', HI = 52;
    out.push(...planGrp([box('ellipse', cx - C / 2, cy - C / 2, C, C, { fill: c0, grp: 'hub' }), box('ellipse', cx - C / 2 + 8, cy - C / 2 + 8, C - 16, C - 16, { fill: W, grp: 'hub' }),
      ...ic(hk, cx - HI / 2, cy - (HI + 8 + lh) / 2, HI, c0, 'hub'),
      label(cx - (C - 44) / 2, cy - (HI + 8 + lh) / 2 + HI + 8, C - 44, lh, t, { size: 22, bold: true, color: INK, align: 'center', valign: 'top', grp: 'hub' })], 'hub', t));
    return out; } };

  // 3. group bands: a band per group, its name in a solid block on the left, its points as icon tiles across
  L.gbands = { name: 'Group bands', build(P, R, o) {
    const G = planGroups(P), k = G.length, gap = 16, NW = 230, n = Math.max(...G.map(x => x.items.length)), tw0 = (R.w - NW - 16) / n - 12, I = Math.min(o.I, 48);
    if (!G.every(x => nameFits(x.g.name, NW - 28, o.s, 3))) return planNo('a group name does not fit its block');
    if (!G.every(x => x.items.every(it => fits(it, tw0 - 8, o.s, 2)))) return planNo('a point does not fit its tile');
    const bh = x => Math.max(planLH(x.g.name, NW - 28, o.s) + 24, 14 + I + 8 + Math.max(...x.items.map(it => textH(it, tw0 - 8, o.s))) + 14);
    const hs = G.map(bh), H = sum(hs) + gap * (k - 1);
    if (H > R.h) return planNo('the bands do not fit the height');
    let y = R.y + (R.h - H) / 2;
    const out = [];
    G.forEach((x, j) => {
      const c = col(j), g = 'gb' + j, h = hs[j], lh = planLH(x.g.name, NW - 28, o.s), m = x.items.length, tw = (R.w - NW - 16) / m - 12;
      const parts = [box('roundRect', R.x, y, R.w, h, { fill: soft(c), line: edge(c), lineW: 1, keep: true, grp: g }), box('roundRect', R.x, y, NW, h, { fill: c, grp: g }),
        label(R.x + 14, y + (h - lh) / 2, NW - 28, lh, x.g.name, { size: o.s, bold: true, color: W, align: 'center', valign: 'top', grp: g })];
      x.items.forEach((it, i) => {
        const tx = R.x + NW + 16 + i * (tw + 12), th = textH(it, tw - 8, o.s), top = y + (h - (I + 8 + th)) / 2;
        parts.push(...ic(it.icon, tx + (tw - I) / 2, top, I, c, g + 'i' + i));
        words(it, tx + 4, top + I + 8, tw - 8, o.s, parts, 'center', g, false);
      });
      out.push(...planGrp(parts, g, x.g.name));
      y += h + gap;
    });
    return out; } };

  // 4. numbered columns: a column per group, its points as numbered cards under a header pill
  L.gcols = { name: 'Numbered group columns', build(P, R, o) {
    const G = planGroups(P), k = G.length, gap = 30, cw = (R.w - gap * (k - 1)) / k, NB = 44, I = Math.min(o.I, 44), tw = cw - 16 - NB - 12 - I - 12 - 14;
    if (!G.every(x => nameFits(x.g.name, cw - 40, o.s))) return planNo('a group name does not fit its pill');
    if (!G.every(x => x.items.every(it => fits(it, tw, o.s, 2)))) return planNo('a point does not fit its card');
    const ph = Math.max(...G.map(x => planLH(x.g.name, cw - 40, o.s))) + 14, ch = it => Math.max(NB, I, textH(it, tw, o.s)) + 20;
    const H = ph + 14 + Math.max(...G.map(x => sum(x.items.map(ch)) + 10 * (x.items.length - 1)));
    if (H > R.h) return planNo('the columns do not fit the height');
    const y0 = R.y + (R.h - H) / 2, out = [];
    let n = 0;
    G.forEach((x, j) => {
      const gx = R.x + j * (cw + gap), c = col(j), g = 'gc' + j, lh = planLH(x.g.name, cw - 40, o.s);
      const parts = [box('roundRect', gx, y0, cw, ph, { fill: c, grp: g }), label(gx + 20, y0 + (ph - lh) / 2, cw - 40, lh, x.g.name, { size: o.s, bold: true, color: W, align: 'center', valign: 'top', grp: g })];
      let y = y0 + ph + 14;
      x.items.forEach((it, i) => {
        const h = ch(it), th = textH(it, tw, o.s), gi = g + 'i' + i;
        n += 1;
        parts.push(box('roundRect', gx, y, cw, h, { fill: soft(c), line: edge(c), lineW: 1, keep: true, grp: gi }),
          box('ellipse', gx + 16, y + (h - NB) / 2, NB, NB, { fill: c, text: String(n), size: 22, bold: true, color: W, align: 'center', valign: 'middle', grp: gi }),
          ...ic(it.icon, gx + 16 + NB + 12, y + (h - I) / 2, I, c, gi));
        words(it, gx + 16 + NB + 12 + I + 12, y + (h - th) / 2, tw, o.s, parts, 'left', gi, false);
        y += h + 10;
      });
      out.push(...planGrp(parts, g, x.g.name));
    });
    return out; } };

  // 5. group tiles: every point a tile with a large icon, in its group's colour, the group names above their tiles
  L.gtiles = { name: 'Group tiles', build(P, R, o) {
    const G = planGroups(P), n = P.items.length, gap = 14, ggap = 30, tw = (R.w - ggap * (G.length - 1) - gap * (n - G.length)) / n, D = Math.min(o.D, tw * 0.55, 84);
    if (tw < 140) return planNo('too many points for tiles in one row');
    if (!G.every(x => nameFits(x.g.name, x.items.length * tw + (x.items.length - 1) * gap - 16, o.s))) return planNo('a group name does not fit above its tiles');
    if (!P.items.every(it => fits(it, tw - 20, o.s, 3))) return planNo('a point does not fit its tile');
    const nh = Math.max(...G.map(x => planLH(x.g.name, x.items.length * tw + (x.items.length - 1) * gap - 16, o.s))) + 12;
    const th = Math.max(...P.items.map(it => textH(it, tw - 20, o.s))), Th = 18 + D + 12 + th + 18, H = nh + 10 + Th;
    if (H > R.h) return planNo('the tiles do not fit the height');
    const y0 = R.y + (R.h - H) / 2, out = [];
    let x0 = R.x;
    G.forEach((x, j) => {
      const c = col(j), g = 'gt' + j, gw = x.items.length * tw + (x.items.length - 1) * gap, lh = planLH(x.g.name, gw - 16, o.s);
      const parts = [label(x0 + 8, y0 + (nh - 12 - lh) / 2, gw - 16, lh, x.g.name, { size: o.s, bold: true, color: INK, align: 'center', valign: 'top', grp: g }),
        box('rect', x0, y0 + nh - 4, gw, 4, { fill: c, grp: g })];
      x.items.forEach((it, i) => {
        const tx = x0 + i * (tw + gap), ty = y0 + nh + 10, gi = g + 'i' + i;
        parts.push(box('roundRect', tx, ty, tw, Th, { fill: soft(c), line: edge(c), lineW: 1, keep: true, grp: gi }), ...disc(it.icon, tx + tw / 2, ty + 18 + D / 2, D, c, gi));
        words(it, tx + 10, ty + 18 + D + 12, tw - 20, o.s, parts, 'center', gi, true);
      });
      out.push(...planGrp(parts, g, x.g.name));
      x0 += gw + ggap;
    });
    return out; } };

  /* ---------- registration: first among the reference layouts for grouped content ---------- */
  const OPTS = [{ s: 24, D: 84, I: 52 }, { s: 22, D: 72, I: 46 }, { s: 22, D: 62, I: 40 }];
  const mine = [];
  Object.keys(L).forEach(k => {
    const S = L[k];
    const why = P => {
      const G = planGroups(P);
      if (G.length < 2 || G.length > 3) return 'needs two or three named groups';
      if (S.two && G.length !== 2) return 'needs exactly two groups';
      if (!P.items.every(i => i.group)) return 'every point needs its group';
      if (G.some(x => x.items.length < 1 || x.items.length > 5)) return 'each group needs 1 to 5 points';
      return S.why ? S.why(P) : '';
    };
    mine.push({ key: k, name: S.name, why, boost: 7 });
    [['m', false], ['c', true]].forEach(([sfx, mono]) => {
      regPlan(`ref_${k}_${sfx}`, { name: S.name + (mono ? ' (one colour)' : ''), family: `ref_${k}_${sfx}`, kind: 'grouped', groups: true, hidden: true, ref: k, appeal: 12, sizeFirst: true,
        hintKey: () => 'ref:' + k, needs: why, opts: OPTS,
        build: (P, R, o) => { MONO = mono; try { return S.build(P, R, o); } finally { MONO = false; } } });
    });
  });
  REF.layouts.unshift(...mine);
});
