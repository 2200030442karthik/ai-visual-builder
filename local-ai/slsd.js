/* SL Smart Design 10.20.1 - the SL Smart Design ribbon tab (manifest-slsd.xml), owned by this add-in.

   Why the tab belongs to the web add-in: a VBA button cannot open a web add-in's task pane by any supported means (a
   runtime that was never started in a presentation cannot be reached; Office.addin.setStartupBehavior only applies per
   document after a first manual open; OnDocumentOpened needs admin deployment and allows no UI). A web add-in's own
   ShowTaskpane button opens on the first click, every time. So:
     - AI Visual Builder: the manifest's ShowTaskpane button (no code here).
     - Alternative Design, SL Templates, Miscellaneous, Shape Rename: functions of this shared runtime that ask the
       panel host (server.py /api/slsd/run) to run the ORIGINAL macro of the SL Smart Design VBA add-in through
       PowerPoint's Application.Run - its licence check, Select Template window and template library unchanged.
   Alternative Design first prepares the slide (prepareAlternative): the original window always reads the bottom-most
   shape of the slide as the content (RenamePlaceholder) and shows an empty gallery when that shape is not the text
   with 2-10 points (on LVC slides it usually is a placeholder, a group or a background shape). Here the content is
   found, the number of points checked (exactly as the original counts them) and the content sent to the back, so the
   original reads the right text; if the window is cancelled the shape's place and name are restored.
   Outside PowerPoint (tests) the pure functions are used through window.SLSD. */
