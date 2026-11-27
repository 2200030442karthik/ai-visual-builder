/* AI Visual Builder 10.12.1 - a provider's original design (Napkin's SVG, or the first slide of its PowerPoint export
   drawn as SVG by pptx.js) as one high-fidelity SVG picture, offered beside the editable version (napkin.js: "Insert
   editable", "Insert original", "Insert both"). Nothing is requested: the files the panel host already keeps are used.
   - Safe: cleaned by svg2ppt.js cleanSvg (no scripts, event handlers, foreign content or external links); only fonts
     embedded in the file itself (data:font) are kept, so the text renders in the typography it was designed with.
   - Fitted, never cropped or distorted: scaled by one factor into the free content area and centred in it.
   - Validated before it is offered and again for the slide it goes on: its own text against the content (napkin.js
     accuracy: missing points and invented text are flagged, wrong figures or most of the content missing block it), and
     its readability, the smallest text in points once fitted. The design's typography is kept, so text below the 22 pt
     of the editable version is flagged, and text below ORIGINAL_MIN_PT blocks it (unreadable on a slide).
   - The preview is the inserted object: the same cleaned SVG at the same place (an image primitive drawn by thumb). */
const ORIGINAL_MIN_PT = 9;     // a fitted original whose smallest text is below this is not offered (Napkin's own text is 15-25 units)

/* The item's original as { ok, svg, href, vw, vh, minU, texts, fonts, from } or { ok: false, why }. */
function originalAsset(it) {
  const src = it.fmt === 'ppt' ? (it.pptSlide && it.pptSlide.els.length ? pptxSvg(it.pptSlide, it.pptR) : '') : it.fmt === 'svg' ? it.data : '';
  if (!src) return { ok: false, why: it.fmt === 'plan' ? '' : 'the file has no drawable first slide' };
  let host = null;
  try {
    const root = cleanSvg(src, { fonts: true }), vb = root.viewBox && root.viewBox.baseVal;
    const vw = vb && vb.width ? vb.width : parseFloat(root.getAttribute('width')) || 0, vh = vb && vb.height ? vb.height : parseFloat(root.getAttribute('height')) || 0;
    if (!(vw > 0 && vh > 0)) return { ok: false, why: 'the SVG has no size' };
    // scales with the picture: a viewBox and the design's own size (PowerPoint sets the size it is placed at)
    if (!(vb && vb.width)) root.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
    root.setAttribute('width', vw); root.setAttribute('height', vh);
    // the size of every text as drawn (its font size under its transforms), in the SVG's units
    host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:-30000px;top:0;width:10px;height:10px;overflow:hidden';
    const svg = document.importNode(root, true);
    host.appendChild(svg); document.body.appendChild(host);
    const sizes = [], fonts = new Set();
    svg.querySelectorAll('text').forEach(t => {
      if (!t.textContent.trim()) return;
      const m = t.getCTM(), cs = getComputedStyle(t);
      sizes.push(parseFloat(cs.fontSize) * (m ? Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) : 1));
      fonts.add(String(cs.fontFamily || '').split(',')[0].replace(/["']/g, '').replace(/\s+(Regular|Bold|SemiBold|Light)$/i, '').trim());
    });
    const out = new XMLSerializer().serializeToString(root);
    return { ok: true, svg: out, href: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(out), vw, vh, minU: sizes.length ? Math.min(...sizes) : 0,
      texts: svgTexts(out), fonts: [...fonts].filter(Boolean), from: it.fmt === 'ppt' ? 'PowerPoint export (first slide)' : 'SVG' };
  } catch (e) { return { ok: false, why: 'its SVG could not be read (' + (e && e.message || e) + ')' }; }
  finally { if (host) host.remove(); }
}

/* Where the original goes in `rect`: one scale factor (no distortion), centred, wholly inside (no cropping). */
function originalPlace(a, rect) {
  const k = Math.min(rect.w / a.vw, rect.h / a.vh), w = a.vw * k, h = a.vh * k;
  return { x: rect.x + (rect.w - w) / 2, y: rect.y + (rect.h - h) / 2, w, h, k, minPt: Math.round(a.minU * k * 10) / 10 };
}
/* The original as the panel's image primitive (the preview draws exactly what insertSvgAt inserts). */
const originalPrim = (a, rect) => Object.assign({ t: 'image', svg: a.svg, href: a.href }, originalPlace(a, rect));

/* Validation of the original in the template's content area: a.check (the accuracy of its own text) -> a.block,
   a.warn, a.status, a.minPt. A blocked original is never inserted; a flagged one says why on its card and on insertion. */
function originalReview(a, check) {
  const at = originalPlace(a, Object.assign({}, TEMPLATE.contentArea)), block = [], warn = [];
  a.check = check; a.minPt = at.minPt;
  if (!a.texts.length) block.push('no text could be read in it, so its content cannot be checked');
  else if (check.status === 'unusable') block.push(check.notes.slice(0, 3).join('; '));
  if (a.minU && at.minPt < ORIGINAL_MIN_PT) block.push(`its smallest text would be ${at.minPt} pt in the content area (below ${ORIGINAL_MIN_PT} pt: unreadable on a slide)`);
  if (check.status !== 'unusable' && check.missing.length) warn.push(`missing in this design: ${check.missing.join(', ')}`);
  if (check.extra && check.extra.length) warn.push(`text not in your content: ${check.extra.join(', ')}`);
  (check.notes || []).filter(n => /check the order|figure/.test(n)).forEach(n => warn.push(n));
  if (a.minU && at.minPt >= ORIGINAL_MIN_PT && at.minPt < BRAND.minPt) warn.push(`text from ${at.minPt} pt once fitted (the design's own typography; the editable version uses ${BRAND.minPt} pt and up)`);
  const other = a.fonts.filter(f => !/^open sans$/i.test(f) && !/^(sans-serif|serif)$/i.test(f));
  if (other.length) warn.push(`font${other.length > 1 ? 's' : ''} ${other.join(', ')} (not Open Sans)`);
  a.block = block; a.warn = warn;
  a.status = block.length ? 'Blocked: ' + block[0] : check.missing.length ? `Partially complete: ${check.missing.join(', ')} missing` : 'Complete';
  return a;
}
