/* AI Visual Builder 10.12.2 - "Original editable": a provider's original design (original.js) drawn as native, editable
   PowerPoint objects, as close to the design as PowerPoint's API allows (svg2ppt.js svgToPrims with o.faithful): its
   composition, positions, proportions, spacing and hierarchy kept; boxes, rounded boxes, pills, circles and ellipses
   native (also when Napkin draws them as curves); connectors native lines; every text its own editable text box at its
   place and size; icons and illustrations (free curves) separate pictures - counted and named, never called editable.
   - The brand: Open Sans, the approved colours (pictures too), readable contrast, inside the content area.
   - Readability: text below ORIGINAL_MIN_PT once fitted is not inserted on one slide: a tall design is split at clean
     gaps (nothing crosses the cut) into up to FAITHFUL_MAX_SLIDES continuation slides with one common scale, never
     by leaving content out; when no clean split makes it readable, the version is blocked (said).
   - Checked: every text of the design kept word for word; its content against the source (napkin.js accuracy:
     invented figures block it, a missing point is flagged); overlapping text, text outside the content area.
   - The preview is the insertion: the same build for the same free area. */
const FAITHFUL_MAX_SLIDES = 3;

/* it.orig (original.js) -> { ok, parts: [prims per slide], report, texts, block, warn } or { ok: false, why }. */
function faithfulBuild(it, R) {
  const a = it.orig;
  if (!a || !a.ok) return { ok: false, why: a && a.why || '' };
  let one;
  try { one = svgToPrims(a.svg, R, { faithful: true }); } catch (e) { return { ok: false, why: 'the design could not be drawn natively (' + (e && e.message || e) + ')' }; }
  let parts = [one], split = '';
  if (one.report.minPt < ORIGINAL_MIN_PT) {
    const sp = faithfulSplit(a.svg, R, one.report);
    if (sp) { parts = sp.parts; split = sp.why; }
  }
  const notes = {};
  parts.forEach(p => Object.entries(p.report.notes).forEach(([k, v]) => { notes[k] = (notes[k] || 0) + v; }));
  const joined = parts.reduce((n, p) => n + faithfulJoin(p.prims, it.source || ''), 0);
  if (joined) notes['a word split across two lines joined again'] = joined;
  const all = parts.flatMap(p => p.prims), T = all.filter(p => p.t === 'text');
  const report = { shapes: all.filter(p => p.t === 'shape').length, lines: all.filter(p => p.t === 'line').length, texts: T.length, pictures: all.filter(p => p.t === 'image').length,
    notes, slides: parts.length, minPt: Math.min(...T.map(p => p.size)), split };
  report.native = report.shapes + report.lines + report.texts;
  report.edit = report.pictures ? 'partial' : 'full';
  const block = [], warn = [];
  // every word of the design's own text is in an editable text box (a turned text is a picture: said, not lost)
  const words = t => String(t).toLowerCase().match(/[\p{L}\p{N}%.,:+\-=/()]+/gu) || [];
  const have = new Set(T.flatMap(p => words(p.text))), flat = T.map(p => String(p.text).toLowerCase().replace(/\s+/g, '')).join('|');
  const lost = [...new Set(a.texts.flatMap(words))].filter(w => !have.has(w) && !flat.includes(w));
  if (lost.length) (notes['turned text (kept as a picture)'] ? warn : block).push(`text not converted: ${lost.slice(0, 6).join(' ')}`);
  if (!T.length) block.push('no text could be drawn as text');
  if (report.minPt < ORIGINAL_MIN_PT) block.push(`its smallest text would be ${report.minPt} pt (below ${ORIGINAL_MIN_PT} pt: unreadable) and the design has no clean place to continue on another slide`);
  else if (report.minPt < BRAND.minPt) warn.push(`text from ${report.minPt} pt (the design's own typography, scaled; the editable version uses ${BRAND.minPt} pt and up)`);
  const out = all.filter(p => p.t !== 'line' && (p.x < R.x - 1 || p.y < R.y - 1 || p.x + p.w > R.x + R.w + 1 || p.y + p.h > R.y + R.h + 1));
  if (out.length) block.push(`${out.length} element${out.length > 1 ? 's are' : ' is'} outside the content area`);
  // text over text (each box is its text's own line height and width): illegible, a fault of the design as drawn
  const ink = t => ({ x: t.x + t.size * 0.1, y: t.y + t.size * 0.25, w: Math.max(0, t.w - t.size * 0.6 - t.size * 0.2), h: Math.max(0, t.h - t.size * 0.5) });
  const inter = (p, q) => Math.max(0, Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x)) * Math.max(0, Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y));
  let over = 0;
  parts.forEach(pt => { const t = pt.prims.filter(p => p.t === 'text').map(ink); for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) if (inter(t[i], t[j]) > 0.25 * Math.min(t[i].w * t[i].h, t[j].w * t[j].h)) over++; });
  if (over) warn.push(`${over} pair${over > 1 ? 's' : ''} of texts overlap as designed`);
  if (parts.length > 1) warn.push(`${parts.length} slides: ${split}`);
  const lowC = notes['small text below WCAG contrast on a mid-tone palette colour (the most readable approved text colour used)'];
  if (lowC) warn.push(`${lowC} small text${lowC > 1 ? 's' : ''} on mid-tone palette colours below the WCAG 4.5:1 contrast (no approved text colour reaches it; the most readable one is used)`);
  if (notes['text colour changed for a readable contrast']) warn.push(`${notes['text colour changed for a readable contrast']} text colour${notes['text colour changed for a readable contrast'] > 1 ? 's' : ''} changed for a readable contrast`);
  return { ok: true, parts: parts.map(p => p.prims), report, texts: T.map(p => String(p.text)), block, warn };
}

