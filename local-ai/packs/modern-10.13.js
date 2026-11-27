/* AI Visual Builder design pack "modern" 10.13.0 - three compositions the earlier packs did not have: a roadmap (a road
   with milestones, labels alternating above and below it), pillars (the points as the columns under a roof, the
   topic on the roof) and a quadrant framework (four points around the topic). The same rules as every family
   (packs/README.txt): every label and description at 22 pt and up, approved colours, Open Sans, native shapes only,
   and only relationships the content states (a road only for a stated sequence; pillars and quadrants only for
   independent points). Loaded after plan.js. */
registerPack('modern', '10.13.0', () => {
  const W = '#FFFFFF', SOFT = '#D9D9D9', ROAD = '#7F7F7F';
  const objKey = it => it.icon || 'none';
  const titleFits = (P, w, s) => !!P.title && planWords(P.title, w, s) && linesAt(P.title, w * 0.95, s) <= 2;

  /* 1. Roadmap: the steps as milestones on one road that ends in an arrow; each milestone's object on its disc, the
     label and description above or below it in turn, joined by a short stem. Only for a stated sequence. */
  regPlan('roadmap', { name: 'Roadmap', family: 'roadmap', kind: 'sequence', suits: P => planSeq(P),
    needs: P => !planSeq(P) ? 'only for steps in a stated order' : P.items.length < 3 || P.items.length > 6 ? 'works for 3 to 6 steps' : '',
    opts: [{ s: 24, D: 56 }, { s: 22, D: 50 }, { s: 22, D: 44 }],
    build: (P, R, o) => {
      const L = planOrder(P), n = L.length, col = (R.w - 40) / n, rh = 16, cy = R.y + R.h / 2, stem = 14;
      const tw = Math.min(2 * col - 18, 420), side = (R.h - rh) / 2 - o.D / 2 - stem - 4;
      if (!L.every(it => planFits(it, tw, o.s) && planTextH(it, tw, o.s) <= side)) return planNo('a step does not fit above or below the road');
      const out = [box('roundRect', R.x, cy - rh / 2, R.w - 30, rh, { fill: SOFT }), headAt(R.x + R.w, cy, 0, 34, ROAD)];
      L.forEach((it, i) => {
        const cx = R.x + col * (i + 0.5), up = i % 2 === 0, c = accent(i), g = 'ms' + i, h = planTextH(it, tw, o.s);
        const tx = Math.max(R.x, Math.min(R.x + R.w - tw, cx - tw / 2)), ty = up ? cy - o.D / 2 - stem - h : cy + o.D / 2 + stem;
        out.push(...planGrp([...planIcon(objKey(it), cx - o.D / 2, cy - o.D / 2, o.D, W, c, g),
          box('rect', cx - 1.5, up ? cy - o.D / 2 - stem : cy + o.D / 2, 3, stem, { fill: c }),
          ...planText(it, tx, ty, tw, o.s, { align: 'center', grp: g })], g, it.label));
      });
      return out;
    } });

  /* 2. Pillars: the topic on a roof, each point a pillar under it (its object, label and description), on one base.
     Only for independent points (not a sequence). */
  regPlan('pillars', { name: 'Pillars', family: 'pillars', kind: 'layered', suits: P => !planSeq(P) && !planRoles(P).supports.length,
    needs: P => planSeq(P) ? 'not for steps in an order' : P.items.length < 3 || P.items.length > 5 ? 'works for 3 to 5 points' : !P.title ? 'needs a topic for the roof' : '',
    opts: [{ s: 24, D: 48, pad: 10 }, { s: 22, D: 40, pad: 8 }, { s: 22, D: 0, pad: 8 }],
    build: (P, R, o) => {
      const n = P.items.length, m = 24, gap = 18, roofH = 64, baseH = 16, cap = 10;
      const cw = (R.w - 2 * m - gap * (n - 1)) / n, ch = R.h - roofH - baseH - 16, tw = cw - 2 * o.pad;
      const rt = textRect('trapezoid', R.x, R.y, R.w, roofH);
      if (!titleFits(P, rt.w, 24) || !fitsAt(P.title, rt.w, rt.h, 24)) return planNo('the topic does not fit on the roof');
      if (!P.items.every(it => planFits(it, tw, o.s) && o.pad + (o.D ? o.D + 10 : 0) + planTextH(it, tw, o.s) + o.pad + 2 * cap <= ch)) return planNo('a point does not fit its pillar');
      // the topic in the roof itself (white on the dark neutral: the brand's readable text colour for it)
      const out = [box('trapezoid', R.x, R.y, R.w, roofH, { fill: ROAD, text: P.title, size: 24, bold: true, color: W, align: 'center', valign: 'middle' }),
        box('rect', R.x, R.y + R.h - baseH, R.w, baseH, { fill: ROAD })];
      P.items.forEach((it, i) => {
        const x = R.x + m + i * (cw + gap), y = R.y + roofH + 8, c = accent(i), g = 'pil' + i, th = planTextH(it, tw, o.s);
        const body = [box('rect', x, y, cw, ch, { fill: PANEL }), box('rect', x - 4, y, cw + 8, cap, { fill: c }), box('rect', x - 4, y + ch - cap, cw + 8, cap, { fill: c })];
        const iy = y + cap + o.pad + Math.max(0, (ch - 2 * cap - 2 * o.pad - (o.D ? o.D + 10 : 0) - th) / 2);
        out.push(...planGrp(body.concat(o.D ? planIcon(objKey(it), x + (cw - o.D) / 2, iy, o.D, c, W, g) : [],
          planText(it, x + o.pad, iy + (o.D ? o.D + 10 : 0), tw, o.s, { align: 'center', grp: g })), g, it.label));
      });
      return out;
    } });

  /* 3. Quadrant framework: exactly four independent points in a 2 x 2 frame around the topic. */
  regPlan('quadrant', { name: 'Quadrant framework', family: 'quadrant', kind: 'grouped', suits: P => P.items.length === 4 && !planSeq(P),
    needs: P => P.items.length !== 4 ? 'needs exactly 4 points' : planSeq(P) ? 'not for steps in an order' : '',
    opts: [{ s: 24, D: 44, pad: 12 }, { s: 22, D: 36, pad: 10 }, { s: 22, D: 0, pad: 10 }],
    build: (P, R, o) => {
      // the topic on a disc in the middle when it fits there at 22 pt (measured in the disc's own text area)
      const gap = 18, cw = (R.w - gap) / 2, chh = (R.h - gap) / 2, HD = 230, tr = textRect('ellipse', 0, 0, HD - 16, HD - 16);
      const hub = P.title && planWords(P.title, tr.w, 22) && fitsAt(P.title, tr.w, tr.h, 22) ? HD : 0;
      // the text keeps clear of the topic disc in the middle: it uses the outer part of each card
      const tw = cw - 2 * o.pad - (o.D ? o.D + 12 : 0) - (hub ? hub / 2 - gap / 2 : 0);
      if (!P.items.every(it => planFits(it, tw, o.s) && planTextH(it, tw, o.s) + 2 * o.pad <= chh)) return planNo('a point does not fit its quadrant');
      const out = [];
      P.items.forEach((it, i) => {
        const left = i % 2 === 0, top = i < 2, x = R.x + (left ? 0 : cw + gap), y = R.y + (top ? 0 : chh + gap), c = accent(i), g = 'q' + i;
        const th = planTextH(it, tw, o.s), ty = y + (chh - th) / 2, ix = left ? x + o.pad : x + cw - o.pad - o.D;
        const tx = left ? x + o.pad + (o.D ? o.D + 12 : 0) : x + cw - o.pad - (o.D ? o.D + 12 : 0) - tw;
        out.push(...planGrp([box('roundRect', x, y, cw, chh, { fill: PANEL }), box('rect', left ? x : x + cw - 8, y + 14, 8, chh - 28, { fill: c }),
          ...(o.D ? planIcon(objKey(it), ix, y + (chh - o.D) / 2, o.D, c, W, g) : []),
          ...planText(it, tx, ty, tw, o.s, { align: 'left', grp: g })], g, it.label));   // never right-aligned (LVC p. 40)
      });
      if (hub) out.push(box('ellipse', R.x + R.w / 2 - hub / 2, R.y + R.h / 2 - hub / 2, hub, hub, { fill: W }),
        box('ellipse', R.x + R.w / 2 - hub / 2 + 8, R.y + R.h / 2 - hub / 2 + 8, hub - 16, hub - 16, { fill: ROAD, text: P.title, size: 22, bold: true, color: W, align: 'center', valign: 'middle' }));
      return out;
    } });
});
