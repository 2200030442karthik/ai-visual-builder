/* AI Visual Builder 10.13 - the app: what an end user sees. Content -> "Generate visuals" -> 10-20 editable designs ->
   preview -> insert; then, if wanted, more visuals, several slides or editing an inserted visual. Everything technical
   (panel host, setup and checks, the analysis step, timings, the provider sections and their requests, credits and
   tokens, saved results, raw messages) stays in the page for the developer mode and is hidden from everyone else.
   - Developer mode: ?dev=1 in the panel's address (that load), or Ctrl+Alt+Shift+D (remembered on this PC). It shows every section
     of V10.12.2 as it was, plus the generation log and the paid-provider policy for this PC.
   - The engines, their choice, ranking and cost control are in orchestrator.js; analysis runs inside Generate.
   - The ribbon opens the panel on a section: ?open=slides | edit (manifest-v10.xml).
   Loaded last (after studio.js). */
const APP_VERSION = '10.13.0';
const APP = { list: [], sel: -1, text: '', busy: false, stale: false, lastIns: null, dupOk: '', filter: 'All', shown: 0 };
const QS = new URLSearchParams(location.search);
// ?dev=1: this load only; Ctrl+Alt+Shift+D: remembered on this PC until pressed again (or ?dev=0)
const APP_DEV = (() => { if (QS.get('dev') === '1') return true; try { if (QS.get('dev') === '0') localStorage.removeItem('aivb.dev'); return localStorage.getItem('aivb.dev') === '1'; } catch (e) { return false; } })();

/* ---------- plain words: what reaches the status line in the app ---------- */
function friendly(m) {
  let s = String(m || '')
    .replace(/\s*\((?:request|no AI request|free|no credits|no cost|Simplilearn brand style)[^)]*\)/gi, '')
    .replace(/\s*\(Details:[\s\S]*$/i, '')
    .replace(/\b(?:Napkin AI|Claude AI)(?:'s)?\b/g, 'The AI design service').replace(/\b(?:Napkin|Claude)\b(?:'s)?/g, 'AI')
    .replace(/\brequest\s+\S*…\S*/g, '').replace(/,?\s*variation \d+/g, '').replace(/\bstep [1-5]\b/gi, 'above').replace(/\s{2,}/g, ' ').trim();
  const parts = s.split(/(?<=[.!?])\s+/);
  return parts.slice(0, 2).join(' ');
}
const setStatus0 = setStatus;
setStatus = function (msg, err) { setStatus0(APP_DEV ? msg : friendly(msg), err); };
const appSay = (msg, err) => setStatus0(msg, err);

