/* AI Visual Builder 10.8 - reading a .pptx (Napkin's PowerPoint export) without a library: the zip's central directory,
   then each slide's shape tree with group transforms, theme colours, text, pictures and connectors. One model serves
   three purposes: the accuracy check (texts), the layout check (visualQuality, svg2ppt.js) and a preview thumbnail
   (pptxSvg). What the preview cannot draw exactly is listed in slide.notes, never hidden.
   Uses hexToRgb, rgbToHex, luminance (v10.html), esc (v10.html), BRAND, NAPKIN_MIN_PT (svg2ppt.js). */
const EMU = 12700;   // per point

async function unzipParts(u, want) {
  const dv = new DataView(u.buffer, u.byteOffset, u.byteLength), td = new TextDecoder(), out = {};
  let e = u.length - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) return null;
  let p = dv.getUint32(e + 16, true);
  for (let k = dv.getUint16(e + 10, true); k > 0; k--) {
    const method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    const name = td.decode(u.subarray(p + 46, p + 46 + nl));
    p += 46 + nl + xl + cl;
    if (!want(name)) continue;
    const start = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true), data = u.subarray(start, start + size);
    try {
      out[name] = method === 0 ? data.slice() : method === 8 ? new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()) : null;
    } catch (err) { /* an unreadable part is left out */ }
  }
  return out;
}

/* Colour of a DrawingML colour holder (a:solidFill, a:fillRef, a gradient stop ...): '#RRGGBB' or null. */
function dmlColor(holder, theme) {
  const c = holder && [...holder.children].find(x => /^a:(?:srgbClr|schemeClr|sysClr|prstClr|scrgbClr)$/.test(x.nodeName));
  if (!c) return null;
  let hex = null;
  const v = c.getAttribute('val');
  if (c.nodeName === 'a:srgbClr') hex = '#' + v.toUpperCase();
  else if (c.nodeName === 'a:sysClr') hex = '#' + (c.getAttribute('lastClr') || (v === 'window' ? 'FFFFFF' : '000000')).toUpperCase();
  else if (c.nodeName === 'a:schemeClr') hex = theme[{ tx1: 'dk1', bg1: 'lt1', tx2: 'dk2', bg2: 'lt2' }[v] || v] || null;
  else if (c.nodeName === 'a:prstClr') hex = { black: '#000000', white: '#FFFFFF', red: '#FF0000', gray: '#808080' }[v] || '#808080';
  if (!hex) return null;
  let [r, g, b] = hexToRgb(hex);
  for (const m of c.children) {
    const t = +m.getAttribute('val') / 100000;
    if (m.nodeName === 'a:shade') [r, g, b] = [r * t, g * t, b * t];
    else if (m.nodeName === 'a:tint') [r, g, b] = [r + (255 - r) * (1 - t), g + (255 - g) * (1 - t), b + (255 - b) * (1 - t)];
    else if (m.nodeName === 'a:lumMod' || m.nodeName === 'a:lumOff') {   // in HSL lightness
      const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, L = (mx + mn) / 2, L2 = Math.min(1, Math.max(0, m.nodeName === 'a:lumMod' ? L * t : L + t));
      if (mx === mn) [r, g, b] = [L2 * 255, L2 * 255, L2 * 255];
      else { const k = L2 / Math.max(L, 1e-6); [r, g, b] = L2 <= L || L === 0 ? [r * k, g * k, b * k] : [r + (255 - r) * (L2 - L) / (1 - L), g + (255 - g) * (L2 - L) / (1 - L), b + (255 - b) * (L2 - L) / (1 - L)]; }
    }
  }
  return rgbToHex([r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x)))));
}

