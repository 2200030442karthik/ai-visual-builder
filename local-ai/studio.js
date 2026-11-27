/* AI Visual Builder 10.12 - designs, several slides and edits from a content plan, all without an AI request (free).
   A content plan (plan.js: the points, their roles, groups and flow) comes from Claude's design, from Napkin's items,
   from the panel's own analysis of step 1, from the plans saved on this PC, or from a visual already on a slide.
   - More designs: other professional layouts of the same plan (design packs, measured at 22 pt, checked), then colour
     and spacing variants; density automatic (every description when it fits, else the point names, said).
   - Several slides: long content split where it divides logically, an overview first, each slide previewed with its
     own layout; inserted on new slides after the selected one, all or nothing, and recoverable after an interruption.
   - Edit a visual: every visual inserted from 10.12 on carries PowerPoint tags (AIVB_V = its id on each of its shapes,
     AIVB_F = which point a text shows) and a record on its slide (AIVB_R_<id>: plan, layout, colours, spacing, area).
     Text, icons, colours, spacing, density and layout are changed by drawing the visual again in its own area and
     removing exactly its old shapes; nothing else on the slide is touched, and the edit is refused when another object
     now overlaps that area. Texts changed by hand in PowerPoint are read back first. One step of undo.
   Loaded after napkin.js. */
const STUDIO_VERSION = '10.12.0';
const ST = { src: [], seen: new Set(), seenKey: '', designs: [], sel: -1, slides: null, edit: null, busy: false };
const stEl = id => document.getElementById('st' + id);
const PLAN_STORE = 'aivb.plans.v1';
// browser storage may be unavailable (private window, cleared data): the panel works without it
const lsGet = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
const planPlain = P => JSON.parse(JSON.stringify(P));
const hashText = s => { let h = 2166136261; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36).toUpperCase(); };
const newId = p => p + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1679616).toString(36).toUpperCase().padStart(4, '0');
const normText = t => String(t == null ? '' : t).replace(/\s+/g, ' ').trim();

/* ---------- saved plans (this PC): every plan a provider returned or a visual was drawn from ---------- */
function savePlan(plan, from) {
  if (!plan || !plan.items || plan.items.length < 2) return '';
  const p = planPlain(plan);
  delete p.style; delete p.start; delete p.part; delete p.overview;
  const id = 'P' + hashText(JSON.stringify([p.title, p.items.map(i => [i.label, i.detail])]));
  const list = (lsGet(PLAN_STORE) || []).filter(x => x.id !== id);
  list.unshift({ id, title: p.title || p.items.slice(0, 3).map(i => i.label).join(', '), from, at: new Date().toISOString(), plan: p });
  lsSet(PLAN_STORE, list.slice(0, 12));
  return id;
}
function studioSources() {
  const out = [{ id: 'text', name: "Your text in step 1 (the panel's own analysis)" }];
  for (const k of ['claude', 'napkin']) {
    const x = PANELS[k] && PANELS[k].plan && PANELS[k].plan();
    if (x) out.push({ id: 'res:' + k, name: x.name, plan: x.plan });
  }
  (lsGet(PLAN_STORE) || []).forEach(x => out.push({ id: 'saved:' + x.id, name: `Saved: ${x.title} (${x.from}, ${String(x.at).slice(0, 16).replace('T', ' ')})`, plan: x.plan }));
  return out;
}
function studioFillSources(want) {
  const sel = stEl('Plan'), keep = want || sel.value;
  ST.src = studioSources();
  sel.innerHTML = ST.src.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
  if (ST.src.some(s => s.id === keep)) sel.value = keep;
}
/* The selected plan: { plan, from } (a copy: what is drawn never changes the saved plan). */
async function studioPlan() {
  const id = stEl('Plan').value, src = ST.src.find(s => s.id === id) || ST.src[0];
  if (src.id === 'text') {
    const text = $('content').value.trim();
    if (!text) throw new Error('Paste content in step 1 first (or choose a saved plan).');
    const prep = await PANELS.napkin.prepared(text);
    if (prep.error) throw new Error(prep.error);
    if (prep.record) throw new Error('This content is a record of labelled values: the built-in suggestions in step 3 draw it with its exact values.');
    if ((prep.points || []).length < 2) throw new Error('The analysis found fewer than 2 points in step 1, so there is no plan to draw.');
    return { plan: planFromPrep(prep), from: 'your text' };
  }
  return { plan: planPlain(src.plan), from: src.name.replace(/^Saved: /, '') };
}

/* ---------- PowerPoint tags and records ---------- */
const REC_CHUNK = 900;
async function readBlob(context, slide, key, slideOnly) {
  try {
    const n = slide.tags.getItemOrNullObject(key + '_N');
    n.load('value');
    await context.sync();
    if (!n.isNullObject) {
      const parts = Array.from({ length: +n.value || 0 }, (_, i) => { const t = slide.tags.getItemOrNullObject(`${key}_${i}`); t.load('value'); return t; });
      await context.sync();
      if (parts.length && parts.every(t => !t.isNullObject)) return JSON.parse(parts.map(t => t.value).join(''));
    }
  } catch (e) { /* not readable on the slide: the copy on this PC */ }
  return slideOnly ? null : lsGet('aivb.rec.' + key);
}
/* Writes an object into the slide's tags (in pieces) and a copy on this PC; 'slide' when it reads back intact. */
async function writeBlob(context, slide, key, obj) {
  const s = JSON.stringify(obj), n = Math.max(1, Math.ceil(s.length / REC_CHUNK));
  lsSet('aivb.rec.' + key, obj);
  try {
    const old = slide.tags.getItemOrNullObject(key + '_N');
    old.load('value');
    await context.sync();
    const oldN = old.isNullObject ? 0 : +old.value || 0;
    for (let i = 0; i < n; i++) slide.tags.add(`${key}_${i}`, s.slice(i * REC_CHUNK, (i + 1) * REC_CHUNK));
    for (let i = n; i < oldN; i++) slide.tags.delete(`${key}_${i}`);
    slide.tags.add(key + '_N', String(n));
    await context.sync();
    const back = await readBlob(context, slide, key, true);
    return back && JSON.stringify(back) === s ? 'slide' : 'pc';
  } catch (e) { console.warn('The record could not be stored on the slide', e); return 'pc'; }
}
/* Tags for drawOnSlide: the visual's id on every shape, and which point (label | description | title) a text shows. */
function studioMeta(plan) {
  const m = new Map();
  if (plan) {
    plan.items.forEach(i => { m.set(i.label, i.id + '|L'); if (i.detail && !m.has(i.detail)) m.set(i.detail, i.id + '|D'); });
    if (plan.title && !m.has(plan.title)) m.set(plan.title, '|T');
  }
  return { id: newId('V'), field: p => (p && p.text ? m.get(String(p.text)) || '' : '') };
}
const stBBox = rs => { if (!rs.length) return null; const x = Math.min(...rs.map(r => r.x)), y = Math.min(...rs.map(r => r.y)); return { x, y, w: Math.max(...rs.map(r => r.x + r.w)) - x, h: Math.max(...rs.map(r => r.y + r.h)) - y }; };
const shapeBox = s => ({ x: s.left, y: s.top, w: s.width, h: s.height });
/* After an insertion: the new top-level shapes (groups, pictures) carry the id, and the record goes on the slide.
   Never fails the insertion: a visual that cannot be recorded is only not editable here (said in the status). */
async function studioAfterInsert(context, slide, ids, meta, o) {
  try {
    ids.forEach(x => slide.shapes.getItem(x).tags.add('AIVB_V', meta.id));
    await context.sync();
    slide.load('id');
    const shapes = slide.shapes;
    shapes.load('items/id,items/left,items/top,items/width,items/height');
    await context.sync();
    const mine = shapes.items.filter(s => ids.includes(s.id));
    const rec = { v: 1, id: meta.id, kind: o.plan && o.layout ? 'plan' : 'fixed', plan: o.plan ? planPlain(o.plan) : null, layout: o.layout || '', name: o.name || '',
      style: o.style || { accent: 0, spacing: 'fill' }, density: o.density || 'full', rect: o.rect, bbox: stBBox(mine.map(shapeBox)) || o.rect, from: o.from || '', at: new Date().toISOString(), ver: o.ver || 1 };
    rec.store = await writeBlob(context, slide, 'AIVB_R_' + meta.id, rec);
    return rec;
  } catch (e) { console.warn('The visual could not be recorded for editing', e); return null; }
}
/* A built-in suggestion's points as a plan (so its inserted visual can be redesigned later); null when it has none. */
function studioPlanOfSection(s) {
  try {
    const sc = s.scene || (typeof sceneOf === 'function' ? sceneOf(s) : null);
    if (!sc || sc.record || !Array.isArray(sc.items) || sc.items.length < 2) return null;
    return planFromItems(s.heading || sc.topic || '', sc.items.map(it => ({ label: it.label, detail: it.detail || '' })), !!sc.ordered);
  } catch (e) { return null; }
}
const editNote = rec => !rec ? ' (It could not be recorded for later editing.)' : rec.store === 'pc' ? ' (Its edit record is kept on this PC only: PowerPoint did not keep it on the slide.)' : '';

