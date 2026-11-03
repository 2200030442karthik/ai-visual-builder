/* AI Visual Builder design pack "pro" 10.11.0 - professional compositions for technical and educational content.
   Every family reads the plan's semantics (plan.js planSemantics: stages, output, functions across the flow, data
   sources), measures its text at 22 pt and up before drawing, and is checked like every other layout. Only
   relationships the content states are drawn: a flow where the plan has one, functions that apply across the flow as
   bands spanning it (never as steps), sources only when the text names them. Approved colours, Open Sans, native
   shapes only (editable). See packs/README.txt to add a pack. Loaded after plan.js. */
registerPack('pro', '10.11.0', () => {
  const W = '#FFFFFF', SOFT = '#D9D9D9', EDGE = '#7F7F7F';
  const r = planRoles, flowOf = P => { const R0 = r(P); return R0.stages.concat(R0.outputs.filter(o => (P.flow || []).includes(o.id))); };
  const objKey = it => it.icon || 'none';
  /* The sources the text names, as small objects (database, API, logs, files) - no text: the stage's description says them. */
  const srcKey = t => /databas|warehouse|sql/i.test(t) ? 'database' : /\bapi/i.test(t) ? 'gateway' : /log/i.test(t) ? 'document' : /file|csv|excel|sheet/i.test(t) ? 'folder' : /stream|event|kafka/i.test(t) ? 'chat' : /cloud/i.test(t) ? 'cloud' : 'dataset';
  /* A band across the flow: coloured block with the object, label and description beside it. */
  const band = (it, x, y, w, h, col, s, D, g) => planGrp([box('roundRect', x, y, w, h, { fill: W }), box('roundRect', x, y, D + 16, h, { fill: col }),
    ...planIcon(objKey(it), x + 8, y + (h - D) / 2, D, col, W, g)].concat(bandText(it, x + D + 26, y, w - D - 34, h, s)), g, it.label);
  const bandH = (it, w, s, D) => { const lw = w - D - 34, one = bandOne(it, lw, s); return one ? Math.max(D + 10, 42) : Math.max(D + 10, planLH(it.label, lw, s) + (it.detail ? planTH(it.detail, lw, PLAN_DS) - 6 : 0) + 8); };
  // label and description on one line when they fit side by side, else the description under the label
  const bandOne = (it, lw, s) => { const L = it.label.length * s * 0.6 + 24; return !it.detail ? true : linesAt(it.detail, lw - L, PLAN_DS) === 1 && lw - L > 120; };
  const bandText = (it, x, y, w, h, s) => {
    if (bandOne(it, w, s)) { const L = Math.min(w, it.label.length * s * 0.6 + 24); return [label(x, y, L, h, it.label, { size: s, bold: true, color: INK, align: 'left', valign: 'middle' })].concat(it.detail ? [label(x + L, y, w - L, h, it.detail, { size: PLAN_DS, color: INK, align: 'left', valign: 'middle' })] : []); }
    const lh = planLH(it.label, w, s), dh = it.detail ? planTH(it.detail, w, PLAN_DS) - 6 : 0, y0 = y + (h - lh - dh) / 2;
    return [label(x, y0, w, lh, it.label, { size: s, bold: true, color: INK, align: 'left', valign: 'top' })].concat(it.detail ? [label(x, y0 + lh - 6, w, dh + 6, it.detail, { size: PLAN_DS, color: INK, align: 'left', valign: 'top' })] : []);
  };
  const bandFits = (it, w, s, D) => { const lw = w - D - 34; return planWords(it.label, lw * 0.95, s) && linesAt(it.label, lw * 0.95, s) <= 2 && (!it.detail || planWords(it.detail, lw, PLAN_DS)); };
  /* Bands side by side in one row (supporting functions): widths by need. */
  const bandRow = (items, x, y, w, s, D) => {
    if (!items.length) return { h: 0, out: [] };
    const ws = planWidths(items, w, 10, s, D + 34);
    if (!ws || !items.every((it, i) => bandFits(it, ws[i], s, D))) return null;
    return { ws, h: Math.max(...items.map((it, i) => bandH(it, ws[i], s, D))) };
  };
  const drawBandRow = (items, row, x, y, s, D, P, tag) => { let cx = x; const out = []; items.forEach((it, i) => { out.push(...band(it, cx, y, row.ws[i], row.h, accent(P.items.indexOf(it)), s, D, tag + i)); cx += row.ws[i] + 10; }); return out; };
  /* A module of the flow: coloured header (object and label), description in the white body. */
  // side: the object beside the label in the header (one row less than above it)
  const modH = (it, w, s, D, pad, side) => { const lw = w - 2 * pad - (side ? D + 6 : 0); return { hh: side ? pad + Math.max(D, planLH(it.label, lw, s)) + pad : pad + D + 4 + planLH(it.label, lw, s) + 4, dh: it.detail ? planTH(it.detail, w - 2 * pad, PLAN_DS) + 8 : 0 }; };
  const module = (it, x, y, w, hh, h, s, D, pad, col, g, side) => planGrp([box('roundRect', x, y, w, h, { fill: W }), box('roundRect', x, y, w, hh, { fill: col }),
    ...(side ? planIcon(objKey(it), x + pad, y + (hh - D) / 2, D, col, W, g) : planIcon(objKey(it), x + (w - D) / 2, y + pad, D, col, W, g)),
    side ? label(x + pad + D + 6, y, w - 2 * pad - D - 6, hh, it.label, { size: s, bold: true, color: INK, align: 'left', valign: 'middle' })
      : label(x + pad, y + pad + D + 2, w - 2 * pad, hh - pad - D - 2, it.label, { size: s, bold: true, color: INK, align: 'center', valign: 'middle' })]
    .concat(it.detail ? [label(x + pad, y + hh + 2, w - 2 * pad, h - hh - 4, it.detail, { size: PLAN_DS, color: INK, align: 'center', valign: 'middle' })] : []), g, it.label);
  const supportNeeds = P => { const R0 = r(P), f = flowOf(P); return R0.stages.length < 2 ? 'needs a main flow of 2 or more stages' : f.length > 6 ? 'more than 6 stages in the flow' : !R0.supports.length ? 'needs functions that apply across the flow' : R0.supports.length > 4 ? 'more than 4 functions across the flow' : P.items.some(i => i.added) ? 'a point added to the plan has no place in its structure' : ''; };

  /* 1. Platform architecture: the platform as a frame; the functions that coordinate the flow above it, the modules of
     the flow (with the sources the text names feeding the first) and what they serve, the functions that watch and
     protect it underneath, spanning it. */
  regPlan('platform', { name: 'Platform architecture', family: 'platform', kind: 'architecture', needs: supportNeeds,
    // v: 0 everything, 1 without the frame's title (the slide heading has it), 2 also without the source objects
    opts: [{ s: 24, D: 36, pad: 8, v: 0 }, { s: 22, D: 32, pad: 7, v: 0 }, { s: 22, D: 28, pad: 6, v: 1 }, { s: 22, D: 28, pad: 6, v: 1, side: true }, { s: 22, D: 26, pad: 6, v: 2, side: true }],
    build: (P, R, o) => {
      const R0 = r(P), f = flowOf(P), top = R0.control, bottom = R0.quality.concat(R0.foundation), fp = 12, D2 = Math.min(o.D, 30);
      const titled = !o.v && !!P.title && planWords(P.title, R.w * 0.6, o.s), th = titled ? 34 : 0;
      const srcs = o.v === 2 ? [] : (P.sources || []).slice(0, 4), sw = srcs.length ? 52 : 0, inner = R.w - 2 * fp - sw - (sw ? 26 : 0), gap = 26;
      const ws = planWidths(f, inner, gap, o.s, 2 * o.pad + (o.side ? o.D + 6 : 0));
      if (!ws) return planNo('the flow is too wide');
      const ms = f.map((it, i) => modH(it, ws[i], o.s, o.D, o.pad, o.side)), hh = Math.max(...ms.map(m => m.hh)), dh = Math.max(...ms.map(m => m.dh));
      const tr = bandRow(top, 0, 0, R.w - 2 * fp, o.s, D2), br = bandRow(bottom, 0, 0, R.w - 2 * fp, o.s, D2);
      if (!tr || !br) return planNo('a function across the flow does not fit its band');
      if (!f.every((it, i) => planWords(it.label, (ws[i] - 2 * o.pad - (o.side ? o.D + 6 : 0)) * 0.95, o.s) && (!it.detail || planWords(it.detail, ws[i] - 2 * o.pad, PLAN_DS)))) return planNo('a word does not fit its module');
      let mh = hh + dh;
      const need = fp + th + (tr.h ? tr.h + 12 : 0) + mh + (br.h ? br.h + 12 : 0) + fp;
      if (need > R.h) return planNo(`needs ${Math.round(need)} of ${Math.round(R.h)} pt of height`);
      mh += planSlack(need, R, 50);
      const H = need - hh - dh + mh, y0 = R.y + (R.h - H) / 2, out = [box('roundRect', R.x, y0, R.w, H, { fill: PANEL, grp: 'frame', grpName: P.title || 'Platform' })];
      let y = y0 + fp;
      if (titled) { out.push(label(R.x + fp, y - 4, R.w - 2 * fp, th, P.title, { size: o.s, bold: true, color: INK, align: 'left', valign: 'middle', grp: 'frame' })); y += th; }
      if (tr.h) { out.push(...drawBandRow(top, tr, R.x + fp, y, o.s, D2, P, 'ctl')); y += tr.h + 12; }
      let x = R.x + fp;
      if (srcs.length) {   // the named sources, stacked, each joined to the first module
        const S = Math.min(40, (mh - 8 * (srcs.length - 1)) / srcs.length), sy = y + (mh - srcs.length * S - 8 * (srcs.length - 1)) / 2;
        srcs.forEach((t, i) => { const yy = sy + i * (S + 8); out.push(...planIcon(srcKey(t), x + (sw - S) / 2, yy, S, EDGE, W, 'src' + i), seg(x + (sw + S) / 2 + 2, yy + S / 2, x + sw + 14, y + mh / 2, SOFT, 2, { grp: 'srclinks' })); });
        out.push(...arrowSeg(x + sw + 12, y + mh / 2, x + sw + 24, y + mh / 2, EDGE, 2.5, 12));
        x += sw + 26;
      }
      f.forEach((it, i) => {
        out.push(...module(it, x, y, ws[i], hh, mh, o.s, o.D, o.pad, accent(P.items.indexOf(it)), 'mod' + i, o.side));
        if (i < f.length - 1) out.push(...arrowSeg(x + ws[i] + 4, y + hh / 2, x + ws[i] + gap - 4, y + hh / 2, EDGE, 2.5, 13));
        x += ws[i] + gap;
      });
      y += mh + 12;
      if (br.h) out.push(...drawBandRow(bottom, br, R.x + fp, y, o.s, D2, P, 'base'));
      return out;
    } });

  /* 2. Layered system: the platform as stacked slabs, bottom to top - what applies to everything (foundation and
     functions across the flow), the flow itself, what it serves. Each slab has its name tab and its items as tiles. */
  regPlan('stack3d', { name: 'Layered system', family: 'stack3d', kind: 'layered',
    needs: P => planDomains(P).length < 2 ? 'needs 2 or more layers (groups, or a flow with functions across it)' : planDomains(P).length > 4 ? 'more than 4 layers' : planDomains(P).some(d => d.items.length > 5) ? 'a layer has more than 5 items' : '',
    opts: [{ s: 24, D: 32, pad: 8 }, { s: 22, D: 28, pad: 7 }, { s: 22, D: 24, pad: 5 }, { s: 22, D: 0, pad: 5 }],
    build: (P, R, o) => {
      const order = { support: 0, layer: 1, category: 1, flow: 2, output: 3 };
      const L = planDomains(P).slice().sort((a, b) => (order[a.role] ?? 1) - (order[b.role] ?? 1));   // bottom first
      const n = L.length, inset = 22, lip = 8, gap = 4, T = { s: o.s, D: o.D, pad: o.pad };
      const rows = L.map((d, li) => {
        const k = li, w = R.w - 2 * inset * k - (lip + 4), tw = Math.max(130, Math.min(240, Math.max(...d.name.split(/\s+/).map(x => (x.length * o.s * 0.55 + 14.4) / 0.95)) + 18));
        if (!planWords(d.name, (tw - 14) * 0.95, o.s)) return planNo(`the layer name "${d.name}" does not fit`);
        // a layer of one item named like the item ("Analytics and reporting"): the item alone, on one line, no tab
        const same = d.items.length === 1 && d.name.toLowerCase() === d.items[0].label.toLowerCase(), iw = same ? w - 12 : w - tw - 16;
        if (d.items.length === 1 && bandFits(d.items[0], iw, o.s, o.D || 28)) return { d, w, tw: same ? -8 : tw, same, one: true, ws: [iw], h: Math.max(same ? 0 : planLH(d.name, tw - 14, o.s) + 10, bandH(d.items[0], iw, o.s, o.D || 28)) + 12 };
        const ws = planWidths(d.items, iw, 8, o.s, o.D ? o.D + 8 + 2 * o.pad : 2 * o.pad);
        if (!ws || !d.items.every((it, i) => planTileFits(it, ws[i], T))) return planNo(`the items of "${d.name}" do not fit side by side`);
        return { d, w, tw, ws, h: Math.max(planLH(d.name, tw - 14, o.s) + 10, ...d.items.map((it, i) => planTileH(it, ws[i], T))) + 12 };
      });
      if (rows.some(x => !x)) return null;
      const need = rows.reduce((a, x) => a + x.h + lip, 0) + gap * (n - 1);
      if (need > R.h) return planNo(`needs ${Math.round(need)} of ${Math.round(R.h)} pt of height (layers ${rows.map(x => Math.round(x.h)).join(' + ')})`);
      const more = planSlack(need, R, 16 * n) / n;
      rows.forEach(x => { x.h += more; });
      let y = R.y + (R.h + need + more * n) / 2;   // bottom of the stack
      const out = [];
      rows.forEach((x, li) => {
        const k = li, col = accent(li), x0 = R.x + inset * k, g = 'layer' + li;
        y -= x.h;
        // the slab: its top surface (a parallelogram lip) and its face
        out.push(...planGrp([box('parallelogram', x0, y - lip, x.w + lip + 4, lip, { fill: col }), box('rect', x0, y, x.w, x.h, { fill: PANEL }), box('rect', x0 + x.w, y - lip / 2, 4, x.h + lip / 2, { fill: SOFT }),
          ...(x.same ? [] : [box('roundRect', x0 + 6, y + 6, x.tw, x.h - 12, { fill: col, text: x.d.name, size: o.s, bold: true, color: INK, align: 'center', valign: 'middle' })])], g, x.d.name));
        let cx = x0 + 6 + x.tw + 8;
        if (x.one) out.push(...band(x.d.items[0], cx, y + 6, x.ws[0], x.h - 12, col, o.s, o.D || 28, g + '-0'));
        else x.d.items.forEach((it, i) => { out.push(...planTile(it, cx, y + 6, x.ws[i], x.h - 12, Object.assign({ col, bg: W, grp: g + '-' + i, iconBg: PANEL }, { s: o.s, D: o.D, pad: o.pad }))); cx += x.ws[i] + 8; });
        y -= lip + gap;
      });
      return out;
    } });

  /* 3. Technical illustration: the platform as a scene - the named sources feeding a line of machines (one large
     pictorial object per stage, standing on one base: a cube with the stage's object, disks for storage, a screen for the
     result), each annotated with its label and description, alternately above and below the line so the annotations
     can be wide; the functions across the flow as a strip under the whole scene. */
  regPlan('scene', { name: 'Technical illustration', family: 'scene', kind: 'pictorial',
    needs: P => { const f = flowOf(P); return f.length < 2 ? 'needs a flow of 2 or more stages' : f.length > 6 ? 'more than 6 stages' : r(P).supports.length > 4 ? 'more than 4 functions across the flow' : P.items.length - f.length !== r(P).supports.length ? 'every point must be a stage, a result or a function across the flow' : ''; },
    opts: [{ s: 24, S: 92 }, { s: 22, S: 84 }, { s: 22, S: 76 }, { s: 22, S: 66 }, { s: 22, S: 58 }],
    build: (P, R, o) => {
      const f = flowOf(P), sup = r(P).supports, srcs = (P.sources || []).slice(0, 4), n = f.length, D2 = 28;
      const sw = srcs.length ? 96 : 0, slot = (R.w - sw) / n;
      // an annotation may use two slots (its neighbours are on the other side of the line); the two ends stay inside
      const aw = i => Math.min(n > 2 ? 2 * slot - 16 : slot - 12, 340), ax = (i, cx) => Math.max(R.x + (i ? sw : 0), Math.min(cx - aw(i) / 2, R.x + R.w - aw(i)));
      if (!f.every((it, i) => planFits(it, aw(i), o.s, 2))) return planNo('a word does not fit its annotation');
      const up = f.map((_, i) => i % 2 === 0), ah = f.map((it, i) => planTextH(it, aw(i), o.s));
      const above = Math.max(0, ...ah.filter((_, i) => up[i])), below = Math.max(0, ...ah.filter((_, i) => !up[i]));
      const sr = bandRow(sup, 0, 0, R.w, o.s, D2);
      if (!sr) return planNo('a function across the flow does not fit its strip');
      const sceneH = o.S + 30, need = above + 10 + sceneH + 10 + below + (sr.h ? 12 + sr.h : 0);
      if (need > R.h) return planNo(`needs ${Math.round(need)} of ${Math.round(R.h)} pt of height`);
      const y0 = R.y + (R.h - need) / 2, out = [], lines = [];
      const oy = y0 + above + 10, baseY = oy + o.S + 6, my = oy + o.S * 0.55;
      const cxs = f.map((_, i) => R.x + sw + slot * i + slot / 2);
      // the base all machines stand on, and the line that joins them
      out.push(Object.assign(box('parallelogram', R.x + sw - 16, baseY, R.w - sw + 16, 22, { fill: SOFT }), { grp: 'base', grpName: 'Base' }));
      lines.push(seg(cxs[0], my, cxs[n - 1], my, SOFT, 10, { grp: 'line' }));
      if (srcs.length) {   // the sources the text names, feeding the first machine (no text: its description names them)
        const S = 36, pos = srcs.map((_, i) => [R.x + 4 + (i % 2) * (S + 8), oy + 4 + Math.floor(i / 2) * (S + 12)]);
        srcs.forEach((t, i) => { out.push(...planIcon(srcKey(t), pos[i][0], pos[i][1], S, EDGE, PANEL, 'src' + i)); lines.push(seg(pos[i][0] + S, pos[i][1] + S / 2, cxs[0] - o.S / 2 - 4, my, SOFT, 2.5)); });
      }
      f.forEach((it, i) => {
        const cx = cxs[i], col = accent(P.items.indexOf(it)), g = 'obj' + i, S = o.S, key = objKey(it), y = oy;
        let obj;
        if (it.role === 'output') {   // a screen showing the result's object
          obj = [box('roundRect', cx - S * 0.66, y + 2, S * 1.32, S * 0.86, { fill: col }), box('rect', cx - S * 0.56, y + 10, S * 1.12, S * 0.66, { fill: W }), box('trapezoid', cx - S * 0.24, y + S * 0.88, S * 0.48, S * 0.12, { fill: EDGE }),
            ...comp(key, cx - S * 0.27, y + 13, S * 0.54, col).map(q => Object.assign(q, { grp: g }))];
        } else if (key === 'database') {   // storage: a stack of disks
          obj = [box('can', cx - S * 0.4, y + 2, S * 0.8, S * 0.96, { fill: col }), rule(cx - S * 0.4, y + S * 0.42, S * 0.8, 3, W), rule(cx - S * 0.4, y + S * 0.68, S * 0.8, 3, W)];
        } else {   // a machine: a cube with the stage's object on its face
          obj = [box('cube', cx - S / 2, y + 2, S, S, { fill: col }), box('ellipse', cx - S * 0.34, y + S * 0.3, S * 0.54, S * 0.54, { fill: W }), ...comp(key, cx - S * 0.26, y + S * 0.38, S * 0.38, col).map(q => Object.assign(q, { grp: g }))];
        }
        if (i < n - 1) out.push(headAt(cx + slot / 2 + 8, my, 0, 18, EDGE));
        const tx = ax(i, cx), ty = up[i] ? oy - 10 - ah[i] : baseY + 22 + 10;
        lines.push(seg(cx, up[i] ? oy - 8 : baseY + 22, cx, up[i] ? oy : baseY + 30, col, 2.5));
        out.push(...planGrp(obj.concat(planText(it, tx, ty, aw(i), o.s, { align: Math.abs(tx - (cx - aw(i) / 2)) < 1 ? 'center' : 'left' })), g, it.label));
      });
      if (sr.h) out.push(...drawBandRow(sup, sr, R.x, y0 + need - sr.h, o.s, D2, P, 'svc'));
      return lines.concat(out);
    } });

  /* 4. Capability map: one box per domain (the plan's groups, else main flow / supporting functions / output), its
     capabilities as tiles in a grid inside it; boxes side by side, as tall as the tallest. */
  regPlan('capmap', { name: 'Capability map', family: 'capmap', kind: 'grouped',
    needs: P => { const d = planDomains(P); return d.length < 2 ? 'needs 2 or more domains (groups, or a flow with functions across it)' : d.length > 4 ? 'more than 4 domains' : d.some(x => x.items.length > 6) ? 'a domain has more than 6 capabilities' : ''; },
    opts: [{ s: 24, D: 30, pad: 8 }, { s: 22, D: 28, pad: 7 }, { s: 22, D: 28, pad: 6, top: true }, { s: 22, D: 0, pad: 6 }],
    build: (P, R, o) => {
      const d = planDomains(P), T = { s: o.s, D: o.D, pad: o.pad, top: !!o.top }, gx = 10, ig = 8, ip = 6, lab = o.D && !o.top ? o.D + 8 + 2 * o.pad : 2 * o.pad;
      // a tile at least as wide as its words need (planWidths' measure for one item)
      const minUnit = x => Math.max(150, ...x.items.map(it => planWidths([it], 2000, 0, o.s, lab) ? Math.max(Math.max(...it.label.split(/\s+/).map(w => (w.length * o.s * 0.55 + 14.4) / 0.95)) + lab, ...(it.detail || '').split(/\s+/).map(w => w.length * PLAN_DS * 0.55 + 14.4 + 16)) + 4 : 1e9));
      // the functions that apply across the others: one strip under the domain boxes, its name in a tab, tiles side by side
      const strips = d.length > 2 ? d.filter(x => x.role === 'support') : [], main = d.filter(x => !strips.includes(x));
      const S = strips.map(x => { const tw = Math.max(130, Math.min(240, Math.max(...x.name.split(/\s+/).map(w => (w.length * o.s * 0.55 + 14.4) / 0.95)) + 18)), TS = { s: o.s, D: o.D || 28, pad: o.pad };
        const ws = planWidths(x.items, R.w - tw - 2 * ip - 8 - ig * 0, ig, o.s, TS.D + 8 + 2 * o.pad);
        if (!ws || !planWords(x.name, (tw - 14) * 0.95, o.s) || !x.items.every((it, i) => planTileFits(it, ws[i], TS))) return null;
        return { x, tw, ws, TS, h: Math.max(planLH(x.name, tw - 14, o.s) + 10, ...x.items.map((it, i) => planTileH(it, ws[i], TS))) + 2 * ip }; });
      if (S.some(q => !q)) return planNo('the functions across the domains do not fit one strip');
      const sh = S.reduce((a, q) => a + q.h + 10, 0), Hmax = R.h - sh;
      const dd = main, mins = dd.map(minUnit), opts = dd.map(x => [...new Set([Math.ceil(Math.sqrt(x.items.length)), Math.max(1, Math.ceil(Math.sqrt(x.items.length)) - 1), Math.min(x.items.length, 3), x.items.length])]);
      let best = null;
      const combo = (i, cols) => {
        if (i < dd.length) { opts[i].forEach(c => combo(i + 1, cols.concat([c]))); return; }
        const fixed = cols.reduce((a, c) => a + 2 * ip + ig * (c - 1), 0) + gx * (dd.length - 1), units = cols.reduce((a, c) => a + c, 0);
        let unit = dd.map(() => (R.w - fixed) / units);
        const short = dd.map((_, k) => mins[k] > unit[k]);
        if (short.some(Boolean)) { const left = R.w - fixed - dd.reduce((a, _, k) => a + (short[k] ? cols[k] * mins[k] : 0), 0), lu = cols.reduce((a, c, k) => a + (short[k] ? 0 : c), 0);
          unit = dd.map((_, k) => short[k] ? mins[k] : lu ? left / lu : 0); }
        if (unit.some((u, k) => u < mins[k] - 0.5) || unit.reduce((a, u, k) => a + u * cols[k], 0) + fixed > R.w + 0.5) return;
        // a domain of one item named like the item: no header repeating it
        const boxes = dd.map((x, k) => { const c = cols[k], rows = Math.ceil(x.items.length / c), bw = c * unit[k] + 2 * ip + ig * (c - 1), same = x.items.length === 1 && x.name.toLowerCase() === x.items[0].label.toLowerCase();
          const hh = same ? 0 : Math.max(44, planLH(x.name, bw - 20, o.s) + 8);
          if ((!same && !planWords(x.name, (bw - 20) * 0.95, o.s)) || !x.items.every(it => planTileFits(it, unit[k], T))) return null;
          const rh = Array.from({ length: rows }, (_, rr) => Math.max(...x.items.slice(rr * c, rr * c + c).map(it => planTileH(it, unit[k], T))));
          return { x, c, rows, bw, hh, rh, u: unit[k], h: hh + ip + rh.reduce((a, v) => a + v, 0) + ig * (rows - 1) + ip }; });
        if (boxes.some(q => !q)) return;
        const H = Math.max(...boxes.map(q => q.h));
        if (H <= Hmax && (!best || H < best.H)) best = { boxes, H };
      };
      combo(0, []);
      if (!best) return planNo('the domains do not fit side by side');
      const H = best.H + planSlack(best.H + sh, R, 50), y0 = R.y + (R.h - H - sh) / 2, out = [];
      let bx = R.x;
      best.boxes.forEach((b, i) => {
        const col = accent(i), g = 'dom' + i, more = (H - b.h) / b.rows;
        out.push(...planGrp([box('roundRect', bx, y0, b.bw, H, { fill: PANEL })].concat(b.hh ? [box('roundRect', bx, y0, b.bw, b.hh, { fill: col, text: b.x.name, size: o.s, bold: true, color: INK, align: 'center', valign: 'middle' })] : []), g, b.x.name));
        let ty = y0 + b.hh + ip;
        for (let rr = 0; rr < b.rows; rr++) {
          const h = b.rh[rr] + more, row = b.x.items.slice(rr * b.c, rr * b.c + b.c);
          row.forEach((it, j) => out.push(...planTile(it, bx + ip + j * (b.u + ig), ty, b.u, h, Object.assign({ col: accent(P.items.indexOf(it)), bg: W, grp: g + '-' + rr + '-' + j, stripe: !b.hh }, T))));
          ty += h + ig;
        }
        bx += b.bw + gx;
      });
      let sy = y0 + H + 10;
      S.forEach((q, si) => {   // the strip(s) across all domains
        const col = accent(best.boxes.length + si), g = 'strip' + si;
        out.push(...planGrp([box('roundRect', R.x, sy, R.w, q.h, { fill: PANEL }), box('roundRect', R.x + ip, sy + ip, q.tw, q.h - 2 * ip, { fill: col, text: q.x.name, size: o.s, bold: true, color: INK, align: 'center', valign: 'middle' })], g, q.x.name));
        let tx = R.x + ip + q.tw + 8;
        q.x.items.forEach((it, j) => { out.push(...planTile(it, tx, sy + ip, q.ws[j], q.h - 2 * ip, Object.assign({ col: accent(P.items.indexOf(it)), bg: W, grp: g + '-' + j }, q.TS))); tx += q.ws[j] + ig; });
        sy += q.h + 10;
      });
      return out;
    } });

  /* 5. Swimlanes: one lane per domain; the flow runs left to right across the lanes it passes through (an arrow at each
     hand-over); the other items sit in their lane. */
  regPlan('swimlanes', { name: 'Swimlanes', family: 'swimlanes', kind: 'architecture',
    needs: P => { const d = planDomains(P), f = planFlow(P); return d.length < 2 || d.length > 4 ? 'needs 2 to 4 lanes' : f.length < 2 ? 'needs a flow' : new Set(f.map(it => d.findIndex(x => x.items.includes(it)))).size < 2 ? 'the flow stays in one lane' : ''; },
    opts: [{ s: 22, D: 28, pad: 7 }, { s: 22, D: 0, pad: 6 }],
    build: (P, R, o) => {
      const d = planDomains(P), f = planFlow(P), T = { s: o.s, D: o.D, pad: o.pad }, tw = Math.max(130, Math.min(240, Math.max(...d.map(x => x.name).join(' ').split(/\s+/).map(x => (x.length * o.s * 0.55 + 14.4) / 0.95)) + 18)), gap = 28;
      if (!d.every(x => planWords(x.name, (tw - 14) * 0.95, o.s))) return planNo('a lane name does not fit');
      const lw = R.w - tw - 8, ws = planWidths(f, lw, gap, o.s, o.D ? o.D + 8 + 2 * o.pad : 2 * o.pad);
      if (!ws) return planNo('the flow is too wide for the lanes');
      const colX = ws.map((_, i) => R.x + tw + 8 + ws.slice(0, i).reduce((a, b) => a + b + gap, 0));
      const lanes = d.map(x => { const others = x.items.filter(it => !f.includes(it)), ow = others.length ? planWidths(others, lw, 10, o.s, o.D ? o.D + 8 + 2 * o.pad : 2 * o.pad) : [];
        if (!ow) return null;
        const hs = x.items.map(it => f.includes(it) ? planTileH(it, ws[f.indexOf(it)], T) : planTileH(it, ow[others.indexOf(it)], T));
        if (!x.items.every(it => f.includes(it) ? planTileFits(it, ws[f.indexOf(it)], T) : planTileFits(it, ow[others.indexOf(it)], T))) return null;
        return { x, others, ow, h: Math.max(planLH(x.name, tw - 14, o.s) + 10, ...hs) + 12 }; });
      if (lanes.some(l => !l)) return planNo('a lane\'s items do not fit');
      if (lanes.some(l => l.others.length && l.x.items.some(it => f.includes(it)))) return planNo('a lane mixes flow steps and other items');
      const need = lanes.reduce((a, l) => a + l.h, 0) + 8 * (lanes.length - 1);
      if (need > R.h) return planNo(`needs ${Math.round(need)} of ${Math.round(R.h)} pt of height`);
      const more = planSlack(need, R, 14 * lanes.length) / lanes.length, out = [], lines = [], at = {};
      let y = R.y + (R.h - need - more * lanes.length) / 2;
      lanes.forEach((l, li) => {
        const h = l.h + more, col = accent(li), g = 'lane' + li;
        out.push(...planGrp([box('roundRect', R.x, y, R.w, h, { fill: PANEL }), box('roundRect', R.x, y, tw, h, { fill: col, text: l.x.name, size: o.s, bold: true, color: INK, align: 'center', valign: 'middle' })], g, l.x.name));
        let ox = R.x + tw + 8;
        l.x.items.forEach((it, j) => {
          const fi = f.indexOf(it), x = fi >= 0 ? colX[fi] : ox, w = fi >= 0 ? ws[fi] : l.ow[l.others.indexOf(it)];
          out.push(...planTile(it, x, y + 6, w, h - 12, Object.assign({ col: accent(P.items.indexOf(it)), bg: W, grp: g + '-' + j }, T)));
          at[it.id] = { x, y: y + 6, w, h: h - 12 };
          if (fi < 0) ox += w + 10;
        });
        y += h + 8;
      });
      f.slice(1).forEach((it, i) => { const a = at[f[i].id], b = at[it.id], ay = a.y + a.h / 2, by = b.y + b.h / 2, x1 = a.x + a.w + 3, x2 = b.x - 3, mx = (x1 + x2) / 2;
        if (Math.abs(ay - by) < 2) lines.push(...arrowSeg(x1, ay, x2, by, EDGE, 2.5, 12));
        else lines.push(seg(x1, ay, mx, ay, EDGE, 2.5), seg(mx, ay, mx, by, EDGE, 2.5), ...arrowSeg(mx, by, x2, by, EDGE, 2.5, 12)); });
      return lines.concat(out);
    } });

  /* 6. Ecosystem: the topic at the centre, every part around it on a ring as a pictorial node joined to it, its label
     and description beside the node (for parts of one whole; nothing implies an order). */
  regPlan('ecosystem', { name: 'Ecosystem', family: 'ecosystem', kind: 'pictorial',
    needs: P => !P.title ? 'needs a topic' : P.items.length < 4 || P.items.length > 8 ? 'works for 4 to 8 parts' : planSeq(P) ? 'the content is a sequence' : '',
    opts: [{ s: 22, D: 54 }, { s: 22, D: 46 }],
    build: (P, R, o) => {
      const n = P.items.length, cx = R.x + R.w / 2, cy = R.y + R.h / 2, HD = Math.min(150, R.h * 0.36), t = textRect('ellipse', 0, 0, HD * 1.6, HD);
      if (!fitsAt(P.title, t.w, t.h, PLAN_DS)) return planNo('the topic does not fit the centre');
      const left = P.items.slice(0, Math.ceil(n / 2)), right = P.items.slice(Math.ceil(n / 2)), tw = (R.w - HD * 1.6) / 2 - o.D - 40;
      if (!P.items.every(it => planFits(it, tw, o.s))) return planNo('a word does not fit beside its node');
      const sideH = s => s.reduce((a, it) => a + Math.max(o.D, planTextH(it, tw, o.s)) + 10, -10);
      if (Math.max(sideH(left), sideH(right)) > R.h) return planNo(`needs ${Math.round(Math.max(sideH(left), sideH(right)))} of ${Math.round(R.h)} pt of height`);
      const out = [], lines = [];
      [[left, -1], [right, 1]].forEach(([S, d], si) => {
        let y = cy - sideH(S) / 2;
        S.forEach((it, j) => {
          const h = Math.max(o.D, planTextH(it, tw, o.s)), i = si ? left.length + j : j, col = accent(i + 1), g = 'node' + i;
          const nx = d < 0 ? R.x + tw + 16 : R.x + R.w - tw - 16 - o.D, ny = y + (h - o.D) / 2;
          lines.push(seg(nx + o.D / 2, ny + o.D / 2, cx + d * HD * 0.75, cy, SOFT, 2.5));
          out.push(...planGrp([box('ellipse', nx, ny, o.D, o.D, { fill: col }), ...planIcon(objKey(it), nx + o.D * 0.14, ny + o.D * 0.14, o.D * 0.72, col, W, g),
            ...planText(it, d < 0 ? R.x : nx + o.D + 16, y + (h - planTextH(it, tw, o.s)) / 2, tw, o.s, { align: d < 0 ? 'left' : 'left', grp: g })], g, it.label));
          y += h + 10;
        });
      });
      out.push(Object.assign(box('ellipse', cx - HD * 0.8, cy - HD / 2, HD * 1.6, HD, { fill: SOFT, text: P.title, size: PLAN_DS, bold: true, color: INK, align: 'center', valign: 'middle' }), { grp: 'core', grpName: P.title }));
      return lines.concat(out);
    } });

  /* 7. Modular blocks: each part as a module (a 3-D block with its object), its label and description beside it. */
  regPlan('modules', { name: 'Modular blocks', family: 'modules', kind: 'pictorial',
    needs: P => P.items.length < 2 || P.items.length > 8 ? 'works for 2 to 8 parts' : planSeq(P) ? 'the content is a sequence' : '',
    opts: [{ s: 24, S: 60 }, { s: 22, S: 52 }, { s: 22, S: 44 }],
    build: (P, R, o) => {
      const n = P.items.length;
      for (const cols of n <= 3 ? [n, 1] : n <= 4 ? [2] : [2, 3]) {
        const rows = Math.ceil(n / cols), cw = (R.w - 18 * (cols - 1)) / cols, tw = cw - o.S - 18;
        if (!P.items.every(it => planFits(it, tw, o.s))) continue;
        const rh = Math.max(o.S + 8, ...P.items.map(it => planTextH(it, tw, o.s))), need = rows * rh + 14 * (rows - 1);
        if (need > R.h) continue;
        const h = rh + planSlack(need, R, 20 * rows) / rows, y0 = R.y + (R.h - rows * h - 14 * (rows - 1)) / 2, out = [];
        P.items.forEach((it, i) => {
          const x = R.x + (i % cols) * (cw + 18), y = y0 + Math.floor(i / cols) * (h + 14), col = accent(i), g = 'mod' + i, S = o.S;
          out.push(...planGrp([box('roundRect', x, y, cw, h, { fill: PANEL }), box('cube', x + 6, y + (h - S) / 2, S, S, { fill: col }), box('ellipse', x + 6 + S * 0.12, y + (h - S) / 2 + S * 0.36, S * 0.5, S * 0.5, { fill: W }),
            ...comp(objKey(it), x + 6 + S * 0.19, y + (h - S) / 2 + S * 0.43, S * 0.36, col).map(q => Object.assign(q, { grp: g })),
            ...planText(it, x + S + 16, y + (h - planTextH(it, tw, o.s)) / 2, tw, o.s, { grp: g })], g, it.label));
        });
        return out;
      }
      return null;
    } });

  /* 8. Pyramid: levels from the base up (for layered or hierarchical content); each level's label and description beside it. */
  regPlan('pyramid', { name: 'Pyramid', family: 'pyramid', kind: 'layered',
    needs: P => !/layers|hierarchy/.test(P.relation || '') ? 'only for levels or a hierarchy' : P.items.length < 3 || P.items.length > 6 ? 'works for 3 to 6 levels' : '',
    opts: [{ s: 24 }, { s: 22 }],
    build: (P, R, o) => {
      const L = planOrder(P), n = L.length, pw = R.w * 0.42, tw = R.w - pw - 30, g = 6, lh = (R.h - g * (n - 1)) / n;
      if (!L.every(it => planFits(it, tw, o.s) && planTextH(it, tw, o.s) <= lh + 2)) return null;
      const out = [];
      L.forEach((it, i) => {   // the first item at the top (the narrowest level)
        const y = R.y + i * (lh + g), wTop = pw * i / n, wBot = pw * (i + 1) / n, col = accent(i), gg = 'lvl' + i;
        out.push(...planGrp([box(i ? 'trapezoid' : 'triangle', R.x + (pw - wBot) / 2, y, wBot, lh, { fill: col }), seg(R.x + (pw + wTop) / 2 + (wBot - wTop) / 4 + 6, y + lh / 2, R.x + pw + 18, y + lh / 2, SOFT, 2),
          ...planText(it, R.x + pw + 26, y + (lh - planTextH(it, tw, o.s)) / 2, tw, o.s, { grp: gg })], gg, it.label));
      });
      return out;
    } });

  /* 9. Cycle: steps on a circle, each joined to the next and the last back to the first (only for a stated cycle). */
  regPlan('cycle', { name: 'Cycle', family: 'cycle', kind: 'sequence',
    needs: P => P.relation !== 'cycle' ? 'only for a cycle stated in the content' : P.items.length < 3 || P.items.length > 8 ? 'works for 3 to 8 steps' : '',
    opts: [{ s: 22, D: 50 }, { s: 22, D: 42 }],
    build: (P, R, o) => {
      const L = planOrder(P), n = L.length, cx = R.x + R.w / 2, cy = R.y + R.h / 2, rx = R.w * 0.2, ry = R.h * 0.36, tw = R.w / 2 - rx - o.D / 2 - 24;
      if (!L.every(it => planFits(it, tw, o.s))) return null;
      const pos = L.map((_, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a), a]; }), out = [], lines = [];
      pos.forEach((p, i) => { const q = pos[(i + 1) % n], dx = q[0] - p[0], dy = q[1] - p[1], Ln = Math.hypot(dx, dy), k = (o.D / 2 + 6) / Ln;
        lines.push(...arrowSeg(p[0] + dx * k, p[1] + dy * k, q[0] - dx * k, q[1] - dy * k, EDGE, 2.5, 12)); });
      L.forEach((it, i) => {
        const [x, y, a] = pos[i], right = Math.cos(a) >= -0.01, h = planTextH(it, tw, o.s), col = accent(i), g = 'step' + i;
        const tx = right ? x + o.D / 2 + 12 : x - o.D / 2 - 12 - tw, ty = Math.max(R.y, Math.min(R.y + R.h - h, y - h / 2));
        out.push(...planGrp([box('ellipse', x - o.D / 2, y - o.D / 2, o.D, o.D, { fill: col, text: planN(i), size: PLAN_DS, bold: true, color: INK, align: 'center', valign: 'middle' }),
          ...planText(it, tx, ty, tw, o.s, { align: 'left', grp: g })], g, it.label));
      });
      return lines.concat(out);
    } });

  /* 10. Funnel: stages narrowing from top to bottom (only for content that narrows down). */
  regPlan('funnel', { name: 'Funnel', family: 'funnel', kind: 'sequence',
    needs: P => P.relation !== 'funnel' ? 'only for content that narrows down' : P.items.length < 3 || P.items.length > 6 ? 'works for 3 to 6 stages' : '',
    opts: [{ s: 24 }, { s: 22 }],
    build: (P, R, o) => {
      const L = planOrder(P), n = L.length, fw = R.w * 0.42, tw = R.w - fw - 30, g = 6, lh = (R.h - g * (n - 1)) / n;
      if (!L.every(it => planFits(it, tw, o.s) && planTextH(it, tw, o.s) <= lh + 2)) return null;
      const out = [];
      L.forEach((it, i) => { const y = R.y + i * (lh + g), w = fw * (1 - i * 0.6 / n), col = accent(i), gg = 'st' + i;
        out.push(...planGrp([box('manualOp', R.x + (fw - w) / 2, y, w, lh, { fill: col }), seg(R.x + (fw + w) / 2 + 6, y + lh / 2, R.x + fw + 18, y + lh / 2, SOFT, 2),
          ...planText(it, R.x + fw + 26, y + (lh - planTextH(it, tw, o.s)) / 2, tw, o.s, { grp: gg })], gg, it.label)); });
      return out;
    } });

  /* 11. Comparison: the two things compared side by side, each with its points (only for content that compares). */
  regPlan('versus', { name: 'Side-by-side comparison', family: 'versus', kind: 'grouped',
    needs: P => P.relation !== 'comparison' ? 'only for content that compares' : planGroups(P).length !== 2 || !planAllGrouped(P) ? 'needs exactly 2 things compared' : '',
    opts: [{ s: 24, D: 28, pad: 8 }, { s: 22, D: 0, pad: 6 }],
    build: (P, R, o) => {
      const G = planGroups(P), mid = 40, cw = (R.w - mid) / 2, T = { s: o.s, D: o.D, pad: o.pad }, out = [];
      for (const [i, x] of G.entries()) {
        const bx = R.x + i * (cw + mid), hh = Math.max(48, planLH(x.g.name, cw - 20, o.s) + 10), hs = x.items.map(it => planTileH(it, cw - 16, T));
        if (!x.items.every(it => planTileFits(it, cw - 16, T)) || hh + 8 + hs.reduce((a, b) => a + b + 8, 0) > R.h) return null;
        out.push(...planGrp([box('roundRect', bx, R.y, cw, R.h, { fill: PANEL }), box('roundRect', bx, R.y, cw, hh, { fill: accent(i), text: x.g.name, size: o.s, bold: true, color: INK, align: 'center', valign: 'middle' })], 'side' + i, x.g.name));
        let y = R.y + hh + 8;
        x.items.forEach((it, j) => { out.push(...planTile(it, bx + 8, y, cw - 16, hs[j], Object.assign({ col: accent(i), bg: W, grp: 's' + i + '-' + j }, T))); y += hs[j] + 8; });
      }
      out.push(box('rect', R.x + cw + mid / 2 - 1.5, R.y + 20, 3, R.h - 40, { fill: SOFT }));
      return out;
    } });

  /* 12. Control and data planes (a family defined only as data: the zone grid of plan.js planZoneFamily) - the
     functions that coordinate and watch the flow in one band above, the flow and its result in a row below, what
     protects all of it in a band underneath. */
  const planes = planZoneFamily({ key: 'planes', name: 'Control and data planes', kind: 'architecture',
    needs: P => (r(P).control.length + r(P).quality.length) && r(P).stages.length >= 2 ? '' : 'needs a flow with functions that coordinate or watch it',
    // zones are filled in this order; '@rest' (whatever is left) belongs in the last one
    zones: [{ id: 'ctl', items: ['@control', '@quality'], col: 0, row: 0, w: 8, h: 2, style: 'band' },
      { id: 'flow', items: ['@stage', '@output'], col: 0, row: 2, w: 12, h: 4, style: 'nodes_row' },
      { id: 'base', items: ['@foundation', '@rest'], col: 8, row: 0, w: 4, h: 2, style: 'band' }],
    connectors: 'flow' });
  regPlan('planes', planes);
});
