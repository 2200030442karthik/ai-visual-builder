/* AI Visual Builder design pack "scenes" 10.17.0 - sixteen modern compositions in the manner of AI infographic tools
   (VisualX-style slides: a hero object, connectors with dots, soft cards with icon tiles, header pills), so one Generate
   gives 20+ designs that differ in structure, not in colour. Every composition is native shapes and text (editable),
   follows the same rules as every family (packs/README.txt: approved colours, Open Sans, 22 pt and up, nothing
   outside the content area, only what the content states) and draws either the items (a list or one statement) or
   the named sections (each section as one card holding its items):
     devicelinks    a laptop whose screen holds an AI chip (or the topic's object), elbow connectors to stacked cards
     discgrid       the topic in a large disc, a bracket, the items as a grid of icon tiles
     hubcorners     the topic as a hub in the middle, cards on both sides with connectors
     treedown       a hero card on top, a tree of connectors down to a row of cards with icon badges
     mirrorlinks    cards with colour bars on the left, connectors into a large ring on the right
     sectionrows    one band per section: a colour tab with its name, its items in columns on a soft band
     splitpanel     a colour panel with the topic, the items as an open list with rules
     zigzag         a spine down the middle, the items alternating left and right on icon nodes
     target         a target of rings (one per item) with leaders to the item cards
     quadcircle     four quadrants around a central disc (three items and the heading, or four items)
     iconband       a colour band with large icon discs on it, labels below
     tabcards       folder cards: a colour tab with the icon, the label on the card
     callouts       speech bubbles above the topic's object
     chipboard      a circuit chip in the middle, traces to cards above and below
     ribbontags     colour tag ribbons with icon discs, the topic in a disc on the right
   Card fills: the light panel grey (#F2F2F2), or soft tints of the palette when the administrator allows them
   (config.json "soft_tints": true; brand.js softTints). New objects: laptop, AI chip, research (document and
   magnifier), course (screen with a play button). Loaded after the concepts pack. */