/* Draws a plan layout on a slide in R (or the slide's free area) with tags and record; { ids, rec, r }. */
async function drawPlanVisual(context, slide, plan, key, o) {
  o = o || {};
  let rect = o.rect, prims = null, k = 1;
  const draw = o.density === 'names' ? planNames(plan) : plan;
  let r;
  if (rect) {
    r = planRender(draw, key, rect);
    if (!r.ok) throw new Error(`the ${r.name || key} layout does not fit the visual's area (${r.why})`);
    prims = r.prims;
  } else {
    // 10.19: the slide's free part (below the slide's own text), laid out there or scaled into it; else a new slide
    const fit = await fitArea(context, slide);
    let last = null;
    const d = fitBuild(fit, R => { const x = planRender(draw, key, R); last = x; return x.ok ? x : null; });
    r = d; prims = d.prims; rect = d.rect; k = d.k;
    if (!r.name && last) r.name = last.name;
  }
  const meta = o.meta || studioMeta(draw), before = new Set(await shapeIds(context, slide));
  await drawOnSlide(context, slide, prims, r.name, meta);
  const ids = (await shapeIds(context, slide)).filter(x => !before.has(x));
  const rec = o.noRecord ? null : await studioAfterInsert(context, slide, ids, meta, { plan, layout: key, name: r.name, style: r.style, density: o.density || 'full', rect, from: o.from, ver: o.ver });
  return { ids, rec, r, meta, rect, k };
}
/* A rollback for a failed insertion: the shapes added to `slide` and the slides added to the presentation. */
async function rollback(context, slide, before, slidesBefore) {
  try {
    if (slide && before) (await shapeIds(context, slide)).filter(id => !before.has(id)).forEach(id => slide.shapes.getItem(id).delete());
    const all = context.presentation.slides;
    all.load('items/id');
    await context.sync();
    all.items.filter(x => !slidesBefore.has(x.id)).forEach(x => x.delete());
    await context.sync();
  } catch (e) { console.warn('Clean-up after a failed insertion was incomplete', e); }
}

/* ---------- 1. More designs (free) ---------- */
const stArea = () => Object.assign({}, TEMPLATE.contentArea);
async function showDesigns(more) {
  if (ST.busy) return;
  ST.busy = true; studioButtons();
  try {
    const { plan, from } = await studioPlan(), d = planAtDensity(plan, stArea(), stEl('Density').value);
    const key = stEl('Plan').value + '|' + hashText(JSON.stringify(plan.items)) + '|' + d.density;
    if (!more || key !== ST.seenKey) { ST.seen = new Set(); ST.seenKey = key; }
    let list = planMoreDesigns(d.plan, stArea(), ST.seen, 4), again = false;
    if (!list.length && ST.seen.size) { ST.seen = new Set(); list = planMoreDesigns(d.plan, stArea(), ST.seen, 4); again = true; }
    ST.designs = list.map(r => ({ r, plan: d.plan, full: plan, density: d.density, from }));
    ST.sel = list.length ? 0 : -1;
    if (from !== 'your text') savePlan(plan, from);
    renderDesigns();
    stEl('DesignNote').textContent = !list.length ? `No layout fits this content at 22 pt${d.density === 'full' ? ' with every description' : ''}. Use “Several slides” to split it.`
      : `${list.length} design${list.length > 1 ? 's' : ''} of ${plan.items.length} points from ${from}, no AI request.` + (again ? ' Every design of this plan was shown; starting again from the first.' : '') +
        (d.why ? ` Point names only: ${d.why}.` : d.density === 'names' ? ' Point names only, as chosen (the descriptions stay in the saved plan).' : '');
    setStatus(list.length ? `Designs ready (free). Pick one, click a Content_Slide, then press “Insert selected design”.` : 'No design fits on one slide; see the note in step 5.', !list.length);
  } catch (e) { setStatus('Designs: ' + errText(e), true); }
  finally { ST.busy = false; studioButtons(); }
}
function renderDesigns() {
  const g = stEl('Grid');
  g.innerHTML = ST.designs.map((d, i) => `<button type="button" class="gcard${i === ST.sel ? ' sel' : ''}" data-i="${i}" aria-pressed="${i === ST.sel}">` +
    `<div class="gthumb">${thumb(d.r.prims)}</div><div class="gname">${esc(d.r.name)}${i === ST.sel ? ' · selected' : ''}</div>` +
    `<span class="badge ${d.density === 'names' ? 'partial' : 'full'}">${d.density === 'names' ? 'Point names only' : 'Complete'} · Fully editable</span>` +
    `<div class="gwhy">${esc([d.r.kind, planStyleName(d.r.style)].filter(Boolean).join(' · '))}</div></button>`).join('');
  g.hidden = !ST.designs.length;
  g.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { ST.sel = +b.dataset.i; renderDesigns(); studioButtons(); }));
}
async function insertDesign() {
  const D = ST.designs[ST.sel];
  if (!D || !state.inOffice || ST.busy) return;
  if (!(await ensureGate())) return;
  ST.busy = true; studioButtons();
  const onNew = $('newSlide').checked || !!state.forceNew;
  state.lastFull = false;
  try {
    let got = null;
    await PowerPoint.run(async context => {
      const sel = context.presentation.getSelectedSlides(), cnt = sel.getCount(), all = context.presentation.slides;
      all.load('items/id');
      await context.sync();
      if (!cnt.value) throw new Error('Click a slide in the slide list on the left first.');
      const slidesBefore = new Set(all.items.map(x => x.id));
      let slide = sel.getItemAt(0), before = null;
      try {
        if (onNew) slide = await newSlideAfter(context, slide, (D.parts ? D.parts[0].plan.title : D.full.title) || '');
        slide.load('id');
        before = new Set(await shapeIds(context, slide));
        if (D.parts) {
          // 10.19: a design in two parts - the first here (the slide's free part), the second on a new slide after it
          got = await drawPlanVisual(context, slide, Object.assign({}, D.parts[0].plan, { style: D.parts[0].r.style }), D.parts[0].r.key, { density: 'full', from: D.from });
          const extra = [];
          for (const q of D.parts.slice(1)) {
            const s2 = await newSlideAfter(context, extra.length ? context.presentation.slides.getItem(extra[extra.length - 1]) : slide, q.plan.title || '');
            s2.load('id'); await context.sync();
            await drawPlanVisual(context, s2, Object.assign({}, q.plan, { style: q.r.style }), q.r.key, { density: 'full', from: D.from, rect: Object.assign({}, TEMPLATE.contentArea) });
            extra.push(s2.id);
          }
          context.presentation.setSelectedSlides([slide.id]); await context.sync();
          state.lastInsert = { slideId: slide.id, ids: got.ids, newSlide: onNew, extraSlides: extra, extraWhat: `its continuation slide${extra.length > 1 ? 's' : ''}` };
        } else {
          const plan = Object.assign({}, D.full, { style: D.r.style });
          got = await drawPlanVisual(context, slide, plan, D.r.key, { density: D.density, from: D.from });
          state.lastInsert = { slideId: slide.id, ids: got.ids, newSlide: onNew, extraSlides: [] };
        }
      } catch (e) { await rollback(context, slide, onNew ? null : before, slidesBefore); state.lastInsert = null; throw e; }
    });
    state.lastFit = got.k || 1;
    setStatus(`Inserted: ${D.r.name} (${D.parts ? `on ${D.parts.length} slides, every point and description` : D.density === 'names' ? 'point names only' : 'every point and description'}), editable native shapes.${fitNote(got.k || 1)}${editNote(got.rec)} “Remove last inserted visual” takes it out again.`);
  } catch (e) { state.lastFull = !!e.full; setStatus('Could not insert the design, so nothing was added: ' + (e.full ? 'this slide has no free space for it.' : errText(e)), true); }
  finally { ST.busy = false; studioButtons(); updateButtons(); }
}