/* Preset shapes the preview draws exactly (in the shape's own box); others are drawn as their box and noted. */
function presetPath(g, w, h, adj) {
  const m = Math.min(w, h), a = (k, d) => (adj[k] != null ? adj[k] : d) / 100000;
  switch (g) {
    case 'rect': case 'flowChartProcess': case 'textBox': return `M0 0H${w}V${h}H0Z`;
    case 'roundRect': case 'flowChartAlternateProcess': case 'snipRoundRect': case 'round2SameRect': case 'round1Rect': {
      const r = Math.min(m * a('adj', 16667), m / 2); return `M${r} 0H${w - r}A${r} ${r} 0 0 1 ${w} ${r}V${h - r}A${r} ${r} 0 0 1 ${w - r} ${h}H${r}A${r} ${r} 0 0 1 0 ${h - r}V${r}A${r} ${r} 0 0 1 ${r} 0Z`; }
    case 'ellipse': case 'flowChartConnector': return `M0 ${h / 2}A${w / 2} ${h / 2} 0 1 1 ${w} ${h / 2}A${w / 2} ${h / 2} 0 1 1 0 ${h / 2}Z`;
    case 'triangle': { const x = w * a('adj', 50000); return `M${x} 0L${w} ${h}H0Z`; }
    case 'rtTriangle': return `M0 0L${w} ${h}H0Z`;
    case 'diamond': case 'flowChartDecision': return `M${w / 2} 0L${w} ${h / 2}L${w / 2} ${h}L0 ${h / 2}Z`;
    case 'parallelogram': { const d = m * a('adj', 25000); return `M${d} 0H${w}L${w - d} ${h}H0Z`; }
    case 'trapezoid': { const d = m * a('adj', 25000); return `M0 ${h}L${d} 0H${w - d}L${w} ${h}Z`; }
    case 'hexagon': { const d = m * a('adj', 25000); return `M0 ${h / 2}L${d} 0H${w - d}L${w} ${h / 2}L${w - d} ${h}H${d}Z`; }
    case 'pentagon': return `M${w / 2} 0L${w} ${h * 0.38}L${w * 0.81} ${h}H${w * 0.19}L0 ${h * 0.38}Z`;
    case 'homePlate': { const d = m * a('adj', 50000); return `M0 0H${w - d}L${w} ${h / 2}L${w - d} ${h}H0Z`; }
    case 'chevron': { const d = m * a('adj', 50000); return `M0 0H${w - d}L${w} ${h / 2}L${w - d} ${h}H0L${d} ${h / 2}Z`; }
    case 'rightArrow': { const t = h * a('adj1', 50000), d = m * a('adj2', 50000), y0 = (h - t) / 2; return `M0 ${y0}H${w - d}V0L${w} ${h / 2}L${w - d} ${h}V${y0 + t}H0Z`; }
    case 'leftArrow': { const t = h * a('adj1', 50000), d = m * a('adj2', 50000), y0 = (h - t) / 2; return `M${w} ${y0}H${d}V0L0 ${h / 2}L${d} ${h}V${y0 + t}H${w}Z`; }
    case 'downArrow': { const t = w * a('adj1', 50000), d = m * a('adj2', 50000), x0 = (w - t) / 2; return `M${x0} 0H${x0 + t}V${h - d}H${w}L${w / 2} ${h}L0 ${h - d}H${x0}Z`; }
    case 'upArrow': { const t = w * a('adj1', 50000), d = m * a('adj2', 50000), x0 = (w - t) / 2; return `M${x0} ${h}H${x0 + t}V${d}H${w}L${w / 2} 0L0 ${d}H${x0}Z`; }
    case 'donut': { const d = m * a('adj', 25000); return presetPath('ellipse', w, h, {}) + `M${d} ${h / 2}A${w / 2 - d} ${h / 2 - d} 0 1 0 ${w - d} ${h / 2}A${w / 2 - d} ${h / 2 - d} 0 1 0 ${d} ${h / 2}Z`; }
    case 'line': case 'straightConnector1': return `M0 0L${w} ${h}`;
    default: return null;
  }
}