/* ---------- the page ---------- */
(() => {
  const css = document.createElement('style');
  css.textContent = `
    body.simple h1 > span, body.simple .sub, body.simple #aiStatus, body.simple #analysePanel, body.simple #step3, body.simple #napkinPanel,
    body.simple #claudePanel, body.simple #compareBox, body.simple #perfBox, body.simple #insert, body.simple #insertAll, body.simple #reviewWrap,
    body.simple #detailWrap, body.simple #stPanel .step, body.simple #stTab_designs, body.simple #stPane_designs, body.simple #stPlanRow,
    body.simple #stPanel:not(.open), body.simple .devonly { display:none !important; }
    body:not(.simple) #appFoot { display:none; }
    body.simple { background:#f3f5fa; }
    body.simple h1 { font-size:17px; letter-spacing:.1px; display:flex; align-items:center; gap:8px; margin:2px 0 10px; }
    body.simple h1::before { content:''; width:22px; height:22px; border-radius:6px; background:linear-gradient(135deg,#3645A9,#62B7E4); flex:none; }
    body.simple .panel { border-radius:12px; border-color:#e3e7f0; box-shadow:0 1px 2px rgba(20,30,60,.04); }
    body.simple textarea { font:13px/1.5 "Segoe UI",Aptos,Arial,sans-serif; height:120px; }
    .appgen { margin-top:0 !important; padding:12px !important; font-size:14px; border-radius:10px !important; display:flex; align-items:center; justify-content:center; gap:8px; }
    .appstage { display:flex; align-items:center; gap:6px; margin-top:10px; color:var(--muted); font-size:12.5px; }
    .appempty { margin-top:10px; padding:16px 12px; border:1px dashed #cfd6e4; border-radius:10px; color:var(--muted); font-size:12.5px; text-align:center; background:#fafbfe; }
    .apperr { margin-top:10px; padding:9px 11px; border-radius:10px; background:#fdf1f1; border:1px solid #f1caca; color:var(--err); font-size:12.5px; }
    .appstale { margin-top:8px; padding:7px 10px; border-radius:10px; background:#fff7e6; border:1px solid #f0d49a; color:var(--warn); font-size:12px; }
    .apphead { display:flex; align-items:center; gap:8px; margin:12px 0 6px; font-size:13px; }
    .apphead b { font-size:13.5px; }
    .chipsbar { display:flex; gap:5px; flex-wrap:wrap; margin-bottom:8px; }
    .chipsbar button { border:1px solid #d8deea; background:#fff; color:var(--ink); border-radius:14px; padding:2px 10px; font-size:11.5px; }
    .chipsbar button.sel { background:#3645A9; border-color:#3645A9; color:#fff; }
    .appgrid { max-height:none !important; gap:8px !important; }
    .appgrid .gcard { position:relative; padding:5px; border-radius:10px; transition:box-shadow .15s, border-color .15s; }
    .appgrid .gcard:hover { border-color:#aab3dc; }
    .appgrid .gcard.sel { border-color:#3645A9; box-shadow:0 0 0 2px #c9cff0; }
    .appgrid .gcard.sel::after { content:'✓'; position:absolute; top:6px; right:6px; width:18px; height:18px; border-radius:50%; background:#3645A9; color:#fff; font-size:11px; line-height:18px; text-align:center; }
    .appgrid .cat { color:var(--muted); font-size:10.5px; }
    .appbig { margin-top:10px; }
    .appbig .preview { border-radius:10px; }
    .appbig h3 { font-size:13.5px; margin:8px 0 2px; }
    .appbig p { margin:2px 0; font-size:12px; color:var(--muted); }
    .appacts { display:flex; gap:6px; margin-top:10px; }
    .appacts button { flex:1; margin:0; padding:8px 4px; border:1px solid #d8deea; border-radius:9px; background:#fff; font-size:12px; }
    .appacts button:disabled { opacity:.5; }
    #appFoot .btn-row { margin-top:6px; }
    #appInsert { width:100%; background:var(--accent); border:0; color:#fff; border-radius:9px; padding:11px; font-weight:600; font-size:13.5px; }
    #appInsert:disabled { background:#a9b0d8; cursor:default; }
    .stclose { float:right; border:0; background:none; font-size:16px; line-height:1; color:var(--muted); cursor:pointer; }
    .devbar { background:#1f2937; color:#fff; border-radius:8px; padding:6px 10px; font-size:12px; margin-bottom:8px; display:flex; gap:8px; align-items:center; }
    .devbar button, .devbar select { font-size:11.5px; }
  `;
  document.head.appendChild(css);
  if (!APP_DEV) document.body.classList.add('simple');
  const an = $('analyse').closest('.panel'); if (an) an.id = 'analysePanel';
  const contentPanel = $('content').closest('.panel'), stepEl = contentPanel.querySelector('.step');
  if (!APP_DEV && stepEl) stepEl.innerHTML = '<span class="num">1</span> Your content';
  $('content').placeholder = 'Paste a title, bullet points, a paragraph or notes.\n\nExample:\nMachine learning workflow\n1. Data collection\n2. Data preprocessing\n3. Model training\n4. Model evaluation\n5. Prediction';
  const main = document.createElement('div');
  main.className = 'panel'; main.id = 'appMain';
  main.innerHTML = `<div class="step"><span class="num">2</span> Generate visuals</div>
    <button id="appGen" class="primary appgen" type="button">Generate visuals</button>
    <div id="appStage" class="appstage" hidden><span class="spin"></span><span id="appStageText"></span></div>
    <div id="appEmpty" class="appempty">Paste your content above and press <b>Generate visuals</b>. You get up to 20 designs, all built from your content as editable PowerPoint shapes and text.</div>
    <div id="appErr" class="apperr" hidden></div>
    <div id="appStale" class="appstale" hidden>Your content changed. Press <b>Generate visuals</b> to update the designs.</div>
    <div id="appSec" class="secnav" hidden style="margin-top:10px"><button type="button" id="appSecPrev" aria-label="Previous section">‹</button><div id="appSecName"></div><button type="button" id="appSecNext" aria-label="Next section">›</button></div>
    <div id="appHead" class="apphead" hidden><b id="appCount"></b><span id="appNote" class="small" style="margin:0"></span></div>
    <div id="appChips" class="chipsbar" hidden></div>
    <div id="appGrid" class="grid appgrid" hidden></div>
    <div id="appBig" class="appbig" hidden><div class="preview" id="appPv"></div><h3 id="appPvT"></h3><p id="appPvD"></p>
      <label class="check" id="appReviewWrap" hidden><input type="checkbox" id="appReviewed"> <span id="appReviewText"></span></label></div>
    <div class="appacts" id="appActs" hidden><button type="button" id="appMore">More visuals</button><button type="button" id="appSlides">Several slides</button><button type="button" id="appEdit">Edit a visual</button></div>`;
  contentPanel.parentNode.insertBefore(main, contentPanel.nextSibling);
  // the insert bar (the footer keeps V10.12.2's own controls for the developer mode)
  const foot = document.querySelector('footer'), af = document.createElement('div');
  af.id = 'appFoot';
  af.innerHTML = `<button id="appInsert" type="button" disabled>Insert selected visual</button>`;
  foot.insertBefore(af, foot.firstChild);
  const ns = $('newSlide').parentNode.querySelector('span'); if (!APP_DEV && ns) ns.textContent = 'On a new slide after the selected one';
  if (!APP_DEV) $('removeLast').textContent = 'Undo last insert';
  // Several slides / Edit a visual: step 5's panel, opened on its tab, with a close button
  const st = $('stPanel'), hd = document.createElement('div');
  hd.className = 'step'; hd.id = 'stAppHead'; hd.style.display = 'block';
  hd.innerHTML = '<span id="stAppTitle"></span><button type="button" class="stclose" id="stAppClose" aria-label="Close">×</button>';
  st.insertBefore(hd, st.firstChild);
  if (!APP_DEV) { st.parentNode.removeChild(st); main.parentNode.insertBefore(st, main.nextSibling); }
  if (APP_DEV) {
    const bar = document.createElement('div');
    bar.className = 'devbar';
    bar.innerHTML = `<b>Developer mode</b> <span>${APP_VERSION}</span> <label>Paid providers <select id="devPolicy"><option value="">host policy</option><option value="never">never</option><option value="when-needed">when needed</option><option value="always">always</option></select></label>
      <button type="button" id="devLog">Generation log</button><button type="button" id="devLeave">Leave</button>`;
    document.body.insertBefore(bar, document.body.firstChild);
    try { $('devPolicy').value = localStorage.getItem('aivb.paidPolicy') || ''; } catch (e) { /* none */ }
    $('devPolicy').addEventListener('change', e => { try { if (e.target.value) localStorage.setItem('aivb.paidPolicy', e.target.value); else localStorage.removeItem('aivb.paidPolicy'); } catch (x) { /* none */ } });
    $('devLog').addEventListener('click', () => setStatus0(ORCH.log.slice(-25).map(x => `${x.at} ${x.what}`).join('\n') || 'Nothing generated yet.'));
    $('devLeave').addEventListener('click', () => { location.href = location.pathname + '?dev=0'; });
  }
})();
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.altKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
    try { if (APP_DEV) localStorage.removeItem('aivb.dev'); else localStorage.setItem('aivb.dev', '1'); } catch (x) { /* none */ }
    location.href = location.pathname + (APP_DEV ? '' : '?dev=1');
  }
});

