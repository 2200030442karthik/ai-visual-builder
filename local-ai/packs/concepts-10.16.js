/* AI Visual Builder design pack "concepts" 10.16.0 - concept compositions: six visual ideas that are structurally
   different from the panel, column and card arrangements of the other packs (V10.15 offered mostly those, so a gallery
   of grouped content looked like the same grid ten times). Each is a different picture of the same content:
     concepttiles  the subject as a hero card, a bracket, its items as icon tiles in a panel (the polished "AI
                   infographic" composition: Claude AI -> written copy, code-based animations, presentations, ...)
     orbit         the subject as a hub disc inside a ring, every item an object disc on a spoke around it
     honeycomb     every item in a hexagon along a zigzag, the subject as the large first hexagon
     isostack      isometric slabs, one per section (or item), each labelled beside the stack
     bento         a bento grid: the subject as the large tile, the items as colour tiles of different sizes
     keystatement  a statement's subject in large type with what it does as colour pills, its items as an object row
   Also new objects: presentation (easel with a chart), aidoc (a document marked AI), and catalogue terms for written
   copy, presentations, AI-marked or AI-generated text and animations. The same rules as every family
   (packs/README.txt): native shapes only, approved colours, Open Sans, labels and descriptions at 22 pt and up, only
   what the content states. Loaded after plan.js, sections.js and the learning pack. */