/* A custom geometry (a:custGeom) as an SVG path in the shape's box; arcs follow the DrawingML arcTo definition. */
function customPath(cg, w, h) {
  let d = '';
  for (const path of cg.getElementsByTagName('a:path')) {
    const pw = +path.getAttribute('w') || w * EMU, ph = +path.getAttribute('h') || h * EMU, sx = w / pw, sy = h / ph;
    let cx = 0, cy = 0;
    const pt = n => [+n.getAttribute('x') * sx, +n.getAttribute('y') * sy];
    for (const c of path.children) {
      const pts = [...c.getElementsByTagName('a:pt')].map(pt);
      if (c.nodeName === 'a:moveTo') { [cx, cy] = pts[0]; d += `M${cx} ${cy}`; }
      else if (c.nodeName === 'a:lnTo') { [cx, cy] = pts[0]; d += `L${cx} ${cy}`; }
      else if (c.nodeName === 'a:cubicBezTo' && pts.length === 3) { d += `C${pts.map(q => q.join(' ')).join(' ')}`; [cx, cy] = pts[2]; }
      else if (c.nodeName === 'a:quadBezTo' && pts.length === 2) { d += `Q${pts.map(q => q.join(' ')).join(' ')}`; [cx, cy] = pts[1]; }
      else if (c.nodeName === 'a:arcTo') {
        const wr = +c.getAttribute('wR') * sx, hr = +c.getAttribute('hR') * sy, st = +c.getAttribute('stAng') / 60000 * Math.PI / 180, sw = +c.getAttribute('swAng') / 60000 * Math.PI / 180;
        const ox = cx - wr * Math.cos(st), oy = cy - hr * Math.sin(st), ex = ox + wr * Math.cos(st + sw), ey = oy + hr * Math.sin(st + sw);
        d += `A${wr} ${hr} 0 ${Math.abs(sw) > Math.PI ? 1 : 0} ${sw > 0 ? 1 : 0} ${ex} ${ey}`; [cx, cy] = [ex, ey];
      } else if (c.nodeName === 'a:close') d += 'Z';
    }
  }
  return d || null;
}

