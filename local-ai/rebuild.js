/* AI Visual Builder V10.8 - a Napkin AI result rebuilt in the approved template.

   Napkin draws for its own page (4:3, small text, every pillar or icon one custom outline). Shape by shape, such a design
   lands small in the template's wide content area, with 7-15 pt text and parts that can only be pictures. So a result
   whose structure is recognised is rebuilt: Napkin's heading, its items (title, description, icon, colour) and their
   order, drawn as native, editable shapes and text in the content area, at the guideline sizes, in Open Sans and the
   approved palette. Napkin's icons stay Napkin's (one small picture each). A point of the user's content that Napkin
   left out becomes one more item of the same infographic, never a separate card beside it.
   A design that is not recognised goes in as converted shape by shape (svg2ppt.js), and a missing point is reported.

   Parts first (texts, coloured fills, icons; source coordinates), then items, then the layout. */

/* Napkin's PowerPoint slide (pptx.js pptxRead) as parts. */
function napkinPartsPpt(slide) {
  const els = (slide && slide.els) || [], texts = [], fills = [], icons = [];
  if (!els.length || els.some(e => e.k === 'frame')) return null;     // tables and charts are not rebuilt
  const ext = unionBox(els.map(e => e.k === 'line' ? { x: Math.min(e.x1, e.x2), y: Math.min(e.y1, e.y2), w: Math.abs(e.x2 - e.x1), h: Math.abs(e.y2 - e.y1) } : e));
  const big = Math.max(ext.w, ext.h);
  els.forEach(e => {
    if (e.k === 'shape' && e.text) {
      const r = pptxTextRect(e), runs = e.text.paras.flatMap(p => p.runs).filter(x => x.t.trim());
      if (runs.length) texts.push({ x: r.x, y: r.y, w: r.w, h: r.h, text: e.text.paras.map(p => p.runs.map(x => x.t).join('')).join(' ').replace(/\s+/g, ' ').trim(),
        size: Math.max(...runs.map(x => x.size)), bold: runs.some(x => x.bold) });
    }
  });
  const shapes = els.filter(e => e.k === 'shape' && (e.fill || e.line));
  const coloured = e => e.fill && luminance(e.fill) < 0.9;
  const holds = (a, b) => b !== a && cx(b) > a.x && cx(b) < a.x + a.w && cy(b) > a.y && cy(b) < a.y + a.h && b.w * b.h < a.w * a.h;
  shapes.forEach(e => {
    // a coloured shape holding text or another shape (a card, a badge, a heading bar) or a large one: a fill
    if (coloured(e) && (Math.max(e.w, e.h) > big * 0.12 || texts.some(t => holds(e, t)) || shapes.some(o => holds(e, o)))) return fills.push({ x: e.x, y: e.y, w: e.w, h: e.h, color: e.fill, g: e.geom === 'ellipse' ? 'ellipse' : e.geom || 'rect' });
    if (e.text || Math.max(e.w, e.h) > big * 0.25) return;                                // backgrounds, connectors
    if (shapes.some(o => o !== e && coloured(o) && Math.abs(o.x - e.x) < 2 && Math.abs(o.y - e.y) < 2 && Math.abs(o.w - e.w) < 2 && Math.abs(o.h - e.h) < 2)) return;   // outline over a fill
    icons.push({ x: e.x, y: e.y, w: e.w, h: e.h, light: !e.fill || oneTone(e.fill), svg: col => pptxShapeSvg(e, col) });
  });
  els.filter(e => e.k === 'pic' && e.src && Math.max(e.w, e.h) <= big * 0.25).forEach(e =>
    icons.push({ x: e.x, y: e.y, w: e.w, h: e.h, light: !!e.svg && lightSvg(e.svg), svg: col => e.svg && col ? `<svg x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" viewBox="${svgViewBox(e.svg)}">${recolorSvg(e.svg, col).replace(/^[\s\S]*?<svg[^>]*>|<\/svg>\s*$/g, '')}</svg>`
      : `<image href="${e.src}" x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" preserveAspectRatio="none"/>` }));
  const lines = els.filter(e => e.k === 'line').map(e => ({ x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2 }));
  return { texts, fills, icons, lines };
}
/* Napkin's SVG (converted at its own scale by svgToPrims) as parts. */
function napkinPartsSvg(svgText) {
  let conv;
  try { conv = svgToPrims(svgText, { x: 0, y: 0, w: 1000, h: 1000 }); } catch (e) { return null; }
  const P = conv.prims, texts = [], fills = [], icons = [];
  const ext = unionBox(P.filter(p => p.t !== 'line')), big = Math.max(ext.w, ext.h);
  P.filter(p => p.t === 'text').forEach(p => texts.push({ x: p.x, y: p.y, w: p.w, h: p.h, text: String(p.text).replace(/\s+/g, ' ').trim(), size: p.srcSize || p.size, bold: !!p.bold }));
  const shapes = P.filter(p => p.t === 'shape');
  const holds = (a, b) => b !== a && cx(b) > a.x && cx(b) < a.x + a.w && cy(b) > a.y && cy(b) < a.y + a.h && b.w * b.h < a.w * a.h;
  shapes.forEach(p => {
    if (p.fill && luminance(p.fill) < 0.9 && (Math.max(p.w, p.h) > big * 0.12 || texts.some(t => holds(p, t)) || P.some(o => holds(p, o)))) fills.push({ x: p.x, y: p.y, w: p.w, h: p.h, color: p.fill, g: p.g });
    else if (Math.max(p.w, p.h) <= big * 0.12 && Math.min(p.w, p.h) > 4) icons.push(   // thin rectangles are connectors, not icons
      { x: p.x, y: p.y, w: p.w, h: p.h, light: !p.fill || oneTone(p.fill), svg: col => shapeSVG(Object.assign({}, p, { fill: p.fill && (col || p.fill), line: p.line && (col || p.line) })) });
  });
  // Napkin draws circles, pillars and half-discs as curved paths (kept as pictures by the converter): a large one-colour
  // picture is a coloured area like a filled shape (a hub, a card, a pillar), so the structure sees it
  P.filter(p => p.t === 'image' && Math.max(p.w, p.h) > big * 0.12).forEach(p => {
    const col = [...String(p.svg).matchAll(/fill\s*[:=]\s*["']?\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))/g)].map(m => parseColor(m[1])).find(c => c && luminance(c.hex) < 0.9);
    if (col) fills.push({ x: p.x, y: p.y, w: p.w, h: p.h, color: col.hex, g: Math.abs(p.w - p.h) < 0.12 * Math.max(p.w, p.h) ? 'ellipse' : 'shape', pic: true });
  });
  P.filter(p => p.t === 'image' && Math.max(p.w, p.h) <= big * 0.25).forEach(p =>
    icons.push({ x: p.x, y: p.y, w: p.w, h: p.h, light: lightSvg(p.svg), svg: col => `<svg x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" viewBox="${svgViewBox(p.svg)}">${(col ? recolorSvg(p.svg, col) : p.svg).replace(/^[\s\S]*?<svg[^>]*>|<\/svg>\s*$/g, '')}</svg>` }));
  const lines = P.filter(p => p.t === 'line').map(p => ({ x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2 }))
    .concat(shapes.filter(p => Math.min(p.w, p.h) <= 4 && Math.max(p.w, p.h) > 20).map(p => p.w >= p.h ? { x1: p.x, y1: p.y + p.h / 2, x2: p.x + p.w, y2: p.y + p.h / 2 } : { x1: p.x + p.w / 2, y1: p.y, x2: p.x + p.w / 2, y2: p.y + p.h }));
  return { texts, fills, icons, lines };
}
/* Napkin's design as heading + items (null when not recognised), kept on the item: the check and the build read it. An
   item that is one of the content's own headings ("More Quick Facts") is a heading, not a point: left out. */
function napkinStructure(it, drop) {
  if (it.structure === undefined) {
    try { it.structure = napkinItems(it.fmt === 'ppt' ? napkinPartsPpt(it.pptSlide) : napkinPartsSvg(it.data)); } catch (e) { it.structure = null; }
  }
  let st = it.structure;
  const norm = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(), hs = new Set((drop || []).map(norm));
  // a heading phrased as a question that is not in the text ("Which fact or option is listed?") turns the content into a
  // quiz: the content's own title takes its place (none: no heading)
  if (st && st.head && /\?\s*$/.test(st.head.text) && !String(it.source || '').includes(st.head.text.trim())) {
    st = Object.assign({}, st, { head: it.title ? Object.assign({}, st.head, { text: it.title }) : null, headReplaced: st.head.text });
  }
  if (!st || !hs.size) return st;
  const items = st.items.filter(u => !hs.has(norm(u.label)));
  return items.length >= 2 ? Object.assign({}, st, { items }) : st;
}
const napkinHeading = it => { const st = napkinStructure(it); return st && st.head ? st.head.text : ''; };
const cx = b => b.x + b.w / 2, cy = b => b.y + b.h / 2;
const unionBox = bs => { const x = Math.min(...bs.map(b => b.x)), y = Math.min(...bs.map(b => b.y)); return { x, y, w: Math.max(...bs.map(b => b.x + b.w)) - x, h: Math.max(...bs.map(b => b.y + b.h)) - y }; };
const svgViewBox = s => (/viewBox="([^"]+)"/.exec(s) || [0, '0 0 24 24'])[1];
// every colour of an icon becomes one colour (an icon in the item's colour on a white badge); "none" stays none
// a one-colour glyph (all white or all near-black): it takes the item's colour on the white badge; a two-tone icon keeps
// Napkin's colours
const oneTone = hex => luminance(hex) > 0.8 || luminance(hex) < 0.15;
const lightSvg = s => { const cols = [...String(s).matchAll(/(?:fill|stroke)\s*[:=]\s*["']?\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|white|black)/g)].map(m => parseColor(m[1])).filter(Boolean);
  return cols.length > 0 && (cols.every(c => luminance(c.hex) > 0.8) || cols.every(c => luminance(c.hex) < 0.15)); };
const recolorSvg = (s, col) => String(s).replace(/((?:fill|stroke)\s*[:=]\s*["']?)\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|white|black)/g, (m, k) => k + col);

/* Items from parts: the heading (clearly the largest text, above all others), then items: a title with the smaller text
   right under it (its description), the icon above or left of it, the colour of the card or badge it sits on.
   Null when the design is something else (a chart, a matrix, labels scattered around a picture...). */
function napkinItems(parts) {
  if (!parts || parts.texts.length < 2) return null;
  // a number or letter alone ("1", "2", "A") is a badge on an item, not an item: Napkin numbers items it was not told to order
  const isBadge = t => /^(?:\d{1,2}|[A-Z])\.?$/.test(t.text.trim());
  const badges = parts.texts.filter(isBadge);
  parts = Object.assign({}, parts, { texts: parts.texts.filter(t => !isBadge(t)) });
  if (parts.texts.length < 2) return null;
  const T = parts.texts.slice().sort((a, b) => a.y - b.y || a.x - b.x);
  const top = T.reduce((a, b) => b.size > a.size ? b : a), rest = T.filter(t => t !== top);
  const head = top.size >= 1.15 * Math.max(...rest.map(t => t.size)) && cy(top) < Math.min(...rest.map(t => t.y)) ? top : null;
  const items = [], ext = unionBox(parts.texts.concat(parts.fills)), cardMax = ext.w * ext.h * 0.3;   // a card, not the whole background
  for (const t of head ? rest : T) {
    const ov = u => Math.min(u.x + u.w, t.x + t.w) - Math.max(u.x, t.x) >= 0.5 * Math.min(u.w, t.w);
    const under = items.find(u => { const last = u.texts[u.texts.length - 1];
      return ov(u.title) && t.y >= last.y + last.h - 4 && t.y - (last.y + last.h) < 3 * t.size && (t.size < u.title.size * 0.95 || (!t.bold && u.title.bold)); });
    // a text in the same card as an item's title is that item's description, however far below it sits
    const inCard = !under && items.find(u => parts.fills.some(f => f.w * f.h < cardMax && [u.title, t].every(q => cx(q) > f.x && cx(q) < f.x + f.w && cy(q) > f.y && cy(q) < f.y + f.h)));
    if (under || inCard) (under || inCard).texts.push(t); else items.push({ title: t, texts: [t] });
  }
  if (items.length < 2 || items.some(u => u.texts.length > 3 || wordCount(u.title.text) > 8)) return null;
  const used = new Set();
  items.forEach(u => {
    const b = unionBox(u.texts), t = u.title;
    // the icon: the nearest small part above the title within its column, else just left of it on its line
    const above = parts.icons.filter(i => !used.has(i) && cx(i) > b.x - b.w * 0.25 && cx(i) < b.x + b.w * 1.25 && cy(i) < t.y);
    const left = parts.icons.filter(i => !used.has(i) && cy(i) > t.y - t.h && cy(i) < t.y + t.h * 2 && cx(i) < t.x && t.x - (i.x + i.w) < Math.max(3 * i.w, 40));
    const right = parts.icons.filter(i => !used.has(i) && cy(i) > t.y - t.h && cy(i) < t.y + t.h * 2 && cx(i) > t.x + t.w && i.x - (t.x + t.w) < Math.max(3 * i.w, 40));
    const near = above.sort((p, q) => cy(q) - cy(p))[0] || left.sort((p, q) => cx(q) - cx(p))[0] || right.sort((p, q) => cx(p) - cx(q))[0];
    u.iconPos = !near ? 'top' : cy(near) < t.y ? 'top' : cx(near) < t.x ? 'left' : 'right';
    if (near) {
      const zone = { x: near.x - 4, y: near.y - 4, w: near.w + 8, h: near.h + 8 };
      u.icon = parts.icons.filter(i => !used.has(i) && i.x < zone.x + zone.w && i.x + i.w > zone.x && i.y < zone.y + zone.h && i.y + i.h > zone.y);
      u.icon.forEach(i => used.add(i));
    }
    // its colour: the card that holds the title, else the badge that holds the icon, else a fill straight above it
    const inF = (f, p) => cx(p) > f.x && cx(p) < f.x + f.w && cy(p) > f.y && cy(p) < f.y + f.h;
    const fill = parts.fills.filter(f => inF(f, t)).sort((p, q) => p.w * p.h - q.w * q.h)[0] || (near && parts.fills.filter(f => inF(f, near)).sort((p, q) => p.w * p.h - q.w * q.h)[0]);
    u.color = fill ? fill.color : null;
    u.label = t.text; u.detail = u.texts.slice(1).map(x => x.text).join(' ');
    if (u.detail.toLowerCase() === u.label.toLowerCase()) u.detail = '';    // Napkin repeats the title as its description
    // how the item is drawn: on a card (a fill holding its text; a tall one is a pillar), as an icon badge, or plain text
    const card = parts.fills.filter(f => inF(f, t) && f.w * f.h > t.w * t.h * 1.5 && Math.abs(cx(t) - cx(f)) < f.w * 0.3).sort((p, q) => p.w * p.h - q.w * q.h)[0];
    u.style = card ? (card.h > card.w * 1.6 ? 'pillar' : 'card') : near && fill ? 'badge' : 'plain';
    u.box = unionBox(u.texts.concat(u.icon || [], card ? [card] : []));
  });
  badges.forEach(b => { const u = items.slice().sort((p, q) => Math.hypot(cx(p.box) - cx(b), cy(p.box) - cy(b)) - Math.hypot(cx(q.box) - cx(b), cy(q.box) - cy(b)))[0]; if (u) u.badge = b.text.trim(); });
  // the hub: an item inside a fill clearly larger than the others' (a central circle), or the item nearest the middle of
  // the others when they surround it
  const area = f => f.w * f.h, fillOf = u => parts.fills.filter(f => cx(u.title) > f.x && cx(u.title) < f.x + f.w && cy(u.title) > f.y && cy(u.title) < f.y + f.h).sort((p, q) => area(p) - area(q))[0];
  let hub = null;
  if (items.length >= 3) {
    const fs = items.map(fillOf);
    const holdsTitle = (f, v) => cx(v.title) > f.x && cx(v.title) < f.x + f.w && cy(v.title) > f.y && cy(v.title) < f.y + f.h;
    const k = fs.findIndex((f, i) => { if (!f || items.some((v, j) => j !== i && holdsTitle(f, v))) return false;
      if (Math.abs(cx(items[i].title) - cx(f)) > f.w * 0.3 || Math.abs(cy(items[i].title) - cy(f)) > f.h * 0.3) return false;   // the hub's text sits in its middle
      const o = parts.fills.filter(g => g !== f && area(g) < area(f)).map(area).sort((a, b) => a - b);
      return o.length >= 2 && area(f) >= 2.5 * o[Math.floor(o.length / 2)] && !parts.fills.some(g => g !== f && area(g) >= area(f) * 0.6 && !(cx(g) > f.x && cx(g) < f.x + f.w && cy(g) > f.y && cy(g) < f.y + f.h)); });
    if (k >= 0) { hub = items[k]; hub.hubFill = fs[k]; }
    else {
      // a large graphic in the middle of the items (a globe, a disc) is the hub; an item right at it is its label
      const all = { x: items.reduce((a, u) => a + cx(u.box), 0) / items.length, y: items.reduce((a, u) => a + cy(u.box), 0) / items.length };
      const rAvg = items.reduce((a, u) => a + Math.hypot(cx(u.box) - all.x, cy(u.box) - all.y), 0) / items.length;
      
      const ownsTitle = f => items.some(u => Math.abs(cx(u.title) - cx(f)) < f.w * 0.3 && cy(u.title) > f.y && cy(u.title) < f.y + f.h);   // a card: its title centred in it
      const big = parts.fills.concat(parts.icons).filter(f => Math.hypot(cx(f) - all.x, cy(f) - all.y) < 0.4 * rAvg && Math.max(f.w, f.h) > rAvg * 0.35 && !ownsTitle(f) && parts.fills.filter(g => g !== f).every(g => g.w * g.h * 2 <= f.w * f.h))
        .sort((p, q) => q.w * q.h - p.w * p.h)[0];
      const quads = c => new Set(items.map(u => Math.round((Math.atan2(cy(u.box) - c.y, cx(u.box) - c.x) + Math.PI) / (Math.PI / 2)) % 4)).size;
      if (big && quads({ x: cx(big), y: cy(big) }) >= 3) {
        const lab = items.filter(u => Math.abs(cx(u.box) - cx(big)) < big.w * 0.25 && cy(u.box) < big.y + big.h * 0.25 && Math.hypot(cx(u.box) - cx(big), cy(u.box) - cy(big)) < Math.max(big.w, big.h) * 1.1).sort((p, q) => Math.hypot(cx(p.box) - cx(big), cy(p.box) - cy(big)) - Math.hypot(cx(q.box) - cx(big), cy(q.box) - cy(big)))[0];
        hub = lab || { label: '', detail: '', box: big, color: big.color };
        hub.hubFill = { x: big.x, y: big.y, w: big.w, h: big.h, color: big.color || null };
      }
    }
    if (!hub) {
      const mid = us => ({ x: us.reduce((a, u) => a + cx(u.box), 0) / us.length, y: us.reduce((a, u) => a + cy(u.box), 0) / us.length });
      const dist = (u, c) => Math.hypot(cx(u.box) - c.x, cy(u.box) - c.y);
      const cand = items.map(u => { const others = items.filter(v => v !== u), c = mid(others), r = others.reduce((a, v) => a + dist(v, c), 0) / others.length;
        const ang = others.map(v => Math.atan2(cy(v.box) - c.y, cx(v.box) - c.x)), around = new Set(ang.map(a => Math.round((a + Math.PI) / (Math.PI / 2)) % 4)).size >= 3;
        return { u, d: dist(u, c) / Math.max(r, 1), around }; }).filter(x => x.around && items.length >= 4).sort((a, b) => a.d - b.d)[0];
      if (cand && cand.d < 0.55) hub = cand.u;
    }
  }
  if (hub && items.includes(hub)) items.splice(items.indexOf(hub), 1);
  // reading order: rows top to bottom (titles whose lines overlap share a row), left to right within a row
  const byTop = items.slice().sort((p, q) => p.title.y - q.title.y);
  let row = 0, start = byTop[0] && byTop[0].title;
  byTop.forEach(u => { if (u.title.y > start.y + start.h * 0.8) { row++; start = u.title; } u.row = row; });
  items.sort((p, q) => p.row - q.row || cx(p.title) - cx(q.title));
  const hf = head && parts.fills.filter(f => cx(head) > f.x && cx(head) < f.x + f.w && cy(head) > f.y && cy(head) < f.y + f.h).sort((p, q) => p.w * p.h - q.w * q.h)[0];
  return { head: head && { text: head.text, color: hf ? hf.color : null }, items,
    hub: hub && { label: hub.label, detail: hub.detail, color: hub.hubFill ? hub.hubFill.color : hub.color, box: hub.hubFill || hub.box },
    comp: composition(items, hub), links: (parts.lines || []).length };
}
/* Napkin's arrangement, read from where its items sit: around a hub ('ring' all around it, 'fan' on one side, with the
   direction `dir` in radians from the hub), else 'row', 'column', 'grid' or a rising/falling 'stair'. Each item keeps its
   angle around the hub (u.ang), so the rebuild places it in the same direction. */
function composition(items, hub) {
  if (hub && items.length >= 2) {
    const c = { x: cx(hub.hubFill || hub.box), y: cy(hub.hubFill || hub.box) };
    items.forEach(u => { u.ang = Math.atan2(cy(u.box) - c.y, cx(u.box) - c.x); });
    const a = items.map(u => u.ang).sort((p, q) => p - q), gaps = a.map((v, i) => (i ? v - a[i - 1] : v + 2 * Math.PI - a[a.length - 1]));
    const g = Math.max(...gaps), k = gaps.indexOf(g), gapMid = (k ? a[k - 1] : a[a.length - 1] - 2 * Math.PI) + g / 2;
    return 2 * Math.PI - g >= Math.PI ? { kind: 'ring' } : { kind: 'fan', dir: gapMid + Math.PI };   // half a turn or more: all around
  }
  const rows = new Set(items.map(u => u.row)).size;
  if (rows === 1) return { kind: 'row' };
  const xs = items.map(u => cx(u.box)), mono = xs.every((x, i) => !i || x > xs[i - 1]) || xs.every((x, i) => !i || x < xs[i - 1]);
  if (rows === items.length) return { kind: mono && items.length >= 3 ? 'stair' : 'column' };
  return { kind: 'grid', rows };
}

/* The rebuilt infographic in R (points): the heading on top, linked to a row (or two rows) of item cards; a sequence
   gets arrows between its cards instead, in the order of the user's points. `add` are the points to add ({ label,
   detail }); `order` the user's points in order (for a sequence). Cards with descriptions carry their icon beside the
   title and the description under it; cards with a label only are centred. Text at the guideline sizes (22 pt and up).
   Returns { prims, added } - prims as every builder makes them (pictures: t 'image' with their own small SVG). */
function napkinRebuild(st, R, add, ordered, order) {
  // a hub's text is content too: as cards it becomes the first card
  const items = (st.hub && st.hub.label ? [{ label: st.hub.label, detail: st.hub.detail, color: st.hub.color }] : []).concat(st.items).map(u => ({ label: u.label, detail: u.detail, icon: u.icon, color: u.color ? shapeColor(u.color) : null }));
  if (ordered && order && order.length) {   // a sequence in the user's order (Napkin may draw it upwards or around)
    const at = u => { const s = order.map(o => sharedWords(o, u.label)), m = Math.max(...s); return m > 0 ? s.indexOf(m) : order.length; };
    items.forEach((u, k) => { u.at = at(u) * 100 + k; });
    items.sort((p, q) => p.at - q.at);
  }
  // one colour per item: Napkin's (mapped to the palette) unless an earlier item already has it
  const usedCol = new Set();
  const free = () => { const c = TEMPLATE.accents.find(a => !usedCol.has(a)) || TEMPLATE.accents[usedCol.size % TEMPLATE.accents.length]; usedCol.add(c); return c; };
  items.forEach(u => { if (u.color && !usedCol.has(u.color) && u.color !== TEMPLATE.line) usedCol.add(u.color); else u.color = null; });
  items.forEach(u => { if (!u.color) u.color = free(); });
  const icons = iconsFor(add || []);
  (add || []).forEach((p, i) => { const d = firstSentence(p.detail); items.push({ label: p.label, detail: items.some(u => u.detail) && d.length <= 90 ? d : '', cmp: icons[i] && icons[i].matched ? icons[i].key : 'none', color: free(), added: true }); });
  // an item Napkin drew without a recognisable icon takes the catalogue's icon for it (or a plain marker); with no icons
  // at all the cards carry none
  const bare = items.filter(u => !(u.icon && u.icon.length) && !u.cmp), cat = iconsFor(bare);
  bare.forEach((u, i) => { if (cat[i] && cat[i].matched) u.cmp = cat[i].key; });
  const badge = items.every(u => (u.icon && u.icon.length) || u.cmp);
  const n = items.length, MIN = TEMPLATE.minBody, gap = 24;
  let withDetail = items.some(u => u.detail);
  const hd = st.head && { h: 64, gap: 48 };
  // the arrangement: one row if the text fits at the guideline sizes, else two rows
  // per: cards per row; cap: the largest title size tried (28 first, then down to 22 before a plan counts as too tall)
  const plan = (per, cap) => {
    const rows = Math.ceil(n / per), cw = Math.min(withDetail ? 380 : 260, (R.w - gap * (per - 1)) / per), pad = cw < 220 ? 8 : cw < 280 ? 10 : 14;
    const avail = (R.h - (hd ? hd.h + (rows > 1 ? 28 : hd.gap) : 0) - 20 * (rows - 1)) / rows;
    const longest = Math.max(...items.map(u => Math.max(...u.label.split(/\s+/).map(x => x.length)))) * MIN * 0.55 + 16;
    let D = !badge ? 0 : withDetail ? Math.round(Math.max(36, Math.min(56, cw - 2 * pad - 10 - longest))) : Math.round(Math.min(96, cw * 0.45));
    const tw = withDetail && badge ? cw - 2 * pad - D - 10 : cw - 2 * pad, dw = cw - 2 * pad;
    const ts = Math.min(...items.map(u => fit(u.label, tw, 400, cap || 28, MIN)));
    const titleH = Math.max(...items.map(u => linesAt(u.label, tw, ts) * ts * 1.2 + 8));
    const detH = withDetail ? Math.max(...items.map(u => u.detail ? linesAt(u.detail, dw, MIN) * MIN * 1.2 + 8 : 0)) : 0;
    if (!withDetail && badge) D = Math.floor(Math.max(40, Math.min(D, avail - 2 * pad - 12 - titleH)));   // 2 pt to spare (rounding)   // a smaller badge before a second row
    const headH = withDetail ? Math.max(D, titleH) : (badge ? D + 10 : 0) + titleH, ch = pad + headH + (detH ? 8 + detH : 0) + pad;
    const tooNarrow = items.some(u => !fitsAt(u.label, tw, 400, ts)) || (withDetail && items.some(u => u.detail && !fitsAt(u.detail, dw, 400, MIN)));
    return { per, rows, cw, pad, D, tw, dw, ts, headH, ch, avail, ok: ch <= avail && !tooNarrow };
  };
  const plans = () => [28, 24, MIN].flatMap(cap => [plan(n, cap)].concat(n >= 3 ? [plan(Math.ceil(n / 2), cap)] : [], n >= 7 ? [plan(Math.ceil(n / 3), cap)] : []));
  // nothing fits with the descriptions: the titles only (said in the result), never a layout that cuts its text off
  let titlesOnly = false, P = plans().find(q => q.ok);
  if (!P && withDetail) { items.forEach(u => { u.detail = ''; }); titlesOnly = true; withDetail = false; P = plans().find(q => q.ok); }
  P = P || plan(n);
  const { per, rows, cw, pad, D, tw, dw, ts, headH } = P, ch = Math.min(P.ch, P.avail), out = [];
  const hg = hd ? (rows > 1 ? 28 : hd.gap) : 0, total = (hd ? hd.h + hg : 0) + rows * ch + 20 * (rows - 1), y0 = R.y + (R.h - total) / 2;
  const top = y0 + (hd ? hd.h + hg : 0), boxes = [];
  for (let r = 0; r < rows; r++) {
    const k = Math.min(per, n - r * per), x0 = R.x + (R.w - k * cw - (k - 1) * gap) / 2;
    for (let j = 0; j < k; j++) boxes.push({ x: x0 + j * (cw + gap), y: top + r * (ch + 20), w: cw, h: ch, row: r });
  }
  if (hd) {
    const hs = fit(st.head.text, R.w * 0.8, hd.h, 28, MIN), w = Math.min(R.w, Math.max(R.w * 0.45, st.head.text.length * hs * 0.56 + 60)), x = R.x + (R.w - w) / 2;
    const fill = st.head.color ? shapeColor(st.head.color) : TEMPLATE.line;
    out.push(Object.assign(box('roundRect', x, y0, w, hd.h, { fill, text: st.head.text, size: hs, bold: true, color: readableOn(fill), align: 'center', valign: 'middle' }), { grp: 'head', grpName: 'Heading' }));
    if (rows === 1 && !ordered) {   // the heading linked to every card: a trunk, a bar, a drop per card
      const L = TEMPLATE.line, my = y0 + hd.h + hg / 2, xs = boxes.map(cx);
      out.push(seg(R.x + R.w / 2, y0 + hd.h, R.x + R.w / 2, my, L, 2, { grp: 'links', grpName: 'Links' }));
      if (xs.length > 1) out.push(seg(Math.min(...xs), my, Math.max(...xs), my, L, 2, { grp: 'links' }));
      xs.forEach(x => out.push(seg(x, my, x, top, L, 2, { grp: 'links' })));
    }
  }
  items.forEach((u, i) => {
    const b = boxes[i], g = 'item' + i, tc = readableOn(u.color);
    const bx = withDetail ? b.x + pad : b.x + (b.w - D) / 2, by = b.y + pad + (withDetail ? (headH - D) / 2 : 0);
    out.push(Object.assign(box('roundRect', b.x, b.y, b.w, b.h, { fill: u.color }), { grp: g, grpName: u.label }));
    if (badge) out.push(Object.assign(box('ellipse', bx, by, D, D, { fill: '#FFFFFF' }), { grp: g }));
    const S = D * 0.6, sx = bx + (D - S) / 2, sy = by + (D - S) / 2;
    if (badge && u.icon && u.icon.length) {
      const ib = unionBox(u.icon), k = S / Math.max(ib.w, ib.h), w = ib.w * k, h = ib.h * k;
      const light = u.icon.every(p => p.light);   // a one-colour glyph takes the item's colour; a two-tone icon keeps Napkin's colours
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ib.x} ${ib.y} ${ib.w} ${ib.h}" width="${w}" height="${h}">${u.icon.map(p => p.svg(light ? u.color : null)).join('')}</svg>`;
      out.push({ t: 'image', svg, href: svgDataURL(svg), x: sx + (S - w) / 2, y: sy + (S - h) / 2, w, h, napkinPart: true });
    } else if (badge && u.cmp) out.push(...comp(u.cmp, sx, sy, S, u.color).map(q => Object.assign(q, { grp: g })));
    if (withDetail) {
      out.push(label(b.x + pad + (badge ? D + 10 : 0), b.y + pad, tw, headH, u.label, { size: ts, bold: true, color: tc, align: 'left', valign: 'middle', grp: g }));
      if (u.detail) out.push(label(b.x + pad, b.y + pad + headH + 8, dw, b.h - 2 * pad - headH - 8, u.detail, { size: MIN, color: tc, align: 'left', valign: 'top', grp: g }));
    } else out.push(label(b.x + pad, by + (badge ? D + 10 : 0), tw, b.y + b.h - pad - (by + (badge ? D + 10 : 0)), u.label, { size: ts, bold: true, color: tc, align: 'center', valign: 'top', grp: g }));
    if (ordered && i < n - 1 && boxes[i + 1].row === b.row) out.push(headAt(boxes[i + 1].x - 6, b.y + b.h / 2, 0, 16, TEMPLATE.line));
  });
  return { prims: roundCorners(brandPrims(out)), added: items.filter(u => u.added).map(u => u.label), titlesOnly };
}
/* The rebuilt infographic in Napkin's own arrangement (st.comp): a ring or fan of items around the hub stays a ring or
   fan, a row stays a row, a column a column, a grid a grid; each item keeps its look (card, pillar, icon badge or plain
   text), its icon, colour and wording. Only sizes change: every text at 22 pt or more (the standard; brand.js raises
   anything smaller), measured before placing, so nothing is clipped. Points Napkin left out become items of the same arrangement. A sequence is not handled here (napkinRebuild
   keeps the user's order with arrows). Returns { ok, prims, added, why } - ok false with the reason when the
   arrangement cannot be drawn readably in R (the caller then uses napkinRebuild and says so). */
function napkinFaithful(st, R, add, ordered, order) {
  const C = st.comp || {};
  // a sequence keeps Napkin's arrangement (row, column, grid) when Napkin's reading order is the user's order (V10.11);
  // around a hub the order cannot be read, so a sequence there is rebuilt in the user's order
  const inOrder = () => { const at = st.items.map(u => { const s = (order || []).map(o => sharedWords(o, u.label)), m = Math.max(0, ...s); return m > 0 ? s.indexOf(m) : -1; });
    return at.every(v => v >= 0) && at.every((v, i) => !i || v > at[i - 1]); };
  if (ordered && (!/^(?:row|column|grid)$/.test(C.kind) || !inOrder())) return { ok: false, why: 'a sequence keeps your order' };
  if (!/^(?:row|column|grid|ring|fan)$/.test(C.kind)) return { ok: false, why: `arrangement "${C.kind || 'unknown'}" not recognised` };
  const MIN = TEMPLATE.minBody, INKC = BRAND.ink;
  const items = st.items.map(u => ({ label: u.label, detail: u.detail, icon: u.icon, color: u.color ? shapeColor(u.color) : null, style: u.style, iconPos: u.iconPos, ang: u.ang }));
  const usedCol = new Set(), free = () => { const c = TEMPLATE.accents.find(a => !usedCol.has(a)) || TEMPLATE.accents[usedCol.size % TEMPLATE.accents.length]; usedCol.add(c); return c; };
  items.forEach(u => { if (u.color && !usedCol.has(u.color) && u.color !== TEMPLATE.line) usedCol.add(u.color); else u.color = null; });
  items.forEach(u => { if (!u.color) u.color = free(); });
  const most = k => { const c = {}; items.forEach(u => { c[u[k]] = (c[u[k]] || 0) + 1; }); return Object.keys(c).sort((a, b) => c[b] - c[a])[0]; };
  const style = most('style'), withDetail = items.some(u => u.detail);
  const icons = iconsFor(add || []);
  (add || []).forEach((p, i) => { const d = firstSentence(p.detail); items.push({ label: p.label, detail: withDetail && d.length <= 90 ? d : '', cmp: icons[i] && icons[i].matched ? icons[i].key : 'none', color: free(), added: true, style }); });
  // Napkin's items carry icons: an item without one (or an added point) takes the catalogue's; a design without icons stays without
  const anyIcon = items.some(u => u.icon && u.icon.length), bare = items.filter(u => !(u.icon && u.icon.length) && !u.cmp), cat = iconsFor(bare);
  bare.forEach((u, i) => { u.cmp = cat[i] && cat[i].matched ? cat[i].key : 'none'; });
  const n = items.length, hub = st.hub, head = st.head, gap = n >= 5 ? 14 : 24;
  const textC = u => style === 'card' || style === 'pillar' ? readableOn(u.color) : INKC;

  // ---- one item: icon (on a white disk on cards, in a coloured badge, or plain), title, description
  const iconAt = (u, x, y, S, col) => {
    if (u.icon && u.icon.length) {
      const ib = unionBox(u.icon), k = S / Math.max(ib.w, ib.h, 1), w = ib.w * k, h = ib.h * k, light = u.icon.every(p => p.light);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ib.x} ${ib.y} ${ib.w} ${ib.h}" width="${w}" height="${h}">${u.icon.map(p => p.svg(light ? col : null)).join('')}</svg>`;
      return [{ t: 'image', svg, href: svgDataURL(svg), x: x + (S - w) / 2, y: y + (S - h) / 2, w, h, napkinPart: true }];
    }
    return comp(u.cmp, x, y, S, col);
  };
  const badgeAt = (u, x, y, D, g) => {
    if (!D) return [];
    const out = [], light = u.icon && u.icon.length && u.icon.every(p => p.light);
    if (style === 'badge' && light) { out.push(Object.assign(box('ellipse', x, y, D, D, { fill: u.color }), { grp: g })); out.push(...iconAt(u, x + D * .2, y + D * .2, D * .6, '#FFFFFF')); }
    else if (style === 'plain') out.push(...iconAt(u, x + D * .1, y + D * .1, D * .8, u.color));
    else { out.push(Object.assign(box('ellipse', x, y, D, D, { fill: style === 'badge' ? u.color : '#FFFFFF' }), { grp: g }));
      if (style === 'badge') out.push(Object.assign(box('ellipse', x + D * .1, y + D * .1, D * .8, D * .8, { fill: '#FFFFFF' }), { grp: g }));
      out.push(...iconAt(u, x + D * .22, y + D * .22, D * .56, u.color)); }
    return out.map(p => Object.assign(p, p.t === 'image' ? {} : { grp: p.grp || g }));
  };
  const textH = (u, tw, ts, ds) => linesAt(u.label, tw, ts) * ts * 1.2 + 8 + (u.detail ? 4 + linesAt(u.detail, tw, ds) * ds * 1.2 + 8 : 0);
  const fitsText = (u, tw, ts, ds) => tw > 40 && linesAt(u.label, tw, ts) <= 4 && !u.label.split(/\s+/).some(w => w.length * ts * 0.55 > tw - 14.4) && (!u.detail || !u.detail.split(/\s+/).some(w => w.length * ds * 0.55 > tw - 14.4));
  // side: 'top' (icon above, centred), 'left' (icon left of left-aligned text), 'right' (icon right of right-aligned text)
  const measure = (u, w, side, D, ts, ds, pad) => { const sp = D ? D + 12 : 0, tw = side === 'top' ? w - 2 * pad : w - sp - 2 * pad;
    return { tw, h: side === 'top' ? pad + (D ? D + 8 : 0) + textH(u, tw, ts, ds) + pad : Math.max(D, textH(u, tw, ts, ds)) + 2 * pad, ok: fitsText(u, tw, ts, ds) }; };
  const drawItem = (u, i, b, side, D, ts, ds, pad) => {
    const g = 'item' + i, out = [], tc = textC(u), m = measure(u, b.w, side, D, ts, ds, pad);
    if (style === 'card') out.push(Object.assign(box('roundRect', b.x, b.y, b.w, b.h, { fill: u.color }), { grp: g, grpName: u.label }));
    if (style === 'pillar') out.push(Object.assign(box('rect', b.x + 8, b.y + 8, b.w - 16, b.h - 16, { fill: u.color }), { grp: g, grpName: u.label }),
      Object.assign(box('roundRect', b.x, b.y, b.w, 12, { fill: u.color }), { grp: g }), Object.assign(box('roundRect', b.x, b.y + b.h - 12, b.w, 12, { fill: u.color }), { grp: g }));
    const ip = style === 'pillar' ? pad + 4 : pad;
    const bx = side === 'top' ? b.x + (b.w - D) / 2 : side === 'left' ? b.x + pad : b.x + b.w - pad - D, by = side === 'top' ? b.y + ip : b.y + (b.h - D) / 2;
    out.push(...badgeAt(u, bx, by, D, g));
    const tx = side === 'left' ? b.x + pad + (D ? D + 12 : 0) : b.x + pad, ty = side === 'top' ? by + (D ? D + 8 : 0) : b.y + (b.h - textH(u, m.tw, ts, ds)) / 2 + 4, al = side === 'top' ? 'center' : side === 'left' ? 'left' : 'right';
    const th = linesAt(u.label, m.tw, ts) * ts * 1.2 + 8;
    out.push(label(tx, ty, m.tw, th, u.label, { size: ts, bold: true, color: tc, align: al, valign: 'top', grp: g }));
    if (u.detail) out.push(label(tx, ty + th + 4, m.tw, linesAt(u.detail, m.tw, ds) * ds * 1.2 + 8, u.detail, { size: ds, color: tc, align: al, valign: 'top', grp: g }));
    return out;
  };
  const overlap = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 2 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 2;
  const inside = b => b.x >= R.x - 1 && b.y >= R.y - 1 && b.x + b.w <= R.x + R.w + 1 && b.y + b.h <= R.y + R.h + 1;
  const headOut = (y0, color) => { const hs = fit(head.text, R.w * 0.8, 64, 28, MIN), w = Math.min(R.w, Math.max(R.w * 0.4, head.text.length * hs * 0.56 + 60)), fill = head.color ? shapeColor(head.color) : TEMPLATE.line;
    return Object.assign(box('roundRect', R.x + (R.w - w) / 2, y0, w, 64, { fill, text: head.text, size: hs, bold: true, color: readableOn(fill), align: 'center', valign: 'middle' }), { grp: 'head', grpName: 'Heading' }); };

  // ---- the arrangement, tried at the larger sizes first, then at the smallest the guidelines allow
  const trace = [], attempt = (ts, ds, D, even) => {
    const out = [], boxes = [], pad = style === 'card' || style === 'pillar' ? (n >= 5 ? 10 : 14) : 4;
    if (C.kind === 'row' || C.kind === 'grid' || C.kind === 'column') {
      const hd = head ? 64 + 10 : 0, area = { x: R.x, y: R.y + hd, w: R.w, h: R.h - hd };
      const tryPer = (per, side0) => {
        const rows = Math.ceil(n / per), side = side0 || (C.kind === 'column' || per === 1 || most('iconPos') === 'left' ? 'left' : 'top');
        const w = Math.min(per === 1 ? Math.min(area.w, 820) : (withDetail ? 340 : 280) + (style === 'pillar' ? 20 : 0), (area.w - gap * (per - 1)) / per);
        const ms = items.map(u => measure(u, w, side, D, ts, ds, pad)), h = Math.max(...ms.map(m => m.h)) + (style === 'pillar' ? 10 : 0), rg = C.kind === 'column' ? 10 : 12;
        return { per, rows, side, w, h, rg, ok: ms.every(m => m.ok) && rows * h + (rows - 1) * rg <= area.h };
      };
      const pers = C.kind === 'column' ? [1, 2] : C.kind === 'grid' ? [Math.ceil(n / C.rows), Math.ceil(n / (C.rows + 1))] : [n, Math.ceil(n / 2), Math.ceil(n / 3)];
      const ps = pers.filter((v, i, a) => v >= 1 && a.indexOf(v) === i), P = ps.map(v => tryPer(v)).concat(ps.map(v => tryPer(v, 'left'))).find(p => p.ok);
      if (!P) return trace.push(`${ts}/${ds}: ${pers.map(tryPer).map(p => `per ${p.per}: h ${Math.round(p.h)} x ${p.rows} rows in ${Math.round(area.h)}, text ${items.map(u => measure(u, p.w, p.side, D, ts, ds, pad).ok ? 1 : 0).join('')}`).join('; ')}`) && null;
      const total = P.rows * P.h + (P.rows - 1) * P.rg, y0 = area.y + (area.h - total) / 2;
      if (head) out.push(headOut(Math.max(R.y, y0 - hd)));
      items.forEach((u, i) => {
        const r = Math.floor(i / P.per), k = Math.min(P.per, n - r * P.per), j = i % P.per, x0 = area.x + (area.w - k * P.w - (k - 1) * gap) / 2;
        const b = { x: x0 + j * (P.w + gap), y: y0 + r * (P.h + P.rg), w: P.w, h: P.h };
        boxes.push(b); out.push(...drawItem(u, i, b, P.side, D, ts, ds, pad));
        if (ordered && i && boxes[i - 1].y === b.y && b.x - (boxes[i - 1].x + boxes[i - 1].w) >= 12) out.push(headAt(b.x - 2, b.y + b.h / 2, 0, Math.min(14, b.x - (boxes[i - 1].x + boxes[i - 1].w) - 2), TEMPLATE.line));
      });
      if (head && st.links && P.rows === 1) {   // Napkin linked the heading to its items: a trunk, a bar, a drop per item
        const L = TEMPLATE.line, top = y0, my = (Math.max(R.y, y0 - hd) + 64 + top) / 2, xs = boxes.map(cx);
        out.unshift(seg(R.x + R.w / 2, Math.max(R.y, y0 - hd) + 64, R.x + R.w / 2, my, L, 2), ...(xs.length > 1 ? [seg(Math.min(...xs), my, Math.max(...xs), my, L, 2)] : []), ...xs.map(x => seg(x, my, x, top, L, 2)));
      }
      return { out, boxes };
    }
    // ring / fan: the hub as a native circle with its text, items in the same directions around it
    const hubText = hub ? hub.label + (hub.detail ? '\n' + hub.detail : '') : head ? head.text : '';
    const hubCol = hub && hub.color ? shapeColor(hub.color) : TEMPLATE.line;
    const dir = C.kind === 'fan' ? C.dir : 0, horiz = Math.abs(Math.cos(dir)) >= Math.abs(Math.sin(dir));
    const HW = Math.min(C.kind === 'ring' ? 220 : 340, R.w * .28), HH = Math.min(C.kind === 'fan' && !horiz ? 160 : C.kind === 'ring' ? 170 : 230, R.h * (C.kind === 'fan' && !horiz ? .36 : .55));
    let hx = R.x + R.w / 2, hy = R.y + R.h / 2;
    if (C.kind === 'fan') { if (horiz) hx = Math.cos(dir) > 0 ? R.x + HW / 2 : R.x + R.w - HW / 2; else hy = Math.sin(dir) < 0 ? R.y + R.h - HH / 2 : R.y + HH / 2; }
    // directions: Napkin's own angles for its items; points added (or none known) share the free directions evenly
    // (second try: the same directions in the same order, spread evenly, when Napkin's exact angles leave no room)
    let angs = items.map(u => u.ang);
    if (even || angs.some(a => a == null)) {
      const rel = a => { let d = a - dir; while (d <= -Math.PI) d += 2 * Math.PI; while (d > Math.PI) d -= 2 * Math.PI; return d; };
      const order = items.map((u, i) => i).sort((p, q) => (items[p].ang == null) - (items[q].ang == null) || rel(items[p].ang || 0) - rel(items[q].ang || 0));
      const span = C.kind === 'ring' ? 2 * Math.PI : Math.PI * 0.9, start = C.kind === 'ring' ? (items[order[0]].ang != null ? items[order[0]].ang : -Math.PI / 2 + Math.PI / n) : dir - span / 2;
      angs = []; order.forEach((k, j) => { angs[k] = start + span * (C.kind === 'ring' ? j / n : (j + 0.5) / n); });
    }
    const tw0 = Math.min(C.kind === 'ring' ? (withDetail ? 280 : 230) : withDetail ? 330 : 280, R.w * .3);
    const placed = items.map((u, i) => {
      // 'left': icon on the left, text to its right. Above or below a hub every item is centred under its icon
      const a = angs[i], c = Math.cos(a), s = Math.sin(a), side = C.kind === 'fan' && !horiz ? 'top' : C.kind === 'ring' ? (c >= 0 ? 'left' : 'right') : c >= 0.3 ? 'left' : c <= -0.3 ? 'right' : 'top';
      const w = side === 'top' ? Math.min(tw0, 300) : tw0 + D + 12 + 8, m = measure(u, w, side, D, ts, ds, 4);
      return { u, i, a, c, s, side, w, h: m.h, ok: m.ok };
    });
    if (!placed.every(p => p.ok)) return trace.push(`${ts}/${ds}: text too wide`) && null;
    // ellipse through the icon centres: as wide and tall as the content area allows
    const maxW = Math.max(...placed.filter(p => p.side !== 'top').map(p => p.w), 0), maxH = Math.max(...placed.map(p => p.h));
    const RX = C.kind === 'fan' && horiz ? R.w - HW - maxW + D / 2 - 30 : C.kind === 'fan' ? R.w / 2 - Math.max(...placed.map(p => p.w)) / 2 - 10 : (R.w - 2 * (maxW - D / 2)) / 2 - 10;
    const RY = C.kind === 'fan' && !horiz ? R.h - HH / 2 - maxH / 2 - 10 : R.h / 2 - maxH / 2 - 4;
    if ((C.kind === 'fan' && !horiz ? RY < HH / 2 + D / 2 + 10 : RX < HW / 2 + D / 2 + 20) || RY < 40) return trace.push(`${ts}/${ds}: RX ${Math.round(RX)} RY ${Math.round(RY)}`) && null;
    out.push(Object.assign(box('ellipse', hx - HW / 2, hy - HH / 2, HW, HH, hubText ? { fill: hubCol, text: hubText, size: fit(hubText, HW * .7, HH * .7, 28, MIN), bold: true, color: readableOn(hubCol), align: 'center', valign: 'middle' } : { fill: hubCol }), { grp: 'hub', grpName: hub ? hub.label : 'Hub' }));
    boxes.push({ x: hx - HW / 2, y: hy - HH / 2, w: HW, h: HH });
    if (hubText && !fitsAt(hubText, HW * .7, HH * .7, MIN)) return trace.push(`${ts}/${ds}: hub text`) && null;
    placed.forEach(p => {
      p.ix = hx + RX * p.c; p.iy = hy + RY * p.s;        // the icon centre on the ellipse, in Napkin's direction
      p.b = p.side === 'left' ? { x: p.ix - D / 2 - 4, y: p.iy - p.h / 2, w: p.w, h: p.h } : p.side === 'right' ? { x: p.ix + D / 2 + 4 - p.w, y: p.iy - p.h / 2, w: p.w, h: p.h }
        : { x: p.ix - p.w / 2, y: p.iy - D / 2 - 4, w: p.w, h: p.h };
    });
    // items on the same side keep their order and are spaced so none overlaps (the arc keeps its direction)
    for (let k = 0; k < 30; k++) {
      let moved = false;
      placed.slice().sort((a, b) => a.b.y - b.b.y).forEach((a, i, L) => L.slice(i + 1).forEach(b => {
        if (!overlap(a.b, b.b)) return;
        const d = (a.b.y + a.b.h + 8 - b.b.y) / 2;
        a.b.y -= d; b.b.y += d; moved = true;
      }));
      const hb = { x: hx - HW / 2, y: hy - HH / 2, w: HW, h: HH };      // the hub stays; an item over it moves off it, away from its centre
      placed.forEach(p => { if (overlap(p.b, hb)) { p.b.y = cy(p.b) < hy ? hb.y - p.b.h - 8 : hb.y + hb.h + 8; moved = true; } });
      placed.forEach(p => { p.b.x = Math.max(R.x, Math.min(p.b.x, R.x + R.w - p.b.w)); p.b.y = Math.max(R.y, Math.min(p.b.y, R.y + R.h - p.b.h)); });
      if (!moved) break;
    }
    placed.forEach(p => {
      const b = p.b, ix = p.side === 'left' ? b.x + 4 + D / 2 : p.side === 'right' ? b.x + b.w - 4 - D / 2 : b.x + b.w / 2, iy = p.side === 'top' ? b.y + 4 + D / 2 : b.y + b.h / 2;
      boxes.push(b);
      if (st.links >= 2) {   // Napkin joined the hub to its items: a native spoke from the hub's edge to the icon's
        const dx = ix - hx, dy = iy - hy, L = Math.hypot(dx, dy) || 1, e = 1 / Math.hypot(dx / L / (HW / 2), dy / L / (HH / 2));
        out.unshift(seg(hx + dx / L * e, hy + dy / L * e, ix - dx / L * D / 2, iy - dy / L * D / 2, TEMPLATE.line, 2.5));
      }
      out.push(...drawItem(p.u, p.i, b, p.side, D, ts, ds, 4));
    });
    return { out, boxes };
  };
  let r = null;
  // last: Napkin's descriptions left out of the overview (named in the result, never silently), titles kept
  const details = items.map(u => u.detail);
  let titlesOnly = false;
  for (const [ts, ds, D, even, bare2] of [[26, MIN, 64], [24, MIN, 56], [MIN, MIN, 48], [26, MIN, 64, 1], [24, MIN, 56, 1], [MIN, MIN, 48, 1], [MIN, MIN, 48, 1, 1]]) {
    if (even && !bare2 && !/^(?:ring|fan)$/.test(C.kind)) continue;
    if (bare2) { if (!details.some(Boolean)) break; items.forEach(u => { u.detail = ''; }); titlesOnly = true; }
    r = attempt(ts, ds, anyIcon || items.some(u => u.added) ? D : 0, even);
    if (r && r.boxes.every(inside) && !r.boxes.some((a, i) => r.boxes.some((b, j) => j > i && overlap(a, b)))) break;
    if (r) trace.push(`${ts}/${ds}: ${r.boxes.filter(b => !inside(b)).length} outside, overlaps ${r.boxes.filter((a, i) => r.boxes.some((b, j) => j !== i && overlap(a, b))).length}`);
    r = null;
  }
  if (!r) return { ok: false, why: `Napkin's ${C.kind} arrangement does not fit the content area at readable sizes`, trace };
  return { ok: true, prims: roundCorners(brandPrims(r.out)), added: items.filter(u => u.added).map(u => u.label), kind: C.kind, titlesOnly };
}
const sharedWords = (a, b) => { const w = t => new Set(String(t).toLowerCase().match(/[a-z0-9]{3,}/g) || []), A = [...w(a)];
  return [...w(b)].filter(x => A.some(y => y.slice(0, 5) === x.slice(0, 5))).length; };
// shapes never take the text colour (#404040): the nearest palette colour or neutral instead
const shapeColor = c => { const b = brandColor(c); return b === BRAND.ink ? NEAREST.reduce((a, q) => colorDist(c, q) < colorDist(c, a) ? q : a, NEAREST[0]) : b; };
const firstSentence = t => { const s = String(t || '').trim(), m = /^(.{20,}?[.!?])(\s|$)/.exec(s); return m ? m[1] : s; };
function linesAt(text, w, size) {
  const cw = size * 0.55, aw = Math.max(1, w - 14.4);
  let lines = 0;
  for (const para of String(text).split('\n')) { let cur = 0; lines++;
    for (const word of para.split(/\s+/).filter(Boolean)) { const len = word.length * cw, next = cur ? cur + cw + len : len; if (next <= aw) cur = next; else { lines++; cur = len; } } }
  return lines;
}

/* What goes on the slide for a Napkin result, in R: rebuilt when recognised, else converted shape by shape.
   it: { fmt 'svg' | 'ppt', data (SVG text), pptSlide/pptR (pptxRead) }; add: points to add; ordered: sequence;
   order: the user's points in order; drop: the content's headings (Napkin sometimes draws one as an item).
   Returns { prims, report, rebuilt, added, missing } - the same object feeds the preview and the insertion. */
/* A Napkin result for a record (labelled values): drawn from the text itself (every value exactly as written) in
   Napkin's arrangement - labels in one row with the values under them is a table, a value beside its label a pair,
   anything else cards - with Napkin's colour for each label and its heading. Null when nothing fits. */
function napkinRecordBuild(it, R) {
  const rec = it.record, parts = it.fmt === 'ppt' ? napkinPartsPpt(it.pptSlide) : napkinPartsSvg(it.data);
  if (!parts) return null;
  const norm = t => String(t).toLowerCase().replace(/\s+/g, ' ').trim(), find = t => parts.texts.find(x => norm(x.text) === norm(t));
  const seen = rec.fields.map(f => ({ f, k: find(f.label), v: find(f.value) })).filter(x => x.k);
  const pairs = seen.filter(x => x.v && cx(x.v) > x.k.x + x.k.w * 0.8 && Math.abs(cy(x.v) - cy(x.k)) < Math.max(x.k.h, 20)).length;
  const rowOfLabels = seen.length >= 3 && Math.max(...seen.map(x => cy(x.k))) - Math.min(...seen.map(x => cy(x.k))) < Math.max(...seen.map(x => x.k.h)) * 1.5;
  const want = pairs >= seen.length / 2 && seen.length ? 'pairs' : rowOfLabels ? 'table' : 'cards';
  const colors = {};
  seen.forEach(x => { const f = parts.fills.filter(g => cx(x.k) > g.x && cx(x.k) < g.x + g.w && cy(x.k) > g.y && cy(x.k) < g.y + g.h).sort((p, q) => p.w * p.h - q.w * q.h)[0];
    if (f && luminance(f.color) > 0.15) colors[x.f.label] = shapeColor(f.color); });
  const head = napkinHeading(it) || '';
  let kind = want, prims = null;
  for (const k of [want].concat(['pairs', 'table', 'cards'].filter(k => k !== want))) {
    for (const h of head ? [head, ''] : ['']) { prims = recordPrims(R, rec, k, colors, h); if (prims) break; }
    if (prims) { kind = k; break; }
  }
  if (!prims) return null;
  prims = roundCorners(brandPrims(prims));
  const report = { shapes: prims.filter(p => p.t === 'shape').length, lines: 0, texts: prims.filter(p => p.text).length, pictures: 0, edit: 'full', rebuilt: true, arrangement: kind,
    notes: { [`rebuilt in the template as ${kind === 'pairs' ? 'key-value pairs' : kind === 'table' ? 'a field table' : 'field cards'} (Napkin's arrangement: ${want}); every value exactly as in your text`]: 1 } };
  report.native = report.shapes; report.quality = visualQuality(qualityItems(prims), R);
  return { prims, report, rebuilt: true, added: (it.check && it.check.add || []).map(p => p.label), arrangement: kind, missing: [], labels: [] };
}
function napkinBuild(it, R, add, ordered, order, drop) {
  // only a result that carries the record is redrawn from it; an unusable one is shown as Napkin drew it
  if (it.record && !it.convertOnly && !(it.check && it.check.excluded)) { const r = napkinRecordBuild(it, R); if (r) return r; }
  // it.convertOnly: the rebuild was checked against the content and refused (an item merged several points)
  add = add || [];
  const st = napkinStructure(it, drop);
  let prims, rebuilt = false, added = [], notes = {};
  let arrangement = '';
  // A design made for the template (Claude draws in the content area at 22 pt; text that did not need raising) goes in as
  // drawn: its own arrangement, connectors and wording, shape by shape, when that passes the layout checks. Rebuilding it
  // would replace a good design by generic cards. A point it left out can only be added by the rebuild.
  const drawn = asDrawn(it, R);
  if (drawn && !add.length) return drawn;
  if (st && !it.convertOnly) {
    // Napkin's own arrangement first (ring, fan, row, grid ... with its item look); cards only when it cannot be kept
    const f = napkinFaithful(st, R, ordered ? [] : add, ordered, order);
    if (f.ok && !visualQuality(qualityItems(f.prims), R).excluded) {
      prims = f.prims; added = f.added; arrangement = f.kind;
      notes[`rebuilt in the template in Napkin's own arrangement (${f.kind}) from its items, icons and colours`] = 1;
      if (f.titlesOnly) notes["Napkin's descriptions do not fit at 22 pt: the overview shows its titles only"] = 1;
    } else {
      const r = napkinRebuild(st, R, ordered ? [] : add, ordered, order);
      prims = r.prims; added = r.added; arrangement = 'cards';
      notes['local replacement layout: rebuilt as cards from Napkin\'s heading, items and icons' + (ordered ? ', in your order' : ` (${f.ok ? 'its arrangement overlapped at readable sizes' : f.why})`)] = 1;
      if (r.titlesOnly) notes["Napkin's descriptions do not fit at 22 pt: the overview shows its titles only"] = 1;
    }
    rebuilt = true;
  } else {
    const svg = it.fmt === 'ppt' ? (it.pptSlide && it.pptSlide.els.length ? pptxSvg(it.pptSlide, it.pptR) : null) : it.data;
    if (!svg) return { prims: [], report: null, rebuilt: false, added: [], missing: add.map(p => p.label), empty: true };
    const conv = svgToPrims(svg, R);
    prims = conv.prims; notes = conv.report.notes;
  }
  const pics = prims.filter(p => p.t === 'image').length, report = { shapes: prims.filter(p => p.t === 'shape').length, lines: prims.filter(p => p.t === 'line').length,
    texts: prims.filter(p => p.t === 'text' || (p.t === 'shape' && p.text)).length, pictures: pics, notes, edit: pics ? 'partial' : 'full', rebuilt };
  report.native = report.shapes + report.lines + prims.filter(p => p.t === 'text').length;
  report.quality = visualQuality(qualityItems(prims), R);
  report.arrangement = arrangement;
  // repair: a rebuild with layout faults is not offered while the design as drawn passes (points to add aside)
  if (rebuilt && report.quality.excluded && drawn) return Object.assign({}, drawn, { missing: add.map(p => p.label) });
  return { prims, report, rebuilt, added, arrangement, missing: add.map(p => p.label).filter(l => !added.includes(l)), labels: rebuilt ? st.items.map(u => u.label) : [] };
}
/* The result converted shape by shape, when it is ready for the template: SVG text already at 22 pt or more (nothing
   raised), no layout faults, mostly native shapes. Null otherwise (Napkin's own page size and small text: rebuilt). */
function asDrawn(it, R) {
  if (it.fmt !== 'svg' || it.record || !it.data) return null;
  let conv;
  try { conv = svgToPrims(it.data, Object.assign({}, R)); } catch (e) { return null; }
  const r = conv.report;
  if (Object.keys(r.notes).some(k => /^label raised/.test(k)) || r.quality.excluded || r.mostlyPictures || !conv.prims.some(p => p.t === 'text')) return null;
  // and it uses the content area: a small design in a corner of it is rebuilt at full size instead
  const ext = unionBox(conv.prims.map(p => p.t === 'line' ? { x: Math.min(p.x1, p.x2), y: Math.min(p.y1, p.y2), w: Math.abs(p.x2 - p.x1), h: Math.abs(p.y2 - p.y1) } : p));
  if (ext.w * ext.h < 0.6 * R.w * R.h) return null;
  r.rebuilt = false; r.arrangement = 'as designed';
  r.notes = Object.assign({ 'kept as designed: made for the content area at 22 pt, converted shape by shape': 1 }, r.notes);
  return { prims: conv.prims, report: r, rebuilt: false, asDrawn: true, added: [], arrangement: 'as designed', missing: [], labels: [] };
}