/* ---------- 3. Several slides ---------- */
async function planTheSlides() {
  if (ST.busy) return;
  ST.busy = true; studioButtons();
  try {
    const { plan, from } = await studioPlan(), R = stArea();
    const S = planSlides(plan, R, { slides: stEl('Split').value, density: stEl('Density').value, overview: stEl('Overview').checked });
    if (!S.parts.length) { ST.slides = null; renderSlides(); setStatus('Several slides: ' + S.why, true); return; }
    // the same family on every slide where it fits (a consistent deck), each slide can be changed
    const V = S.parts.map(q => planVariations(q, R, 6).list), body = V.filter((_, k) => !S.parts[k].overview);
    const common = (body[0] || []).map(r => r.family).find(f => body.every(l => l.some(r => r.family === f)));
    ST.slides = { from, plan, density: S.density, how: S.how, why: S.why || '', parts: S.parts.map((q, k) => ({ plan: q, list: V[k], i: Math.max(0, V[k].findIndex(r => r.family === common)) })) };
    if (from !== 'your text') savePlan(plan, from);
    renderSlides();
    setStatus(`${ST.slides.parts.length} slide${ST.slides.parts.length > 1 ? 's' : ''} planned (free). Check each preview, click the slide after which they should go, then press “Insert the slides”.`);
  } catch (e) { setStatus('Several slides: ' + errText(e), true); }
  finally { ST.busy = false; studioButtons(); }
}
function renderSlides() {
  const S = ST.slides, box = stEl('Slides');
  if (!S) { box.innerHTML = ''; box.hidden = true; stEl('SlideNote').textContent = ''; return; }
  const shown = S.parts.map(p => Object.assign({ overview: !!p.plan.overview }, p.list[p.i]));
  const base = S.density === 'names' ? planNames(S.plan) : S.plan, miss = planCoverage(base, shown);
  S.missing = miss;
  stEl('SlideNote').textContent = (S.parts.length === 1 ? 'One slide' : `${S.parts.length} slides, split ${S.how}`) +
    (S.parts.some(p => p.plan.overview) ? ' (an overview with every point name first)' : '') + '. ' +
    (miss.length ? `Not on the slides: ${miss.join('; ')}.` : S.density === 'names' ? `All ${S.plan.items.length} point names are on the slides (descriptions left out, as chosen${S.why ? ': ' + S.why : ''}).`
      : `All ${S.plan.items.length} points and every description are on the slides, at 22 pt and up.`);
  box.innerHTML = S.parts.map((p, k) => { const r = p.list[p.i];
    return `<div class="gcard" style="cursor:default"><div class="gname">Slide ${k + 1}: ${esc(p.plan.title || '')}</div><div class="gthumb">${thumb(r.prims)}</div>` +
      `<div class="gwhy">${esc(r.name)} · ${p.plan.items.length} point${p.plan.items.length > 1 ? 's' : ''}${p.plan.start ? `, numbered from ${p.plan.start + 1}` : ''}</div>` +
      (p.list.length > 1 ? `<button type="button" class="secondary" data-k="${k}" style="margin-top:4px;padding:3px">Other layout (${p.i + 1} of ${p.list.length})</button>` : '') + '</div>'; }).join('');
  box.hidden = false;
  box.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { const p = S.parts[+b.dataset.k]; p.i = (p.i + 1) % p.list.length; renderSlides(); }));
  studioButtons();
}
/* All the planned slides after the selected one, in order, all or nothing. A batch record in the presentation's tags
   (running -> done) lets an interrupted insertion be found and removed after a reload. */
async function insertSlides() {
  const S = ST.slides;
  if (!S || !state.inOffice || ST.busy || (S.missing || []).length) return;
  if (!(await ensureGate())) return;
  ST.busy = true; studioButtons();
  const id = newId('B'), n = S.parts.length;
  let done = 0, notes = 0;
  try {
    await PowerPoint.run(async context => {
      const pres = context.presentation, sel = pres.getSelectedSlides(), cnt = sel.getCount(), all = pres.slides;
      all.load('items/id');
      await context.sync();
      if (!cnt.value) throw new Error('Click the slide after which the new slides should go.');
      const slidesBefore = new Set(all.items.map(x => x.id)), made = [];
      pres.tags.add('AIVB_BATCH', JSON.stringify({ id, state: 'running', n, at: new Date().toISOString() }));
      await context.sync();
      try {
        let prev = sel.getItemAt(0);
        for (const p of S.parts) {
          setStatus(`Inserting slide ${done + 1} of ${n}…`);
          const slide = await newSlideAfter(context, prev, p.plan.title || '');
          slide.load('id');
          await context.sync();
          made.push(slide.id);
          slide.tags.add('AIVB_BATCH', id);
          const r = p.list[p.i], got = await drawPlanVisual(context, slide, Object.assign({}, p.plan, { style: r.style }), r.key, { from: S.from });
          if (!got.rec || got.rec.store !== 'slide') notes++;
          prev = slide; done++;
        }
        pres.tags.add('AIVB_BATCH', JSON.stringify({ id, state: 'done', n, slides: made }));
        await context.sync();
        state.lastInsert = { slideId: made[0], ids: [], newSlide: true, extraSlides: made.slice(1) };
      } catch (e) {
        await rollback(context, null, null, slidesBefore);
        try { pres.tags.delete('AIVB_BATCH'); await context.sync(); } catch (e2) { /* nothing recorded */ }
        state.lastInsert = null; done = 0;
        throw e;
      }
    });
    setStatus(`Done: ${n} new slide${n > 1 ? 's' : ''} after the selected one, every point${S.density === 'names' ? ' name' : ' and description'} on them, editable native shapes, no AI request.` +
      (notes ? ` ${notes} visual${notes > 1 ? 's have their' : ' has its'} edit record on this PC only.` : '') + ' “Remove last inserted visual” removes all of them.');
  } catch (e) { setStatus(`Could not insert the slides, so none were added (the presentation is as it was): ` + errText(e), true); }
  finally { ST.busy = false; studioButtons(); updateButtons(); checkBatch(); }
}
/* An insertion of several slides that did not finish (PowerPoint or the panel closed during it): offered for removal. */
async function checkBatch() {
  const btn = stEl('Recover');
  if (!state.inOffice) { btn.hidden = true; return; }
  try {
    await PowerPoint.run(async context => {
      const t = context.presentation.tags.getItemOrNullObject('AIVB_BATCH');
      t.load('value');
      await context.sync();
      const b = t.isNullObject ? null : JSON.parse(t.value);
      ST.broken = b && b.state === 'running' ? b : null;
    });
  } catch (e) { ST.broken = null; }
  btn.hidden = !ST.broken;
  if (ST.broken) btn.textContent = `Remove the slides of an unfinished insertion (${String(ST.broken.at || '').slice(0, 16).replace('T', ' ')})`;
}
async function recoverBatch() {
  const b = ST.broken;
  if (!b || ST.busy) return;
  ST.busy = true; studioButtons();
  try {
    let k = 0;
    await PowerPoint.run(async context => {
      const slides = context.presentation.slides;
      slides.load('items/id');
      await context.sync();
      const tags = slides.items.map(s => { const t = s.tags.getItemOrNullObject('AIVB_BATCH'); t.load('value'); return t; });
      await context.sync();
      const mine = slides.items.filter((s, i) => !tags[i].isNullObject && tags[i].value === b.id);
      mine.forEach(s => s.delete());
      k = mine.length;
      context.presentation.tags.delete('AIVB_BATCH');
      await context.sync();
    });
    setStatus(`Removed ${k} slide${k === 1 ? '' : 's'} of the unfinished insertion; nothing else was changed.`);
  } catch (e) { setStatus('Could not remove the unfinished slides: ' + errText(e), true); }
  finally { ST.busy = false; studioButtons(); checkBatch(); }
}