/* ---------- states ---------- */
function appStage(text) { $('appStage').hidden = !text; $('appStageText').textContent = text || ''; }
function appError(text) { $('appErr').hidden = !text; $('appErr').textContent = text || ''; }
function appButtons() {
  const has = !!$('content').value.trim(), c = APP.list[APP.sel];
  $('appGen').disabled = APP.busy || !has;
  $('appGen').innerHTML = APP.busy ? '<span class="spin" style="border-color:#fff;border-top-color:transparent"></span>Generating…' : APP.list.length && !APP.stale ? 'Generate again' : 'Generate visuals';
  const review = c && c.engine === 'builtin' && typeof needsReview === 'function' && needsReview(state.sec);
  $('appInsert').disabled = !c || APP.busy || APP.stale || !state.inOffice || !gateOK() || (review && !$('appReviewed').checked);
  $('appInsert').textContent = !c ? 'Select a visual to insert' : !state.inOffice ? 'Open in PowerPoint to insert' : !gateOK() ? 'Select a Content Slide to insert' : review && !$('appReviewed').checked ? 'Confirm the checked points first'
    : `Insert selected visual${c.slides > 1 ? ` (${c.slides} slides)` : ''}`;
  $('appMore').disabled = APP.busy || !APP.list.length || APP.stale;
  $('appActs').hidden = !APP.list.length && !$('content').value.trim();
  $('appEmpty').hidden = !!APP.list.length || APP.busy || !$('appErr').hidden;
}
const updateButtons0 = updateButtons;
updateButtons = function () { updateButtons0.apply(this, arguments); appButtons(); };
$('content').addEventListener('input', () => { const t = $('content').value.trim(); APP.stale = !!APP.list.length && t !== APP.text; $('appStale').hidden = !APP.stale; appButtons(); });

