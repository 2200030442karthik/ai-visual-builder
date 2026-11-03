/* Shared by harness.html and diag.html: a zip writer (Napkin-like .pptx files) and the strict PowerPoint stand-in. */
/* A .pptx-like zip: the first entry stored, the others deflated (both ways Napkin's file may use). */
async function zipFile(files) {
  const enc = new TextEncoder(), parts = [], central = [];
  let off = 0, k = 0;
  for (const [name, text] of Object.entries(files)) {
    const nb = enc.encode(name), raw = enc.encode(text), method = k++ ? 8 : 0;
    const data = method ? new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()) : raw;
    const lh = new Uint8Array(30 + nb.length), lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(8, method, true); lv.setUint32(18, data.length, true); lv.setUint32(22, raw.length, true); lv.setUint16(26, nb.length, true); lh.set(nb, 30);
    const ch = new Uint8Array(46 + nb.length), cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(10, method, true); cv.setUint32(20, data.length, true); cv.setUint32(24, raw.length, true); cv.setUint16(28, nb.length, true); cv.setUint32(42, off, true); ch.set(nb, 46);
    parts.push(lh, data); central.push(ch); off += lh.length + data.length;
  }
  const end = new Uint8Array(22), dv = new DataView(end.buffer), size = central.reduce((a, c) => a + c.length, 0);
  dv.setUint32(0, 0x06054b50, true); dv.setUint16(8, central.length, true); dv.setUint16(10, central.length, true); dv.setUint32(12, size, true); dv.setUint32(16, off, true);
  return new Uint8Array(await new Blob([...parts, ...central, end]).arrayBuffer());
}

