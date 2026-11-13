/* AI Visual Builder 10.5 - the Simplilearn visual standard, applied to every visual before it is previewed or inserted
   (the native layouts here; Napkin SVG output in svg2ppt.js, which uses brandColor too). No manual approval step:
     - Open Sans only (drawPrim and tables set it on every text)
     - nothing below 22 pt: smaller text is raised; a label that then no longer fits is reported (the layout is not
       offered, or its descriptions go to detail slides) - text is never shrunk below the minimum
     - the approved palette and neutrals only: tints, shades and any other colour go to the nearest approved colour
     - solid fills (the add-in never sets gradients or shadows), flat filled icons: no outline-only icon parts and no
       outlines around filled icon parts
     - readable text: #404040 on light fills, white only on the dark neutral */
const BRAND = { palette: TEMPLATE.accents.slice(), neutrals: TEMPLATE.neutrals.slice(), font: TEMPLATE.font, minPt: TEMPLATE.minBody, ink: TEMPLATE.text };
const APPROVED = new Set(BRAND.palette.concat(BRAND.neutrals));
/* 10.17: soft tints - one light tint of each palette colour for card and panel fills (the pastel cards of AI
   infographics). Off unless the administrator allows them (config.json "soft_tints": true, sent with /api/status, or
   TEMPLATE.softTints); when off, a tint becomes the light panel grey as before. Text and objects never use them. */
const SOFT_T = 0.84;
const SOFT_SET = new Set(BRAND.palette.map(c => tint(c, SOFT_T)));
const softTints = () => !!(TEMPLATE.softTints || (typeof state !== 'undefined' && state && state.svc && state.svc.brand && state.svc.brand.soft_tints));
const approved = (c, k) => APPROVED.has(c) || (k === 'fill' && softTints() && SOFT_SET.has(c));
// Shapes never become #404040 (that is the text colour; dark filled graphics read as silhouettes, LVC guidelines p. 53).
const NEAREST = BRAND.palette.concat(['#D9D9D9', '#7F7F7F']);