/* ---------- 2. Edit a visual on the slide ---------- */
/* The add-in's visual the user selected: { slide, id } (a shape of it, or the group it is in). */
async function selectedVisual(context) {
  const pres = context.presentation, slides = pres.getSelectedSlides(), sc = slides.getCount(), sel = pres.getSelectedShapes(), cnt = sel.getCount();
  await context.sync();
  if (!sc.value) throw new Error('Click the slide with the visual first.');
  if (!cnt.value) throw new Error('Select the visual on the slide (click one of its shapes), then press “Edit the selected visual” again.');
  const slide = slides.getItemAt(0);
  slide.load('id');
  sel.load('items/id');
  await context.sync();
  const tags = sel.items.map(s => { const t = s.tags.getItemOrNullObject('AIVB_V'); t.load('value'); return t; });
  await context.sync();
  let id = (tags.find(t => !t.isNullObject) || {}).value || '';
  if (!id && state.canGroup) for (const s of sel.items) {
    try { const t = s.parentGroup.tags.getItemOrNullObject('AIVB_V'); t.load('value'); await context.sync(); if (!t.isNullObject) { id = t.value; break; } } catch (e) { /* not in a group */ }
  }
  if (!id) {   // 10.12.1: the original design of a Napkin result, inserted as one picture
    const o = sel.items.map(s => { const t = s.tags.getItemOrNullObject('AIVB_O'); t.load('value'); return t; });
    await context.sync();
    if (o.some(t => !t.isNullObject)) throw Object.assign(new Error('original'), { original: true });
    throw Object.assign(new Error('notours'), { notours: true });
  }
  // 10.25: one point's shapes selected (its texts carry AIVB_F "<point id>|L/D"): that point is edited on its own
  let focus = '';
  try {
    const ft = sel.items.map(s => { const t = s.tags.getItemOrNullObject('AIVB_F'); t.load('value'); return t; });
    await context.sync();
    const ids = [...new Set(ft.filter(t => !t.isNullObject).map(t => String(t.value || '').split('|')[0]).filter(Boolean))];
    if (ids.length === 1 && cnt.value <= 4) focus = ids[0];
  } catch (e) { /* the whole visual */ }
  return { slide, id, focus };
}
/* The visual's shapes on the slide (top level) and its texts (inside groups too), as PowerPoint has them now. */
async function visualParts(context, slide, id) {
  const shapes = slide.shapes;
  shapes.load('items/id,items/type,items/name,items/left,items/top,items/width,items/height');
  await context.sync();
  const tv = shapes.items.map(s => { const t = s.tags.getItemOrNullObject('AIVB_V'); t.load('value'); return t; });
  await context.sync();
  const tops = shapes.items.filter((s, i) => !tv[i].isNullObject && tv[i].value === id), leaves = [];
  // 10.26: a group without the tag whose shapes carry it (an object group of the visual, "Definition (AI Visual)", or a
  // group made in PowerPoint around its shapes, "Group 145") is part of the visual, not an object in its way
  if (state.canGroup) {
    for (const [i, s] of shapes.items.entries()) {
      if (s.type !== 'Group' || (!tv[i].isNullObject && tv[i].value === id)) continue;
      try {
        const cs = s.group.shapes; cs.load('items/id'); await context.sync();
        const ct = cs.items.map(c => { const t = c.tags.getItemOrNullObject('AIVB_V'); t.load('value'); return t; });
        await context.sync();
        if (ct.some(t => !t.isNullObject && t.value === id) && ct.every(t => t.isNullObject || t.value === id)) tops.push(s);
      } catch (e) { /* not readable as a group: left as it is */ }
    }
    // an icon the add-in drew into the visual before 10.26 without its tag (Replace icon): named "... (AI Visual)" and
    // lying inside the visual's own area
    const T = tops.map(s => ({ x: s.left, y: s.top, w: s.width, h: s.height }));
    if (T.length) {
      const x0 = Math.min(...T.map(r => r.x)) - 4, y0 = Math.min(...T.map(r => r.y)) - 4, x1 = Math.max(...T.map(r => r.x + r.w)) + 4, y1 = Math.max(...T.map(r => r.y + r.h)) + 4;
      shapes.items.forEach((s, i) => {
        if (!tv[i].isNullObject || tops.includes(s) || !/\(AI Visual\)$/.test(String(s.name || ''))) return;
        if (s.left >= x0 && s.top >= y0 && s.left + s.width <= x1 && s.top + s.height <= y1) tops.push(s);
      });
    }
  }
  for (const s of tops) {
    if (s.type === 'Group' && state.canGroup) {
      try { const cs = s.group.shapes; cs.load('items/id,items/type,items/left,items/top,items/width,items/height'); await context.sync(); cs.items.forEach(c => leaves.push({ s: c, parent: s.id })); continue; }
      catch (e) { /* read as one shape */ }
    }
    leaves.push({ s, parent: '' });
  }
  const read = async x => {
    const f = x.s.tags.getItemOrNullObject('AIVB_F');
    f.load('value');
    let tr = null;
    if (/GeometricShape|TextBox|Placeholder/.test(x.s.type)) { tr = x.s.textFrame.textRange; tr.load('text'); tr.font.load('size'); }
    try { await context.sync(); } catch (e) { tr = null; }
    return { id: x.s.id, parent: x.parent, field: f.isNullObject ? '' : f.value, text: tr ? String(tr.text || '') : '', size: tr ? tr.font.size : 0, w: x.s.width, h: x.s.height };
  };
  const texts = [];
  for (const x of leaves) { const t = await read(x); if (normText(t.text)) texts.push(t); }
  return { tops, texts, bbox: stBBox(tops.map(shapeBox)) };
}
async function editLoad() {
  if (ST.busy || !state.inOffice) return;
  ST.busy = true; studioButtons();
  try {
    let E = null;
    await PowerPoint.run(async context => {
      const { slide, id, focus } = await selectedVisual(context), rec = await readBlob(context, slide, 'AIVB_R_' + id);
      if (!rec) throw new Error('this visual has no edit record (it was inserted on another PC whose record PowerPoint did not keep on the slide), so it cannot be changed here safely');
      const parts = await visualParts(context, slide, id);
      if (!parts.tops.length) throw new Error("the visual's shapes are no longer on this slide");
      // texts changed by hand in PowerPoint since the visual was drawn: taken into the form, never lost
      const hand = [];
      if (rec.kind === 'plan') parts.texts.forEach(t => {
        if (!t.field) return;
        const [iid, f] = t.field.split('|'), it = rec.plan.items.find(i => i.id === iid), want = f === 'T' ? rec.plan.title : it ? (f === 'L' ? it.label : it.detail) : null;
        if (want != null && normText(t.text) !== normText(want)) hand.push({ iid, f, from: want, to: normText(t.text) });
      });
      E = { focus: rec.kind === 'plan' && rec.plan.items.some(i => i.id === focus) ? focus : '', slideId: slide.id, id, rec, hand, texts: parts.texts, prev: await readBlob(context, slide, 'AIVB_P_' + id), moved: parts.bbox && rec.bbox ? Math.hypot(parts.bbox.x - rec.bbox.x, parts.bbox.y - rec.bbox.y) > 2 : false };
    });
    ST.edit = E;
    renderEdit();
    setStatus(`Editing ${E.rec.kind === 'plan' ? `“${E.rec.name}”` : 'the selected visual'} (${E.rec.kind === 'plan' ? `${E.rec.plan.items.length} points` : `${E.texts.length} texts`}). Change it below, press “Preview change”, then “Apply to the slide”. Only this visual's own shapes are replaced.` +
      (E.hand.length ? ` ${E.hand.length} text${E.hand.length > 1 ? 's were' : ' was'} changed by hand in PowerPoint and ${E.hand.length > 1 ? 'are' : 'is'} kept in the form.` : ''));
  } catch (e) {
    ST.edit = null; renderEdit();
    setStatus(e.original ? 'This is the provider’s original design, one picture. In PowerPoint, right-click › Convert to Shape makes it shapes; then “Style the selection” above recolours them and replaces their icons.'
      : e.notours ? 'This visual has no redesign record (inserted before 10.12, or not by this panel). Use “Style the selection” above: it changes the colours, text and icons of any visual.'
      : 'Edit: ' + errText(e), true);
  }
  finally { ST.busy = false; studioButtons(); }
}
// Storage and registration for custom icons generated by Claude AI
const CUSTOM_ICONS_KEY = 'aivb.custom_icons.v1';

function getStoredCustomIcons() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_ICONS_KEY) || '{}'); }
  catch (e) { return {}; }
}

function saveCustomIcon(key, iconData) {
  try {
    const all = getStoredCustomIcons();
    all[key] = iconData;
    localStorage.setItem(CUSTOM_ICONS_KEY, JSON.stringify(all));
  } catch (e) { console.warn('Could not save custom icon', e); }
}