(function (root) {
  const MIN = 2, MAX = 10, KEEP = 'Content_Text_Box';

  /* The points as DynamicTemplateSelectorForm counts them: paragraphs (CR / LF), lines that VBA's Trim (spaces only)
     leaves non-empty. A line break inside a paragraph (Shift+Enter, \v) does not start a point. */
  function points(text) {
    return String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.replace(/^ +| +$/g, '') !== '');
  }
  const softBreaks = text => (String(text || '').match(/\v/g) || []).length;

  const TITLE_PH = ['Title', 'CenterTitle', 'VerticalTitle'];
  const NO_TEXT = ['Group', 'Image', 'Line', 'Table', 'Chart', 'SmartArt', 'Media', 'Unsupported', 'Graphic', 'Ink', 'ContentApp', 'Freeform'];

  /* shapes: [{ id, name, type, ph, text, index, area }] in z-order (index 0 = bottom-most); selected: ids.
     -> { ok, id, count, message } */
  function pickContent(shapes, selected) {
    const sel = new Set(selected || []);
    const isTitle = s => TITLE_PH.includes(s.ph) || /^title\b/i.test(s.name || '');
    const text = (shapes || []).filter(s => !NO_TEXT.includes(s.type) && s.text != null).map(s => ({ ...s, n: points(s.text).length, soft: softBreaks(s.text) }));
    const fits = s => s.n >= MIN && s.n <= MAX;
    const one = (s, why) => fits(s) ? { ok: true, id: s.id, count: s.n, name: s.name, why } : { ok: false, id: s.id, count: s.n, message: outOfRange(s) };
    const chosen = text.filter(s => sel.has(s.id));
    if (chosen.length === 1) return one(chosen[0], 'selected');
    if (chosen.length > 1) {
      const ok = chosen.filter(fits);
      if (ok.length === 1) return one(ok[0], 'selected');
      return { ok: false, message: 'Several text boxes are selected. Select only the text box with the points, then click Alternative Design.' };
    }
    const body = text.filter(s => !isTitle(s));
    const named = body.filter(s => s.name === KEEP && fits(s));
    if (named.length === 1) return one(named[0], 'named');
    const ok = body.filter(fits);
    if (ok.length === 1) return one(ok[0], 'only');
    if (ok.length > 1) {
      const ph = ok.filter(s => s.ph && !isTitle(s));
      if (ph.length === 1) return one(ph[0], 'placeholder');
      return { ok: false, message: `This slide has ${ok.length} text boxes with points. Select the one to redesign, then click Alternative Design.` };
    }
    const big = body.filter(s => s.n > MAX).sort((a, b) => b.n - a.n);
    if (big.length) return { ok: false, id: big[0].id, count: big[0].n, message: outOfRange(big[0]) };
    const singles = body.filter(s => s.n === 1);
    const soft = singles.find(s => s.soft > 0);
    if (soft) return { ok: false, id: soft.id, count: 1, message: outOfRange(soft) };
    // points split over loose text boxes; a layout's own one-line placeholders (lead-in, heading) are not points
    // (real PowerPoint, 16 Nov: a 1-point slide was reported as "2 separate text boxes" because of its lead-in line)
    const loose = singles.filter(s => !s.ph);
    if (loose.length >= MIN) return { ok: false, message: `The points are in ${loose.length} separate text boxes. Alternative Design redesigns one text box with one point per line: put the points in one text box (press Enter after each), then click Alternative Design.` };
    if (singles.length) { const s = singles.slice().sort((a, b) => (b.area || 0) - (a.area || 0))[0]; return { ok: false, id: s.id, count: 1, message: outOfRange(s) }; }
    return { ok: false, message: 'No text was found on this slide. Type or paste 2 to 10 points in a text box, one per line, then click Alternative Design.' };
  }

  function outOfRange(s) {
    if (s.n > MAX) return `This text has ${s.n} points. The Alternative Design templates are made for 2 to 10 points: split it over two slides (or shorten it), then click Alternative Design.`;
    if (s.n === 1 && s.soft > 0) return 'The points are separated by line breaks (Shift+Enter), so they read as one point. Put each point on its own line with Enter, then click Alternative Design.';
    if (s.n === 1) return 'This text has only one point. The Alternative Design templates are made for 2 to 10 points, one per line.';
    return 'This text box is empty. Type or paste 2 to 10 points, one per line, then click Alternative Design.';
  }

  /* -------------------------------------------------------------- PowerPoint */
  const H = { 'X-AIVB-Client': '1' };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function readSlide(context) {
    const slides = context.presentation.getSelectedSlides(); slides.load('items');
    const selShapes = context.presentation.getSelectedShapes(); selShapes.load('items/id');
    await context.sync();
    if (!slides.items.length) return null;
    const slide = slides.items[0];
    slide.load('id');
    const shapes = slide.shapes; shapes.load('items/id,items/name,items/type,items/width,items/height');
    await context.sync();
    const texts = shapes.items.map(s => NO_TEXT.includes(s.type) ? null : s.textFrame.textRange);
    texts.forEach(t => t && t.load('text'));
    try { await context.sync(); } catch (e) {             // a shape without text: read them one by one
      for (let i = 0; i < texts.length; i++) if (texts[i]) { try { texts[i].load('text'); await context.sync(); } catch (e2) { texts[i] = null; } }
    }
    const phs = shapes.items.map(s => s.type === 'Placeholder' && s.placeholderFormat ? s.placeholderFormat : null);
    phs.forEach(p => p && p.load('type'));
    try { await context.sync(); } catch (e) { phs.fill(null); }   // placeholderFormat: PowerPointApi 1.8
    const list = shapes.items.map((s, i) => ({ id: s.id, name: s.name, type: s.type, ph: phs[i] ? phs[i].type : '', text: texts[i] ? texts[i].text : null,
      index: i, area: (s.width || 0) * (s.height || 0) }));
    return { slide, shapes, list, selected: selShapes.items.map(s => s.id) };
  }

  /* -> { ok, message } or { ok: true, slideId, id, index, name, renamed: [{ id }] } */
  async function prepareAlternative() {
    return PowerPoint.run(async context => {
      const r = await readSlide(context);
      if (!r) return { ok: false, message: 'Select a slide first (click it in the slide pane), then click Alternative Design.' };
      const pick = pickContent(r.list, r.selected);
      if (!pick.ok) return pick;
      const s = r.shapes.items.find(x => x.id === pick.id), at = r.list.find(x => x.id === pick.id);
      // other shapes already called Content_Text_Box (an earlier, cancelled run) would be deleted by the original
      // on insertion: renamed for the run, their name given back afterwards
      const renamed = r.list.filter(x => x.name === KEEP && x.id !== pick.id).map(x => ({ id: x.id }));
      renamed.forEach(x => { r.shapes.items.find(y => y.id === x.id).name = KEEP + ' (kept)'; });
      if (at.index > 0) s.setZOrder('SendToBack');
      await context.sync();
      return { ok: true, slideId: r.slide.id, id: pick.id, index: at.index, name: at.name, count: pick.count, renamed, lines: points(at.text) };
    });
  }

  /* After the Select Template window closed: when the content is still there (cancelled), its place and name back. */
  /* 29 of the 1,198 library templates (2.4 %, 13 Nov 2026) name their text boxes "Text 1" (often every box the same)
     instead of Text_1..Text_n, so the original insertion fills none of them: the points vanish and "Lorem ipsum" stays.
     After an insertion the points the template did not take are placed here: a box numbered for the point first, then
     the remaining placeholder boxes ("Text n"-like, still empty or "Lorem ipsum") in the template's own order.
     shapes: [{ id, name, text }] in z-order; lines: the points. -> { assign: [{ id, text, k }], unplaced: [k], guessed } */
  function placeMissing(shapes, lines) {
    const n = lines.length, have = new Set((shapes || []).map(s => s.name));
    let missing = []; for (let k = 1; k <= n; k++) if (!have.has('Text_' + k)) missing.push(k);
    if (!missing.length) return { assign: [], unplaced: [], guessed: false };
    const body = l => { const u = l.indexOf('_'); return u >= 0 ? l.slice(u + 1) : l; };
    const num = s => { const m = /^text[\s_-]*(\d+)$/i.exec(s.name || ''); return m ? +m[1] : 0; };
    let free = shapes.filter(s => num(s) && !/^Text_\d+$/.test(s.name) && (/lorem ipsum/i.test(s.text || '') || !String(s.text || '').trim()));
    const assign = [];
    missing = missing.filter(k => { const c = free.filter(s => num(s) === k); if (c.length !== 1) return true;
      assign.push({ id: c[0].id, k, text: body(lines[k - 1]) }); free = free.filter(s => s !== c[0]); return false; });
    let guessed = false;
    missing = missing.filter(k => { const s = free.shift(); if (!s) return true; guessed = true; assign.push({ id: s.id, k, text: body(lines[k - 1]) }); return false; });
    return { assign, unplaced: missing, guessed };
  }

  /* After the Select Template window closed: cancelled -> the content's place and name back; inserted -> the points
     the template did not take placed (placeMissing). -> { inserted, placed, unplaced, guessed } */
  async function restoreAlternative(p) {
    return PowerPoint.run(async context => {
      const shapes = context.presentation.slides.getItem(p.slideId).shapes; shapes.load('items/id,items/name');
      await context.sync();
      const s = shapes.items.find(x => x.id === p.id);
      const out = { inserted: !s, placed: 0, unplaced: [], guessed: false };
      if (s) {
        s.name = p.name;
        for (let i = 0; i < p.index; i++) s.setZOrder('BringForward');
      }
      p.renamed.forEach(x => { const o = shapes.items.find(y => y.id === x.id); if (o) o.name = KEEP; });
      await context.sync();
      if (!s && p.lines && p.lines.length) {
        const tf = shapes.items.map(x => /^text/i.test(x.name || '') ? x.textFrame.textRange : null);
        tf.forEach(t => t && t.load('text'));
        try { await context.sync(); } catch (e) { return out; }
        const list = shapes.items.map((x, i) => ({ id: x.id, name: x.name, text: tf[i] ? tf[i].text : '' }));
        const r = placeMissing(list, p.lines);
        r.assign.forEach(a => { shapes.items.find(x => x.id === a.id).textFrame.textRange.text = a.text; });
        await context.sync();
        Object.assign(out, { placed: r.assign.length, unplaced: r.unplaced, guessed: r.guessed });
      }
      return out;
    });
  }

  async function ask(cmd) {
    const r = await fetch('/api/slsd/run', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, H), body: JSON.stringify({ cmd }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'SL Smart Design is not available. Run "Restart AI Visual Builder", then try again.');
    return j.id;
  }
  async function finished(id) {      // a modal window may stay open a long time: checked calmly, no limit
    for (let wait = 300; ; wait = Math.min(wait * 1.5, 2000)) {
      await sleep(wait);
      try {
        const r = await fetch('/api/slsd/status?id=' + encodeURIComponent(id), { headers: H, cache: 'no-store' });
        const j = await r.json();
        if (!r.ok) return { state: 'error', message: j.error || '' };
        if (j.state !== 'running') return j;
      } catch (e) { /* the panel host restarting */ }
    }
  }

  /* A short message in a small Office dialog (a function command has no window of its own). The text is handed to the
     dialog with messageChild once it says "ready" - never in its URL, which PowerPoint shows in the dialog's title.
     Resolves when the user closes it (OK or the window's X), or after 4 minutes. Real PowerPoint, 16 Nov: a notice was
     closed by PowerPoint about 1.5 s after the ribbon command completed, so commands wait for it (see waitNotice). */
  function notice(title, message) {
    return new Promise(resolve => {
      let over = false; const end = () => { if (!over) { over = true; resolve(); } };
      try {
        Office.context.ui.displayDialogAsync(`${location.origin}/slsd-notice.html`, { height: 30, width: 34, displayInIframe: true }, res => {
          if (res.status !== Office.AsyncResultStatus.Succeeded) return end();
          const d = res.value;
          d.addEventHandler(Office.EventType.DialogMessageReceived, a => {
            const m = a && a.message;
            if (m === 'ready' && typeof d.messageChild === 'function') d.messageChild(JSON.stringify({ t: title, m: message }));
            else if (m === 'ok') { try { d.close(); } catch (e) { /* already closed */ } end(); }
          });
          if (Office.EventType.DialogEventReceived) d.addEventHandler(Office.EventType.DialogEventReceived, end);   // closed with its X
          setTimeout(end, 4 * 60 * 1000);
        });
      } catch (e) { console.warn('SL Smart Design:', title, message); end(); }
    });
  }

  /* 10.21: Office on a Mac. The original SL Smart Design commands are VBA macros run through Windows COM by the panel
     host; on a Mac they stay in the SL Smart Design add-in's own tab (its VBA works there). AI Visual Builder is the same. */
  const MAC_MSG = "On a Mac, use the SL Smart Design add-in's own tab for this command (its VBA works on Mac). AI Visual Builder works here as on Windows.";
  function onMac() {
    try {   // 'Mac' is the value of Office.PlatformType.Mac; compare to the string so a missing enum never reads as a Mac
      if (typeof Office === 'undefined' || !Office.context) return false;
      return Office.context.platform === 'Mac' || (Office.context.diagnostics || {}).platform === 'Mac';
    }
    catch (e) { return false; }
  }

  /* 10.21.1: on a Mac the panel host may run the commands through PowerPoint for Mac's AppleScript (opt-in, mac_vba_bridge) */
  async function macBridge() {
    try { const r = await fetch('/api/status', { headers: H, cache: 'no-store' }); const j = await r.json(); return !!(j && j.slsd && j.slsd.mac_bridge); }
    catch (e) { return false; }
  }

  function done(event) { if (event && !event.__done) { event.__done = true; try { event.completed(); } catch (e) { /* not a command event */ } } }

  async function alternativeDesign(event) {
    let prep = null;
    if (onMac() && !(await macBridge())) { await notice('Alternative Design', MAC_MSG); done(event); return; }
    try {
      prep = await prepareAlternative();
      if (!prep.ok) { await notice('Alternative Design', prep.message); return; }      // the command stays open while it is read
      const id = await ask('alternative');
      done(event);                                          // the ribbon is free while the Select Template window is open
      const j = await finished(id);
      if (j.state === 'error') await notice('Alternative Design', j.message);
    } catch (e) {
      await notice('Alternative Design', e && e.message ? e.message : 'Alternative Design could not start.');
    } finally {
      done(event);
      if (prep && prep.ok) {
        try {
          const r = await restoreAlternative(prep);
          if (r.unplaced.length) await notice('Alternative Design', `This template has no place for point${r.unplaced.length > 1 ? 's' : ''} ${r.unplaced.join(', ')} of your ${prep.lines.length}. Press Ctrl+Z to undo, then choose another template.`);
          else if (r.guessed) await notice('Alternative Design', `This template's text boxes are not numbered, so your ${prep.lines.length} points were placed in the template's own order. Check that the order reads right.`);
        } catch (e) { /* the slide changed meanwhile */ }
      }
    }
  }

  const COMMANDS = {
    slsdFooterNote: 'footer-note', slsdFooterInfo: 'footer-info', slsdBlueCodebox: 'blue-codebox', slsdBlackCodebox: 'black-codebox',
    slsdProblemSolution: 'problem-solution', slsdProblemSolutionImage: 'problem-solution-image',
    slsdRemoveAnimations: 'remove-animations', slsdDeleteEmptyBoxes: 'delete-empty', slsdRenameText: 'rename-text', slsdRenameHeading: 'rename-heading' };
  const LABELS = { 'footer-note': 'Add Footer Note', 'footer-info': 'Add Footer Info', 'blue-codebox': 'Add Blue Codebox', 'black-codebox': 'Add Black Codebox',
    'problem-solution': 'Add Problem Solution', 'problem-solution-image': 'Add Problem Solution Image', 'remove-animations': 'Remove Animations',
    'delete-empty': 'Delete Empty Boxes', 'rename-text': 'Shape Rename: Text', 'rename-heading': 'Shape Rename: Heading' };

  function command(cmd) {
    return async event => {
      if (onMac() && !(await macBridge())) { await notice(LABELS[cmd], MAC_MSG); done(event); return; }
      try {
        const id = await ask(cmd);
        done(event);
        const j = await finished(id);
        if (j.state === 'error') await notice(LABELS[cmd], j.message);
      } catch (e) { await notice(LABELS[cmd], e && e.message ? e.message : 'The command could not start.'); }
      finally { done(event); }
    };
  }

  root.SLSD = { onMac, macBridge, MAC_MSG, points, pickContent, placeMissing, outOfRange, COMMANDS, LABELS, MIN, MAX, prepareAlternative, restoreAlternative, alternativeDesign, command };

  if (typeof Office === 'undefined') return;
  Office.onReady(info => {
    if (info.host !== Office.HostType.PowerPoint || !(Office.actions && typeof Office.actions.associate === 'function')) return;
    Office.actions.associate('slsdAlternativeDesign', alternativeDesign);
    Object.entries(COMMANDS).forEach(([fn, cmd]) => Office.actions.associate(fn, command(cmd)));
  });
})(typeof window !== 'undefined' ? window : this);