/* '#abc', '#aabbcc', 'rgb(1, 2, 3)', 'rgba(...)', 'white' -> { hex, a } or null ('none', 'transparent', url(...)). */
function parseColor(c) {
  const s = String(c == null ? '' : c).trim().toLowerCase();
  let m;
  if (!s || s === 'none' || s === 'transparent' || s.startsWith('url(')) return null;
  if ((m = /^#([0-9a-f]{3})$/.exec(s))) return { hex: '#' + m[1].split('').map(x => x + x).join('').toUpperCase(), a: 1 };
  if ((m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(s))) return { hex: '#' + m[1].toUpperCase(), a: m[2] ? parseInt(m[2], 16) / 255 : 1 };
  if ((m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/.exec(s)))
    return { hex: rgbToHex([+m[1], +m[2], +m[3]]), a: m[4] == null ? 1 : /%$/.test(m[4]) ? parseFloat(m[4]) / 100 : +m[4] };
  return { white: { hex: '#FFFFFF', a: 1 }, black: { hex: '#000000', a: 1 } }[s] || null;
}
const colorDist = (p, q) => { const a = hexToRgb(p), b = hexToRgb(q), r = (a[0] + b[0]) / 2;   // "redmean" perceptual distance
  return Math.sqrt((2 + r / 256) * (a[0] - b[0]) ** 2 + 4 * (a[1] - b[1]) ** 2 + (2 + (255 - r) / 256) * (a[2] - b[2]) ** 2); };
/* The approved colour for any colour. Very light colours become white or the light panel grey, so pale card
   backgrounds stay light; everything else becomes the nearest palette colour or neutral. */
function brandColor(c) {
  const p = typeof c === 'object' && c ? c : parseColor(c);
  if (!p) return null;
  const hex = p.a < 1 ? mix(p.hex, '#FFFFFF', 1 - p.a) : p.hex;      // transparency over the white slide
  if (APPROVED.has(hex)) return hex;
  const L = luminance(hex);
  if (L > 0.96) return '#FFFFFF';
  if (L > 0.78) return '#F2F2F2';
  return NEAREST.reduce((b, q) => colorDist(hex, q) < colorDist(hex, b) ? q : b, NEAREST[0]);
}
const readableOn = fill => fill && luminance(fill) <= 0.22 ? '#FFFFFF' : BRAND.ink;

/* One primitive in the standard, or null (an outline-only decoration inside an icon). stats counts the corrections. */
function brandPrim(p, stats) {
  const q = Object.assign({}, p);
  if (q.t === 'table') {
    q.cells = (q.cells || []).map(c => brandPrim(c, stats)).filter(Boolean);
    if (q.size < BRAND.minPt) { q.size = BRAND.minPt; stats.raised++; }
    return q;
  }
  if (q.t === 'image') return q;                       // pictures are made in the standard where they are made
  ['fill', 'line', 'color'].forEach(k => { if (q[k] && k !== 'color' && !approved(q[k], q.cmp ? 'part' : k)) { q[k] = brandColor(q[k]); stats.recolored++; } });
  if (q.t === 'line' && q.color && !APPROVED.has(q.color)) { q.color = brandColor(q.color); stats.recolored++; }
  if (q.grp && q.t === 'shape') {                      // a part of a pictorial icon: flat and filled
    if (!q.fill && q.line) { if (q.dash) { stats.outlines++; return null; } q.fill = q.line; stats.outlines++; }
    else if (q.fill === '#FFFFFF' && q.line) { q.fill = '#D9D9D9'; stats.outlines++; }
    delete q.line; delete q.lineW; delete q.dash;
  } else if (q.t === 'shape' && q.fill && q.line) {   // flat: no outlines around filled shapes; a white outlined frame becomes a solid light panel
    if (q.fill === '#FFFFFF') { q.fill = '#F2F2F2'; stats.outlines++; }
    delete q.line; delete q.lineW;
  }
  // LVC guidelines: no dashed lines (p. 21), circles never distorted (p. 31), no right-aligned text (p. 40)
  if (q.dash) { delete q.dash; stats.recolored++; }
  if (q.t === 'shape' && q.g === 'ellipse' && q.w !== q.h && Math.max(q.w, q.h) / Math.min(q.w, q.h) < 1.25) {
    const d = Math.min(q.w, q.h); q.x += (q.w - d) / 2; q.y += (q.h - d) / 2; q.w = q.h = d;
  }
  if (q.align === 'right') q.align = 'center';
  if (q.text != null && String(q.text).trim()) {
    q.color = q.t === 'shape' && q.fill ? readableOn(q.fill) : BRAND.ink;
    q.font = BRAND.font;
    if (!(q.size >= BRAND.minPt)) {
      q.size = BRAND.minPt; stats.raised++;
      const r = q.t === 'text' ? q : textRect(q.g, q.x, q.y, q.w, q.h);
      if (!fitsAt(q.text, r.w, r.h, q.size) && !TIGHT.includes(q.text)) TIGHT.push(q.text);
    }
  }
  return q;
}
let BRAND_LAST = { raised: 0, recolored: 0, outlines: 0 };
function brandPrims(prims) {
  const stats = { raised: 0, recolored: 0, outlines: 0 };
  const out = (prims || []).map(p => brandPrim(p, stats)).filter(Boolean);
  // Icons stay clearly visible on white: a light grey part becomes white when it is a small detail, mid grey when it is a body.
  const box = {};
  out.forEach(p => { if (!p.cmp) return; const b = box[p.grp] = box[p.grp] || [1e9, 1e9, -1e9, -1e9]; b[0] = Math.min(b[0], p.x); b[1] = Math.min(b[1], p.y); b[2] = Math.max(b[2], p.x + p.w); b[3] = Math.max(b[3], p.y + p.h); });
  out.forEach(p => { if (p.cmp && p.fill === '#F2F2F2') { const b = box[p.grp]; p.fill = p.w * p.h < 0.15 * (b[2] - b[0]) * (b[3] - b[1]) ? '#FFFFFF' : '#D9D9D9'; } });
  BRAND_LAST = stats;
  return out;
}
/* Every builder's result goes through the standard (wrapping keeps the builders unchanged). */
/* Text boxes and cards with round corners (LVC guidelines p. 22: avoid sharp corners); thin rules, table cells and
   chart bars stay rectangles. */
const DATA_KIND = /^(?:kpi|table|vbar|hbar|line|grouped|stacked|distribution|donut|heatmap|scatter|progress|chart|hbar-ai|funnel|c-)/;
function roundCorners(prims) {
  return prims.map(p => p.t === 'shape' && p.g === 'rect' && !p.cmp && Math.min(p.w, p.h) >= 40 && (p.text || p.w * p.h >= 6000) ? Object.assign({}, p, { g: 'roundRect' }) : p);
}
const branded = f => function () {
  const r = f.apply(this, arguments);
  if (r && r.prims) { r.prims = brandPrims(r.prims); if (!DATA_KIND.test(r.kind || '')) r.prims = roundCorners(r.prims); }
  return r;
};
buildDiagram = branded(buildDiagram);
buildChoice = branded(buildChoice);
const unbrandedDetail = buildDetail;
buildDetail = function () { return brandPrims(unbrandedDetail.apply(this, arguments)); };