/* 10.24: an AI icon fills its box: Claude may draw in a small part of its 100 x 100 grid, so the parts are scaled
   together (proportions kept) to fill 6..94 and centred - the icon then grows with the design it is placed in. */
function fitAIIcon(elements) {
  const els = (elements || []).filter(e => e && typeof e === 'object');
  const pts = [];
  els.forEach(e => { if (e.shape === 'line' || e.x1 !== undefined) pts.push([+e.x1, +e.y1], [+e.x2, +e.y2]); else pts.push([+e.x, +e.y], [+e.x + +e.w, +e.y + +e.h]); });
  const ok = pts.filter(p => isFinite(p[0]) && isFinite(p[1]));
  if (!ok.length) return els;
  const x0 = Math.min(...ok.map(p => p[0])), y0 = Math.min(...ok.map(p => p[1])), x1 = Math.max(...ok.map(p => p[0])), y1 = Math.max(...ok.map(p => p[1]));
  const k = 88 / Math.max(x1 - x0, y1 - y0, 1), ox = 50 - (x0 + x1) / 2 * k, oy = 50 - (y0 + y1) / 2 * k;
  if (k < 1.04 && k > 0.96) return els;
  return els.map(e => e.shape === 'line' || e.x1 !== undefined
    ? Object.assign({}, e, { x1: ox + e.x1 * k, y1: oy + e.y1 * k, x2: ox + e.x2 * k, y2: oy + e.y2 * k, lineW: (e.lineW || 2) * k })
    : Object.assign({}, e, { x: ox + e.x * k, y: oy + e.y * k, w: e.w * k, h: e.h * k }));
}
function makeAIIconFn(elements) {
  elements = fitAIIcon(elements);
  return function (x, y, s, c) {
    const resolveCol = col => {
      if (!col || col === 'none') return null;
      if (col === 'primary') return c;
      if (col === 'tint') return typeof tint === 'function' ? tint(c, 0.4) : c;
      if (col === 'shade') return typeof shade === 'function' ? shade(c, 0.3) : c;
      if (col === 'white') return '#FFFFFF';
      if (col === 'dark') return '#2B2B2B';
      if (col === 'coral') return '#E58F6D';
      if (col === 'gold') return '#DDB945';
      if (typeof col === 'string' && col.startsWith('#')) return col;
      return c;
    };
    const out = [];
    (elements || []).forEach(el => {
      const fill = resolveCol(el.fill);
      const line = resolveCol(el.line);
      if (el.shape === 'line' || (el.x1 !== undefined && el.x2 !== undefined)) {
        const x1 = x + s * (el.x1 / 100), y1 = y + s * (el.y1 / 100);
        const x2 = x + s * (el.x2 / 100), y2 = y + s * (el.y2 / 100);
        const w = Math.max(1.5, s * ((el.lineW || 2) / 100));
        out.push(seg(x1, y1, x2, y2, line || fill || c, w, el.dash ? { dash: true } : {}));
      } else {
        const ex = x + s * (el.x / 100), ey = y + s * (el.y / 100);
        const ew = s * (el.w / 100), eh = s * (el.h / 100);
        const opts = { fill, line };
        if (line && line !== 'none') opts.lineW = Math.max(1, s * ((el.lineW || 2) / 100));
        if (el.rot) opts.rot = el.rot;
        out.push(box(el.shape || 'roundRect', ex, ey, ew, eh, opts));
      }
    });
    return out;
  };
}

function registerCustomIcon(iconData) {
  if (!iconData || !iconData.name || !Array.isArray(iconData.elements)) return null;
  const key = iconData.name.startsWith('ai_') ? iconData.name : 'ai_' + iconData.name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  if (typeof CMP === 'object' && CMP) {
    CMP[key] = makeAIIconFn(iconData.elements);
  }
  if (typeof CMP_NAMES === 'object' && CMP_NAMES) {
    CMP_NAMES[key] = iconData.label || iconData.name;
  }
  return key;
}

function loadAllCustomIcons() {
  const all = getStoredCustomIcons();
  Object.keys(all).forEach(k => {
    registerCustomIcon(all[k]);
  });
}
loadAllCustomIcons();

