/* AI Visual Builder 10.8 - suggestion gallery.
   One analysis per section -> one scene -> many visual suggestions built in code (no extra AI calls):
     Engine A  infographic arrangements of the same points (native shapes)
     Engine B  pictorial scenes assembled from native-shape components (database = cylinder, cloud = cloud shape, ...)
     Engine C  charts and data visuals (native shapes)
   Every suggestion is the same primitive list for the preview and for PowerPoint (drawPrim), so they match.
   Loaded after v10.html's scripts; uses their helpers (box, label, txt, card, sizeFor, checkLayout, buildData, ...). */

/* ===================== Native-shape geometry (PowerPoint preset shapes) ===================== */
Object.assign(GEO, { can: 'can', cloud: 'cloud', foldedCorner: 'foldedCorner', gear6: 'gear6', hexagon: 'hexagon',
  shield: 'flowChartOffpageConnector', blockArc: 'blockArc', tab: 'round2SameRectangle', rightBrace: 'rightBrace', donut: 'donut',
  callout: 'wedgeRoundRectCallout', merge: 'flowChartMerge', pill: 'flowChartTerminator',
  plus: 'plus', star5: 'star5', manualOp: 'flowChartManualOperation', rtTriangle: 'rightTriangle', parallelogram: 'parallelogram' });

/* Previews of those presets with PowerPoint's default adjustments, so the preview matches the inserted shape. */
const baseShapeSVG = shapeSVG, baseTextRect = textRect;
shapeSVG = function (p) {
  const { x, y, w, h } = p, m = Math.min(w, h), st = p.line ? ` stroke="${p.line}" stroke-width="${p.lineW || 1.5}"` : '', a = `fill="${p.fill || 'none'}"${st}`;
  const poly = q => `<polygon points="${pts(q)}" ${a}/>`, f = v => +v.toFixed(1);
  switch (p.g) {
    case 'can': { const e = m * 0.125;
      return `<path d="M${f(x)} ${f(y + e)}V${f(y + h - e)}A${f(w / 2)} ${f(e)} 0 0 0 ${f(x + w)} ${f(y + h - e)}V${f(y + e)}Z" ${a}/>` +
        `<ellipse cx="${f(x + w / 2)}" cy="${f(y + e)}" rx="${f(w / 2)}" ry="${f(e)}" fill="${p.fill ? tint(p.fill, 0.3) : 'none'}"${st}/>`; }
    case 'cloud': { const c = [[0.3, 0.62, 0.22], [0.5, 0.38, 0.26], [0.72, 0.55, 0.22], [0.5, 0.68, 0.24], [0.18, 0.7, 0.15], [0.84, 0.72, 0.14]];
      return `<g ${a}>` + c.map(([cx, cy, r]) => `<ellipse cx="${f(x + cx * w)}" cy="${f(y + cy * h)}" rx="${f(r * w)}" ry="${f(r * h * 1.15)}"/>`).join('') + '</g>'; }
    case 'foldedCorner': { const d = m * 0.1667;
      return poly([[x, y], [x + w, y], [x + w, y + h - d], [x + w - d, y + h], [x, y + h]]) + `<polygon points="${pts([[x + w, y + h - d], [x + w - d, y + h - d * 0.8], [x + w - d, y + h]])}" fill="${p.fill ? shade(p.fill, 0.2) : '#ccc'}"/>`; }
    case 'gear6': { const cx = x + w / 2, cy = y + h / 2, ro = m / 2, ri = ro * 0.74, q = [];
      for (let i = 0; i < 6; i++) { const b = i * Math.PI / 3 - Math.PI / 2; [[-0.2, ri], [-0.13, ro], [0.13, ro], [0.2, ri], [0.32, ri], [0.84, ri]].forEach(([d, r]) => q.push([cx + r * Math.cos(b + d), cy + r * Math.sin(b + d)])); }
      return poly(q); }
    case 'hexagon': { const d = m * 0.25; return poly([[x, y + h / 2], [x + d, y], [x + w - d, y], [x + w, y + h / 2], [x + w - d, y + h], [x + d, y + h]]); }
    case 'shield': return poly([[x, y], [x + w, y], [x + w, y + h * 0.8], [x + w / 2, y + h], [x, y + h * 0.8]]);
    case 'blockArc': { const r = w / 2, ri = r - m * 0.25, cx = x + w / 2, cy = y + h / 2;
      return `<path d="M${f(cx - r)} ${f(cy)}A${f(r)} ${f(h / 2)} 0 0 1 ${f(cx + r)} ${f(cy)}H${f(cx + ri)}A${f(ri)} ${f(h / 2 - m * 0.25)} 0 0 0 ${f(cx - ri)} ${f(cy)}Z" ${a}/>`; }
    case 'tab': { const r = m * 0.1667; return `<path d="M${f(x)} ${f(y + h)}V${f(y + r)}Q${f(x)} ${f(y)} ${f(x + r)} ${f(y)}H${f(x + w - r)}Q${f(x + w)} ${f(y)} ${f(x + w)} ${f(y + r)}V${f(y + h)}Z" ${a}/>`; }
    case 'rightBrace': { const d = Math.min(w / 2, h * 0.04);
      return `<path d="M${f(x)} ${f(y)}Q${f(x + w / 2)} ${f(y)} ${f(x + w / 2)} ${f(y + d * 2)}V${f(y + h / 2 - d)}Q${f(x + w / 2)} ${f(y + h / 2)} ${f(x + w)} ${f(y + h / 2)}Q${f(x + w / 2)} ${f(y + h / 2)} ${f(x + w / 2)} ${f(y + h / 2 + d)}V${f(y + h - d * 2)}Q${f(x + w / 2)} ${f(y + h)} ${f(x)} ${f(y + h)}" fill="none" stroke="${p.line || p.fill}" stroke-width="${p.lineW || 3}"/>`; }
    case 'donut': { const t = m * 0.25; return `<path fill-rule="evenodd" d="M${f(x)} ${f(y + h / 2)}a${f(w / 2)} ${f(h / 2)} 0 1 0 ${f(w)} 0a${f(w / 2)} ${f(h / 2)} 0 1 0 ${f(-w)} 0ZM${f(x + t)} ${f(y + h / 2)}a${f(w / 2 - t)} ${f(h / 2 - t)} 0 1 1 ${f(w - 2 * t)} 0a${f(w / 2 - t)} ${f(h / 2 - t)} 0 1 1 ${f(-w + 2 * t)} 0Z" ${a}/>`; }
    case 'callout': { const r = m * 0.1667, tx = x + w * 0.29, ty = y + h * 1.125;
      return `<path d="M${f(x + r)} ${f(y)}H${f(x + w - r)}Q${f(x + w)} ${f(y)} ${f(x + w)} ${f(y + r)}V${f(y + h - r)}Q${f(x + w)} ${f(y + h)} ${f(x + w - r)} ${f(y + h)}H${f(x + w * 0.42)}L${f(tx)} ${f(ty)}L${f(x + w * 0.25)} ${f(y + h)}H${f(x + r)}Q${f(x)} ${f(y + h)} ${f(x)} ${f(y + h - r)}V${f(y + r)}Q${f(x)} ${f(y)} ${f(x + r)} ${f(y)}Z" ${a}/>`; }
    case 'merge': return poly([[x, y], [x + w, y], [x + w / 2, y + h]]);
    case 'pill': return `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(Math.min(h / 2, w / 2))}" ${a}/>`;
    case 'plus': { const d = m * 0.25; return poly([[x + d, y], [x + w - d, y], [x + w - d, y + d], [x + w, y + d], [x + w, y + h - d], [x + w - d, y + h - d], [x + w - d, y + h], [x + d, y + h], [x + d, y + h - d], [x, y + h - d], [x, y + d], [x + d, y + d]]); }
    case 'star5': { const q = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.38 : 1, an = -Math.PI / 2 + i * Math.PI / 5; q.push([x + w / 2 + r * w / 2 * Math.cos(an), y + h * 0.53 + r * h * 0.53 * Math.sin(an)]); } return poly(q); }
    case 'manualOp': return poly([[x, y], [x + w, y], [x + w * 0.8, y + h], [x + w * 0.2, y + h]]);
    case 'rtTriangle': return poly([[x, y], [x, y + h], [x + w, y + h]]);
    case 'parallelogram': { const d = m * 0.25; return poly([[x + d, y], [x + w, y], [x + w - d, y + h], [x, y + h]]); }
    default: return baseShapeSVG(p);
  }
};
/* Preview of the new primitives: native lines (solid or dashed), rotated shapes and dashed outlines. */
const lineSVG = p => `<line x1="${p.x1.toFixed(1)}" y1="${p.y1.toFixed(1)}" x2="${p.x2.toFixed(1)}" y2="${p.y2.toFixed(1)}" stroke="${p.color}" stroke-width="${p.lineW}" stroke-linecap="round"${p.dash ? ' stroke-dasharray="' + (p.lineW * 3) + ' ' + (p.lineW * 2) + '"' : ''}/>`;
toSVG = function (prims, W, H) {
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img"><rect width="${W}" height="${H}" fill="#FFFFFF"/>`;
  for (const p of prims.flatMap(q => q.t === 'table' ? q.cells : [q])) {
    if (p.t === 'image') s += `<image href="${esc(p.href)}" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" preserveAspectRatio="xMidYMid meet"/>`;
    if (p.t === 'line') s += lineSVG(p);
    if (p.t === 'shape') {
      let g = shapeSVG(p);
      if (p.dash) g = g.replace(/stroke-width="([\d.]+)"/g, (m0, v) => `stroke-dasharray="${v * 3} ${v * 2}" ${m0}`);
      s += p.rot ? `<g transform="rotate(${p.rot} ${(p.x + p.w / 2).toFixed(1)} ${(p.y + p.h / 2).toFixed(1)})">${g}</g>` : g;
    }
    if (p.text) s += textSVG(p);
  }
  return s + '</svg>';
};
/* Insertion of the new primitives. A diagonal line is added as a 45-degree line of the same length and turned to its
   angle (Shape.rotation, PowerPointApi 1.10), so every direction is drawn natively; without 1.10 only top-left to
   bottom-right lines are native and the others go into the picture behind the shapes (see nativeOnly). */
const baseDrawPrim = drawPrim;
drawPrim = function (shapes, p) {
  if (p.t === 'line') {
    const dx = p.x2 - p.x1, dy = p.y2 - p.y1, L = Math.hypot(dx, dy);
    let s;
    if (state.canRotate) {
      const k = Math.max(L / Math.SQRT2, 1), cx = (p.x1 + p.x2) / 2, cy = (p.y1 + p.y2) / 2;
      s = shapes.addLine('Straight', { left: r1(cx - k / 2), top: r1(cy - k / 2), width: r1(k), height: r1(k) });
      s.rotation = normDeg(Math.atan2(dy, dx) * 180 / Math.PI - 45);   // PowerPoint takes 0-360 only
    } else s = shapes.addLine('Straight', { left: r1(p.x), top: r1(p.y), width: Math.max(r1(p.w), 1), height: Math.max(r1(p.h), 1) });
    if (p.color) s.lineFormat.color = p.color;
    if (p.lineW) s.lineFormat.weight = p.lineW;
    if (p.dash) s.lineFormat.dashStyle = 'Dash';
    return s;
  }
  const s = baseDrawPrim(shapes, p);
  if (p.dash && p.line) s.lineFormat.dashStyle = 'Dash';
  if (p.rot && state.canRotate) s.rotation = normDeg(p.rot);
  return s;
};
/* Lines and turned shapes this PowerPoint cannot draw natively are moved into one picture behind the shapes (and the
   suggestion is then labeled partially editable). With PowerPointApi 1.10 nothing is moved. */
