/* AI Visual Builder 10.5 - SVG to native PowerPoint objects (Napkin AI's SVG output). No dependencies.
   svgToPrims(svgText, R) reads the SVG in a hidden, script-free copy (scripts, event handlers, foreign content and
   external links are removed first; nothing is fetched) and returns the panel's usual primitives, fitted into R with
   the SVG's proportions, so the preview shows exactly what is inserted:
     rect, rounded rect, circle, ellipse, triangle, diamond, axis-aligned rectangle paths  -> native shapes
     line, polyline, straight open paths (with arrowheads)                                -> native lines
     text and tspans                                                                       -> native text boxes
     each top-level group                                                                  -> one PowerPoint group
   The PowerPoint JavaScript API cannot draw curves or free polygons, so each such part - or each group made only of
   such parts, i.e. an icon - becomes its own small picture at its exact place (never one picture for the whole visual;
   PowerPoint's "Convert to Shape" can make it editable). Colours go to the approved palette, text to Open Sans at
   18 pt or more (the guideline's infographic text size, LVC guidelines p. 43), gradients become solid colours, shadows and filters are removed; the report lists every case. */
const NAPKIN_MIN_PT = 18;    // LVC guidelines p. 43: infographic labels and descriptions in Open Sans 18 pt
const SVG_SKIP = new Set(['defs', 'style', 'title', 'desc', 'metadata', 'clippath', 'mask', 'pattern', 'lineargradient', 'radialgradient', 'filter', 'symbol', 'marker', 'script']);
const SVG_DROP = 'script, foreignObject, iframe, object, embed, audio, video, animate, set, animateTransform, animateMotion, a[href^="javascript"]';
const PIC_STYLE = ['fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'opacity',
  'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline', 'display', 'visibility'];