const ICON_CHOICES = () => ['none'].concat(Object.keys(typeof CMP === 'object' ? CMP : {}).sort());
function renderEdit() {
  const E = ST.edit, box = stEl('EditForm');
  stEl('EditPreview').innerHTML = ''; stEl('EditPreview').hidden = true;
  if (!E) { box.innerHTML = ''; box.hidden = true; studioButtons(); return; }
  const P = E.rec.plan, icons = ICON_CHOICES();
  let h = '';
  if (E.rec.kind === 'plan') {
    const hand = (iid, f) => (E.hand.find(x => x.iid === iid && x.f === f) || {}).to;
    // 10.25: each point is a card - its label, description and icon (the icon shown, a box to describe a new one, the
    // library behind a small list); with one point selected on the slide only that point is shown (E.focus)
    const thumbOf = key => { try { return key && key !== 'none' && CMP[key] ? toSVG(comp(key, 3, 3, 34, accent(0)), 40, 40) : ''; } catch (e) { return ''; } };
    const fk = E.focus ? P.items.findIndex(i => i.id === E.focus) : -1;
    h += (fk >= 0 ? `<div class="edfocus">Editing point ${fk + 1} of ${P.items.length} (the part you selected) <button type="button" id="stEdAll">Edit the whole visual</button></div>`
      : `<div class="small"><b>Points</b> - change a text or an icon, then press Preview change</div>`) +
      P.items.map((it, k) => `<div class="edrow edcard${fk >= 0 && k !== fk ? ' edhide' : ''}" data-k="${k}">` +
      `<div class="edhead"><span class="ednum">${k + 1}</span><input type="text" class="edL" value="${esc(hand(it.id, 'L') || it.label)}" aria-label="Label of point ${k + 1}"></div>` +
      `<textarea class="edD" rows="2" aria-label="Description of point ${k + 1}">${esc(hand(it.id, 'D') != null ? hand(it.id, 'D') : it.detail || '')}</textarea>` +
      `<div class="edicon"><span class="edthumb" id="aiIconThumb_${k}" title="The icon now">${thumbOf(it.icon)}</span>` +
        `<div class="edicwrap" id="aiIconPrompt_${k}"><div class="edictitle">Icon</div>` +
        `<div class="edicrow"><input type="text" class="aiIconInput" id="aiIconInput_${k}" placeholder="Describe it: handshake, rocket, shield…">` +
          `<button type="button" class="aiIconSubmit" data-k="${k}">Design icon</button>` +
          `<button type="button" class="aiIconCancel" hidden data-k="${k}">✕</button></div>` +
        `<details class="ediclib"><summary>or pick from the icon library</summary><select class="edI" aria-label="Icon of point ${k + 1}">${icons.map(x => `<option value="${esc(x)}"${x === (it.icon || 'none') ? ' selected' : ''}>${esc(typeof CMP_NAMES === 'object' && CMP_NAMES[x] ? CMP_NAMES[x] : x)}</option>`).join('')}</select></details>` +
        `<button type="button" class="btnAiIcon" data-k="${k}" hidden></button>` +
        `<div class="aiIconLib" id="aiIconLib_${k}"></div>` +
        `<div class="aiIconStatus" id="aiIconStatus_${k}" hidden></div></div></div>` +
      `</div>`).join('');
    const st = E.rec.style || {};
    h += `<div class="edglobal"${fk >= 0 ? ' hidden' : ''}><div class="viewrow" style="margin-top:6px"><label>Layout <select id="stEdLayout"></select></label></div>` +
      `<div class="viewrow"><label>Colours <select id="stEdColour">${PLAN_COLOUR_NAMES.map((c, i) => `<option value="${i}"${i === (st.accent | 0) % 10 ? ' selected' : ''}>start with ${c}</option>`).join('')}</select></label>` +
      `<label>Spacing <select id="stEdSpacing"><option value="fill"${st.spacing !== 'open' ? ' selected' : ''}>fill the area</option><option value="open"${st.spacing === 'open' ? ' selected' : ''}>more white space</option></select></label></div>` +
      `<div class="viewrow"><label>Text <select id="stEdDensity"><option value="full"${E.rec.density !== 'names' ? ' selected' : ''}>labels and descriptions</option><option value="names"${E.rec.density === 'names' ? ' selected' : ''}>point names only</option></select></label></div></div>`;
    if (E.hand.length) h += `<div class="small">Changed by hand in PowerPoint (kept): ${esc(E.hand.map(x => `“${x.from}” → “${x.to}”`).join('; '))}</div>`;
  } else {
    h += `<div class="small"><b>Texts</b> of the visual (each stays in its own shape and size; a text that would no longer fit at its size is refused)</div>` +
      E.texts.map((t, k) => `<input type="text" class="edT" data-k="${k}" value="${esc(normText(t.text))}" aria-label="Text ${k + 1}" style="width:100%;margin-top:3px">`).join('') +
      (P ? '<div class="small" style="margin-top:6px">To change its layout, colours or icons, redesign it from its points (drawn here as a content plan, in its own area):</div><div class="viewrow"><label>Layout <select id="stEdLayout"></select></label></div>' : '');
  }
  if (E.moved) h += '<div class="small">The visual was moved on the slide; the edit is drawn where it is now.</div>';
  box.innerHTML = h; box.hidden = false;
  if (document.getElementById('stEdAll')) document.getElementById('stEdAll').addEventListener('click', () => { E.focus = ''; renderEdit(); });
  box.querySelectorAll('.edI').forEach((s, k) => s.addEventListener('change', () => { const th = document.getElementById('aiIconThumb_' + k); if (th) { try { th.innerHTML = s.value !== 'none' && CMP[s.value] ? toSVG(comp(s.value, 3, 3, 34, accent(0)), 40, 40) : ''; } catch (e) { /* none */ } } }));
  if (stEl('EdLayout')) fillLayouts();
  box.querySelectorAll('input:not(.aiIconInput),textarea,select').forEach(x => x.addEventListener('change', () => { if (x.id !== 'stEdLayout') fillLayouts(); stEl('EditPreview').hidden = true; }));

  // Event handlers for AI Icon Generation
  box.querySelectorAll('.btnAiIcon').forEach(btn => {
    btn.addEventListener('click', () => {
      const k = btn.dataset.k;
      const wrap = document.getElementById('aiIconPrompt_' + k);
      if (wrap) {
        wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
        if (wrap.style.display !== 'none') {
          const inp = document.getElementById('aiIconInput_' + k), lab = box.querySelectorAll('.edL')[+k];
          if (inp && !inp.value && lab) inp.value = lab.value.trim();   // 10.24: the point's own words to start from
          if (inp) { inp.focus(); inp.select(); }
        }
      }
    });
  });

  box.querySelectorAll('.aiIconCancel').forEach(btn => {
    btn.addEventListener('click', () => {
      const k = btn.dataset.k;
      const wrap = document.getElementById('aiIconPrompt_' + k);
      if (wrap) wrap.style.display = 'none';
    });
  });

  // 10.24: "Find or design an icon" - the library's matching icons first (free, at once), then Claude's own design when
  // Claude is set up and allowed; each result says where it comes from, and a stand-in is never called Claude's
  const useIcon = (k, key) => {
    const sel = box.querySelectorAll('.edI')[+k];
    if (sel) { if (![...sel.options].some(o => o.value === key)) sel.insertAdjacentHTML('beforeend', `<option value="${esc(key)}">${esc((CMP_NAMES && CMP_NAMES[key]) || key)}</option>`); sel.value = key; }
    const th = document.getElementById('aiIconThumb_' + k); if (th) th.innerHTML = iconThumb(key);
    if (P && P.items && P.items[k]) P.items[k].icon = key;
    fillLayouts(); editPreview();
  };
  const iconThumb = key => { try { return toSVG(comp(key, 2, 2, 36, accent(0)), 40, 40); } catch (e) { return ''; } };
  box.querySelectorAll('.aiIconSubmit').forEach(btn => {
    btn.addEventListener('click', async () => {
      const k = btn.dataset.k, inp = document.getElementById('aiIconInput_' + k), stat = document.getElementById('aiIconStatus_' + k), lib = document.getElementById('aiIconLib_' + k);
      const desc = (inp ? inp.value : '').trim();
      const say = (t, err) => { if (stat) { stat.textContent = t; stat.hidden = false; stat.style.color = err ? 'var(--warn,#a4262c)' : ''; } };
      if (!desc) { say('Describe the icon first (e.g. "vehicle").', true); return; }
      // 1. the library
      const seen = new Set(), found = (typeof conceptScores === 'function' ? conceptScores(desc, '') : []).filter(x => CMP[x.key] && !seen.has(x.key) && seen.add(x.key)).slice(0, 6);
      if (lib) {
        lib.innerHTML = found.length ? '<div class="iconSrc">Library icons <span class="badge src builtin">Built-in</span></div>' + found.map(x =>
          `<button type="button" class="iconPick" data-key="${esc(x.key)}" title="${esc(x.name)}">${iconThumb(x.key)}<span>${esc(x.name)}</span></button>`).join('') : '';
        lib.querySelectorAll('.iconPick').forEach(b => b.addEventListener('click', () => { useIcon(k, b.dataset.key); say(`Using the library icon “${b.title}”.`); }));
      }
      // 2. Claude
      btn.disabled = true;
      say(`${found.length ? found.length + ' library icon' + (found.length > 1 ? 's' : '') + ' found. ' : ''}Asking Claude to design “${desc}”…`);
      try {
        const res = await api('/api/claude/icon', { description: desc, style: typeof AIVB_ICON_STYLE === 'function' ? AIVB_ICON_STYLE() : 'flat' }, 90000);
        if (!res || !res.ok || !res.icon) { say(((res && res.error) || 'Claude could not design this icon.') + (found.length ? ' Pick a library icon above.' : ''), !found.length); return; }
        const iconKey = registerCustomIcon(res.icon);
        saveCustomIcon(iconKey, res.icon);
        const from = res.source === 'claude' ? '<span class="badge src claude">Claude</span>' : '<span class="badge src builtin">Ready-made</span>';
        if (lib) {
          lib.insertAdjacentHTML('beforeend', `<div class="iconSrc">${res.source === 'claude' ? 'Designed for you' : 'Ready-made drawing'} ${from}</div>` +
            `<button type="button" class="iconPick" data-key="${esc(iconKey)}" title="${esc(res.icon.label || iconKey)}">${iconThumb(iconKey)}<span>${esc(res.icon.label || iconKey)}</span></button>`);
          lib.lastElementChild.addEventListener('click', () => { useIcon(k, iconKey); say(`Using “${res.icon.label || iconKey}”.`); });
        }
        useIcon(k, iconKey);
        say(res.source === 'claude' ? `Claude designed “${res.icon.label || iconKey}” and it is applied to point ${+k + 1}. Press “Preview change”, then “Apply to the slide”.`
          : `Claude was not available; a ready-made “${res.icon.label || iconKey}” drawing is applied instead.`);
        setStatus(`Icon of point ${+k + 1}: “${res.icon.label || iconKey}” (${res.source === 'claude' ? 'designed by Claude' : 'ready-made drawing'}).`);
      } catch (err) {
        say('Claude: ' + errText(err) + (found.length ? ' Pick a library icon above.' : ''), !found.length);
      } finally {
        btn.disabled = false;
      }
    });
  });

  box.querySelectorAll('.aiIconInput').forEach(inp => {
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const k = inp.id.replace('aiIconInput_', '');
        const submitBtn = box.querySelector(`.aiIconSubmit[data-k="${k}"]`);
        if (submitBtn) submitBtn.click();
      }
    });
  });

  studioButtons();
}
/* The visual's area now: its designed area, moved with it. */
function editRect(E, bbox) {
  const r = E.rec.rect, b = E.rec.bbox, dx = bbox && b ? bbox.x - b.x : 0, dy = bbox && b ? bbox.y - b.y : 0;
  return { x: r.x + dx, y: r.y + dy, w: r.w, h: r.h };
}
/* The plan as edited in the form; throws with the reason when an edit cannot be used. */
function editTarget() {
  const E = ST.edit;
  if (E.rec.kind !== 'plan') {
    const P = planPlain(E.rec.plan), layout = stEl('EdLayout') ? stEl('EdLayout').value : '';
    return layout ? { plan: Object.assign(P, { style: { accent: 0, spacing: 'fill' } }), layout, density: 'full' } : null;
  }
  const P = planPlain(E.rec.plan);
  stEl('EditForm').querySelectorAll('.edrow').forEach(row => {
    const it = P.items[+row.dataset.k], l = planClean(row.querySelector('.edL').value), d = planClean(row.querySelector('.edD').value).replace(/\.$/, '');
    if (!l) throw new Error(`point ${+row.dataset.k + 1} needs a label (to remove a point, insert a new visual from its text)`);
    if (l.length > 80) throw new Error(`the label “${l.slice(0, 30)}…” is longer than 80 characters: put the rest in its description`);
    if (d.length > 300) throw new Error(`the description of “${l}” is longer than 300 characters`);
    it.label = l; it.detail = d; it.icon = row.querySelector('.edI').value;
  });
  const lab = P.items.map(i => i.label.toLowerCase());
  if (new Set(lab).size !== lab.length) throw new Error('two points have the same label');
  P.style = { accent: +stEl('EdColour').value, spacing: stEl('EdSpacing').value };
  return { plan: P, layout: stEl('EdLayout').value, density: stEl('EdDensity').value };
}
function fillLayouts() {
  const sel = stEl('EdLayout'), E = ST.edit;
  if (!sel || !E) return;
  let t = null;
  try { t = E.rec.kind === 'plan' ? editTarget() : { plan: Object.assign(planPlain(E.rec.plan), { style: {} }), density: 'full' }; } catch (e) { return; }
  const R = editRect(E, E.rec.bbox), draw = t.density === 'names' ? planNames(t.plan) : t.plan, cur = sel.value || E.rec.layout;
  const ok = Object.keys(PLAN_LAYOUTS).map(k => planRender(draw, k, R)).filter(r => r.ok);
  E.layouts = ok;
  sel.innerHTML = (E.rec.kind === 'plan' ? '' : '<option value="">keep the visual as it is</option>') +
    ok.map(r => `<option value="${esc(r.key)}"${r.key === cur ? ' selected' : ''}>${esc(r.name)}</option>`).join('') +
    (E.rec.kind === 'plan' && !ok.some(r => r.key === cur) ? `<option value="${esc(cur)}" selected>${esc(E.rec.name)} (does not fit with these changes)</option>` : '');
}
function editPreview() {
  const E = ST.edit, pv = stEl('EditPreview');
  if (!E) return;
  try {
    const t = editTarget();
    if (!t) { pv.innerHTML = '<div class="small">Text changes only: they go into the existing shapes.</div>'; pv.hidden = false; return true; }
    const r = planRender(t.density === 'names' ? planNames(t.plan) : t.plan, t.layout, editRect(E, E.rec.bbox));
    if (!r.ok) throw new Error(`${r.name || t.layout} does not fit with these changes (${r.why}); choose another layout${E.layouts && E.layouts.length ? ' (' + E.layouts.slice(0, 4).map(x => x.name).join(', ') + ' fit)' : ''}, shorten the text, or show the point names only`);
    pv.innerHTML = `<div class="gthumb">${thumb(r.prims)}</div><div class="small">${esc(r.name)}${planStyleName(r.style) ? ' · ' + esc(planStyleName(r.style)) : ''}: checked at 22 pt and up, every ${t.density === 'names' ? 'point name' : 'label and description'} shown, nothing overlapping.</div>`;
    pv.hidden = false;
    return true;
  } catch (e) { ST.pvWhy = errText(e); pv.innerHTML = `<div class="issues">${esc(ST.pvWhy)}</div>`; pv.hidden = false; return false; }
}
/* Replaces the visual with `t` (a plan, layout, density) in its own area: draws the new one, then removes exactly the
   old shapes; nothing else on the slide changes. The record before the change is kept for one undo. */
