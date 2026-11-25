/* AI Visual Builder 10.24 - "Style the selection": edit ANY visual on the slide, ours or not (an AI design, a Napkin
   rebuild, SL Smart Design shapes, a picture's converted shapes), from the Edit a visual tab:
     - colours from the approved palette (or any colour): the shapes' fill, their text, their outline, or an icon (its
       coloured parts, keeping its white details);
     - text size (the template's 22 / 24 pt, or larger) and bold;
     - the selected icon replaced by another: the library's matches for a description (free, at once), or one Claude
       designs for it, flat or 3D (2.5D: lighter top faces, darker sides) - drawn as native shapes in the selection's
       place and size.
   Every change works on what is selected in PowerPoint (groups are opened), so PowerPoint's own Undo (Ctrl+Z) takes it
   back. Loaded after studio.js. */
(() => {
  const SK = { target: 'fill', colour: null, style: 'flat', busy: false };
  window.AIVB_ICON_STYLE = () => SK.style;
  const esc2 = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const pane = document.getElementById('stPane_edit');
  if (!pane) return;
  const box = document.createElement('div');
  box.id = 'skBox';
  box.className = 'skbox';
  const swatches = TEMPLATE.accents.concat(['#404040', '#7F7F7F', '#F2F2F2', '#FFFFFF']);
  box.innerHTML = `
    <div class="sktitle">Style the selection <span class="small">any visual, icon or text on the slide</span></div>
    <div class="skrow" role="radiogroup" aria-label="What to colour">
      ${[['fill', 'Shape fill'], ['text', 'Text'], ['line', 'Outline'], ['icon', 'Icon']].map(([k, n]) => `<button type="button" class="sktgt${k === 'fill' ? ' sel' : ''}" data-t="${k}" role="radio" aria-checked="${k === 'fill'}">${n}</button>`).join('')}
    </div>
    <div class="skrow skcolrow"><button type="button" id="skColourBtn" class="skcolbtn" aria-haspopup="true" aria-expanded="false"><span id="skDot" class="skdot" style="background:#62B7E4"></span>Colour <span aria-hidden="true">▾</span></button>
      <button type="button" id="skReapply" title="Apply the chosen colour again to the selection">Apply</button>
      <div id="skPop" class="skpop" role="dialog" aria-label="Colours" hidden>
        <div class="skpoptitle">Template colours</div>
        <div class="skswatches">${swatches.map(c => `<button type="button" class="sksw" data-c="${c}" title="${c}" style="background:${c}"></button>`).join('')}</div>
        <label class="skcustom2">Any colour <input type="color" id="skPick" value="#62B7E4"></label></div></div>
    <div class="skrow"><label>Text size <select id="skSize"><option value="">keep</option><option>22</option><option>24</option><option>28</option><option>32</option><option>40</option></select></label>
      <button type="button" id="skBold">Bold on / off</button></div>
    <div class="sksub">Replace the selected icon</div>
    <div class="skrow"><input type="text" id="skIconDesc" placeholder="Describe it: car with sensors, handshake, rocket…" style="flex:1;min-width:0">
      <select id="skIconStyle" aria-label="Icon style"><option value="flat">Flat</option><option value="3d">3D</option><option value="3dpic">3D picture</option></select>
      <button type="button" id="skIconGo" class="skgo">Design icon</button></div>
    <div id="skIconPicks" class="aiIconLib"></div>
    <div id="skNote" class="small"></div>`;
  pane.insertBefore(box, pane.querySelector('#stEditForm'));
  const note = (t, err) => { const n = document.getElementById('skNote'); n.textContent = t; n.style.color = err ? 'var(--err)' : ''; };
  box.querySelectorAll('.sktgt').forEach(b => b.addEventListener('click', () => {
    SK.target = b.dataset.t;
    box.querySelectorAll('.sktgt').forEach(x => { x.classList.toggle('sel', x === b); x.setAttribute('aria-checked', x === b); });
  }));
  document.getElementById('skIconStyle').addEventListener('change', e => { SK.style = e.target.value; });

  /* the selected shapes, groups opened to their parts: [{ s, depth }] */
  async function selection(context) {
    const sel = context.presentation.getSelectedShapes();
    sel.load('items/id,items/type,items/left,items/top,items/width,items/height');
    await context.sync();
    if (!sel.items.length) throw new Error('Select a visual, an icon or a text on the slide first.');
    const leaves = [];
    const open = async (s, d) => {
      if (s.type === 'Group' && d < 4) {
        try { const cs = s.group.shapes; cs.load('items/id,items/type'); await context.sync(); for (const c of cs.items) await open(c, d + 1); return; } catch (e) { /* read as one shape */ }
      }
      leaves.push(s);
    };
    for (const s of sel.items) await open(s, 0);
    return { top: sel.items, leaves };
  }
  async function run(what, fn) {
    if (SK.busy) return;
    if (!state.inOffice) { note('Open this panel in PowerPoint to style the slide.', true); return; }
    SK.busy = true;
    try { await PowerPoint.run(fn); note(what + ' Ctrl+Z in PowerPoint undoes it.'); }
    catch (e) { note(errText(e), true); }
    finally { SK.busy = false; }
  }
  const isWhite = c => /^#?F{6}$/i.test(String(c || '').trim()) || String(c || '').toLowerCase() === 'white';
  async function colour(c) {
    const T = SK.target;
    await run(`${({ fill: 'Fill', text: 'Text colour', line: 'Outline', icon: 'Icon colour' })[T]} set to ${c}.`, async context => {
      const { leaves } = await selection(context);
      if (T === 'icon') {
        // the icon's coloured parts take the colour; its white details stay white
        const fills = leaves.map(s => { try { s.fill.load('foregroundColor,type'); return s; } catch (e) { return null; } });
        await context.sync();
        fills.forEach(s => { if (s && s.fill.type !== 'NoFill' && !isWhite(s.fill.foregroundColor)) s.fill.setSolidColor(c); });
        leaves.forEach(s => { try { s.lineFormat.load('visible'); } catch (e) { /* no line */ } });
        await context.sync();
        leaves.forEach(s => { try { if (s.lineFormat.visible) s.lineFormat.color = c; } catch (e) { /* no line */ } });
      } else leaves.forEach(s => {
        try {
          if (T === 'fill') s.fill.setSolidColor(c);
          else if (T === 'line') { s.lineFormat.visible = true; s.lineFormat.color = c; }
          else s.textFrame.textRange.font.color = c;
        } catch (e) { /* this part has no fill / text */ }
      });
      await context.sync();
    });
  }
  // 10.24: one colour button; its pop-up holds every template colour and any other colour
  const pop = document.getElementById('skPop'), cbtn = document.getElementById('skColourBtn');
  const openPop = on => { pop.hidden = !on; cbtn.setAttribute('aria-expanded', on); };
  const choose = c => { SK.colour = c; document.getElementById('skDot').style.background = c; openPop(false); colour(c); };
  cbtn.addEventListener('click', e => { e.stopPropagation(); openPop(pop.hidden); });
  document.addEventListener('click', e => { if (!pop.hidden && !pop.contains(e.target)) openPop(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') openPop(false); });
  box.querySelectorAll('.sksw').forEach(b => b.addEventListener('click', () => choose(b.dataset.c)));
  document.getElementById('skPick').addEventListener('change', e => choose(e.target.value.toUpperCase()));
  document.getElementById('skReapply').addEventListener('click', () => colour(SK.colour || TEMPLATE.accents[0]));
  document.getElementById('skSize').addEventListener('change', e => {
    const v = +e.target.value; if (!v) return;
    run(`Text set to ${v} pt.`, async context => { const { leaves } = await selection(context); leaves.forEach(s => { try { s.textFrame.textRange.font.size = v; } catch (er) { /* no text */ } }); await context.sync(); });
  });
  document.getElementById('skBold').addEventListener('click', () => run('Bold switched.', async context => {
    const { leaves } = await selection(context);
    const f = leaves.map(s => { try { const x = s.textFrame.textRange.font; x.load('bold'); return x; } catch (e) { return null; } });
    await context.sync();
    const on = !f.some(x => x && x.bold);
    f.forEach(x => { if (x) x.bold = on; });
    await context.sync();
  }));

  /* ---------- replace the selected icon ---------- */
  const thumbOf = key => { try { return toSVG(comp(key, 2, 2, 36, SK.colour || TEMPLATE.accents[0]), 40, 40); } catch (e) { return ''; } };
  async function replaceIcon(key, label) {
    await run(`Icon replaced by “${label}”.`, async context => {
      const { top } = await selection(context);
      const x = Math.min(...top.map(s => s.left)), y = Math.min(...top.map(s => s.top)), r = Math.max(...top.map(s => s.left + s.width)), b = Math.max(...top.map(s => s.top + s.height));
      const D = Math.max(Math.min(r - x, b - y), 56), c = SK.colour || TEMPLATE.accents[0];   // never smaller than a readable icon
      const slides = context.presentation.getSelectedSlides(); slides.load('items/id'); await context.sync();
      const slide = slides.items[0];
      const prims = comp(key, (x + r) / 2 - D / 2, (y + b) / 2 - D / 2, D, c);
      await drawOnSlide(context, slide, prims, label, null);
      top.forEach(s => s.delete());
      await context.sync();
    });
  }
  /* 10.25: 3D picture icons (3dicons v1, CC0): rendered 3D objects inserted as pictures (not recolourable shapes) */
  let IDX3 = null;
  const SYN3 = { money: 'dollar wallet money-bag money card', finance: 'dollar money chart wallet', cost: 'dollar money', idea: 'bulb', innovation: 'bulb rocket', goal: 'target flag',
    target: 'target', success: 'trophy medal star', award: 'trophy medal', security: 'lock sheild key locker', secure: 'lock sheild', privacy: 'lock sheild', time: 'clock calender',
    schedule: 'calender clock', deadline: 'clock calender', chat: 'chat chat-bubble chat-text', communication: 'chat mail megaphone phone-only', email: 'mail', message: 'chat mail',
    marketing: 'megaphone chart', announce: 'megaphone', settings: 'setting tool', tool: 'tool setting', growth: 'chart rocket', launch: 'rocket', speed: 'rocket flash', data: 'chart file folder',
    analytics: 'chart zoom', report: 'file-text chart', search: 'zoom', find: 'zoom', learning: 'notebook bulb lab', study: 'notebook', education: 'notebook bulb', science: 'lab', research: 'lab zoom',
    team: 'boy girl', people: 'boy girl', user: 'boy girl', customer: 'boy girl', location: 'map-pin location', place: 'map-pin', travel: 'travel map-pin', video: 'video-camera play', music: 'music headphone',
    phone: 'phone-only mobile', mobile: 'mobile', computer: 'computer', laptop: 'computer', network: 'wifi link', internet: 'wifi', file: 'file file-text', document: 'file-text notebook',
    storage: 'folder', health: 'heart gym', fitness: 'gym', love: 'heart', shopping: 'bag', ecommerce: 'bag card', payment: 'card wallet', design: 'paint-brush color-palette brush',
    creative: 'paint-kit color-palette', strategy: 'chess target puzzle', problem: 'puzzle', solution: 'puzzle bulb', energy: 'flash battery', power: 'flash battery', approval: 'tick thumb-up',
    done: 'tick', like: 'thumb-up heart', notification: 'notify-heart megaphone', photo: 'picture camera', image: 'picture', write: 'pencil notebook', edit: 'pencil', delete: 'trash-can',
    weather: 'sun umbrella moon', risk: 'umbrella sheild', protection: 'umbrella sheild', coffee: 'tea-cup takeaway-cup cup' };
  // 10.26: two sets - 3dicons (CC0, 115) and Microsoft Fluent Emoji 3D (MIT, 759 objects, places, symbols, nature)
  const SETS3 = [['3dicons', '3dicons · CC0'], ['fluent3d', 'Fluent 3D · MIT']];
  async function index3d() {
    if (!IDX3) {
      IDX3 = [];
      for (const [dir, src] of SETS3) { try { (await (await fetch(`/assets/${dir}/index.json`, { cache: 'force-cache' })).json()).forEach(it => IDX3.push(Object.assign({ dir, src }, it))); } catch (e) { /* that set is not installed */ } }
    }
    return IDX3;
  }
  async function find3d(desc, n) {
    const L = await index3d(), words = String(desc).toLowerCase().match(/[a-z]+/g) || [];
    const want = new Set(words.flatMap(w => [w, w.replace(/s$/, '')].concat((SYN3[w] || SYN3[w.replace(/s$/, '')] || '').split(' ')).filter(Boolean)));
    const sc = it => { const s = (it.slug + ' ' + it.name).toLowerCase().split(/[^a-z]+/), k = String(it.kw || '').split(/[^a-z]+/); let v = 0;
      want.forEach(w => { if (it.slug === w) v += 5; else if (s.includes(w)) v += 3; else if (k.includes(w)) v += 1; }); return v; };
    return L.map(it => [it, sc(it)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, n).map(x => x[0]);
  }
  const pick3d = it => `<button type="button" class="iconPick pic3d" data-slug="${esc2(it.dir + '/' + it.slug)}" data-name="${esc2(it.name)}" title="${esc2(it.name)} (3D picture, ${esc2(it.src)})"><img src="/assets/${esc2(it.dir)}/${esc2(it.slug)}.png" alt="" width="36" height="36" loading="lazy"><span>${esc2(it.name)}</span></button>`;
  const b64of = async url => { const blob = await (await fetch(url)).blob(); return await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); }); };
  async function replacePicture(slug, label) {
    await run(`Icon replaced by the 3D picture “${label}”.`, async context => {
      const { top } = await selection(context);
      const x = Math.min(...top.map(s => s.left)), y = Math.min(...top.map(s => s.top)), r = Math.max(...top.map(s => s.left + s.width)), b = Math.max(...top.map(s => s.top + s.height));
      const D = Math.max(Math.min(r - x, b - y), 56), box = { left: (x + r) / 2 - D / 2, top: (y + b) / 2 - D / 2 };
      const data = await b64of(`/assets/${/\//.test(slug) ? slug : '3dicons/' + slug}.png`);
      top.forEach(s => s.delete());
      await context.sync();
      await new Promise((res, rej) => Office.context.document.setSelectedDataAsync(data, { coercionType: Office.CoercionType.Image, imageLeft: box.left, imageTop: box.top, imageWidth: D, imageHeight: D },
        a => a.status === Office.AsyncResultStatus.Succeeded ? res() : rej(new Error((a.error && a.error.message) || 'the picture could not be inserted'))));
    });
  }
  const wire3d = picks => picks.querySelectorAll('.pic3d').forEach(b => { b.onclick = () => replacePicture(b.dataset.slug, b.dataset.name); });
  document.getElementById('skIconGo').addEventListener('click', async () => {
    const desc = document.getElementById('skIconDesc').value.trim(), picks = document.getElementById('skIconPicks');
    if (SK.style === '3dpic') {
      const got = desc ? await find3d(desc, 18) : (await index3d()).slice(0, 30);
      picks.innerHTML = got.length ? '<div class="iconSrc">3D picture icons <span class="badge src builtin">3dicons · Fluent 3D</span></div>' + got.map(pick3d).join('') : '';
      wire3d(picks);
      note(got.length ? 'Select the icon to replace on the slide, then click a 3D picture. It is a picture: resize it freely; its colours stay as drawn.' : 'No 3D picture matches; try another word (money, goal, team, idea, security).', !got.length);
      return;
    }
    if (!desc) { note('Describe the icon first.', true); return; }
    const seen = new Set(), found = conceptScores(desc, '').filter(x => CMP[x.key] && !seen.has(x.key) && seen.add(x.key)).slice(0, 5);
    const pick = (key, name) => `<button type="button" class="iconPick" data-key="${esc2(key)}" data-name="${esc2(name)}" title="${esc2(name)}">${thumbOf(key)}<span>${esc2(name)}</span></button>`;
    picks.innerHTML = (found.length ? '<div class="iconSrc">Library <span class="badge src builtin">Built-in</span></div>' + found.map(x => pick(x.key, x.name)).join('') : '');
    const wire = () => { picks.querySelectorAll('.iconPick:not(.pic3d)').forEach(b => { b.onclick = () => replaceIcon(b.dataset.key, b.dataset.name); }); wire3d(picks); };
    const p3 = await find3d(desc, 6);
    if (p3.length) picks.insertAdjacentHTML('beforeend', '<div class="iconSrc">3D pictures <span class="badge src builtin">3dicons · Fluent 3D</span></div>' + p3.map(pick3d).join(''));
    wire();
    note(`Asking Claude for a ${SK.style === '3d' ? '3D' : 'flat'} “${desc}” icon…`);
    try {
      const res = await api('/api/claude/icon', { description: desc, style: SK.style }, 90000);
      if (!res || !res.ok || !res.icon) { note(((res && res.error) || 'Claude could not design it.') + (found.length ? ' Pick a library icon above.' : ''), !found.length); return; }
      const key = registerCustomIcon(res.icon); saveCustomIcon(key, res.icon);
      picks.insertAdjacentHTML('beforeend', `<div class="iconSrc">${res.source === 'claude' ? 'Designed by Claude' : 'Ready-made'} <span class="badge src ${res.source === 'claude' ? 'claude' : 'builtin'}">${res.source === 'claude' ? 'Claude' : 'Ready-made'}</span></div>` + pick(key, res.icon.label || desc));
      wire();
      note(`${res.source === 'claude' ? 'Claude designed it' : 'A ready-made drawing'}: select the icon to replace on the slide, then click the new one.`);
    } catch (e) { note('Claude: ' + errText(e) + (found.length ? ' Pick a library icon above.' : ''), !found.length); }
  });
})();
