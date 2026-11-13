/* AI Visual Builder 10.20 - SL Smart Design bridge (one ribbon, two design tools).
   The add-in runs in a shared runtime (manifest-v10.xml <Runtimes>): this page keeps running while the task pane is
   hidden, so the AI Visual Builder button on the SL Smart Design tab (a VBA add-in, sl-smart-design/SLSD_AIVisualBuilder.bas)
   can open it with Office's own API instead of pressing buttons:
     VBA button -> POST /api/bridge/open {view, doc}  (the local service, server.py)
     this page  -> GET /api/bridge/next?doc=<this presentation>  -> Office.addin.showAsTaskpane(), the view
                -> POST /api/bridge/ack {id}            (the VBA button sees it worked)
   Each presentation's runtime takes only requests for its own presentation. The ribbon's "Several slides" and "Edit a
   visual" are functions of the same runtime (Office.actions.associate). Outside PowerPoint (tests, preview) it does
   nothing. */
(function () {
  if (typeof Office === 'undefined') return;
  const BRIDGE = { doc: '', on: false, last: '', errors: 0 };
  window.__bridge = BRIDGE;
  async function show(view) {
    try { if (Office.addin && typeof Office.addin.showAsTaskpane === 'function') await Office.addin.showAsTaskpane(); }
    catch (e) { console.warn('showAsTaskpane failed', e); }
    if (view === 'slides' || view === 'edit') { if (typeof appStudio === 'function') appStudio(view); }
    else { const st = document.getElementById('stPanel'); if (st) st.classList.remove('open'); const c = document.getElementById('content'); if (c) c.focus(); }
    BRIDGE.last = view;
  }
  const H = { 'X-AIVB-Client': '1' };
  async function poll() {
    if (!BRIDGE.on) return;
    try {
      const r = await fetch('/api/bridge/next?doc=' + encodeURIComponent(BRIDGE.doc), { headers: H, cache: 'no-store' });
      if (r.ok) {
        const j = await r.json();
        if (j && j.id) {
          await show(j.view);
          await fetch('/api/bridge/ack', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, H), body: JSON.stringify({ id: j.id }) });
        }
      }
      BRIDGE.errors = 0;
    } catch (e) { BRIDGE.errors++; }
    setTimeout(poll, BRIDGE.errors > 5 ? 5000 : 1000);   // the local service restarting: retry calmly
  }
  Office.onReady(info => {
    if (info.host !== Office.HostType.PowerPoint) return;
    try { BRIDGE.doc = String((Office.context.document && Office.context.document.url) || ''); } catch (e) { BRIDGE.doc = ''; }
    if (Office.actions && typeof Office.actions.associate === 'function') {
      const fn = view => event => { show(view).finally(() => { try { event.completed(); } catch (e) { /* not a command event */ } }); };
      Office.actions.associate('aivbOpenGenerate', fn('generate'));
      Office.actions.associate('aivbOpenSlides', fn('slides'));
      Office.actions.associate('aivbOpenEdit', fn('edit'));
    }
    BRIDGE.on = true;
    poll();
  });
})();