async function replaceVisual(E, t) {
  let res = null;
  await PowerPoint.run(async context => {
    const slide = context.presentation.slides.getItem(E.slideId), parts = await visualParts(context, slide, E.id);
    if (!parts.tops.length) throw new Error("the visual's shapes are no longer on this slide");
    const rect = editRect(E, parts.bbox), mine = new Set(parts.tops.map(s => s.id));
    if (rect.x < -1 || rect.y < -1 || rect.x + rect.w > SLIDE.w + 1 || rect.y + rect.h > SLIDE.h + 1) throw new Error('the visual has been moved partly off the slide; move it back first');
    const info = await readSlide(context, slide);
    // 10.24: a text box above the visual (the slide's own text, its frame reaching into the area) is not in the way: the
    // part its text uses ends above the visual, so the area starts below it instead of the edit being refused
    const used = x => x.text && typeof textUsedHeight === 'function' ? Object.assign({}, x, { height: Math.min(x.height, textUsedHeight(x.text, x.width, 24)) }) : x;
    const b = parts.bbox;
    info.filter(x => !mine.has(x.id) && !x.isTitle && !x.removable && overlaps(x, rect)).map(used).forEach(x => {
      const bottom = x.top + x.height;
      if (b && bottom <= b.y + 6 && bottom > rect.y) { const y2 = bottom + 8; rect.h -= y2 - rect.y; rect.y = y2; }
    });
    if (rect.h < 120) throw new Error('there is too little room under the text above the visual; move the visual down or shorten that text, then try again. Nothing was changed');
    const blockers = info.filter(x => !mine.has(x.id) && !x.isTitle && !x.removable && x.width * x.height < 0.6 * SLIDE.w * SLIDE.h).map(used).filter(x => overlaps(x, rect));
    if (blockers.length) throw new Error(`other objects now overlap the visual's area (${blockers.slice(0, 3).map(x => x.name || x.type).join(', ')}); move them or the visual, then try again. Nothing was changed`);
    const before = new Set(await shapeIds(context, slide));
    let got;
    try {
      got = await drawPlanVisual(context, slide, t.plan, t.layout, { rect, density: t.density, from: E.rec.from, ver: (E.rec.ver || 1) + 1, noRecord: true, meta: Object.assign(studioMeta(t.density === 'names' ? planNames(t.plan) : t.plan), { id: E.id }) });
      parts.tops.forEach(s => slide.shapes.getItem(s.id).delete());
      await context.sync();
    } catch (e) {   // the new drawing out again; the old one stays
      try { (await shapeIds(context, slide)).filter(id => !before.has(id)).forEach(id => slide.shapes.getItem(id).delete()); await context.sync(); } catch (e2) { console.warn('Clean-up after a failed edit was incomplete', e2); }
      throw e;
    }
    // the ids of the new shapes already carry E.id; the record follows, the old one kept for undo
    const rec = await studioAfterInsert(context, slide, got.ids, { id: E.id }, { plan: t.plan, layout: t.layout, name: got.r.name, style: got.r.style, density: t.density, rect, from: E.rec.from, ver: (E.rec.ver || 1) + 1 });
    await writeBlob(context, slide, 'AIVB_P_' + E.id, E.rec);
    res = { rec, name: got.r.name, n: parts.tops.length };
  });
  return res;
}
/* Text changes in the existing shapes of a visual that is not drawn from a plan (each text keeps its shape and size). */
async function replaceTexts(E, changes) {
  await PowerPoint.run(async context => {
    const slide = context.presentation.slides.getItem(E.slideId);
    for (const c of changes) {
      const sh = c.t.parent ? slide.shapes.getItem(c.t.parent).group.shapes.getItem(c.t.id) : slide.shapes.getItem(c.t.id);
      sh.textFrame.textRange.text = c.to;
    }
    await context.sync();
    await writeBlob(context, slide, 'AIVB_P_' + E.id, Object.assign({}, E.rec, { kind: 'texts', changes: changes.map(c => ({ id: c.t.id, parent: c.t.parent, from: normText(c.t.text), to: c.to })) }));
  });
}
async function editApply() {
  const E = ST.edit;
  if (!E || ST.busy) return;
  if (!(await ensureGate())) return;
  ST.busy = true; studioButtons();
  try {
    const t = editTarget();
    if (!t) {
      const changes = [...stEl('EditForm').querySelectorAll('.edT')].map(x => ({ t: E.texts[+x.dataset.k], to: normText(x.value) })).filter(c => c.to !== normText(c.t.text));
      if (!changes.length) { setStatus('Nothing was changed.'); return; }
      const bad = changes.filter(c => !c.to || (!fitsAt(c.to, c.t.w, c.t.h, c.t.size || BRAND.minPt) && c.to.length > normText(c.t.text).length));
      if (bad.length) throw new Error(`${bad.map(c => c.to ? `“${c.to.slice(0, 40)}” does not fit its shape at ${c.t.size} pt` : 'a text cannot be empty').join('; ')}. Nothing was changed`);
      await replaceTexts(E, changes);
      setStatus(`Changed ${changes.length} text${changes.length > 1 ? 's' : ''} in the visual; nothing else on the slide was touched. “Undo last edit” restores ${changes.length > 1 ? 'them' : 'it'}.`);
    } else {
      if (!editPreview()) { setStatus(`Edit not applied: ${ST.pvWhy}. Nothing was changed.`, true); return; }
      const r = await replaceVisual(E, t);
      setStatus(`Applied: ${r.name}, drawn again in the visual's own area (${r.n} old object${r.n > 1 ? 's' : ''} replaced, nothing else on the slide touched).${editNote(r.rec)} “Undo last edit” restores the previous version.`);
    }
    await editReload(E);
  } catch (e) { setStatus('Edit not applied: ' + errText(e), true); }
  finally { ST.busy = false; studioButtons(); }
}
async function editUndo() {
  const E = ST.edit;
  if (!E || !E.prev || ST.busy) return;
  if (!(await ensureGate())) return;
  ST.busy = true; studioButtons();
  try {
    if (E.prev.kind === 'texts') {
      await PowerPoint.run(async context => {
        const slide = context.presentation.slides.getItem(E.slideId);
        E.prev.changes.forEach(c => { (c.parent ? slide.shapes.getItem(c.parent).group.shapes.getItem(c.id) : slide.shapes.getItem(c.id)).textFrame.textRange.text = c.from; });
        await context.sync();
        await writeBlob(context, slide, 'AIVB_P_' + E.id, Object.assign({}, E.prev, { changes: E.prev.changes.map(c => Object.assign({}, c, { from: c.to, to: c.from })) }));
      });
      setStatus('Undone: the texts are as they were.');
    } else {
      const P = E.prev, r = await replaceVisual(E, { plan: Object.assign(planPlain(P.plan), { style: P.style }), layout: P.layout, density: P.density });
      setStatus(`Undone: ${r.name} is back as it was. Press “Undo last edit” again to redo the change.`);
    }
    await editReload(E);
  } catch (e) { setStatus('Undo not applied: ' + errText(e), true); }
  finally { ST.busy = false; studioButtons(); }
}
async function editReload(E) {
  await PowerPoint.run(async context => {
    const slide = context.presentation.slides.getItem(E.slideId), rec = await readBlob(context, slide, 'AIVB_R_' + E.id), parts = await visualParts(context, slide, E.id);
    ST.edit = Object.assign({}, E, { rec: rec || E.rec, texts: parts.texts, hand: [], prev: await readBlob(context, slide, 'AIVB_P_' + E.id), moved: false });
  });
  renderEdit();
}