/* The whole file: { R (slide size in pt), slides: [{ els, notes }], texts, small, fonts }. */
async function pptxRead(b64) {
  const bin = atob(b64), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const parts = await unzipParts(u, n => /^ppt\/(?:presentation\.xml|slides\/slide\d+\.xml|slides\/_rels\/slide\d+\.xml\.rels|theme\/theme1\.xml|media\/[^/]+)$/.test(n));
  if (!parts) return null;
  const td = new TextDecoder(), xml = n => parts[n] ? new DOMParser().parseFromString(td.decode(parts[n]), 'application/xml') : null;
  const sz = /<p:sldSz[^>]*cx="(\d+)"[^>]*cy="(\d+)"/.exec(parts['ppt/presentation.xml'] ? td.decode(parts['ppt/presentation.xml']) : '');
  const R = sz ? { x: 0, y: 0, w: sz[1] / EMU, h: sz[2] / EMU } : { x: 0, y: 0, w: 960, h: 540 };
  const theme = {}, th = xml('ppt/theme/theme1.xml'), cs = th && th.getElementsByTagName('a:clrScheme')[0];
  if (cs) for (const c of cs.children) { const v = c.firstElementChild; if (v) theme[c.nodeName.replace('a:', '')] = '#' + (v.getAttribute('val') && v.nodeName === 'a:srgbClr' ? v.getAttribute('val') : v.getAttribute('lastClr') || '000000').toUpperCase(); }
  const out = { R, slides: [], texts: [], small: 0, fonts: new Set() };
  const names = Object.keys(parts).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => +/\d+/.exec(a)[0] - +/\d+/.exec(b)[0]);
  for (const name of names) {
    const doc = xml(name), notes = new Set(), els = [], rels = {};
    // every paragraph's text, also of placeholders positioned by the layout (for the accuracy check)
    const dec = x => x.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
    const src = td.decode(parts[name]);
    out.small += [...src.matchAll(/<a:rPr[^>]*\ssz="(\d+)"/g)].filter(m => +m[1] < NAPKIN_MIN_PT * 100).length;
    [...src.matchAll(/<a:latin typeface="([^"]+)"/g)].forEach(m => { if (!/^\+/.test(m[1])) out.fonts.add(m[1]); });
    const texts = [];
    src.split(/<\/a:p>/).forEach(par => { const t = [...par.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(m => dec(m[1])).join('').trim(); if (t) { out.texts.push(t); texts.push(t); } });
    const rd = xml(name.replace('slides/', 'slides/_rels/') + '.rels');
    if (rd) for (const r of rd.getElementsByTagName('Relationship')) rels[r.getAttribute('Id')] = 'ppt/' + r.getAttribute('Target').replace(/^\.\.\//, '');
    const media = id => { const n = rels[id], d = n && parts[n]; if (!d) return null;
      const ext = n.split('.').pop().toLowerCase(), type = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml' }[ext];
      if (!type) return null;
      let s = ''; for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode.apply(null, d.subarray(i, i + 0x8000));
      return { src: `data:${type};base64,${btoa(s)}`, svg: ext === 'svg' ? td.decode(d) : null }; };
    const child = (el, tag) => el && [...el.children].find(c => c.nodeName === tag);
    const fillOf = (sp, ppr) => {
      if (!ppr) return null;
      if (child(ppr, 'a:noFill')) return null;
      const sf = child(ppr, 'a:solidFill');
      if (sf) return dmlColor(sf, theme);
      const gf = child(ppr, 'a:gradFill');
      if (gf) { notes.add('gradient shown as one colour'); return dmlColor(gf.getElementsByTagName('a:gs')[0], theme); }
      const ref = sp.getElementsByTagName('a:fillRef')[0];
      return ref && +ref.getAttribute('idx') > 0 ? dmlColor(ref, theme) : null;
    };
    const lineOf = (sp, ppr) => {
      const ln = ppr && child(ppr, 'a:ln'), w = ln && ln.getAttribute('w') ? +ln.getAttribute('w') / EMU : 0.75;
      if (ln && child(ln, 'a:noFill')) return null;
      const sf = ln && child(ln, 'a:solidFill');
      if (sf) return { color: dmlColor(sf, theme), w, dash: !!(ln.getElementsByTagName('a:prstDash')[0] && ln.getElementsByTagName('a:prstDash')[0].getAttribute('val') !== 'solid'),
        head: !!child(ln, 'a:headEnd') && (child(ln, 'a:headEnd').getAttribute('type') || 'none') !== 'none', tail: !!child(ln, 'a:tailEnd') && (child(ln, 'a:tailEnd').getAttribute('type') || 'none') !== 'none' };
      const ref = sp.getElementsByTagName('a:lnRef')[0];
      return ref && +ref.getAttribute('idx') > 0 ? { color: dmlColor(ref, theme), w } : null;
    };
    const textOf = sp => {
      const body = child(sp, 'p:txBody');
      if (!body) return null;
      const bp = child(body, 'a:bodyPr'), na = bp && bp.getElementsByTagName('a:normAutofit')[0], scale = na && na.getAttribute('fontScale') ? +na.getAttribute('fontScale') / 100000 : 1;
      const fontRef = sp.getElementsByTagName('a:fontRef')[0], defColor = (fontRef && dmlColor(fontRef, theme)) || theme.dk1 || '#000000';
      const paras = [...body.getElementsByTagName('a:p')].map(p => {
        const ppr = child(p, 'a:pPr'), runs = [];
        for (const r of p.children) {
          if (r.nodeName !== 'a:r' && r.nodeName !== 'a:fld') continue;
          const rp = child(r, 'a:rPr'), t = (child(r, 'a:t') || {}).textContent || '';
          const size = (rp && rp.getAttribute('sz') ? +rp.getAttribute('sz') / 100 : 18) * scale;
          runs.push({ t, size, bold: !!rp && rp.getAttribute('b') === '1', color: (rp && child(rp, 'a:solidFill') && dmlColor(child(rp, 'a:solidFill'), theme)) || defColor });
        }
        return { algn: (ppr && ppr.getAttribute('algn')) || 'l', runs };
      });
      const ins = k => bp && bp.getAttribute(k) != null ? +bp.getAttribute(k) / EMU : { lIns: 7.2, rIns: 7.2, tIns: 3.6, bIns: 3.6 }[k];
      const text = paras.map(p => p.runs.map(r => r.t).join('')).join('\n');
      if (!text.trim()) return null;
      return { paras, anchor: (bp && bp.getAttribute('anchor')) || 't', ins: { l: ins('lIns'), r: ins('rIns'), t: ins('tIns'), b: ins('bIns') }, wrap: !bp || bp.getAttribute('wrap') !== 'none' };
    };
    const num = (f, tag, a) => { const n = f && f.getElementsByTagName(tag)[0]; return n ? +n.getAttribute(a) / EMU : 0; };
    const walk = (node, T) => [...node.children].forEach(el => {
      const tag = el.nodeName, ppr = [...el.children].find(c => c.nodeName === 'p:spPr' || c.nodeName === 'p:grpSpPr');   // not p:nvSpPr / p:nvGrpSpPr
      const f = tag === 'p:graphicFrame' ? child(el, 'p:xfrm') : ppr && child(ppr, 'a:xfrm');
      if (!/^p:(?:sp|pic|cxnSp|grpSp|graphicFrame)$/.test(tag)) return;
      if (!f) { if (tag === 'p:sp' && textOf(el)) notes.add('a placeholder placed by the layout is not shown'); return; }
      const o = T(num(f, 'a:off', 'x'), num(f, 'a:off', 'y')), w = num(f, 'a:ext', 'cx') * T.s[0], h = num(f, 'a:ext', 'cy') * T.s[1];
      const box = { x: o[0], y: o[1], w, h, rot: (+f.getAttribute('rot') || 0) / 60000, flipH: f.getAttribute('flipH') === '1', flipV: f.getAttribute('flipV') === '1' };
      if (tag === 'p:grpSp') {   // child coordinates map from chOff/chExt into the group's box
        if (box.rot) notes.add('a turned group is shown unturned');
        const cx = num(f, 'a:chOff', 'x'), cy = num(f, 'a:chOff', 'y'), cw = num(f, 'a:chExt', 'cx') || 1, ch = num(f, 'a:chExt', 'cy') || 1, sx = w / cw, sy = h / ch;
        return walk(el, Object.assign((a, b) => [o[0] + (a - cx) * sx, o[1] + (b - cy) * sy], { s: [sx, sy] }));
      }
      if (tag === 'p:graphicFrame') {
        const kind = el.getElementsByTagName('a:tbl').length ? 'table' : el.getElementsByTagName('c:chart').length ? 'chart' : 'object';
        notes.add(`a ${kind} is shown as its outline only`);
        return els.push(Object.assign({ k: 'frame', kind }, box));
      }
      if (tag === 'p:pic') {
        const blip = el.getElementsByTagName('a:blip')[0], svgBlip = el.getElementsByTagName('asvg:svgBlip')[0];
        const m = (svgBlip && media(svgBlip.getAttribute('r:embed'))) || (blip && media(blip.getAttribute('r:embed')));
        if (!m) notes.add('a picture in a format the preview cannot show');
        return els.push(Object.assign({ k: 'pic', src: m && m.src, svg: m && m.svg }, box));
      }
      const geomEl = ppr && child(ppr, 'a:prstGeom'), cust = ppr && child(ppr, 'a:custGeom');
      const geom = geomEl ? geomEl.getAttribute('prst') : cust ? 'cust' : 'rect', adj = {};
      if (geomEl) for (const gd of geomEl.getElementsByTagName('a:gd')) { const v = /val (-?\d+)/.exec(gd.getAttribute('fmla') || ''); if (v) adj[gd.getAttribute('name')] = +v[1]; }
      const line = lineOf(el, ppr);
      if (tag === 'p:cxnSp' || geom === 'line' || /Connector/.test(geom)) {
        const x1 = box.flipH ? box.x + w : box.x, x2 = box.flipH ? box.x : box.x + w, y1 = box.flipV ? box.y + h : box.y, y2 = box.flipV ? box.y : box.y + h;
        return els.push({ k: 'line', x1, y1, x2, y2, elbow: /bentConnector/.test(geom), color: (line && line.color) || '#7F7F7F', w: (line && line.w) || 1, head: line && line.tail, tail: line && line.head, dash: line && line.dash });
      }
      let path = geom === 'cust' ? customPath(cust, w, h) : presetPath(geom, w, h, adj);
      if (!path) { notes.add(`shape "${geom}" shown as its box`); path = presetPath('rect', w, h, {}); }
      els.push(Object.assign({ k: 'shape', geom, path, fill: fillOf(el, ppr), line, text: textOf(el) }, box));
    });
    const tree = doc && doc.getElementsByTagName('p:spTree')[0];
    if (tree) walk(tree, Object.assign((a, b) => [a, b], { s: [1, 1] }));
    out.slides.push({ name, els, texts, notes: [...notes] });
  }
  return out;
}

/* Lines of a text body as drawn: wrapped by width at an estimated character width (as fitsAt does). */
function pptxLines(tx, w) {
  const inner = Math.max(10, w - tx.ins.l - tx.ins.r), out = [];
  tx.paras.forEach(p => {
    const size = Math.max(...p.runs.map(r => r.size), 1), r0 = p.runs.find(r => r.t.trim()) || p.runs[0] || { color: '#000000', bold: false };
    const words = p.runs.map(r => r.t).join('').split(/\s+/).filter(Boolean), per = Math.max(1, Math.floor(inner / (size * 0.55)));
    if (!words.length) return out.push({ t: '', size, algn: p.algn, color: r0.color, bold: r0.bold });
    let cur = '';
    words.forEach(wd => { if (cur && tx.wrap && (cur + ' ' + wd).length > per) { out.push({ t: cur, size, algn: p.algn, color: r0.color, bold: r0.bold }); cur = wd; } else cur = cur ? cur + ' ' + wd : wd; });
    out.push({ t: cur, size, algn: p.algn, color: r0.color, bold: r0.bold });
  });
  return out;
}
/* The area the text actually covers inside its shape (not the whole box), for the layout check. */
function pptxTextRect(el) {
  const L = pptxLines(el.text, el.w), h = L.reduce((a, l) => a + l.size * 1.2, 0), wd = Math.min(el.w - el.text.ins.l - el.text.ins.r, Math.max(...L.map(l => l.t.length * l.size * 0.55)));
  const x0 = el.x + el.text.ins.l, iw = el.w - el.text.ins.l - el.text.ins.r, ih = el.h - el.text.ins.t - el.text.ins.b, al = L[0] ? L[0].algn : 'l';
  const x = al === 'ctr' ? x0 + (iw - wd) / 2 : al === 'r' ? x0 + iw - wd : x0;
  const y = el.y + el.text.ins.t + (el.text.anchor === 'ctr' ? (ih - h) / 2 : el.text.anchor === 'b' ? ih - h : 0);
  return { x, y, w: Math.max(wd, 1), h: Math.max(h, 1), clip: h > ih + 2 && el.text.wrap };
}
/* Items for visualQuality: shapes (filled or outline), the text's own area, pictures, connectors. A box drawn twice
   (a fill and an outline of the same rectangle) is one filled box. */
function pptxQualityItems(els) {
  const S = els.filter(e => e.k === 'shape'), items = [];
  const same = (a, b) => Math.abs(a.x - b.x) < 3 && Math.abs(a.y - b.y) < 3 && Math.abs(a.w - b.w) < 3 && Math.abs(a.h - b.h) < 3;
  els.forEach(e => {
    if (e.k === 'line') items.push({ k: 'line', x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2 });
    else if (e.k === 'pic') items.push({ k: 'pic', x: e.x, y: e.y, w: e.w, h: e.h, dark: e.svg ? darkIcon(e.svg) : false });
    else if (e.k === 'frame') items.push({ k: 'shape', g: 'rect', x: e.x, y: e.y, w: e.w, h: e.h });
    else {
      const outline = !e.fill && !!e.line && !S.some(o => o !== e && o.fill && same(o, e));
      if (e.fill || e.line) items.push({ k: 'shape', g: e.geom === 'ellipse' ? 'ellipse' : e.geom, x: e.x, y: e.y, w: e.w, h: e.h, outline });
      if (e.text) items.push(Object.assign({ k: 'text' }, pptxTextRect(e)));
    }
  });
  return items;
}
/* An icon drawn only in black or near-black (the guidelines ask for flat colour icons). */
function darkIcon(svg) {
  const cols = [...svg.matchAll(/(?:fill|stroke)\s*[:=]\s*["']?\s*(#[0-9a-fA-F]{3,6}|black|rgb\([^)]*\))/g)].map(m => parseColor(m[1])).filter(Boolean);
  return cols.length > 0 && cols.every(c => luminance(c.hex) < 0.05);
}

/* A slide as a thumbnail SVG (string). Text in Open Sans as on insertion; pictures from the file itself. */
const pptxTf = e => `translate(${e.x} ${e.y})` + (e.rot ? ` rotate(${e.rot} ${e.w / 2} ${e.h / 2})` : '') + (e.flipH || e.flipV ? ` translate(${e.flipH ? e.w : 0} ${e.flipV ? e.h : 0}) scale(${e.flipH ? -1 : 1} ${e.flipV ? -1 : 1})` : '');
/* One shape's outline as SVG, in slide coordinates; `color` replaces its fill and line colours (icons in one colour). */
const pptxShapeSvg = (e, color) => `<path transform="${pptxTf(e)}" d="${e.path}" fill="${e.fill ? color || e.fill : 'none'}"${e.line ? ` stroke="${color || e.line.color}" stroke-width="${e.line.w}"` : ''}/>`;
function pptxSvg(slide, R) {
  const parts = [`<rect width="${R.w}" height="${R.h}" fill="#FFFFFF"/>`], tf = pptxTf;
  for (const e of slide.els) {
    if (e.k === 'line') {
      const d = e.elbow ? `M${e.x1} ${e.y1}H${(e.x1 + e.x2) / 2}V${e.y2}H${e.x2}` : `M${e.x1} ${e.y1}L${e.x2} ${e.y2}`;
      parts.push(`<path d="${d}" fill="none" stroke="${e.color}" stroke-width="${e.w}"${e.dash ? ' stroke-dasharray="4 3"' : ''}${e.head ? ' marker-end="url(#ah)"' : ''}/>`);
    } else if (e.k === 'pic') {
      parts.push(e.src ? `<image href="${e.src}" x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" preserveAspectRatio="none"/>`
        : `<rect x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" fill="#F2F2F2" stroke="#7F7F7F" stroke-dasharray="4 3"/>`);
    } else if (e.k === 'frame') {
      parts.push(`<rect x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" fill="none" stroke="#7F7F7F" stroke-dasharray="6 4"/><text x="${e.x + e.w / 2}" y="${e.y + e.h / 2}" font-size="${Math.min(24, e.h / 3)}" text-anchor="middle" fill="#7F7F7F" font-family="Open Sans, sans-serif">${e.kind}</text>`);
    } else {
      if (e.fill || e.line) parts.push(`<path transform="${tf(e)}" d="${e.path}" fill="${e.fill || 'none'}"${e.line ? ` stroke="${e.line.color}" stroke-width="${e.line.w}"` : ''}/>`);
      if (e.text) {
        const r = pptxTextRect(e), L = pptxLines(e.text, e.w);
        let y = r.y;
        L.forEach(l => {
          y += l.size * 1.2;
          const x = l.algn === 'ctr' ? e.x + e.text.ins.l + (e.w - e.text.ins.l - e.text.ins.r) / 2 : l.algn === 'r' ? e.x + e.w - e.text.ins.r : e.x + e.text.ins.l;
          if (l.t) parts.push(`<text x="${x}" y="${y - l.size * 0.28}" font-size="${l.size}" font-family="Open Sans, sans-serif"${l.bold ? ' font-weight="700"' : ''} fill="${l.color}" text-anchor="${l.algn === 'ctr' ? 'middle' : l.algn === 'r' ? 'end' : 'start'}">${esc(l.t)}</text>`);
        });
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${R.w} ${R.h}"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#7F7F7F"/></marker></defs>${parts.join('')}</svg>`;
}