registerPack('concepts', '10.16.0', () => {
  const W = '#FFFFFF', LINE = '#7F7F7F', SOFT = '#D9D9D9';

  /* ---------- objects ---------- */
  const add = (key, name, strong, weak) => {
    const terms = (list, w) => (list || '').split(' | ').map(t => t.trim()).filter(Boolean).map(t => ({
      re: new RegExp('(?:^|[^\\w-])' + t.replace(/\*/g, '\\w*') + '(?![\\w])', 'i'), w: w * (/\s|\\s| \?/.test(t) ? 1.5 : 1), t }));
    CATALOG.unshift({ key, name, terms: terms(strong, 2).concat(terms(weak, 1)) });
    if (!CMP_NAMES[key]) CMP_NAMES[key] = name;
  };
  Object.assign(CMP, {
    presentation: (x, y, s, c) => [
      box('rect', x + s * .08, y + s * .1, s * .84, s * .52, { fill: W, line: c, lineW: Math.max(2, s * .035) }),
      box('rect', x + s * .04, y + s * .06, s * .92, s * .07, { fill: c }),
      box('rect', x + s * .26, y + s * .38, s * .1, s * .18, { fill: c }), box('rect', x + s * .45, y + s * .3, s * .1, s * .26, { fill: c }),
      box('rect', x + s * .64, y + s * .2, s * .1, s * .36, { fill: c }),
      box('rect', x + s * .47, y + s * .62, s * .06, s * .2, { fill: c }),
      box('triangle', x + s * .3, y + s * .78, s * .4, s * .16, { fill: c })],
    aidoc: (x, y, s, c) => [
      box('foldedCorner', x + s * .22, y + s * .06, s * .62, s * .82, { fill: W, line: c, lineW: Math.max(2, s * .035) }),
      box('rect', x + s * .36, y + s * .24, s * .36, s * .06, { fill: c }), box('rect', x + s * .36, y + s * .38, s * .36, s * .06, { fill: c }),
      box('rect', x + s * .36, y + s * .52, s * .24, s * .06, { fill: c }),
      box('ellipse', x + s * .04, y + s * .52, s * .42, s * .42, { fill: c }), box('star5', x + s * .11, y + s * .58, s * .28, s * .28, { fill: W })],
  });
  add('aidoc', 'AI-marked text', 'ai-marked text | ai-marked | ai-generated (?:text|content) | ai-written | watermark* | ai detection');
  add('presentation', 'Presentation', 'presentations? | slides? | slide decks? | decks? | pitch(?:es)? | keynotes?');
  add('text', 'Written copy', 'written copy | copy | copywriting | blog posts? | articles?');
  add('video', 'Animation', 'animations? | animated | motion graphics');

  /* ---------- reading the plan (as the learning pack) ---------- */
  const objKey = it => it.icon && CMP[it.icon] ? it.icon : 'none';
  const secsOf = P => { const G = planGroups(P);
    return G.length >= 2 && planAllGrouped(P) ? G.map(x => ({ name: x.g.name, items: x.items })) : [{ name: P.sectionName || '', items: planOrder(P) }]; };
  const named = P => secsOf(P).length >= 2;
  const shortOf = P => planClean(P.short || secShort(planClean(P.title || '')) || '');
  const topicIcon = P => (P.hero && CMP[P.hero]) ? P.hero : heroFor(shortOf(P), P.title || '', P.headline || '');
  const verbsOf = P => (P.verbs || []).filter(Boolean);
  const verbLine = P => verbsOf(P).join(' · ');
  // the heading next to the verbs: the statement's object (its verbs are drawn on their own), else the section's name
  const objName = P => P.statement && verbsOf(P).length ? secCap(P.statement.object || '') : (P.sectionName || '');
  const tw = (t, s, b) => String(t).length * s * (b ? 0.6 : 0.55);
  const pillW = (t, s) => tw(t, s, true) + Math.round(s * 1.8) * 0.6 + 30;
  const flat = P => { const S = secsOf(P), out = []; S.forEach((sec, si) => sec.items.forEach(it => out.push({ it, si }))); return out; };
  // an item's colour: its section's when there are named sections, else its own
  const colOf = (P, si, j) => named(P) ? accent(si + 1) : accent(j + 1);
  const disc = (it, x, y, D, col, g, bg) => objKey(it) === 'none'
    ? [box('ellipse', x, y, D, D, { fill: bg || W, grp: g }), box('ellipse', x + D * 0.3, y + D * 0.3, D * 0.4, D * 0.4, { fill: col, grp: g })]
    : [box('ellipse', x, y, D, D, { fill: bg || W, grp: g })].concat(comp(objKey(it), x + D * 0.14, y + D * 0.14, D * 0.72, col).map(q => Object.assign(q, { grp: g })));
  const plain = (key, x, y, D, col, g) => comp(key, x, y, D, col).map(q => Object.assign(q, { grp: g }));
  const fitsAll = (L, w, s, n) => L.every(it => planFits(it, w, s, n || 2));
  const colH = (L, w, s) => Math.max(...L.map(it => planTextH(it, w, s)));
  const shortFits = (t, w, s, n) => planWords(t, w, s) && linesAt(t, w * 0.95, s) <= (n || 2);
  // the section names as a row of colour pills (a legend) - every name is shown
  const legend = (P, x, y, maxW, s) => { const S = secsOf(P); if (!named(P)) return { h: 0, out: [] };
    const out = []; let cx = x; const h = Math.round(s * 1.7);
    for (let i = 0; i < S.length; i++) { const w = pillW(S[i].name, s); if (cx + w > x + maxW) return null;
      out.push(box('pill', cx, y, w, h, { fill: accent(i + 1), text: S[i].name, size: s, bold: true, color: INK, align: 'center', valign: 'middle', grp: 'legend' })); cx += w + 12; }
    return { h, out, w: cx - 12 - x }; };

  // a heading row for one list: the subject (when the composition has no hero for it) and the heading (a statement's
  // own words for what it does), with a rule; returns the area left below it, or null when it does not fit
  const headRow = (P, R, withShort) => {
    const name = named(P) ? '' : P.sectionName || '', sh = withShort ? shortOf(P) : '', h = 40, out = [];
    if (!name && !sh) return { out, R };
    let x = R.x;
    if (sh) { const w = tw(sh, 28, true) + 18; if (w > R.w * 0.5) return null; out.push(label(x, R.y, w, h, sh, { size: 28, bold: true, color: INK, align: 'left', valign: 'middle', grp: 'head' })); x += w + 10; }
    if (name) { const w = R.x + R.w - x; if (tw(name, 24) > w - 16) return null; out.push(label(x, R.y, w, h, name, { size: 24, color: INK, align: 'left', valign: 'middle', grp: 'head' })); }
    out.push(rule(R.x, R.y + h + 4, R.w, 3, accent(0)));
    return { out, R: { x: R.x, y: R.y + h + 20, w: R.w, h: R.h - h - 20 } };
  };

  /* 1. Concept tiles: hero card (object, subject, what it does), bracket, the items as icon tiles in a panel. */
  regPlan('concepttiles', { name: 'Concept tiles', family: 'concepttiles', kind: 'hero', groups: true,
    suits: P => P.items.length >= 2 && P.items.length <= 8 && !!shortOf(P) && secsOf(P).length <= 2,
    needs: P => !shortOf(P) ? 'needs a subject for the hero card' : P.items.length > 8 ? 'works for up to 8 items' : secsOf(P).length > 2 ? 'works for up to 2 sections' : '',
    opts: [{ s: 24, D: 76, hs: 34, hw: 0.28 }, { s: 22, D: 64, hs: 30, hw: 0.27 }, { s: 22, D: 52, hs: 28, hw: 0.24 }, { s: 22, D: 44, hs: 26, hw: 0.2 }, { s: 22, D: 42, hs: 26, hw: 0.17, tight: true }],
    build: (P, R, o) => {
      const F = flat(P), n = F.length, short = shortOf(P), ic = topicIcon(P), hw = Math.round(R.w * o.hw), vl = verbLine(P);
      if (!shortFits(short, hw - 40, o.hs)) return planNo('the subject does not fit the hero card');
      if (vl && !(planWords(vl, hw - 40, 22) && linesAt(vl, hw - 40, 22) <= 2)) return planNo('what it does does not fit the hero card');
      const px = R.x + hw + (o.tight ? 56 : 70), pw = R.x + R.w - px, S = secsOf(P), title = !named(P) ? objName(P) : '', gap = o.tight ? 10 : 14, pad = 16, ip = o.tight ? 6 : 9;
      // rows of tiles: one row per section when there are sections, else a balanced grid
      let grid;
      if (named(P)) grid = S.map((x, si) => x.items.map(it => ({ it, si })));
      else { const c0 = n <= 3 ? n : n === 4 ? 2 : n <= 6 ? 3 : 4; grid = []; for (let k = 0; k < n; k += c0) grid.push(F.slice(k, k + c0)); }
      const cols = Math.max(...grid.map(r => r.length)), rows = grid.length, th = title ? Math.round(22 * 1.7) : 0, py = R.y + th / 2;
      if (title && pillW(title, 22) > pw - 40) return planNo('the heading does not fit the panel');
      const lg = legend(P, px + pad, py + pad, pw - 2 * pad, 22); if (!lg) return planNo('the section names do not fit');
      const top = py + (title ? th / 2 + 10 : lg.h ? pad + lg.h + 10 : pad), tileW = (pw - 2 * pad - gap * (cols - 1)) / cols;
      if (!fitsAll(F.map(f => f.it), tileW - 2 * ip, o.s)) return planNo('a label does not fit its tile');
      const lab = colH(F.map(f => f.it), tileW - 2 * ip, o.s), tileH = 12 + o.D + 8 + lab + 10, need = top - R.y + rows * tileH + (rows - 1) * gap + pad;
      if (need > R.h) return planNo('the tiles do not fit the panel');
      const out = [], ex = (R.h - need) / (rows + 1);
      // hero card
      const nh = planLH(short, hw - 40, o.hs), vh = vl ? planTH(vl, hw - 40, 22) : 0, HD = ic ? Math.min(hw - 70, R.h - nh - vh - 70) : 0, hy = R.y + (R.h - (HD ? HD + 18 : 0) - nh - vh) / 2;
      out.push(box('roundRect', R.x, R.y, hw, R.h, { fill: accent(1), grp: 'hero' }));
      if (HD) out.push(...disc({ icon: ic }, R.x + (hw - HD) / 2, hy, HD, accent(4), 'hero', W));
      out.push(label(R.x + 20, hy + (HD ? HD + 18 : 0), hw - 40, nh, short, { size: o.hs, bold: true, color: INK, align: 'center', valign: 'top', grp: 'hero' }));
      if (vl) out.push(label(R.x + 20, hy + (HD ? HD + 18 : 0) + nh - 4, hw - 40, vh, vl, { size: 22, color: INK, align: 'center', valign: 'top', grp: 'hero' }));
      // panel and bracket
      out.push(box('roundRect', px, py, pw, R.y + R.h - py, { fill: PANEL, grp: 'panel' }));
      if (title) out.push(box('pill', px + (pw - pillW(title, 22)) / 2, R.y, pillW(title, 22), th, { fill: accent(0), text: title, size: 22, bold: true, color: INK, align: 'center', valign: 'middle', grp: 'panel' }));
      out.push(...lg.out);
      const my = R.y + R.h / 2, bx = R.x + hw + (px - R.x - hw) / 2, rowY = r => top + ex * (r + 1) + r * (tileH + gap), ys = rows === 1 ? [my] : [rowY(0) + tileH / 2, rowY(rows - 1) + tileH / 2];
      out.push(seg(R.x + hw, my, bx, my, accent(0), 3));
      if (ys.length > 1) out.push(seg(bx, Math.min(ys[0], my), bx, Math.max(ys[1], my), accent(0), 3));
      ys.forEach(y => { out.push(seg(bx, y, px - 8, y, accent(0), 3)); out.push(box('ellipse', px - 14, y - 7, 14, 14, { fill: accent(0) })); });
      // tiles
      let k = 0;
      grid.forEach((row, r) => row.forEach((f, c) => {
        const off = (cols - row.length) * (tileW + gap) / 2, x = px + pad + off + c * (tileW + gap), y = rowY(r), col = colOf(P, f.si, k), g = 'tile' + k;
        out.push(box('roundRect', x, y, tileW, tileH, { fill: W }), rule(x + tileW * 0.3, y + tileH - 7, tileW * 0.4, 5, col));
        out.push(...(objKey(f.it) === 'none' ? [box('ellipse', x + (tileW - o.D * .5) / 2, y + 12 + o.D * .25, o.D * .5, o.D * .5, { fill: col, grp: g })] : plain(objKey(f.it), x + (tileW - o.D) / 2, y + 12, o.D, col, g)));
        out.push(...planText(f.it, x + ip, y + 12 + o.D + 8, tileW - 2 * ip, o.s, { align: 'center', grp: g }));
        k++;
      }));
      return out;
    } });

  /* 2. Ecosystem orbit: the subject as a hub disc inside a dashed ring, every item an object disc on a spoke, its label
     outside (above for the upper half, below for the lower half). */
  regPlan('orbit', { name: 'Ecosystem orbit', family: 'orbit', kind: 'hub', groups: true,
    suits: P => P.items.length >= 3 && P.items.length <= 8 && !!shortOf(P),
    needs: P => !shortOf(P) ? 'needs a subject for the hub' : P.items.length < 3 || P.items.length > 8 ? 'works for 3 to 8 items' : '',
    opts: [{ s: 24, D: 74, hs: 30 }, { s: 22, D: 64, hs: 28 }, { s: 22, D: 56, hs: 26 }, { s: 22, D: 48, hs: 22 }],
    build: (P, R, o) => {
      const HR = headRow(P, R, !named(P) && !!P.sectionName), inHead = !named(P) && !!P.sectionName; if (!HR) return planNo('the heading does not fit'); R = HR.R;
      const LG = legend(P, R.x, R.y, R.w, 22); if (!LG) return planNo('the section names do not fit');
      if (LG.h) { HR.out.push(...LG.out); R = { x: R.x, y: R.y + LG.h + 12, w: R.w, h: R.h - LG.h - 12 }; }
      const F = flat(P), n = F.length, short = shortOf(P), ic = topicIcon(P), cx = R.x + R.w / 2, cy = R.y + R.h / 2;
      const t = Math.ceil(n / 2), b = n - t, lw = Math.min(250, (R.w - 40) / Math.max(t, b) - 16);
      if (!fitsAll(F.map(f => f.it), lw, o.s)) return planNo('a label does not fit');
      const lab = colH(F.map(f => f.it), lw, o.s), ry = R.h / 2 - o.D / 2 - lab - 6, rx = R.w / 2 - Math.max(lw, o.D) / 2 - 6;
      if (ry < 80) return planNo('the labels leave no room for the ring');
      const HD = Math.min(2 * ry - o.D - 30, 230), out = HR.out.slice();
      if (HD < 110) return planNo('the hub is too small');
      if (!inHead && !shortFits(short, HD * 0.78, o.hs, 2)) return planNo('the subject does not fit the hub');
      const deg = d => d * Math.PI / 180, spread = (m, a0, a1) => m === 1 ? [(a0 + a1) / 2] : Array.from({ length: m }, (_, k) => a0 + (a1 - a0) * k / (m - 1)), ang = [];
      spread(t, 205, 335).forEach(d => ang.push(deg(d))); spread(b, b === 1 ? 90 : 155, b === 1 ? 90 : 25).forEach(d => ang.push(deg(d)));
      // ring (between the hub and the items) and spokes
      out.push(box('ellipse', cx - rx * 0.62, cy - ry * 0.78, rx * 1.24, ry * 1.56, { fill: null, line: SOFT, lineW: 2, dash: true }));
      ang.forEach((a, k) => out.push(seg(cx + Math.cos(a) * HD * 0.5, cy + Math.sin(a) * HD * 0.5, cx + Math.cos(a) * (rx - o.D * 0.55), cy + Math.sin(a) * (ry - o.D * 0.55), SOFT, 2.5)));
      // hub
      out.push(box('ellipse', cx - HD / 2, cy - HD / 2, HD, HD, { fill: accent(0), grp: 'hub' }));
      // the subject is in the heading row: the hub shows its object large; else the object and the subject's name
      if (inHead) { const OD = HD * 0.7; if (ic) out.push(...disc({ icon: ic }, cx - OD / 2, cy - OD / 2, OD, accent(4), 'hub', W)); }
      const nh = planLH(short, HD * 0.78, o.hs), OD = ic ? Math.min(HD * 0.42, HD - nh - 40) : 0;
      if (!inHead && OD) out.push(...disc({ icon: ic }, cx - OD / 2, cy - (OD + 8 + nh) / 2, OD, accent(4), 'hub', W));
      if (!inHead) out.push(label(cx - HD * 0.39, cy - (OD ? (OD + 8 + nh) / 2 - OD - 8 : nh / 2), HD * 0.78, nh, short, { size: o.hs, bold: true, color: INK, align: 'center', valign: 'top', grp: 'hub' }));
      F.forEach((f, k) => {
        const a = ang[k], x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry, col = colOf(P, f.si, k), g = 'it' + k, up = Math.sin(a) < 0;
        out.push(box('ellipse', x - o.D / 2 - 5, y - o.D / 2 - 5, o.D + 10, o.D + 10, { fill: col, grp: g }));
        out.push(...disc(f.it, x - o.D / 2, y - o.D / 2, o.D, col, g, W));
        const h = planTextH(f.it, lw, o.s);
        out.push(...planText(f.it, x - lw / 2, up ? y - o.D / 2 - 8 - h : y + o.D / 2 + 8, lw, o.s, { align: 'center', grp: g }));
      });
      return out;
    } });

  /* 3. Hexagon cluster: the subject in a large hexagon on the left, each item in a hexagon along a zigzag, labels above
     the upper row and below the lower row. */
  regPlan('honeycomb', { name: 'Hexagon cluster', family: 'honeycomb', kind: 'pictorial', groups: true,
    suits: P => !named(P) && P.items.length >= 3 && P.items.length <= 8,
    needs: P => named(P) ? 'for one list (sections are shown by the other compositions)' : P.items.length < 3 || P.items.length > 8 ? 'works for 3 to 8 items' : '',
    opts: [{ s: 24, hs: 30 }, { s: 22, hs: 28 }, { s: 22, hs: 24 }],
    build: (P, R, o) => {
      const HR = headRow(P, R, false); if (!HR) return planNo('the heading does not fit'); R = HR.R;
      const F = flat(P), n = F.length, short = shortOf(P), ic = topicIcon(P), heroW = short ? Math.min(250, R.w * 0.24) : 0;
      const x0 = R.x + (heroW ? heroW + 30 : 0), avail = R.x + R.w - x0, hx0 = Math.min(190, avail / (n * 0.82 + 0.18)), lw = Math.min(2 * hx0 * 0.82 - 14, 260);
      if (!fitsAll(F.map(f => f.it), lw, o.s)) return planNo('a label does not fit');
      const lab = colH(F.map(f => f.it), lw, o.s), hh = Math.min(hx0 * 0.86, (R.h / 2 - 8 - lab) / 0.86), hx = hh / 0.86, step = Math.max(hx * 0.82, Math.min(hx0 * 0.82, (avail - hx) / Math.max(1, n - 1))), off = hh * 0.36, need = 2 * (off + hh / 2 + 8 + lab);
      if (hh < 90) return planNo('the hexagons would be too small');
      if (need > R.h) return planNo('the labels do not fit above and below the hexagons');
      const cy = R.y + R.h / 2, out = HR.out.slice(), sx = x0 + (avail - (step * (n - 1) + hx)) / 2;
      if (heroW) {
        const H = Math.min(R.h * 0.78, heroW * 0.9), nh = planLH(short, heroW * 0.62, o.hs), OD = ic ? Math.min(H * 0.4, H - nh - 30) : 0;
        if (!shortFits(short, heroW * 0.62, o.hs)) return planNo('the subject does not fit its hexagon');
        out.push(box('hexagon', R.x, cy - H / 2, heroW, H, { fill: accent(0), grp: 'hero' }));
        if (OD) out.push(...disc({ icon: ic }, R.x + (heroW - OD) / 2, cy - (OD + 6 + nh) / 2, OD, accent(4), 'hero', W));
        out.push(label(R.x + heroW * 0.19, cy - (OD + 6 + nh) / 2 + (OD ? OD + 6 : 0), heroW * 0.62, nh, short, { size: o.hs, bold: true, color: INK, align: 'center', valign: 'top', grp: 'hero' }));
        out.push(seg(R.x + heroW, cy, sx, cy, SOFT, 3));
      } else out.push(seg(sx + hx / 2, cy, sx + step * (n - 1) + hx / 2, cy, SOFT, 3));
      F.forEach((f, k) => {
        const up = k % 2 === 0, x = sx + k * step, y = cy + (up ? -off : off) - hh / 2, col = colOf(P, f.si, k), g = 'hex' + k, D = hh * 0.56;
        out.push(box('hexagon', x, y, hx, hh, { fill: col, grp: g }));
        out.push(...disc(f.it, x + (hx - D) / 2, y + (hh - D) / 2, D, col, g, W));
        const h = planTextH(f.it, lw, o.s);
        out.push(...planText(f.it, x + hx / 2 - lw / 2, up ? y - 8 - h : y + hh + 8, lw, o.s, { align: 'center', grp: g }));
      });
      return out;
    } });

  /* 4. Layered stack: isometric slabs on the left (one per section, else one per item), each labelled on the right
     with a leader line; the subject as the stack's caption. */
  regPlan('isostack', { name: 'Layered stack', family: 'isostack', kind: 'layered', groups: true,
    suits: P => { const S = secsOf(P); return named(P) ? S.length <= 4 && !P.items.some(i => i.detail) : P.items.length >= 3 && P.items.length <= 5; },
    needs: P => named(P) && P.items.some(i => i.detail) ? 'section items with descriptions are shown by the other compositions' : named(P) ? (secsOf(P).length > 4 ? 'works for up to 4 sections' : '') : P.items.length < 3 || P.items.length > 5 ? 'works for 3 to 5 items' : '',
    opts: [{ s: 24 }, { s: 22 }],
    build: (P, R, o) => {
      const HR = headRow(P, R, true); if (!HR) return planNo('the heading does not fit'); R = HR.R;
      const S = secsOf(P), sec = named(P), L = sec ? S.map(x => ({ label: x.name, items: x.items, icon: SEC_ICON(x) })) : F0(P);
      const n = L.length, sw = Math.min(360, R.w * 0.34), thick = 16, dh = Math.min(sw * 0.5, (R.h - thick) / (n * 0.62 + 0.38)), pitch = n > 1 ? (R.h - dh - thick) / (n - 1) : 0;
      const lx = R.x + sw + 70, lwid = R.x + R.w - lx, out = HR.out.slice(), cs = 22, chH = Math.round(cs * 1.7);
      // a section's items as chips under its name (each item its own text), wrapped to the label width
      const chipsOf = it => { const rows = [[]]; let x = 0;
        for (const q of it.items) { const w = pillW(q.label, cs) - 10; if (w > lwid) return null; if (x && x + w > lwid) { rows.push([]); x = 0; } rows[rows.length - 1].push({ q, x, w }); x += w + 10; }
        return rows; };
      const blocks = L.map(it => { if (!sec) return planFits(it, lwid, o.s, 2) ? { h: planTextH(it, lwid, o.s) } : null;
        if (!planFits({ label: it.label }, lwid, o.s, 1)) return null; const ch = chipsOf(it); return ch ? { ch, h: planLH(it.label, lwid, o.s) + ch.length * (chH + 8) } : null; });
      if (blocks.some(x => !x)) return planNo('a layer label does not fit');
      const room = n > 1 ? Math.max(pitch, dh * 0.8) : R.h;
      if (blocks.some(x => x.h > room)) return planNo('the layer labels do not fit beside the stack');
      const top = R.y;
      for (let k = n - 1; k >= 0; k--) {          // bottom slab first: each upper slab covers the back of the one below
        const y = top + k * pitch, col = accent(k + 1), g = 'slab' + k;
        out.push(box('diamond', R.x, y + thick, sw, dh, { fill: SOFT, grp: g }));
        out.push(box('diamond', R.x, y, sw, dh, { fill: col, grp: g }));
        const D = Math.min(dh * 0.48, 66);
        out.push(...disc(L[k], R.x + (sw - D) / 2, y + (dh - D) / 2, D, col, g, W));
      }
      L.forEach((it, k) => {
        const y = top + k * pitch + dh / 2, h = blocks[k].h, g = 'lab' + k, y0 = Math.max(R.y, Math.min(R.y + R.h - h, y - h / 2));
        out.push(seg(R.x + sw - 2, y, lx - 18, y, LINE, 2), box('ellipse', lx - 24, y - 6, 12, 12, { fill: accent(k + 1) }));
        if (!sec) { out.push(...planText(it, lx, y0, lwid, o.s, { grp: g })); return; }
        const lh = planLH(it.label, lwid, o.s);
        out.push(label(lx, y0, lwid, lh, it.label, { size: o.s, bold: true, color: INK, align: 'left', valign: 'top', grp: g }));
        blocks[k].ch.forEach((row, r) => row.forEach(c => out.push(box('pill', lx + c.x, y0 + lh + r * (chH + 8), c.w, chH,
          { fill: PANEL, text: c.q.label, size: cs, color: INK, align: 'center', valign: 'middle' }))));
      });
      return out;
    } });
  // a section's object: what its name says (the learning pack's choice), else its first item's
  const SEC_ICON = x => ({ learn: 'book', fit: 'target', outcome: 'briefcase', tools: 'gear', prereq: 'checklist', format: 'calendar' })[sectionKind(x.name)] || x.items[0].icon;
  // the items as layers (no sections)
  const F0 = P => planOrder(P).map(it => ({ label: it.label, detail: it.detail, icon: it.icon }));

  /* 5. Bento grid: the subject as the large tile (object, name, what it does), the items as colour tiles of different
     widths, each with its object on a white disc. Single list or one section. */
  const BENTO = { 2: [1, 1], 3: [1, 2], 4: [2, 2], 5: [2, 3], 6: [3, 3], 7: [2, 3, 2], 8: [3, 2, 3] };
  regPlan('bento', { name: 'Bento grid', family: 'bento', kind: 'cards', groups: false,
    suits: P => !named(P) && P.items.length >= 2 && P.items.length <= 8 && !!shortOf(P),
    needs: P => named(P) ? 'for one list (sections are shown by the other compositions)' : !shortOf(P) ? 'needs a subject for the large tile' : '',
    opts: [{ s: 24, D: 60, hs: 34 }, { s: 22, D: 52, hs: 30 }, { s: 22, D: 44, hs: 28 }],
    build: (P, R, o) => {
      const L = planOrder(P), n = L.length, rowsN = BENTO[n], short = shortOf(P), ic = topicIcon(P), vl = verbLine(P), gap = 14;
      const hw = Math.round(R.w * (vl && objName(P) ? 0.36 : 0.32)), gx = R.x + hw + gap, gw = R.x + R.w - gx, rh = (R.h - gap * (rowsN.length - 1)) / rowsN.length, out = [];
      if (!shortFits(short, hw - 44, o.hs)) return planNo('the subject does not fit the large tile');
      const sub = [vl, objName(P)].filter(Boolean).join('\n');
      if (sub && !(planWords(sub, hw - 44, 22) && linesAt(sub, hw - 44, 22) <= 4)) return planNo('the subtitle does not fit the large tile');
      // the large tile
      const nh = planLH(short, hw - 44, o.hs), vh = sub ? planTH(sub, hw - 44, 22) : 0, HD = ic ? Math.min(hw - 120, R.h - nh - vh - 90) : 0, y0 = R.y + (R.h - (HD ? HD + 20 : 0) - nh - vh) / 2;
      out.push(box('roundRect', R.x, R.y, hw, R.h, { fill: accent(0), grp: 'hero' }));
      if (HD) out.push(...disc({ icon: ic }, R.x + 22, y0, HD, accent(4), 'hero', W));
      out.push(label(R.x + 22, y0 + (HD ? HD + 20 : 0), hw - 44, nh, short, { size: o.hs, bold: true, color: INK, align: 'left', valign: 'top', grp: 'hero' }));
      if (sub) out.push(label(R.x + 22, y0 + (HD ? HD + 20 : 0) + nh - 4, hw - 44, vh, sub, { size: 22, color: INK, align: 'left', valign: 'top', grp: 'hero' }));
      let k = 0;
      for (let r = 0; r < rowsN.length; r++) {
        const m = rowsN[r], wts = m === 1 ? [1] : m === 2 ? (r % 2 ? [1, 1.45] : [1.45, 1]) : [1, 1.25, 1], sum = wts.reduce((a, b) => a + b, 0), y = R.y + r * (rh + gap);
        let x = gx;
        for (let j = 0; j < m; j++, k++) {
          const w = (gw - gap * (m - 1)) * wts[j] / sum, it = L[k], col = accent(k + 1), g = 'tile' + k, wide = w > rh * 1.6;
          out.push(box('roundRect', x, y, w, rh, { fill: col, grp: g }));
          if (wide) {
            const lw = w - o.D - 52;
            if (!planFits(it, lw, o.s, 2) || planTextH(it, lw, o.s) > rh - 16) return planNo('a label does not fit its tile');
            out.push(...disc(it, x + 18, y + (rh - o.D) / 2, o.D, col, g, W));
            out.push(...planText(it, x + o.D + 34, y + (rh - planTextH(it, lw, o.s)) / 2, lw, o.s, { grp: g }));
          } else {
            const lw = w - 24, D = Math.min(o.D, rh - planTextH(it, lw, o.s) - 30);
            if (!planFits(it, lw, o.s, 2) || D < 36) return planNo('a label does not fit its tile');
            const th = D + 8 + planTextH(it, lw, o.s), ty = y + (rh - th) / 2;
            out.push(...disc(it, x + (w - D) / 2, ty, D, col, g, W));
            out.push(...planText(it, x + 12, ty + D + 8, lw, o.s, { align: 'center', grp: g }));
          }
          x += w + gap;
        }
      }
      return out;
    } });

  /* 6. Key statement: the subject in large type with what it does as colour pills (a statement's verbs), the section
     name as a heading, the items as a row of objects divided by fine rules. */
  regPlan('keystatement', { name: 'Statement spotlight', family: 'keystatement', kind: 'hero', groups: false,
    suits: P => !named(P) && P.items.length >= 2 && P.items.length <= 6 && !!shortOf(P),
    needs: P => named(P) ? 'for one list' : !shortOf(P) ? 'needs a subject' : P.items.length > 6 ? 'works for up to 6 items' : '',
    opts: [{ s: 24, D: 84, hs: 44 }, { s: 22, D: 72, hs: 40 }, { s: 22, D: 60, hs: 36 }],
    build: (P, R, o) => {
      const L = planOrder(P), n = L.length, short = shortOf(P), ic = topicIcon(P), V = verbsOf(P), name = objName(P), out = [];
      const HD = ic ? Math.round(o.hs * 1.9) : 0, sw = tw(short, o.hs, true) + 20;
      const pills = V.map(v => pillW(v, 24)), rowW = HD + (HD ? 20 : 0) + sw + (V.length ? 24 + pills.reduce((a, b) => a + b, 0) + 12 * (V.length - 1) : 0);
      if (rowW > R.w || !planWords(short, R.w, o.hs)) return planNo('the headline row does not fit');
      const hy = R.y + 4, hh = Math.max(HD, o.hs * 1.4);
      let x = R.x;
      if (HD) { out.push(...disc({ icon: ic }, x, hy, HD, accent(0), 'head', PANEL)); x += HD + 20; }
      out.push(label(x, hy + (hh - o.hs * 1.4) / 2, sw, o.hs * 1.4, short, { size: o.hs, bold: true, color: INK, align: 'left', valign: 'middle', tight: true, grp: 'head' }));
      x += sw + 24;
      V.forEach((v, i) => { const h = Math.round(24 * 1.8); out.push(box('pill', x, hy + (hh - h) / 2, pills[i], h, { fill: accent(i + 1), text: v, size: 24, bold: true, color: INK, align: 'center', valign: 'middle', grp: 'verbs' })); x += pills[i] + 12; });
      let y = hy + hh + 22;
      if (name) {
        if (!planWords(name, R.w, 24) || linesAt(name, R.w, 24) > 1) return planNo('the heading does not fit');
        out.push(label(R.x, y, R.w, 36, name, { size: 24, bold: true, color: INK, align: 'left', valign: 'top', grp: 'head' }));
        y += 40;
      }
      out.push(rule(R.x, y, R.w, 3, accent(0)));
      y += 18;
      const cw = R.w / n, lw = cw - 20;
      if (!fitsAll(L, lw, o.s)) return planNo('a label does not fit its column');
      const lab = colH(L, lw, o.s), rowH = o.D + 30 + 10 + lab;
      if (y + rowH > R.y + R.h) return planNo('the items do not fit below the headline');
      const iy = y + (R.y + R.h - y - rowH) / 2;
      L.forEach((it, k) => {
        const cx = R.x + k * cw, col = accent(k + 1), g = 'col' + k, D = o.D + 30;
        out.push(box('ellipse', cx + (cw - D) / 2, iy, D, D, { fill: col, grp: g }));
        out.push(...disc(it, cx + (cw - o.D) / 2, iy + 15, o.D, col, g, W));
        out.push(...planText(it, cx + 10, iy + D + 10, lw, o.s, { align: 'center', grp: g }));
        if (k) out.push(rule(cx - 1, iy + 10, 2, rowH - 20, SOFT));
      });
      return out;
    } });
});
