/* AI Visual Builder design pack "learning" 10.15.0 - learner-facing compositions in the spirit of polished AI
   infographics (the "VisualX" reference): a hero for the topic, named sections with pill headings, a colourful object
   for every item, clear hierarchy and generous spacing. Made for course and topic summaries ("What you learn" /
   "Best for", sections.js) and for short lists. Nine structurally different compositions:
     learnmap     hero panel (the topic's object and short name) joined by a bracket to stacked section panels, each
                  with its items as object-and-label columns (the reference's layout)
     herobanner   a hero band across the top (object and title), the sections as cards below it
     bridge       skills to outcomes: the first section on the left, the topic as a hub, the second section on the right
     iconrows     each section a band: its name on a colour chip, its items as object columns
     badges       badge cards (an object disc over each card), grouped under their section headings
     splitpanels  tall section panels, each led by a large object for the section and its items as rows
     poster       a learning poster: the headline large on the left, the items as tagged object tiles on the right
     ribbon       the topic on a band across the middle, one section above it and the other below
     colortiles   every item a colour tile, each section's tiles in a row under its name
   Also new native objects (all editable shapes): brain, megaphone, mail, briefcase, rocket, growth, social, analysis,
   trophy. The same rules as every family (packs/README.txt): native shapes only, approved colours, Open Sans, every
   label and description at 22 pt and up, only what the content states (a section's object only depicts the section's
   own name: learning, audience, outcomes, tools). Loaded after plan.js and sections.js. */
