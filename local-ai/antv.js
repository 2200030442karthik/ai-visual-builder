/* AI Visual Builder design pack "antv" 10.24.0 - premium infographic structures drawn by AntV Infographic (MIT,
   vendor/antv-infographic-LICENSE.txt; the library is served by the panel host, nothing is fetched from the internet):
   3D cylinders and pucks, arrow timelines with icons, icon lines, ribbon and candy cards, roadmaps, steps, cycles,
   funnels and pyramids. Each is a layout like every other (regPlan): Generate offers it where the content suits it,
   Claude can choose it by its key, and inserting, editing and redrawing for the free area work as for the rest.
   How a design is made PowerPoint-native (antvDraw, synchronous):
     1. the library draws the structure (no title: the topic is drawn in the brand style above it) in a hidden canvas
        a little smaller than the area, so its own 14-16 px text lands at about 22 pt when the design is scaled up;
     2. every HTML label (foreignObject) becomes real SVG text, line by line as the browser laid it out;
     3. every icon slot (data-element-type item-icon) gets the catalogue's object for that point (gallery.js CMP,
        Claude's own icons too) as shapes - white on a coloured badge, else in the point's colour;
     4. svg2ppt.js svgToPrims (faithful) turns it into native shapes, lines and text boxes; the texts are matched back
        to the points' exact words; plan.js planRender0 then applies the brand and checks it (lenient: overlapping
        labels and lost words block it; a 3D part beside a number is the design).
   Loaded after plan.js and the vendor script. */
