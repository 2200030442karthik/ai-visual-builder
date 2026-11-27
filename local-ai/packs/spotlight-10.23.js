/* AI Visual Builder design pack "spotlight" 10.23.0 - the topic spotlight of the reference course slides
   ("Stakeholder analysis / Key activities / Outcome", "Elicitation techniques / Common techniques / Outcome"):
     a frame holding
       - the topic and its one-line description, when the text gives both (a heading line, then the description line);
       - each named section ("Key activities", "Common techniques") as its heading over a row of icon cards: a white card
         with a coloured border, a coloured round badge with the point's object in white, the point's words centred;
       - the outcome ("Outcome: ...", one statement) as a bar along the bottom with a target badge.
     topicspot       the topic in bold on the left, sections left-aligned (reference slide 1)
     topicband       the topic in a coloured band across the frame, everything centred (reference slide 2)
   The same rules as every family (packs/README.txt): every label and description at 22 pt and up, approved colours,
   Open Sans, native shapes only (each badge is its object's own shapes, recoloured white on the badge colour), and
   only relationships the content states (the cards are equals: no numbers, no arrows). Loaded after plan.js. */
registerPack('spotlight', '10.23.0', () => {
  const W = '#FFFFFF', GREY = '#7F7F7F';
  const OUT_RE = /^(?:outcomes?|results?|benefits?|goals?|impact|takeaways?|key takeaways?|why it matters)$/i;

  /* Objects the reference slides use that the catalogue did not have (flat, filled; readable in their accent colour on
     white and as white pictograms on a badge). */
  if (!CMP.eye) Object.assign(CMP, {
    eye: (x, y, s, c) => [box('ellipse', x + s * 0.04, y + s * 0.24, s * 0.92, s * 0.52, { fill: c }),
      box('ellipse', x + s * 0.31, y + s * 0.27, s * 0.38, s * 0.46, { fill: W }), box('ellipse', x + s * 0.41, y + s * 0.39, s * 0.18, s * 0.22, { fill: c })],
    interview: (x, y, s, c) => [box('ellipse', x + s * 0.08, y + s * 0.42, s * 0.2, s * 0.2, { fill: c }), box('tab', x + s * 0.02, y + s * 0.64, s * 0.32, s * 0.28, { fill: c }),
      box('ellipse', x + s * 0.72, y + s * 0.42, s * 0.2, s * 0.2, { fill: c }), box('tab', x + s * 0.66, y + s * 0.64, s * 0.32, s * 0.28, { fill: c }),
      box('callout', x + s * 0.3, y + s * 0.04, s * 0.42, s * 0.3, { fill: c })].concat([0, 1, 2].map(i => box('ellipse', x + s * (0.39 + i * 0.09), y + s * 0.15, s * 0.06, s * 0.06, { fill: W }))),
    workshop: (x, y, s, c) => [box('rect', x + s * 0.2, y + s * 0.04, s * 0.7, s * 0.44, { fill: c }),
      box('rect', x + s * 0.3, y + s * 0.12, s * 0.14, s * 0.12, { fill: W }), box('rect', x + s * 0.52, y + s * 0.12, s * 0.14, s * 0.12, { fill: W }), box('rect', x + s * 0.52, y + s * 0.3, s * 0.14, s * 0.1, { fill: W }),
      box('ellipse', x + s * 0.06, y + s * 0.5, s * 0.16, s * 0.16, { fill: c }), box('tab', x + s * 0.02, y + s * 0.68, s * 0.24, s * 0.24, { fill: c }),
      box('ellipse', x + s * 0.42, y + s * 0.56, s * 0.16, s * 0.16, { fill: c }), box('tab', x + s * 0.38, y + s * 0.74, s * 0.24, s * 0.2, { fill: c }),
      box('ellipse', x + s * 0.74, y + s * 0.56, s * 0.16, s * 0.16, { fill: c }), box('tab', x + s * 0.7, y + s * 0.74, s * 0.24, s * 0.2, { fill: c })],
  });
  // what they depict (and terms the reference slides use for existing objects), matched like the rest of the catalogue
  const add = (key, name, strong, weak) => {
    const terms = (list, w) => (list || '').split(' | ').map(t => t.trim()).filter(Boolean).map(t => ({
      re: new RegExp('(?:^|[^\\w-])' + t.replace(/\*/g, '\\w*') + '(?![\\w])', 'i'), w: w * (/\s/.test(t) ? 1.5 : 1), t }));
    CATALOG.push({ key, name, terms: terms(strong, 2).concat(terms(weak, 1)) });
    if (!CMP_NAMES[key]) CMP_NAMES[key] = name;
  };
  add('eye', 'Observation', 'observ* | watching | visibility | shadowing');
  add('interview', 'Interview', 'interviews? | interviewing | one-on-ones? | 1:1s? | conversations? | dialogues?');
  add('workshop', 'Workshop', 'workshops? | brainstorm* | collaborat* sessions? | whiteboard*');
  add('checklist', 'Survey', 'surveys? | questionnaires? | polls?');
  add('team', 'Group', 'focus groups? | user groups?', 'groups?');
  add('bulb', 'Understanding', 'understand*', 'insights? | needs | ideas?');
  add('chartUp', 'Kano analysis', 'kano | prioriti[sz]* | influence | interest levels?');

  /* The point's object as a white pictogram on a coloured disc: every part of the object that is not white becomes
     white, its white details take the disc's colour (the flat badge icons of the reference slides). */
  function badge(key, x, y, D, c, grp) {
    const inv = v => (v && String(v).toUpperCase() === W ? c : v ? W : v);
    const parts = comp(key || 'none', x + D * 0.15, y + D * 0.15, D * 0.7, c).map(p => {
      const q = Object.assign({}, p, { grp });
      if (q.fill) q.fill = inv(q.fill);
      if (q.line) q.line = inv(q.line);
      if (q.t === 'line' && q.color) q.color = inv(q.color);
      return q;
    });
    return [box('ellipse', x, y, D, D, { fill: c, grp })].concat(parts);
  }
  const cardFill = c => (typeof softTints === 'function' && softTints() ? tint(c, SOFT_T) : W);
  /* A card with a coloured border: the brand standard draws no outlines around filled shapes, so the border is the card
     itself in its colour with the light card 2 pt inside it (two editable shapes of the card's group). */
  const bordered = (x, y, w, h, c, fill) => [box('roundRect', x, y, w, h, { fill: c }), box('roundRect', x + 2, y + 2, w - 4, h - 4, { fill })];

  /* What the content gives: { head: {title, intro} | null, rows: [{ name, items }], outs: [{ head, text, it }] } or null. */
  function parts(P) {
    const G = planGroups(P);
    let rows, outs = [];
    if (G.length >= 2) {
      if (!planAllGrouped(P)) return null;
      const isOut = x => (x.g.kind === 'outcome' || OUT_RE.test(x.g.name)) && x.items.length === 1;
      rows = G.filter(x => !isOut(x)).map(x => ({ name: x.g.name, items: x.items }));
      outs = G.filter(isOut).map(x => ({ head: x.g.name, text: x.items[0].label, detail: x.items[0].detail, it: x.items[0] }));
    } else rows = [{ name: P.sectionName || '', items: P.items }];
    if (!outs.length && P.takeaway) outs = [{ head: 'Outcome', text: P.takeaway, detail: '' }];
    const title = String(P.title || '').trim(), intro = String(P.intro || '').trim();
    return { head: title && intro ? { title, intro } : null, rows, outs };
  }
  function why(P) {
    const S = parts(P);
    if (!S) return 'not for partly grouped content';
    if (!S.rows.length || S.rows.length > 2) return 'works for one or two sections of points';
    if (S.rows.some(r => r.items.length < 2 || r.items.length > 6)) return 'each section needs 2 to 6 points';
    if (S.outs.length > 2) return 'at most two outcome statements';
    return '';
  }

  function build(P, R, o, band) {
    const S = parts(P), m = 0, X = R.x + m, IW = R.w - 2 * m, out = [], al = band ? 'center' : 'left';
    let y = R.y + m, k = 0;
    // 1. the topic and its description
    if (S.head) {
      if (band) {
        const th = planLH(S.head.title, IW - 40, 24), bh = Math.max(48, th + 8);
        if (!planWords(S.head.title, IW - 40, 24) || linesAt(S.head.title, IW * 0.95 - 40, 24) > 2) return planNo('the topic does not fit its band');
        out.push(box('roundRect', X, y, IW, bh, { fill: accent(0), text: S.head.title, size: 24, bold: true, color: textOn(accent(0)), align: 'center', valign: 'middle' }));
        y += bh + 10;
      } else {
        const th = planLH(S.head.title, IW, 24);
        if (!planWords(S.head.title, IW, 24)) return planNo('the topic does not fit');
        out.push(label(X, y, IW, th, S.head.title, { size: 24, bold: true, color: INK, align: 'left', valign: 'top' }));
        y += th - 8;
      }
      if (!planWords(S.head.intro, IW, PLAN_DS)) return planNo('the description does not fit');
      const ih = planTH(S.head.intro, IW, PLAN_DS);
      out.push(label(X, y, IW, ih, S.head.intro, { size: PLAN_DS, color: INK, align: al, valign: 'top' }));
      y += ih + 6;
    }
    // 2. each section: its heading over a row of badge cards
    for (const row of S.rows) {
      if (row.name) {
        if (!planWords(row.name, IW, 24)) return planNo('a section name does not fit');
        const hh = planLH(row.name, IW, 24);
        out.push(label(X, y, IW, hh, row.name, { size: 24, bold: true, color: INK, align: al, valign: 'top' }));
        y += hh;
      }
      // the point's words in regular weight (as in the reference), measured as such; descriptions under them.
      // All points side by side; in a narrow area (beside the SME video) two rows of cards when one row does not fit.
      const n = row.items.length, gap = n >= 5 ? 10 : 14;
      let cols = 0, cw = 0, tw = 0;
      for (const c of [...new Set([n, Math.ceil(n / 2)])]) {
        cw = (IW - gap * (c - 1)) / c; tw = cw - 2 * o.pad;
        const ok = it => tw > 100 && planWords(it.label, tw, o.s) && linesAt(it.label, tw, o.s) <= (c >= 4 ? 4 : 3) && (!it.detail || planWords(it.detail, tw, PLAN_DS));
        if (row.items.every(ok)) { cols = c; break; }
      }
      if (!cols) return planNo('a point does not fit its card');
      const textH = it => planTH(it.label, tw, o.s) + (it.detail ? planTH(it.detail, tw, PLAN_DS) - 6 : 0);
      const th = Math.max(...row.items.map(textH)), ch = o.pad + o.D + 8 + th + o.pad, nr = Math.ceil(n / cols);
      row.items.forEach((it, i) => {
        // a shorter last row is centred under the first
        const r = Math.floor(i / cols), inRow = r < nr - 1 ? cols : n - cols * (nr - 1), x0 = X + (IW - (inRow * cw + (inRow - 1) * gap)) / 2;
        const x = x0 + (i % cols) * (cw + gap), yy = y + r * (ch + 10), c = accent(k + i), g = 'sp' + (k + i), lh = planTH(it.label, tw, o.s);
        const ty = yy + o.pad + o.D + 8;
        const items = [...bordered(x, yy, cw, ch, c, cardFill(c)),
          ...badge(it.icon, x + (cw - o.D) / 2, yy + o.pad, o.D, c, g),
          label(x + o.pad, ty, tw, lh, it.label, { size: o.s, color: INK, align: 'center', valign: 'top' })];
        if (it.detail) items.push(label(x + o.pad, ty + lh - 6, tw, planTH(it.detail, tw, PLAN_DS), it.detail, { size: PLAN_DS, color: INK, align: 'center', valign: 'top' }));
        out.push(...planGrp(items, g, it.label));
      });
      k += n;
      y += nr * (ch + 10);
    }
    // 3. the outcome: a bar with a target badge, the section's name in bold and its statement
    for (const u of S.outs) {
      const D = 44, pad = 12, tx = X + pad + D + 14, tw = IW - (tx - X) - pad;
      const head = u.head.replace(/:$/, '') + ':';
      if (!planWords(u.text, tw, PLAN_DS) || (u.detail && !planWords(u.detail, tw, PLAN_DS))) return planNo('the outcome does not fit');
      const hh = planLH(head, tw, PLAN_DS), bh = planTH(u.text, tw, PLAN_DS), dh = u.detail ? planTH(u.detail, tw, PLAN_DS) - 6 : 0;
      const h = pad + Math.max(D, hh - 6 + bh + dh) + pad, g = 'spo' + k++, c = accent(0);
      const ty = y + (h - (hh - 6 + bh + dh)) / 2;
      const items = [...bordered(X, y, IW, h, c, typeof softTints === 'function' && softTints() ? tint(c, SOFT_T) : '#F2F2F2'),
        ...badge('target', X + pad, y + (h - D) / 2, D, GREY, g),
        label(tx, ty, tw, hh, head, { size: PLAN_DS, bold: true, color: INK, align: 'left', valign: 'top' }),
        label(tx, ty + hh - 6, tw, bh, u.text, { size: PLAN_DS, color: INK, align: 'left', valign: 'top' })];
      if (u.detail) items.push(label(tx, ty + hh - 6 + bh - 6, tw, dh + 6, u.detail, { size: PLAN_DS, color: INK, align: 'left', valign: 'top' }));
      out.push(...planGrp(items, g, u.text));
      y += h + 12;
    }
    const total = y - 12 + m - R.y;
    if (total > R.h) return planNo('does not fit the height');
    return out;
  }

  const OPTS = [{ s: 24, D: 60, pad: 12 }, { s: 22, D: 56, pad: 10 }, { s: 22, D: 48, pad: 8 }];
  // offered for what it was made for: a topic written as named sections ("Key activities: ...", "Outcome: ...") or a
  // list with its outcome statement - not for every list (the other packs cover those)
  const suits = P => !why(P) && (!!P.sections || !!P.takeaway);
  regPlan('topicspot', { name: 'Topic spotlight (icon cards and outcome)', family: 'topicspot', kind: 'grouped', groups: true, appeal: 3,
    suits, needs: why, opts: OPTS, build: (P, R, o) => build(P, R, o, false) });
  regPlan('topicband', { name: 'Topic spotlight, centred', family: 'topicband', kind: 'list', groups: true, appeal: 3,
    suits, needs: why, opts: OPTS, build: (P, R, o) => build(P, R, o, true) });
});