/* ---------- panel ---------- */
function studioButtons() {
  const off = ST.busy, office = state.inOffice;
  stEl('Show').disabled = off; stEl('More').disabled = off || !ST.designs.length;
  stEl('Insert').disabled = off || !office || ST.sel < 0 || !gateOK();
  stEl('PlanSlides').disabled = off;
  const S = ST.slides;
  stEl('InsertSlides').disabled = off || !office || !S || !!(S.missing || []).length || !gateOK();
  stEl('InsertSlides').textContent = S ? `Insert the ${S.parts.length} slide${S.parts.length > 1 ? 's' : ''} after the selected slide` : 'Insert the slides';
  stEl('EditLoad').disabled = off || !office;
  stEl('EditPv').disabled = off || !ST.edit; stEl('EditApply').disabled = off || !office || !ST.edit || !gateOK();
  stEl('EditUndo').hidden = !(ST.edit && ST.edit.prev); stEl('EditUndo').disabled = off || !office;
  stEl('Recover').disabled = off;
}
function studioTab(t) {
  ['designs', 'slides', 'edit'].forEach(k => { stEl('Tab_' + k).classList.toggle('sel', k === t); stEl('Pane_' + k).hidden = k !== t; });
  stEl('PlanRow').hidden = t === 'edit';
  if (t === 'slides') checkBatch();
}
/* Opens the panel on a tab with a plan source (the provider panels' “More designs (no cost)”). */
function studioOpen(tab, src) {
  studioFillSources(src);
  studioTab(tab);
  stEl('Panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (tab === 'designs') showDesigns(false);
}
/* A provider's new result: its plan is kept on this PC and offered here. */
function studioSaw(key) {
  const x = PANELS[key] && PANELS[key].plan && PANELS[key].plan();
  if (x) savePlan(x.plan, x.name);
  studioFillSources();
}
(() => {
  const el = document.createElement('div');
  el.className = 'panel'; el.id = 'stPanel';
  el.innerHTML = `<div class="step"><span class="num">5</span> Designs, slides and edits <span class="small">(free: no AI request)</span></div>
    <div class="tabs"><button type="button" id="stTab_designs" class="sel">Designs</button><button type="button" id="stTab_slides">Several slides</button><button type="button" id="stTab_edit">Edit a visual</button></div>
    <div id="stPlanRow"><label class="small" for="stPlan"><b>Content plan</b></label> <select id="stPlan" style="width:100%"></select>
      <div class="viewrow" style="margin-top:4px"><label>Text on the slide <select id="stDensity"><option value="auto" selected>automatic (every description when it fits)</option><option value="full">labels and descriptions</option><option value="names">point names only</option></select></label></div></div>
    <div id="stPane_designs">
      <div class="btn-row"><button id="stShow" class="secondary" type="button">Show designs</button><button id="stMore" class="secondary" type="button">More designs</button></div>
      <div id="stDesignNote" class="small"></div>
      <div id="stGrid" class="grid" hidden></div>
      <button id="stInsert" class="secondary" type="button">Insert selected design</button>
    </div>
    <div id="stPane_slides" hidden>
      <div class="viewrow"><label>Slides <select id="stSplit"><option value="auto" selected>one slide when it fits, else several</option><option value="split">always several slides</option></select></label></div>
      <label class="check"><input type="checkbox" id="stOverview" checked> <span>Start with an overview slide of all point names</span></label>
      <button id="stPlanSlides" class="secondary" type="button">Plan the slides</button>
      <div id="stSlideNote" class="small"></div>
      <div id="stSlides" class="grid" hidden></div>
      <button id="stInsertSlides" class="secondary" type="button">Insert the slides</button>
      <button id="stRecover" class="secondary" type="button" hidden></button>
    </div>
    <div id="stPane_edit" hidden>
      <div class="small">Click a visual this panel inserted (version 10.12 or later) on the slide, then:</div>
      <button id="stEditLoad" class="secondary" type="button">Edit the selected visual</button>
      <div id="stEditForm" hidden></div>
      <div id="stEditPreview" hidden></div>
      <div class="btn-row"><button id="stEditPv" class="secondary" type="button">Preview change</button><button id="stEditApply" class="secondary" type="button">Apply to the slide</button></div>
      <button id="stEditUndo" class="secondary" type="button" hidden>Undo last edit</button>
    </div>`;
  const after = $('compareBox') || $('claudePanel');
  after.parentNode.insertBefore(el, after.nextSibling);
  ['designs', 'slides', 'edit'].forEach(k => stEl('Tab_' + k).addEventListener('click', () => studioTab(k)));
  stEl('Plan').addEventListener('focus', () => studioFillSources());
  stEl('Plan').addEventListener('change', () => { ST.designs = []; ST.sel = -1; ST.slides = null; renderDesigns(); renderSlides(); studioButtons(); });
  stEl('Density').addEventListener('change', () => { ST.slides = null; renderSlides(); });
  stEl('Show').addEventListener('click', () => showDesigns(false));
  stEl('More').addEventListener('click', () => showDesigns(true));
  stEl('Insert').addEventListener('click', insertDesign);
  stEl('PlanSlides').addEventListener('click', planTheSlides);
  stEl('InsertSlides').addEventListener('click', insertSlides);
  stEl('Recover').addEventListener('click', recoverBatch);
  stEl('EditLoad').addEventListener('click', editLoad);
  stEl('EditPv').addEventListener('click', editPreview);
  stEl('EditApply').addEventListener('click', editApply);
  stEl('EditUndo').addEventListener('click', editUndo);
  studioFillSources();
  studioButtons();
  window.__studio = { ST, showDesigns, insertDesign, planTheSlides, insertSlides, checkBatch, recoverBatch, editLoad, editPreview, editApply, editUndo, editTarget, renderEdit, savePlan, studioFillSources, studioTab };
})();