registerPack('scenes', '10.17.0', () => {
  const W = '#FFFFFF', GREY = '#7F7F7F', LIGHT = '#D9D9D9';

  /* ---------- objects ---------- */
  const add = (key, name, strong) => {
    const terms = (strong || '').split(' | ').map(t => t.trim()).filter(Boolean).map(t => ({
      re: new RegExp('(?:^|[^\\w-])' + t.replace(/\*/g, '\\w*') + '(?![\\w])', 'i'), w: 2 * (/\s|\\s| \?/.test(t) ? 1.5 : 1), t }));
    CATALOG.unshift({ key, name, terms });
    if (!CMP_NAMES[key]) CMP_NAMES[key] = name;
  };
  Object.assign(CMP, {
    laptop: (x, y, s, c) => [
      box('roundRect', x + s * .14, y + s * .16, s * .72, s * .5, { fill: c }), box('rect', x + s * .2, y + s * .22, s * .6, s * .38, { fill: W }),
      box('roundRect', x + s * .04, y + s * .68, s * .92, s * .1, { fill: c })],
    course: (x, y, s, c) => [
      box('roundRect', x + s * .14, y + s * .16, s * .72, s * .5, { fill: c }), box('rect', x + s * .2, y + s * .22, s * .6, s * .38, { fill: W }),
      box('triangle', x + s * .41, y + s * .3, s * .2, s * .22, { fill: c, rot: 90 }),
      box('roundRect', x + s * .04, y + s * .68, s * .92, s * .1, { fill: c })],
    research: (x, y, s, c) => [
      box('foldedCorner', x + s * .08, y + s * .04, s * .56, s * .76, { fill: c }),
      box('rect', x + s * .17, y + s * .2, s * .34, s * .05, { fill: W }), box('rect', x + s * .17, y + s * .32, s * .34, s * .05, { fill: W }),
      box('rect', x + s * .17, y + s * .44, s * .2, s * .05, { fill: W }),
      box('ellipse', x + s * .42, y + s * .42, s * .42, s * .42, { fill: W }), box('donut', x + s * .45, y + s * .45, s * .36, s * .36, { fill: c }),
      box('rect', x + s * .78, y + s * .76, s * .2, s * .07, { fill: c, rot: 45 })],
    aichip: (x, y, s, c) => {
      const out = [box('roundRect', x + s * .22, y + s * .22, s * .56, s * .56, { fill: c }), box('roundRect', x + s * .33, y + s * .33, s * .34, s * .34, { fill: W }),
        box('rect', x + s * .43, y + s * .43, s * .14, s * .14, { fill: c })];
      for (const k of [0, 1, 2]) {
        const o = s * (.3 + k * .16);
        out.push(box('rect', x + o, y + s * .08, s * .06, s * .13, { fill: c }), box('rect', x + o, y + s * .79, s * .06, s * .13, { fill: c }),
          box('rect', x + s * .08, y + o, s * .13, s * .06, { fill: c }), box('rect', x + s * .79, y + o, s * .13, s * .06, { fill: c }));
      }
      return out;
    },
  });
  add('research', 'Research', 'research assistants? | research tools? | writing and research | literature review | research');
  add('course', 'Course', 'learning courses? | structured (?:learning )?courses? | online courses? | courses? | e-learning | video lessons?');
  add('cap', 'Graduation cap', 'foundational concepts? | foundations? | fundamentals | basics | core concepts');
  add('aichip', 'AI chip', 'ai chips? | chips? | processors? | hardware | gpus?');
  add('laptop', 'Laptop', 'laptops? | notebook computers?');

  /* ---------- reading the plan ---------- */
  const objKey = it => it.icon && CMP[it.icon] ? it.icon : 'none';
  const secsOf = P => { const G = planGroups(P);
    return G.length >= 2 && planAllGrouped(P) ? G.map(x => ({ name: x.g.name, items: x.items })) : [{ name: P.sectionName || '', items: planOrder(P) }]; };
  const named = P => secsOf(P).length >= 2;
  const shortOf = P => planClean(P.short || secShort(planClean(P.title || '')) || '');
  const topicIcon = P => (P.hero && CMP[P.hero]) ? P.hero : heroFor(shortOf(P), P.title || '', P.headline || '') || '';
  const tw = (t, s, b) => String(t).length * s * (b ? 0.6 : 0.55);
  const pillW = (t, s) => tw(t, s, true) + 40;
  const soft = c => (typeof softTints === 'function' && softTints()) ? tint(c, SOFT_T) : PANEL;
  const fitsLine = (t, w, s, n) => planWords(t, w, s) && linesAt(t, w * 0.95, s) <= (n || 1);
  // the units a composition places: the items, or the named sections (each one card with its items)
  const units = P => named(P) ? secsOf(P).map((s, si) => ({ sec: s, si, col: accent(si + 1) }))
    : planOrder(P).map((it, j) => ({ it, si: 0, col: accent(j + 1) }));
  const nUnits = P => named(P) ? secsOf(P).length : P.items.length;
  const okSecs = (P, maxItems) => !named(P) || secsOf(P).every(s => s.items.length <= (maxItems || 5));

  /* ---------- the kit ---------- */
  const dot = (x, y, c, r) => box('ellipse', x - (r || 7), y - (r || 7), 2 * (r || 7), 2 * (r || 7), { fill: c });
  const obj = (it, x, y, D, col, g) => objKey(it) === 'none' ? [box('ellipse', x + D * 0.3, y + D * 0.3, D * 0.4, D * 0.4, { fill: col, grp: g })]
    : comp(objKey(it), x, y, D, col).map(q => Object.assign(q, { grp: g }));
  // a white rounded tile holding the object (the icon tiles of AI infographics)
  const tile = (it, x, y, T, col, g) => [box('roundRect', x, y, T, T, { fill: W, grp: g })].concat(obj(it, x + T * 0.08, y + T * 0.08, T * 0.84, col, g));
  // a round badge: colour ring, white disc, the object
  const badge = (it, x, y, D, col, g) => [box('ellipse', x, y, D, D, { fill: col, grp: g }), box('ellipse', x + D * 0.09, y + D * 0.09, D * 0.82, D * 0.82, { fill: W, grp: g })]
    .concat(obj(it, x + D * 0.18, y + D * 0.18, D * 0.64, col, g));
  // a trunk from (x0, y0) to bx, down/up to every target y, then on to x2 (a dot at the end)
  const trunk = (x0, y0, bx, ys, x2, c) => {
    const out = [seg(x0, y0, bx, y0, c, 3)], lo = Math.min(y0, ...ys), hi = Math.max(y0, ...ys);
    if (hi - lo > 1) out.push(seg(bx, lo, bx, hi, c, 3));
    ys.forEach(y => { out.push(seg(bx, y, x2 - (x2 > bx ? 9 : -9), y, c, 3), dot(x2 - (x2 > bx ? 9 : -9), y, c)); });
    return out;
  };
  // the heading of a list (the statement's own words, a section's name), one or two lines
  const heading = (P, R, align, size) => {
    const name = named(P) ? '' : (P.sectionName || ''), s = size || 24;
    if (!name) return { out: [], R };
    if (!planWords(name, R.w, s) || linesAt(name, R.w * 0.95, s) > 2) return null;
    const h = planLH(name, R.w, s);
    return { out: [label(R.x, R.y, R.w, h, name, { size: s, color: INK, align: align || 'left', valign: 'top', grp: 'head' })], R: { x: R.x, y: R.y + h + 14, w: R.w, h: R.h - h - 14 } };
  };
  // the topic and the heading as a title row with a short accent rule (for compositions without a hero)
  const topRow = (P, R, center) => {
    const sh = shortOf(P), name = named(P) ? '' : (P.sectionName || ''), out = [];
    if (!sh && !name) return { out, R };
    const w1 = sh ? tw(sh, 28, true) + 24 : 0, w2 = name ? tw(name, 24) + 24 : 0;
    let h;
    if (w1 + w2 + 12 <= R.w) {
      h = 44; let x = center ? R.x + (R.w - w1 - w2 - 12) / 2 : R.x;
      if (sh) { out.push(label(x, R.y, w1, h, sh, { size: 28, bold: true, color: INK, align: 'left', valign: 'middle', grp: 'head' })); x += w1 + 12; }
      if (name) out.push(label(x, R.y, w2, h, name, { size: 24, color: INK, align: 'left', valign: 'middle', grp: 'head' }));
    } else {
      if (sh && !fitsLine(sh, R.w, 28)) return null;
      if (!planWords(name, R.w, 24) || linesAt(name, R.w * 0.95, 24) > 2) return null;
      const nh = planLH(name, R.w, 24), al = center ? 'center' : 'left';
      out.push(label(R.x, R.y, R.w, 42, sh, { size: 28, bold: true, color: INK, align: al, valign: 'middle', grp: 'head' }));
      out.push(label(R.x, R.y + 40, R.w, nh, name, { size: 24, color: INK, align: al, valign: 'top', grp: 'head' }));
      h = 40 + nh;
    }
    out.push(rule(center ? R.x + R.w / 2 - 60 : R.x + 4, R.y + h + 4, 120, 5, accent(1)));
    return { out, R: { x: R.x, y: R.y + h + 22, w: R.w, h: R.h - h - 22 } };
  };

  /* ---------- cards: one item, or one named section with its items ---------- */
  // styles: tile (icon tile left, divider, label), badge (icon disc on top, label below), bar (colour bar, label,
  // object on the right), open (icon disc and label, no card)
  const itemNeed = (style, it, w, o) => {
    const s = o.s, pad = 14;
    if (style === 'tile') { const lw = w - pad - o.T - 30 - pad; return lw > 60 && planFits(it, lw, s, 3) ? Math.max(o.T + 2 * pad, planTextH(it, lw, s) + 2 * pad) : Infinity; }
    if (style === 'badge') { const lw = w - 2 * pad; return lw > 60 && planFits(it, lw, s, 3) ? pad + o.D + 10 + planTextH(it, lw, s) + pad + 8 : Infinity; }
    if (style === 'bar') { const lw = w - 34 - o.T - 2 * pad; return lw > 60 && planFits(it, lw, s, 3) ? Math.max(o.T + 2 * pad, planTextH(it, lw, s) + 2 * pad) : Infinity; }
    const lw = w - o.T - 16; return lw > 60 && planFits(it, lw, s, 3) ? Math.max(o.T, planTextH(it, lw, s)) : Infinity;
  };
  const itemCard = (style, it, x, y, w, h, col, o, g) => {
    const s = o.s, pad = 14, out = [];
    if (style === 'tile') {
      const T = o.T, lx = x + pad + T + 30, lw = x + w - pad - lx, th = planTextH(it, lw, s);
      out.push(box('roundRect', x, y, w, h, { fill: soft(col), grp: g }), ...tile(it, x + pad, y + (h - T) / 2, T, col, g),
        rule(x + pad + T + 13, y + h * 0.24, 4, h * 0.52, col), ...planText(it, lx, y + (h - th) / 2, lw, s, { grp: g }));
    } else if (style === 'badge') {
      const D = o.D, lw = w - 2 * pad;
      out.push(box('roundRect', x, y, w, h, { fill: soft(col), grp: g }), ...badge(it, x + (w - D) / 2, y + pad, D, col, g),
        ...planText(it, x + pad, y + pad + D + 10, lw, s, { align: 'center', grp: g }), rule(x + w * 0.3, y + h - 10, w * 0.4, 6, col));
    } else if (style === 'bar') {
      const T = o.T, lw = w - 34 - T - 2 * pad, th = planTextH(it, lw, s);
      out.push(box('roundRect', x, y, w, h, { fill: PANEL, grp: g }), box('rect', x + 12, y + 14, 8, h - 28, { fill: col, grp: g }),
        ...planText(it, x + 34, y + (h - th) / 2, lw, s, { grp: g }), ...obj(it, x + w - pad - T, y + (h - T) / 2, T, col, g));
    } else {
      const T = o.T, lw = w - T - 16, th = planTextH(it, lw, s);
      out.push(box('ellipse', x, y + (h - T) / 2, T, T, { fill: soft(col), grp: g }), ...obj(it, x + T * 0.18, y + (h - T) / 2 + T * 0.18, T * 0.64, col, g),
        ...planText(it, x + T + 16, y + (h - th) / 2, lw, s, { grp: g }));
    }
    return out;
  };
  // a named section as a card: its name, then its items (one or two columns of object and label)
  const secLay = (sec, w, o) => {
    const s = o.s, pad = 10, d = Math.min(44, o.T || 44), m = sec.items.length;
    if (!fitsLine(sec.name, w - 2 * pad, 24, 2)) return null;
    const hh = planLH(sec.name, w - 2 * pad, 24);
    for (const cols of (w >= 560 && m >= 3 ? [2, 1] : [1])) {
      const cw = (w - 2 * pad - (cols - 1) * 16) / cols, lw = cw - d - 12;
      if (lw < 70 || !sec.items.every(it => planFits(it, lw, s, 2))) continue;
      const rows = [];
      for (let k = 0; k < m; k += cols) rows.push(Math.max(d, ...sec.items.slice(k, k + cols).map(it => planTextH(it, lw, s))) + 6);
      return { cols, cw, lw, d, hh, rows, need: pad + hh + 6 + rows.reduce((a, b) => a + b, 0) + pad - 6 };
    }
    return null;
  };
  const secCard = (u, x, y, w, h, o, L, fill) => {
    const pad = 10, out = [box('roundRect', x, y, w, h, { fill: fill || soft(u.col), grp: 'sec' + u.si })];
    out.push(label(x + pad, y + pad, w - 2 * pad, L.hh, u.sec.name, { size: 24, bold: true, color: INK, align: 'left', valign: 'top', grp: 'sec' + u.si }));
    let yy = y + pad + L.hh + 6 + Math.max(0, (h - L.need) / 2);
    L.rows.forEach((rh, r) => {
      u.sec.items.slice(r * L.cols, r * L.cols + L.cols).forEach((it, c) => {
        const cx = x + pad + c * (L.cw + 16), g = 'si' + u.si + '_' + (r * L.cols + c), th = planTextH(it, L.lw, o.s);
        out.push(...obj(it, cx, yy + (rh - 6 - L.d) / 2, L.d, u.col, g), ...planText(it, cx + L.d + 12, yy + (rh - 6 - th) / 2, L.lw, o.s, { grp: g }));
      });
      yy += rh;
    });
    return out;
  };
  // the height a unit needs at width w (Infinity: it does not fit), and its drawing
  const unitNeed = (u, style, w, o) => { if (u.sec) { const L = secLay(u.sec, w, o); return L ? L.need : Infinity; } return itemNeed(style, u.it, w, o); };
  // every card its own group (two columns of cards never share a group: PowerPoint groups and the icon check use it)
  let UID = 0;
  const unitDraw = (u, style, x, y, w, h, o, k) => u.sec ? secCard(u, x, y, w, h, o, secLay(u.sec, w, o), style === 'bar' ? PANEL : null) : itemCard(style, u.it, x, y, w, h, u.col, o, 'card' + (++UID) + '_' + k);
  // a column of units in a box: heights shared fairly (each at least what it needs); null when they do not fit
  const column = (U, style, x, y, w, h, o, gap, cap) => {
    const need = U.map(u => unitNeed(u, style, w, o));
    if (need.some(n => !isFinite(n))) return null;
    const total = need.reduce((a, b) => a + b, 0) + gap * (U.length - 1);
    if (total > h) return null;
    const extra = Math.min((h - total) / U.length, cap == null ? 30 : cap), hs = need.map(n => n + extra), used = hs.reduce((a, b) => a + b, 0) + gap * (U.length - 1);
    let yy = y + (h - used) / 2; const ys = [], out = [];
    U.forEach((u, k) => { out.push(...unitDraw(u, style, x, yy, w, hs[k], o, k)); ys.push(yy + hs[k] / 2); yy += hs[k] + gap; });
    return { out, ys, hs };
  };
  // a row of units: equal widths, the height of the tallest
  const row = (U, style, x, y, w, h, o, gap) => {
    const cw = (w - gap * (U.length - 1)) / U.length, need = Math.max(...U.map(u => unitNeed(u, style, cw, o)));
    if (!isFinite(need) || need > h) return null;
    const hh = Math.min(h, need + 24), out = [], xs = [];
    U.forEach((u, k) => { const x0 = x + k * (cw + gap); out.push(...unitDraw(u, style, x0, y, cw, hh, o, k)); xs.push(x0 + cw / 2); });
    return { out, xs, h: hh, cw };
  };

  /* ---------- heroes ---------- */
  // a laptop whose screen shows an AI chip with circuit traces; the chip carries the topic's short name when it is
  // short ("AI"), else its object, and the name goes under the laptop
  const device = (P, x, y, w, maxH) => {
    const sh0 = Math.round(w * 0.62), short = shortOf(P), ic = topicIcon(P), c = accent(0), out = [];
    const inChip = short.length <= 5, extra = inChip ? 0 : 50, sh = Math.min(sh0, maxH - 18 - extra);
    if (sh < 150 || (!inChip && !fitsLine(short, w + 20, 28, 2))) return null;
    const scH = sh - 24, C = Math.round(Math.min(scH * 0.56, ((w - 20) / 2 - 12) / 1.15, (scH / 2 - 8) / 0.8)), cx = x + w / 2, cy = y + 10 + scH / 2;
    out.push(box('roundRect', x, y, w, sh, { fill: GREY, grp: 'hero' }), box('rect', x + 10, y + 10, w - 20, scH, { fill: W, grp: 'hero' }),
      box('roundRect', x - 10, y + sh - 2, w + 20, 18, { fill: LIGHT, grp: 'hero' }), box('rect', x + w / 2 - 34, y + sh - 2, 68, 6, { fill: GREY, grp: 'hero' }));
    for (const side of [-1, 1]) for (const k of [-1, 0, 1]) {
      const y0 = cy + k * C * 0.3, x0 = cx + side * C / 2, x1 = cx + side * C * 0.8, x2 = cx + side * C * 1.1, y2 = y0 + k * C * 0.2;
      out.push(seg(x0, y0, x1, y0, c, 3, { grp: 'hero' }), seg(x1, y0, x2, y2, c, 3, { grp: 'hero' }), Object.assign(dot(x2, y2, c, 6), { grp: 'hero' }));
    }
    for (const side of [-1, 1]) for (const k of [-1, 1]) {
      const xx = cx + k * C * 0.22, y0 = cy + side * C / 2, y1 = cy + side * C * 0.8;
      out.push(seg(xx, y0, xx, y1, c, 3, { grp: 'hero' }), Object.assign(dot(xx, y1, c, 6), { grp: 'hero' }));
    }
    if (inChip && tw(short, 34, true) <= C - 16) out.push(box('roundRect', cx - C / 2, cy - C / 2, C, C, { fill: c, text: short, size: 34, bold: true, align: 'center', valign: 'middle', grp: 'hero' }));
    else {
      out.push(box('roundRect', cx - C / 2, cy - C / 2, C, C, { fill: c, grp: 'hero' }), box('roundRect', cx - C * 0.34, cy - C * 0.34, C * 0.68, C * 0.68, { fill: W, grp: 'hero' }));
      if (ic) out.push(...obj({ icon: ic }, cx - C * 0.27, cy - C * 0.27, C * 0.54, c, 'heroobj'));
      if (inChip) return null;
    }
    if (!inChip) out.push(label(x - 10, y + sh + 24, w + 20, planLH(short, w + 20, 28), short, { size: 28, bold: true, color: INK, align: 'center', valign: 'top', grp: 'hero' }));
    return { out, h: sh + 18 + extra, sh, mid: y + sh / 2 };
  };
  // the topic in a disc (soft ring, white disc, object), its name below
  const disc = (P, cx, y, D, col, lw) => {
    const short = shortOf(P), ic = topicIcon(P), out = [];
    if (!fitsLine(short, lw, 28, 2)) return null;
    out.push(box('ellipse', cx - D / 2, y, D, D, { fill: soft(col) === PANEL ? col : soft(col), grp: 'hero' }), box('ellipse', cx - D * 0.39, y + D * 0.11, D * 0.78, D * 0.78, { fill: W, grp: 'hero' }));
    out.push(...obj({ icon: ic || 'none' }, cx - D * 0.25, y + D * 0.25, D * 0.5, col, 'heroobj'));
    const lh = planLH(short, lw, 28);
    out.push(label(cx - lw / 2, y + D + 10, lw, lh, short, { size: 28, bold: true, color: INK, align: 'center', valign: 'top', grp: 'hero' }));
    return { out, h: D + 10 + lh };
  };
  const discH = (P, D, lw) => D + 10 + planLH(shortOf(P), lw, 28);
  const needShort = P => !shortOf(P) ? 'needs a topic for the hero' : '';
  const nRange = (P, lo, hi) => nUnits(P) < lo || nUnits(P) > hi ? `works for ${lo} to ${hi} ${named(P) ? 'sections' : 'items'}` : '';
  const reg = (key, o) => regPlan(key, Object.assign({ family: key, groups: true, suits: P => !o.needs(P) }, o));
  const SIZES = [{ s: 24, T: 76, D: 84 }, { s: 22, T: 68, D: 76 }, { s: 22, T: 58, D: 66 }, { s: 22, T: 48, D: 56 }, { s: 22, T: 42, D: 48 }];

  /* 1. Device links: the laptop with the AI chip, elbow connectors to stacked cards. */
  reg('devicelinks', { name: 'Device links', kind: 'hero', appeal: 8,
    needs: P => needShort(P) || nRange(P, 2, named(P) ? 3 : 5) || (!okSecs(P, 6) ? 'works for up to 6 items a section' : ''),
    opts: SIZES.map((o, i) => Object.assign({ hw: [0.37, 0.35, 0.33, 0.31, 0.29][i] }, o)),
    build: (P, R0, o) => {
      const hd = heading(P, R0, 'left'); if (!hd) return planNo('the heading does not fit');
      const R = hd.R, hw = Math.round(R.w * o.hw), dv = device(P, R.x + 12, R.y, hw - 28, R.h);
      if (!dv) return planNo('the hero does not fit');
      const dy = R.y + (R.h - dv.h) / 2, D = device(P, R.x + 12, dy, hw - 28, R.h), cx0 = R.x + hw + 70;
      const col = column(units(P), 'tile', cx0, R.y, R.x + R.w - cx0, R.h, o, 14, 24);
      if (!col) return planNo('the cards do not fit');
      return hd.out.concat(D.out, trunk(R.x + hw - 12, D.mid, R.x + hw + 34, col.ys, cx0, accent(0)), col.out);
    } });

  /* 2. Disc and tile grid: the topic in a large disc, a bracket, the items as a grid of icon tiles. */
  reg('discgrid', { name: 'Disc and tile grid', kind: 'hub', appeal: 5,
    needs: P => needShort(P) || nRange(P, named(P) ? 2 : 3, named(P) ? 2 : 6) || (!okSecs(P, 4) ? 'works for up to 4 items a section' : ''),
    opts: SIZES.map((o, i) => Object.assign({ dw: [0.27, 0.25, 0.23, 0.21, 0.2][i] }, o)),
    build: (P, R0, o) => {
      const hd = heading(P, R0, 'center'); if (!hd) return planNo('the heading does not fit');
      const R = hd.R, U = units(P), lw = Math.round(R.w * o.dw) + 20, D0 = Math.min(Math.round(R.w * o.dw), R.h - 60);
      let D = D0; while (D > 120 && discH(P, D, lw) > R.h) D -= 10;
      if (D < 120) return planNo('the hero does not fit');
      const dh = discH(P, D, lw), hx = R.x + lw / 2, H = disc(P, hx, R.y + (R.h - dh) / 2, D, accent(0), lw);
      if (!H) return planNo('the topic does not fit under its disc');
      const gx = R.x + lw + 80, gw = R.x + R.w - gx, cols = U.length <= 4 ? 2 : 3, gap = 14, cw = (gw - gap * (cols - 1)) / cols, out = [];
      const rowsU = []; for (let k = 0; k < U.length; k += cols) rowsU.push(U.slice(k, k + cols));
      const need = rowsU.map(r => Math.max(...r.map(u => unitNeed(u, 'tile', cw, o))));
      if (need.some(n => !isFinite(n))) return planNo('a label does not fit its tile');
      const tot = need.reduce((a, b) => a + b, 0) + gap * (rowsU.length - 1);
      if (tot > R.h) return planNo('the tiles do not fit');
      const ex = Math.min(24, (R.h - tot) / rowsU.length); let y = R.y + (R.h - tot - ex * rowsU.length) / 2; const ys = [];
      rowsU.forEach((r, ri) => { const h = need[ri] + ex; r.forEach((u, c) => out.push(...unitDraw(u, 'tile', gx + c * (cw + gap) + (cols - r.length) * (cw + gap) / 2, y, cw, h, o, ri * cols + c))); ys.push(y + h / 2); y += h + gap; });
      return hd.out.concat(H.out, trunk(R.x + lw / 2 + D / 2 + 6, R.y + (R.h - dh) / 2 + D / 2, R.x + lw + 40, ys, gx, accent(0)), out);
    } });

  /* 4. Hub with side cards: the topic as a hub disc in the middle, the cards on both sides. */
  reg('hubcorners', { name: 'Hub with side cards', kind: 'hub', appeal: 4,
    needs: P => needShort(P) || nRange(P, 2, named(P) ? 2 : 6) || (!okSecs(P, 5) ? 'works for up to 5 items a section' : ''),
    opts: SIZES.map((o, i) => Object.assign({ hd: [190, 176, 160, 146, 136][i] }, o)),
    build: (P, R0, o) => {
      const hd = heading(P, R0, 'center'); if (!hd) return planNo('the heading does not fit');
      const R = hd.R, U = units(P), L = U.slice(0, Math.ceil(U.length / 2)), Rt = U.slice(Math.ceil(U.length / 2));
      const lw = o.hd + 60, D = Math.min(o.hd, R.h - 70), cx = R.x + R.w / 2, cw = (R.w - lw - 2 * 64) / 2;
      const dh = discH(P, D, lw); if (dh > R.h) return planNo('the hub does not fit');
      const H = disc(P, cx, R.y + (R.h - dh) / 2, D, accent(0), lw); if (!H) return planNo('the topic does not fit under the hub');
      const a = column(L, 'tile', R.x, R.y, cw, R.h, o, 14, 30), b = Rt.length ? column(Rt, 'tile', R.x + R.w - cw, R.y, cw, R.h, o, 14, 30) : { out: [], ys: [] };
      if (!a || !b) return planNo('the cards do not fit');
      const hy = R.y + (R.h - dh) / 2 + D / 2;
      return hd.out.concat(H.out, trunk(cx - D / 2, hy, R.x + cw + 32, a.ys, R.x + cw, accent(0)), b.ys.length ? trunk(cx + D / 2, hy, R.x + R.w - cw - 32, b.ys, R.x + R.w - cw, accent(0)) : [], a.out, b.out);
    } });

  /* 5. Topic tree: a hero card on top (object, topic, heading), connectors down to a row of badge cards. */
  reg('treedown', { name: 'Topic tree', kind: 'hierarchy', appeal: 3,
    needs: P => needShort(P) || nRange(P, 2, named(P) ? 3 : 5) || (!okSecs(P, 4) ? 'works for up to 4 items a section' : ''),
    opts: SIZES,
    build: (P, R, o) => {
      const short = shortOf(P), name = named(P) ? '' : P.sectionName || '', ic = topicIcon(P), U = units(P), out = [];
      const T = 64, cw0 = Math.min(R.w * 0.62, Math.max(420, tw(name, 22) + T + 70)), tx = T + 40, lw = cw0 - tx - 20;
      if (!fitsLine(short, lw, 28) || (name && (!planWords(name, lw, 22) || linesAt(name, lw * 0.95, 22) > 2))) return planNo('the topic card does not fit');
      const th = 40 + (name ? planTH(name, lw, 22) : 0), ch = Math.max(T + 24, th + 20), x0 = R.x + (R.w - cw0) / 2;
      out.push(box('roundRect', x0, R.y, cw0, ch, { fill: soft(accent(0)), grp: 'hero' }), ...tile({ icon: ic || 'none' }, x0 + 16, R.y + (ch - T) / 2, T, accent(0), 'hero'),
        label(x0 + tx, R.y + (ch - th) / 2, lw, 40, short, { size: 28, bold: true, color: INK, align: 'left', valign: 'middle', grp: 'hero' }));
      if (name) out.push(label(x0 + tx, R.y + (ch - th) / 2 + 38, lw, planTH(name, lw, 22), name, { size: 22, color: INK, align: 'left', valign: 'top', grp: 'hero' }));
      const busY = R.y + ch + 22, top = busY + 22, rw = row(U, named(P) ? 'tile' : 'badge', R.x, top, R.w, R.y + R.h - top, o, 16);
      if (!rw) return planNo('the cards do not fit');
      out.push(seg(R.x + R.w / 2, R.y + ch, R.x + R.w / 2, busY, accent(0), 3));
      if (rw.xs.length > 1) out.push(seg(rw.xs[0], busY, rw.xs[rw.xs.length - 1], busY, accent(0), 3));
      rw.xs.forEach(x => out.push(seg(x, busY, x, top - 9, accent(0), 3), dot(x, top - 9, accent(0))));
      return out.concat(rw.out);
    } });

  /* 6. Ring and cards: cards with colour bars on the left, connectors into a large ring on the right. */
  reg('mirrorlinks', { name: 'Ring and cards', kind: 'hub', appeal: 3,
    needs: P => needShort(P) || nRange(P, 2, named(P) ? 2 : 5) || (!okSecs(P, 5) ? 'works for up to 5 items a section' : ''),
    opts: SIZES.map((o, i) => Object.assign({ dd: [220, 200, 180, 160, 150][i] }, o)),
    build: (P, R0, o) => {
      const hd = heading(P, R0, 'left'); if (!hd) return planNo('the heading does not fit');
      const R = hd.R, lw = o.dd + 40, D = Math.min(o.dd, R.h - 60), dh = discH(P, D, lw); if (dh > R.h) return planNo('the ring does not fit');
      const cx = R.x + R.w - lw / 2, y0 = R.y + (R.h - dh) / 2, out = [];
      if (!fitsLine(shortOf(P), lw, 28, 2)) return planNo('the topic does not fit');
      out.push(box('ellipse', cx - D / 2, y0, D, D, { fill: accent(0), grp: 'hero' }), box('ellipse', cx - D * 0.42, y0 + D * 0.08, D * 0.84, D * 0.84, { fill: W, grp: 'hero' }),
        box('ellipse', cx - D * 0.3, y0 + D * 0.2, D * 0.6, D * 0.6, { fill: soft(accent(0)) === PANEL ? PANEL : soft(accent(0)), grp: 'hero' }),
        ...obj({ icon: topicIcon(P) || 'none' }, cx - D * 0.21, y0 + D * 0.29, D * 0.42, accent(0), 'heroobj'),
        label(cx - lw / 2, y0 + D + 10, lw, planLH(shortOf(P), lw, 28), shortOf(P), { size: 28, bold: true, color: INK, align: 'center', valign: 'top', grp: 'hero' }));
      const cw = R.w - lw - 90, col = column(units(P), 'bar', R.x, R.y, cw, R.h, o, 14, 26);
      if (!col) return planNo('the cards do not fit');
      return hd.out.concat(out, trunk(cx - D / 2, y0 + D / 2, R.x + cw + 40, col.ys, R.x + cw, accent(0)), col.out);
    } });

  /* 7. Section rows: one band per section - a colour tab with the section's name, its items in columns on a soft band
     (a list or statement: one band, its heading in the tab, the topic above). Compact enough for dense sections. */
  reg('sectionrows', { name: 'Section rows', kind: 'grouped', appeal: 3,
    needs: P => needShort(P) || (named(P) ? nRange(P, 2, 3) || (!okSecs(P, 5) ? 'works for up to 5 items a section' : '') : !P.sectionName ? 'needs a heading for the tab' : nRange(P, 2, 5)),
    opts: SIZES,
    build: (P, R0, o) => {
      let R = R0; const out = [];
      if (!named(P)) {
        const sh = shortOf(P); if (!fitsLine(sh, R.w, 28)) return planNo('the topic does not fit');
        out.push(label(R.x, R.y, R.w, 42, sh, { size: 28, bold: true, color: INK, align: 'left', valign: 'middle', grp: 'head' }), rule(R.x + 4, R.y + 46, 120, 5, accent(1)));
        R = { x: R.x, y: R.y + 64, w: R.w, h: R.h - 64 };
      }
      const S = secsOf(P), k = S.length, gap = 14, tabW = named(P) ? Math.max(170, ...S.map(s => Math.min(250, tw(s.name, 24, true) + 40))) : 280;
      const bx = R.x + tabW + 10, bw = R.x + R.w - bx, D = Math.min(o.D, 60);
      const tabH = S.map(s => planWords(s.name, tabW - 24, 24) && linesAt(s.name, (tabW - 24) * 0.95, 24) <= 4 ? planLH(s.name, tabW - 24, 24) : Infinity);
      const needs = S.map((s, si) => { const cw = (bw - 16) / s.items.length;
        if (!s.items.every(it => planFits(it, cw - 16, o.s, 3))) return Infinity;
        return Math.max(tabH[si] + 24, 12 + D + 8 + Math.max(...s.items.map(it => planTextH(it, cw - 16, o.s))) + 10); });
      if (needs.some(x => !isFinite(x))) return planNo('a label does not fit its row');
      const total = needs.reduce((a, b) => a + b, 0) + gap * (k - 1);
      if (total > R.h) return planNo('the rows do not fit');
      const ex = Math.min(36, (R.h - total) / k); let y = R.y + (R.h - total - ex * k) / 2;
      S.forEach((s, si) => {
        const h = needs[si] + ex, col = named(P) ? accent(si + 1) : accent(1), m = s.items.length, cw = (bw - 16) / m;
        out.push(box('roundRect', R.x, y, tabW, h, { fill: col, grp: 'tab' + si }),
          label(R.x + 12, y + (h - tabH[si]) / 2, tabW - 24, tabH[si], s.name, { size: 24, bold: true, color: INK, align: 'center', valign: 'top', grp: 'tab' + si }),
          box('roundRect', bx, y, bw, h, { fill: soft(col), grp: 'band' + si }));
        const lab = Math.max(...s.items.map(it => planTextH(it, cw - 16, o.s))), top = y + (h - (D + 8 + lab)) / 2;
        s.items.forEach((it, j) => { const x = bx + 8 + j * cw, g = 'r' + si + '_' + j;
          out.push(...obj(it, x + (cw - D) / 2, top, D, col, g), ...planText(it, x + 8, top + D + 8, cw - 16, o.s, { align: 'center', grp: g }));
          if (j) out.push(rule(x - 1, y + 16, 2, h - 32, LIGHT)); });
        y += h + gap;
      });
      return out;
    } });

  /* 8. Split panel: a colour panel with the topic's object, name and heading; the items as an open list with rules. */
  reg('splitpanel', { name: 'Split panel', kind: 'hero', appeal: 3,
    needs: P => needShort(P) || nRange(P, 2, named(P) ? 3 : 6) || (!okSecs(P, 5) ? 'works for up to 5 items a section' : ''),
    opts: SIZES.map((o, i) => Object.assign({ pw: [0.36, 0.34, 0.32, 0.3, 0.3][i] }, o)),
    build: (P, R, o) => {
      const pw = Math.round(R.w * o.pw), short = shortOf(P), name = named(P) ? '' : P.sectionName || '', ic = topicIcon(P), lw = pw - 48, out = [];
      if (!fitsLine(short, lw, 32, 2) || (name && (!planWords(name, lw, 22) || linesAt(name, lw * 0.95, 22) > 4))) return planNo('the panel text does not fit');
      const sh = planLH(short, lw, 32), nh = name ? planTH(name, lw, 22) : 0, D = Math.min(170, R.h - sh - nh - 70);
      if (D < 90) return planNo('the panel does not fit');
      const y0 = R.y + (R.h - D - 16 - sh - nh) / 2;
      out.push(box('roundRect', R.x, R.y, pw, R.h, { fill: accent(0), grp: 'hero' }), box('ellipse', R.x + (pw - D) / 2, y0, D, D, { fill: W, grp: 'hero' }),
        ...obj({ icon: ic || 'none' }, R.x + (pw - D * 0.6) / 2, y0 + D * 0.2, D * 0.6, accent(0), 'heroobj'),
        label(R.x + 24, y0 + D + 16, lw, sh, short, { size: 32, bold: true, color: INK, align: 'center', valign: 'top', grp: 'hero' }));
      if (name) out.push(label(R.x + 24, y0 + D + 16 + sh - 4, lw, nh, name, { size: 22, color: INK, align: 'center', valign: 'top', grp: 'hero' }));
      const x = R.x + pw + 40, w = R.x + R.w - x;
      if (named(P)) { const col = column(units(P), 'bar', x, R.y, w, R.h, o, 14, 20); return col ? out.concat(col.out) : planNo('the sections do not fit'); }
      const col = column(units(P), 'open', x, R.y, w, R.h, o, 18, 22);
      if (!col) return planNo('the list does not fit');
      col.ys.slice(0, -1).forEach((y, k) => { const yb = (y + col.hs[k] / 2 + col.ys[k + 1] - col.hs[k + 1] / 2) / 2; out.push(rule(x, yb - 1, w, 2, LIGHT)); });
      return out.concat(col.out);
    } });

  /* 9. Zigzag spine: a spine down the middle, the items alternating left and right on icon nodes. */
  reg('zigzag', { name: 'Zigzag spine', kind: 'list', appeal: 2,
    needs: P => named(P) ? 'for a list' : needShort(P) || nRange(P, 3, 6),
    opts: SIZES,
    build: (P, R0, o) => {
      const tr = topRow(P, R0, true); if (!tr) return planNo('the title row does not fit');
      const R = tr.R, U = units(P), n = U.length, step = R.h / n, D = Math.min(o.D, step - 6), cx = R.x + R.w / 2, cw = (R.w - D) / 2 - 40, out = [];
      const ch = Math.min(2 * step - 14, 150);
      if (D < 40) return planNo('the nodes do not fit');
      out.push(seg(cx, R.y + 4, cx, R.y + R.h - 4, LIGHT, 4));
      for (let k = 0; k < n; k++) {
        const u = U[k], yc = R.y + step * (k + 0.5), left = k % 2 === 0, x = left ? R.x : cx + D / 2 + 40, g = 'u' + k;
        const need = itemNeed('tile', u.it, cw, o);
        if (!isFinite(need) || need > ch) return planNo('a card does not fit');
        const h = Math.min(ch, need + 16), y = Math.max(R.y, Math.min(R.y + R.h - h, yc - h / 2));
        out.push(...badge(u.it, cx - D / 2, yc - D / 2, D, u.col, 'n' + k), seg(left ? x + cw + 4 : cx + D / 2 + 4, yc, left ? cx - D / 2 - 4 : x - 4, yc, u.col, 3),
          ...itemCard('tile', u.it, x, y, cw, h, u.col, Object.assign({}, o, { T: Math.min(o.T, h - 28) }), g));
      }
      return tr.out.concat(out);
    } });

  /* 10. Focus target: concentric rings (one per item, the topic's object in the centre), leaders to the item cards. */
  reg('target', { name: 'Focus target', kind: 'hub', appeal: 2,
    needs: P => named(P) ? 'for a list' : needShort(P) || nRange(P, 2, 4),
    opts: SIZES,
    build: (P, R0, o) => {
      const hd = heading(P, R0, 'left'); if (!hd) return planNo('the heading does not fit');
      const R = hd.R, U = units(P), n = U.length, lw = Math.min(R.h, R.w * 0.38), D = Math.min(R.h - 56, lw - 20), out = [];
      if (D < 200) return planNo('the target does not fit');
      const cx = R.x + lw / 2, cy = R.y + (R.h - D - 50) / 2 + D / 2, r0 = D / 2, rc = D * 0.16;
      for (let k = 0; k < n; k++) { const r = r0 - k * (r0 - rc) / n; out.push(box('ellipse', cx - r, cy - r, 2 * r, 2 * r, { fill: k % 2 ? soft(U[k].col) === PANEL ? W : soft(U[k].col) : U[k].col, grp: 'target' })); }
      out.push(box('ellipse', cx - rc, cy - rc, 2 * rc, 2 * rc, { fill: W, grp: 'target' }), ...obj({ icon: topicIcon(P) || 'none' }, cx - rc * 0.7, cy - rc * 0.7, rc * 1.4, accent(0), 'heroobj'));
      if (!fitsLine(shortOf(P), lw, 28)) return planNo('the topic does not fit');
      out.push(label(R.x, cy + r0 + 8, lw, 42, shortOf(P), { size: 28, bold: true, color: INK, align: 'center', valign: 'top', grp: 'target' }));
      const x = R.x + lw + 70, col = column(U, 'tile', x, R.y, R.x + R.w - x, R.h, o, 14, 24);
      if (!col) return planNo('the cards do not fit');
      U.forEach((u, k) => { const r = r0 - (k + 0.5) * (r0 - rc) / n, px = cx + r * 0.7, py = cy - r * 0.7;
        out.push(dot(px, py, W, 7), seg(px, py, x - 22, col.ys[k], GREY, 2), dot(x - 9, col.ys[k], u.col)); });
      return hd.out.concat(out, col.out);
    } });

  /* 11. Quadrant circle: four quadrants around a central disc with the topic; three items and the heading, or four items. */
  reg('quadcircle', { name: 'Quadrant circle', kind: 'framework', appeal: 4,
    needs: P => named(P) ? 'for a list' : needShort(P) || ((P.items.length === 3 && P.sectionName) || P.items.length === 4 ? '' : 'works for 3 items with a heading, or 4 items'),
    opts: SIZES,
    build: (P, R0, o) => {
      const four = P.items.length === 4, hd = four ? heading(P, R0, 'center') : { out: [], R: R0 }; if (!hd) return planNo('the heading does not fit');
      const R = hd.R, U = units(P), gap = 14, qw = (R.w - gap) / 2, qh = (R.h - gap) / 2, D = Math.min(qh * 1.2, 190), cx = R.x + R.w / 2, cy = R.y + R.h / 2, out = [];
      const free = qw - D / 2 - 30;
      for (let q = 0; q < 4; q++) {
        const left = q % 2 === 0, top = q < 2, x = left ? R.x : cx + gap / 2, y = top ? R.y : cy + gap / 2, u = U[q];
        const fill = u ? soft(u.col) === PANEL ? PANEL : soft(u.col) : soft(accent(0)) === PANEL ? W : soft(accent(0));
        out.push(box('roundRect', x, y, qw, qh, { fill: u ? fill : PANEL, grp: 'q' + q }));
        const tx = left ? x + 20 : x + D / 2 + 16, tw0 = free;
        if (u) {
          const need = itemNeed('open', u.it, tw0, o); if (!isFinite(need) || need > qh - 24) return planNo('a quadrant label does not fit');
          out.push(...itemCard('open', u.it, tx, y + (qh - need) / 2, tw0, need, u.col, o, 'u' + q));
        } else {
          const name = P.sectionName; if (!planWords(name, tw0, 22) || planTH(name, tw0, 22) > qh - 24) return planNo('the heading does not fit its quadrant');
          const h = planTH(name, tw0, 22); out.push(label(tx, y + (qh - h) / 2, tw0, h, name, { size: 22, color: INK, align: 'left', valign: 'top', grp: 'q' + q }));
        }
      }
      const ts = [26, 24, 22].find(z => fitsLine(shortOf(P), D * 0.8, z, 2));
      if (!ts) return planNo('the topic does not fit the disc');
      const sh = planLH(shortOf(P), D * 0.8, ts), ob = D * 0.34;
      out.push(box('ellipse', cx - D / 2 - 8, cy - D / 2 - 8, D + 16, D + 16, { fill: W, grp: 'hub' }), box('ellipse', cx - D / 2, cy - D / 2, D, D, { fill: accent(0), grp: 'hub' }),
        ...obj({ icon: topicIcon(P) || 'none' }, cx - ob / 2, cy - (ob + sh) / 2, ob, W, 'heroobj'),
        label(cx - D * 0.4, cy - (ob + sh) / 2 + ob, D * 0.8, sh, shortOf(P), { size: ts, bold: true, color: INK, align: 'center', valign: 'top', grp: 'hub' }));
      return hd.out.concat(out);
    } });

  /* 12. Icon band: a colour band with large icon discs on it, the labels below; the topic and heading above. */
  reg('iconband', { name: 'Icon band', kind: 'cards', appeal: 1,
    needs: P => named(P) ? 'for a list' : needShort(P) || nRange(P, 2, 6),
    opts: SIZES.map((o, i) => Object.assign({ B: [150, 132, 116, 100, 90][i] }, o)),
    build: (P, R0, o) => {
      const tr = topRow(P, R0, true); if (!tr) return planNo('the title row does not fit');
      const R = tr.R, U = units(P), n = U.length, cw = R.w / n, lw = cw - 16, out = [];
      if (!U.every(u => planFits(u.it, lw, o.s, 3))) return planNo('a label does not fit');
      const lab = Math.max(...U.map(u => planTextH(u.it, lw, o.s))), B = Math.round(Math.min(o.B, cw - 30, R.h - lab - 30)), need = B + 12 + lab;
      if (B < 70) return planNo('the discs do not fit');
      if (need > R.h) return planNo('the band does not fit');
      const y = R.y + (R.h - need) / 2;
      out.push(box('roundRect', R.x, y + B * 0.22, R.w, B * 0.56, { fill: soft(accent(0)) === PANEL ? PANEL : soft(accent(0)), grp: 'band' }));
      U.forEach((u, k) => { const x = R.x + k * cw; out.push(...badge(u.it, x + (cw - B) / 2, y, B, u.col, 'u' + k), ...planText(u.it, x + 8, y + B + 12, lw, o.s, { align: 'center', grp: 'u' + k })); });
      return tr.out.concat(out);
    } });

  /* 13. Folder tabs: each item a card with a colour tab holding its icon. */
  reg('tabcards', { name: 'Folder tabs', kind: 'cards', appeal: 1,
    needs: P => needShort(P) || nRange(P, 2, named(P) ? 3 : 5) || (!okSecs(P, 4) ? 'works for up to 4 items a section' : ''),
    opts: SIZES,
    build: (P, R0, o) => {
      const tr = topRow(P, R0, false); if (!tr) return planNo('the title row does not fit');
      const R = tr.R, U = units(P), gap = 18, cw = (R.w - gap * (U.length - 1)) / U.length, TH = 62, out = [];
      const needs = U.map(u => u.sec ? unitNeed(u, 'tile', cw, o) : (planFits(u.it, cw - 32, o.s, 3) ? planTextH(u.it, cw - 32, o.s) + 36 : Infinity));
      if (needs.some(n => !isFinite(n)) || Math.max(...needs) + TH > R.h) return planNo('the cards do not fit');
      const ch = Math.min(R.h - TH, Math.max(...needs) + 90), y = R.y + (R.h - ch - TH) / 2;
      U.forEach((u, k) => {
        const x = R.x + k * (cw + gap), g = 'u' + k, tw0 = Math.min(cw * 0.6, 150);
        out.push(box('tab', x, y, tw0, TH + 6, { fill: u.col, grp: g }), box('ellipse', x + (tw0 - 48) / 2, y + 7, 48, 48, { fill: W, grp: g }));
        if (u.sec) { out.push(...secCard(u, x, y + TH, cw, ch, o, secLay(u.sec, cw, o)), ...obj({ icon: (u.sec.items[0] || {}).icon }, x + (tw0 - 34) / 2, y + 14, 34, u.col, g + 'o')); return; }
        const th = planTextH(u.it, cw - 32, o.s);
        out.push(...obj(u.it, x + (tw0 - 34) / 2, y + 14, 34, u.col, g + 'o'), box('roundRect', x, y + TH, cw, ch, { fill: soft(u.col), grp: g }),
          ...planText(u.it, x + 16, y + TH + (ch - th) / 2, cw - 32, o.s, { grp: g }));
      });
      return tr.out.concat(out);
    } });

  /* 14. Speech bubbles: the items in speech bubbles above the topic's object and name. */
  reg('callouts', { name: 'Speech bubbles', kind: 'story',
    needs: P => named(P) ? 'for a list' : needShort(P) || nRange(P, 2, 4),
    opts: SIZES,
    build: (P, R0, o) => {
      const hd = heading(P, R0, 'center'); if (!hd) return planNo('the heading does not fit');
      const R = hd.R, U = units(P), n = U.length, gap = 26, bw = (R.w - gap * (n - 1)) / n, OB = 40, out = [];
      const needs = U.map(u => planFits(u.it, bw - OB - 44, o.s, 3) ? Math.max(OB + 28, planTextH(u.it, bw - OB - 44, o.s) + 28) : Infinity);
      if (needs.some(x => !isFinite(x))) return planNo('a bubble label does not fit');
      const bh = Math.max(...needs) + 20, heroH = R.h - bh * 1.18 - 14, HD = Math.min(190, heroH - 6), short = shortOf(P);
      if (HD < 80 || !fitsLine(short, R.w * 0.4, 30)) return planNo('the topic does not fit under the bubbles');
      U.forEach((u, k) => { const x = R.x + k * (bw + gap), th = planTextH(u.it, bw - OB - 44, o.s), g = 'u' + k;
        out.push(box('callout', x, R.y, bw, bh, { fill: soft(u.col) === PANEL ? PANEL : soft(u.col), grp: g }), ...obj(u.it, x + 16, R.y + (bh - OB) / 2, OB, u.col, g + 'o'),
          ...planText(u.it, x + OB + 28, R.y + (bh - th) / 2, bw - OB - 44, o.s, { grp: g })); });
      const hy = R.y + bh * 1.18 + 14 + (heroH - HD) / 2, sw = tw(short, 30, true) + 30, tot = HD + 24 + sw, x0 = R.x + (R.w - tot) / 2;
      out.push(box('ellipse', x0, hy, HD, HD, { fill: soft(accent(0)) === PANEL ? PANEL : soft(accent(0)), grp: 'hero' }),
        ...obj({ icon: topicIcon(P) || 'none' }, x0 + HD * 0.18, hy + HD * 0.18, HD * 0.64, accent(0), 'heroobj'),
        label(x0 + HD + 24, hy + (HD - 46) / 2, sw, 46, short, { size: 30, bold: true, color: INK, align: 'left', valign: 'middle', grp: 'hero' }));
      return hd.out.concat(out);
    } });

  // two named sections on the circuit board: the first section's items above the chip, the second's below, each
  // section's name in a pill of its colour beside the chip; traces end at each item's icon disc
  const chipSections = (P, R, o) => {
    const S = secsOf(P), C = 116, T = 48, lo = Object.assign({}, o, { T }), out = [], c = accent(0);
    const rowOf = (s, si) => { const cw = R.w / s.items.length, need = s.items.map(it => itemNeed('open', it, cw - 14, lo)); return { s, si, cw, h: Math.max(...need), col: accent(si + 1) }; };
    const A = rowOf(S[0], 0), B = rowOf(S[1], 1);
    if (!isFinite(A.h) || !isFinite(B.h)) return planNo('a label does not fit its row');
    const band = R.h - A.h - B.h; if (band < C + 2 * 26) return planNo('the chip does not fit between the rows');
    const cy = R.y + A.h + band / 2, cx = R.x + R.w / 2, sideW = (R.w - C) / 2 - 50;
    for (const [rw, y, up] of [[A, R.y, true], [B, R.y + R.h - B.h, false]]) {
      rw.s.items.forEach((it, j) => {
        const x = R.x + j * rw.cw, dx = x + T / 2, edge = up ? cy - C * 0.62 : cy + C * 0.62, sx = cx + (j - (rw.s.items.length - 1) / 2) * C * 0.2, my = (edge + (up ? y + rw.h : y)) / 2;
        const dy = up ? y + (rw.h + T) / 2 : y + (rw.h - T) / 2;
        out.push(seg(sx, edge, sx, my, rw.col, 3), seg(sx, my, dx, my, rw.col, 3), seg(dx, my, dx, dy, rw.col, 3));
        out.push(...itemCard('open', it, x, y, rw.cw - 14, rw.h, rw.col, lo, 'chip' + rw.si + '_' + j));
      });
      const pw = pillW(rw.s.name, 22) + 10;
      if (pw > sideW) return planNo('a section name does not fit its pill');
      out.push(box('pill', up ? cx - C / 2 - 40 - pw : cx + C / 2 + 40, cy - 22, pw, 44, { fill: rw.col, text: rw.s.name, size: 22, bold: true, align: 'center', valign: 'middle', grp: 'pill' + rw.si }));
    }
    out.unshift(...obj({ icon: 'aichip' }, cx - C * 0.62, cy - C * 0.62, C * 1.24, c, 'chip'));
    return out;
  };

  /* 15. Circuit board: a chip in the middle with the topic and heading beside it, traces to cards above and below. */
  reg('chipboard', { name: 'Circuit board', kind: 'scene', appeal: 4,
    needs: P => needShort(P) || (named(P) ? (secsOf(P).length !== 2 ? 'works for 2 sections' : !okSecs(P, 5) ? 'works for up to 5 items a section' : '') : nRange(P, 2, 6)),
    opts: SIZES,
    build: (P, R, o) => {
      if (named(P)) return chipSections(P, R, o);
      const U = units(P), top = U.slice(0, Math.ceil(U.length / 2)), bot = U.slice(Math.ceil(U.length / 2)), C = 120, gapV = 34, out = [];
      const avail = (R.h - C - 2 * gapV) / 2, a = row(top, 'tile', R.x, R.y, R.w, avail, o, 18);
      if (!a) return planNo('the upper cards do not fit');
      const b = bot.length ? row(bot, 'tile', R.x + (top.length - bot.length) * (a.cw + 18) / 2, R.y + R.h - Math.min(avail, a.h), bot.length * (a.cw + 18) - 18, Math.min(avail, a.h), o, 18) : null;
      if (bot.length && !b) return planNo('the lower cards do not fit');
      const yTop = R.y + a.h, yBot = b ? R.y + R.h - b.h : R.y + R.h, cy = (yTop + yBot) / 2, cx = R.x + R.w / 2, c = accent(0);
      if (yBot - yTop < C + 2 * 24) return planNo('the chip does not fit');
      const short = shortOf(P), name = named(P) ? '' : P.sectionName || '', sideW = (R.w - C) / 2 - 40;
      if (!fitsLine(short, sideW, 30) || (name && (!planWords(name, sideW, 22) || planTH(name, sideW, 22) > C + 20))) return planNo('the topic or heading does not fit beside the chip');
      out.push(...obj({ icon: 'aichip' }, cx - C * 0.62, cy - C * 0.62, C * 1.24, c, 'chip'));
      out.push(label(R.x, cy - 23, sideW, 46, short, { size: 30, bold: true, color: INK, align: 'center', valign: 'middle', grp: 'chiptext' }));
      if (name) { const h = planTH(name, sideW, 22); out.push(label(cx + C / 2 + 40, cy - h / 2, sideW, h, name, { size: 22, color: INK, align: 'left', valign: 'top', grp: 'chiptext' })); }
      const traces = (xs, yEdge, yCard) => xs.forEach((x, k) => { const sx = cx + (k - (xs.length - 1) / 2) * C * 0.22, my = (yEdge + yCard) / 2;
        out.push(seg(sx, yEdge, sx, my, c, 3), seg(sx, my, x, my, c, 3), seg(x, my, x, yCard + (yCard > yEdge ? -9 : 9), c, 3), dot(x, yCard + (yCard > yEdge ? -9 : 9), c)); });
      traces(a.xs, cy - C * 0.62, yTop); if (b) traces(b.xs, cy + C * 0.62, yBot);
      return out.concat(a.out, b ? b.out : []);
    } });

  /* 16. Ribbon tags: colour tag ribbons, each with an icon disc and its label; the topic in a disc on the right. */
  reg('ribbontags', { name: 'Ribbon tags', kind: 'list', appeal: 3,
    needs: P => needShort(P) || (named(P) ? nRange(P, 2, 3) || (!okSecs(P, 5) ? 'works for up to 5 items a section' : '') : nRange(P, 2, 5)),
    opts: SIZES.map((o, i) => Object.assign({ hw: [0.3, 0.28, 0.26, 0.25, 0.25][i] }, o)),
    build: (P, R, o) => {
      if (named(P)) {
        // one ribbon per section (its name), its items to the right of the ribbon's point: icon disc above the label
        const S = secsOf(P), k = S.length, rw = Math.max(200, ...S.map(s => Math.min(280, pillW(s.name, 24) + 30))), ix = R.x + rw + 24, iw = R.x + R.w - ix, D = Math.min(o.D, 56), out = [];
        const needs = S.map(s => { const cw = iw / s.items.length;
          if (!fitsLine(s.name, rw - 50, 24, 2) || !s.items.every(it => planFits(it, cw - 12, o.s, 3))) return Infinity;
          return D + 8 + Math.max(...s.items.map(it => planTextH(it, cw - 12, o.s))) + 16; });
        if (needs.some(x => !isFinite(x))) return planNo('a label does not fit');
        const tot = needs.reduce((a, b) => a + b, 0) + 24 * (k - 1); if (tot > R.h) return planNo('the ribbons do not fit');
        let y = R.y + (R.h - tot) / 2;
        S.forEach((s, si) => { const h = needs[si], col = accent(si + 1), cw = iw / s.items.length, rh = Math.min(h, 96), nh = planLH(s.name, rw - 50, 24);
          out.push(box('homePlate', R.x, y + (h - rh) / 2, rw, rh, { fill: col, grp: 'rib' + si }),
            label(R.x + 16, y + (h - nh) / 2, rw - 50, nh, s.name, { size: 24, bold: true, color: INK, align: 'left', valign: 'top', grp: 'rib' + si }));
          s.items.forEach((it, j) => { const x = ix + j * cw, g = 'ri' + si + '_' + j;
            out.push(...badge(it, x + (cw - D) / 2, y + 4, D, col, g), ...planText(it, x + 6, y + 4 + D + 8, cw - 12, o.s, { align: 'center', grp: g })); });
          if (si < k - 1) out.push(rule(R.x, y + h + 11, R.w, 2, LIGHT));
          y += h + 24; });
        return out;
      }
      const U = units(P), n = U.length, hw = Math.round(R.w * o.hw), rw = R.w - hw - 40, gap = 14, out = [];
      const rh0 = (R.h - gap * (n - 1)) / n, rh = Math.min(rh0, 110), D = Math.min(rh - 18, o.T + 10), lw = rw - D - 60;
      if (!U.every(u => planFits(u.it, lw, o.s, 2) && planTextH(u.it, lw, o.s) <= rh - 10)) return planNo('a ribbon label does not fit');
      const y0 = R.y + (R.h - n * rh - (n - 1) * gap) / 2;
      U.forEach((u, k) => { const y = y0 + k * (rh + gap), g = 'u' + k, th = planTextH(u.it, lw, o.s);
        out.push(box('homePlate', R.x, y, rw, rh, { fill: u.col, grp: g }), box('ellipse', R.x + 10, y + (rh - D) / 2, D, D, { fill: W, grp: g }),
          ...obj(u.it, R.x + 10 + D * 0.18, y + (rh - D) / 2 + D * 0.18, D * 0.64, u.col, g + 'o'), ...planText(u.it, R.x + D + 26, y + (rh - th) / 2, lw, o.s, { grp: g })); });
      const name = P.sectionName || '', lw2 = hw - 10, D2 = Math.min(170, hw - 40);
      const nh = name ? planTH(name, lw2, 22) : 0, dh = discH(P, D2, lw2) + (name ? nh + 4 : 0);
      if (name && (!planWords(name, lw2, 22) || linesAt(name, lw2 * 0.95, 22) > 4)) return planNo('the heading does not fit');
      if (dh > R.h) return planNo('the topic disc does not fit');
      const hx = R.x + R.w - hw / 2, hy = R.y + (R.h - dh) / 2, H = disc(P, hx, hy, D2, accent(0), lw2);
      if (!H) return planNo('the topic does not fit');
      out.push(...H.out);
      if (name) out.push(label(hx - lw2 / 2, hy + H.h + 4, lw2, nh, name, { size: 22, color: INK, align: 'center', valign: 'top', grp: 'hero' }));
      return out;
    } });
  /* 17. Mind map: the topic in a disc on the left, a branch per section (a list: its heading), leaves for the items. */
  reg('mindmap', { name: 'Mind map', kind: 'hub', appeal: 4,
    needs: P => needShort(P) || (named(P) ? nRange(P, 2, 3) || (!okSecs(P, 5) ? 'works for up to 5 items a section' : '') : !P.sectionName ? 'needs a heading for the branch' : nRange(P, 2, 6)),
    opts: SIZES.map((o, i) => Object.assign({ dd: [180, 164, 150, 140, 130][i], L: [52, 48, 44, 42, 40][i] }, o)),
    build: (P, R, o) => {
      const S = secsOf(P), k = S.length, D = Math.min(o.dd, R.h - 70), lw0 = D + 36, out = [];
      const pw = named(P) ? Math.min(250, Math.max(...S.map(s => pillW(s.name, 22)))) : 270, bx = R.x + lw0 + 46, lx = bx + pw + 56, lw = R.x + R.w - lx;
      const lo = Object.assign({}, o, { T: o.L });
      const nameH = S.map(s => named(P) ? (fitsLine(s.name, pw - 30, 22) ? 44 : Infinity) : (planWords(s.name, pw - 28, 22) && linesAt(s.name, (pw - 28) * 0.95, 22) <= 4 ? planTH(s.name, pw - 28, 22) + 20 : Infinity));
      if (nameH.some(h => !isFinite(h))) return planNo('a branch name does not fit');
      const leafH = S.map(s => s.items.map(it => itemNeed('open', it, lw, lo)));
      if (leafH.some(L => L.some(h => !isFinite(h)))) return planNo('a leaf label does not fit');
      const blk = leafH.map((L, si) => Math.max(nameH[si], L.reduce((a, b) => a + b, 0) + 10 * (L.length - 1))), total = blk.reduce((a, b) => a + b, 0) + 26 * (k - 1);
      if (total > R.h) return planNo('the branches do not fit');
      const dh = discH(P, D, lw0); if (dh > R.h) return planNo('the topic does not fit');
      const H = disc(P, R.x + lw0 / 2, R.y + (R.h - dh) / 2, D, accent(0), lw0); if (!H) return planNo('the topic does not fit');
      out.push(...H.out);
      const hx = R.x + lw0 / 2 + D / 2, hy = R.y + (R.h - dh) / 2 + D / 2, ex = Math.min(30, (R.h - total) / k);
      let y = R.y + (R.h - total - ex * k) / 2;
      S.forEach((s, si) => {
        const h = blk[si] + ex, col = named(P) ? accent(si + 1) : accent(1), my = y + h / 2, g = 'br' + si;
        out.push(seg(hx + 4, hy, bx, my, accent(0), 3));
        if (named(P)) out.push(box('pill', bx, my - 22, pw, 44, { fill: col, text: s.name, size: 22, bold: true, align: 'center', valign: 'middle', grp: g }));
        else { const th = nameH[si] - 20; out.push(box('roundRect', bx, my - nameH[si] / 2, pw, nameH[si], { fill: col, grp: g }), label(bx + 14, my - th / 2, pw - 28, th, s.name, { size: 22, color: INK, align: 'center', valign: 'top', grp: g })); }
        const L = leafH[si], used = L.reduce((a, b) => a + b, 0) + 10 * (L.length - 1); let ly = y + (h - used) / 2;
        s.items.forEach((it, j) => { const lh = L[j], cy = ly + lh / 2;
          out.push(seg(bx + pw, my, lx - 6, cy, col, 2), ...itemCard('open', it, lx, ly, lw, lh, col, lo, 'leaf' + si + '_' + j)); ly += lh + 10; });
        y += h + 26;
      });
      return out;
    } });

  /* 18. Circle headers: named sections side by side, each a card topped by a large colour circle with its name, its
     items as an icon list in the card. */
  reg('circleheads', { name: 'Circle headers', kind: 'grouped', appeal: 3,
    needs: P => !named(P) ? 'for named sections' : nRange(P, 2, 3) || (!okSecs(P, 5) ? 'works for up to 5 items a section' : ''),
    opts: SIZES.map((o, i) => Object.assign({ cd: [176, 166, 158, 150, 144][i] }, o)),
    build: (P, R, o) => {
      const S = secsOf(P), k = S.length, gap = 30, cw = (R.w - gap * (k - 1)) / k, CD = o.cd, lo = Object.assign({}, o, { T: 44 }), out = [];
      if (!S.every(s => planWords(s.name, CD * 0.8, 24) && linesAt(s.name, CD * 0.76, 24) <= 3)) return planNo('a section name does not fit its circle');
      const rows = S.map(s => s.items.map(it => itemNeed('open', it, cw - 40, lo)));
      if (rows.some(L => L.some(h => !isFinite(h)))) return planNo('a label does not fit its card');
      const listH = rows.map(L => L.reduce((a, b) => a + b, 0) + 8 * (L.length - 1)), need = CD + 14 + Math.max(...listH) + 16;
      if (need > R.h) return planNo('the cards do not fit');
      const y0 = R.y + (R.h - need) / 2;
      S.forEach((s, si) => {
        const x = R.x + si * (cw + gap), col = accent(si + 1), g = 'ch' + si, nh = planLH(s.name, CD * 0.8, 24);
        out.push(box('roundRect', x, y0 + CD / 2, cw, need - CD / 2, { fill: soft(col), grp: g }),
          box('ellipse', x + (cw - CD) / 2 - 7, y0 - 7, CD + 14, CD + 14, { fill: W, grp: g }), box('ellipse', x + (cw - CD) / 2, y0, CD, CD, { fill: col, grp: g }),
          label(x + (cw - CD * 0.8) / 2, y0 + (CD - nh) / 2, CD * 0.8, nh, s.name, { size: 24, bold: true, color: INK, align: 'center', valign: 'top', grp: g }));
        let y = y0 + CD + 14;
        s.items.forEach((it, j) => { out.push(...itemCard('open', it, x + 20, y, cw - 40, rows[si][j], col, lo, g + '_' + j)); y += rows[si][j] + 8; });
      });
      return out;
    } });

  // the concept tiles of the concepts pack are the same kind of composition (hero, bracket, icon tiles)
  if (PLAN_LAYOUTS.concepttiles) PLAN_LAYOUTS.concepttiles.appeal = 5;
  // the learning pack's learning map is the hero card with panels under header pills (the AI & ML infographic)
  if (PLAN_LAYOUTS.learnmap) PLAN_LAYOUTS.learnmap.appeal = 6;
});