function nativeOnly(prims) {
  if (!state.inOffice || state.canRotate) return prims;
  const bad = p => (p.t === 'line' && (p.x2 - p.x1) * (p.y2 - p.y1) < 0) || (p.t === 'shape' && p.rot);
  const moved = prims.filter(bad);
  if (!moved.length) return prims;
  const x0 = Math.min(...moved.map(p => p.x)) - 1, y0 = Math.min(...moved.map(p => p.y)) - 1, x1 = Math.max(...moved.map(p => p.x + p.w)) + 1, y1 = Math.max(...moved.map(p => p.y + p.h)) + 1;
  const svg = toSVG(moved, SLIDE.w, SLIDE.h).replace(/<rect width="[^"]*" height="[^"]*" fill="#FFFFFF"\/>/, '').replace(/viewBox="[^"]*"/, `viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}"`);
  return [{ t: 'image', under: true, svg, href: svgDataURL(svg), x: x0, y: y0, w: x1 - x0, h: y1 - y0 }].concat(prims.filter(p => !bad(p)));
}
textRect = function (g, x, y, w, h) {
  switch (g) {
    case 'hexagon': return { x: x + w * 0.2, y, w: w * 0.6, h };
    case 'can': { const e = Math.min(w, h) * 0.25; return { x, y: y + e, w, h: h - e }; }
    case 'pill': return { x: x + h * 0.3, y, w: w - h * 0.6, h };
    default: return baseTextRect(g, x, y, w, h);
  }
};

/* ===================== Native lines (PowerPoint addLine, PowerPointApi 1.4; any direction via rotation, 1.10) =====================
   A line primitive keeps its end points; axis-aligned lines stay thin rectangles (as before). Arrowheads are native triangles
   turned to the line's direction, because PowerPoint's line format has no arrowhead setting in the JavaScript API. */
function seg(x1, y1, x2, y2, color, w, o) {
  w = w || 2;
  if (Math.abs(x2 - x1) < 0.5) return Object.assign(rule(x1 - w / 2, Math.min(y1, y2), w, Math.abs(y2 - y1), color), o);
  if (Math.abs(y2 - y1) < 0.5) return Object.assign(rule(Math.min(x1, x2), y1 - w / 2, Math.abs(x2 - x1), w, color), o);
  return Object.assign({ t: 'line', x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), x1, y1, x2, y2, color, lineW: w }, o);
}
/* A native triangle whose tip is at (x, y), pointing along `deg` (0 = right, 90 = down). */
const headAt = (x, y, deg, size, color) => {
  const a = deg * Math.PI / 180, cx = x - Math.cos(a) * size / 2, cy = y - Math.sin(a) * size / 2;
  return box('triangle', cx - size / 2, cy - size / 2, size, size, { fill: color, rot: Math.round((deg + 90) * 100) / 100 });
};
function arrowSeg(x1, y1, x2, y2, color, w, hs) {
  const deg = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI, a = deg * Math.PI / 180;
  hs = hs || Math.max(14, w * 5);
  return [seg(x1, y1, x2 - Math.cos(a) * hs * 0.8, y2 - Math.sin(a) * hs * 0.8, color, w), headAt(x2, y2, deg, hs, color)];
}
const polyline = (pts, color, w, o) => pts.slice(1).map((p, i) => seg(pts[i][0], pts[i][1], p[0], p[1], color, w, o));

/* ===================== Compound pictorial objects from native shapes =====================
   Each draws inside a square (x, y, s); every part is a separate native shape (or line), grouped per object on insert.
   Colors are the template accents and their tints only. */
const LIGHT = c => tint(c, 0.82), PALE = c => tint(c, 0.92), CORAL = '#E58F6D', GOLD = '#DDB945', WHITE = '#FFFFFF';   // approved palette: coral alert, mustard highlight
function netGlyph(x, y, s, c, layers, d, gap) {
  const out = [], n = layers.length, D = s * (d || 0.13), g = gap || 0.24;
  const pos = layers.map((k, i) => Array.from({ length: k }, (_, j) => [x + s * (0.14 + 0.72 * i / (n - 1)), y + s * (0.5 + (j - (k - 1) / 2) * g)]));
  for (let i = 0; i < n - 1; i++) pos[i].forEach(a => pos[i + 1].forEach(b => out.push(seg(a[0], a[1], b[0], b[1], tint(c, 0.45), Math.max(1.25, s * 0.012)))));
  pos.forEach((col, i) => col.forEach(p => out.push(box('ellipse', p[0] - D / 2, p[1] - D / 2, D, D, { fill: i % 2 ? c : tint(c, 0.3), line: WHITE, lineW: 1.5 }))));
  return out;
}
const CMP = {
  // ---- data, AI and machine learning
  mlcore: (x, y, s, c) => netGlyph(x, y, s, c, [3, 4, 3], 0.13, 0.22),
  train: (x, y, s, c) => netGlyph(x + s * 0.04, y - s * 0.1, s * 0.92, c, [2, 3, 2], 0.14, 0.27)
    .concat([box('roundRect', x + s * 0.14, y + s * 0.8, s * 0.72, s * 0.08, { fill: LIGHT(c) }), box('roundRect', x + s * 0.14, y + s * 0.8, s * 0.5, s * 0.08, { fill: c })]),
  evaluate: (x, y, s, c) => {
    const out = [box('roundRect', x + s * 0.18, y + s * 0.12, s * 0.64, s * 0.82, { fill: WHITE, line: c, lineW: 2.5 }), box('roundRect', x + s * 0.36, y + s * 0.06, s * 0.28, s * 0.12, { fill: c })];
    [0, 1, 2].forEach(i => {
      const cy = y + s * (0.34 + i * 0.19), cx = x + s * 0.32, D = s * 0.12;
      out.push(box('ellipse', cx - D / 2, cy - D / 2, D, D, { fill: i < 2 ? c : WHITE, line: c, lineW: 1.5 }));
      if (i < 2) out.push(...polyline([[cx - D * 0.26, cy], [cx - D * 0.06, cy + D * 0.2], [cx + D * 0.28, cy - D * 0.2]], WHITE, Math.max(1.5, s * 0.018)));
      out.push(box('rect', x + s * 0.44, cy - s * 0.025, s * (0.3 - i * 0.07), s * 0.05, { fill: i < 2 ? tint(c, 0.4) : LIGHT(c) }));
    });
    return out;
  },
  predict: (x, y, s, c) => {
    const P = v => [x + s * v[0], y + s * v[1]], past = [[0.2, 0.7], [0.34, 0.58], [0.48, 0.63], [0.6, 0.45]].map(P), next = [[0.6, 0.45], [0.74, 0.34], [0.86, 0.2]].map(P), w = Math.max(2, s * 0.025);
    return [rule(x + s * 0.12, y + s * 0.12, s * 0.025, s * 0.72, TEMPLATE.line), rule(x + s * 0.12, y + s * 0.82, s * 0.78, s * 0.025, TEMPLATE.line)]
      .concat(polyline(past, c, w), polyline(next, CORAL, w, { dash: true }),
        [box('ellipse', past[3][0] - s * 0.045, past[3][1] - s * 0.045, s * 0.09, s * 0.09, { fill: c }), box('ellipse', next[2][0] - s * 0.06, next[2][1] - s * 0.06, s * 0.12, s * 0.12, { fill: WHITE, line: CORAL, lineW: 2.5 })]);
  },
  clean: (x, y, s, c) => [box('rect', x + s * 0.1, y + s * 0.06, s * 0.8, s * 0.44, { fill: WHITE, line: c, lineW: 2 }), rule(x + s * 0.1, y + s * 0.06, s * 0.8, s * 0.11, c),
    rule(x + s * 0.11, y + s * 0.28, s * 0.78, s * 0.1, tint(CORAL, 0.55)), rule(x + s * 0.1, y + s * 0.27, s * 0.8, s * 0.012, tint(c, 0.4)), rule(x + s * 0.1, y + s * 0.38, s * 0.8, s * 0.012, tint(c, 0.4)),
    rule(x + s * 0.5, y + s * 0.17, s * 0.012, s * 0.33, tint(c, 0.4)),
    box('merge', x + s * 0.28, y + s * 0.56, s * 0.44, s * 0.24, { fill: c }), box('roundRect', x + s * 0.43, y + s * 0.82, s * 0.14, s * 0.12, { fill: tint(c, 0.35) })],
  collect: (x, y, s, c) => {
    const out = [], dbx = x + s * 0.5, dby = y + s * 0.56;
    [[0.08, tint(c, 0.4)], [0.4, c], [0.72, tint(c, 0.4)]].forEach(([dx, col], i) => {
      out.push(box(i === 1 ? 'foldedCorner' : 'roundRect', x + s * dx, y + s * 0.04, s * 0.2, s * 0.22, { fill: col }));
      out.push(...arrowSeg(x + s * (dx + 0.1), y + s * 0.28, dbx + (i - 1) * s * 0.1, dby, TEMPLATE.line, Math.max(1.5, s * 0.02), s * 0.08));
    });
    out.push(box('can', x + s * 0.3, dby, s * 0.4, s * 0.4, { fill: c, line: shade(c, 0.2), lineW: 1.5 }));
    return out;
  },
  features: (x, y, s, c) => [box('rect', x + s * 0.04, y + s * 0.2, s * 0.32, s * 0.6, { fill: WHITE, line: c, lineW: 2 })]
    .concat([0.35, 0.5, 0.65].map(v => rule(x + s * 0.04, y + s * v, s * 0.32, s * 0.012, tint(c, 0.4))), [rule(x + s * 0.2, y + s * 0.2, s * 0.012, s * 0.6, tint(c, 0.4)),
      box('rightArrow', x + s * 0.4, y + s * 0.43, s * 0.16, s * 0.14, { fill: TEMPLATE.line })],
      [c, tint(c, 0.3), tint(c, 0.55)].map((col, i) => box('roundRect', x + s * 0.6, y + s * (0.22 + i * 0.2), s * 0.36, s * 0.15, { fill: col }))),
  deploy: (x, y, s, c) => [box('cloud', x + s * 0.18, y + s * 0.02, s * 0.64, s * 0.38, { fill: c }), box('upArrow', x + s * 0.42, y + s * 0.38, s * 0.16, s * 0.2, { fill: TEMPLATE.line }),
    box('rect', x + s * 0.24, y + s * 0.6, s * 0.52, s * 0.34, { fill: tint(c, 0.35) })]
    .concat(polyline([[0.28, 0.79], [0.4, 0.79], [0.45, 0.68], [0.52, 0.9], [0.57, 0.79], [0.72, 0.79]].map(v => [x + s * v[0], y + s * v[1]]), WHITE, Math.max(2, s * 0.025))),
  problem: (x, y, s, c) => [box('callout', x + s * 0.1, y + s * 0.1, s * 0.8, s * 0.6, { fill: c, text: '?', size: Math.max(20, Math.round(s * 0.34)), bold: true, color: WHITE, align: 'center', valign: 'middle' })],
  // ---- industries and applications
  xray: (x, y, s, c) => {
    const out = [box('roundRect', x + s * 0.14, y + s * 0.04, s * 0.72, s * 0.84, { fill: shade(c, 0.35) }), rule(x + s * 0.485, y + s * 0.14, s * 0.03, s * 0.62, tint(c, 0.75))];
    [0, 1, 2].forEach(i => { const ry = y + s * (0.24 + i * 0.14);
      out.push(box('roundRect', x + s * 0.24, ry, s * 0.23, s * 0.05, { fill: tint(c, 0.6), rot: -14 }), box('roundRect', x + s * 0.53, ry, s * 0.23, s * 0.05, { fill: tint(c, 0.6), rot: 14 })); });
    out.push(rule(x + s * 0.16, y + s * 0.6, s * 0.68, s * 0.025, CORAL), box('ellipse', x + s * 0.62, y + s * 0.66, s * 0.3, s * 0.3, { fill: WHITE, line: CORAL, lineW: 2 }),
      box('plus', x + s * 0.68, y + s * 0.72, s * 0.18, s * 0.18, { fill: CORAL }));
    return out;
  },
  medical: (x, y, s, c) => [box('plus', x + s * 0.22, y + s * 0.06, s * 0.56, s * 0.56, { fill: c })]
    .concat(polyline([[0.08, 0.8], [0.32, 0.8], [0.4, 0.68], [0.5, 0.94], [0.58, 0.8], [0.92, 0.8]].map(v => [x + s * v[0], y + s * v[1]]), CORAL, Math.max(2, s * 0.03))),
  fraud: (x, y, s, c) => [box('roundRect', x + s * 0.04, y + s * 0.16, s * 0.74, s * 0.5, { fill: c }), rule(x + s * 0.04, y + s * 0.26, s * 0.74, s * 0.09, shade(c, 0.4)),
    box('rect', x + s * 0.12, y + s * 0.42, s * 0.12, s * 0.09, { fill: GOLD }), rule(x + s * 0.12, y + s * 0.56, s * 0.3, s * 0.03, tint(c, 0.6)),
    box('triangle', x + s * 0.5, y + s * 0.46, s * 0.46, s * 0.42, { fill: CORAL, line: WHITE, lineW: 2 }), box('rect', x + s * 0.71, y + s * 0.6, s * 0.04, s * 0.14, { fill: WHITE }),
    box('ellipse', x + s * 0.708, y + s * 0.77, s * 0.045, s * 0.045, { fill: WHITE })],
  bank: (x, y, s, c) => [box('triangle', x + s * 0.08, y + s * 0.06, s * 0.84, s * 0.24, { fill: c }), rule(x + s * 0.12, y + s * 0.31, s * 0.76, s * 0.06, c)]
    .concat([0, 1, 2, 3].map(i => rule(x + s * (0.17 + i * 0.18), y + s * 0.41, s * 0.1, s * 0.38, tint(c, 0.3))), [rule(x + s * 0.08, y + s * 0.82, s * 0.84, s * 0.08, c)]),
  cart: (x, y, s, c) => [box('star5', x + s * 0.64, y + s * 0.0, s * 0.28, s * 0.28, { fill: GOLD }), box('manualOp', x + s * 0.22, y + s * 0.3, s * 0.64, s * 0.32, { fill: c })]
    .concat(polyline([[0.04, 0.18], [0.16, 0.18], [0.26, 0.7], [0.8, 0.7]].map(v => [x + s * v[0], y + s * v[1]]), shade(c, 0.25), Math.max(2.5, s * 0.035)),
      [box('ellipse', x + s * 0.28, y + s * 0.76, s * 0.14, s * 0.14, { fill: shade(c, 0.35) }), box('ellipse', x + s * 0.64, y + s * 0.76, s * 0.14, s * 0.14, { fill: shade(c, 0.35) }),
        box('rect', x + s * 0.34, y + s * 0.36, s * 0.12, s * 0.12, { fill: tint(c, 0.6) }), box('rect', x + s * 0.52, y + s * 0.36, s * 0.12, s * 0.12, { fill: tint(c, 0.6) })]),
  car: (x, y, s, c) => [box('ellipse', x + s * 0.02, y + s * 0.14, s * 0.96, s * 0.76, { line: tint(c, 0.35), lineW: 2, dash: true }),
    box('trapezoid', x + s * 0.3, y + s * 0.38, s * 0.4, s * 0.15, { fill: c }), box('roundRect', x + s * 0.14, y + s * 0.52, s * 0.72, s * 0.17, { fill: c }),
    box('rect', x + s * 0.37, y + s * 0.42, s * 0.11, s * 0.08, { fill: WHITE }), box('rect', x + s * 0.52, y + s * 0.42, s * 0.11, s * 0.08, { fill: WHITE }),
    box('ellipse', x + s * 0.22, y + s * 0.62, s * 0.15, s * 0.15, { fill: shade(c, 0.45) }), box('ellipse', x + s * 0.63, y + s * 0.62, s * 0.15, s * 0.15, { fill: shade(c, 0.45) }),
    box('rect', x + s * 0.46, y + s * 0.32, s * 0.08, s * 0.06, { fill: CORAL })]
    .concat(seg(x + s * 0.46, y + s * 0.33, x + s * 0.3, y + s * 0.2, CORAL, Math.max(1.5, s * 0.02), { dash: true }), seg(x + s * 0.54, y + s * 0.33, x + s * 0.7, y + s * 0.2, CORAL, Math.max(1.5, s * 0.02), { dash: true })),
  cyber: (x, y, s, c) => {
    const out = [], P = [[0.14, 0.16], [0.86, 0.16], [0.14, 0.84], [0.86, 0.84]], D = s * 0.16;
    P.forEach(p => out.push(seg(x + s * p[0], y + s * p[1], x + s * 0.5, y + s * 0.5, tint(c, 0.4), Math.max(1.5, s * 0.02))));
    P.forEach((p, i) => out.push(box('ellipse', x + s * p[0] - D / 2, y + s * p[1] - D / 2, D, D, { fill: i === 1 ? CORAL : tint(c, 0.35), line: WHITE, lineW: 1.5 })));
    out.push(box('shield', x + s * 0.3, y + s * 0.24, s * 0.4, s * 0.52, { fill: c, line: WHITE, lineW: 2 }), box('ellipse', x + s * 0.45, y + s * 0.36, s * 0.1, s * 0.1, { fill: WHITE }),
      box('rect', x + s * 0.48, y + s * 0.43, s * 0.04, s * 0.13, { fill: WHITE }));
    return out;
  },
  factory: (x, y, s, c) => [rule(x + s * 0.72, y + s * 0.1, s * 0.1, s * 0.3, shade(c, 0.2))]
    .concat([0, 1, 2].map(i => box('rtTriangle', x + s * (0.06 + i * 0.22), y + s * 0.28, s * 0.22, s * 0.18, { fill: c })),
      [rule(x + s * 0.06, y + s * 0.46, s * 0.86, s * 0.42, c)], [0, 1, 2].map(i => rule(x + s * (0.13 + i * 0.2), y + s * 0.56, s * 0.12, s * 0.1, WHITE)),
      [box('donut', x + s * 0.56, y + s * 0.56, s * 0.3, s * 0.3, { fill: GOLD }), box('ellipse', x + s * 0.635, y + s * 0.635, s * 0.15, s * 0.15, { fill: PALE(GOLD) }),
        seg(x + s * 0.83, y + s * 0.83, x + s * 0.95, y + s * 0.95, GOLD, Math.max(3, s * 0.05))]),
  // ---- general objects (kept from 10.2)
  folder: (x, y, s, c) => [box('tab', x + s * .08, y + s * .2, s * .38, s * .14, { fill: c }), box('roundRect', x + s * .08, y + s * .3, s * .84, s * .56, { fill: c }),
    box('rect', x + s * .16, y + s * .42, s * .68, s * .06, { fill: WHITE })],
  database: (x, y, s, c) => [box('can', x + s * .2, y + s * .06, s * .6, s * .88, { fill: c, line: shade(c, .2), lineW: 1.5 }),
    rule(x + s * .26, y + s * .45, s * .48, s * .025, tint(c, .45)), rule(x + s * .26, y + s * .66, s * .48, s * .025, tint(c, .45))],
  dataset: (x, y, s, c) => [box('rect', x + s * .1, y + s * .18, s * .8, s * .64, { fill: WHITE, line: c, lineW: 2 }), rule(x + s * .1, y + s * .18, s * .8, s * .16, c)]
    .concat([0, 1, 2].map(i => rule(x + s * .1, y + s * (.47 + i * .12), s * .8, s * .015, tint(c, .4))), [rule(x + s * .37, y + s * .34, s * .015, s * .48, tint(c, .4)), rule(x + s * .63, y + s * .34, s * .015, s * .48, tint(c, .4))]),
  server: (x, y, s, c) => [0, 1, 2].flatMap(i => [box('roundRect', x + s * .16, y + s * (.1 + i * .28), s * .68, s * .24, { fill: c, line: shade(c, .2), lineW: 1 }),
    box('ellipse', x + s * .24, y + s * (.18 + i * .28), s * .08, s * .08, { fill: WHITE }), rule(x + s * .44, y + s * (.21 + i * .28), s * .32, s * .03, tint(c, .55))]),
  cloud: (x, y, s, c) => [box('cloud', x + s * .04, y + s * .18, s * .92, s * .64, { fill: c, line: shade(c, .2), lineW: 1.5 })],
  document: (x, y, s, c) => [box('foldedCorner', x + s * .2, y + s * .06, s * .6, s * .88, { fill: WHITE, line: c, lineW: 2 })]
    .concat([0, 1, 2, 3].map(i => rule(x + s * .3, y + s * (.24 + i * .14), s * (i === 3 ? .25 : .4), s * .035, i ? LIGHT(c) : c))),
  gear: (x, y, s, c) => [box('gear6', x + s * .1, y + s * .1, s * .8, s * .8, { fill: c }), box('ellipse', x + s * .38, y + s * .38, s * .24, s * .24, { fill: WHITE })],
  chartUp: (x, y, s, c) => [box('rect', x + s * .1, y + s * .12, s * .8, s * .76, { fill: WHITE, line: tint(c, .4), lineW: 2 })]
    .concat([.25, .45, .7].map((v, i) => box('rect', x + s * (.2 + i * .22), y + s * (.82 - v * .8), s * .14, s * v * .8, { fill: i === 2 ? c : tint(c, .45) })), [rule(x + s * .16, y + s * .82, s * .68, s * .025, TEMPLATE.line)]),
  image: (x, y, s, c) => [box('rect', x + s * .08, y + s * .16, s * .84, s * .68, { fill: PALE(c), line: c, lineW: 2.5 }),
    box('triangle', x + s * .14, y + s * .42, s * .42, s * .36, { fill: c }), box('triangle', x + s * .42, y + s * .5, s * .44, s * .28, { fill: tint(c, .4) }),
    box('ellipse', x + s * .66, y + s * .24, s * .12, s * .12, { fill: GOLD })],
  shield: (x, y, s, c) => [box('shield', x + s * .18, y + s * .08, s * .64, s * .84, { fill: c, line: shade(c, .2), lineW: 1.5 }),
    box('shield', x + s * .3, y + s * .2, s * .4, s * .54, { fill: tint(c, .35) })],
  lock: (x, y, s, c) => [box('blockArc', x + s * .28, y + s * .08, s * .44, s * .5, { fill: shade(c, .1) }), box('roundRect', x + s * .18, y + s * .4, s * .64, s * .5, { fill: c }),
    box('ellipse', x + s * .44, y + s * .55, s * .12, s * .12, { fill: WHITE }), rule(x + s * .48, y + s * .63, s * .04, s * .14, WHITE)],
  org: (x, y, s, c) => [box('rect', x + s * .18, y + s * .14, s * .44, s * .78, { fill: c }), box('rect', x + s * .62, y + s * .42, s * .24, s * .5, { fill: tint(c, .35) })]
    .concat([0, 1, 2].flatMap(r => [0, 1].map(k => box('rect', x + s * (.25 + k * .17), y + s * (.24 + r * .18), s * .1, s * .1, { fill: WHITE }))),
      [box('rect', x + s * .34, y + s * .76, s * .12, s * .16, { fill: WHITE }), box('rect', x + s * .68, y + s * .52, s * .12, s * .1, { fill: WHITE })]),
  sheet: (x, y, s, c) => [box('roundRect', x + s * .12, y + s * .1, s * .76, s * .8, { fill: c }), box('rect', x + s * .2, y + s * .2, s * .6, s * .12, { fill: WHITE })]
    .concat([0, 1, 2].flatMap(r => [0, 1, 2].map(k => box('rect', x + s * (.2 + k * .205), y + s * (.38 + r * .16), s * .18, s * .12, { fill: (r + k) % 2 ? tint(c, .55) : WHITE })))),
  pages: (x, y, s, c) => [box('rect', x + s * .3, y + s * .06, s * .52, s * .66, { fill: tint(c, .45) }), box('rect', x + s * .18, y + s * .18, s * .52, s * .7, { fill: c })]
    .concat([0, 1, 2, 3].map(i => rule(x + s * .26, y + s * (.3 + i * .12), s * (i === 3 ? .22 : .36), s * .04, WHITE))),
  // media outputs (Generative AI: text, images, music, videos, code)
  text: (x, y, s, c) => [box('roundRect', x + s * .12, y + s * .1, s * .76, s * .8, { fill: c }), box('rect', x + s * .28, y + s * .22, s * .44, s * .1, { fill: WHITE }),
    box('rect', x + s * .45, y + s * .22, s * .1, s * .44, { fill: WHITE }), rule(x + s * .28, y + s * .74, s * .44, s * .04, tint(c, .55))],
  music: (x, y, s, c) => [box('ellipse', x + s * .12, y + s * .62, s * .28, s * .22, { fill: c }), box('ellipse', x + s * .56, y + s * .54, s * .28, s * .22, { fill: c }),
    box('rect', x + s * .34, y + s * .18, s * .06, s * .56, { fill: c }), box('rect', x + s * .78, y + s * .1, s * .06, s * .56, { fill: c }), box('rect', x + s * .34, y + s * .1, s * .5, s * .12, { fill: shade(c, .15) })],
  video: (x, y, s, c) => [box('roundRect', x + s * .06, y + s * .18, s * .88, s * .64, { fill: c }), box('triangle', x + s * .38, y + s * .34, s * .3, s * .32, { fill: WHITE, rot: 90 })],
  code: (x, y, s, c) => [box('roundRect', x + s * .06, y + s * .14, s * .88, s * .72, { fill: c }), box('rect', x + s * .06, y + s * .14, s * .88, s * .1, { fill: shade(c, .2) }),
    box('roundRect', x + s * .18, y + s * .42, s * .2, s * .06, { fill: WHITE, rot: -35 }), box('roundRect', x + s * .18, y + s * .57, s * .2, s * .06, { fill: WHITE, rot: 35 }),
    box('roundRect', x + s * .62, y + s * .42, s * .2, s * .06, { fill: WHITE, rot: 35 }), box('roundRect', x + s * .62, y + s * .57, s * .2, s * .06, { fill: WHITE, rot: -35 }),
    box('roundRect', x + s * .41, y + s * .48, s * .18, s * .05, { fill: tint(c, .6), rot: -65 })],
  person: (x, y, s, c) => [box('ellipse', x + s * .35, y + s * .1, s * .3, s * .3, { fill: c }), box('tab', x + s * .22, y + s * .46, s * .56, s * .44, { fill: c })],
  team: (x, y, s, c) => [[.06, .22, tint(c, .4)], [.58, .22, tint(c, .4)], [.32, .12, c]].flatMap(([dx, dy, col]) =>
    [box('ellipse', x + s * (dx + .1), y + s * dy, s * .16, s * .16, { fill: col }), box('tab', x + s * (dx + .03), y + s * (dy + .2), s * .3, s * .3, { fill: col })]),
  monitor: (x, y, s, c) => [box('rect', x + s * .06, y + s * .12, s * .88, s * .58, { fill: PALE(c), line: c, lineW: 2.5 }), box('rect', x + s * .45, y + s * .7, s * .1, s * .12, { fill: c }),
    box('rect', x + s * .3, y + s * .82, s * .4, s * .05, { fill: c })].concat(polyline([[.14, .56], [.32, .56], [.4, .3], [.5, .64], [.58, .4], [.66, .56], [.86, .56]].map(v => [x + s * v[0], y + s * v[1]]), c, Math.max(2, s * .025))),
  app: (x, y, s, c) => [box('roundRect', x + s * .26, y + s * .06, s * .48, s * .88, { fill: WHITE, line: c, lineW: 3 }), box('rect', x + s * .32, y + s * .16, s * .36, s * .1, { fill: c }),
    box('rect', x + s * .32, y + s * .32, s * .36, s * .2, { fill: LIGHT(c) }), box('rect', x + s * .32, y + s * .56, s * .16, s * .16, { fill: LIGHT(c) }),
    box('rect', x + s * .52, y + s * .56, s * .16, s * .16, { fill: LIGHT(c) }), box('ellipse', x + s * .46, y + s * .8, s * .08, s * .08, { fill: c })],
  gateway: (x, y, s, c) => [box('hexagon', x + s * .06, y + s * .18, s * .88, s * .64, { fill: c }),
    box('rightArrow', x + s * .3, y + s * .32, s * .4, s * .14, { fill: WHITE }), box('leftArrow', x + s * .3, y + s * .54, s * .4, s * .14, { fill: tint(c, .55) })],
  checklist: (x, y, s, c) => [box('rect', x + s * .16, y + s * .06, s * .68, s * .88, { fill: WHITE, line: c, lineW: 2 })]
    .concat([0, 1, 2].flatMap(i => [box('rect', x + s * .26, y + s * (.2 + i * .24), s * .12, s * .12, { fill: i < 2 ? c : WHITE, line: c, lineW: 1.5 }), rule(x + s * .46, y + s * (.25 + i * .24), s * .3, s * .03, LIGHT(c))])),
  target: (x, y, s, c) => [box('ellipse', x + s * .08, y + s * .08, s * .84, s * .84, { fill: LIGHT(c) }), box('ellipse', x + s * .22, y + s * .22, s * .56, s * .56, { fill: WHITE }),
    box('ellipse', x + s * .36, y + s * .36, s * .28, s * .28, { fill: c })],
  flag: (x, y, s, c) => [rule(x + s * .24, y + s * .08, s * .05, s * .84, TEMPLATE.line), box('rect', x + s * .29, y + s * .1, s * .5, s * .32, { fill: c }), box('rect', x + s * .14, y + s * .88, s * .26, s * .05, { fill: TEMPLATE.line })],
  calendar: (x, y, s, c) => [box('rect', x + s * .1, y + s * .14, s * .8, s * .74, { fill: WHITE, line: c, lineW: 2 }), box('rect', x + s * .1, y + s * .14, s * .8, s * .18, { fill: c })]
    .concat([0, 1, 2, 3, 4, 5].map(i => box('rect', x + s * (.2 + (i % 3) * .22), y + s * (.42 + Math.floor(i / 3) * .2), s * .14, s * .12, { fill: i === 4 ? c : LIGHT(c) }))),
  warning: (x, y, s, c) => [box('triangle', x + s * .08, y + s * .1, s * .84, s * .78, { fill: c }), box('rect', x + s * .46, y + s * .36, s * .08, s * .26, { fill: WHITE }), box('ellipse', x + s * .455, y + s * .68, s * .09, s * .09, { fill: WHITE })],
  chat: (x, y, s, c) => [box('callout', x + s * .08, y + s * .12, s * .84, s * .58, { fill: c })].concat([0, 1, 2].map(i => box('ellipse', x + s * (.3 + i * .15), y + s * .36, s * .1, s * .1, { fill: WHITE }))),
  magnifier: (x, y, s, c) => [seg(x + s * .6, y + s * .6, x + s * .88, y + s * .88, TEMPLATE.line, Math.max(3, s * .07)), box('donut', x + s * .08, y + s * .08, s * .6, s * .6, { fill: c }), box('ellipse', x + s * .23, y + s * .23, s * .3, s * .3, { fill: PALE(c) })],
  bulb: (x, y, s, c) => [box('ellipse', x + s * .24, y + s * .06, s * .52, s * .52, { fill: c }), box('rect', x + s * .38, y + s * .56, s * .24, s * .14, { fill: tint(c, .3) }),
    box('rect', x + s * .38, y + s * .72, s * .24, s * .06, { fill: TEMPLATE.line }), box('rect', x + s * .41, y + s * .8, s * .18, s * .06, { fill: TEMPLATE.line })],
  coin: (x, y, s, c) => [box('ellipse', x + s * .12, y + s * .2, s * .64, s * .64, { fill: shade(c, .15) }), box('ellipse', x + s * .24, y + s * .12, s * .64, s * .64, { fill: c }), box('donut', x + s * .36, y + s * .24, s * .4, s * .4, { fill: tint(c, .4) })],
  filter: (x, y, s, c) => [box('merge', x + s * .1, y + s * .12, s * .8, s * .5, { fill: c }), box('rect', x + s * .42, y + s * .6, s * .16, s * .28, { fill: shade(c, .15) })],
  window: (x, y, s, c) => [box('rect', x + s * .06, y + s * .14, s * .88, s * .72, { fill: WHITE, line: c, lineW: 2.5 }), box('rect', x + s * .06, y + s * .14, s * .88, s * .14, { fill: c }),
    box('rect', x + s * .14, y + s * .38, s * .3, s * .38, { fill: LIGHT(c) }), rule(x + s * .52, y + s * .42, s * .32, s * .04, LIGHT(c)), rule(x + s * .52, y + s * .54, s * .32, s * .04, LIGHT(c)), rule(x + s * .52, y + s * .66, s * .22, s * .04, LIGHT(c))],
  milestone: (x, y, s, c) => [rule(x + s * .06, y + s * .48, s * .88, s * .04, TEMPLATE.line), box('diamond', x + s * .3, y + s * .26, s * .4, s * .48, { fill: c })],
  // ---- learning, facts and everyday subjects (V10.8)
  book: (x, y, s, c) => [box('rect', x + s * .06, y + s * .2, s * .42, s * .62, { fill: c }), box('rect', x + s * .52, y + s * .2, s * .42, s * .62, { fill: tint(c, .35) }),
    rule(x + s * .48, y + s * .16, s * .04, s * .7, shade(c, .25))].concat([0, 1, 2].flatMap(i => [rule(x + s * .13, y + s * (.34 + i * .13), s * .28, s * .035, WHITE), rule(x + s * .59, y + s * (.34 + i * .13), s * .28, s * .035, WHITE)])),
  cap: (x, y, s, c) => [box('trapezoid', x + s * .28, y + s * .4, s * .44, s * .26, { fill: shade(c, .15) }), box('diamond', x + s * .04, y + s * .14, s * .92, s * .4, { fill: c }),
    rule(x + s * .8, y + s * .34, s * .03, s * .36, GOLD), box('ellipse', x + s * .775, y + s * .68, s * .08, s * .08, { fill: GOLD })],
  fingerprint: (x, y, s, c) => [0, 1, 2, 3].map(i => box('ellipse', x + s * (.18 + i * .09), y + s * (.08 + i * .11), s * (.64 - i * .18), s * (.84 - i * .22), { line: i % 2 ? tint(c, .3) : c, lineW: Math.max(2, s * .045) }))
    .concat([rule(x + s * .49, y + s * .5, s * .035, s * .22, c)]),
  globe: (x, y, s, c) => [box('ellipse', x + s * .14, y + s * .2, s * .66, s * .66, { fill: c }), box('ellipse', x + s * .33, y + s * .2, s * .28, s * .66, { line: WHITE, lineW: Math.max(1.5, s * .025) }),
    rule(x + s * .14, y + s * .52, s * .66, s * .025, WHITE), rule(x + s * .2, y + s * .36, s * .54, s * .02, tint(c, .5)), rule(x + s * .2, y + s * .68, s * .54, s * .02, tint(c, .5)),
    box('blockArc', x + s * .06, y + s * .04, s * .82, s * .82, { fill: GOLD }), headAt(x + s * .9, y + s * .45, 90, s * .16, GOLD)],
  bowl: (x, y, s, c) => [box('ellipse', x + s * .3, y + s * .2, s * .16, s * .16, { fill: GOLD }), box('ellipse', x + s * .46, y + s * .16, s * .18, s * .18, { fill: tint(GOLD, .3) }),
    box('ellipse', x + s * .58, y + s * .24, s * .14, s * .14, { fill: GOLD }), box('ellipse', x + s * .06, y + s * .34, s * .88, s * .16, { fill: shade(c, .15) }),
    box('manualOp', x + s * .1, y + s * .42, s * .8, s * .38, { fill: c }), box('rect', x + s * .36, y + s * .8, s * .28, s * .07, { fill: shade(c, .2) })],
  info: (x, y, s, c) => [box('ellipse', x + s * .08, y + s * .08, s * .84, s * .84, { fill: c }), box('ellipse', x + s * .44, y + s * .22, s * .12, s * .12, { fill: WHITE }),
    box('rect', x + s * .44, y + s * .4, s * .12, s * .36, { fill: WHITE })],
  access: (x, y, s, c) => [box('ellipse', x + s * .06, y + s * .06, s * .88, s * .88, { fill: c }), box('ellipse', x + s * .42, y + s * .16, s * .16, s * .16, { fill: WHITE }),
    rule(x + s * .22, y + s * .36, s * .56, s * .07, WHITE), rule(x + s * .46, y + s * .36, s * .08, s * .26, WHITE),
    box('rect', x + s * .38, y + s * .6, s * .08, s * .24, { fill: WHITE }), box('rect', x + s * .54, y + s * .6, s * .08, s * .24, { fill: WHITE })],
  spark: (x, y, s, c) => [box('star5', x + s * .12, y + s * .1, s * .76, s * .76, { fill: c }), box('star5', x + s * .72, y + s * .02, s * .22, s * .22, { fill: GOLD }),
    box('star5', x + s * .04, y + s * .7, s * .18, s * .18, { fill: tint(c, .4) })],
  profile: (x, y, s, c) => [box('ellipse', x + s * .3, y + s * .1, s * .32, s * .32, { fill: c }), box('tab', x + s * .16, y + s * .48, s * .6, s * .42, { fill: c }),
    box('star5', x + s * .66, y + s * .5, s * .3, s * .3, { fill: GOLD })],
  shapes: (x, y, s, c) => [box('ellipse', x + s * .08, y + s * .1, s * .4, s * .4, { fill: c }), box('triangle', x + s * .52, y + s * .1, s * .42, s * .4, { fill: tint(c, .35) }),
    box('rect', x + s * .1, y + s * .56, s * .36, s * .36, { fill: tint(c, .35) }), box('hexagon', x + s * .52, y + s * .56, s * .42, s * .36, { fill: c })],
  // neutral marker for a point no catalog object depicts accurately (never a stand-in picture)
  none: (x, y, s, c) => [box('ellipse', x + s * .2, y + s * .2, s * .6, s * .6, { fill: LIGHT(c), line: c, lineW: 2 }), box('ellipse', x + s * .4, y + s * .4, s * .2, s * .2, { fill: c })],
};
CMP.network = CMP.mlcore;

/* ===================== Concept catalog: what each object depicts, reviewed by hand =====================
   [object, name, strong terms, weak terms]. Terms are whole words or phrases (regex fragments, * = word ending), never
   substrings. Specific concepts come first so ties go to them. Each point is matched on its own label (weight 3) and
   description (weight 1) - never on the title or the other points. */
const CATALOG = [
  ['fingerprint', 'Fingerprint', 'fingerprints? | biometric* | identical twins? | twins?'],
  ['globe', 'Earth with rotation', "earth(?:['’]s)? | planets? | globes? | earth['’]s rotation | rotation of the earth | day length | length of a day", 'world | global | rotat*'],
  ['bowl', 'Food bowl', 'pasta | foods? | meals? | starch | nutrition | diet* | cooking | recipes? | gut health | blood sugar', 'eat* | cook*'],
  ['cap', 'Graduation cap', 'graduat* | degrees? | universit(?:y|ies) | academic* | colleges? | diplomas?'],
  ['book', 'Learning resources', 'educational content | education* | educators? | teach* | textbooks? | lectures? | lessons? | courses? | curricul* | instruction* | study | studying | learning materials?', 'learning'],
  ['xray', 'Medical scan analysis', 'medical diagnos* | diagnos* | x-rays? | radiolog* | medical imag* | mri | ct scans? | medical scans? | tumou?rs? | pathology'],
  ['medical', 'Healthcare', 'health ?care | medical | medicine | hospitals? | patients? | clinical | clinics? | doctors? | nursing | diseases? | drug discovery'],
  ['fraud', 'Suspicious transaction alert', 'fraud detection | fraud* | suspicious | money laundering | anomaly detection | chargebacks?'],
  ['bank', 'Banking and finance', 'banking | banks? | financ* | fintech | credit | loans? | payments? | transactions? | trading | insurance', 'money'],
  ['cart', 'Shopping and recommendations', 'e-?commerce | retail* | shopping | online stores? | carts? | recommendation* | recommender* | checkout | purchases?'],
  ['car', 'Car with sensors', 'autonomous vehicles? | self-driving | driverless | autonomous driving | vehicles? | cars? | automotive | lidar | adas | transportation'],
  ['cyber', 'Network threat detection', 'cyber ?security | cyber | threat detection | threats? | intrusion* | malware | network security | attacks? | phishing | ransomware'],
  ['factory', 'Industrial inspection', 'manufactur* | factor(?:y|ies) | industrial | industry 4\\.0 | production lines? | assembly | predictive maintenance | quality inspection | defects? | machinery'],
  ['problem', 'Problem definition', 'problem definition | problem statement | define the problem | business problem | problems? | use cases? | scop(?:e|ing)', 'objectives? | questions?'],
  ['collect', 'Data collection', 'data collection | collect* | gather* | ingest* | data acquisition | data sources? | raw data | sourcing | data capture'],
  ['clean', 'Data cleaning', 'data cleaning | clean* | transform* | standardi[sz]* | preprocess* | pre-process* | data preparation | prepar(?:e|ing) the data | wrangl* | missing values? | duplicates? | outliers? | normali[sz]*'],
  ['features', 'Feature engineering', 'feature engineering | feature selection | feature extraction | features? | encoding', 'variables?'],
  ['train', 'Model training', 'model training | model selection | train* | fitting | algorithms? | hyperparameters? | learns?'],
  ['evaluate', 'Model evaluation', 'model evaluation | evaluat* | assess* | validat* | accuracy | precision | recall | metrics? | testing | tests? | tuning | benchmark*'],
  ['predict', 'Prediction output', 'predict* | inference | forecast* | projections?', 'outputs? | outcomes? | results?'],
  ['deploy', 'Deployment', 'deploy* | production | releas* | rollouts? | go-live | launch* | serving'],
  ['mlcore', 'Machine learning model', 'machine learning | neural networks? | deep learning | artificial intelligence | ai | ml | generative ai', 'models?'],
  ['text', 'Text', 'texts? | written content | writing | copywriting | essays? | stories | poems?'],
  ['music', 'Music', 'music | songs? | audio | sounds? | melod(?:y|ies) | soundtracks?'],
  ['video', 'Video', 'videos? | films? | movies? | animations? | clips?'],
  ['code', 'Code', 'code | coding | source code | programming | programs? | scripts? | software code'],
  ['image', 'Image recognition', 'image* | computer vision | vision | photos? | cameras? | object detection | facial | face recognition | pictures?'],
  ['chat', 'Communication', 'prompts? | prompting | natural language | nlp | chatbots? | speech | language models? | llms? | translation | sentiment | communicat* | messag* | chat | feedback | meetings? | emails? | notif* | discuss*'],
  ['cloud', 'Cloud', 'cloud*'],
  ['gateway', 'API gateway', 'api gateways? | apis? | gateways? | endpoints? | integrations?'],
  ['database', 'Database', 'databases? | sql | storage | data warehouses? | warehouses? | data lakes? | repositor*'],
  ['folder', 'Files', 'files? | folders? | file shares? | directories'],
  ['dataset', 'Dataset', 'datasets? | data sets? | records | tables? | semantic models?', 'data'],
  ['server', 'Server', 'servers? | back-?end | backend services? | microservices? | services? | compute | hosting'],
  ['app', 'Application', 'mobile | smartphones? | apps? | client apps? | front-?end | browsers? | web apps? | user interface', 'applications?'],
  ['window', 'Web page / system', 'websites? | web pages? | portals?', 'systems?'],
  ['shield', 'Security', 'secur* | governance | protect* | safety | defen[cs]e* | firewalls? | guard*'],
  ['lock', 'Access control', 'access control | access | authent* | passwords? | encrypt* | privacy | permissions? | credentials?'],
  ['chartUp', 'Analytics chart', 'analytics | insights? | trends? | growth | statistics | performance'],
  ['monitor', 'Monitoring dashboard', 'monitor* | dashboards? | reporting | observab* | visuali[sz]*'],
  ['team', 'Team', 'stakeholders? | teams? | people | staff | customers? | employees? | learners? | students? | users? | community'],
  ['person', 'Person', 'managers? | owners? | leaders? | individuals? | persons? | sponsors?'],
  ['sheet', 'Workbook / spreadsheet', 'workbooks? | spreadsheets? | excel | worksheets? | sheets?'],
  ['pages', 'Paginated / printable report', 'paginated | printable | print(?:ing|ed|outs?)? | pdfs? | multi-page'],
  ['org', 'Organization', 'compan(?:y|ies) | organi[sz]ations? | developers? | vendors? | firms? | corporations? | startups? | enterprises? | manufacturers? | publishers? | creators? | founders? | makers? | producers? | builders? | designers? | inventors? | maintainers? | operators? | acquirers?'],
  ['warning', 'Risk / warning', 'risks? | issues? | incidents? | warnings? | alerts? | errors? | failures?'],
  ['milestone', 'Milestone', 'milestones? | deliverables?'],
  ['flag', 'Goal', 'goals? | targets? | objectives? | kpis?'],
  ['calendar', 'Schedule', 'schedul* | deadlines? | timelines? | calendar | planning | plans?'],
  ['document', 'Document', 'documents? | logs? | logging | documentation | polic(?:y|ies) | charter | contracts? | specifications? | guidelines? | articles? | reports?'],
  ['checklist', 'Checklist', 'checklists? | verif* | complian* | audits? | reviews? | quality assurance | approv*'],
  ['filter', 'Filter', 'filter* | sorting | screening | selection'],
  ['magnifier', 'Search / investigation', 'search* | investigat* | discover* | explor* | research | analy[sz]* | inspect*'],
  ['bulb', 'Idea', 'ideas? | innovat* | concepts? | creativ* | brainstorm*'],
  ['coin', 'Cost / money', 'costs? | budget* | pric(?:e|es|ing) | revenue | profit* | invest* | sales | savings? | roi'],
  ['gear', 'Process / automation', 'automat* | orchestrat* | process(?:es|ing)? | operations? | workflows? | pipelines? | maintenance | configur*', 'engineering'],
  ['info', 'Information', 'informational | informative | information | quick facts | facts?'],
  ['access', 'Accessibility', 'accessib* | inclusiv* | disabilit*'],
  ['spark', 'Engagement and inspiration', 'engag* | inspir* | motivat* | encourag*'],
  ['profile', 'Personalized for each person', 'personali[sz]* | tailored | individual needs | each learner | custom*'],
  ['shapes', 'Versatility', 'versatil* | flexib* | adaptab* | variety | diverse'],
].map(([key, name, strong, weak]) => {
  const terms = (list, w) => (list || '').split(' | ').map(t => t.trim()).filter(Boolean).map(t => ({
    re: new RegExp('(?:^|[^\\w-])' + t.replace(/\*/g, '\\w*') + '(?![\\w])', 'i'), w: w * (/\s|\\s| \?/.test(t) ? 1.5 : 1), t }));
  return { key, name, terms: terms(strong, 2).concat(terms(weak, 1)) };
});
const CMP_NAMES = Object.fromEntries(CATALOG.map(c => [c.key, c.name]).concat([['none', 'Point marker'], ['network', 'Machine learning model']]));

function conceptScores(label, detail) {
  return CATALOG.map((c, order) => {
    let s = 0, hits = [];
    c.terms.forEach(t => { if (t.re.test(label)) { s += 3 * t.w; hits.push(t.t); } else if (detail && t.re.test(detail)) { s += t.w; hits.push(t.t); } });
    return { key: c.key, name: c.name, score: s, hits, order };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score || a.order - b.order);
}
/* Objects for the points of one visual: each from its own point. A point that matches nothing (or only weakly) gets the
   neutral marker, never another point's or the title's object. Two points get the same object only when nothing else fits. */
function iconsFor(items) {
  const used = new Set();
  return items.map(it => {
    const sc = conceptScores(it.label || '', it.detail || ''), best = sc[0];
    if (!best || best.score < 3) return { key: 'none', matched: false, name: 'Point marker', why: 'no catalog object depicts this point' };
    let pick = best;
    if (used.has(best.key)) { const alt = sc.find(x => !used.has(x.key) && x.score >= 3 && x.score >= best.score * 0.6); if (alt) pick = alt; }
    used.add(pick.key);
    return { key: pick.key, matched: true, name: pick.name, why: pick.hits.join(', '), score: pick.score };
  });
}
/* A component as a group of shapes; returns primitives tagged with the group id, its name and the object key. */
let grpSeq = 0;
function comp(key, x, y, s, c, name) {
  const g = 'g' + (++grpSeq), nm = name || CMP_NAMES[key];
  return (CMP[key] || CMP.none)(x, y, s, c).map(p => Object.assign(p, { grp: g, grpName: nm, cmp: key }));
}

/* The points of a list, without its framing: the title repeated as a line, and introductory or explanatory sentences
   ("The workflow consists of five stages.") among short labels. They go to sc.intro: context, not points to draw or to
   require in a Napkin result. Built-in suggestions and the Napkin check both read sc.items, so both use the same points. */
const wordCount = t => (String(t).match(/[A-Za-z0-9]+/g) || []).length;
const sentenceLike = it => !it.detail && (/[:.!?]$/.test(it.label.trim()) && wordCount(it.label) >= 4 ||
  /\b(?:consists?|includes?|involves?|contains?|describes?|explains?|follows?|has|have|are|is)\b.*\b(?:stages?|steps?|phases?|parts?|types?|categories|components?|following)\b/i.test(it.label) && wordCount(it.label) >= 5);
// A clause after a point that only says when or why ("Code when you ask it to"): context, not part of the label.
const LABEL_CLAUSE = /\s+(?:when|whenever|if|once|because|unless|until|so that|in order to|on demand|on request|upon request)\b.*$/i;
// A lead-in before the first point of a sentence list ("It can produce text"): not part of the label.
const LEAD_IN = /^(?:(?:it|they|this|these|we|you|ai|the \w+)\s+)?(?:can|could|may|will|is able to|are able to)?\s*(?:produce|produces|create|creates|generate|generates|make|makes|write|writes|include|includes|such as|like)\s+/i;
// A section heading inside a list ("How It Works", "More Quick Facts" between described points): it organizes the
// content, it is not a point. Known heading phrases, or a short line in title case without a closing full stop.
const titleCaseLine = t => { const w = String(t).trim().replace(/:$/, '').split(/\s+/).filter(x => !/^(?:a|an|the|of|and|or|to|in|on|for|with|by|at|vs\.?)$/i.test(x));
  return w.length >= 2 && !/[.!?,;]$/.test(String(t).trim()) && w.every(x => /^[A-Z0-9]/.test(x)); };
const HEADING = /^(?:(?:how|what|why|when|where|who|which)\b.*|.*\?|(?:key |main |core )?(?:overview|introduction|summary|background|examples?|details|features|benefits|advantages|components|concepts|types|applications|use cases|steps|process|stages|elements|basics|fundamentals)\s*:?)$/i;
const TITLE_WORDS = /\b(?:workflow|process|lifecycle|life cycle|pipeline|stages|steps|phases|types|kinds|categories|components|overview|framework|methodology|roadmap|applications|benefits|features|principles|content)\b/i;
/* Labels of a list without a trailing "when/if ..." clause and without a lead-in before the first one ("It can produce
   text, images ..." -> "Text"); null entries (points with a description) are left alone. */
function cleanLabels(labels) {
  const short = labels.filter(t => t != null && wordCount(t) <= 3).length >= labels.length - 1;
  return labels.map((t0, i) => {
    if (t0 == null) return t0;
    let t = t0;
    const c = LABEL_CLAUSE.exec(t);
    if (c && c.index > 0 && wordCount(t.slice(0, c.index)) <= 4) t = t.slice(0, c.index);
    const rest = t.replace(LEAD_IN, '');
    if (i === 0 && short && rest !== t && wordCount(rest) >= 1 && wordCount(rest) <= 4) t = rest;
    return t === t0 ? t0 : t.charAt(0).toUpperCase() + t.slice(1);
  });
}
/* The same clean labels in the model itself, so every view (also the base view) shows what the gallery and the
   Napkin check use. */
function cleanModelLabels(m) {
  const d = m && m.data;
  if (d && Array.isArray(d.items) && d.items.every(t => typeof t === 'string')) {
    const plain = d.items.map(t => /^[^:]{2,60}:\s+\S/.test(t) || /\s[–—-]\s/.test(t) ? null : t);
    cleanLabels(plain).forEach((t, i) => { if (t != null) d.items[i] = t; });
  }
  if (m && Array.isArray(m.nodes) && m.nodes.length >= 2) cleanLabels(m.nodes.map(n => n.detail ? null : n.label)).forEach((t, i) => { if (t != null) m.nodes[i].label = t; });
  return m;
}
function contentPoints(sc, untitled) {
  const norm = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(), topic = norm(sc.topic);
  const intro = [], keep = [], headings = [], described = sc.items.filter(it => it.detail).length;
  sc.items.forEach((it, i) => {
    if (it.detail) return keep.push(it);
    // a heading among described points: no description of its own, phrased as a section heading
    if (described >= 2 && described >= (sc.items.length - 1) * 0.6 && wordCount(it.label) <= 5 && (HEADING.test(it.label.trim()) || titleCaseLine(it.label))) { headings.push(it.label); return intro.push(it.label); }
    if (topic && norm(it.label) === topic) return intro.push(it.label);
    // a title line without a blank line after it: "Machine learning workflow" above the stages
    if (i === 0 && untitled && sc.items.length >= 4 && wordCount(it.label) <= 6 && TITLE_WORDS.test(it.label) && !/[.!?]$/.test(it.label)) { sc.topic = it.label.replace(/:$/, ''); return intro.push(it.label); }
    // "... in five stages: Data collection" (an introduction joined to the first point)
    const c = /^(.+?\b(?:stages?|steps?|phases?|parts?|types?|categories|components?|following)\b[^:]*):\s*(\S.*)$/i.exec(it.label);
    if (c && wordCount(c[1]) >= 4 && wordCount(c[2]) <= 5) { intro.push(c[1] + ':'); return keep.push(Object.assign({}, it, { label: c[2] })); }
    keep.push(it);
  });
  // only the first or the last line can introduce or close the list; a long step in the middle is still a step
  const framing = (it, i) => (i === 0 || i === keep.length - 1) && sentenceLike(it);
  // labels without the clause after them or the lead-in before the first one (the removed words stay as context)
  cleanLabels(keep.map(it => it.detail ? null : it.label)).forEach((t, i) => {
    if (t != null && t !== keep[i].label) { intro.push(keep[i].label); keep[i] = Object.assign({}, keep[i], { label: t, context: keep[i].label }); }
  });
  const labels = keep.filter((it, i) => !framing(it, i));
  if (labels.length >= 2 && labels.length >= (keep.length - labels.length) * 2) keep.filter(framing).forEach(it => intro.push(it.label));
  else labels.splice(0, labels.length, ...keep);
  if (labels.length >= 2 && intro.length) { sc.items = labels; sc.intro = intro.filter(t => !keep.some(it => it.context === t)); sc.headings = headings; }
}

/* Explanatory prose read as points (whole sentences, a "What is ...?" line) becomes the ideas it states (understand.js
   conceptModel): short labels in the text's words, each with the sentence it comes from; the definition and the other
   sentences stay with the scene (sc.definition, sc.intro). No order is invented: prose is never a sequence. */
const proseLike = it => !it.detail && (wordCount(it.label) >= 12 || /\?\s*$/.test(it.label) || sentenceLike(it));
function proseScene(sc, s) {
  if (sc.ordered || sc.items.filter(proseLike).length < Math.max(1, Math.ceil(sc.items.length / 2))) return;
  const cm = conceptModel(s.text, s.heading);
  if (!cm) return;
  sc.items = cm.concepts.map((c, i) => ({ id: 'k' + i, label: c.label, detail: '', source: c.source, members: c.members }));
  sc.topic = cm.topic || sc.topic; sc.definition = cm.definition; sc.intro = cm.context; sc.prose = true; sc.headings = [];
}

/* ===================== Scene: the one structure all suggestions are built from ===================== */
function sceneOf(s) {
  const m = s.model;
  if (!m || m.type === 'none' || m.type === 'illustration') return null;
  // The topic is shown in several layouts, so it must come from the text: the section heading, or an AI topic whose words are all in it.
  const aiTopic = sourceCase([m.title, m.topic].find(t => t && groundedness(t, s.text) >= 0.99) || '', s.text);
  const sc = { topic: s.heading || (m.source === 'structure' ? m.topic : aiTopic) || '', text: s.text, items: [], ordered: false, cycle: false, compare: false, edges: [], groups: [], mode: 'fixed', model: m };
  if (/^(?:relation|definition|statement)$/.test(m.type)) return statementScene(sc, m);     // understand.js
  sc.record = recordModel(s.heading ? s.heading + '\n' + s.text : s.text);                 // labelled values (understand.js)
  if (m.source === 'structure') {
    const d = m.data || {};
    if (d.items) { sc.mode = 'items'; sc.items = listNodes(d.items); sc.ordered = !!d.ordered || m.kind === 'checklist'; sc.checklist = m.kind === 'checklist'; }
    else if (d.bars && d.bars.values.length >= 2) { sc.mode = 'data'; sc.data = d; }
    else if (d.kpis && d.kpis.length >= 2) { sc.mode = 'data'; sc.data = d; }
  } else {
    const n = m.nodes.length, G = m.groups.filter(g => m.nodes.some(x => x.group === g));
    const chain = n >= 2 && m.edges.length === n - 1 && orderedNodes(m).length === n && !branching(m) && new Set(m.edges.map(e => e.from)).size === n - 1;
    sc.edges = m.edges; sc.groups = G;
    if (/comparison|problem_solution/.test(m.type) && G.length >= 2) {
      sc.mode = 'items'; sc.compare = true; sc.items = G.slice(0, 4).map((g, i) => ({ id: 'g' + i, label: g, detail: m.nodes.filter(x => x.group === g).map(x => x.label).join('; ') }));
    } else if (!m.edges.length || chain || /process_diagram|cycle_diagram|timeline|funnel|checklist|hub_and_spoke|key_message/.test(m.type) && !branching(m)) {
      sc.mode = 'items'; sc.items = (chain || m.edges.length ? orderedNodes(m) : m.nodes).map(x => ({ id: x.id, label: x.label, detail: x.detail }));
      sc.ordered = chain || /process_diagram|timeline|funnel|cycle_diagram|swimlane/.test(m.type) && (m.edges.length > 0 || m.ordered);
      sc.cycle = m.type === 'cycle_diagram';
    } else sc.mode = 'graph';
  }
  if (sc.mode === 'items' && !sc.compare) contentPoints(sc, !s.heading);
  if (sc.mode === 'items' && !sc.compare) proseScene(sc, s);
  sc.n = sc.items.length;
  if (sc.mode === 'items' && (sc.n < 2 || sc.n > 10)) sc.mode = sc.n > 10 ? 'fixed' : sc.mode;
  sc.icons = iconsFor(sc.mode === 'graph' ? m.nodes : sc.items);
  sc.iconsOK = sc.icons.length > 0 && sc.icons.every(i => i.matched);
  // The central object depicts the topic itself (e.g. "ML applications" -> machine learning model); if the topic names
  // nothing in the catalog, the center shows the topic's words instead of a guessed object.
  const byTopic = sc.topic ? iconsFor([{ label: sc.topic }])[0] : null;
  sc.domainIcon = byTopic && byTopic.matched ? byTopic : null;
  sc.longDetail = sc.items.some(it => it.detail && it.detail.length > 60);
  return sc;
}

/* ===================== Shared drawing helpers ===================== */
const num2 = i => String(i + 1).padStart(2, '0');
const DETAIL_MIN = TEMPLATE.minBody;   // a description is shown only when it fits at 22 pt or more; otherwise it goes to a detail slide
/* Bold label with its description underneath, sized to the box. A description that would need less than 22 pt is left
   out of the overview (counted, and offered as detail slides) instead of being shrunk. */
function labelBlock(x, y, w, h, it, o) {
  o = o || {};
  const al = o.align || 'center', col = o.color || INK, lh = Math.min(Math.max(h * 0.4, 36), 90);
  const show = it.detail && h >= TEMPLATE.minBody * 4 && fitsAt(it.detail, w, h - lh - 2, DETAIL_MIN);
  if (it.detail && !show) detailsHidden++;
  if (!show) return [txt(x, y, w, h, it.label, o.max || 26, { bold: true, align: al, color: col, valign: o.valign || 'middle' })];
  return [txt(x, y, w, lh, it.label, o.max || 26, { bold: true, align: al, color: col, valign: 'bottom' }),
    txt(x, y + lh + 2, w, h - lh - 2, it.detail, o.dmax || 22, { align: al, color: col, valign: 'top' })];
}
function detailTxt(x, y, w, h, it, max, o) {
  if (!it.detail) return [];
  if (h < TEMPLATE.minBody * 2.4 || !fitsAt(it.detail, w, h, DETAIL_MIN)) { detailsHidden++; return []; }
  return [txt(x, y, w, h, it.detail, max || 22, Object.assign({ valign: 'top' }, o))];
}
const rowSplit = (n, per) => Array.from({ length: Math.ceil(n / per) }, (_, r) => Math.min(per, n - r * per));
const perRow = (n, max) => n <= max ? n : Math.ceil(n / Math.ceil(n / max));
/* Points per row so the longest word of any label still fits its slot at 22 pt (about 62 % of a slot is text area in
   circles and hexagons): 5 long labels go 3 + 2 instead of being rejected in one cramped row. */
function fitPer(R, sc, max) {
  const word = Math.max(...sc.items.map(it => Math.max(...it.label.split(/\s+/).map(w => w.length)))) * TEMPLATE.minBody * 0.55 + 30;
  let per = perRow(sc.n, max);
  while (per > 2 && (R.w / per) * 0.62 < word) per = perRow(sc.n, per - 1);
  return per;
}
/* Equal slots in rows of `per`, each row centered: 7 points with per 4 -> 4 + 3. */
function slots(R, n, per, gx, gy, maxH) {
  const rows = rowSplit(n, per), H = Math.min(maxH || 1e9, (R.h - gy * (rows.length - 1)) / rows.length), w = (R.w - gx * (per - 1)) / per;
  const y0 = R.y + (R.h - rows.length * H - gy * (rows.length - 1)) / 2, out = [];
  rows.forEach((k, r) => { const x0 = R.x + (R.w - k * w - (k - 1) * gx) / 2; for (let j = 0; j < k; j++) out.push({ x: x0 + j * (w + gx), y: y0 + r * (H + gy), w, h: H, row: r }); });
  return out;
}

/* ===================== Suitability: one rule set, with the exact reason when a layout is not offered ===================== */
function F(o) {
  const reason = sc => sc.mode !== 'items' ? 'needs a list of points' : sc.n < o.min || sc.n > o.max ? `works for ${o.min}-${o.max} points (this content has ${sc.n})`
    : o.ord && !sc.ordered ? 'needs an order stated in the content' : o.unord && sc.ordered ? 'would hide the stated order'
    : o.top && !sc.topic ? 'needs a heading or topic' : o.cmp && !sc.compare ? 'only for content that compares things'
    : o.icons && !sc.iconsOK ? `no accurate object for "${sc.items[sc.icons.findIndex(i => !i.matched)].label}" (a generic picture is not used)`
    : o.someIcons && sc.icons.filter(i => i.matched).length < Math.ceil(sc.n / 2) ? 'fewer than half the points have an accurate object' : '';
  const f = sc => !reason(sc);
  f.reason = reason;
  return f;
}

/* ===================== Engine A: infographic arrangements of the same points ===================== */
const GEN = [];
const reg = g => { GEN.push(g); KIND_NAMES[g.key] = g.name; };
const between = (lo, hi) => sc => sc.n >= lo && sc.n <= hi;

reg({ key: 'g-cards', name: 'Numbered cards', engine: 'A', family: 'cards', fits: F({ min: 2, max: 10, ord: true }), why: 'Each point on its own numbered card.',
  build: (R, sc) => {
    const out = [];
    slots(R, sc.n, fitPer(R, sc, 5), 24, 24, 340).forEach((r, i) => {
      const it = sc.items[i], col = accent(i), D = Math.min(56, r.h * 0.3);
      out.push(box('rect', r.x, r.y + D / 2, r.w, r.h - D / 2, { fill: PALE(col) }), rule(r.x, r.y + r.h - 6, r.w, 6, col));
      out.push(box('ellipse', r.x + r.w / 2 - D / 2, r.y, D, D, { fill: col, text: num2(i), size: Math.max(16, Math.min(22, Math.round(D * 0.4))), bold: true, color: textOn(col), align: 'center', valign: 'middle' }));
      out.push(...labelBlock(r.x + 10, r.y + D + 6, r.w - 20, r.h - D - 16, it));
    });
    return out;
  } });
reg({ key: 'g-rows', name: 'Numbered list', engine: 'A', family: 'rows', fits: F({ min: 2, max: 10, ord: true }), why: 'Points as numbered rows (two columns for longer lists).',
  build: (R, sc) => {
    const n = sc.n, cols = n >= 6 ? 2 : 1, per = Math.ceil(n / cols), gx = 24, gap = 14, cw = (R.w - gx * (cols - 1)) / cols;
    const rh = Math.min(120, (R.h - gap * (per - 1)) / per), y0 = R.y + (R.h - per * rh - (per - 1) * gap) / 2, out = [];
    sc.items.forEach((it, i) => {
      const x = R.x + Math.floor(i / per) * (cw + gx), y = y0 + (i % per) * (rh + gap), col = accent(i), sq = Math.min(rh, 90);
      out.push(box('rect', x, y, sq, rh, { fill: col, text: num2(i), size: Math.max(16, Math.min(32, Math.round(rh * .38))), bold: true, color: textOn(col), align: 'center', valign: 'middle' }));
      out.push(box('rect', x + sq, y, cw - sq, rh, { fill: PALE(col) }), ...labelBlock(x + sq + 16, y, cw - sq - 28, rh, it, { align: 'left', max: 26 }));
    });
    return out;
  } });
reg({ key: 'g-split', name: 'Split panels', engine: 'A', family: 'split', fits: F({ min: 2, max: 3, ord: true }), why: 'The area split into equal panels, one per point.',
  build: (R, sc) => {
    const n = sc.n, gap = 10, pw = (R.w - gap * (n - 1)) / n, out = [];
    sc.items.forEach((it, i) => {
      const x = R.x + i * (pw + gap), col = accent(i), fg = textOn(col);
      out.push(box('rect', x, R.y, pw, R.h, { fill: col }), txt(x + 24, R.y + 18, 120, 60, num2(i), 44, { bold: true, color: fg, align: 'left' }));
      out.push(...labelBlock(x + 24, R.y + 90, pw - 48, R.h - 110, it, { align: 'left', color: fg, max: 32, dmax: 22, valign: 'top' }));
    });
    return out;
  } });
reg({ key: 'g-circles', name: 'Circles', engine: 'A', family: 'circles', fits: F({ min: 2, max: 10 }), why: 'Each point inside a large circle.',
  build: (R, sc) => {
    const out = [], hasD = sc.items.some(it => it.detail);
    slots(R, sc.n, fitPer(R, sc, 5), 20, 16).forEach((r, i) => {
      const it = sc.items[i], col = accent(i), D = Math.min(r.w - 10, r.h * (hasD ? 0.62 : 0.94), 300), cx = r.x + r.w / 2, y = r.y + (hasD ? 0 : (r.h - D) / 2), t = textRect('ellipse', cx - D / 2, y, D, D);
      out.push(box('ellipse', cx - D / 2, y, D, D, { fill: LIGHT(col), line: col, lineW: 4, text: it.label, size: sizeFor(it.label, t.w, t.h, 30), bold: true, color: INK, align: 'center', valign: 'middle' }));
      out.push(...detailTxt(r.x + 4, y + D + 8, r.w - 8, r.y + r.h - y - D - 8, it, 20));
    });
    return out;
  } });
reg({ key: 'g-icons', name: 'Icon columns', engine: 'A', family: 'icons', fits: F({ min: 2, max: 10, someIcons: true }), why: 'A matching object above each point (all native shapes).',
  build: (R, sc) => {
    const out = [];
    slots(R, sc.n, fitPer(R, sc, 5), 16, 18).forEach((r, i) => {
      const it = sc.items[i], col = accent(i), S = Math.min(140, r.w * 0.55, r.h * 0.42), cx = r.x + r.w / 2;
      out.push(box('ellipse', cx - S * 0.6, r.y, S * 1.2, S * 1.2, { fill: PALE(col) }), ...comp(sc.icons[i].key, cx - S / 2, r.y + S * 0.1, S, col));
      out.push(...labelBlock(r.x + 4, r.y + S * 1.2 + 8, r.w - 8, r.h - S * 1.2 - 8, it, { valign: 'top' }));
    });
    return out;
  } });
/* The topic in the middle, points on both sides, joined by horizontal/vertical connectors (all native). */
reg({ key: 'g-hub', name: 'Central topic', engine: 'A', family: 'hub', fits: F({ min: 2, max: 8, top: true, unord: true }), why: 'The topic in the center with every point connected to it.',
  build: (R, sc) => {
    const n = sc.n, left = sc.items.slice(0, Math.ceil(n / 2)), right = sc.items.slice(Math.ceil(n / 2)), cw = R.w * .26, ch = Math.min(150, R.h * .4);
    const cx = R.x + R.w / 2, cy = R.y + R.h / 2, iw = R.w * .27, out = [], lines = [];
    const side = (list, dir, k0) => {
      const gap = 16, ih = Math.min(130, (R.h - gap * (list.length - 1)) / list.length), y0 = cy - (list.length * ih + (list.length - 1) * gap) / 2;
      const x = dir < 0 ? R.x : R.x + R.w - iw, sx = dir < 0 ? x + iw + (cx - cw / 2 - x - iw) / 2 : cx + cw / 2 + (x - cx - cw / 2) / 2;
      list.forEach((it, j) => {
        const y = y0 + j * (ih + gap), col = accent(k0 + j + 1), my = y + ih / 2;
        lines.push(hLine(dir < 0 ? x + iw : sx, dir < 0 ? sx : x, my));
        out.push(box('roundRect', x, y, iw, ih, { fill: PALE(col), line: col, lineW: 2 }), ...labelBlock(x + 10, y + 4, iw - 20, ih - 8, it, { max: 24 }));
      });
      if (list.length) {
        const ys = list.map((_, j) => y0 + j * (ih + gap) + ih / 2);
        if (list.length > 1) lines.push(vLine(sx, ys[0], ys[ys.length - 1]));
        lines.push(hLine(sx, dir < 0 ? cx - cw / 2 : cx + cw / 2, cy));
      }
    };
    side(left, -1, 0); side(right, 1, left.length);
    out.push(box('roundRect', cx - cw / 2, cy - ch / 2, cw, ch, { fill: accent(0), text: sc.topic, size: sizeFor(sc.topic, cw - 14, ch - 8, 30), bold: true, color: '#FFFFFF', align: 'center', valign: 'middle' }));
    return lines.concat(out);
  } });
reg({ key: 'g-mind', name: 'Topic branches', engine: 'A', family: 'branch', fits: F({ min: 2, max: 10, top: true }), why: 'The topic on the left, branching out to each point.',
  build: (R, sc) => {
    const n = sc.n, tw = R.w * .27, th = Math.min(160, R.h * .45), gap = n > 7 ? 8 : 14, ih = Math.min(110, (R.h - gap * (n - 1)) / n), y0 = R.y + (R.h - n * ih - (n - 1) * gap) / 2;
    const bx = R.x + tw + 70, iw = R.x + R.w - bx, spine = R.x + tw + 36, cy = R.y + R.h / 2, out = [], lines = [hLine(R.x + tw, spine, cy)];
    const ys = sc.items.map((_, i) => y0 + i * (ih + gap) + ih / 2);
    if (n > 1) lines.push(vLine(spine, Math.min(ys[0], cy), Math.max(ys[n - 1], cy)));
    sc.items.forEach((it, i) => {
      const col = accent(i + 1);
      lines.push(hLine(spine, bx - 14, ys[i]), tipRight(bx, ys[i]));
      out.push(box('pill', bx, ys[i] - ih / 2, iw, ih, { fill: PALE(col), line: col, lineW: 2 }), ...labelBlock(bx + ih * .35, ys[i] - ih / 2 + 2, iw - ih * .7, ih - 4, it, { align: 'left', max: 24 }));
    });
    out.push(box('rect', R.x, cy - th / 2, tw, th, { fill: accent(0), text: sc.topic, size: sizeFor(sc.topic, tw - 14, th - 8, 30), bold: true, color: '#FFFFFF', align: 'center', valign: 'middle' }));
    return lines.concat(out);
  } });
reg({ key: 'g-tree', name: 'Topic tree', engine: 'A', family: 'tree', fits: F({ min: 2, max: 6, top: true }), why: 'The topic on top with each point below it.',
  build: (R, sc) => {
    const n = sc.n, rw = Math.min(460, R.w * .45), rh = 84, gap = 20, cw = (R.w - gap * (n - 1)) / n, cy = R.y + rh + 60, chh = R.y + R.h - cy, out = [], lines = [];
    const mid = R.y + rh + 30, cxs = sc.items.map((_, i) => R.x + i * (cw + gap) + cw / 2);
    lines.push(vLine(R.x + R.w / 2, R.y + rh, mid));
    if (n > 1) lines.push(hLine(cxs[0], cxs[n - 1], mid));
    sc.items.forEach((it, i) => { lines.push(vLine(cxs[i], mid, cy - 16), tipDown(cxs[i], cy)); out.push(...card(cxs[i] - cw / 2, cy, cw, chh, it, accent(i + 1))); });
    out.push(box('roundRect', R.x + (R.w - rw) / 2, R.y, rw, rh, { fill: accent(0), text: sc.topic, size: sizeFor(sc.topic, rw - 14, rh - 8, 30), bold: true, color: '#FFFFFF', align: 'center', valign: 'middle' }));
    return lines.concat(out);
  } });
reg({ key: 'g-numbers', name: 'Big numbers', engine: 'A', family: 'numbers', fits: F({ min: 2, max: 10, ord: true }), why: 'Large numbers lead into each point; clean and minimal.',
  build: (R, sc) => {
    const n = sc.n, cols = n <= 3 ? n : Math.ceil(n / 2), rows = Math.ceil(n / cols), gap = 26, cw = (R.w - gap * (cols - 1)) / cols, rh = (R.h - gap * (rows - 1)) / rows, out = [];
    sc.items.forEach((it, i) => {
      const r = Math.floor(i / cols), k = i % cols, x = R.x + k * (cw + gap), y = R.y + r * (rh + gap), col = accent(i), nh = Math.min(80, rh * .36);
      out.push(txt(x, y, cw, nh, num2(i), 60, { bold: true, color: accentText(col), align: 'left', valign: 'bottom' }), rule(x, y + nh + 6, Math.min(cw, 140), 5, col));
      out.push(...labelBlock(x, y + nh + 16, cw, rh - nh - 16, it, { align: 'left', valign: 'top' }));
    });
    return out;
  } });
reg({ key: 'g-segments', name: 'Segmented bar', engine: 'A', family: 'segments', fits: F({ min: 2, max: 5, ord: true }), why: 'One bar split into equal parts, one per point.',
  build: (R, sc) => {
    const n = sc.n, sw = R.w / n, bh = 110, by = R.y + 40, out = [];
    sc.items.forEach((it, i) => {
      const x = R.x + i * sw, col = accent(i);
      out.push(txt(x, R.y, sw, 36, num2(i), 24, { bold: true, color: accentText(col) }));
      out.push(box('rect', x, by, sw - 4, bh, { fill: col, text: it.label, size: sizeFor(it.label, sw - 18, bh - 8, 28), bold: true, color: textOn(col), align: 'center', valign: 'middle' }));
      out.push(...detailTxt(x + 8, by + bh + 16, sw - 16, R.y + R.h - by - bh - 16, it, 22));
    });
    return out;
  } });
reg({ key: 'g-zigzag', name: 'Alternating blocks', engine: 'A', family: 'zigzag', fits: F({ min: 2, max: 8 }), why: 'Points alternate on both sides of a center line.',
  build: (R, sc) => {
    const n = sc.n, cx = R.x + R.w / 2, rh = R.h / n, bw = R.w / 2 - 60, out = [], lines = [vLine(cx, R.y + rh / 2, R.y + R.h - rh / 2)];
    sc.items.forEach((it, i) => {
      const y = R.y + i * rh, my = y + rh / 2, col = accent(i), leftSide = i % 2 === 0, x = leftSide ? R.x : cx + 60, bh = Math.min(rh - 8, 120);
      lines.push(hLine(leftSide ? x + bw : cx, leftSide ? cx : x, my));
      out.push(box('ellipse', cx - 14, my - 14, 28, 28, { fill: col, line: '#FFFFFF', lineW: 3 }));
      out.push(box('rect', x, my - bh / 2, bw, bh, { fill: PALE(col) }), rule(leftSide ? x : x + bw - 6, my - bh / 2, 6, bh, col));
      out.push(...labelBlock(x + 16, my - bh / 2 + 2, bw - 32, bh - 4, it, { align: leftSide ? 'right' : 'left', max: 24 }));
    });
    return lines.concat(out);
  } });
reg({ key: 'g-hex', name: 'Hexagons', engine: 'A', family: 'hex', fits: F({ min: 2, max: 9 }), why: 'Each point in a hexagon; details underneath.',
  build: (R, sc) => {
    const out = [], hasD = sc.items.some(it => it.detail);
    slots(R, sc.n, fitPer(R, sc, 5), 12, 14).forEach((r, i) => {
      const it = sc.items[i], col = accent(i), hw = Math.min(r.w - 6, 300), hh = Math.min(hw * .8, r.h * (hasD ? .55 : .9)), cx = r.x + r.w / 2, y = r.y + (hasD ? 0 : (r.h - hh) / 2), t = textRect('hexagon', cx - hw / 2, y, hw, hh);
      out.push(box('hexagon', cx - hw / 2, y, hw, hh, { fill: col, text: it.label, size: sizeFor(it.label, t.w, t.h, 28), bold: true, color: textOn(col), align: 'center', valign: 'middle' }));
      out.push(...detailTxt(r.x + 4, y + hh + 10, r.w - 8, r.y + r.h - y - hh - 10, it, 22));
    });
    return out;
  } });
reg({ key: 'g-pillars', name: 'Pillars', engine: 'A', family: 'pillars', fits: F({ min: 2, max: 5, top: true }), why: 'The topic as a roof resting on one pillar per point.',
  build: (R, sc) => {
    const n = sc.n, roofH = 90, baseH = 26, gap = 24, inset = 40, pw = (R.w - 2 * inset - gap * (n - 1)) / n, py = R.y + roofH + 14, ph = R.h - roofH - 14 - baseH - 10, out = [];
    out.push(box('trapezoid', R.x, R.y, R.w, roofH, { fill: accent(0), text: sc.topic, size: sizeFor(sc.topic, R.w * .6, roofH - 30, 30), bold: true, color: '#FFFFFF', align: 'center', valign: 'bottom' }));
    sc.items.forEach((it, i) => {
      const x = R.x + inset + i * (pw + gap), col = accent(i + 1);
      out.push(box('rect', x, py, pw, ph, { fill: PALE(col) }), rule(x, py, pw, 8, col), ...labelBlock(x + 10, py + 14, pw - 20, ph - 20, it));
    });
    out.push(box('rect', R.x, R.y + R.h - baseH, R.w, baseH, { fill: TEMPLATE.line }));
    return out;
  } });
reg({ key: 'g-brace', name: 'Bracket list', engine: 'A', family: 'brace', fits: F({ min: 2, max: 8, top: true }), why: 'The topic gathers its points with a bracket.',
  build: (R, sc) => {
    const n = sc.n, tw = R.w * .3, bx = R.x + tw + 20, ix = bx + 70, gap = n > 6 ? 8 : 14, ih = Math.min(110, (R.h - gap * (n - 1)) / n), total = n * ih + (n - 1) * gap, y0 = R.y + (R.h - total) / 2, out = [];
    out.push(txt(R.x, R.y, tw, R.h, sc.topic, 36, { bold: true, color: accentText(accent(0)), align: 'right' }), box('rightBrace', bx, y0, 40, total, { line: accent(0), lineW: 4 }));
    sc.items.forEach((it, i) => {
      const y = y0 + i * (ih + gap), col = accent(i + 1);
      out.push(box('ellipse', ix, y + ih / 2 - 11, 22, 22, { fill: col }), ...labelBlock(ix + 40, y, R.x + R.w - ix - 40, ih, it, { align: 'left', max: 26 }));
    });
    return out;
  } });
reg({ key: 'g-tabs', name: 'Tabbed cards', engine: 'A', family: 'tabs', fits: F({ min: 2, max: 5 }), why: 'Each point heads a tab; its description or object below.',
  build: (R, sc) => {
    const n = sc.n, gap = 20, cw = (R.w - gap * (n - 1)) / n, th = 90, out = [];
    sc.items.forEach((it, i) => {
      const x = R.x + i * (cw + gap), col = accent(i);
      out.push(box('tab', x, R.y, cw, th, { fill: col, text: it.label, size: sizeFor(it.label, cw - 16, th - 10, 26), bold: true, color: textOn(col), align: 'center', valign: 'middle' }));
      out.push(box('rect', x, R.y + th, cw, R.h - th, { fill: PALE(col), line: col, lineW: 2 }));
      const d = detailTxt(x + 12, R.y + th + 12, cw - 24, R.h - th - 24, it, 22);
      if (d.length) out.push(...d);
      else if (sc.icons[i].matched) { const S = Math.min(cw * .55, R.h - th - 40); out.push(...comp(sc.icons[i].key, x + (cw - S) / 2, R.y + th + (R.h - th - S) / 2, S, col)); }
    });
    return out;
  } });
reg({ key: 'g-rings', name: 'Ring badges', engine: 'A', family: 'rings', fits: F({ min: 2, max: 10, ord: true }), why: 'Numbered rings with each point beneath.',
  build: (R, sc) => {
    const out = [];
    slots(R, sc.n, fitPer(R, sc, 5), 16, 18).forEach((r, i) => {
      const it = sc.items[i], col = accent(i), D = Math.min(150, r.w * .6, r.h * .45), cx = r.x + r.w / 2;
      out.push(box('donut', cx - D / 2, r.y, D, D, { fill: col }), txt(cx - D * .3, r.y + D * .3, D * .6, D * .4, num2(i), 34, { bold: true, color: accentText(col) }));
      out.push(...labelBlock(r.x + 4, r.y + D + 10, r.w - 8, r.h - D - 10, it, { valign: 'top' }));
    });
    return out;
  } });
reg({ key: 'g-diamonds', name: 'Diamonds', engine: 'A', family: 'diamonds', fits: F({ min: 2, max: 10, ord: true }), why: 'Numbered diamonds with each point below.',
  build: (R, sc) => {
    const out = [];
    slots(R, sc.n, fitPer(R, sc, 5), 16, 18).forEach((r, i) => {
      const it = sc.items[i], col = accent(i), D = Math.min(140, r.w * .55, r.h * .4), cx = r.x + r.w / 2;
      out.push(box('diamond', cx - D / 2, r.y, D, D, { fill: col, text: String(i + 1), size: Math.max(16, Math.min(30, Math.round(D * .28))), bold: true, color: textOn(col), align: 'center', valign: 'middle' }));
      out.push(rule(cx - r.w * .3, r.y + D + 8, r.w * .6, 3, LIGHT(col)), ...labelBlock(r.x + 4, r.y + D + 16, r.w - 8, r.h - D - 16, it, { valign: 'top' }));
    });
    return out;
  } });
reg({ key: 'g-quadrant', name: 'Four quadrants', engine: 'A', family: 'quadrant', fits: F({ min: 4, max: 4, unord: true }), why: 'Four points in a 2 × 2 grid around the topic.',
  build: (R, sc) => {
    const gap = 14, w = (R.w - gap) / 2, h = (R.h - gap) / 2, out = [], D = Math.min(170, R.h * .42);
    sc.items.forEach((it, i) => {
      const x = R.x + (i % 2) * (w + gap), y = R.y + Math.floor(i / 2) * (h + gap), col = accent(i), right = i % 2 === 1;
      out.push(box('rect', x, y, w, h, { fill: PALE(col) }), ...labelBlock(right ? x + D * .6 : x + 20, y + 8, w - D * .6 - 20, h - 16, it, { align: right ? 'left' : 'right', max: 26 }));
    });
    if (sc.topic) { const r = textRect('ellipse', R.x + R.w / 2 - D / 2, R.y + R.h / 2 - D / 2, D, D);
      out.push(box('ellipse', R.x + R.w / 2 - D / 2, R.y + R.h / 2 - D / 2, D, D, { fill: accent(0), line: '#FFFFFF', lineW: 6, text: sc.topic, size: sizeFor(sc.topic, r.w, r.h, 24), bold: true, color: '#FFFFFF', align: 'center', valign: 'middle' })); }
    return out;
  } });
/* V10.8 families for independent ideas: a definition beside its ideas, a hub with spokes, a balanced icon grid and one
   information panel. Each idea keeps its own object (or the neutral marker); none of them implies an order. */
const iconKey = (sc, i) => sc.icons[i] && sc.icons[i].matched ? sc.icons[i].key : 'none';
const UNORD = { unord: true };
reg({ key: 'g-define', name: 'Definition and key ideas', engine: 'A', family: 'define',
  fits: Object.assign(sc => F({ min: 2, max: 7, unord: true })(sc) && !!sc.definition, { reason: sc => F({ min: 2, max: 7, unord: true }).reason(sc) || (sc.definition ? '' : 'needs a definition sentence in the content') }),
  why: 'The definition exactly as written, beside the key ideas it contains.',
  build: (R, sc) => {
    const lw = R.w * .42, gap = 28, col = accent(0), out = [box('rect', R.x, R.y, lw, R.h, { fill: PALE(col) }), rule(R.x, R.y, 8, R.h, col)];
    out.push(txt(R.x + 28, R.y + 14, lw - 48, 64, sc.topic || 'Definition', 28, { bold: true, align: 'left', valign: 'top' }), txt(R.x + 28, R.y + 84, lw - 48, R.h - 98, sc.definition, 22, { align: 'left', valign: 'top' }));
    const x = R.x + lw + gap, w = R.w - lw - gap, n = sc.n, g = 12, h = Math.min(96, (R.h - g * (n - 1)) / n), y0 = R.y + (R.h - n * h - (n - 1) * g) / 2, D = Math.min(h - 14, 64);
    sc.items.forEach((it, i) => {
      const y = y0 + i * (h + g), c = accent(i + 1);
      out.push(box('roundRect', x, y, w, h, { fill: PALE(c) }), box('ellipse', x + 12, y + (h - D) / 2, D, D, { fill: '#FFFFFF' }), ...comp(iconKey(sc, i), x + 12 + D * .18, y + (h - D) / 2 + D * .18, D * .64, c));
      out.push(txt(x + D + 28, y, w - D - 40, h, it.label, 26, { bold: true, align: 'left' }));
    });
    return out;
  } });
reg({ key: 'g-orbit', name: 'Hub and spokes', engine: 'A', family: 'orbit', fits: F(Object.assign({ min: 3, max: 8, top: true }, UNORD)), why: 'The topic at the center, each idea on its own spoke around it.',
  build: (R, sc) => {
    const n = sc.n, cx = R.x + R.w / 2, cy = R.y + R.h / 2, HD = Math.min(190, R.h * .44), HW = Math.min(280, R.w * .26), iw = Math.min(270, R.w * .25), ih = 88, rx = (R.w - iw) / 2, ry = (R.h - ih) / 2, out = [], lines = [];
    sc.items.forEach((it, i) => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / n, x = cx + rx * Math.cos(a), y = cy + ry * Math.sin(a), col = accent(i + 1), dx = x - cx, dy = y - cy, L = Math.hypot(dx, dy);
      const k = Math.min(Math.abs(dx) > 0.1 ? iw / 2 / Math.abs(dx) : 1e9, Math.abs(dy) > 0.1 ? ih / 2 / Math.abs(dy) : 1e9);   // the spoke stops at the pill's edge
      lines.push(seg(cx + dx / L * HW / 2, cy + dy / L * HD / 2, x - dx * k, y - dy * k, TEMPLATE.line, 2));
      out.push(box('pill', x - iw / 2, y - ih / 2, iw, ih, { fill: col, text: it.label, size: sizeFor(it.label, iw - ih * .6, ih - 8, 24), bold: true, color: textOn(col), align: 'center', valign: 'middle' }));
    });
    const t = textRect('ellipse', cx - HW / 2, cy - HD / 2, HW, HD);
    out.push(box('ellipse', cx - HW / 2, cy - HD / 2, HW, HD, { fill: accent(0), text: sc.topic, size: sizeFor(sc.topic, t.w, t.h, 28), bold: true, color: textOn(accent(0)), align: 'center', valign: 'middle' }));
    return lines.concat(out);
  } });
reg({ key: 'g-grid', name: 'Icon grid', engine: 'A', family: 'grid', fits: F({ min: 3, max: 9, someIcons: true }), why: 'A balanced grid: each idea beside its own object.',
  build: (R, sc) => {
    const n = sc.n, cols = n <= 4 ? 2 : 3, rows = Math.ceil(n / cols), gx = 24, gy = 18, cw = (R.w - gx * (cols - 1)) / cols, ch = Math.min(130, (R.h - gy * (rows - 1)) / rows);
    const y0 = R.y + (R.h - rows * ch - gy * (rows - 1)) / 2, out = [];
    sc.items.forEach((it, i) => {
      const r = Math.floor(i / cols), k = i % cols, inRow = Math.min(cols, n - r * cols), x = R.x + (R.w - inRow * cw - (inRow - 1) * gx) / 2 + k * (cw + gx), y = y0 + r * (ch + gy), col = accent(i), D = Math.min(ch - 20, 90);
      out.push(box('roundRect', x, y, cw, ch, { fill: PALE(col) }), box('ellipse', x + 14, y + (ch - D) / 2, D, D, { fill: '#FFFFFF' }), ...comp(iconKey(sc, i), x + 14 + D * .18, y + (ch - D) / 2 + D * .18, D * .64, col));
      out.push(...labelBlock(x + D + 30, y + 6, cw - D - 44, ch - 12, it, { align: 'left', max: 26 }));
    });
    return out;
  } });
reg({ key: 'g-panel', name: 'Information panel', engine: 'A', family: 'panel', fits: F({ min: 2, max: 6, top: true }), why: 'The topic as the header of one panel, a column for each idea.',
  build: (R, sc) => {
    const n = sc.n, hh = 76, col = accent(0), cw = R.w / n, out = [box('rect', R.x, R.y, R.w, hh, { fill: col, text: sc.topic, size: sizeFor(sc.topic, R.w - 40, hh - 10, 30), bold: true, color: textOn(col), align: 'center', valign: 'middle' }),
      box('rect', R.x, R.y + hh, R.w, R.h - hh, { fill: '#F2F2F2' })];
    sc.items.forEach((it, i) => {
      const x = R.x + i * cw, c = accent(i + 1), S = Math.min(84, cw * .4, (R.h - hh) * .32);
      if (i) out.push(rule(x - 1, R.y + hh + 20, 2, R.h - hh - 40, '#FFFFFF'));
      out.push(...comp(iconKey(sc, i), x + (cw - S) / 2, R.y + hh + 22, S, c), rule(x + cw * .3, R.y + hh + S + 34, cw * .4, 4, c), ...labelBlock(x + 12, R.y + hh + S + 46, cw - 24, R.h - hh - S - 56, it, { valign: 'top' }));
    });
    return out;
  } });
/* Order-only layouts: arrows and steps claim a sequence, so they are offered only when the content has one. */
reg({ key: 'g-chevrons', name: 'Chevron process', engine: 'A', family: 'chevrons', fits: F({ min: 2, max: 10, ord: true }), why: 'Steps as chevrons pointing forward, in the stated order (two rows for long processes).',
  build: (R, sc) => {
    const n = sc.n, rows = n <= 5 ? 1 : 2, per = Math.ceil(n / rows), ov = 16, cw = (R.w + ov * (per - 1)) / per, rgap = 36;
    const chh = rows === 1 ? Math.min(130, R.h * .34) : Math.min(130, (R.h - rgap) / 2), out = [];
    sc.items.forEach((it, i) => {
      const r = Math.floor(i / per), k = i % per, x = R.x + k * (cw - ov), y = rows === 1 ? R.y : R.y + (R.h - 2 * chh - rgap) / 2 + r * (chh + rgap), col = accent(i);
      const g = i === 0 ? 'homePlate' : 'chevron', t = textRect(g, x, y, cw, chh);
      out.push(box(g, x, y, cw, chh, { fill: col, text: (rows > 1 ? (i + 1) + '. ' : '') + it.label, size: sizeFor((rows > 1 ? (i + 1) + '. ' : '') + it.label, t.w, t.h, 24), bold: true, color: textOn(col), align: 'center', valign: 'middle' }));
      if (rows === 1) out.push(...detailTxt(x + 10, y + chh + 16, cw - 30, R.h - chh - 16, it, 22));
      else if (it.detail) detailsHidden++;
    });
    return out;
  } });
reg({ key: 'g-stairs', name: 'Staircase', engine: 'A', family: 'stairs', fits: F({ min: 2, max: 8, ord: true }), why: 'Steps rising from the first to the last.',
  build: (R, sc) => {
    const n = sc.n, gap = 8, sw = (R.w - gap * (n - 1)) / n, out = [];
    sc.items.forEach((it, i) => {
      const h = R.h * (.35 + .65 * (i + 1) / n), x = R.x + i * (sw + gap), y = R.y + R.h - h, col = accent(i);
      out.push(box('rect', x, y, sw, h, { fill: col }), txt(x + 6, y + 6, sw - 12, 44, num2(i), 30, { bold: true, color: textOn(col), align: 'left' }));
      out.push(...labelBlock(x + 6, y + 52, sw - 12, Math.min(h - 60, 200), it, { align: 'left', color: textOn(col), valign: 'top', max: 24 }));
    });
    return out;
  } });
reg({ key: 'g-vsteps', name: 'Vertical steps', engine: 'A', family: 'vsteps', fits: F({ min: 2, max: 8, ord: true }), why: 'Numbered steps from top to bottom with arrows between.',
  build: (R, sc) => {
    const n = sc.n, gap = n > 6 ? 14 : 22, rh = Math.min(100, (R.h - gap * (n - 1)) / n), y0 = R.y + (R.h - n * rh - (n - 1) * gap) / 2, D = Math.min(rh, 70), out = [];
    sc.items.forEach((it, i) => {
      const y = y0 + i * (rh + gap), col = accent(i), cx = R.x + 60;
      out.push(box('ellipse', cx - D / 2, y + (rh - D) / 2, D, D, { fill: col, text: String(i + 1), size: Math.max(16, Math.min(30, Math.round(D * .45))), bold: true, color: textOn(col), align: 'center', valign: 'middle' }));
      if (i < n - 1) out.push(box('downArrow', cx - 9, y + (rh + D) / 2 + 2, 18, gap + (rh - D) - 4, { fill: CONNECTOR }));
      out.push(box('rect', cx + D / 2 + 20, y, R.x + R.w - cx - D / 2 - 20, rh, { fill: PALE(col) }), ...labelBlock(cx + D / 2 + 36, y, R.x + R.w - cx - D / 2 - 52, rh, it, { align: 'left', max: 24 }));
    });
    return out;
  } });
reg({ key: 'g-arrowband', name: 'Arrow band', engine: 'A', family: 'arrowband', fits: F({ min: 2, max: 5, ord: true }), why: 'A single forward band divided into the steps.',
  build: (R, sc) => {
    const n = sc.n, bh = 120, by = R.y + (sc.items.some(it => it.detail) ? 40 : (R.h - bh) / 2), sw = R.w / n, out = [];
    sc.items.forEach((it, i) => {
      const x = R.x + i * sw, col = accent(i), g = i === n - 1 ? 'homePlate' : 'rect', r = textRect(g, x, by, sw, bh);
      out.push(box(g, x, by, sw, bh, { fill: col, text: it.label, size: sizeFor(it.label, r.w - 10, r.h, 26), bold: true, color: textOn(col), align: 'center', valign: 'middle' }));
      out.push(txt(x, by - 40, sw, 36, `Step ${i + 1}`, 22, { bold: true, color: accentText(col) }));
      out.push(...detailTxt(x + 8, by + bh + 14, sw - 16, R.y + R.h - by - bh - 14, it, 22));
    });
    return out;
  } });
/* Serpentine: rows of steps that turn at the end of each row, so long processes keep large text and their order. */
reg({ key: 'g-snake', name: 'Serpentine path', engine: 'A', family: 'snake', fits: F({ min: 5, max: 10, ord: true }), why: 'The steps wind left to right, then back, keeping the order.',
  build: (R, sc) => {
    const n = sc.n, per = n <= 6 ? 3 : n <= 8 ? 4 : 5, rows = Math.ceil(n / per), aw = 44, rgap = 40, bw = (R.w - aw * (per - 1)) / per, bh = Math.min(150, (R.h - rgap * (rows - 1)) / rows);
    const y0 = R.y + (R.h - rows * bh - (rows - 1) * rgap) / 2, out = [];
    sc.items.forEach((it, i) => {
      const r = Math.floor(i / per), k = i % per, rev = r % 2 === 1, c = rev ? per - 1 - k : k, x = R.x + c * (bw + aw), y = y0 + r * (bh + rgap), col = accent(i), D = Math.min(44, bh * .4);
      out.push(box('roundRect', x, y, bw, bh, { fill: PALE(col), line: col, lineW: 2 }), box('ellipse', x + 10, y + 10, D, D, { fill: col, text: String(i + 1), size: Math.max(16, Math.round(D * .45)), bold: true, color: textOn(col), align: 'center', valign: 'middle' }));
      out.push(...labelBlock(x + D + 16, y + 4, bw - D - 24, bh - 8, it, { align: 'left', max: 24 }));
      if (i === n - 1) return;
      if (k < per - 1) out.push(box(rev ? 'leftArrow' : 'rightArrow', rev ? x - aw + 8 : x + bw + 8, y + bh / 2 - 13, aw - 16, 26, { fill: CONNECTOR }));
      else out.push(box('downArrow', x + bw / 2 - 13, y + bh + 6, 26, rgap - 12, { fill: CONNECTOR }));
    });
    return out;
  } });
/* Timeline: one axis, numbered markers, labels alternating above and below so each gets twice the width. */
reg({ key: 'g-timeline', name: 'Timeline', engine: 'A', family: 'timeline', fits: F({ min: 3, max: 10, ord: true }), why: 'The steps along one line, labels alternating above and below.',
  build: (R, sc) => {
    const n = sc.n, slot = R.w / n, cy = R.y + R.h / 2, D = Math.min(46, slot * .6), out = [rule(R.x, cy - 3, R.w, 6, LIGHT(TEMPLATE.line))];
    sc.items.forEach((it, i) => {
      // a label may use the width up to its same-side neighbours (two slots apart), never beyond
      const cx = R.x + slot * (i + .5), col = accent(i), up = i % 2 === 0, x = Math.max(R.x, cx - slot + 6), lw = Math.min(R.x + R.w, cx + slot - 6) - x;
      out.push(seg(cx, up ? cy - D / 2 - 30 : cy + D / 2, cx, up ? cy - D / 2 : cy + D / 2 + 30, col, 3));
      out.push(box('ellipse', cx - D / 2, cy - D / 2, D, D, { fill: col, line: '#FFFFFF', lineW: 3, text: String(i + 1), size: Math.max(16, Math.round(D * .42)), bold: true, color: textOn(col), align: 'center', valign: 'middle' }));
      const h = R.h / 2 - D / 2 - 36;
      out.push(...labelBlock(x, up ? R.y : cy + D / 2 + 34, lw, h, it, { valign: up ? 'bottom' : 'top', max: 24 }));
    });
    return out;
  } });
/* Circular flow: the steps around a ring with native arrowheads showing the direction. */
reg({ key: 'g-circleflow', name: 'Circular flow', engine: 'A', family: 'circleflow', fits: Object.assign(sc => F({ min: 3, max: 10, ord: true })(sc) && sc.cycle, { reason: sc => F({ min: 3, max: 10, ord: true }).reason(sc) || (sc.cycle ? '' : 'a ring would show a loop the content does not state') }), why: 'The steps around a circle in order, with arrows along the ring.',
  build: (R, sc) => {
    const n = sc.n, cx = R.x + R.w / 2, cy = R.y + R.h / 2, r = Math.min(R.h / 2 - 34, 190), D = Math.min(56, 2 * Math.PI * r / n * .5), out = [];
    out.push(box('ellipse', cx - r, cy - r, 2 * r, 2 * r, { line: LIGHT(TEMPLATE.line), lineW: 5 }));
    const ang = i => -Math.PI / 2 + Math.PI / n + 2 * Math.PI * i / n;      // half a step past the top, so every step has a clear side
    sc.items.forEach((_, i) => { const a = (ang(i) + ang(i + 1)) / 2, x = cx + r * Math.cos(a), y = cy + r * Math.sin(a); out.push(headAt(x + 7 * Math.cos(a + Math.PI / 2), y + 7 * Math.sin(a + Math.PI / 2), a * 180 / Math.PI + 90, 18, TEMPLATE.line)); });
    if (sc.topic) { const t = textRect('ellipse', cx - r * .78, cy - r * .78, r * 1.56, r * 1.56); out.push(txt(t.x, t.y, t.w, t.h, sc.topic, 30, { bold: true, color: accentText(accent(0)) })); }
    // Labels sit in one column on each side of the ring, at their step's height, pushed apart so they never overlap.
    const pos = sc.items.map((it, i) => ({ it, i, x: cx + r * Math.cos(ang(i)), y: cy + r * Math.sin(ang(i)), right: Math.cos(ang(i)) > 1e-6 || (Math.abs(Math.cos(ang(i))) <= 1e-6 && Math.sin(ang(i)) > 0) }));
    [true, false].forEach(side => {
      const L = pos.filter(p => p.right === side).sort((a, b) => a.y - b.y), k = L.length, lh = Math.min(100, (R.h - 6 * (k - 1)) / Math.max(k, 1));
      const x0 = side ? cx + r + D / 2 + 12 : R.x, lw = side ? R.x + R.w - x0 : cx - r - D / 2 - 12 - R.x;
      let prev = R.y - 6;
      const ys = L.map(p => (prev = Math.max(prev + 6, p.y - lh / 2) + lh) - lh);
      const over = Math.max(0, ys.length ? ys[ys.length - 1] + lh - R.y - R.h : 0);
      L.forEach((p, j) => out.push(...labelBlock(x0, ys[j] - over, lw, lh, p.it, { align: side ? 'left' : 'right', max: 24 })));
    });
    pos.forEach(p => { const col = accent(p.i);
      out.push(box('ellipse', p.x - D / 2, p.y - D / 2, D, D, { fill: col, line: '#FFFFFF', lineW: 3, text: String(p.i + 1), size: Math.max(16, Math.round(D * .42)), bold: true, color: textOn(col), align: 'center', valign: 'middle' })); });
    return out;
  } });
/* Comparison-only layout (two things the content itself compares). */
reg({ key: 'g-versus', name: 'Versus', engine: 'A', family: 'versus', fits: F({ min: 2, max: 2, cmp: true }), why: 'The two things the content compares, face to face.',
  build: (R, sc) => {
    const D = 90, pw = (R.w - D - 40) / 2, out = [];
    sc.items.forEach((it, i) => {
      const x = i ? R.x + R.w - pw : R.x, col = accent(i ? 0 : 2);
      out.push(box('rect', x, R.y, pw, 80, { fill: col, text: it.label, size: sizeFor(it.label, pw - 16, 72, 30), bold: true, color: textOn(col), align: 'center', valign: 'middle' }));
      out.push(box('rect', x, R.y + 80, pw, R.h - 80, { fill: PALE(col) }), txt(x + 16, R.y + 96, pw - 32, R.h - 112, (it.detail || '').split('; ').map(t => '• ' + t).join('\n'), 24, { align: 'left', valign: 'top' }));
    });
    out.push(box('ellipse', R.x + R.w / 2 - D / 2, R.y + R.h / 2 - D / 2, D, D, { fill: TEMPLATE.line, line: '#FFFFFF', lineW: 5, text: 'vs', size: 28, bold: true, color: '#FFFFFF', align: 'center', valign: 'middle' }));
    return out;
  } });

/* ===================== Engine B: pictorial scenes from native components =====================
   Offered only when every point has an accurate object from the catalog (F icons). */
reg({ key: 'p-row', name: 'Object scene', engine: 'B', family: 'p-row', fits: F({ min: 2, max: 8, icons: true }), why: 'An object for each point, in the content\'s order.',
  build: (R, sc) => {
    const n = sc.n, rows = n <= 5 ? 1 : 2, per = Math.ceil(n / rows), aw = sc.ordered ? 46 : 0, slot = (R.w - aw * (per - 1)) / per, rgap = 24, rh = (R.h - rgap * (rows - 1)) / rows;
    const S = Math.min(170, slot * .62, rh * (rows > 1 ? .52 : .5)), top = rows === 1 ? Math.max(0, (R.h - S - 150) / 2) : 0, out = [];
    sc.items.forEach((it, i) => {
      const r = Math.floor(i / per), k = i % per, rev = sc.ordered && r % 2 === 1, c = rev ? per - 1 - k : k, x = R.x + c * (slot + aw), y = R.y + top + r * (rh + rgap), col = accent(i);
      out.push(...comp(sc.icons[i].key, x + (slot - S) / 2, y, S, col, it.label));
      const turn = sc.ordered && rows > 1 && k === per - 1 && i < n - 1, lw = slot - 4 - (turn ? 34 : 0);   // room for the down arrow at a row end
      out.push(...labelBlock(x + 2, y + S + 10, lw, rh - S - 10 - top, Object.assign({}, it, { label: (sc.ordered && rows > 1 ? (i + 1) + '. ' : '') + it.label }), { valign: 'top', max: 24 }));
      if (!sc.ordered || i === n - 1) return;
      if (k < per - 1) out.push(box(rev ? 'leftArrow' : 'rightArrow', rev ? x - aw + 6 : x + slot + 6, y + S / 2 - 14, aw - 12, 28, { fill: CONNECTOR }));
      else out.push(box('downArrow', x + slot - 26, y + S * .3, 24, rh + rgap - S * .3, { fill: CONNECTOR }));
    });
    return out;
  } });
reg({ key: 'p-platform', name: 'Platform scene', engine: 'B', family: 'p-platform', fits: F({ min: 2, max: 5, top: true, icons: true }), why: 'The objects standing together on a platform named after the topic.',
  build: (R, sc) => {
    const n = sc.n, ph = 70, py = R.y + R.h - ph, slot = (R.w - 80) / n, S = Math.min(160, slot * .62, R.h * .4), out = [];
    out.push(box('rect', R.x + 20, py - 18, R.w - 40, 18, { fill: LIGHT(accent(0)) }), box('rect', R.x, py, R.w, ph, { fill: accent(0), text: sc.topic, size: sizeFor(sc.topic, R.w - 40, ph - 8, 28), bold: true, color: '#FFFFFF', align: 'center', valign: 'middle' }));
    sc.items.forEach((it, i) => {
      const cx = R.x + 40 + slot * (i + .5), col = accent(i + 1), lh = py - 18 - S - R.y - 8, withD = it.detail && fitsAt(it.label + '\n' + it.detail, slot - 12, lh, DETAIL_MIN);
      if (it.detail && !withD) detailsHidden++;
      out.push(...comp(sc.icons[i].key, cx - S / 2, py - 18 - S, S, col, it.label));
      out.push(txt(cx - slot / 2 + 6, R.y, slot - 12, lh, it.label + (withD ? '\n' + it.detail : ''), 24, { bold: !withD, valign: 'bottom' }));
    });
    return out;
  } });
/* The topic's object in a circle, each point's object around it, joined by native straight lines (Napkin-style hub,
   drawn from scratch): balanced left/right columns along an arc, labels on the outer side. */
reg({ key: 'p-radial', name: 'Illustrated hub', engine: 'B', family: 'p-radial', fits: F({ min: 3, max: 8, top: true, unord: true, icons: true }),
  why: 'The topic\'s object in the middle with each point\'s own object around it, connected by lines.',
  build: (R, sc) => {
    const n = sc.n, cx = R.x + R.w / 2, cy = R.y + R.h / 2, C = Math.min(R.h * .5, 210), out = [], lines = [];
    const sides = [sc.items.map((_, i) => i).filter(i => i % 2 === 0), sc.items.map((_, i) => i).filter(i => i % 2 === 1)];   // alternate: left, right
    const m = Math.max(sides[0].length, sides[1].length), step = Math.min(150, R.h / m), D = Math.min(112, step - 14), lw = Math.min(250, R.w * .22);
    sides.forEach((list, sIdx) => {
      const dir = sIdx === 0 ? -1 : 1, k = list.length;
      list.forEach((i, j) => {
        const it = sc.items[i], col = accent(i + 1), dy = (j - (k - 1) / 2) * step, t = Math.abs(dy) / (R.h / 2);
        const nx = cx + dir * (R.w / 2 - lw - 14 - D / 2 - t * 40), ny = cy + dy;
        const a = Math.atan2(ny - cy, nx - cx);
        lines.push(seg(cx + Math.cos(a) * (C / 2 + 4), cy + Math.sin(a) * (C / 2 + 4), nx - Math.cos(a) * (D / 2 + 4), ny - Math.sin(a) * (D / 2 + 4), tint(TEMPLATE.line, .35), 2.5));
        out.push(box('ellipse', nx - D / 2, ny - D / 2, D, D, { fill: PALE(col), line: col, lineW: 2.5 }), ...comp(sc.icons[i].key, nx - D * .31, ny - D * .31, D * .62, col, it.label));
        const lx = dir < 0 ? nx - D / 2 - 12 - lw : nx + D / 2 + 12;
        out.push(...labelBlock(Math.max(R.x, lx), ny - step / 2 + 2, Math.min(lw, dir < 0 ? nx - D / 2 - 12 - R.x : R.x + R.w - lx), step - 4, it, { align: dir < 0 ? 'right' : 'left', max: 24 }));
      });
    });
    out.push(box('ellipse', cx - C / 2, cy - C / 2, C, C, { fill: PALE(accent(0)), line: accent(0), lineW: 3 }));
    if (sc.domainIcon) {
      out.push(...comp(sc.domainIcon.key, cx - C * .25, cy - C * .36, C * .5, accent(0), sc.topic));
      out.push(txt(cx - C * .4, cy + C * .14, C * .8, C * .28, sc.topic, 24, { bold: true, color: accentText(accent(0)) }));
    } else { const t = textRect('ellipse', cx - C / 2, cy - C / 2, C, C); out.push(txt(t.x, t.y, t.w, t.h, sc.topic, 28, { bold: true, color: accentText(accent(0)) })); }
    return lines.concat(out);
  } });
reg({ key: 'p-hub', name: 'Topic object hub', engine: 'B', family: 'p-hub', fits: F({ min: 2, max: 6, top: true, unord: true, icons: true }), why: 'An object for the topic, connected to an object for each point.',
  build: (R, sc) => {
    const n = sc.n, left = sc.items.slice(0, Math.ceil(n / 2)), right = sc.items.slice(Math.ceil(n / 2)), labH = 56;
    const CS = Math.min(170, R.h - labH - 30), cx = R.x + R.w / 2, cy = R.y + (R.h - labH) / 2, D = CS + 24, out = [], lines = [];
    const sw = R.w * .27, perSide = Math.max(left.length, right.length), S = Math.min(120, (R.h - perSide * labH) / perSide - 12);
    const side = (list, dir, k0) => {
      const slotH = R.h / list.length, x = dir < 0 ? R.x : R.x + R.w - sw, ocx = x + sw / 2, edge = dir < 0 ? cx - D / 2 : cx + D / 2, spine = (dir < 0 ? x + sw + edge : edge + x) / 2;
      const ys = list.map((_, j) => R.y + j * slotH + (slotH - S - labH) / 2 + S / 2);
      list.forEach((it, j) => {
        const col = accent(k0 + j + 1), oy = ys[j] - S / 2;
        out.push(...comp(sc.icons[k0 + j].key, ocx - S / 2, oy, S, col, it.label), txt(x, oy + S + 6, sw, labH - 6, it.label, 24, { bold: true, valign: 'top' }));
        lines.push(hLine(dir < 0 ? ocx + S / 2 + 8 : spine, dir < 0 ? spine : ocx - S / 2 - 8, ys[j]));
        if (it.detail) detailsHidden++;
      });
      lines.push(vLine(spine, Math.min(cy, ...ys), Math.max(cy, ...ys)), hLine(dir < 0 ? spine : edge, dir < 0 ? edge : spine, cy));
    };
    side(left, -1, 0); side(right, 1, left.length);
    out.push(box('ellipse', cx - D / 2, cy - D / 2, D, D, { fill: PALE(accent(0)), line: LIGHT(accent(0)), lineW: 2 }));
    if (sc.domainIcon) { out.push(...comp(sc.domainIcon.key, cx - CS * .38, cy - CS * .38, CS * .76, accent(0), sc.topic), txt(cx - sw / 2, cy + D / 2 + 6, sw, labH, sc.topic, 26, { bold: true, valign: 'top' })); }
    else { const t = textRect('ellipse', cx - D / 2, cy - D / 2, D, D); out.push(txt(t.x, t.y, t.w, t.h, sc.topic, 28, { bold: true, color: accentText(accent(0)) })); }
    return lines.concat(out);
  } });
/* Illustrated timeline: objects alternate above and below one axis, numbered in order. */
reg({ key: 'p-path', name: 'Illustrated timeline', engine: 'B', family: 'p-path', fits: F({ min: 3, max: 8, ord: true, icons: true }), why: 'Each step\'s own object along a line, numbered in order.',
  build: (R, sc) => {
    // object and label on the same side of the axis (alternating), so neighbours never cover each other
    const n = sc.n, slot = R.w / n, cy = R.y + R.h / 2, nD = 34, D = Math.min(104, slot * 1.6, R.h / 2 - 110), out = [rule(R.x, cy - 3, R.w, 6, LIGHT(TEMPLATE.line))];
    sc.items.forEach((it, i) => {
      const cx = R.x + slot * (i + .5), col = accent(i), up = i % 2 === 0, oy = up ? cy - nD / 2 - 12 - D : cy + nD / 2 + 12, x = Math.max(R.x, cx - slot + 6), lw = Math.min(R.x + R.w, cx + slot - 6) - x;
      out.push(seg(cx, up ? oy + D : cy + nD / 2, cx, up ? cy - nD / 2 : oy, col, 3));
      out.push(box('ellipse', cx - D / 2, oy, D, D, { fill: PALE(col), line: col, lineW: 2.5 }), ...comp(sc.icons[i].key, cx - D * .31, oy + D * .19, D * .62, col, it.label));
      out.push(box('ellipse', cx - nD / 2, cy - nD / 2, nD, nD, { fill: col, line: '#FFFFFF', lineW: 2, text: String(i + 1), size: 16, bold: true, color: textOn(col), align: 'center', valign: 'middle' }));
      const lh = R.h / 2 - nD / 2 - 12 - D - 6;
      out.push(...labelBlock(x, up ? R.y : oy + D + 6, lw, lh, it, { valign: up ? 'bottom' : 'top', max: 24 }));
    });
    return out;
  } });
reg({ key: 'p-screen', name: 'Dashboard screen', engine: 'B', family: 'p-screen', fits: F({ min: 2, max: 8, icons: true }), why: 'A screen showing one panel per point, each with its object.',
  build: (R, sc) => {
    const out = [], sw = R.w * .86, sx = R.x + (R.w - sw) / 2, sh = R.h - 60, n = sc.n, cols = n <= 3 ? n : Math.ceil(n / 2), rows = Math.ceil(n / cols);
    out.push(box('roundRect', sx, R.y, sw, sh, { fill: shade(TEMPLATE.line, .35) }), box('rect', sx + 16, R.y + 16, sw - 32, sh - 32, { fill: '#FFFFFF' }));
    out.push(box('rect', R.x + R.w / 2 - 40, R.y + sh, 80, 36, { fill: shade(TEMPLATE.line, .2) }), box('roundRect', R.x + R.w / 2 - 150, R.y + sh + 36, 300, 22, { fill: shade(TEMPLATE.line, .35) }));
    const gx = 14, iw = (sw - 32 - 28 - gx * (cols - 1)) / cols, ih = (sh - 32 - 28 - gx * (rows - 1)) / rows;
    sc.items.forEach((it, i) => {
      const x = sx + 30 + (i % cols) * (iw + gx), y = R.y + 30 + Math.floor(i / cols) * (ih + gx), col = accent(i), S = Math.min(ih * .62, iw * .38);
      out.push(box('rect', x, y, iw, ih, { fill: PALE(col) }), rule(x, y, iw, 6, col));
      out.push(...comp(sc.icons[i].key, x + 10, y + (ih - S) / 2, S, col, it.label));
      out.push(...labelBlock(x + S + 18, y + 8, iw - S - 26, ih - 16, it, { align: 'left', max: 24 }));
    });
    return out;
  } });
reg({ key: 'p-cards', name: 'Illustrated cards', engine: 'B', family: 'p-cards', fits: F({ min: 2, max: 8, icons: true }), why: 'Cards with a large object above each point.',
  build: (R, sc) => {
    const out = [];
    slots(R, sc.n, perRow(sc.n, 4), 20, 20).forEach((r, i) => {
      const it = sc.items[i], col = accent(i), S = Math.min(r.w * .55, r.h * .48);
      out.push(box('roundRect', r.x, r.y, r.w, r.h, { fill: '#FFFFFF', line: LIGHT(col), lineW: 2 }), box('rect', r.x + 1, r.y + S * .5, r.w - 2, S * .5 + 16, { fill: PALE(col) }));
      out.push(...comp(sc.icons[i].key, r.x + (r.w - S) / 2, r.y + 10, S, col, it.label));
      out.push(...labelBlock(r.x + 10, r.y + S + 24, r.w - 20, r.h - S - 32, it, { valign: 'top', max: 24 }));
    });
    return out;
  } });
/* Rows with each point's own object beside it (numbered when the content states an order); two columns above 4 points. */
reg({ key: 'p-list', name: 'Illustrated list', engine: 'B', family: 'p-list', fits: F({ min: 2, max: 8, icons: true }), why: 'Each point in its own row, with its object beside it.',
  build: (R, sc) => {
    const n = sc.n, cols = n > 4 ? 2 : 1, per = Math.ceil(n / cols), gx = 28, gy = 12, w = (R.w - gx * (cols - 1)) / cols;
    const h = Math.min(130, (R.h - gy * (per - 1)) / per), y0 = R.y + (R.h - per * h - gy * (per - 1)) / 2, out = [];
    sc.items.forEach((it, i) => {
      const c = Math.floor(i / per), r = i % per, x = R.x + c * (w + gx), y = y0 + r * (h + gy), col = accent(i), S = h - 16;
      out.push(box('roundRect', x, y, w, h, { fill: PALE(col) }), box('ellipse', x + 8, y + 8, S, S, { fill: '#FFFFFF', line: col, lineW: 2 }),
        ...comp(sc.icons[i].key, x + 8 + S * .19, y + 8 + S * .19, S * .62, col, it.label));
      const nx = x + S + 20, lx = nx + (sc.ordered ? 50 : 0);
      if (sc.ordered) out.push(txt(nx, y + 4, 46, h - 8, num2(i), 26, { bold: true, color: accentText(col), align: 'left' }));
      out.push(...labelBlock(lx, y + 4, x + w - lx - 10, h - 8, it, { align: 'left', max: 24 }));
    });
    return out;
  } });
/* Ordered content only: each step's object stands on a numbered step that rises from left to right. */
reg({ key: 'p-stairs', name: 'Illustrated staircase', engine: 'B', family: 'p-stairs', fits: F({ min: 3, max: 7, ord: true, icons: true }), why: 'Each step\'s object on a rising, numbered step.',
  build: (R, sc) => {
    const n = sc.n, gap = 8, sw = (R.w - gap * (n - 1)) / n, S = Math.min(96, sw * .6), bmax = R.h - S - 8, bmin = Math.min(bmax, Math.max(150, R.h * .42));
    const rise = n > 1 ? (bmax - bmin) / (n - 1) : 0, out = [];
    sc.items.forEach((it, i) => {
      const x = R.x + i * (sw + gap), bh = bmin + rise * i, top = R.y + R.h - bh, col = accent(i);
      out.push(...comp(sc.icons[i].key, x + (sw - S) / 2, top - S - 6, S, col, it.label));
      out.push(box('rect', x, top, sw, bh, { fill: LIGHT(col) }), rule(x, top, sw, 6, col));
      out.push(txt(x + 6, top + 10, sw - 12, 36, num2(i), 26, { bold: true, color: accentText(col) }));
      out.push(...labelBlock(x + 6, top + 50, sw - 12, bh - 58, it, { valign: 'top', max: 24 }));
    });
    return out;
  } });
/* Technical content with links (architecture, data flow): objects placed by their links, joined by orthogonal connectors. */
reg({ key: 'p-arch', name: 'System scene', engine: 'B', family: 'p-arch', fits: Object.assign(sc => sc.mode === 'graph' && sc.model.nodes.length >= 2 && sc.model.nodes.length <= 10 && sc.model.edges.length > 0 && sc.iconsOK,
  { reason: sc => sc.mode !== 'graph' ? 'needs linked components' : !sc.iconsOK ? 'not every component has an accurate object' : 'needs 2-10 linked components' }),
  why: 'Each component drawn as an object, connected exactly as the content links them.',
  build: (R, sc) => {
    const m = sc.model, lay = layering(m, true), L = lay.L, nL = L.length, colW = R.w / nL, out = [], lines = [], pos = {};
    L.forEach((col, k) => {
      const rh = R.h / col.length, S = Math.min(110, colW * .5, rh - 46);
      col.forEach((nd, j) => { const cx = R.x + colW * (k + .5), y = R.y + j * rh + (rh - S - 40) / 2; pos[nd.id] = { cx, y, S, k }; });
    });
    m.edges.forEach(e => {
      const a = pos[e.from], b = pos[e.to];
      if (!a || !b || b.k <= a.k) return;
      const y1 = a.y + a.S / 2, y2 = b.y + b.S / 2, x1 = a.cx + a.S / 2 + 6, x2 = b.cx - b.S / 2 - 8, mx = (x1 + x2) / 2;
      lines.push(hLine(x1, mx, y1), vLine(mx, y1, y2), hLine(mx, x2 - 14, y2), tipRight(x2, y2));
    });
    m.nodes.forEach((nd, i) => { const p = pos[nd.id]; if (!p) return;
      out.push(...comp(sc.icons[i].key, p.cx - p.S / 2, p.y, p.S, accent(p.k), nd.label), txt(p.cx - colW / 2 + 6, p.y + p.S + 4, colW - 12, 40, nd.label, 22, { bold: true })); });
    return lines.concat(out);
  } });
reg({ key: 'p-neural', name: 'Neural network picture', engine: 'B', family: 'p-neural', partial: true, fits: Object.assign(sc => /neural/i.test(sc.text || '') && (sc.mode === 'items' || sc.mode === 'graph'), { reason: () => 'only for neural network content' }),
  why: 'Layers of nodes as native circles; the many crossing connections are one picture behind them.',
  build: (R, sc) => buildNeural(R, { nodes: sc.mode === 'graph' ? orderedNodes(sc.model) : sc.items, edges: [] }) });

/* Detail slides: every description in full (never below 22 pt), 1-4 points per slide. */
function detailPerSlide(R, items) {
  for (const k of [4, 3, 2, 1]) { const rh = (R.h - 16 * (k - 1)) / k; if (items.every(it => !it.detail || fitsAt(it.detail, R.w - 110, rh - 50, DETAIL_MIN))) return k; }
  return 1;
}
function buildDetail(R, items, start) {
  const k = items.length, gap = 16, rh = (R.h - gap * (k - 1)) / k, out = [];
  items.forEach((it, j) => {
    const i = start + j, y = R.y + j * (rh + gap), col = accent(i), D = Math.min(60, rh - 12);
    out.push(box('rect', R.x, y, R.w, rh, { fill: PALE(col) }), rule(R.x, y, 6, rh, col),
      box('ellipse', R.x + 20, y + 8, D, D, { fill: col, text: num2(i), size: TEMPLATE.minBody, bold: true, color: textOn(col), align: 'center', valign: 'middle' }),
      txt(R.x + D + 40, y + 4, R.w - D - 60, 44, it.label, 24, { bold: true, align: 'left', valign: 'middle' }));
    if (it.detail) out.push(txt(R.x + D + 40, y + 48, R.w - D - 60, rh - 52, it.detail, 22, { align: 'left', valign: 'top' }));
  });
  return out;
}
const detailPageCount = s => { const sc = s.scene || sceneOf(s), its = sc ? sc.items.filter(it => it.detail) : []; return its.length ? Math.ceil(its.length / detailPerSlide(TEMPLATE.contentArea, its)) : 0; };
const detailSlidesWanted = s => !!(s.choice && s.detailHidden && $('detailSlides').checked && detailPageCount(s));
async function addDetailSlides(context, slide, s) {
  const sc = s.scene || sceneOf(s), its = sc.items.map((it, i) => Object.assign({ i }, it)).filter(it => it.detail), k = detailPerSlide(TEMPLATE.contentArea, its), ids = [];
  const pages = Array.from({ length: Math.ceil(its.length / k) }, (_, p) => its.slice(p * k, p * k + k));
  let prev = slide;
  for (let p = 0; p < pages.length; p++) {
    const ns = await newSlideAfter(context, prev, (s.heading || state.docTitle || sc.topic || 'Details') + (pages.length > 1 ? ` (details ${p + 1} of ${pages.length})` : ' (details)'));
    const info = await readSlide(context, ns), fa = freeArea(info), R = fa.rect && fa.rect.w >= 520 ? fa.rect : TEMPLATE.contentArea;
    info.filter(x => x.removable && overlaps(x, R)).forEach(x => ns.shapes.getItem(x.id).delete());
    await context.sync();
    TIGHT.length = 0;
    // items keep their own numbers (01, 02 ...) so the detail slides match the overview
    const prims = pages[p].flatMap((it, j) => buildDetail({ x: R.x, y: R.y + j * (R.h + 16) / pages[p].length, w: R.w, h: (R.h + 16) / pages[p].length - 16 }, [it], it.i));
    await drawOnSlide(context, ns, prims, 'Details');
    ns.load('id');
    await context.sync();
    ids.push(ns.id);
    prev = ns;
  }
  return ids;
}

/* ===================== Engine C: charts and data visuals ===================== */
const DATA = sc => sc.mode === 'data' && sc.data.bars && sc.data.bars.values.length >= 2 && sc.data.bars.values.length <= 12;
function sortedBars(d) {
  const idx = d.values.map((_, i) => i).sort((a, b) => d.values[b] - d.values[a]);
  return { labels: idx.map(i => d.labels[i]), values: idx.map(i => d.values[i]), raws: idx.map(i => d.raws[i]) };
}
reg({ key: 'c-ranked', name: 'Ranked bars', engine: 'C', family: 'c-ranked', fits: DATA, why: 'Values sorted from highest to lowest with their rank.',
  build: (R, sc) => {
    const d = sortedBars(sc.data.bars), out = buildHBars({ x: R.x + 60, y: R.y, w: R.w - 60, h: R.h }, d, 0), rh = R.h / d.values.length;
    d.labels.forEach((_, i) => { const D = Math.min(40, rh - 8); out.push(box('ellipse', R.x + 8, R.y + i * rh + (rh - D) / 2, D, D, { fill: i ? LIGHT(accent(0)) : accent(0), text: String(i + 1), size: Math.max(16, Math.round(D * .45)), bold: true, color: i ? INK : '#FFFFFF', align: 'center', valign: 'middle' })); });
    return out;
  } });
reg({ key: 'c-lollipop', name: 'Lollipop chart', engine: 'C', family: 'c-lollipop', fits: DATA, why: 'Thin stems with a dot at each value: light and precise.',
  build: (R, sc) => {
    const d = sc.data.bars, n = d.values.length, out = [], lo = Math.min(0, ...d.values), hi = Math.max(0, ...d.values), span = hi - lo || 1;
    const labH = 64, top = R.y + 70, bottom = R.y + R.h - labH, zero = bottom - (0 - lo) / span * (bottom - top), slot = R.w / n, D = 30;
    out.push(rule(R.x, zero - 1, R.w, 2, TEMPLATE.line));
    d.values.forEach((v, i) => {
      const cx = R.x + slot * (i + .5), y = zero - v / span * (bottom - top);
      out.push(rule(cx - 2, Math.min(y, zero), 4, Math.abs(zero - y), LIGHT(accent(0))), box('ellipse', cx - D / 2, y - D / 2, D, D, { fill: accent(0) }));
      out.push(txt(cx - slot / 2, y - D / 2 - 40, slot, 36, d.raws[i], 22, { bold: true, valign: 'bottom' }), txt(cx - slot / 2 + 2, bottom + 8, slot - 4, labH - 8, d.labels[i], 20, { valign: 'top' }));
    });
    return out;
  } });
reg({ key: 'c-dots', name: 'Dot plot', engine: 'C', family: 'c-dots', fits: sc => DATA(sc) && sc.data.bars.values.length <= 8, why: 'Every value placed on one shared scale.',
  build: (R, sc) => {
    const d = sc.data.bars, n = d.values.length, out = [], lo = Math.min(...d.values), hi = Math.max(...d.values), pad = (hi - lo) * .1 || 1, a = lo - pad, b = hi + pad;
    const lw = Math.min(R.w * .28, Math.max(...d.labels.map(l => l.length)) * 11 + 20), x0 = R.x + lw + 20, W = R.w - lw - 120, rh = R.h / n;
    d.values.forEach((v, i) => {
      const y = R.y + i * rh + rh / 2, x = x0 + (v - a) / (b - a) * W;
      out.push(txt(R.x, y - rh / 2, lw, rh, d.labels[i], 20, { align: 'right' }), rule(x0, y - 1, W, 2, PALE(TEMPLATE.line)));
      out.push(box('ellipse', x - 13, y - 13, 26, 26, { fill: accent(i) }), txt(x + 18, y - rh / 2, 96, rh, d.raws[i], 20, { bold: true, align: 'left' }));
    });
    return out;
  } });
reg({ key: 'c-bubbles', name: 'Value bubbles', engine: 'C', family: 'c-bubbles', fits: sc => DATA(sc) && sc.data.bars.values.length <= 7 && sc.data.bars.values.every(v => v > 0), why: 'Circle areas proportional to each value, with the exact number inside.',
  build: (R, sc) => {
    const d = sc.data.bars, n = d.values.length, slot = R.w / n, mx = Math.max(...d.values), Dm = Math.min(slot - 12, R.h - 80), out = [];
    d.values.forEach((v, i) => {
      const D = Math.max(56, Dm * Math.sqrt(v / mx)), cx = R.x + slot * (i + .5), cy = R.y + (R.h - 70) / 2, col = accent(i);
      out.push(box('ellipse', cx - D / 2, cy - D / 2, D, D, { fill: col, text: d.raws[i], size: sizeFor(d.raws[i], D * .7, D * .5, 30), bold: true, color: textOn(col), align: 'center', valign: 'middle' }));
      out.push(txt(cx - slot / 2 + 4, R.y + R.h - 64, slot - 8, 60, d.labels[i], 20, { valign: 'top' }));
    });
    return out;
  } });
reg({ key: 'c-average', name: 'Bars with average', engine: 'C', family: 'c-average', fits: sc => DATA(sc) && sc.data.bars.values.length <= 10 && sc.data.bars.values.every(v => v >= 0),
  why: 'Bars with the average (calculated) marked as a reference line.',
  build: (R, sc) => {
    const d = sc.data.bars, avg = d.values.reduce((a, b) => a + b, 0) / d.values.length, inner = { x: R.x, y: R.y + 44, w: R.w, h: R.h - 44 }, out = buildBars(inner, d);
    const top = inner.y + 36, bottom = inner.y + inner.h - 66, hi = Math.max(0, ...d.values) || 1, y = bottom - avg / hi * (bottom - top);
    out.push(rule(R.x, y - 1.5, R.w, 3, accent(2)), txt(R.x, R.y, R.w, 40, `Average ${fmtValue(avg, d.unit === '%' ? '%' : '', { decimals: 2 })} (calculated from ${d.values.length} values)`, 22, { bold: true, color: accentText(accent(2)), align: 'right' }));
    return out;
  } });
reg({ key: 'c-tiles', name: 'Value tiles', engine: 'C', family: 'c-tiles', fits: sc => DATA(sc) && sc.data.bars.values.length <= 8, why: 'Each value as a tile with a bar showing its share of the largest.',
  build: (R, sc) => {
    const d = sc.data.bars, n = d.values.length, cols = n <= 4 ? n : Math.ceil(n / 2), rows = Math.ceil(n / cols), gap = 18, tw = (R.w - gap * (cols - 1)) / cols, th = Math.min(200, (R.h - gap * (rows - 1)) / rows), mx = Math.max(...d.values.map(Math.abs)) || 1, out = [];
    d.values.forEach((v, i) => {
      const x = R.x + (i % cols) * (tw + gap), y = R.y + Math.floor(i / cols) * (th + gap), col = accent(i);
      out.push(box('rect', x, y, tw, th, { fill: PALE(col) }), txt(x + 14, y + 10, tw - 28, th * .42, d.raws[i], 40, { bold: true, color: accentText(col), align: 'left' }));
      out.push(txt(x + 14, y + th * .42 + 10, tw - 28, th * .3, d.labels[i], 22, { align: 'left' }));
      out.push(rule(x + 14, y + th - 26, tw - 28, 10, '#FFFFFF'), rule(x + 14, y + th - 26, Math.max(2, (tw - 28) * Math.abs(v) / mx), 10, col));
    });
    return out;
  } });

reg({ key: 'c-hbars', name: 'Horizontal bars', engine: 'C', family: 'c-hbars', fits: DATA, why: 'Long labels stay readable; values in the source order.',
  build: (R, sc) => buildHBars(R, sc.data.bars, 0) });
/* Summary cards (highest, lowest, average: worked out in code and labeled) above the full chart. */
reg({ key: 'c-kpichart', name: 'Summary and chart', engine: 'C', family: 'c-kpichart', fits: sc => DATA(sc) && sc.data.bars.values.length >= 3 && sc.data.bars.values.length <= 8,
  why: 'Highest, lowest and average (calculated) above the full bar chart.',
  build: (R, sc) => {
    const d = sc.data.bars, v = d.values, hi = v.indexOf(Math.max(...v)), lo = v.indexOf(Math.min(...v)), avg = v.reduce((a, b) => a + b, 0) / v.length;
    const unit = d.unit === '%' ? '%' : '', kh = 104, items = [
      { label: `Highest: ${d.labels[hi]}`, value: d.raws[hi] }, { label: `Lowest: ${d.labels[lo]}`, value: d.raws[lo] },
      { label: `Average of ${v.length} (calculated)`, value: fmtValue(avg, unit, { decimals: 2 }) }];
    const out = [], gap = 18, cw = (R.w - 2 * gap) / 3;
    items.forEach((it, i) => {
      const x = R.x + i * (cw + gap), col = accent(i);
      out.push(box('rect', x, R.y, cw, kh, { fill: PALE(col) }), rule(x, R.y, 6, kh, col), txt(x + 16, R.y + 4, cw - 26, kh * .52, it.value, 34, { bold: true, color: accentText(col), align: 'left' }),
        txt(x + 16, R.y + kh * .52, cw - 26, kh * .45, it.label, 20, { align: 'left', valign: 'top' }));
    });
    return out.concat(buildBars({ x: R.x, y: R.y + kh + 20, w: R.w, h: R.h - kh - 20 }, d));
  } });

/* ===================== Suggestions: build, check, rank, de-duplicate ===================== */
/* Views V10.1 already had for this content (charts, tables, KPI, flows ...) come first, then the new arrangements. */
function baseViews(s) {
  const m = s.model;
  return viewKinds(m).map(k => ({ key: k, name: KIND_NAMES[k], engine: /^(kpi|table|vbar|hbar|line|grouped|stacked|distribution|donut|heatmap|scatter|progress|chart|hbar-ai|funnel)$/.test(k) ? 'C' : 'A',
    family: 'base-' + k, base: true, why: k === viewKinds(m)[0] ? 'Recommended for this content.' : 'Another exact view of this content.' }));
}
function buildChoice(R, s, key, page) {
  const g = GEN.find(x => x.key === key);
  if (!g) return buildDiagram(R, s.model, key, page);
  TIGHT.length = 0; detailsHidden = 0; grpSeq = 0;
  // the standard (brand.js) first, so lines that go into a picture on older PowerPoint are in it too
  return { kind: key, prims: nativeOnly(brandPrims(g.build(R, s.scene || (s.scene = sceneOf(s)), 0) || [])), hidden: detailsHidden };
}
/* Visual relevance check for anything that draws objects: each object must be the one chosen for its own point (or
   for the topic), no point may be left without an accurate object in a pictorial scene, every point must be shown,
   and an order stated in the content must stay visible. Returns the reasons a suggestion is rejected. */
function relevanceIssues(sc, c, prims) {
  const used = [...new Set(prims.map(p => p.cmp).filter(Boolean))], fail = [];
  if (!used.length) return fail;
  const allowed = new Set(sc.icons.filter(Boolean).map(i => i.key).concat(sc.domainIcon ? [sc.domainIcon.key] : [], sc.mainIcon ? [sc.mainIcon.key] : []));
  if (c.engine === 'B' && used.includes('none')) fail.push('a point has no accurate object');
  const foreign = used.filter(k => k !== 'none' && !allowed.has(k));
  if (foreign.length) fail.push('object not chosen for any point: ' + foreign.map(k => CMP_NAMES[k] || k).join(', '));
  const text = prims.filter(p => p.text).map(p => p.text).join('\n').toLowerCase(), miss = sc.items.filter(it => !text.includes(it.label.toLowerCase()));
  if (miss.length) fail.push(`point "${miss[0].label}" is missing`);
  if (sc.ordered && /hub|radial|quadrant/.test(c.family)) fail.push('it would hide the stated order');
  return fail;
}
const editability = prims => prims.some(p => p.t === 'image') ? 'partial' : 'full';
const EDIT_LABEL = { full: 'Fully editable', partial: 'Partially editable', image: 'Image only' };
function signature(prims) { return prims.filter(p => p.t !== 'image').map(p => [p.t, p.g || '', Math.round(p.x / 20), Math.round(p.y / 20), Math.round(p.w / 20), Math.round(p.h / 20)].join(':')).sort().join('|'); }

function suggest(s) {
  const t0 = performance.now(), R = Object.assign({}, TEMPLATE.contentArea), sc = s.scene = sceneOf(s), out = [], seen = new Set();
  if (!sc) return { list: [], ms: 0, note: '' };
  const dropped = [], fit = g => { try { return g.fits(sc); } catch (e) { return false; } };
  // Every layout that is not offered is logged with its exact reason (shown under "Why not more suggestions?").
  if (sc.mode === 'items' || sc.mode === 'graph') GEN.filter(g => g.engine !== 'C' && !fit(g)).forEach(g => dropped.push(`${g.name}: not offered - ${g.fits.reason ? g.fits.reason(sc) : 'not suitable'}`));
  // the earlier views draw the raw model; for prose that is its sentences, not the ideas every other view and the
  // Napkin check use, so prose gets only the layouts built from the scene
  const cands = (sc.prose ? [] : baseViews(s)).concat(GEN.filter(fit));
  cands.forEach((c, order) => {
    let r;
    try { r = c.base ? buildDiagram(R, s.model, c.key, 0) : buildChoice(R, s, c.key, 0); } catch (e) { dropped.push(`${c.name}: build error ${e.message}`); return; }
    if (!r || !r.prims.length || (c.base && r.kind !== c.key)) return;
    const issues = checkLayout(r.prims, R), tight = TIGHT.filter(t => !/^Links not drawn/.test(t)).length, hidden = detailsHidden;
    if (issues.length || tight > Math.max(1, sc.n / 2)) { dropped.push(`${c.name}: rejected - ${issues[0] || tight + ' labels do not fit at ' + TEMPLATE.minBody + ' pt'}`); return; }
    // geometry: labels on icons or connectors, overlapping circles, decorative graphics (svg2ppt.js, shared with Napkin output)
    const vq = visualQuality(qualityItems(r.prims), R);
    if (vq.excluded) { dropped.push(`${c.name}: rejected - ${vq.block[0]}`); return; }
    const rel = c.base ? [] : relevanceIssues(sc, c, r.prims);
    if (rel.length) { dropped.push(`${c.name}: rejected - ${rel.join('; ')}`); return; }
    const sig = signature(r.prims);
    if (seen.has(sig) || out.some(o => o.family === c.family)) { dropped.push(`${c.name}: rejected - duplicate of a suggestion already shown`); return; }
    seen.add(sig);
    const ed = c.partial ? 'partial' : editability(r.prims);
    const objects = [...new Set(r.prims.filter(p => p.cmp && p.cmp !== 'none').map(p => CMP_NAMES[p.cmp]))];
    // Deterministic suitability: exact existing views first, then structure fit, readability and full editability.
    const score = (c.base ? 100 - order : 60) + (sc.ordered && /chevrons|stairs|vsteps|arrowband|snake|timeline|circleflow|p-row|p-path/.test(c.family) ? 12 : 0)
      + (sc.compare && /versus|split/.test(c.family) ? 12 : 0) + (!sc.ordered && /p-radial/.test(c.family) ? 14 : 0)
      + (ed === 'full' ? 4 : 0) - tight * 3 - (c.base ? 0 : hidden * 2) + (c.engine === 'B' ? 4 : 0);
    out.push({ key: c.key, name: c.name, engine: c.engine, family: c.family, why: c.why, edit: ed, score, prims: r.prims, base: !!c.base, hidden: c.base ? 0 : hidden, objects });
  });
  out.sort((a, b) => b.score - a.score);
  // How many is decided by the content, never padded: one statement -> a few options; two points -> up to 8 two-element
  // layouts and 4 pictorial; a list of 3-10 points -> up to 15 infographic and 10 pictorial; data -> up to 15 charts.
  const one = /^(?:relation|definition|statement)$/.test(sc.mode);
  const CAP = one ? { A: 6, B: 0, C: 0 } : sc.mode === 'items' && sc.n === 2 ? { A: 8, B: 4, C: 15 } : { A: 15, B: 10, C: 15 }, kept = { A: 0, B: 0, C: 0 };
  const list = out.filter(c => {
    if (kept[c.engine] >= CAP[c.engine]) { dropped.push(`${c.name}: not shown - only the ${CAP[c.engine]} best-suited of this kind are listed`); return false; }
    kept[c.engine]++;
    return true;
  });
  const ms = performance.now() - t0;
  return { list, ms, dropped, scene: sc };
}

/* ===================== Gallery UI ===================== */
const PAGE = 20;
function thumb(prims) {
  const R = TEMPLATE.contentArea;
  return toSVG(prims, SLIDE.w, SLIDE.h).replace(/viewBox="[^"]*"/, `viewBox="${R.x - 12} ${R.y - 12} ${R.w + 24} ${R.h + 24}"`);
}
function renderGallery() {
  const s = state.sec, box3 = $('gallery');
  if (!s || !s.model || s.status !== 'ready' || s.model.type === 'none' || s.model.type === 'illustration') { box3.hidden = true; return; }
  if (!s.gallery) s.gallery = suggest(s);
  const G = s.gallery, A = G.list.filter(x => x.engine !== 'B'), B = G.list.filter(x => x.engine === 'B'), run = (s.galleryRun = (s.galleryRun || 0) + 1);
  box3.hidden = !G.list.length;
  const off = (s.galleryOffset || 0) % Math.max(1, A.length), showA = A.length > PAGE ? A.slice(off, off + PAGE).concat(off + PAGE > A.length ? A.slice(0, off + PAGE - A.length) : []) : A;
  const sc = G.scene, isData = sc && sc.mode === 'data';
  $('gTitleA').textContent = isData ? 'Chart and data suggestions' : 'Infographic suggestions';
  $('gCountA').textContent = `${A.length} valid`;
  $('gCountB').textContent = B.length ? `${B.length} valid` : '';
  $('gGroupB').hidden = !B.length;
  $('gMore').hidden = A.length <= PAGE;
  const n = sc && sc.n;
  const noPict = sc && sc.mode === 'items' && !B.length && !sc.iconsOK ? ` No pictorial suggestion: no accurate object for “${sc.items[sc.icons.findIndex(i => !i.matched)].label}”, and a generic picture is never used instead.` : '';
  const oneNote = sc && /^(?:relation|definition|statement)$/.test(sc.mode) ? `One statement: ${A.length} accurate option${A.length === 1 ? '' : 's'}. More would only repeat it or add parts the text does not state. ` : '';
  $('gNote').innerHTML = esc(oneNote + (sc && sc.mode === 'items' ? `All ${A.length + B.length} suggestions show the same ${n} point${n === 1 ? '' : 's'}${sc.ordered ? ', in the order given' : ''}; nothing is added or left out. ` : '') +
    (A.length < 10 && !oneNote ? `Only ${A.length} infographic arrangement${A.length === 1 ? ' is' : 's are'} valid for this content` + (sc && sc.mode === 'fixed' ? ' (formulas, conditions, exact values and long lists keep their exact structure).' : sc && sc.mode === 'graph' ? ' (its links must be drawn as stated, which rules out free arrangements).' : '.') : '') +
    noPict + ` Built in ${Math.round(G.ms)} ms without any extra AI call.`) +
    (G.dropped && G.dropped.length ? `<details><summary>Why not more suggestions? (${G.dropped.length})</summary><ul>${G.dropped.map(d => `<li>${esc(d)}</li>`).join('')}</ul></details>` : '');
  // 10.21: every design carries its number in the whole set (stable when "More variants" pages), the chosen one says so
  const num = c => G.list.indexOf(c) + 1;
  const t0 = performance.now(), cardsHTML = c => `<button type="button" class="gcard${isChosen(s, c) ? ' sel' : ''}" data-key="${esc(c.key)}" data-n="${num(c)}" aria-pressed="${isChosen(s, c)}" aria-label="Design ${num(c)} of ${G.list.length}: ${esc(c.name)}" title="${esc(c.why + (c.objects.length ? ' Objects: ' + c.objects.join(', ') + '.' : ''))}"><span class="gnum">${num(c)}</span><div class="gthumb"></div>` +
    `<div class="gname">${esc(c.name)}</div><div class="gwhy">${esc(c.engine === 'B' && c.objects.length ? c.objects.join(' · ') : c.why)}</div>` +
    `<span class="badge ${c.edit}">${EDIT_LABEL[c.edit]}</span>${c.hidden ? ' <span class="badge partial" title="Descriptions go on detail slides">+ detail slides</span>' : ''}</button>`;
  $('gridA').innerHTML = showA.map(cardsHTML).join('');
  $('gridB').innerHTML = B.map(cardsHTML).join('');
  document.querySelectorAll('#gallery .gcard').forEach(b => b.addEventListener('click', () => chooseSuggestion(b.dataset.key)));
  // Thumbnails a few at a time so the panel stays responsive; a newer render cancels this one.
  const todo = [...document.querySelectorAll('#gallery .gcard')];
  let i = 0;
  const step = () => {
    if (s.galleryRun !== run || state.sec !== s) return;
    for (const end = i + 4; i < end && i < todo.length; i++) {
      const c = G.list.find(x => x.key === todo[i].dataset.key);
      if (c) todo[i].querySelector('.gthumb').innerHTML = thumb(c.prims);
      if (i === 4 && s.timings) s.timings.first5 = performance.now() - t0 + G.ms;
    }
    if (i < todo.length) requestAnimationFrame(step);
    else if (s.timings) { s.timings.galleryAll = performance.now() - t0 + G.ms; s.timings.galleryCount = G.list.length; renderPerf(); }
  };
  requestAnimationFrame(step);
}
const isChosen = (s, c) => (s.choice || s.want || (state.diagram && state.diagram.kind)) === c.key;
function chooseSuggestion(key) {
  const s = state.sec;
  if (!s) return;
  const c = s.gallery && s.gallery.list.find(x => x.key === key);
  if (!c) return;
  if (c.base) { s.choice = null; s.want = key; } else { s.choice = key; s.want = ''; }
  s.userPicked = true; s.page = 0; s.view = 'diagram';
  buildPreview(); renderResult(); renderSections();
  document.querySelectorAll('#gallery .gcard').forEach(b => { const on = b.dataset.key === key; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', on); });
  setStatus(`Selected design ${s.gallery.list.indexOf(c) + 1} of ${s.gallery.list.length}: ${c.name} (${EDIT_LABEL[c.edit].toLowerCase()}). Check the large preview, click a slide, then press Insert visual.`);
}
// 10.21: arrow keys move through the designs (and choose the one reached), Home / End jump to the first / last shown
function galleryKey(e) {
  const cards = [...document.querySelectorAll('#gallery .gcard')], at = cards.indexOf(document.activeElement);
  if (at < 0 || !/^(Arrow(Left|Right|Up|Down)|Home|End)$/.test(e.key)) return;
  const row = Math.max(1, cards.filter(b => b.offsetTop === cards[at].offsetTop && b.parentNode === cards[at].parentNode).length);
  const to = e.key === 'Home' ? 0 : e.key === 'End' ? cards.length - 1
    : Math.min(cards.length - 1, Math.max(0, at + ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -row, ArrowDown: row })[e.key]));
  e.preventDefault();
  if (to === at) return;
  cards[to].focus(); cards[to].scrollIntoView({ block: 'nearest' }); chooseSuggestion(cards[to].dataset.key);
}

/* ===================== PowerPoint drawing self-test (Setup) =====================
   Checks on the real PowerPoint what the visuals rely on: straight/elbow/curved lines, a line turned by rotation (any
   direction), dashed lines, a turned triangle as arrowhead, grouping and ungrouping. Everything goes on one new slide
   after the selected one, which stays so the result can be looked at (delete it afterwards). The results are shown here
   and saved by the panel host to selftest.json (no slide content is sent anywhere else). */
async function pptSelfTest() {
  const out = $('ppTestOut'), res = { at: new Date().toISOString(), api: {}, steps: [] };
  ['1.4', '1.5', '1.8', '1.10'].forEach(v => { res.api[v] = Office.context.requirements.isSetSupported('PowerPointApi', v); });
  out.textContent = 'Testing…';
  try {
    await PowerPoint.run(async context => {
      const sel = context.presentation.getSelectedSlides(), cnt = sel.getCount();
      await context.sync();
      if (!cnt.value) throw new Error('Click a slide in the slide list first.');
      const slide = await newSlideAfter(context, sel.getItemAt(0), 'AI Visual Builder drawing test (you can delete this slide)'), sh = slide.shapes;
      const read = async s => { s.load('id,type,left,top,width,height'); await context.sync(); const o = { type: s.type, left: r1(s.left), top: r1(s.top), width: r1(s.width), height: r1(s.height) };
        try { s.load('rotation'); await context.sync(); o.rotation = s.rotation; } catch (e) { /* rotation needs 1.10 */ } return o; };
      const step = async (name, f) => { try { res.steps.push({ name, ok: true, got: await f() }); } catch (e) { res.steps.push({ name, ok: false, error: errText(e) }); } };
      const note = (x, y, t) => { const b = sh.addTextBox(t, { left: x, top: y, width: 260, height: 30 }); b.textFrame.textRange.font.size = 14; b.textFrame.textRange.font.name = TEMPLATE.font; };
      await step('addLine Straight (top-left to bottom-right)', async () => { const l = sh.addLine('Straight', { left: 120, top: 200, width: 160, height: 90 }); note(120, 170, 'Straight'); return read(l); });
      await step('addLine Elbow', async () => { const l = sh.addLine('Elbow', { left: 340, top: 200, width: 160, height: 90 }); note(340, 170, 'Elbow'); return read(l); });
      await step('addLine Curve', async () => { const l = sh.addLine('Curve', { left: 560, top: 200, width: 160, height: 90 }); note(560, 170, 'Curve'); return read(l); });
      await step('line turned to point up-right (rotation)', async () => {
        const p = { x1: 800, y1: 290, x2: 960, y2: 200, color: '#3645A9', lineW: 3 }, l = drawPrim(sh, Object.assign({ t: 'line', x: 800, y: 200, w: 160, h: 90 }, p)); note(800, 170, 'Up-right (should rise to the right)'); return read(l); });
      await step('dashed line', async () => { const l = sh.addLine('Straight', { left: 120, top: 360, width: 200, height: 1 }); l.lineFormat.dashStyle = 'Dash'; l.lineFormat.weight = 3; await context.sync(); return read(l); });
      await step('arrowhead: triangle turned 90 degrees', async () => { const t = drawPrim(sh, Object.assign(headAt(400, 360, 0, 24, '#F26B43'))); note(340, 380, 'Arrowhead should point right'); return read(t); });
      await step('group and ungroup', async () => {
        const a = sh.addGeometricShape(geomType('ellipse'), { left: 560, top: 340, width: 60, height: 60 }), b = sh.addLine('Straight', { left: 620, top: 370, width: 80, height: 40 });
        a.load('id'); b.load('id'); await context.sync();
        const g = sh.addGroup([a.id, b.id]); g.load('id,type'); await context.sync();
        const r = { groupType: g.type };
        try { g.group.ungroup(); await context.sync(); r.ungrouped = true; } catch (e) { r.ungroupError = errText(e); }
        return r;
      });
    });
  } catch (e) { res.error = errText(e); }
  const ok = res.steps.filter(s => s.ok).length;
  out.innerHTML = esc(`${ok} of ${res.steps.length} drawing checks passed${res.error ? ' - ' + res.error : ''}. `) + res.steps.map(s => `<br>${s.ok ? '✓' : '✗'} ${esc(s.name)}${s.ok ? '' : ': ' + esc(s.error)}`).join('') +
    '<br>Look at the new test slide: the up-right line should rise to the right and the arrowhead should point right.';
  try { await api('/api/selftest', res); } catch (e) { /* saving the result is optional */ }
}
$('ppTest').addEventListener('click', pptSelfTest);
const ppTestTimer = setInterval(() => { if (state.inOffice) { $('ppTest').hidden = false; clearInterval(ppTestTimer); } }, 1000);