const ANTV = { cache: new Map() };
/* [key, AntV template, name, relation it draws, min items, max items, kind] */
const ANTV_LAYOUTS = [
  ['avcylinders', 'sequence-cylinders-3d-simple', '3D cylinders', 'sequence', 3, 6, 'sequence'],
  ['avarrowrow', 'list-row-horizontal-icon-arrow', 'Arrow timeline with icons', 'sequence', 3, 6, 'sequence'],
  ['avcirclearrows', 'sequence-circle-arrows-indexed-card', 'Circular arrows', 'cycle', 3, 6, 'sequence'],
  ['avfunnel', 'sequence-funnel-simple', 'Funnel', 'funnel', 3, 6, 'layered'],
  ['avpyramid', 'sequence-pyramid-simple', 'Pyramid', 'layers', 3, 5, 'layered'],
  ['avstairsfront', 'sequence-stairs-front-pill-badge', '3D stacked steps', 'sequence', 3, 6, 'sequence'],
  ['avpucks', 'sequence-zigzag-pucks-3d-simple', '3D pucks', 'sequence', 3, 6, 'sequence'],
  ['avdiamonds', 'sequence-zigzag-steps-underline-text', '3D diamond path', 'sequence', 3, 6, 'sequence'],
  ['avrise', 'list-zigzag-up-simple', 'Rising arrow', 'sequence', 3, 5, 'sequence'],
  ['avascending', 'sequence-ascending-steps', 'Ascending steps', 'sequence', 3, 5, 'sequence'],
  ['avsnake', 'sequence-color-snake-steps-horizontal-icon-line', 'Snake line with icons', 'sequence', 4, 6, 'sequence'],
  ['avtimeline', 'sequence-timeline-simple', 'Vertical timeline', 'sequence', 3, 6, 'sequence'],
  ['avring', 'sequence-circular-simple', 'Ring cycle', 'cycle', 3, 6, 'sequence'],
  ['avquarter', 'quadrant-quarter-circular', 'Quarter circle', 'list', 4, 4, 'list'],
  ['aviconline', 'list-row-horizontal-icon-line', 'Icon line', 'any', 3, 6, 'list'],
];
const ANTV_NS = 'http://www.w3.org/2000/svg';
function antvParse(v) {
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?/.exec(v || '');
  if (m) return m[4] !== undefined && +m[4] < 0.05 ? null : '#' + [m[1], m[2], m[3]].map(x => (+x).toString(16).padStart(2, '0')).join('').toUpperCase();
  const h = /^#?([0-9a-f]{6})$/i.exec(String(v || '').trim());
  return h ? '#' + h[1].toUpperCase() : null;
}
const antvLight = c => !!c && typeof luminance === 'function' && luminance(c) > 0.85;
/* The live SVG made convertible: HTML labels as SVG text lines, icon slots as the catalogue's shapes. */
function antvNative(svg, icons) {
  svg.querySelectorAll('[data-element-type^="btn"]').forEach(e => e.remove());       // the library's editor buttons
  svg.style.visibility = ''; svg.removeAttribute('visibility');                     // shown once its icons load: ours are drawn here
  // 1. labels: each foreignObject -> <text> with one tspan per laid-out line (positions in the parent's coordinates)
  [...svg.querySelectorAll('foreignObject')].forEach(fo => {
    const parent = fo.parentNode, ctm = parent.getScreenCTM && parent.getScreenCTM();
    if (!ctm) { fo.remove(); return; }
    const inv = ctm.inverse(), toSvg = (x, y) => { const p = svg.createSVGPoint(); p.x = x; p.y = y; return p.matrixTransform(inv); };
    const words = [], walker = document.createTreeWalker(fo, NodeFilter.SHOW_TEXT);
    let first = null;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n.nodeValue; if (!t.trim()) continue;
      if (!first) first = n.parentElement;
      const re = /\S+/g; let m;
      while ((m = re.exec(t))) { const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
        const b = r.getClientRects()[0]; if (b && b.width > 0) words.push({ w: m[0], b }); }
    }
    if (!words.length) { fo.remove(); return; }
    const lines = [];
    words.forEach(x => { const L = lines[lines.length - 1]; if (L && Math.abs(L.top - x.b.top) < x.b.height * 0.5) { L.words.push(x.w); L.right = x.b.right; } else lines.push({ top: x.b.top, left: x.b.left, right: x.b.right, bottom: x.b.bottom, words: [x.w] }); });
    const cs = getComputedStyle(first), size = parseFloat(cs.fontSize) || 14, sc = Math.hypot(inv.a, inv.b) || 1, mid = /center/.test(cs.textAlign);
    const t = document.createElementNS(ANTV_NS, 'text');
    t.setAttribute('font-size', size * sc); t.setAttribute('font-family', 'Open Sans');
    t.setAttribute('font-weight', parseInt(cs.fontWeight, 10) >= 600 ? 'bold' : 'normal');
    t.setAttribute('fill', antvParse(cs.color) || '#262626'); t.setAttribute('text-anchor', mid ? 'middle' : 'start');
    lines.forEach(L => {
      const s = document.createElementNS(ANTV_NS, 'tspan'), p = toSvg(mid ? (L.left + L.right) / 2 : L.left, L.top + (L.bottom - L.top) * 0.78);
      s.setAttribute('x', p.x); s.setAttribute('y', p.y); s.textContent = L.words.join(' '); t.appendChild(s);
    });
    parent.insertBefore(t, fo); fo.remove();
  });
  // 2. icon slots: the point's object, as shapes
  [...svg.querySelectorAll('[data-element-type="item-icon"]')].forEach(u => {
    const i = parseInt(u.getAttribute('data-indexes'), 10) || 0, key = icons[i] && CMP[icons[i]] ? icons[i] : 'none';
    const x = parseFloat(u.getAttribute('x')) || 0, y = parseFloat(u.getAttribute('y')) || 0, w = parseFloat(u.getAttribute('width')) || 0, h = parseFloat(u.getAttribute('height')) || 0;
    if (!w || !h) { u.remove(); return; }
    const own = antvParse(u.getAttribute('fill')) || antvParse(getComputedStyle(u).color), s = Math.min(w, h), c = TEMPLATE.accents[i % TEMPLATE.accents.length];
    // white on a coloured badge (a filled shape under it in its group); on a white ring it takes the point's colour
    // what is directly under the icon's centre: the last filled shape before it in its group that contains the centre
    const cx = x + w / 2, cy = y + h / 2;
    let top = null;
    for (const e of u.parentNode.children) {
      if (e === u) break;
      if (!/^(circle|ellipse|rect|path|polygon)$/.test(e.localName)) continue;
      const f = antvParse(e.getAttribute('fill') || getComputedStyle(e).fill);
      if (!f) continue;
      try { const bb = e.getBBox(); if (cx > bb.x && cx < bb.x + bb.width && cy > bb.y && cy < bb.y + bb.height) top = f; } catch (er) { /* not drawn */ }
    }
    const white = antvLight(own) && !!top && !antvLight(top);
    // a marker word at the slot (its place and size survive the conversion exactly); antvDraw draws the object there as
    // native shapes - never a picture
    const col = (white ? c : own && !antvLight(own) ? own : c).replace('#', '').toUpperCase();
    const t = document.createElementNS(ANTV_NS, 'text');
    t.setAttribute('x', cx); t.setAttribute('y', cy + s * 0.36); t.setAttribute('font-size', s); t.setAttribute('text-anchor', 'middle');
    t.setAttribute('font-family', 'Open Sans'); t.setAttribute('fill', '#000000');
    t.textContent = `ICONMARK${i}${white ? 'w' : 'c'}${col}`;
    u.parentNode.insertBefore(t, u); u.remove();
  });
  svg.querySelectorAll('use').forEach(u => u.remove());                // anything the library would fetch later
  return svg;
}
const antvTheme = () => {
  const acc = TEMPLATE.accents.slice(0, 10), ink = (typeof BRAND === 'object' && BRAND.ink) || '#262626';
  return { palette: acc, colorPrimary: acc[0], colorBg: '#FFFFFF', base: { text: { 'font-family': 'Open Sans', fill: ink } },
    item: { label: { 'font-weight': 'bold', 'font-family': 'Open Sans' }, desc: { 'font-family': 'Open Sans', fill: ink } } };
};
/* The library's drawing for the points at canvas width cw (cached: the same content redrawn for another height reuses it) */
function antvSvg(P, tpl, cw) {
  const A = window.AntVInfographic;
  if (!A) return null;
  const sig = tpl + '|' + Math.round(cw) + '|' + P.items.map(i => i.label + '\u0001' + (i.detail || '') + '\u0001' + (i.icon || '')).join('\u0002') + '|' + TEMPLATE.accents.join();
  if (ANTV.cache.has(sig)) return ANTV.cache.get(sig);
  const host = document.createElement('div'), ch = Math.round(cw * 0.42);
  host.style.cssText = `position:absolute;left:-30000px;top:0;width:${Math.round(cw)}px;height:${ch}px;overflow:hidden`;
  document.body.appendChild(host);
  let text = null;
  try {
    const ig = new A.Infographic({ container: host, width: Math.round(cw), height: ch, template: tpl, themeConfig: antvTheme(), svg: { background: false },
      data: { title: '', lists: P.items.map(it => ({ label: it.label, desc: it.detail || '', icon: 'aivb:' + (it.icon || 'none') })) } });
    ig.render();
    const svg = host.querySelector('svg');
    if (svg) { antvNative(svg, P.items.map(i => i.icon)); text = new XMLSerializer().serializeToString(svg); }
    try { ig.destroy && ig.destroy(); } catch (e) { /* gone with its host */ }
  } catch (e) { text = null; }
  finally { host.remove(); }
  if (ANTV.cache.size > 200) ANTV.cache.clear();
  ANTV.cache.set(sig, text);
  return text;
}
/* Text boxes the size PowerPoint needs (Open Sans): wider about their anchor, never beyond the area. */
function antvRoom(prims, R) {
  return prims.map(p => {
    if (p.t !== 'text' || !p.text) return p;
    let w = p.w;
    // wider only: each line stays one line, so the height the converter measured holds
    for (let i = 0; i < 12 && cutOff(p.text, w, p.size, 1e4); i++) w *= 1.08;
    if (w === p.w) return p;
    w = Math.min(w, R.w);
    const x = p.align === 'center' ? p.x + p.w / 2 - w / 2 : p.x;
    return Object.assign({}, p, { x: Math.max(R.x, Math.min(x, R.x + R.w - w)), w });
  });
}
/* One design: the topic in the brand style, the library's structure under it, the texts as the points' exact words. */
function antvDraw(P, tpl, R, o) {
  if (!window.AntVInfographic) return planNo('the infographic library is not loaded');
  const out = [], title = String(P.title || '').trim();
  let RR = R;
  if (title) {
    if (!planWords(title, R.w, 24) || linesAt(title, R.w * 0.95, 24) > 2) return planNo('the topic does not fit');
    const th = planLH(title, R.w, 24);
    out.push(label(R.x, R.y, R.w, th, title, { size: 24, bold: true, color: INK, align: 'left', valign: 'top' }));
    RR = { x: R.x, y: R.y + th + 6, w: R.w, h: R.h - th - 6 };
  }
  if (RR.h < 120) return planNo('no room under the topic');
  const svg = antvSvg(P, tpl, R.w * o.c);
  if (!svg) return planNo('the library could not draw it');
  let conv;
  try { conv = svgToPrims(svg, RR, { faithful: true }); } catch (e) { return planNo('could not be converted (' + (e && e.message || e) + ')'); }
  // the points' exact words: a converted text that reads as a label or a description (lines joined, case, a leading
  // step number such as "02") becomes exactly it; text sizes at the template's 22 pt (24 for labels in bold)
  // the design as drawn must already be readable: its text raised to 22 pt by more than a tenth would spill out of its
  // cards, so this size is refused (planRender tries a taller area or a closer canvas next)
  const MARK = /^ICONMARK(\d+)([wc])([0-9A-F]{6})$/, isMark = p => p.t === 'text' && MARK.test(String(p.text || '').trim());
  const small = conv.prims.filter(p => p.t === 'text' && p.text && !isMark(p)).reduce((m, p) => Math.min(m, p.size), 99);
  if (small < PLAN_DS * 0.9) return planNo(`its text would be ${Math.round(small)} pt`);
  const norm = s => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase(), want = new Map();
  P.items.forEach(it => { want.set(norm(it.label), it.label); if (it.detail) want.set(norm(it.detail), it.detail); });
  const prims = conv.prims.flatMap(p => {
    // an icon slot: the point's object as native shapes, centred where the design put it, its size
    if (isMark(p)) {
      const m = MARK.exec(String(p.text).trim()), i = +m[1], it = P.items[i] || {}, key = it.icon && CMP[it.icon] ? it.icon : 'none';
      const D = p.size * 0.92, cx = p.x + p.w / 2, cy = p.y + p.h / 2, c = '#' + m[3];
      let ic = comp(key, cx - D / 2, cy - D / 2, D, c);
      if (m[2] === 'w') ic = ic.map(q => Object.assign(q, q.fill ? { fill: antvLight(q.fill) ? c : '#FFFFFF' } : {}, q.line ? { line: '#FFFFFF' } : {}, q.t === 'line' ? { color: '#FFFFFF' } : {}));
      return ic;
    }
    if (p.t !== 'text' || !p.text) return [p];
    let k = norm(p.text);
    if (!want.has(k)) { const m = /^\d{1,2}\s+(.+)$/.exec(k); if (m && want.has(m[1])) k = m[1]; }
    const q = Object.assign({}, p, { size: Math.max(p.size, PLAN_DS) });
    if (want.has(k)) q.text = String(p.text).includes('\n') ? antvLines(want.get(k), p.text) : want.get(k);
    return [q];
  });
  return out.concat(antvRoom(prims, R));
}
/* The point's exact words in the lines the design gave them (a description over two lines stays on two lines). */
function antvLines(exact, drawn) {
  const ws = String(exact).split(/\s+/), counts = String(drawn).replace(/^\s*\d{1,2}\s+/, '').split('\n').map(l => l.trim().split(/\s+/).filter(Boolean).length);
  if (counts.reduce((a, b) => a + b, 0) !== ws.length) return exact;
  let at = 0;
  return counts.map(n => { const l = ws.slice(at, at + n).join(' '); at += n; return l; }).join('\n');
}
registerPack('antv', '10.24.0', () => {
  ANTV_LAYOUTS.forEach(([key, tpl, name, rel, lo, hi, kind]) => {
    const why = P => {
      if (!window.AntVInfographic) return 'the infographic library is not loaded';
      if (planGroups(P).length) return 'not for grouped content';
      if (P.items.length < lo || P.items.length > hi) return `works for ${lo} to ${hi} points`;
      const seq = typeof planSeq === 'function' && planSeq(P);
      if (rel === 'sequence' && !seq) return 'only for steps in a stated order';
      if (rel === 'cycle' && P.relation !== 'cycle') return 'only for a cycle stated in the content';
      if (rel === 'funnel' && P.relation !== 'funnel') return 'only for content that narrows down';
      if (rel === 'layers' && P.relation !== 'layers') return 'only for levels or a hierarchy';
      if (rel === 'list' && (seq || /^(cycle|funnel|layers|comparison)$/.test(P.relation))) return 'for independent points';
      if (P.statement) return 'not for one statement';
      return '';
    };
    regPlan(key, { name, family: key, kind, appeal: 6, lenient: true, antv: tpl, suits: P => !why(P), needs: why,
      opts: [{ c: 0.66 }, { c: 0.56 }, { c: 0.48 }, { c: 0.42 }], build: (P, R, o) => antvDraw(P, tpl, R, o) });
  });
});