/* ---------- generate ---------- */
async function appGenerate() {
  const text = $('content').value.trim();
  if (APP.busy) return;
  if (!text) { appError('Paste or type your content first.'); appButtons(); return; }
  APP.busy = true; appError(''); appButtons();
  try {
    appStage('Checking the slide…');
    if (!(await ensureGate())) { appError(state.slide && !state.slide.ok ? state.slide.reason.replace(/\s*\(Not accepted:[\s\S]*$/, '') : 'You are not set up to use this add-in yet. Ask your administrator for access.'); return; }
    // the analysis, automatically (no separate step)
    if (state.runText !== text || !state.sections.length) { appStage('Reading your content…'); await analyseContent(); }
    if (!state.sections.some(s => s.status === 'ready' && s.model && s.model.type !== 'none')) {
      appError(friendly($('status').textContent) || 'This text has no structure a visual can show. Add a title and a few points, then try again.');
      APP.list = []; APP.text = text; appRender(); return;
    }
    if (APP.text !== text) { APP.sel = -1; APP.filter = 'All'; }
    const r = await orchGenerate(text, {}, (msg, partial) => { appStage(msg); if (partial && partial.length) { APP.list = partial; APP.text = text; APP.stale = false; appRender(); } });
    if (!r) return;
    APP.list = r.list; APP.text = text; APP.stale = false; $('appStale').hidden = true;
    if (APP.sel >= APP.list.length) APP.sel = -1;
    if (APP.sel < 0 && APP.list.length) APP.sel = 0;
    appRender();
    appSay(APP.list.length ? `${APP.list.length} visual${APP.list.length > 1 ? 's' : ''} ready. Pick one, click a Content Slide, then press Insert.${r.note ? ' ' + r.note : ''}` : 'No design suits this content yet. Add a title and a few clear points, then try again.', !APP.list.length);
  } catch (e) { appError('Something went wrong while generating. Please try again. ' + friendly(errText(e))); }
  finally { APP.busy = false; appStage(''); appButtons(); }
}
async function appMore() {
  if (APP.busy || !APP.list.length) return;
  APP.busy = true; appButtons();
  try {
    const keep = APP.list[APP.sel], r = await orchMore(APP.text, appStage);
    APP.list = r.list; APP.sel = keep ? Math.max(0, APP.list.indexOf(keep)) : 0;
    appRender();
    appSay(r.fresh ? `${r.fresh} more visual${r.fresh > 1 ? 's' : ''} added at the top.` : r.note || 'No other layout suits this content.');
    if (r.fresh) $('appGrid').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) { appError('Could not make more visuals. ' + friendly(errText(e))); }
  finally { APP.busy = false; appStage(''); appButtons(); }
}

/* ---------- gallery ---------- */
const BADGE = c => c.edit === 'full' ? ['full', 'Editable'] : ['partial', 'Editable · icons as pictures'];
function appRender() {
  const L = APP.list, cats = ['All'].concat([...new Set(L.map(c => c.category))]);
  if (!cats.includes(APP.filter)) APP.filter = 'All';
  const shown = L.map((c, i) => [c, i]).filter(([c]) => APP.filter === 'All' || c.category === APP.filter);
  $('appHead').hidden = $('appGrid').hidden = !L.length;
  $('appCount').textContent = L.length ? `${L.length} visual${L.length > 1 ? 's' : ''}` : '';
  $('appNote').textContent = L.length ? 'built from your content · best first' : '';
  $('appChips').hidden = cats.length < 3;
  $('appChips').innerHTML = cats.map(k => `<button type="button" class="${k === APP.filter ? 'sel' : ''}" data-k="${esc(k)}">${esc(k)}</button>`).join('');
  $('appChips').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { APP.filter = b.dataset.k; appRender(); }));
  const run = APP.shown = (APP.shown || 0) + 1;
  $('appGrid').innerHTML = shown.map(([c, i]) => { const [cls, txt] = BADGE(c);
    return `<button type="button" class="gcard${i === APP.sel ? ' sel' : ''}" data-i="${i}" aria-pressed="${i === APP.sel}" aria-label="${esc(c.title)}"><div class="gthumb"></div>` +
      `<div class="gname">${esc(c.title)}</div><div class="cat">${esc(c.category)}${c.slides > 1 ? ` · ${c.slides} slides` : ''}</div><span class="badge ${cls}">${txt}</span></button>`; }).join('');
  $('appGrid').querySelectorAll('.gcard').forEach(b => b.addEventListener('click', () => appSelect(+b.dataset.i)));
  // thumbnails a few at a time, so the panel stays responsive
  const todo = [...$('appGrid').querySelectorAll('.gcard')];
  let k = 0;
  const step = () => { if (APP.shown !== run) return; for (const end = k + 4; k < end && k < todo.length; k++) { const c = L[+todo[k].dataset.i]; if (c) todo[k].querySelector('.gthumb').innerHTML = thumb(c.prims); } if (k < todo.length) requestAnimationFrame(step); };
  requestAnimationFrame(step);
  appSections(); appBig(); appButtons();
}
function appSelect(i) {
  APP.sel = i; APP.dupOk = '';
  $('appGrid').querySelectorAll('.gcard').forEach(b => { const on = +b.dataset.i === i; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', on); });
  appBig(); appButtons();
}
function appBig() {
  const c = APP.list[APP.sel];
  $('appBig').hidden = !c;
  if (!c) return;
  $('appPv').innerHTML = toSVG(previewFrame(Object.assign({}, TEMPLATE.contentArea)).concat(c.prims), SLIDE.w, SLIDE.h);
  $('appPvT').textContent = c.title;
  const pics = c.prims.filter(p => p.t === 'image').length;
  $('appPvD').textContent = (c.edit === 'full' ? 'Fully editable: every shape and text can be changed in PowerPoint.' : `Editable shapes and text; ${pics || 'some'} icon${pics === 1 ? ' is a picture' : 's are pictures'}.`) +
    (c.complete === false ? ' Shows the point names; the descriptions do not fit one slide (use Several slides to keep them).' : '') +
    (c.slides > 1 ? ` Goes on ${c.slides} slides.` : '');
  const review = c.engine === 'builtin' && typeof needsReview === 'function' && needsReview(state.sec);
  $('appReviewWrap').hidden = !review;
  if (review) $('appReviewText').textContent = 'Please check these points against your text: ' + ((state.check && state.check.issues) || []).slice(0, 3).join('; ');
}
function appSections() {
  const S = state.sections.filter(s => s.status === 'ready' && s.model && s.model.type !== 'none');
  $('appSec').hidden = !APP.list.length || S.length < 2;
  if (S.length > 1 && state.sec) $('appSecName').textContent = `Section ${state.sec.index + 1} of ${state.sections.length}: ${state.sec.heading || 'Untitled section'}`;
}
async function appSection(d) {
  if (APP.busy || !state.sec) return;
  const n = state.sections.length;
  let i = state.sec.index;
  do { i = (i + d + n) % n; } while (i !== state.sec.index && !(state.sections[i].status === 'ready' && state.sections[i].model.type !== 'none'));
  selectSection(i);
  ORCH.memo.delete(hashText(APP.text));       // the built-in designs belong to the section; nothing is requested again
  APP.sel = -1;
  await appGenerate();
}

/* ---------- insert ---------- */
async function appInsert() {
  const c = APP.list[APP.sel];
  if (!c || APP.busy || APP.stale) return;
  // the same visual, just inserted and still there: a second press for another copy
  if (APP.lastIns && APP.lastIns.ref === state.lastInsert && state.lastInsert && APP.lastIns.id === c.id && APP.dupOk !== c.id) {
    APP.dupOk = c.id;
    appSay('This visual was just inserted. Press Insert again to add another copy, or Undo last insert to take it out.', true);
    return;
  }
  APP.busy = true; appButtons();
  if (c.engine === 'builtin') $('reviewed').checked = $('appReviewed').checked;
  appSay('Inserting…');
  try {
    const ok = await c.insert();
    if (ok) {
      APP.lastIns = { ref: state.lastInsert, id: c.id }; APP.dupOk = '';
      const extra = state.lastInsert && (state.lastInsert.extraSlides || []).length;
      appSay(`Inserted “${c.title}”${state.lastInsert && state.lastInsert.newSlide ? ' on a new slide' : ''}${extra ? ` and ${extra} more slide${extra > 1 ? 's' : ''}` : ''}. Every text and shape is editable in PowerPoint; use Edit a visual to change it here. Undo last insert takes it out.`);
    } else appSay('Nothing was inserted. ' + friendly($('status').textContent), true);
  } catch (e) { appSay('Nothing was inserted: ' + friendly(errText(e)), true); }
  finally { APP.busy = false; appButtons(); updateButtons(); }
}

/* ---------- several slides and editing (step 5's panel) ---------- */
function appStudio(tab) {
  const st = $('stPanel');
  st.classList.add('open');
  $('stAppTitle').textContent = tab === 'edit' ? 'Edit a visual' : 'Several slides';
  if (typeof studioFillSources === 'function') studioFillSources('text');
  studioTab(tab);
  st.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
$('appGen').addEventListener('click', appGenerate);
$('appMore').addEventListener('click', appMore);
$('appSlides').addEventListener('click', () => appStudio('slides'));
$('appEdit').addEventListener('click', () => appStudio('edit'));
$('appInsert').addEventListener('click', appInsert);
$('appReviewed').addEventListener('change', appButtons);
$('appSecPrev').addEventListener('click', () => appSection(-1));
$('appSecNext').addEventListener('click', () => appSection(1));
$('stAppClose').addEventListener('click', () => $('stPanel').classList.remove('open'));
$('content').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !APP_DEV) { e.preventDefault(); e.stopImmediatePropagation(); appGenerate(); } }, true);
if (QS.get('open') === 'edit' || QS.get('open') === 'slides') setTimeout(() => appStudio(QS.get('open')), 0);
appButtons();
window.__app = { APP, appGenerate, appMore, appInsert, appSelect, appStudio, friendly, ORCH };
