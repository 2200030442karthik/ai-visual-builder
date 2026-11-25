/* AI Visual Builder design pack "vivid" 10.21.0 - four compositions the earlier packs did not have, for more varied,
   modern built-in designs:
     numbered cards   cards with a bold colour band: the step number (a stated order) or the point's object (independent
                      points; no number then - numbers would state an order the content does not have)
     chevron process  numbered chevrons in a row, the object, label and description under each (a stated order only)
     zigzag path      a vertical path of numbered nodes, the cards alternating left and right (a stated order only)
     two-column contrast  two coloured headers and their points as icon rows (two things the content compares)
   The same rules as every family (packs/README.txt): every label and description at 22 pt and up, approved colours,
   Open Sans, native shapes only, and only relationships the content states. Loaded after plan.js. */
registerPack('vivid', '10.21.1', () => {
  const W = '#FFFFFF', SOFT = '#D9D9D9';
  const objKey = it => it.icon || 'none';
  const seqOf = P => (planSeq(P) ? planOrder(P) : P.items);

  /* 1. Numbered cards: 3 to 6 points in a grid of cards, each with a colour band on top. */
  regPlan('numcards', { name: 'Numbered cards', family: 'numcards', kind: 'list', appeal: 2,
    suits: P => P.items.length >= 3 && P.items.length <= 6 && !planGroups(P).length,
    needs: P => P.items.length < 3 || P.items.length > 6 ? 'works for 3 to 6 points' : planGroups(P).length ? 'not for named groups' : '',
    opts: [{ s: 24, band: 64, pad: 12 }, { s: 22, band: 56, pad: 10 }],
    build: (P, R, o) => {
      const L = seqOf(P), seq = planSeq(P), n = L.length, cols = n <= 3 ? n : n === 4 ? 2 : 3, rows = Math.ceil(n / cols), gap = 18;
      const cw = (R.w - gap * (cols - 1)) / cols, chh = (R.h - gap * (rows - 1)) / rows, tw = cw - 2 * o.pad;
      if (!L.every(it => planFits(it, tw, o.s) && o.band + o.pad + planTextH(it, tw, o.s) + o.pad <= chh)) return planNo('a point does not fit its card');
      const out = [];
      L.forEach((it, i) => {
        const x = R.x + (i % cols) * (cw + gap), y = R.y + Math.floor(i / cols) * (chh + gap), c = accent(i), g = 'nc' + i, D = o.band - 16;
        const head = seq ? [box('roundRect', x, y, cw, o.band, { fill: c, text: planN(i), size: 32, bold: true, color: textOn(c), align: 'center', valign: 'middle' })]
          : [box('roundRect', x, y, cw, o.band, { fill: c })].concat(planIcon(objKey(it), x + (cw - D) / 2, y + 8, D, c, W, g));
        out.push(...planGrp([box('roundRect', x, y, cw, chh, { fill: PANEL }), ...head,
          ...planText(it, x + o.pad, y + o.band + o.pad, tw, o.s, { align: 'left', grp: g })], g, it.label));
      });
      return out;
    } });

  /* 2. Chevron process: a stated order of 3 to 5 steps as numbered chevrons, the step's object and text under each. */
  regPlan('chevrons', { name: 'Chevron process', family: 'chevrons', kind: 'sequence', appeal: 2, suits: P => planSeq(P),
    needs: P => !planSeq(P) ? 'only for steps in a stated order' : P.items.length < 3 || P.items.length > 5 ? 'works for 3 to 5 steps' : '',
    opts: [{ s: 24, D: 48 }, { s: 22, D: 40 }, { s: 22, D: 0 }],
    build: (P, R, o) => {
      const L = planOrder(P), n = L.length, gap = 6, col = (R.w - gap * (n - 1)) / n, H = 64, tw = col - 14;
      const below = R.h - H - 14 - (o.D ? o.D + 10 : 0);
      if (!L.every(it => planFits(it, tw, o.s) && planTextH(it, tw, o.s) <= below)) return planNo('a step does not fit under its chevron');
      const out = [];
      L.forEach((it, i) => {
        const x = R.x + i * (col + gap), c = accent(i), g = 'ch' + i, y2 = R.y + H + 14;
        out.push(...planGrp([box('homePlate', x, R.y, col, H, { fill: c, text: planN(i), size: 28, bold: true, color: textOn(c), align: 'center', valign: 'middle' }),
          ...(o.D ? planIcon(objKey(it), x + 7, y2, o.D, c, PANEL, g) : []),
          ...planText(it, x + 7, y2 + (o.D ? o.D + 10 : 0), tw, o.s, { align: 'left', grp: g })], g, it.label));
      });
      return out;
    } });

  /* 3. Zigzag path: a stated order of 3 to 6 steps; numbered nodes on a vertical path, cards alternating sides. */
  regPlan('zigzag', { name: 'Zigzag path', family: 'zigzag', kind: 'sequence', appeal: 1, suits: P => planSeq(P) && P.items.length >= 3,
    needs: P => !planSeq(P) ? 'only for steps in a stated order' : P.items.length < 3 || P.items.length > 6 ? 'works for 3 to 6 steps' : '',
    opts: [{ s: 24, pad: 10 }, { s: 22, pad: 8 }],
    build: (P, R, o) => {
      const L = planOrder(P), n = L.length, rowH = R.h / n, D = Math.min(48, rowH - 6);
      if (D < 44) return planNo('too many steps for the height');
      const cx = R.x + R.w / 2, cw = R.w / 2 - D / 2 - 28, tw = cw - 2 * o.pad - 8;
      if (!L.every(it => planFits(it, tw, o.s) && planTextH(it, tw, o.s) + 2 * o.pad <= rowH - 4)) return planNo('a step does not fit its card');
      const out = [box('rect', cx - 2, R.y + rowH / 2, 4, R.h - rowH, { fill: SOFT })];
      L.forEach((it, i) => {
        const cy = R.y + rowH * i + rowH / 2, left = i % 2 === 0, c = accent(i), g = 'zz' + i, th = planTextH(it, tw, o.s) + 2 * o.pad;
        const x = left ? R.x : cx + D / 2 + 28, ky = cy - th / 2;
        out.push(...planGrp([box('rect', left ? x + cw : cx + D / 2, cy - 1.5, 28, 3, { fill: c }),
          box('roundRect', x, ky, cw, th, { fill: PANEL }), box('rect', left ? x + cw - 8 : x, ky, 8, th, { fill: c }),
          ...planText(it, x + o.pad + (left ? 0 : 8), ky + o.pad, tw, o.s, { align: 'left', grp: g }),
          box('ellipse', cx - D / 2, cy - D / 2, D, D, { fill: c, text: planN(i), size: 22, bold: true, color: textOn(c), align: 'center', valign: 'middle' })], g, it.label));
      });
      return out;
    } });

  /* 4. Two-column contrast: two things the content compares, each a coloured header over its points as icon rows. */
  regPlan('contrast', { name: 'Two-column contrast', family: 'contrast', kind: 'grouped', groups: true, appeal: 2,
    suits: P => P.relation === 'comparison' && planGroups(P).length === 2,
    needs: P => P.relation !== 'comparison' ? 'only for content that compares' : planGroups(P).length !== 2 || !planAllGrouped(P) ? 'needs exactly 2 things compared' :
      planGroups(P).some(x => x.items.length > 5) ? 'a side has more than 5 points' : '',
    opts: [{ s: 24, D: 40, pad: 10 }, { s: 22, D: 36, pad: 8 }, { s: 22, D: 0, pad: 8 }],
    build: (P, R, o) => {
      const G = planGroups(P), gap = 36, cw = (R.w - gap) / 2, HH = 56, m = Math.max(...G.map(x => x.items.length));
      const rowH = (R.h - HH - 12 - 10 * (m - 1)) / m, tw = cw - 2 * o.pad - (o.D ? o.D + 12 : 0);
      if (!G.every(x => planWords(x.g.name, cw - 20, 24) && linesAt(x.g.name, cw - 20, 24) <= 1)) return planNo('a side name does not fit its header');
      if (!G.every(x => x.items.every(it => planFits(it, tw, o.s) && planTextH(it, tw, o.s) + 2 * o.pad <= rowH))) return planNo('a point does not fit its row');
      const out = [box('rect', R.x + cw + gap / 2 - 1.5, R.y + HH + 12, 3, R.h - HH - 12, { fill: SOFT })];
      G.forEach((x, k) => {
        const X = R.x + k * (cw + gap), c = accent(k * 3);
        out.push(box('roundRect', X, R.y, cw, HH, { fill: c, text: x.g.name, size: 24, bold: true, color: textOn(c), align: 'center', valign: 'middle' }));
        x.items.forEach((it, i) => {
          const y = R.y + HH + 12 + i * (rowH + 10), g = 'ct' + k + '_' + i, th = planTextH(it, tw, o.s);
          out.push(...planGrp([box('roundRect', X, y, cw, rowH, { fill: PANEL }),
            ...(o.D ? planIcon(objKey(it), X + o.pad, y + (rowH - o.D) / 2, o.D, c, W, g) : []),
            ...planText(it, X + o.pad + (o.D ? o.D + 12 : 0), y + (rowH - th) / 2, tw, o.s, { align: 'left', grp: g })], g, it.label));
        });
      });
      return out;
    } });

  /* 5. (10.21.1) Cycle wheel: a cycle the content states, as numbered icon discs on a ring (clockwise from the top, the
     order given), each label and description outside its disc, the topic in the middle when it fits. */
  regPlan('cyclewheel', { name: 'Cycle wheel', family: 'cyclewheel', kind: 'pictorial', appeal: 3,
    suits: P => P.relation === 'cycle' && P.items.length >= 3 && P.items.length <= 6,
    needs: P => P.relation !== 'cycle' ? 'only for a cycle stated in the content' : P.items.length < 3 || P.items.length > 6 ? 'works for 3 to 6 steps' : '',
    opts: [{ s: 24, D: 84 }, { s: 22, D: 72 }, { s: 22, D: 60 }],
    build: (P, R, o) => {
      const L = planOrder(P), n = L.length, D = o.D, cx = R.x + R.w / 2, cy = R.y + R.h / 2;
      const ry = R.h / 2 - D / 2 - 4, rx = Math.min(ry * 1.2, R.w * 0.2), out = [box('ellipse', cx - rx, cy - ry, 2 * rx, 2 * ry, { fill: null, line: SOFT, lineW: 8 })];
      const boxes = [];
      L.forEach((it, i) => {
        const a = -Math.PI / 2 + i * 2 * Math.PI / n, nx = cx + rx * Math.cos(a), ny = cy + ry * Math.sin(a), right = Math.cos(a) > -0.05;
        const NB = 42, x0 = right ? nx + D / 2 + 16 + NB : R.x, x1 = right ? R.x + R.w : nx - D / 2 - 16 - NB, tw = x1 - x0;
        if (tw < 160 || !planFits(it, tw, o.s)) return boxes.push(null);
        const th = planTextH(it, tw, o.s), ty = Math.max(R.y, Math.min(R.y + R.h - th, ny - th / 2));
        boxes.push({ x: x0, y: ty, w: tw, h: th, it, i, nx, ny, right });
      });
      if (boxes.some(b => !b)) return planNo('a step does not fit beside the wheel');
      const hit = (p, q) => p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;
      if (boxes.some((p, i) => boxes.some((q, j) => j > i && hit(p, q)))) return planNo('the steps overlap around the wheel');
      // the topic in the middle, only when it fits at 22 pt inside the ring
      const topic = String(P.short || P.title || '').trim(), inner = 2 * Math.min(rx, ry) * 0.62;
      if (topic && planWords(topic, inner, 22) && linesAt(topic, inner, 22) <= 3)
        out.push(label(cx - inner / 2, cy - planLH(topic, inner, 22) / 2, inner, planLH(topic, inner, 22), topic, { size: 22, bold: true, color: INK, align: 'center', valign: 'middle' }));
      boxes.forEach(b => {
        const c = accent(b.i), g = 'cw' + b.i, nb = 42;
        out.push(...planGrp([...planIcon(objKey(b.it), b.nx - D / 2, b.ny - D / 2, D, W, c, g),
          planNum(b.i, b.right ? b.nx + D / 2 + 8 : b.nx - D / 2 - 8 - nb, b.ny - nb / 2, nb, c, g),
          ...planText(b.it, b.x, b.y, b.w, o.s, { align: b.right ? 'left' : 'right', grp: g })], g, b.it.label));
      });
      return out;
    } });
});