/* The SVG element, cleaned: nothing that runs code or loads anything from outside. */
function cleanSvg(text) {
  const doc = new DOMParser().parseFromString(String(text || ''), 'image/svg+xml'), root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== 'svg' || doc.getElementsByTagName('parsererror').length) throw new Error('The SVG could not be read.');
  root.querySelectorAll(SVG_DROP).forEach(e => e.remove());
  for (const el of [root, ...root.querySelectorAll('*')]) for (const a of [...el.attributes]) {
    const n = a.name.toLowerCase(), v = a.value.trim();
    if (n.startsWith('on')) el.removeAttribute(a.name);
    else if ((n === 'href' || n === 'xlink:href') && !/^(?:#|data:image\/(?:png|jpe?g|gif|webp);)/i.test(v)) el.removeAttribute(a.name);
    else if (n === 'style') el.setAttribute('style', v.replace(/url\(\s*['"]?(?!#)[^)]*\)/gi, 'none'));
  }
  root.querySelectorAll('style').forEach(st => { st.textContent = st.textContent.replace(/@import[^;]*;?/gi, '').replace(/url\(\s*['"]?(?!#)[^)]*\)/gi, 'none'); });
  return root;
}

/* Matrix helpers: [a, b, c, d, e, f] as in SVG. */
const mApply = (M, x, y) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]];
const mOf = el => { const m = el.getCTM && el.getCTM(); return m ? [m.a, m.b, m.c, m.d, m.e, m.f] : [1, 0, 0, 1, 0, 0]; };
const axisAligned = M => Math.abs(M[1]) < 1e-6 && Math.abs(M[2]) < 1e-6;
const bboxOf = pts => { const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }; };

/* "M10 20 L30 40 H50 V60 Z" -> subpaths of points; null when it has curves or arcs. */
function straightPath(d) {
  const tok = String(d || '').match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) || [], subs = [];
  let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, cur = null;
  const num = () => parseFloat(tok[i++]);
  while (i < tok.length) {
    if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
    if (C === 'Z') { if (cur) { cur.closed = true; x = sx; y = sy; } cur = null; continue; }
    if (!'MLHV'.includes(C)) return null;
    if (C === 'M') { x = (rel ? x : 0) + num(); y = (rel ? y : 0) + num(); sx = x; sy = y; cur = { pts: [[x, y]], closed: false }; subs.push(cur); cmd = rel ? 'l' : 'L'; continue; }
    if (!cur) { cur = { pts: [[x, y]], closed: false }; subs.push(cur); }
    if (C === 'L') { x = (rel ? x : 0) + num(); y = (rel ? y : 0) + num(); }
    else if (C === 'H') x = (rel ? x : 0) + num();
    else y = (rel ? y : 0) + num();
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    cur.pts.push([x, y]);
  }
  return subs.filter(s => s.pts.length >= 2);
}

/* A closed polygon (already in viewport units) as a preset shape, or null. */
function polygonShape(P) {
  const near = (a, b, t) => Math.abs(a - b) <= t;
  P = P.filter((p, i) => i === 0 || !near(p[0], P[i - 1][0], 0.01) || !near(p[1], P[i - 1][1], 0.01));
  if (P.length > 3 && near(P[0][0], P[P.length - 1][0], 0.01) && near(P[0][1], P[P.length - 1][1], 0.01)) P.pop();
  const B = bboxOf(P), t = Math.max(0.5, Math.min(B.w, B.h) * 0.02);
  if (B.w < 0.5 || B.h < 0.5) return null;
  if (P.length === 4 && P.every((p, i) => { const q = P[(i + 1) % 4]; return near(p[0], q[0], t) || near(p[1], q[1], t); })) return { g: 'rect', B, rot: 0 };
  const mids = [[B.x + B.w / 2, B.y], [B.x + B.w, B.y + B.h / 2], [B.x + B.w / 2, B.y + B.h], [B.x, B.y + B.h / 2]];
  if (P.length === 4 && P.every(p => mids.some(m => near(m[0], p[0], t) && near(m[1], p[1], t)))) return { g: 'diamond', B, rot: 0 };
  if (P.length === 3) {   // isosceles triangle with its tip in the middle of one side of its box
    const has = (x, y) => P.some(p => near(p[0], x, t) && near(p[1], y, t));
    if (has(B.x + B.w / 2, B.y) && has(B.x, B.y + B.h) && has(B.x + B.w, B.y + B.h)) return { g: 'triangle', B, rot: 0 };
    if (has(B.x + B.w / 2, B.y + B.h) && has(B.x, B.y) && has(B.x + B.w, B.y)) return { g: 'triangle', B, rot: 180 };
    const cx = B.x + B.w / 2, cy = B.y + B.h / 2, Bs = { x: cx - B.h / 2, y: cy - B.w / 2, w: B.h, h: B.w };   // turned: the unturned box
    if (has(B.x + B.w, B.y + B.h / 2) && has(B.x, B.y) && has(B.x, B.y + B.h)) return { g: 'triangle', B: Bs, rot: 90 };
    if (has(B.x, B.y + B.h / 2) && has(B.x + B.w, B.y) && has(B.x + B.w, B.y + B.h)) return { g: 'triangle', B: Bs, rot: 270 };
    if (has(B.x, B.y) && has(B.x, B.y + B.h) && has(B.x + B.w, B.y + B.h)) return { g: 'rtTriangle', B, rot: 0 };
  }
  return null;
}

/* svgText -> { prims, report }. R: the slide area to fit into (pt). */
function svgToPrims(svgText, R) {
  const root = cleanSvg(svgText), host = document.createElement('div');
  // off-screen, not visibility:hidden (every child would inherit it and count as invisible); removed before anything paints
  host.style.cssText = 'position:absolute;left:-30000px;top:0;width:10px;height:10px;overflow:hidden';
  const svg = document.importNode(root, true), vb = root.viewBox && root.viewBox.baseVal;
  const VW = vb && vb.width ? vb.width : parseFloat(root.getAttribute('width')) || 1000, VH = vb && vb.height ? vb.height : parseFloat(root.getAttribute('height')) || 600;
  svg.setAttribute('width', VW); svg.setAttribute('height', VH);
  host.appendChild(svg); document.body.appendChild(host);
  const notes = {}, note = (k, n) => { notes[k] = (notes[k] || 0) + (n || 1); }, items = [];
  try {
    const cs = el => getComputedStyle(el);
    const alpha = el => { let a = 1; for (let n = el; n && n !== svg.parentNode; n = n.parentNode) if (n.nodeType === 1) a *= parseFloat(cs(n).opacity || 1); return a; };
    const filtered = el => { for (let n = el; n && n !== svg.parentNode; n = n.parentNode) if (n.nodeType === 1 && ((n.getAttribute('filter') || '') || (cs(n).filter && cs(n).filter !== 'none'))) return true; return false; };
    /* A fill or stroke as an approved colour (gradients become their first colour). */
    const paint = (el, prop) => {
      const v = cs(el)[prop];
      let c = parseColor(v);
      const m = /url\(["']?#([^"')]+)/.exec(v || '');
      if (m) {
        const g = svg.querySelector('[id="' + m[1].replace(/"/g, '') + '"]'), stop = g && g.querySelector('stop');
        if (!stop) return null;
        note('gradient made a solid colour');
        c = parseColor(cs(stop).stopColor || stop.getAttribute('stop-color'));
      }
      if (!c) return null;
      c.a *= parseFloat(cs(el)[prop + 'Opacity'] || 1) * alpha(el);
      return c.a < 0.04 ? null : brandColor(c);
    };
    const strokeW = (el, M) => parseFloat(cs(el).strokeWidth || 1) * Math.sqrt(Math.abs(M[0] * M[3] - M[1] * M[2]));
    const visible = el => { const s = cs(el); return s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity || 1) > 0; };
    const picOf = el => { try { const b = el.getBBox(), M = mOf(el), pad = strokeW(el, M) / 2;
      const B = bboxOf([[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]].map(p => mApply(M, p[0], p[1])));
      return B.w > 0 && B.h > 0 ? { kind: 'pic', el, x: B.x - pad, y: B.y - pad, w: B.w + 2 * pad, h: B.h + 2 * pad } : null; } catch (e) { return null; } };
    const shape = (el, g, B, rot, extra) => {
      const fill = paint(el, 'fill'), line = paint(el, 'stroke'), M = mOf(el);
      if (!fill && !line) return null;
      if (filtered(el)) note('shadow or filter removed');
      return Object.assign({ kind: 'shape', g, x: B.x, y: B.y, w: B.w, h: B.h, rot: rot || 0, fill, line, lineW: line ? strokeW(el, M) : 0 }, extra);
    };
    /* Box of an element's local rectangle under its matrix: straight, turned (uniform scale), or null (skewed). */
    const placed = (M, x, y, w, h) => {
      if (axisAligned(M)) return { B: bboxOf([mApply(M, x, y), mApply(M, x + w, y + h)]), rot: 0 };
      const sx = Math.hypot(M[0], M[1]), sy = Math.hypot(M[2], M[3]);
      if (Math.abs(sx - sy) > sx * 0.01 || M[0] * M[3] - M[1] * M[2] <= 0) return null;
      const c = mApply(M, x + w / 2, y + h / 2);
      return { B: { x: c[0] - w * sx / 2, y: c[1] - h * sy / 2, w: w * sx, h: h * sy }, rot: Math.atan2(M[1], M[0]) * 180 / Math.PI };
    };
    const lineItems = (el, pts, M) => {
      const color = paint(el, 'stroke');
      if (!color) return [];
      const w = strokeW(el, M), s = cs(el), P = pts.map(p => mApply(M, p[0], p[1])), out = [];
      for (let i = 1; i < P.length; i++) out.push({ kind: 'line', x1: P[i - 1][0], y1: P[i - 1][1], x2: P[i][0], y2: P[i][1], color, w, dash: s.strokeDasharray && s.strokeDasharray !== 'none' });
      // an arrowhead only for a marker that exists (a reference to a missing marker draws nothing)
      const marker = v => { const m = /url\(["']?#([^"')]+)/.exec(v || ''); return !!(m && svg.querySelector('marker[id="' + m[1].replace(/"/g, '') + '"]')); };
      if (out.length && marker(el.getAttribute('marker-end') || s.markerEnd)) out[out.length - 1].head = true;
      if (out.length && marker(el.getAttribute('marker-start') || s.markerStart)) out[0].tail = true;
      return out;
    };
    const textItem = el => {
      const M = mOf(el);
      if (!axisAligned(M)) return null;
      const s = cs(el), b = el.getBBox(), B = bboxOf([mApply(M, b.x, b.y), mApply(M, b.x + b.width, b.y + b.height)]);
      // every child in order, text nodes included: a bold tspan followed by plain text ("<tspan bold>Data ingestion:</tspan>
      // databases, APIs") is one line, and its plain part is content too. A tspan with its own y (or dy) starts a new line.
      const heavy = n => { const w = cs(n).fontWeight; return parseInt(w, 10) >= 600 || w === 'bold'; };
      const runs = [];
      [...el.childNodes].forEach(n => { const t = (n.textContent || '').replace(/\s+/g, ' '); if (!t.trim()) return;
        const nl = n.nodeType === 1 && runs.length && (n.hasAttribute('y') || (n.hasAttribute('dy') && parseFloat(n.getAttribute('dy'))));
        runs.push({ t, nl: !!nl, bold: n.nodeType === 1 ? heavy(n) : heavy(el), el: n }); });
      let lines = [];
      runs.forEach(r => { if (r.nl || !lines.length) lines.push(r.t.trim()); else lines[lines.length - 1] = (lines[lines.length - 1] + (/\s$/.test(lines[lines.length - 1]) || /^\s/.test(r.t) ? '' : ' ') + r.t).replace(/\s+/g, ' ').trim(); });
      lines = lines.filter(Boolean);
      if (!lines.length) return null;
      const color = paint(el, 'fill') || BRAND.ink, size = parseFloat(s.fontSize) * Math.abs(M[0]);
      const item = { kind: 'text', x: B.x, y: B.y, w: B.w, h: B.h, lines, size, bold: heavy(el), anchor: s.textAnchor, color };
      // one line that starts with a bold run and goes on in plain text: two text boxes at their own positions, so the bold
      // label stays bold and the structure reads it as a title with its description
      if (lines.length === 1 && runs.length >= 2 && runs[0].bold && runs.slice(1).every(r => !r.bold && !r.nl) && (s.textAnchor || 'start') === 'start') {
        const lead = runs[0].t.trim(), rest = runs.slice(1).map(r => r.t).join('').replace(/\s+/g, ' ').trim();
        try {     // the bold run's own advance width (whitespace as the browser laid it out)
          const x0 = el.getStartPositionOfChar(0).x, adv = runs[0].el.nodeType === 1 ? runs[0].el.getComputedTextLength() : 0;
          const gap = /^\s/.test(runs[1].t) || /\s$/.test(runs[0].t) ? parseFloat(s.fontSize) * 0.3 : 0;   // the space between them
          const x1 = mApply(M, x0 + adv + gap, b.y)[0], w0 = x1 - B.x;
          if (rest && adv > 0 && w0 > 0 && w0 < B.w) return [Object.assign({}, item, { w: w0, lines: [lead], bold: true }), Object.assign({}, item, { x: x1, w: B.x + B.w - x1, lines: [rest], bold: false })];
        } catch (e) { /* positions not available: one text box */ }
      }
      return item;
    };
    const leaf = el => {
      const tag = el.localName.toLowerCase(), M = mOf(el), n = v => (v && v.baseVal ? v.baseVal.value : 0);
      if (tag === 'rect') {
        const w = n(el.width), h = n(el.height), r = Math.max(n(el.rx), n(el.ry)), p = placed(M, n(el.x), n(el.y), w, h);
        if (!p || w <= 0 || h <= 0) return [picOf(el)];
        const g = r >= Math.min(w, h) / 2 - 0.5 ? (Math.abs(w - h) < 0.5 ? 'ellipse' : 'pill') : r > Math.min(w, h) * 0.04 ? 'roundRect' : 'rect';
        return [shape(el, g, p.B, p.rot)];
      }
      if (tag === 'circle' || tag === 'ellipse') {
        const rx = tag === 'circle' ? n(el.r) : n(el.rx), ry = tag === 'circle' ? n(el.r) : n(el.ry), p = placed(M, n(el.cx) - rx, n(el.cy) - ry, 2 * rx, 2 * ry);
        return p ? [shape(el, 'ellipse', p.B, p.rot)] : [picOf(el)];
      }
      if (tag === 'line') return lineItems(el, [[n(el.x1), n(el.y1)], [n(el.x2), n(el.y2)]], M);
      if (tag === 'polyline' || tag === 'polygon' || tag === 'path') {
        let subs;
        if (tag === 'path') subs = straightPath(el.getAttribute('d'));
        else { const pts = [...el.points].map(p => [p.x, p.y]); subs = pts.length >= 2 ? [{ pts, closed: tag === 'polygon' }] : []; }
        if (!subs) { note('curved path (kept as a picture)'); return [picOf(el)]; }
        const filled = !!paint(el, 'fill'), out = [];
        for (const sp of subs) {
          // SVG fills black when no fill is given, but two points enclose nothing: a connector "M259,139 L271,139" is a line
          if ((!sp.closed && !filled) || sp.pts.length < 3) { out.push(...lineItems(el, sp.pts, M)); continue; }
          const ps = polygonShape(sp.pts.map(p => mApply(M, p[0], p[1])));
          if (!ps) { note('irregular shape (kept as a picture)'); return [picOf(el)]; }
          out.push(shape(el, ps.g, ps.B, ps.rot));
        }
        return out;
      }
      if (tag === 'text') { const t = textItem(el); if (!t) { note('turned text (kept as a picture)'); return [picOf(el)]; } return [].concat(t); }
      if (tag === 'image') { if (el.getAttribute('href') || el.getAttribute('xlink:href')) { note('embedded picture'); return [picOf(el)]; } note('external picture not loaded'); return []; }
      if (tag === 'use') { note('reused symbol (kept as a picture)'); return [picOf(el)]; }
      return [];
    };
    /* Depth-first, in drawing order. A group whose parts are all pictures (an icon) becomes one picture. */
    const walk = (el, grp) => {
      const out = [];
      for (const ch of el.children) {
        const tag = ch.localName.toLowerCase();
        if (SVG_SKIP.has(tag) || !visible(ch)) continue;
        const g = grp || (el === svg && /^(?:g|a|svg)$/.test(tag) ? 'n' + items.length + '_' + out.length : null);
        if (/^(?:g|a|svg|switch)$/.test(tag)) {
          const sub = walk(ch, g);
          if (sub.length >= 2 && sub.every(x => x && x.kind === 'pic')) { const p = picOf(ch); if (p) { out.push(Object.assign(p, { grp: g })); continue; } }
          out.push(...sub);
        } else out.push(...leaf(ch).filter(Boolean).map(x => Object.assign(x, { grp: g })));
      }
      return out;
    };
    items.push(...walk(svg, null));
    // A white rectangle under everything is the page background: the slide already is white.
    const bg = items.findIndex(x => x.kind === 'shape' && x.g === 'rect' && x.w >= VW * 0.95 && x.h >= VH * 0.95);
    if (bg >= 0 && (!items[bg].fill || luminance(items[bg].fill) > 0.85)) items.splice(bg, 1);
    // Napkin draws a box as a fill and, separately, an outline of the same rectangle: one filled box (no outline).
    const same = (a, b) => Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2 && Math.abs(a.w - b.w) < 2 && Math.abs(a.h - b.h) < 2;
    for (let i = items.length - 1; i >= 0; i--) { const o = items[i];
      if (o.kind === 'shape' && !o.fill && o.line && items.some(f => f !== o && f.kind === 'shape' && f.fill && same(f, o))) { items.splice(i, 1); note('outline drawn over a filled box merged'); } }
    if (!items.length) throw new Error('The SVG has nothing that can be drawn.');
    // Fit: the content's box into R, proportions kept, centered.
    const ext = bboxOf(items.flatMap(x => x.kind === 'line' ? [[x.x1, x.y1], [x.x2, x.y2]] : [[x.x, x.y], [x.x + x.w, x.y + x.h]]));
    const k = Math.min(R.w / Math.max(ext.w, 1), R.h / Math.max(ext.h, 1)), ox = R.x + (R.w - ext.w * k) / 2 - ext.x * k, oy = R.y + (R.h - ext.h * k) / 2 - ext.y * k;
    const X = v => ox + v * k, Y = v => oy + v * k, prims = [], picArea = [];
    let raised = 0;
    for (const it of items) {
      if (it.kind === 'shape') {
        prims.push(box(it.g, X(it.x), Y(it.y), it.w * k, it.h * k, Object.assign({ fill: it.fill, grp: it.grp }, it.line ? { line: it.line, lineW: Math.max(0.75, it.lineW * k) } : {}, it.rot ? { rot: normDeg(it.rot) } : {})));
      } else if (it.kind === 'line') {
        const w = Math.max(0.75, it.w * k), x1 = X(it.x1), y1 = Y(it.y1), x2 = X(it.x2), y2 = Y(it.y2);
        if (it.head) prims.push(...arrowSeg(x1, y1, x2, y2, it.color, w).map(p => Object.assign(p, { grp: it.grp })));
        else prims.push(Object.assign(seg(x1, y1, x2, y2, it.color, w, it.dash ? { dash: true } : {}), { grp: it.grp }));
        if (it.tail) prims.push(Object.assign(headAt(x1, y1, Math.atan2(y1 - y2, x1 - x2) * 180 / Math.PI, Math.max(14, w * 5), it.color), { grp: it.grp }));
      } else if (it.kind === 'text') {
        const orig = it.size * k, size = Math.max(NAPKIN_MIN_PT, Math.round(orig * 2) / 2), grow = size / Math.max(orig, 1);
        if (orig < NAPKIN_MIN_PT - 0.25) raised++;
        const longest = Math.max(...it.lines.map(l => l.length)), text = it.lines.join('\n');
        const w = Math.max(it.w * k * grow * 1.12 + 16, longest * size * 0.56 + 16), h = it.lines.length * size * 1.2 + 9;
        const cx = it.anchor === 'middle' ? X(it.x + it.w / 2) : null, x = cx != null ? cx - w / 2 : it.anchor === 'end' ? X(it.x + it.w) + 8 - w : X(it.x) - 8;
        const y = Y(it.y + it.h / 2) - h / 2, bx = Math.max(R.x, Math.min(x, R.x + R.w - w)), by = Math.max(R.y, Math.min(y, R.y + R.h - h));
        prims.push(label(bx, by, Math.min(w, R.w), h, text, { size, bold: it.bold, color: luminance(it.color) <= 0.22 && it.color !== BRAND.ink ? it.color : BRAND.ink, font: BRAND.font,
          align: it.anchor === 'middle' || it.anchor === 'end' ? 'center' : 'left', valign: 'middle', grp: it.grp, srcSize: orig }));
      } else if (it.kind === 'pic') {
        const svgPart = picture(it.el, it), area = it.w * it.h;
        picArea.push(area);
        prims.push({ t: 'image', svg: svgPart, href: svgDataURL(svgPart), x: X(it.x), y: Y(it.y), w: it.w * k, h: it.h * k, under: area > ext.w * ext.h * 0.15, napkinPart: true });
      }
    }
    const pics = prims.filter(p => p.t === 'image').length;
    if (raised) note(`label raised to ${NAPKIN_MIN_PT} pt`, raised);
    const report = { shapes: prims.filter(p => p.t === 'shape').length, lines: prims.filter(p => p.t === 'line').length, texts: prims.filter(p => p.t === 'text').length, pictures: pics,
      notes, edit: pics ? 'partial' : 'full', layout: checkLayout(prims.filter(p => p.t !== 'image'), R) };
    report.native = report.shapes + report.lines + report.texts;
    report.mostlyPictures = report.native < 3 || (picArea.reduce((a, b) => a + b, 0) > ext.w * ext.h * 0.6);
    report.quality = visualQuality(qualityItems(prims), R);
    return { prims, report };
  } finally { host.remove(); }

  /* One part as its own small SVG: a copy with its computed look written onto it (so classes and inherited styles
     survive), approved colours only, no filters, under its full transform. */
  function picture(el, it) {
    const copy = el.cloneNode(true), orig = [el, ...el.querySelectorAll('*')], dup = [copy, ...copy.querySelectorAll('*')];
    orig.forEach((o, i) => {
      const s = getComputedStyle(o), d = dup[i];
      if (!d || !d.setAttribute) return;
      d.setAttribute('style', PIC_STYLE.map(p => {
        let v = s.getPropertyValue(p);
        if (!v) return '';
        if (p === 'fill' || p === 'stroke') {
          const m = /url\(["']?#([^"')]+)/.exec(v);
          if (m) { const g = svg.querySelector('[id="' + m[1].replace(/"/g, '') + '"]'), st = g && g.querySelector('stop'); v = st ? getComputedStyle(st).stopColor : 'none'; }
          const c = parseColor(v);
          v = c ? brandColor({ hex: c.hex, a: 1 }) : 'none';
        }
        if (p === 'font-family') v = `'${BRAND.font}', sans-serif`;
        return `${p}:${v}`;
      }).filter(Boolean).join(';') + ';filter:none');
      d.removeAttribute('class'); d.removeAttribute('filter');
    });
    copy.removeAttribute('transform');
    const M = mOf(el), defs = [...svg.querySelectorAll('clipPath, mask')].map(n => n.outerHTML).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${it.x} ${it.y} ${it.w} ${it.h}" width="${it.w}" height="${it.h}">` +
      (defs ? `<defs>${defs}</defs>` : '') + `<g transform="matrix(${M.join(' ')})">${new XMLSerializer().serializeToString(copy)}</g></svg>`;
  }
}

/* Geometry checks for a finished visual (Napkin SVG after conversion, or a Napkin PPT slide). What makes a slide
   unusable is "block" (the result is excluded from insertion); smaller points are "warn". Thresholds are on the ink
   area of each label (its box minus margins), so labels that merely sit close together are not flagged.
   items: { k: 'text' | 'pic' | 'shape' | 'line', x, y, w, h, g?, outline? } or lines { k: 'line', x1, y1, x2, y2 }. */
function visualQuality(items, R) {
  const T = items.filter(i => i.k === 'text'), P = items.filter(i => i.k === 'pic'), S = items.filter(i => i.k === 'shape'), L = items.filter(i => i.k === 'line');
  const area = r => Math.max(0, r.w) * Math.max(0, r.h), A = R.w * R.h;
  const inter = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const ink = t => ({ x: t.x + t.w * 0.08, y: t.y + t.h * 0.18, w: t.w * 0.84, h: t.h * 0.64 });
  // a line hidden under a filled shape drawn after it (a numbered badge on a timeline) does not cross that shape's label
  const covered = (l, x, y) => l.z != null && S.some(s => !s.outline && s.z > l.z && x > s.x && x < s.x + s.w && y > s.y && y < s.y + s.h);
  const crosses = (l, r) => { for (let i = 1; i < 20; i++) { const x = l.x1 + (l.x2 - l.x1) * i / 20, y = l.y1 + (l.y2 - l.y1) * i / 20; if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h && !covered(l, x, y)) return true; } return false; };
  const block = [], warn = [], say = (list, n, one, many) => { if (n) list.push(n === 1 ? one : many.replace('#', n)); };
  let n = 0;
  for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) { const a = ink(T[i]), b = ink(T[j]); if (inter(a, b) > 0.1 * Math.min(area(a), area(b))) n++; }
  say(block, n, 'two labels overlap', '# pairs of labels overlap');
  say(block, T.filter(t => t.clip).length, 'a label is cut off (does not fit its box)', '# labels are cut off (do not fit their boxes)');
  say(block, T.filter(t => P.some(p => inter(ink(t), p) > 0.12 * Math.min(area(ink(t)), area(p)))).length, 'a label runs into an icon', '# labels run into icons');
  say(block, T.filter(t => L.some(l => crosses(l, ink(t)))).length, 'a connector crosses a label', 'connectors cross # labels');
  const E = S.filter(s => s.g === 'ellipse' && area(s) > 0.01 * A);
  n = 0;
  for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) { const o = inter(E[i], E[j]), m = Math.min(area(E[i]), area(E[j])); if (o > 0.05 * m && o < 0.9 * m) n++; }
  say(block, n, 'two circles overlap', '# pairs of circles overlap');
  say(block, P.filter(p => area(p) > 0.12 * A).length, 'a large decorative illustration (not part of the content)', '# large decorative illustrations (not part of the content)');
  // an outline around a label is a frame (a warning); empty outlines (pillars, rings) block
  const inside = (t, s) => t.x >= s.x - 2 && t.y >= s.y - 2 && t.x + t.w <= s.x + s.w + 2 && t.y + t.h <= s.y + s.h + 2;
  const O = S.filter(s => s.outline && area(s) > 0.02 * A), framed = O.filter(s => T.some(t => inside(t, s)));
  n = O.length - framed.length;
  if (n >= 2) block.push(`${n} outline-only graphics (pillars, rings or frames; the guidelines ask for solid, filled shapes)`);
  say(warn, framed.length, 'a label sits in an outline-only frame', '# labels sit in outline-only frames');
  say(block, items.filter(i => i.k !== 'line' && (i.x < R.x - 2 || i.y < R.y - 2 || i.x + i.w > R.x + R.w + 2 || i.y + i.h > R.y + R.h + 2)).length, 'an element is outside the content area', '# elements are outside the content area');
  const box = items.filter(i => i.k !== 'line');
  if (box.length) {
    const x0 = Math.min(...box.map(i => i.x)), y0 = Math.min(...box.map(i => i.y)), x1 = Math.max(...box.map(i => i.x + i.w)), y1 = Math.max(...box.map(i => i.y + i.h));
    if ((x1 - x0) * (y1 - y0) < 0.3 * A) warn.push('much of the area is left empty');
    const cx = box.reduce((a, i) => a + (i.x + i.w / 2) * area(i), 0) / Math.max(1, box.reduce((a, i) => a + area(i), 0));
    if (Math.abs(cx - (R.x + R.w / 2)) > R.w * 0.22) warn.push('the composition is off-centre');
  }
  return { block, warn, excluded: block.length > 0 };
}

/* A word wider than its box is cut or broken mid-word by PowerPoint (same width estimate as fitsAt). */
const cutOff = (text, w, size, h) => !!size && (String(text || '').split(/\s+/).some(word => word.length * size * 0.55 > w - 14.4 + 1) || (h != null && !fitsAt(text, w + 2, h + 2, size)));
/* Primitives -> items for visualQuality. Pictorial objects of the native engine (parts tagged with cmp) count as one
   icon each; a shape with text counts as a label over its text area; thin rectangles are connectors. */
function qualityItems(prims) {
  const out = [], icons = {};
  // z: the drawing order (a later filled shape covers an earlier line)
  prims.flatMap(p => p.t === 'table' ? p.cells : [p]).forEach((p, z) => {
    if (p.cmp) { const b = icons[p.grp] = icons[p.grp] || { k: 'pic', x: 1e9, y: 1e9, x2: -1e9, y2: -1e9 };
      b.x = Math.min(b.x, p.x); b.y = Math.min(b.y, p.y); b.x2 = Math.max(b.x2, p.x + p.w); b.y2 = Math.max(b.y2, p.y + p.h); return; }
    if (p.t === 'image') out.push({ k: 'pic', x: p.x, y: p.y, w: p.w, h: p.h });
    else if (p.t === 'line') out.push({ k: 'line', x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2, z });
    else if (p.t === 'text') out.push({ k: 'text', x: p.x, y: p.y, w: p.w, h: p.h, clip: cutOff(p.text, p.w, p.size, p.h) });
    else if (Math.min(p.w, p.h) <= 4) out.push(p.w >= p.h ? { k: 'line', x1: p.x, y1: p.y + p.h / 2, x2: p.x + p.w, y2: p.y + p.h / 2, z } : { k: 'line', x1: p.x + p.w / 2, y1: p.y, x2: p.x + p.w / 2, y2: p.y + p.h, z });
    else {
      out.push({ k: 'shape', g: p.g, x: p.x, y: p.y, w: p.w, h: p.h, outline: !p.fill && !!p.line, z });
      if (p.text) { const r = textRect(p.g, p.x, p.y, p.w, p.h); out.push(Object.assign({ k: 'text', clip: cutOff(p.text, r.w, p.size, r.h) }, r)); }
    }
  });
  Object.values(icons).forEach(b => out.push({ k: 'pic', x: b.x, y: b.y, w: b.x2 - b.x, h: b.y2 - b.y }));
  return out;
}

/* Words of the visual's text in reading order with their positions (for the accuracy check in napkin.js). */
function svgTexts(svgText) {
  const root = cleanSvg(svgText);
  // tspans are separate words or lines ("Data" / "collection"), so they are joined with a space; plain text beside a
  // tspan ("<tspan>Data ingestion:</tspan> databases, APIs") is part of the same text
  return [...root.querySelectorAll('text')].map(t => [...t.childNodes].map(x => x.textContent).join(' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
}
