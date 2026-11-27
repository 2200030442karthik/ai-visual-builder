/* AI Visual Builder design pack "infographics" 10.24.0 - professional infographic structures (ideas from the MIT-licensed
   antvis/infographic catalogue: sequence-cylinders, list-row with arrows, list-grid with badge cards), drawn in the
   brand standard:
     cylsteps     rising 2.5D cylinders, numbered, each point's object on a badge above it, its words below (an order)
     arrowcards   bordered icon cards joined by arrows, numbered (an order)
     badgecards   bordered icon cards with white-on-colour badges, in one or two rows (independent points; the card
                  style of the reference course slides, for any list)
   The same rules as every family (packs/README.txt): every label and description at 22 pt and up, approved colours,
   Open Sans, native editable shapes only, no outlines around filled shapes, and only the relationships the content
   states (numbers and arrows only for an order the text gives). Loaded after plan.js. */
registerPack('infographics', '10.24.0', () => {
  const W = '#FFFFFF', FLOOR = '#D9D9D9';
  /* everyday business words the catalogue missed, on objects it already has (icon matching, 10.24) */
  const add = (key, name, strong, weak) => {
    if (!CMP[key]) return;
    const terms = (list, w) => (list || '').split(' | ').map(t => t.trim()).filter(Boolean).map(t => ({
      re: new RegExp('(?:^|[^\\w-])' + t.replace(/\*/g, '\\w*') + '(?![\\w])', 'i'), w: w * (/\s/.test(t) ? 1.5 : 1), t }));
    CATALOG.push({ key, name, terms: terms(strong, 2).concat(terms(weak, 1)) });
    if (!CMP_NAMES[key]) CMP_NAMES[key] = name;
  };
  add('course', 'Training', 'training | employee training | upskill* | reskill* | trainings? programs?');
  add('person', 'Leadership', 'leadership | leading | coach*');
  add('rocket', 'Speed', 'speed | fast(?:er)? | quick(?:er|ly)? | agil* | accelerat*');
  add('calendar', 'Time', 'time management | time | deadlines? | on time | punctual*');
  add('globe', 'Global', 'global* | worldwide | international* | sustainab* | environment* | green | climate');
  add('shield', 'Reliability', 'reliab* | trust* | dependab* | resilien* | stabil*');
  add('shapes', 'Design', 'design(?:s|ing)? | prototyp* | wirefram* | mock-?ups? | user experience | ux | ui');
  add('gear', 'Build', 'build(?:s|ing)? | develop(?:s|ing|ment)? | construct*');
  add('research', 'Research', 'market research | research(?:es|ing)? | surveys? of the market | studies');
  /* the point's object as a white pictogram on a coloured disc (the reference slides' badges) */
  function badge(key, x, y, D, c, grp) {
    const inv = v => (v && String(v).toUpperCase() === W ? c : v ? W : v);
    const parts = comp(key || 'none', x + D * 0.17, y + D * 0.17, D * 0.66, c).map(p => {
      const q = Object.assign({}, p, { grp });
      if (q.fill) q.fill = inv(q.fill);
      if (q.line) q.line = inv(q.line);
      if (q.t === 'line' && q.color) q.color = inv(q.color);
      return q;
    });
    return [box('ellipse', x, y, D, D, { fill: c, grp })].concat(parts);
  }
  const cardFill = c => (typeof softTints === 'function' && softTints() ? tint(c, SOFT_T) : W);
  // a coloured border without an outline: the card in its colour with the light card 2 pt inside it
  const bordered = (x, y, w, h, c, fill) => [box('roundRect', x, y, w, h, { fill: c }), box('roundRect', x + 2, y + 2, w - 4, h - 4, { fill })];
  /* the topic above the composition, when the text has one and it fits on one or two lines */
  function heading(P, R, out) {
    const t = String(P.title || '').trim();
    if (!t || !planWords(t, R.w, 24) || linesAt(t, R.w * 0.95, 24) > 2) return 0;
    const h = planLH(t, R.w, 24);
    out.push(label(R.x, R.y, R.w, h, t, { size: 24, bold: true, color: INK, align: 'left', valign: 'top' }));
    return h + 4;
  }
  const textH = (it, tw, s) => planTH(it.label, tw, s) + (it.detail ? planTH(it.detail, tw, PLAN_DS) - 6 : 0);
  const fits = (it, tw, s, maxL) => tw > 90 && planWords(it.label, tw, s) && linesAt(it.label, tw, s) <= maxL && (!it.detail || planWords(it.detail, tw, PLAN_DS));
  function words(it, x, y, tw, s, out, al) {
    const lh = planTH(it.label, tw, s);
    out.push(label(x, y, tw, lh, it.label, { size: s, bold: true, color: INK, align: al || 'center', valign: 'top' }));
    if (it.detail) out.push(label(x, y + lh - 6, tw, planTH(it.detail, tw, PLAN_DS), it.detail, { size: PLAN_DS, color: INK, align: al || 'center', valign: 'top' }));
  }
  const ordered = P => typeof planSeq === 'function' && planSeq(P);
  const flat = P => !planGroups(P).length;

  /* ---------- rising 2.5D cylinders ---------- */
  const cylWhy = P => !flat(P) ? 'not for grouped content' : P.items.length < 3 || P.items.length > 6 ? 'works for 3 to 6 points'
    : !ordered(P) && P.relation !== 'layers' ? 'only for steps in a stated order or rising levels' : '';
  function cylsteps(P, R, o) {
    const out = [], n = P.items.length, gap = n >= 6 ? 10 : 18, cw = (R.w - gap * (n - 1)) / n, tw = cw - 6;
    if (!P.items.every(it => fits(it, tw, o.s, 3))) return planNo('a point does not fit under its cylinder');
    const top = R.y + heading(P, R, out), th = Math.max(...P.items.map(it => textH(it, tw, o.s)));
    const base = R.y + R.h - th - 10, area = base - top - o.D - 10;
    if (area < 90) return planNo('no room for the cylinders');
    const bw = Math.min(cw * 0.62, 150);
    out.push(box('roundRect', R.x, base, R.w, 5, { fill: FLOOR }));
    P.items.forEach((it, i) => {
      const c = accent(i), g = 'cy' + i, x = R.x + i * (cw + gap), h = area * (0.42 + 0.58 * (n > 1 ? i / (n - 1) : 1)), y = base - h;
      const parts = [box('can', x + (cw - bw) / 2, y, bw, h, { fill: c, text: String(i + 1), size: 28, bold: true, color: textOn(c), align: 'center', valign: 'middle' }),
        ...badge(it.icon, x + (cw - o.D) / 2, y - o.D - 8, o.D, c, g)];
      words(it, x + 3, base + 10, tw, o.s, parts);
      out.push(...planGrp(parts, g, it.label));
    });
    return out;
  }
  regPlan('cylsteps', { name: 'Rising cylinders (2.5D)', family: 'cylsteps', kind: 'sequence', appeal: 4,
    suits: P => !cylWhy(P), needs: cylWhy, opts: [{ s: 24, D: 56 }, { s: 22, D: 48 }, { s: 22, D: 40 }], build: cylsteps });

  /* ---------- icon cards joined by arrows ---------- */
  const arrWhy = P => !flat(P) ? 'not for grouped content' : P.items.length < 3 || P.items.length > 5 ? 'works for 3 to 5 steps' : !ordered(P) ? 'only for steps in a stated order' : '';
  function arrowcards(P, R, o) {
    const out = [], n = P.items.length, aw = 26, gap = aw + 14, cw = (R.w - gap * (n - 1)) / n, tw = cw - 2 * o.pad;
    if (!P.items.every(it => fits(it, tw, o.s, 3))) return planNo('a step does not fit its card');
    const top = R.y + heading(P, R, out), th = Math.max(...P.items.map(it => textH(it, tw, o.s)));
    const ch = o.pad + o.D + 10 + th + o.pad;
    if (top + ch > R.y + R.h) return planNo('the cards do not fit the height');
    const y = top + Math.max(0, (R.y + R.h - top - ch) / 2);
    P.items.forEach((it, i) => {
      const c = accent(i), g = 'ac' + i, x = R.x + i * (cw + gap), N = 40;
      const parts = [...bordered(x, y, cw, ch, c, cardFill(c)),
        box('roundRect', x + 10, y + 10, N + 8, N, { fill: tint(c, 0.75), text: String(i + 1), size: 22, bold: true, color: INK, align: 'center', valign: 'middle' }),
        ...badge(it.icon, x + (cw - o.D) / 2, y + o.pad, o.D, c, g)];
      words(it, x + o.pad, y + o.pad + o.D + 10, tw, o.s, parts);
      out.push(...planGrp(parts, g, it.label));
      if (i < n - 1) out.push(box('rightArrow', x + cw + 7, y + ch / 2 - 13, aw, 26, { fill: CONNECTOR }));
    });
    return out;
  }
  regPlan('arrowcards', { name: 'Icon cards with arrows', family: 'arrowcards', kind: 'sequence', appeal: 6,
    suits: P => !arrWhy(P), needs: arrWhy, opts: [{ s: 24, D: 60, pad: 14 }, { s: 22, D: 52, pad: 10 }, { s: 22, D: 44, pad: 8 }], build: arrowcards });

  /* ---------- bordered badge cards (independent points) ---------- */
  const bcWhy = P => !flat(P) ? 'not for grouped content' : P.items.length < 3 || P.items.length > 8 ? 'works for 3 to 8 points' : P.statement ? 'not for one statement' : '';
  function badgecards(P, R, o) {
    const out = [], n = P.items.length, gap = 14;
    const top = R.y + heading(P, R, out);
    let cols = 0, cw = 0, tw = 0;
    for (const c of [...new Set([n <= 5 ? n : 0, Math.ceil(n / 2)])].filter(Boolean)) {
      cw = (R.w - gap * (c - 1)) / c; tw = cw - 2 * o.pad;
      if (P.items.every(it => fits(it, tw, o.s, c >= 4 ? 4 : 3))) { cols = c; break; }
    }
    if (!cols) return planNo('a point does not fit its card');
    const nr = Math.ceil(n / cols), th = Math.max(...P.items.map(it => textH(it, tw, o.s))), ch = o.pad + o.D + 8 + th + o.pad;
    const total = nr * ch + (nr - 1) * 12;
    if (top + total > R.y + R.h) return planNo('the cards do not fit the height');
    const y0 = top + Math.max(0, (R.y + R.h - top - total) / 2);
    P.items.forEach((it, i) => {
      const r = Math.floor(i / cols), inRow = r < nr - 1 ? cols : n - cols * (nr - 1), x0 = R.x + (R.w - (inRow * cw + (inRow - 1) * gap)) / 2;
      const x = x0 + (i % cols) * (cw + gap), y = y0 + r * (ch + 12), c = accent(i), g = 'bc' + i;
      const parts = [...bordered(x, y, cw, ch, c, cardFill(c)), ...badge(it.icon, x + (cw - o.D) / 2, y + o.pad, o.D, c, g)];
      words(it, x + o.pad, y + o.pad + o.D + 8, tw, o.s, parts);
      out.push(...planGrp(parts, g, it.label));
    });
    return out;
  }
  regPlan('badgecards', { name: 'Icon cards', family: 'badgecards', kind: 'list', appeal: 6,
    suits: P => !bcWhy(P), needs: bcWhy, opts: [{ s: 24, D: 60, pad: 12 }, { s: 22, D: 52, pad: 10 }, { s: 22, D: 44, pad: 8 }], build: badgecards });
});
