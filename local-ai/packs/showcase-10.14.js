/* AI Visual Builder design pack "showcase" 10.14.0 - hero-style educational slide visuals: a strong focal element (a
   large object for the topic, a colour hero panel, big icons), a headline and, when the plan has one, a one-line
   takeaway, so a learner sees at once what the slide is about. Four compositions:
     spotlight  a hero panel (topic object, headline, takeaway) beside the points
     storyboard visual summary cards with big icon headers, the takeaway above them
     callout    the topic's object large in the middle, the points called out around it on leader lines
     journey    a learning journey: the steps as milestones on a winding path (only for a stated order)
   The same rules as every family (packs/README.txt): native shapes only (editable), approved colours, Open Sans, every
   label and description at 22 pt and up (headlines 28-36 pt), and only what the content states - numbers only for a
   stated order, an object for the topic only when the catalogue has an accurate one (never a generic picture).
   The plan's headline and takeaway come from Claude's design (plan.headline, plan.takeaway); for a plan read from the
   text the headline is its title and there is no takeaway. Loaded after plan.js. */
registerPack('showcase', '10.14.0', () => {
  const W = '#FFFFFF', SOFT = '#D9D9D9', NEUTRAL = '#7F7F7F';
  const objKey = it => it.icon || 'none';
  const headOf = P => planClean(P.headline || P.title || '');
  /* The topic's own object: Claude's choice, else the catalogue's accurate match for the title (none: no object). */
  const topicIcon = P => { if (P.hero && CMP[P.hero]) return P.hero; const t = [{ label: P.title || '', detail: P.headline || '' }]; planIcons(t); return t[0].icon !== 'none' ? t[0].icon : ''; };
  const fitsBox = (t, w, h, s) => !!t && planWords(t, w, s) && fitsAt(t, w, h, s);
  const marker = (P, i, x, y, D, col, it, g) => planSeq(P)
    ? [box('ellipse', x, y, D, D, { fill: col, text: planN(i), size: PLAN_DS, bold: true, color: INK, align: 'center', valign: 'middle', grp: g })]
    : objKey(it) === 'none' ? [box('ellipse', x + D * 0.3, y + D * 0.3, D * 0.4, D * 0.4, { fill: col, grp: g })]   // no accurate object: a bullet
    : planIcon(objKey(it), x, y, D, W, col, g);                          // the point's object, white on its colour

  /* 1. Spotlight: a colour hero panel - the topic's object on a white disc, the headline, the takeaway - and the points
     beside it, each with its number (a stated order) or its object, divided by fine rules. */
  regPlan('spotlight', { name: 'Spotlight', family: 'spotlight', kind: 'hero', suits: P => P.items.length >= 3 && P.items.length <= 6 && !!headOf(P),
    needs: P => P.items.length < 3 || P.items.length > 6 ? 'works for 3 to 6 points' : !headOf(P) ? 'needs a topic for the headline' : '',
    opts: [{ s: 24, hs: 34, D: 120, B: 48, hw: 0.38 }, { s: 22, hs: 30, D: 100, B: 44, hw: 0.36 }, { s: 22, hs: 28, D: 0, B: 40, hw: 0.34 }],
    build: (P, R, o) => {
      const hw = R.w * o.hw, pad = 26, tw = hw - 2 * pad, head = headOf(P), ic = o.D ? topicIcon(P) : '', D = ic ? o.D : 0;
      const hh = planLH(head, tw, o.hs), ta = P.takeaway && planWords(P.takeaway, tw, PLAN_DS) ? planTH(P.takeaway, tw, PLAN_DS) : 0;
      if (!planWords(head, tw * 0.95, o.hs) || linesAt(head, tw * 0.95, o.hs) > 3 || (D ? D + 18 : 0) + hh + (ta ? ta + 6 : 0) > R.h - 2 * pad) return planNo('the headline does not fit the hero panel');
      const lx = R.x + hw + 34, lw = R.w - hw - 34 - o.B - 18, rows = P.items.map(it => planTextH(it, lw, o.s));
      if (!P.items.every(it => planFits(it, lw, o.s))) return planNo('a point does not fit beside the hero panel');
      const used = rows.reduce((a, h) => a + Math.max(h, o.B), 0), gap = (R.h - used) / P.items.length;
      if (gap < 10) return planNo('the points do not fit beside the hero panel');
      const out = [box('roundRect', R.x, R.y, hw, R.h, { fill: accent(0) })];
      let y = R.y + pad + (R.h - 2 * pad - (D ? D + 18 : 0) - hh - (ta ? ta + 6 : 0)) / 2;
      if (D) { out.push(...planIcon(ic, R.x + (hw - D) / 2, y, D, accent(0), W, 'hero')); y += D + 18; }
      out.push(label(R.x + pad, y, tw, hh, head, { size: o.hs, bold: true, color: INK, align: 'center', valign: 'top', grp: 'hero' }));
      if (ta) out.push(label(R.x + pad, y + hh, tw, ta, P.takeaway, { size: PLAN_DS, color: INK, align: 'center', valign: 'top', grp: 'hero' }));
      let ry = R.y + gap / 2;
      planOrder(P).forEach((it, i) => {
        const h = Math.max(rows[P.items.indexOf(it)], o.B), g = 'pt' + i, col = accent(i + 1);
        out.push(...planGrp(marker(P, i, lx, ry + (h - o.B) / 2, o.B, col, it, g).concat(planText(it, lx + o.B + 18, ry + (h - rows[P.items.indexOf(it)]) / 2, lw, o.s, { grp: g })), g, it.label));
        if (i < P.items.length - 1) out.push(box('rect', lx, ry + h + gap / 2 - 1, R.x + R.w - lx, 2, { fill: SOFT }));
        ry += h + gap;
      });
      return out;
    } });

  /* 2. Storyboard: visual summary cards - each point a card with a big colour header holding its object, the label
     and description under it; the takeaway (when there is one) on a band above the cards. */
  regPlan('storyboard', { name: 'Visual summary cards', family: 'storyboard', kind: 'pictorial', suits: P => P.items.length >= 3 && P.items.length <= 5,
    needs: P => P.items.length < 3 || P.items.length > 5 ? 'works for 3 to 5 points' : !P.items.every(it => it.icon && it.icon !== 'none') ? 'needs an accurate object for every point' : '',
    opts: [{ s: 24, D: 96, pad: 14 }, { s: 22, D: 80, pad: 12 }, { s: 22, D: 64, pad: 10 }],
    build: (P, R, o) => {
      const L = planOrder(P), n = L.length, gap = 20, ta = P.takeaway && fitsBox(P.takeaway, R.w - 60, 58, PLAN_DS) ? 64 : 0, top = R.y + (ta ? ta + 14 : 0);
      const cw = (R.w - gap * (n - 1)) / n, room = R.y + R.h - top, hh = o.D + 2 * o.pad + 10, tw = cw - 2 * o.pad;
      if (!L.every(it => planFits(it, tw, o.s) && hh + 12 + planTextH(it, tw, o.s) + o.pad <= room)) return planNo('a point does not fit its card');
      // the cards as tall as their longest text (with room to breathe), centred in what is left
      const ch = Math.min(room, hh + 12 + Math.max(...L.map(it => planTextH(it, tw, o.s))) + 3 * o.pad + 16), y0 = top + (room - ch) / 2;
      const out = ta ? [box('pill', R.x, R.y, R.w, ta, { fill: PANEL, text: P.takeaway, size: PLAN_DS, bold: true, color: INK, align: 'center', valign: 'middle' })] : [];
      L.forEach((it, i) => {
        const x = R.x + i * (cw + gap), c = accent(i), g = 'card' + i;
        out.push(...planGrp([box('roundRect', x, y0, cw, ch, { fill: PANEL }), box('roundRect', x, y0, cw, hh, { fill: c }), box('rect', x, y0 + hh - 14, cw, 14, { fill: c }),
          ...planIcon(objKey(it), x + (cw - o.D) / 2, y0 + o.pad + 5, o.D, c, W, g),
          ...(planSeq(P) ? [box('ellipse', x + 10, y0 + 10, 44, 44, { fill: W, text: planN(i), size: PLAN_DS, bold: true, color: INK, align: 'center', valign: 'middle' })] : []),
          ...planText(it, x + o.pad, y0 + hh + 12, tw, o.s, { align: 'center', grp: g })], g, it.label));
      });
      return out;
    } });

  /* 3. Callout diagram: the topic's object large in the middle, the points around it (left and right), each joined to
     it by a leader line - a labelled concept visual. Only when the catalogue has an accurate object for the topic. */
  regPlan('callout', { name: 'Callout diagram', family: 'callout', kind: 'hero', suits: P => P.items.length >= 3 && P.items.length <= 6 && !!topicIcon(P),
    needs: P => P.items.length < 3 || P.items.length > 6 ? 'works for 3 to 6 points' : !topicIcon(P) ? 'needs an accurate object for the topic' : '',
    opts: [{ s: 24, D: 270, B: 52 }, { s: 22, D: 240, B: 46 }, { s: 22, D: 210, B: 42 }],
    build: (P, R, o) => {
      const L = planOrder(P), n = L.length, left = L.slice(0, Math.ceil(n / 2)), right = L.slice(Math.ceil(n / 2));
      const D = Math.min(o.D, R.h - 20), cx = R.x + R.w / 2, cy = R.y + R.h / 2, tw = (R.w - D) / 2 - o.B - 46;
      if (!L.every(it => planFits(it, tw, o.s))) return planNo('a point does not fit beside the object');
      const side = (list, isLeft) => { const hs = list.map(it => Math.max(planTextH(it, tw, o.s), o.B)), tot = hs.reduce((a, b) => a + b, 0), gap = (R.h - tot) / list.length;
        return gap < 8 ? null : { hs, gap }; };
      const sl = side(left, true), sr = right.length ? side(right, false) : { hs: [], gap: 0 };
      if (!sl || !sr) return planNo('the points do not fit around the object');
      const out = [box('ellipse', cx - D / 2 - 14, cy - D / 2 - 14, D + 28, D + 28, { fill: PANEL }), ...planIcon(topicIcon(P), cx - D / 2, cy - D / 2, D, accent(0), W, 'hero')];
      const lines = [], put = (list, S, isLeft, k0) => { let y = R.y + S.gap / 2;
        list.forEach((it, j) => {
          const i = k0 + j, h = S.hs[j], g = 'co' + i, bx = isLeft ? R.x + tw + 16 : R.x + R.w - tw - 16 - o.B, by = y + (h - o.B) / 2, col = accent(i + 1);
          const tx = isLeft ? R.x : R.x + R.w - tw, th = planTextH(it, tw, o.s);
          // the leader: from the badge to the object's edge, aimed at its centre
          const ax = isLeft ? bx + o.B : bx, ay = by + o.B / 2, ang = Math.atan2(ay - cy, ax - cx), ex = cx + Math.cos(ang) * (D / 2 + 16), ey = cy + Math.sin(ang) * (D / 2 + 16);
          lines.push(seg(ax + (isLeft ? 4 : -4), ay, ex, ey, NEUTRAL, 2));
          out.push(...planGrp(marker(P, i, bx, by, o.B, col, it, g).concat(planText(it, tx, y + (h - th) / 2, tw, o.s, { align: 'left', grp: g })), g, it.label));
          y += h + S.gap;
        }); };
      put(left, sl, true, 0); put(right, sr, false, left.length);
      return lines.concat(out);
    } });

  /* 4. Learning journey: the steps as milestones on a winding path - along the top from left to right, down, and back
     along the bottom - each milestone the step's object on a colour disc, its label and description outside the path.
     Only for a stated order. */
  regPlan('journey', { name: 'Learning journey', family: 'journey', kind: 'sequence', suits: P => planSeq(P) && P.items.length >= 4 && P.items.length <= 8,
    needs: P => !planSeq(P) ? 'only for steps in a stated order' : P.items.length < 4 || P.items.length > 8 ? 'works for 4 to 8 steps' : '',
    opts: [{ s: 24, D: 60 }, { s: 22, D: 54 }, { s: 22, D: 46 }],
    build: (P, R, o) => {
      const L = planOrder(P), n = L.length, k = Math.ceil(n / 2), m = n - k, band = 16, turn = 46;
      const col = (R.w - turn - 20) / k, tw = col - 14, road1 = R.y + R.h * 0.5 - 48, road2 = R.y + R.h * 0.5 + 48;
      const up = road1 - R.y - o.D / 2 - 10, down = R.y + R.h - road2 - o.D / 2 - 10;
      if (!L.every((it, i) => planFits(it, tw, o.s) && planTextH(it, tw, o.s) <= (i < k ? up : down))) return planNo('a step does not fit beside the path');
      const xr = R.x + 10 + k * col, out = [box('roundRect', R.x + 10, road1 - band / 2, xr - R.x - 10 + band, band, { fill: SOFT }),
        box('roundRect', xr, road1 - band / 2, band, road2 - road1 + band, { fill: SOFT }),
        box('roundRect', R.x + 10 + (k - m) * col, road2 - band / 2, xr - R.x - 10 - (k - m) * col + band, band, { fill: SOFT })];
      L.forEach((it, i) => {
        const top = i < k, j = top ? i : k - 1 - (i - k), cx = R.x + 10 + col * (j + 0.5), cy = top ? road1 : road2, c = accent(i), g = 'j' + i, h = planTextH(it, tw, o.s);
        const ty = top ? cy - o.D / 2 - 10 - h : cy + o.D / 2 + 10;
        out.push(...planGrp([box('ellipse', cx - o.D / 2 - 5, cy - o.D / 2 - 5, o.D + 10, o.D + 10, { fill: W }), ...planIcon(objKey(it), cx - o.D / 2, cy - o.D / 2, o.D, W, c, g),
          ...planText(it, cx - tw / 2, ty, tw, o.s, { align: 'center', grp: g })], g, it.label));
      });
      return out;
    } });
});