registerPack('learning', '10.15.0', () => {
  const W = '#FFFFFF', RULE = '#D9D9D9', LINE = '#7F7F7F';
  const alt = (c, k) => { const A = TEMPLATE.accents, i = A.indexOf(c); return A[((i < 0 ? 0 : i) + (k || 3)) % A.length]; };

  /* ---------- new objects (native shapes, each drawn inside the square x, y, s) ---------- */
  const P_ = (x, y, s) => v => [x + s * v[0], y + s * v[1]];
  Object.assign(CMP, {
    brain: (x, y, s, c) => { const p = P_(x, y, s), c2 = alt(c), w = Math.max(2, s * 0.03);
      return [box('ellipse', x + s * 0.06, y + s * 0.12, s * 0.48, s * 0.64, { fill: c }), box('ellipse', x + s * 0.46, y + s * 0.12, s * 0.48, s * 0.64, { fill: c2 }),
        box('roundRect', x + s * 0.43, y + s * 0.68, s * 0.14, s * 0.22, { fill: c }), rule(x + s * 0.493, y + s * 0.16, s * 0.014, s * 0.56, W)]
        .concat(polyline([[0.16, 0.36], [0.26, 0.28], [0.38, 0.34]].map(p), W, w), polyline([[0.12, 0.52], [0.24, 0.48], [0.3, 0.6], [0.42, 0.56]].map(p), W, w),
          polyline([[0.56, 0.3], [0.7, 0.3], [0.8, 0.4]].map(p), W, w), polyline([[0.58, 0.56], [0.72, 0.56], [0.78, 0.48]].map(p), W, w),
          [[0.8, 0.4], [0.78, 0.48], [0.56, 0.3], [0.58, 0.56]].map(v => box('ellipse', x + s * (v[0] - 0.035), y + s * (v[1] - 0.035), s * 0.07, s * 0.07, { fill: W }))); },
    megaphone: (x, y, s, c) => [box('trapezoid', x + s * 0.22, y + s * 0.22, s * 0.56, s * 0.42, { fill: c, rot: 270 }),
      box('roundRect', x + s * 0.12, y + s * 0.36, s * 0.14, s * 0.18, { fill: alt(c) }), box('ellipse', x + s * 0.64, y + s * 0.14, s * 0.12, s * 0.62, { fill: alt(c) }),
      box('roundRect', x + s * 0.34, y + s * 0.58, s * 0.1, s * 0.28, { fill: c })]
      .concat([[0.84, 0.3, 0.94, 0.2], [0.86, 0.45, 0.98, 0.45], [0.84, 0.6, 0.94, 0.7]].map(v => seg(x + s * v[0], y + s * v[1], x + s * v[2], y + s * v[3], CORAL, Math.max(2, s * 0.035)))),
    mail: (x, y, s, c) => [box('roundRect', x + s * 0.08, y + s * 0.2, s * 0.84, s * 0.6, { fill: c }), box('merge', x + s * 0.08, y + s * 0.2, s * 0.84, s * 0.4, { fill: alt(c) }),
      box('ellipse', x + s * 0.74, y + s * 0.08, s * 0.2, s * 0.2, { fill: CORAL })],
    briefcase: (x, y, s, c) => [box('roundRect', x + s * 0.34, y + s * 0.12, s * 0.32, s * 0.18, { fill: alt(c) }), box('roundRect', x + s * 0.41, y + s * 0.18, s * 0.18, s * 0.1, { fill: W }),
      box('roundRect', x + s * 0.08, y + s * 0.28, s * 0.84, s * 0.58, { fill: c }), rule(x + s * 0.08, y + s * 0.5, s * 0.84, s * 0.05, alt(c)),
      box('roundRect', x + s * 0.44, y + s * 0.45, s * 0.12, s * 0.15, { fill: GOLD })],
    rocket: (x, y, s, c) => [box('triangle', x + s * 0.2, y + s * 0.48, s * 0.24, s * 0.3, { fill: alt(c) }), box('triangle', x + s * 0.56, y + s * 0.48, s * 0.24, s * 0.3, { fill: alt(c) }),
      box('roundRect', x + s * 0.36, y + s * 0.2, s * 0.28, s * 0.56, { fill: c }), box('triangle', x + s * 0.36, y + s * 0.04, s * 0.28, s * 0.2, { fill: CORAL }),
      box('ellipse', x + s * 0.43, y + s * 0.3, s * 0.14, s * 0.14, { fill: W }), box('merge', x + s * 0.4, y + s * 0.76, s * 0.2, s * 0.18, { fill: GOLD })],
    growth: (x, y, s, c) => [rule(x + s * 0.08, y + s * 0.88, s * 0.84, s * 0.03, LINE)]
      .concat([0.3, 0.45, 0.62, 0.8].map((h, i) => box('rect', x + s * (0.12 + i * 0.2), y + s * (0.88 - h * 0.85), s * 0.14, s * h * 0.85, { fill: i % 2 ? alt(c) : c })),
        polyline([[0.1, 0.6], [0.34, 0.46], [0.54, 0.5], [0.8, 0.18]].map(P_(x, y, s)), CORAL, Math.max(2.5, s * 0.04)), [headAt(x + s * 0.88, y + s * 0.08, -51, s * 0.16, CORAL)]),
    social: (x, y, s, c) => { const D = s * 0.26, pts = [[0.26, 0.5, c], [0.74, 0.22, alt(c)], [0.74, 0.78, CORAL]];
      return [seg(x + s * 0.26, y + s * 0.5, x + s * 0.74, y + s * 0.22, LINE, Math.max(2, s * 0.03)), seg(x + s * 0.26, y + s * 0.5, x + s * 0.74, y + s * 0.78, LINE, Math.max(2, s * 0.03))]
        .concat(pts.map(([u, v, col]) => box('ellipse', x + s * u - D / 2, y + s * v - D / 2, D, D, { fill: col })),
          pts.map(([u, v]) => box('ellipse', x + s * u - D * 0.17, y + s * v - D * 0.3, D * 0.34, D * 0.34, { fill: W })),
          pts.map(([u, v]) => box('roundRect', x + s * u - D * 0.28, y + s * v + D * 0.06, D * 0.56, D * 0.24, { fill: W }))); },
    analysis: (x, y, s, c) => [box('roundRect', x + s * 0.06, y + s * 0.1, s * 0.66, s * 0.6, { fill: PANEL })]
      .concat([0.22, 0.38, 0.3].map((h, i) => box('rect', x + s * (0.16 + i * 0.16), y + s * (0.6 - h), s * 0.1, s * h, { fill: i === 1 ? alt(c) : c })),
        [box('donut', x + s * 0.44, y + s * 0.4, s * 0.36, s * 0.36, { fill: alt(c, 4) }), seg(x + s * 0.74, y + s * 0.72, x + s * 0.92, y + s * 0.9, alt(c, 4), Math.max(3, s * 0.07))]),
    trophy: (x, y, s, c) => [box('donut', x + s * 0.1, y + s * 0.16, s * 0.26, s * 0.3, { fill: GOLD }), box('donut', x + s * 0.64, y + s * 0.16, s * 0.26, s * 0.3, { fill: GOLD }),
      box('trapezoid', x + s * 0.24, y + s * 0.1, s * 0.52, s * 0.42, { fill: GOLD, rot: 180 }), box('rect', x + s * 0.45, y + s * 0.5, s * 0.1, s * 0.18, { fill: GOLD }),
      box('roundRect', x + s * 0.3, y + s * 0.68, s * 0.4, s * 0.1, { fill: c }), box('roundRect', x + s * 0.24, y + s * 0.78, s * 0.52, s * 0.12, { fill: c })],
  });
  // what each object depicts (strong terms, weak terms), matched like the rest of the catalogue (gallery.js CATALOG)
  const add = (key, name, strong, weak) => {
    const terms = (list, w) => (list || '').split(' | ').map(t => t.trim()).filter(Boolean).map(t => ({
      re: new RegExp('(?:^|[^\\w-])' + t.replace(/\*/g, '\\w*') + '(?![\\w])', 'i'), w: w * (/\s|\\s| \?/.test(t) ? 1.5 : 1), t }));
    CATALOG.push({ key, name, terms: terms(strong, 2).concat(terms(weak, 1)) });
    if (!CMP_NAMES[key]) CMP_NAMES[key] = name;
  };
  add('brain', 'Artificial intelligence', 'ai & ml | ai/ml | ai and ml | artificial intelligence and machine learning | brains? | cognitiv* | intelligen*', 'ai | ml | smart');
  add('megaphone', 'Marketing and promotion', 'advertis* | adverts? | ads | promot* | marketing | campaigns? | announc* | brands? | branding | publicity | outreach');
  add('mail', 'E-mail', 'e-?mails? | email campaigns? | e-?mail marketing | newsletters? | inbox | mail*');
  add('briefcase', 'Careers and work', 'careers? | jobs? | job roles? | employ* | employab* | hiring | workplace | professions? | professionals?');
  add('rocket', 'Launch', 'launch* | start-?ups? | side hustles? | hustles? | entrepreneur* | ventures? | kick-?start*');
  add('growth', 'Growth', 'grow* | growth | scal(?:e|ing) | increas* | boost*');
  add('social', 'Social media and audience', 'social media | social | audiences? | audience building | followers? | influenc* | networking | tiktok | linkedin | instagram');
  add('analysis', 'Data analysis', 'data analysis | data analytics | analytics | analy[sz]is | business intelligence');
  add('trophy', 'Achievement', 'achiev* | awards? | success | winning | excellence | certif*');
  add('coin', 'Paid media', 'paid (?:ads?|advertising|media|search|campaigns?) | ad spend | ppc | monetiz* | monetis* | income | earn*');
  add('magnifier', 'Search', 'seo | search engines? optimi[sz]ation | search engines?');
  add('code', 'Code and tools', 'python | javascript | java | chatgpt | jupyter | r programming | sql | programming languages?');
  add('cloud', 'Cloud platforms', 'aws | azure | gcp | google cloud');
  add('server', 'Virtual machines', 'virtual machines? | vms? | containers? | kubernetes | docker');
  add('person', 'Professional role', 'engineers? | developers? | architects? | analysts? | scientists? | designers? | specialists? | consultants? | managers?');

  /* ---------- reading the plan ---------- */
  const objKey = it => it.icon && CMP[it.icon] ? it.icon : 'none';
  // the sections: the plan's named groups (sectioned content), else one unnamed section with every item
  const secsOf = P => { const G = planGroups(P);
    return G.length >= 2 && planAllGrouped(P) ? G.map(x => ({ name: x.g.name, kind: x.g.kind || sectionKind(x.g.name), items: x.items }))
      : [{ name: P.sectionName || '', kind: P.sectionName ? sectionKind(P.sectionName) : '', items: planOrder(P) }]; };
  const named = P => secsOf(P).length >= 2;
  const shortOf = P => planClean(P.short || secShort(planClean(P.title || '')) || '');
  const headOf = P => planClean(P.headline || P.title || '');
  const topicIcon = P => { if (P.hero && CMP[P.hero]) return P.hero; return heroFor(shortOf(P), P.title || '', P.headline || ''); };
  // the object for a section's own name (what the heading says, never a guess about its items)
  const SEC_OBJ = { learn: 'book', fit: 'target', outcome: 'briefcase', tools: 'gear', prereq: 'checklist', format: 'calendar' };
  const secIcon = s => SEC_OBJ[s.kind] || '';
  const tw = (t, s, b) => String(t).length * s * (b ? 0.6 : 0.55);
  // a pill heading centred at (cx, cy): its width from the text
  const pillAt = (cx, cy, text, s, col, g, maxW) => { const h = Math.round(s * 1.8), w = Math.min(maxW || 9999, tw(text, s, true) + h * 0.6 + 30);
    return box('pill', cx - w / 2, cy - h / 2, w, h, { fill: col, text, size: s, bold: true, color: INK, align: 'center', valign: 'middle', grp: g }); };
  const pillFits = (text, s, maxW) => tw(text, s, true) + Math.round(s * 1.8) * 0.6 + 30 <= maxW;
  // an item's object: white disc with the coloured object, or a colour dot when the catalogue has no accurate object
  const bigIcon = (key, x, y, D, col, bg, g) => [box('ellipse', x, y, D, D, { fill: bg || W, grp: g })].concat(comp(key, x + D * 0.13, y + D * 0.13, D * 0.74, col).map(q => Object.assign(q, { grp: g })));
  const objDisc = (it, x, y, D, col, g, bg) => objKey(it) === 'none'
    ? [box('ellipse', x, y, D, D, { fill: bg || W, grp: g }), box('ellipse', x + D * 0.3, y + D * 0.3, D * 0.4, D * 0.4, { fill: col, grp: g })]
    : bigIcon(objKey(it), x, y, D, col, bg, g);
  // the object alone, as large as its square (columns of objects on a panel, as in the reference)
  const objPlain = (it, x, y, D, col, g) => objKey(it) === 'none'
    ? [box('ellipse', x + D * 0.25, y + D * 0.25, D * 0.5, D * 0.5, { fill: col, grp: g })]
    : comp(objKey(it), x, y, D, col).map(q => Object.assign(q, { grp: g }));
  const colH = (L, w, s) => Math.max(...L.map(it => planTextH(it, w, s)));
  const okSecs = (P, lo, hi, kmax) => { const S = secsOf(P); return S.length <= (kmax || 3) && S.every(x => x.items.length >= lo && x.items.length <= hi); };
  const everyFits = (L, w, s) => L.every(it => planFits(it, w, s));

  /* 1. Learning map: a hero panel for the topic, a bracket, the sections as stacked panels with pill headings and their
     items as object-and-label columns divided by fine rules. */
  regPlan('learnmap', { name: 'Learning map', family: 'learnmap', kind: 'hero', groups: true,
    suits: P => P.items.length >= 3 && okSecs(P, 2, 5) && !!shortOf(P),
    needs: P => !shortOf(P) ? 'needs a topic for the hero panel' : !okSecs(P, 2, 5) ? 'works for up to 3 sections of 2 to 5 items' : '',
    opts: [{ s: 24, D: 74, hs: 30, hw: 0.25 }, { s: 22, D: 64, hs: 28, hw: 0.24 }, { s: 22, D: 54, hs: 26, hw: 0.22 }, { s: 22, D: 42, hs: 26, hw: 0.2, tight: true }],
    build: (P, R, o) => {
      const S = secsOf(P), hw = R.w * o.hw, short = shortOf(P), ic = topicIcon(P), bx = R.x + hw + 26, px = bx + 22, pw = R.x + R.w - px, ph = Math.round(o.s * 1.8);
      if (!planWords(short, hw - 40, o.hs) || linesAt(short, hw - 40, o.hs) > 2) return planNo('the topic name does not fit the hero panel');
      const rows = S.map(sec => { const n = sec.items.length, cw = (pw - 24) / n;
        if (!everyFits(sec.items, cw - 14, o.s) || (sec.name && !pillFits(sec.name, o.s - 2 >= 22 ? o.s - 2 : 22, pw - 40))) return null;
        return { sec, n, cw, h: (sec.name ? ph / 2 : 0) + (o.tight ? 10 : 16) + o.D + 8 + colH(sec.items, cw - 14, o.s) + (o.tight ? 8 : 14) }; });
      if (rows.some(r => !r)) return planNo('a section does not fit its panel');
      const top = S[0].name ? ph / 2 : 0, gap0 = S.length > 1 ? (S[1].name ? ph / 2 + (o.tight ? 8 : 14) : 18) : 0, used = rows.reduce((a, r) => a + r.h, 0) + top + gap0 * (S.length - 1);
      if (used > R.h) return planNo('the sections do not fit the area');
      const extra = (R.h - used) / (S.length + 1), out = [], hs = Math.max(22, o.s - 2 >= 22 ? o.s - 2 : 22);
      // the hero: topic object on a white disc, the topic's short name
      const HD = ic ? Math.min(hw - 56, R.h - 150) : 0, nh = planLH(short, hw - 40, o.hs), hy = R.y + (R.h - (HD ? HD + 22 : 0) - nh) / 2;
      out.push(box('roundRect', R.x, R.y, hw, R.h, { fill: accent(0) }));
      if (HD) out.push(...bigIcon(ic, R.x + (hw - HD) / 2, hy, HD, accent(0), W, 'hero'));
      out.push(label(R.x + 20, hy + (HD ? HD + 22 : 0), hw - 40, nh, short, { size: o.hs, bold: true, color: INK, align: 'center', valign: 'top', grp: 'hero' }));
      let y = R.y + top + extra;
      const mids = [];
      rows.forEach((r, i) => {
        const g = 'sec' + i, c = accent(i + 1), py = y;
        out.push(box('roundRect', px, py, pw, r.h, { fill: PANEL, grp: g }));
        if (r.sec.name) out.push(pillAt(px + pw / 2, py, r.sec.name, hs, c, g, pw - 40));
        const iy = py + (r.sec.name ? ph / 2 : 0) + (o.tight ? 10 : 16);
        r.sec.items.forEach((it, j) => {
          const cx = px + 12 + j * r.cw, gi = g + 'i' + j;
          out.push(...planGrp(objPlain(it, cx + (r.cw - o.D) / 2, iy, o.D, accent(i * 2 + j + 1), gi).concat(planText(it, cx + 7, iy + o.D + 8, r.cw - 14, o.s, { align: 'center', grp: gi })), gi, it.label));
          if (j) out.push(rule(cx - 1, iy + 6, 2, r.h - (iy - py) - 20, RULE));
        });
        mids.push(py + r.h / 2);
        y += r.h + gap0 + extra;
      });
      // the bracket: from the hero to every section panel
      const my = R.y + R.h / 2;
      out.push(seg(R.x + hw, my, bx, my, LINE, 2.5));
      if (mids.length > 1) out.push(seg(bx, Math.min(...mids, my), bx, Math.max(...mids, my), LINE, 2.5));
      mids.forEach(m => out.push(seg(bx, m, px, m, LINE, 2.5)));
      return out;
    } });

  /* 2. Topic banner: a hero band across the top (the topic's object, the headline, the takeaway when there is one),
     the sections as cards below it with colour headings, each item a row with its object. */
  regPlan('herobanner', { name: 'Topic banner', family: 'herobanner', kind: 'pictorial', groups: true,
    suits: P => P.items.length >= 3 && P.items.length <= 10 && okSecs(P, 2, 5) && !!headOf(P),
    needs: P => !headOf(P) ? 'needs a topic for the banner' : !okSecs(P, 2, 5) ? 'works for up to 3 sections of 2 to 5 items' : '',
    opts: [{ s: 24, D: 48, bh: 120, hs: 32 }, { s: 22, D: 44, bh: 108, hs: 30 }, { s: 22, D: 40, bh: 96, hs: 28 }],
    build: (P, R, o) => {
      const S = secsOf(P), head = headOf(P), ic = topicIcon(P), BD = ic ? o.bh - 24 : 0, tx = R.x + 24 + (BD ? BD + 22 : 0), tW = R.x + R.w - 24 - tx;
      const ta = P.takeaway && planWords(P.takeaway, tW, PLAN_DS) && linesAt(P.takeaway, tW, PLAN_DS) === 1 ? P.takeaway : '';
      if (!planWords(head, tW * 0.95, o.hs) || planLH(head, tW, o.hs) + (ta ? planTH(ta, tW, PLAN_DS) - 6 : 0) > o.bh - 12) return planNo('the headline does not fit the banner');
      const k = S.length, gap = 22, cw = (R.w - gap * (k - 1)) / k, top = R.y + o.bh + 18, room = R.y + R.h - top, hh = Math.round(o.s * 2);
      // a single unnamed list: two columns of rows in one card
      const cols = S.map(sec => { const split = !sec.name && sec.items.length > 4 ? 2 : 1, colW = (cw - 24) / split, lw = colW - o.D - 26;
        if (!everyFits(sec.items, lw, o.s)) return null;
        const per = Math.ceil(sec.items.length / split), rh = sec.items.map(it => Math.max(o.D, planTextH(it, lw, o.s)) + 12);
        return { sec, split, colW, lw, per, rh, h: (sec.name ? hh : 0) + 12 + Math.max(...Array.from({ length: split }, (_, q) => rh.slice(q * per, q * per + per).reduce((a, b) => a + b, 0))) + 10 }; });
      if (cols.some(c => !c) || cols.some(c => c.h > room)) return planNo('a section does not fit its card');
      const ch = Math.max(...cols.map(c => c.h)), cy = top + (room - ch) / 2, out = [box('roundRect', R.x, R.y, R.w, o.bh, { fill: accent(0) })];
      if (BD) out.push(...bigIcon(ic, R.x + 24, R.y + 12, BD, accent(0), W, 'hero'));
      const hh1 = planLH(head, tW, o.hs), th = hh1 + (ta ? planTH(ta, tW, PLAN_DS) - 6 : 0), ty = R.y + (o.bh - th) / 2;
      out.push(label(tx, ty, tW, hh1, head, { size: o.hs, bold: true, color: INK, align: 'left', valign: 'top', grp: 'hero' }));
      if (ta) out.push(label(tx, ty + hh1 - 6, tW, planTH(ta, tW, PLAN_DS), ta, { size: PLAN_DS, color: INK, align: 'left', valign: 'top', grp: 'hero' }));
      cols.forEach((c, i) => {
        const x = R.x + i * (cw + gap), col = accent(i + 1), g = 'card' + i;
        out.push(box('roundRect', x, cy, cw, ch, { fill: PANEL, grp: g }));
        if (c.sec.name) out.push(box('roundRect', x, cy, cw, hh, { fill: col, text: c.sec.name, size: o.s, bold: true, color: INK, align: 'center', valign: 'middle', grp: g }));
        let y = cy + (c.sec.name ? hh : 0) + 12, q = 0;
        c.sec.items.forEach((it, j) => {
          if (j && j % c.per === 0) { q++; y = cy + (c.sec.name ? hh : 0) + 12; }
          const ix = x + 12 + q * c.colW, gi = g + 'i' + j, h = c.rh[j] - 12;
          out.push(...planGrp(objDisc(it, ix + 6, y + (h - o.D) / 2, o.D, accent(i * 2 + j + 1), gi).concat(planText(it, ix + o.D + 20, y + (h - planTextH(it, c.lw, o.s)) / 2, c.lw, o.s, { grp: gi })), gi, it.label));
          y += c.rh[j];
        });
      });
      return out;
    } });

  /* 3. Skills to outcomes: the first section on the left, the topic as a hub in the middle, the second section on the
     right, every item joined to the hub. Only for two named sections. */
  regPlan('bridge', { name: 'Skills to outcomes', family: 'bridge', kind: 'hub', groups: true,
    suits: P => named(P) && secsOf(P).length === 2 && okSecs(P, 2, 5, 2) && !!shortOf(P),
    needs: P => !named(P) || secsOf(P).length !== 2 ? 'needs two named sections' : !okSecs(P, 2, 5, 2) ? 'works for 2 to 5 items in each section' : '',
    opts: [{ s: 24, D: 46, HD: 170 }, { s: 22, D: 42, HD: 150 }, { s: 22, D: 38, HD: 130 }],
    build: (P, R, o) => {
      const S = secsOf(P), ic = topicIcon(P), short = shortOf(P), ph = Math.round(o.s * 1.8), cw = R.w * 0.34, lw = cw - o.D - 34;
      if (![0, 1].every(i => everyFits(S[i].items, lw, o.s) && pillFits(S[i].name, o.s, cw))) return planNo('a point does not fit its column');
      const top = R.y + ph + 14, room = R.y + R.h - top, hubX = R.x + R.w / 2, HD = Math.min(o.HD, R.w - 2 * cw - 70), out = [], lines = [];
      if (!planWords(short, HD + 40, PLAN_DS + 4) || linesAt(short, HD + 40, PLAN_DS + 4) > 2) return planNo('the topic name does not fit under the hub');
      const sh = planLH(short, HD + 60, PLAN_DS + 4), hubY = top + (room - HD - sh - 10) / 2;
      [0, 1].forEach(i => {
        const sec = S[i], x = i ? R.x + R.w - cw : R.x, c = accent(i + 1), rh = sec.items.map(it => Math.max(o.D, planTextH(it, lw, o.s)) + 20);
        const tot = rh.reduce((a, b) => a + b, 0), gap = (room - tot) / sec.items.length;
        if (gap < 6) return out.push(null);
        out.push(pillAt(x + cw / 2, R.y + ph / 2, sec.name, o.s, c, 'h' + i, cw));
        let y = top + gap / 2;
        sec.items.forEach((it, j) => {
          const g = 'b' + i + j, h = rh[j];
          out.push(...planGrp([box('roundRect', x, y, cw, h, { fill: PANEL })].concat(objDisc(it, x + 12, y + (h - o.D) / 2, o.D, accent(i * 2 + j + 1), g),
            planText(it, x + o.D + 24, y + (h - planTextH(it, lw, o.s)) / 2, lw, o.s, { grp: g })), g, it.label));
          const ex = i ? x : x + cw, ang = Math.atan2(y + h / 2 - (hubY + HD / 2), ex - hubX);
          lines.push(seg(ex, y + h / 2, hubX + Math.cos(ang) * (HD / 2 + 8), hubY + HD / 2 + Math.sin(ang) * (HD / 2 + 8), LINE, 2));
          y += h + gap;
        });
      });
      if (out.includes(null)) return planNo('the items do not fit beside the hub');
      out.push(box('ellipse', hubX - HD / 2, hubY, HD, HD, { fill: accent(0), grp: 'hub' }));
      if (ic) out.push(...bigIcon(ic, hubX - HD * 0.39, hubY + HD * 0.11, HD * 0.78, accent(0), W, 'hub'));
      out.push(label(hubX - HD / 2 - 30, hubY + HD + 10, HD + 60, sh, short, { size: PLAN_DS + 4, bold: true, color: INK, align: 'center', valign: 'top', grp: 'hub' }));
      if (!ic) return planNo('needs an accurate object for the topic');
      return lines.concat(out);
    } });

  /* 4. Icon rows: each section a band - its name on a colour chip at the left, its items as object columns. */
  regPlan('iconrows', { name: 'Icon rows', family: 'iconrows', kind: 'grouped', groups: true,
    suits: P => named(P) && okSecs(P, 2, 6),
    needs: P => !named(P) ? 'needs named sections' : !okSecs(P, 2, 6) ? 'works for up to 3 sections of 2 to 6 items' : '',
    opts: [{ s: 24, D: 64, chip: 0.2 }, { s: 22, D: 56, chip: 0.19 }, { s: 22, D: 48, chip: 0.17 }],
    build: (P, R, o) => {
      const S = secsOf(P), k = S.length, gap = 18, chipW = R.w * o.chip, ix = R.x + chipW + 16, iw = R.x + R.w - ix - 10;
      if (!S.every(sec => planWords(sec.name, chipW - 24, o.s) && linesAt(sec.name, chipW - 24, o.s) <= 3)) return planNo('a section name does not fit its chip');
      const rows = S.map(sec => { const cw = iw / sec.items.length; return everyFits(sec.items, cw - 14, o.s) ? { sec, cw, h: 14 + o.D + 10 + colH(sec.items, cw - 14, o.s) + 12 } : null; });
      if (rows.some(r => !r)) return planNo('a section does not fit its row');
      const used = rows.reduce((a, r) => a + r.h, 0) + gap * (k - 1);
      if (used > R.h) return planNo('the sections do not fit the area');
      const ex = Math.min(40, (R.h - used) / k), out = [];
      let y = R.y + (R.h - used - ex * k) / 2;
      rows.forEach((r, i) => {
        const h = r.h + ex, y0 = y, g = 'row' + i, c = accent(i + 1);
        out.push(box('roundRect', R.x, y0, R.w, h, { fill: PANEL, grp: g }), box('roundRect', R.x, y0, chipW, h, { fill: c, text: r.sec.name, size: o.s, bold: true, color: INK, align: 'center', valign: 'middle', grp: g }));
        const iy = y0 + (h - (o.D + 10 + colH(r.sec.items, r.cw - 14, o.s))) / 2;
        r.sec.items.forEach((it, j) => { const cx = ix + j * r.cw, gi = g + 'i' + j;
          out.push(...planGrp(objPlain(it, cx + (r.cw - o.D) / 2, iy, o.D, accent(i * 2 + j + 1), gi).concat(planText(it, cx + 7, iy + o.D + 10, r.cw - 14, o.s, { align: 'center', grp: gi })), gi, it.label)); });
        y += h + gap;
      });
      return out;
    } });

  /* 5. Badge cards: every item a card with its object on a disc over the card's top edge; the sections side by side
     under their headings (one row of cards for a single list). */
  regPlan('badges', { name: 'Badge cards', family: 'badges', kind: 'list', groups: true,
    suits: P => P.items.length >= 3 && P.items.length <= 8 && okSecs(P, 2, 5, 2),
    needs: P => P.items.length < 3 || P.items.length > 8 ? 'works for 3 to 8 items' : !okSecs(P, 2, 5, 2) ? 'works for up to 2 sections of 2 to 5 items' : '',
    opts: [{ s: 24, D: 76 }, { s: 22, D: 66 }, { s: 22, D: 56 }],
    build: (P, R, o) => {
      const S = secsOf(P), k = S.length, sg = 40, gap = 14, hh = S[0].name ? 46 : 0, out = [];
      const sw = S.map(sec => (R.w - sg * (k - 1)) * sec.items.length / P.items.length);
      const L = S.map((sec, i) => { const cw = (sw[i] - gap * (sec.items.length - 1)) / sec.items.length; return everyFits(sec.items, cw - 20, o.s) ? cw : 0; });
      if (L.some(w => !w)) return planNo('an item does not fit its card');
      const th = Math.max(...S.map((sec, i) => colH(sec.items, L[i] - 20, o.s))), ch = o.D / 2 + 12 + th + 18, tot = hh + o.D / 2 + ch;
      if (tot > R.h) return planNo('the cards do not fit the area');
      const y0 = R.y + (R.h - tot) / 2;
      let x = R.x;
      S.forEach((sec, i) => {
        const c = accent(i + 1);
        if (sec.name) out.push(label(x, y0, sw[i], 36, sec.name, { size: o.s + 2, bold: true, color: INK, align: 'left', valign: 'top', grp: 'h' + i }), rule(x, y0 + 38, Math.min(sw[i], tw(sec.name, o.s + 2, true) + 40), 4, c));
        sec.items.forEach((it, j) => {
          const cx = x + j * (L[i] + gap), cy = y0 + hh + o.D / 2, g = 'bd' + i + j, col = accent(i * 2 + j + 1);
          out.push(...planGrp([box('roundRect', cx, cy, L[i], ch, { fill: PANEL }), box('ellipse', cx + (L[i] - o.D) / 2 - 5, cy - o.D / 2 - 5, o.D + 10, o.D + 10, { fill: col })]
            .concat(objDisc(it, cx + (L[i] - o.D) / 2, cy - o.D / 2, o.D, col, g), planText(it, cx + 10, cy + o.D / 2 + 12, L[i] - 20, o.s, { align: 'center', grp: g })), g, it.label));
        });
        x += sw[i] + sg;
      });
      return out;
    } });

  /* 6. Section panels: tall panels side by side, each led by a large object for the section's name (learning,
     audience, outcomes, tools) and the name, then its items as rows with their objects. */
  regPlan('splitpanels', { name: 'Section panels', family: 'splitpanels', kind: 'grouped', groups: true,
    suits: P => named(P) && okSecs(P, 2, 5) && secsOf(P).some(s => secIcon(s)),
    needs: P => !named(P) ? 'needs named sections' : !okSecs(P, 2, 5) ? 'works for up to 3 sections of 2 to 5 items' : '',
    opts: [{ s: 24, D: 40, BD: 84 }, { s: 22, D: 38, BD: 72 }, { s: 22, D: 34, BD: 60 }],
    build: (P, R, o) => {
      const S = secsOf(P), k = S.length, gap = 24, cw = (R.w - gap * (k - 1)) / k, lw = cw - 28 - o.D - 14, out = [];
      if (!S.every(sec => everyFits(sec.items, lw, o.s) && planWords(sec.name, cw - 28, o.s + 2) && linesAt(sec.name, cw - 28, o.s + 2) <= 2)) return planNo('a section does not fit its panel');
      const heads = S.map(sec => planLH(sec.name, cw - 28, o.s + 2)), headH = 16 + o.BD + 10 + Math.max(...heads) + 14;
      const rows = S.map(sec => sec.items.map(it => Math.max(o.D, planTextH(it, lw, o.s)) + 10)), body = Math.max(...rows.map(r => r.reduce((a, b) => a + b, 0)));
      if (headH + body + 12 > R.h) return planNo('the sections do not fit the area');
      const ph = Math.min(R.h, headH + body + 40), y0 = R.y + (R.h - ph) / 2;
      S.forEach((sec, i) => {
        const x = R.x + i * (cw + gap), c = accent(i + 1), g = 'sp' + i, so = secIcon(sec);
        out.push(box('roundRect', x, y0, cw, ph, { fill: PANEL, grp: g }), box('roundRect', x, y0, cw, headH - 4, { fill: c, grp: g }), box('rect', x, y0 + headH - 24, cw, 20, { fill: c, grp: g }));
        if (so) out.push(...bigIcon(so, x + (cw - o.BD) / 2, y0 + 16, o.BD, c, W, g));
        else out.push(box('ellipse', x + (cw - o.BD) / 2, y0 + 16, o.BD, o.BD, { fill: W, grp: g }));
        out.push(label(x + 14, y0 + 16 + o.BD + 10, cw - 28, heads[i], sec.name, { size: o.s + 2, bold: true, color: INK, align: 'center', valign: 'top', grp: g }));
        let y = y0 + headH + (ph - headH - rows[i].reduce((a, b) => a + b, 0)) / 2 - 4;
        sec.items.forEach((it, j) => { const gi = g + 'i' + j, h = rows[i][j] - 10;
          out.push(...planGrp(objDisc(it, x + 14, y + (h - o.D) / 2, o.D, accent(i * 2 + j + 1), gi, W).concat(planText(it, x + 14 + o.D + 14, y + (h - planTextH(it, lw, o.s)) / 2, lw, o.s, { grp: gi })), gi, it.label));
          y += rows[i][j]; });
      });
      return out;
    } });

  /* 7. Learning poster: the headline large on the left over a colour underline (the takeaway under it), the items as
     object tiles on the right, each tagged with its section's colour; the sections' names as a key under the headline. */
  regPlan('poster', { name: 'Learning poster', family: 'poster', kind: 'hero', groups: true,
    suits: P => P.items.length >= 3 && P.items.length <= 8 && !!headOf(P) && okSecs(P, 1, 6),
    needs: P => !headOf(P) ? 'needs a headline' : P.items.length < 3 || P.items.length > 8 ? 'works for 3 to 8 items' : '',
    opts: [{ s: 24, D: 56, hs: 36, lw: 0.32 }, { s: 22, D: 50, hs: 32, lw: 0.3 }, { s: 22, D: 44, hs: 30, lw: 0.28 }],
    build: (P, R, o) => {
      const S = secsOf(P), head = headOf(P), lw = R.w * o.lw, L = S.flatMap((sec, i) => sec.items.map(it => ({ it, i }))), n = L.length;
      const cols = n <= 4 ? 2 : n <= 6 ? 3 : 4, rowsN = Math.ceil(n / cols), gx = R.x + lw + 30, gw = R.x + R.w - gx, gap = 14, tw2 = (gw - gap * (cols - 1)) / cols;
      if (!planWords(head, lw * 0.95, o.hs) || linesAt(head, lw * 0.95, o.hs) > 4) return planNo('the headline does not fit');
      if (!everyFits(L.map(x => x.it), tw2 - 20, o.s)) return planNo('an item does not fit its tile');
      const th = Math.max(...L.map(x => planTextH(x.it, tw2 - 20, o.s))), tH = 12 + o.D + 8 + th + 12, gh = rowsN * tH + gap * (rowsN - 1);
      if (gh > R.h) return planNo('the tiles do not fit the area');
      const hh = planLH(head, lw, o.hs), keyH = named(P) ? S.length * 40 + 10 : 0, ta = P.takeaway && planWords(P.takeaway, lw, PLAN_DS) ? planTH(P.takeaway, lw, PLAN_DS) : 0;
      if (hh + 18 + (ta ? ta + 6 : 0) + keyH > R.h) return planNo('the headline and key do not fit');
      const out = [], ly = R.y + (R.h - hh - 18 - (ta ? ta + 6 : 0) - keyH) / 2;
      out.push(label(R.x, ly, lw, hh, head, { size: o.hs, bold: true, color: INK, align: 'left', valign: 'top', grp: 'head' }), rule(R.x, ly + hh + 4, Math.min(lw, 160), 6, accent(0)));
      if (ta) out.push(label(R.x, ly + hh + 18, lw, ta, P.takeaway, { size: PLAN_DS, color: INK, align: 'left', valign: 'top', grp: 'head' }));
      if (named(P)) S.forEach((sec, i) => { const ky = ly + hh + 18 + (ta ? ta + 6 : 0) + 10 + i * 40;
        out.push(box('roundRect', R.x, ky + 6, 24, 24, { fill: accent(i + 1), grp: 'key' + i }), label(R.x + 34, ky, lw - 34, 36, sec.name, { size: PLAN_DS, bold: true, color: INK, align: 'left', valign: 'top', grp: 'key' + i })); });
      const gy = R.y + (R.h - gh) / 2;
      L.forEach(({ it, i }, j) => {
        const cx = gx + (j % cols) * (tw2 + gap), cy = gy + Math.floor(j / cols) * (tH + gap), g = 'tile' + j, c = accent(named(P) ? i + 1 : j + 1);
        out.push(...planGrp([box('roundRect', cx, cy, tw2, tH, { fill: PANEL }), box('roundRect', cx + 18, cy + tH - 12, tw2 - 36, 6, { fill: c })].concat(objPlain(it, cx + (tw2 - o.D) / 2, cy + 12, o.D, named(P) ? accent(i * 2 + (j % 3) + 1) : c, g),
          planText(it, cx + 12, cy + 12 + o.D + 8, tw2 - 20, o.s, { align: 'center', grp: g })), g, it.label));
      });
      return out;
    } });
  /* 8. Topic ribbon: the topic on a band across the middle (its object and short name); the first section's items
     above it and the second section's below, each joined to the band, the section names on pills at the band's ends. */
  regPlan('ribbon', { name: 'Topic ribbon', family: 'ribbon', kind: 'pictorial', groups: true,
    suits: P => named(P) && secsOf(P).length === 2 && okSecs(P, 2, 5, 2) && !!shortOf(P),
    needs: P => !named(P) || secsOf(P).length !== 2 ? 'needs two named sections' : !okSecs(P, 2, 5, 2) ? 'works for 2 to 5 items in each section' : '',
    opts: [{ s: 24, D: 58, bh: 70 }, { s: 22, D: 50, bh: 64 }, { s: 22, D: 40, bh: 58 }, { s: 22, D: 34, bh: 52 }],
    build: (P, R, o) => {
      const S = secsOf(P), short = shortOf(P), ic = topicIcon(P), by = R.y + R.h / 2 - o.bh / 2, room = (R.h - o.bh) / 2 - 14, ps = 22;
      // the left zone: the topic on the band, the section names on pills above and below it; the items to the right
      const pw = Math.max(...S.map(s => tw(s.name, ps, true))) + 60, nameW0 = tw(short, 26, true) + 30 + (ic ? o.bh + 6 : 0) + 30, zw = Math.max(pw, nameW0) + 16;
      const ix = R.x + zw, iw = R.w - zw - 40;
      const cols = S.map(sec => { const cw = iw / sec.items.length; return everyFits(sec.items, cw - 16, o.s) && o.D + 8 + colH(sec.items, cw - 16, o.s) + 14 <= room ? cw : 0; });
      if (cols.some(c => !c)) return planNo('the items do not fit above and below the band');
      const nameW = tw(short, 26, true) + 30, bandTextX = R.x + 30 + (ic ? o.bh + 6 : 0);
      if (zw > R.w * 0.36) return planNo('the topic name does not fit the band');
      const out = [box('homePlate', R.x, by, R.w, o.bh, { fill: accent(0), grp: 'band' })];
      if (ic) out.push(...bigIcon(ic, R.x + 18, by + 6, o.bh - 12, accent(0), W, 'band'));
      out.push(label(bandTextX, by, nameW, o.bh, short, { size: 26, bold: true, color: INK, align: 'left', valign: 'middle', grp: 'band' }));
      S.forEach((sec, i) => {
        const top = i === 0, c = accent(i + 1), cw = cols[i], th = colH(sec.items, cw - 16, o.s);
        // the section's name on a pill sitting on the band's edge, at the band's right end
        const ph = Math.round(ps * 1.8), pl = pillAt(R.x + pw / 2, top ? by - 10 - ph / 2 : by + o.bh + 10 + ph / 2, sec.name, ps, c, 'pill' + i);
        out.push(pl);
        sec.items.forEach((it, j) => {
          const x = ix + j * cw, g = 'rb' + i + j, oy = top ? by - 14 - th - 8 - o.D : by + o.bh + 14, ty = top ? oy + o.D + 8 : oy + o.D + 8;
          // the item joined to the band, except where the section's pill sits
          if (!(x + cw / 2 > pl.x - 6 && x + cw / 2 < pl.x + pl.w + 6)) out.push(seg(x + cw / 2, top ? oy + o.D + 8 + th + 2 : by + o.bh, x + cw / 2, top ? by : oy - 2, RULE, 2));
          out.push(...planGrp(objPlain(it, x + (cw - o.D) / 2, oy, o.D, accent(i * 2 + j + 1), g).concat(planText(it, x + 8, ty, cw - 16, o.s, { align: 'center', grp: g })), g, it.label));
        });
      });
      return out;
    } });

  /* 9. Colour tiles: every item a colour tile (its object on a white disc, its label), the tiles of each section in a
     row under the section's name. */
  regPlan('colortiles', { name: 'Colour tiles', family: 'colortiles', kind: 'list', groups: true,
    suits: P => P.items.length >= 3 && P.items.length <= 10 && okSecs(P, 2, 5),
    needs: P => P.items.length < 3 || P.items.length > 10 ? 'works for 3 to 10 items' : !okSecs(P, 2, 5) ? 'works for up to 3 sections of 2 to 5 items' : '',
    opts: [{ s: 24, D: 52 }, { s: 22, D: 46 }, { s: 22, D: 40 }],
    build: (P, R, o) => {
      const S = secsOf(P), k = S.length, gap = 12, hh = S[0].name ? 40 : 0, sg = 16, n = Math.max(...S.map(s => s.items.length)), cw = (R.w - gap * (n - 1)) / n;
      if (!S.every(sec => everyFits(sec.items, cw - 28, o.s))) return planNo('an item does not fit its tile');
      const rows = S.map(sec => 14 + o.D + 10 + colH(sec.items, cw - 28, o.s) + 14), used = rows.reduce((a, b) => a + b, 0) + k * hh + sg * (k - 1);
      if (used > R.h) return planNo('the tiles do not fit the area');
      const out = [];
      let y = R.y + (R.h - used) / 2;
      S.forEach((sec, i) => {
        if (sec.name) { out.push(label(R.x, y, R.w, hh - 4, sec.name, { size: o.s, bold: true, color: INK, align: 'left', valign: 'top', grp: 'h' + i }), rule(R.x, y + hh - 8, tw(sec.name, o.s, true) + 30, 4, accent(i + 1))); y += hh; }
        const x0 = R.x + (R.w - (sec.items.length * cw + gap * (sec.items.length - 1))) / 2 * (sec.name ? 0 : 1);
        sec.items.forEach((it, j) => {
          const x = x0 + j * (cw + gap), g = 'ct' + i + j, c = accent(i * 3 + j + 1);
          out.push(...planGrp([box('roundRect', x, y, cw, rows[i], { fill: c })].concat(objDisc(it, x + 14, y + 14, o.D, c, g), planText(it, x + 14, y + 14 + o.D + 10, cw - 28, o.s, { grp: g })), g, it.label));
        });
        y += rows[i] + sg;
      });
      return out;
    } });
});
