/* SL Editor 10.25 - one add-in, three tabs: AI SL Smart Design (the AI visual builder, editing, the SL Smart Design tools),
   SL Design and SL Animation (the commands of the company's SL_Audomation VBA add-in, run unchanged by the panel host:
   server.py /api/slsd/run -> SLED_MACROS). Also the look of the whole panel: name, logo, colours, buttons.
   Loaded after app.js and slsd.js. The developer mode (?dev=1) keeps the original page. */
(function () {
  const $ = id => document.getElementById(id);
  const DEV = typeof APP_DEV !== 'undefined' && APP_DEV;
  const H = { 'X-AIVB-Client': '1' };
  const LOGO = `<svg viewBox="0 0 40 40" aria-hidden="true"><defs><linearGradient id="slg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3645A9"/><stop offset="1" stop-color="#2BA3E0"/></linearGradient></defs>
    <rect x="1" y="1" width="38" height="38" rx="11" fill="url(#slg)"/><rect x="9" y="10" width="14" height="10" rx="3" fill="#fff" opacity=".95"/><rect x="9" y="23" width="9" height="7" rx="2.5" fill="#fff" opacity=".7"/>
    <rect x="21" y="23" width="10" height="7" rx="2.5" fill="#fff" opacity=".85"/><path d="M29 8.5l1.3 2.9 2.9 1.3-2.9 1.3L29 16.9l-1.3-2.9-2.9-1.3 2.9-1.3z" fill="#FFD66B"/></svg>`;

  /* ---------- the commands of SL Design and SL Animation (keys of server.py SLED_MACROS) ---------- */
  const ANIM = [
    { title: 'Entrance', note: 'Select shapes on the slide first', chips: [['an-fade-in', 'Fade'], ['an-zoom-in', 'Zoom'], ['an-fly-in', 'Fly'], ['an-peek-in', 'Peek'], ['an-wipe-in', 'Wipe'], ['an-split-in', 'Split'], ['an-circle-in', 'Circle']] },
    { title: 'Exit', note: 'Select shapes on the slide first', chips: [['an-fade-out', 'Fade'], ['an-zoom-out', 'Zoom'], ['an-fly-out', 'Fly'], ['an-peek-out', 'Peek'], ['an-wipe-out', 'Wipe'], ['an-split-out', 'Split'], ['an-circle-out', 'Circle']] },
    { title: 'Custom', chips: [['an-motion-line', 'Motion path: line'], ['an-spin', 'Emphasis: spin']] },
    { title: 'Bulk animation shift', note: 'Moves every animation on this slide that starts after “From” by “Shift by” seconds',
      form: [['from', 'From (s)', '0'], ['by', 'Shift by (s)', '0.5']], go: ['an-shift', 'Shift all animations'] },
    { title: 'Timing', rows: [['an-transition-times', 'Update all transition times', 'Each slide lasts as long as its audio'], ['an-audio-sync', 'Sync audio from OcenAudio', 'Copies the time from OcenAudio to the selected shapes’ delay']] },
    { title: 'Animation library', form: [['id', 'Animation ID', '']], go: ['an-import', 'Import animation'] },
    { title: 'Media', rows: [['an-adjust-videos', 'Adjust all animated videos', 'Crops and trims the videos to each slide’s time'], ['an-import-audio', 'Import and update audio', 'Replaces the audio with 01.wav, 02.wav… from a folder'],
      ['an-export-video', 'Export video (1080p)', 'Saves an .mp4 next to the presentation (save it first)']] }];
  const DESIGN = [
    { title: 'Shapes and text', rows: [['de-rounded-box', 'Rounded box', 'A grey rounded box with shadow'], ['de-text-box', 'Text box', 'Open Sans 22 pt'], ['de-bullets', 'Bullets', 'Bullets for the selected text, or a bullet box'],
      ['de-adjust-font', 'Adjust font', 'Open Sans 22 pt, #404040, 1.15 spacing (select text)'], ['de-source-text', 'Source text', 'An italic 14 pt “Source:” line']] },
    { title: 'Layout templates', chips: [['de-template-1', 'Template 1'], ['de-template-2', 'Template 2'], ['de-template-3', 'Template 3'], ['de-template-4', 'Template 4'], ['de-template-5', 'Template 5']] },
    { title: 'Brandline', note: 'Select the title text first', chips: [['de-brandline-osl', 'OSL brandline'], ['de-brandline-lvc', 'LVC brandline']],
      form: [['color', 'Colour', '#3645A9', 'color']], go: ['de-brandline-custom', 'Custom brandline'] },
    { title: 'Speaker notes', rows: [['de-notes-text', 'Export notes to a text file', 'Opens it in Notepad'], ['de-notes-vtt', 'Generate VTT notes', 'All notes as one line, for captions']] }];
  const SLSD_TOOLS = [
    { title: 'SL Smart Design', rows: [['alternative', 'Alternative Design', 'Choose one of 1,000+ SL Smart Design templates for this slide']] },
    { title: 'SL templates', chips: [['footer-note', 'Footer note'], ['footer-info', 'Footer info'], ['blue-codebox', 'Blue codebox'], ['black-codebox', 'Black codebox'], ['problem-solution', 'Problem / solution'], ['problem-solution-image', 'Problem / solution image']] },
    { title: 'Clean up', chips: [['remove-animations', 'Remove animations'], ['delete-empty', 'Delete empty boxes'], ['rename-text', 'Rename: Text'], ['rename-heading', 'Rename: Heading']] }];

  /* ---------- run one command ---------- */
  const NAMES = {};
  [ANIM, DESIGN, SLSD_TOOLS].flat().forEach(g => { (g.chips || []).concat(g.rows || []).forEach(([k, l]) => { NAMES[k] = (g.chips ? g.title + ': ' : '') + l; }); if (g.go) NAMES[g.go[0]] = g.go[1]; });
  let running = false;
  async function run(cmd, values, say, btn) {
    if (running) { say('Another command is still running. Wait for it, or close its window in PowerPoint.', 'bad'); return; }
    if (cmd === 'alternative' && window.SLSD && SLSD.alternativeDesign) { running = true; btn && btn.classList.add('busy'); try { await SLSD.alternativeDesign(null); say('Alternative Design closed.', 'ok'); } finally { running = false; btn && btn.classList.remove('busy'); } return; }
    running = true; btn && btn.classList.add('busy');
    say(`${NAMES[cmd] || 'Command'}: running in PowerPoint…`, '');
    try {
      const r = await fetch('/api/slsd/run', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, H), body: JSON.stringify({ cmd, values: values || {} }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'The command is not available. Run “Restart AI SL Smart Design”, then try again.');
      for (let wait = 250; ; wait = Math.min(wait * 1.5, 1500)) {
        await new Promise(res => setTimeout(res, wait));
        const s = await fetch('/api/slsd/status?id=' + encodeURIComponent(j.id), { headers: H, cache: 'no-store' }).then(x => x.json()).catch(() => ({ state: 'running' }));
        if (s.state === 'running') continue;
        if (s.state === 'error') throw new Error(s.message || 'The command did not finish.');
        say(`${NAMES[cmd] || 'Command'}: done.`, 'ok');
        break;
      }
    } catch (e) { say(e && e.message ? e.message : String(e), 'bad'); }
    finally { running = false; btn && btn.classList.remove('busy'); }
  }

  /* ---------- a tab of command cards ---------- */
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  function cards(groups, prefix) {
    return groups.map((g, gi) => `<section class="sled-card"><h3>${esc(g.title)}</h3>${g.note ? `<p class="sled-note">${esc(g.note)}</p>` : ''}
      ${g.chips ? `<div class="sled-chips">${g.chips.map(([k, l]) => `<button type="button" class="sled-chip" data-cmd="${k}">${esc(l)}</button>`).join('')}</div>` : ''}
      ${g.rows ? g.rows.map(([k, l, d]) => `<button type="button" class="sled-row" data-cmd="${k}"><span class="sled-ic"></span><span class="sled-t"><b>${esc(l)}</b>${d ? `<small>${esc(d)}</small>` : ''}</span><span class="sled-go">›</span></button>`).join('') : ''}
      ${g.form ? `<div class="sled-form">${g.form.map(([n, l, v, type]) => `<label>${esc(l)}<input ${type === 'color' ? 'type="color"' : 'type="text" inputmode="decimal"'} data-v="${n}" id="${prefix}${gi}${n}" value="${esc(v)}"></label>`).join('')}
        <button type="button" class="sled-primary" data-cmd="${g.go[0]}" data-form="${prefix}${gi}">${esc(g.go[1])}</button></div>` : ''}</section>`).join('') +
      `<div class="sled-status" role="status" aria-live="polite"></div>`;
  }
  function wire(pane) {
    const st = pane.querySelector('.sled-status');
    const say = (m, k) => { st.textContent = m; st.className = 'sled-status ' + (k || ''); st.hidden = !m; };
    pane.querySelectorAll('[data-cmd]').forEach(b => b.addEventListener('click', () => {
      const values = {};
      if (b.dataset.form) pane.querySelectorAll(`[id^="${b.dataset.form}"][data-v]`).forEach(i => { values[i.dataset.v] = i.value; });
      run(b.dataset.cmd, values, say, b);
    }));
    say('', '');
  }

  /* ---------- the page ---------- */
  function build() {
    document.title = 'SL Editor';
    if (DEV) return;      // the developer mode keeps the original page (its version line included)
    const h1 = document.querySelector('h1');
    // 10.26: no tab bar - each ribbon button opens its own tool (SL Editor / AI SL Smart Design, SL Design, SL Animation)
    if (h1) h1.innerHTML = `<i class="sled-logo">${LOGO}</i><b class="sled-name">SL Editor<small id="sledMode">AI SL Smart Design</small></b>` +
      `<button type="button" id="sledBack" class="sled-back" hidden title="Back to AI SL Smart Design">AI SL Smart Design ›</button>`;
    document.body.classList.add('sled');
    const mk = (id, html) => { const d = document.createElement('div'); d.id = id; d.className = 'sled-pane'; d.hidden = true; d.innerHTML = html; document.body.insertBefore(d, document.querySelector('footer')); wire(d); return d; };
    mk('sledDesign', `<p class="sled-lead">Brand shapes, text, layouts and notes for the selected slide.</p>` + cards(DESIGN, 'sd'));
    mk('sledAnim', `<p class="sled-lead">Animations, timing, audio and video for this presentation.</p>` + cards(ANIM, 'sa'));
    // the SL Smart Design tools, under the AI visuals
    const tools = document.createElement('details'); tools.className = 'panel sled-tools'; tools.id = 'sledTools';
    tools.innerHTML = `<summary><span class="num">3</span> SL Smart Design tools</summary>` + cards(SLSD_TOOLS, 'st');
    const after = $('stPanel') || $('appMain');
    if (after && after.parentNode) after.parentNode.insertBefore(tools, after.nextSibling);
    wire(tools);
    if ($('sledBack')) $('sledBack').addEventListener('click', () => show('ai'));
    let want = new URLSearchParams(location.search).get('tab');
    try { want = want || sessionStorage.getItem('sled.tab'); } catch (e) { /* none */ }
    if (want) show(want);
  }
  const MODES = { ai: 'AI SL Smart Design', design: 'SL Design', anim: 'SL Animation' };
  let shownAt = 0;
  function show(tab) {
    if (!['ai', 'design', 'anim'].includes(tab)) tab = 'ai';
    document.body.dataset.tab = tab;
    if ($('sledMode')) $('sledMode').textContent = MODES[tab];
    if ($('sledBack')) $('sledBack').hidden = tab === 'ai';
    shownAt = Date.now();
    if (!$('sledDesign')) return;
    $('sledDesign').hidden = tab !== 'design'; $('sledAnim').hidden = tab !== 'anim';
    try { sessionStorage.setItem('sled.tab', tab); } catch (e) { /* none */ }
    window.scrollTo(0, 0);
  }

  const css = document.createElement('style');
  css.textContent = `
    :root { --accent:#3645A9; --accent2:#2BA3E0; --ink:#1b2433; --muted:#5d6779; --line:#e1e6f0; --bg:#f3f6fb; }
    body.simple { background:linear-gradient(180deg,#eef2fb 0,#f5f7fc 220px,#f5f7fc 100%); padding:0 12px 118px; }
    body.simple h1 { position:sticky; top:0; z-index:30; margin:0 -12px; padding:12px 14px 8px; background:rgba(245,247,252,.94); backdrop-filter:blur(6px); display:flex; align-items:center; gap:10px; }
    body.simple h1::before { display:none; }
    .sled-logo { display:block; font-style:normal; } .sled-logo svg { width:34px; height:34px; display:block; filter:drop-shadow(0 3px 6px rgba(54,69,169,.25)); }
    .sled-name { display:flex; flex-direction:column; font-size:17px; font-weight:700; letter-spacing:.2px; line-height:1.15; }
    .sled-name small { font-size:10.5px; font-weight:500; color:var(--muted); letter-spacing:.1px; }
    .sled-back { margin-left:auto; border:1px solid #d5dcea; background:#fff; color:var(--accent); border-radius:999px; padding:4px 10px; font-size:11px; font-weight:600; white-space:nowrap; }
    .sled-back:hover { border-color:var(--accent); }
    body.sled:not([data-tab="ai"])[data-tab] > .panel, body.sled:not([data-tab="ai"])[data-tab] #appFoot, body.sled:not([data-tab="ai"])[data-tab] footer { display:none !important; }
    body.sled:not([data-tab="ai"])[data-tab] { padding-bottom:24px; }
    body.simple .panel { border:0; border-radius:14px; box-shadow:0 1px 3px rgba(20,30,60,.06), 0 6px 18px rgba(20,30,60,.05); padding:14px; }
    body.simple .step { font-size:14px; }
    body.simple .num { background:linear-gradient(135deg,var(--accent),var(--accent2)); }
    body.simple textarea { border-color:#d5dcea; border-radius:10px; background:#fbfcff; }
    body.simple textarea:focus { outline:none; border-color:var(--accent2); box-shadow:0 0 0 3px rgba(43,163,224,.18); }
    body.simple .secondary { border-color:#d5dcea; border-radius:10px; background:#fff; font-weight:600; color:#2b3550; }
    body.simple .secondary:hover:not(:disabled) { border-color:var(--accent); color:var(--accent); }
    body.simple .appgen, body.simple #appInsert { background:linear-gradient(135deg,var(--accent),#2f7fd0) !important; box-shadow:0 4px 12px rgba(54,69,169,.28); border-radius:11px !important; }
    body.simple .appgen:disabled, body.simple #appInsert:disabled { background:#b7bfe0 !important; box-shadow:none; }
    body.simple footer { border-top:0; box-shadow:0 -6px 20px rgba(20,30,60,.08); padding:10px 12px 8px; }
    body.simple #newSlide, body.simple #newSlide + span { display:none; }
    body.simple footer label.check:has(#newSlide) { display:none; }
    body.simple #status { max-height:40px; }
    .appgrid .gcard { border-color:#e3e8f2 !important; border-radius:12px !important; }
    .sled-pane { padding-bottom:12px; }
    .sled-lead { margin:0 2px 10px; color:var(--muted); font-size:12.5px; }
    .sled-card { background:#fff; border-radius:14px; padding:12px; margin-bottom:10px; box-shadow:0 1px 3px rgba(20,30,60,.06), 0 6px 18px rgba(20,30,60,.05); }
    .sled-card h3 { margin:0 0 8px; font-size:13px; display:flex; align-items:center; gap:7px; }
    .sled-card h3::before { content:''; width:8px; height:8px; border-radius:3px; background:linear-gradient(135deg,var(--accent),var(--accent2)); }
    .sled-note { margin:-4px 0 8px; font-size:11.5px; color:var(--muted); }
    .sled-chips { display:flex; flex-wrap:wrap; gap:6px; }
    .sled-chip { border:1px solid #d9dfeb; background:#f8faff; border-radius:999px; padding:5px 12px; font-size:12px; font-weight:600; color:#2b3550; }
    .sled-chip:hover { border-color:var(--accent); color:var(--accent); background:#fff; }
    .sled-row { display:flex; align-items:center; gap:10px; width:100%; text-align:left; border:1px solid #e6eaf3; background:#fff; border-radius:11px; padding:8px 10px; margin-top:6px; }
    .sled-row:hover { border-color:var(--accent); box-shadow:0 2px 8px rgba(54,69,169,.12); }
    .sled-ic { width:28px; height:28px; border-radius:8px; flex:none; background:linear-gradient(135deg,#e8ecfb,#dff2fb); position:relative; }
    .sled-ic::after { content:''; position:absolute; inset:9px; border-radius:3px; background:linear-gradient(135deg,var(--accent),var(--accent2)); }
    .sled-t { flex:1; min-width:0; display:flex; flex-direction:column; font-size:12.5px; } .sled-t small { color:var(--muted); font-size:11px; }
    .sled-go { color:#9aa4bb; font-size:18px; }
    .sled-form { display:flex; flex-wrap:wrap; gap:8px; align-items:flex-end; margin-top:8px; }
    .sled-form label { display:flex; flex-direction:column; gap:3px; font-size:11.5px; font-weight:600; color:var(--muted); flex:1; min-width:80px; }
    .sled-form input[type=text] { border:1px solid #d5dcea; border-radius:9px; padding:6px 8px; font:inherit; font-size:12.5px; }
    .sled-form input[type=color] { width:100%; height:32px; border:1px solid #d5dcea; border-radius:9px; padding:2px; background:#fff; }
    .sled-primary { border:0; border-radius:10px; padding:8px 14px; font-weight:600; color:#fff; background:linear-gradient(135deg,var(--accent),#2f7fd0); flex:1 1 100%; }
    .busy { opacity:.6; pointer-events:none; position:relative; }
    .sled-status { margin-top:6px; padding:8px 10px; border-radius:10px; font-size:12px; background:#eef2fb; color:#2b3550; }
    .sled-status.ok { background:#e7f6ee; color:#1e7d45; } .sled-status.bad { background:#fdeeee; color:#a4262c; }
    .sled-tools summary { cursor:pointer; list-style:none; display:flex; align-items:center; gap:8px; font-weight:600; font-size:14px; color:var(--ink); margin:0; }
    .sled-tools summary::-webkit-details-marker { display:none; }
    .sled-tools summary::after { content:'▾'; margin-left:auto; color:var(--muted); }
    .sled-tools[open] summary { margin-bottom:8px; }
    .sled-tools .sled-card { box-shadow:none; border:1px solid #edf0f6; }
    .edcard { border:1px solid #e3e8f2; border-radius:12px; padding:9px; margin-top:8px; background:#fff; }
    .edhide { display:none !important; }
    .edhead { display:flex; align-items:center; gap:7px; }
    .ednum { width:22px; height:22px; flex:none; border-radius:50%; background:linear-gradient(135deg,var(--accent),var(--accent2)); color:#fff; font-size:11.5px; font-weight:700; display:flex; align-items:center; justify-content:center; }
    .edcard .edL { flex:1; min-width:0; border:1px solid #d5dcea; border-radius:8px; padding:5px 8px; font:inherit; font-weight:600; }
    .edcard .edD { width:100%; margin-top:6px; border:1px solid #d5dcea; border-radius:8px; padding:5px 8px; font:inherit; font-size:12px; height:auto; resize:vertical; }
    .edicon { display:flex; gap:8px; margin-top:7px; padding:8px; border-radius:10px; background:#f5f8fe; }
    .edthumb { width:44px; height:44px; flex:none; border-radius:10px; background:#fff; border:1px solid #e1e6f0; display:flex; align-items:center; justify-content:center; }
    .edthumb:empty::after { content:'none'; font-size:10px; color:var(--muted); }
    .edthumb svg { width:38px; height:38px; }
    .edicwrap { flex:1; min-width:0; }
    .edictitle { font-size:11px; font-weight:700; color:#47506a; margin-bottom:3px; }
    .edicrow { display:flex; gap:5px; }
    .edicrow .aiIconInput { flex:1; min-width:0; border:1px solid #d5dcea; border-radius:8px; padding:5px 7px; font-size:11.5px; }
    .aiIconSubmit { border:0; border-radius:8px; padding:5px 10px; font-size:11.5px; font-weight:600; color:#fff; background:linear-gradient(135deg,var(--accent),#2f7fd0); white-space:nowrap; }
    .ediclib { margin-top:5px; font-size:11px; } .ediclib summary { cursor:pointer; color:var(--accent); font-weight:600; }
    .ediclib select { width:100%; margin-top:4px; font-size:11.5px; }
    .aiIconStatus { font-size:11px; color:var(--muted); margin-top:4px; }
    .edfocus { display:flex; align-items:center; gap:8px; flex-wrap:wrap; padding:8px 10px; border-radius:10px; background:#eef2fb; font-size:12px; font-weight:600; color:#2b3550; }
    .edfocus button { margin-left:auto; border:1px solid var(--accent); color:var(--accent); background:#fff; border-radius:8px; padding:3px 9px; font-size:11.5px; font-weight:600; }
  `;
  document.head.appendChild(css);
  build();
  // a ShowTaskpane button (SL Editor, AI SL Smart Design) opens the AI tool; SL Design / SL Animation call show() first
  try {
    if (typeof Office !== 'undefined') Office.onReady(() => {
      if (Office.addin && typeof Office.addin.onVisibilityModeChanged === 'function')
        Office.addin.onVisibilityModeChanged(a => { if (a && a.visibilityMode === 'Taskpane') setTimeout(() => { if (Date.now() - shownAt > 1500) show('ai'); }, 600); });
    });
  } catch (e) { /* outside Office */ }
  window.__sled = { run, show, NAMES, mode: () => document.body.dataset.tab || 'ai' };
})();