/* A repair of the design as drawn: a word its file breaks across two lines ("transformati" / "on",
   "automation@exam" / "ple.com") is joined again when the joined word is in the source text and the line still fits
   the shape the text sits on (else a quarter wider than the text was). Returns how many were joined. */
let FAITHFUL_CTX = null;
function faithfulJoin(prims, source) {
  const src = new Set(String(source).split(/\s+/).map(w => w.replace(/^[("'“]+|[)"'”,;:!?]+$|\.$/g, '').toLowerCase()).filter(Boolean));
  if (!src.size) return 0;
  const ctx = FAITHFUL_CTX || (FAITHFUL_CTX = document.createElement('canvas').getContext('2d'));
  const width = (t, p) => { ctx.font = `${p.bold ? 700 : 400} ${p.size}px "${BRAND.font}", sans-serif`; return ctx.measureText(t).width; };
  let n = 0;
  prims.filter(p => p.t === 'text' && p.tight && /\n/.test(p.text)).forEach(p => {
    const lines = p.text.split('\n'), cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    // the shape it sits in: the smallest filled one under its centre (a tab on a card is the tab)
    const under = prims.filter(s => s.t === 'shape' && s.fill && cx > s.x && cx < s.x + s.w && cy > s.y && cy < s.y + s.h).sort((s, q) => s.w * s.h - q.w * q.h)[0];
    const room = under ? under.w - p.size * 0.4 : p.w * 1.25;
    let changed = false;
    for (let i = lines.length - 2; i >= 0; i--) {
      const a = (lines[i].match(/\S+$/) || [''])[0], b = (lines[i + 1].match(/^\S+/) || [''])[0];
      if (!/[\p{L}\p{N}@._-]$/u.test(a) || !/^[\p{Ll}\p{N}.]/u.test(b) || !src.has((a + b).replace(/[,;:!?]+$|\.$/, '').toLowerCase())) continue;
      const one = lines[i] + lines[i + 1];
      if (width(one, p) > room) continue;
      lines.splice(i, 2, one); changed = true; n++;
    }
    if (!changed) return;
    const w = Math.max(...lines.map(l => width(l, p))) + p.size * 0.6, h = lines.length * p.size * 1.362;
    p.text = lines.join('\n');
    if (p.align === 'center') p.x = cx - w / 2;
    p.y = cy - h / 2; p.w = Math.max(p.w, w); p.h = h;
  });
  return n;
}

/* A tall design on 2 or 3 slides: cut only where nothing of it crosses (a gap between rows), one common scale, the
   fewest slides that make its smallest text readable. null when no such split exists. */
function faithfulSplit(svg, R, rep) {
  const E = rep.ext, unit = rep.minPt / rep.scale, spans = rep.rows.filter(r => r[1] - r[0] > 0 && !r.line);
  if (spans.some(r => r[1] - r[0] > 0.9 * E.h)) return null;            // a panel behind everything: one composition
  const merged = [];
  spans.slice().sort((p, q) => p[0] - q[0]).forEach(r => { const m = merged[merged.length - 1]; if (m && r[0] < m[1] + 0.5) m[1] = Math.max(m[1], r[1]); else merged.push(r.slice()); });
  // just above the next row: a connector in the gap stays with the part above (its arrow says "continued")
  const cuts = merged.slice(1).map(m => m[0] - 0.5);
  let best = null;
  for (let n = 2; n <= FAITHFUL_MAX_SLIDES && !best; n++) {
    const combos = n === 2 ? cuts.map(c => [c]) : cuts.flatMap((c, i) => cuts.slice(i + 1).map(d => [c, d]));
    combos.forEach(cs => {
      const bands = [-Infinity, ...cs, Infinity].slice(0, -1).map((y0, i, A) => [y0, i + 1 < A.length ? A[i + 1] : Infinity]);
      const hs = bands.map(([y0, y1]) => { const inB = merged.filter(m => (m[0] + m[1]) / 2 >= y0 && (m[0] + m[1]) / 2 < y1); return inB.length ? inB[inB.length - 1][1] - inB[0][0] : 0; });
      if (hs.some(h => !h)) return;
      const k = Math.min(R.w / Math.max(E.w, 1), ...hs.map(h => R.h / h));
      if (unit * k >= ORIGINAL_MIN_PT && (!best || k > best.k)) best = { k, bands };
    });
  }
  if (!best) return null;
  try {
    const parts = best.bands.map(b => svgToPrims(svg, R, { faithful: true, band: b, k: best.k }));
    return { parts, why: `the design is tall, so it continues on ${parts.length - 1} more slide${parts.length > 2 ? 's' : ''} (cut where nothing crosses; one scale, text from ${Math.round(unit * best.k * 10) / 10} pt)` };
  } catch (e) { return null; }
}

/* The content check of the version (napkin.js accuracy on its texts) -> fe.check, fe.status, more block/warn. */
function faithfulReview(fe, check) {
  fe.check = check;
  if (check.status === 'unusable') fe.block.push(check.notes.slice(0, 3).join('; '));
  else if (check.missing.length) fe.warn.unshift(`missing in this design: ${check.missing.join(', ')}`);
  if (check.extra && check.extra.length) fe.warn.push(`text not in your content: ${check.extra.join(', ')}`);
  fe.status = fe.block.length ? 'Blocked: ' + fe.block[0] : check.missing.length ? `Partially complete: ${check.missing.join(', ')} missing` : 'Complete';
  return fe;
}
/* "57 native objects (12 shapes, 8 lines, 37 texts) and 3 pictures" - never "fully editable" with pictures. */
const faithfulEditText = r => `${r.native} native, editable objects (${r.shapes} shapes, ${r.lines} lines, ${r.texts} texts)` +
  (r.pictures ? ` and ${r.pictures} picture${r.pictures > 1 ? 's' : ''} (icons or illustrations PowerPoint cannot draw as shapes)` : ', no pictures');