/* Strict PowerPoint stand-in. reject(kind, value) can be set by a test to refuse one more thing. */
function installMock(W) {
  let n = 0, pending = null;
  const M = W.__mock = { shapes: [], slides: [], groups: 0, syncs: 0, reject: null, layoutName: 'Content_Slide', lookAlike: false };
  const HEXRE = /^#[0-9A-Fa-f]{6}$/;
  /* Tags as PowerPoint keeps them (V10.12): keys upper case; M.tagUpper = a PowerPoint that also changes the values,
     M.tagFail = one that refuses tags. */
  const tagsObj = () => { const m = new Map(); return { add(k, v) { if (M.tagFail) bad('TagCollection.add'); m.set(String(k).toUpperCase(), M.tagUpper ? String(v).toUpperCase() : String(v)); },
    delete(k) { m.delete(String(k).toUpperCase()); }, load() {}, get items() { return [...m].map(([key, value]) => ({ key, value })); },
    getItemOrNullObject(k) { const key = String(k).toUpperCase(); return { load() {}, key, get isNullObject() { return !m.has(key); }, get value() { return m.get(key); } }; } }; };
  const bad = (what) => { if (!pending) pending = Object.assign(new Error('InvalidArgument'), { code: 'InvalidArgument', debugInfo: { errorLocation: what } }); };
  const shapeObj = (slide, kind, o, text) => {
    const s = { id: 'sh' + (++n), kind, type: kind === 'text' ? 'TextBox' : kind.startsWith('line') ? 'Line' : 'GeometricShape', name: kind, left: o.left, top: o.top, width: o.width, height: o.height,
      fill: { setSolidColor(c) { if (!HEXRE.test(c)) bad('ShapeFill.setSolidColor'); s.fillColor = c; }, clear() { s.fillColor = null; } },
      lineFormat: new Proxy({}, { set(t, k, v) { if (k === 'color' && !HEXRE.test(v)) bad('ShapeLineFormat.color'); if (k === 'weight' && !(v > 0)) bad('ShapeLineFormat.weight');
        if (k === 'dashStyle' && !['Dash', 'Solid', 'RoundDot'].includes(v)) bad('ShapeLineFormat.dashStyle'); t[k] = v; return true; } }),
      textFrame: { textRange: { text: text || '', font: new Proxy({ load() {} }, { set(t, k, v) { if (k === 'size' && !(v > 0 && v <= 4000)) bad('ShapeFont.size'); if (k === 'color' && !HEXRE.test(v)) bad('ShapeFont.color');
        if (k === 'name' && M.reject === 'font' ) bad('ShapeFont.name'); t[k] = v; return true; } }), paragraphFormat: {}, load() {} } },
      tags: tagsObj(), get parentGroup() { if (!s._parent) throw new Error('GeneralException: not in a group'); return s._parent; },
      load() {}, delete() { if (M.failDelete) { bad('Shape.delete'); return; } const i = slide.items.indexOf(s); if (i >= 0) slide.items.splice(i, 1); } };
    Object.defineProperty(s, 'rotation', { set(v) { if (!(v >= 0 && v < 360)) bad('Shape.rotation'); s._rot = v; }, get() { return s._rot || 0; } });
    if (!(o.width > 0 && o.height > 0) || ![o.left, o.top].every(Number.isFinite)) bad('ShapeCollection.add (size)');
    return s;
  };
  const makeSlide = id => {
    // the layout as PowerPoint reports it (M.layoutName switches the selected slide's layout for the gate tests)
    // as PowerPoint Desktop reported LVC_Template.pptx's Content_Slide (30 Oct): background picture, title, heading and
    // content placeholders, the tag strip right of the slide; its master had 20 layouts after a Napkin slide import.
    // A look-alike (same name, another deck) and the empty "Content_Slide" a slide import brings along have none of them.
    const layoutShapes = { load() {}, get items() { return M.lookAlike ? [{ left: 60, top: 150, width: 1160, height: 500 }] : M.imported0 ? []
      : [{ left: 0, top: 0, width: 1280, height: 720 }, { left: 101.7, top: 205, width: 1078.5, height: 435.2 }, { left: 101.7, top: 119.1, width: 1078.5, height: 71.2 },
        { left: -0.8, top: 18.1, width: 1281.6, height: 54.1 }, { left: 1287.2, top: 0, width: 80.8, height: 720.3 }]; } };
    const masterLayouts = { load() {}, get items() { return Array.from({ length: M.lookAlike ? 11 : 20 }, (_, i) => ({ id: 'L' + i })); } };
    const slide = { id, items: [], tags: tagsObj(), layout: { id: 'L-content', get name() { return M.layoutName; }, shapes: layoutShapes, load() {} }, slideMaster: { id: 'M-lvc', name: 'Simplilearn LVC', layouts: masterLayouts, load() {} }, load() {}, delete() { const i = M.slides.indexOf(slide); if (i >= 0) M.slides.splice(i, 1); } };
    const ph = (name, o) => Object.assign(shapeObj(slide, 'ph', o, ''), { type: 'Placeholder', name });
    slide.items.push(ph('Title 1', { left: 88, top: 38, width: 1000, height: 90 }), ph('Content Placeholder 2', { left: 102, top: 205, width: 1079, height: 435 }));
    const add = s => { slide.items.push(s); return s; };
    slide.shapes = { get items() { return slide.items; }, load() {},
      addGeometricShape(t, o) { if (M.reject && M.reject === t) bad('ShapeCollection.addGeometricShape'); return add(shapeObj(slide, String(t), o)); },
      addTextBox(text, o) { if (!String(text).trim()) bad('ShapeCollection.addTextBox (empty)'); if (M.failText && String(text).includes(M.failText)) bad('ShapeCollection.addTextBox (test)'); return add(shapeObj(slide, 'text', o, text)); },
      addLine(t, o) { return add(shapeObj(slide, 'line:' + t, o)); },
      addTable(r, c, o) { add(shapeObj(slide, 'table', o)); return { getTable() { return { getCellOrNullObject() { return { fill: { setSolidColor() {} }, font: {} }; } }; } }; },
      addGroup(ids) { M.groups++;
        if (!M.realGroups) return { name: '', tags: tagsObj() };
        // V10.12 tests: a real group - its members leave the slide's top level and are reached through group.shapes
        const mem = slide.items.filter(x => ids.includes(x.id)), b = { left: Math.min(...mem.map(x => x.left)), top: Math.min(...mem.map(x => x.top)) };
        b.width = Math.max(...mem.map(x => x.left + x.width)) - b.left; b.height = Math.max(...mem.map(x => x.top + x.height)) - b.top;
        const g = shapeObj(slide, 'group', b);
        g.type = 'Group'; g.group = { shapes: { items: mem, load() {}, getItem(id) { return mem.find(x => x.id === id); } } };
        mem.forEach(x => { slide.items.splice(slide.items.indexOf(x), 1); x._parent = g; });
        return add(g); },
      getItem(id) { return slide.items.find(x => x.id === id) || { delete() {}, textFrame: { textRange: {} } }; } };
    return slide;
  };
  M.slides.push(makeSlide('slide-1'));
  let selected = M.slides[0];
  const ctx = { sync: async () => { M.syncs++; if (pending) { const e = pending; pending = null; throw e; } }, presentation: {
    getSelectedSlides() { return { getCount: () => ({ value: 1 }), getItemAt: () => selected, load() {}, get items() { return [selected]; } }; },
    getSelectedShapes() { const a = M.selShapes || []; return { getCount: () => ({ value: a.length }), load() {}, items: a }; },
    tags: M.presTags = tagsObj(),
    setSelectedSlides(ids) { selected = M.slides.find(s => s.id === ids[0]) || selected; },
    slides: { get items() { return M.slides; }, load() {}, getItem(id) { return M.slides.find(s => s.id === id); },
      add(o) { M.addedLayouts = (M.addedLayouts || []).concat(o.layoutId); const s = makeSlide('slide-' + (++n)); M.slides.splice(o.index != null ? o.index : M.slides.length, 0, s); } },
    insertSlidesFromBase64(b64, o) { M.imported = (M.imported || 0) + 1; M.lastImport = b64; const s = makeSlide('slide-' + (++n)); s.items.push(shapeObj(s, 'text', { left: 100, top: 200, width: 400, height: 60 }, 'Napkin text'));
      M.slides.splice(o.targetSlideId ? M.slides.findIndex(x => x.id === o.targetSlideId) + 1 : M.slides.length, 0, s); } } };
  W.PowerPoint = { run: async f => f(ctx), GeometricShapeType: {} };
  W.Office = { context: { requirements: { isSetSupported: (set, v) => set === 'PowerPointApi' ? (v !== '1.8' || true) : true },
    document: { setSelectedDataAsync(d, o, cb) { M.pictures = (M.pictures || 0) + 1; selected.items.push(shapeObj(selected, 'picture', { left: o.imageLeft, top: o.imageTop, width: o.imageWidth, height: o.imageHeight })); cb({ status: 'ok' }); } } }, AsyncResultStatus: { Succeeded: 'ok' }, CoercionType: { Image: 'image', XmlSvg: 'svg' } };
  M.added = () => M.slides.reduce((k, s) => k + s.items.filter(x => x.type !== 'Placeholder').length, 0);
  M.reset = () => { M.slides.splice(0, M.slides.length, makeSlide('slide-1')); selected = M.slides[0]; M.reject = null; pending = null; M.pictures = 0; M.imported = 0; };
  // text that went in with another font than Open Sans
  M.fontBad = () => M.slides.flatMap(s => s.items).filter(x => x.type !== 'Placeholder' && x.textFrame && String(x.textFrame.textRange.text || '').trim() && x.textFrame.textRange.font.name !== 'Open Sans').length;
}
