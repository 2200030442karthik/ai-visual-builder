/* AI Visual Builder 10.22 - activation gate inside the panel (team installations).
   The panel page is also the SL Smart Design tab's function file (one shared runtime, manifest-slsd.xml), so the page
   always loads and SL Smart Design's own commands (its own licence) keep working. Until this Windows user on this PC is
   activated, the panel shows only the activation form over everything, and the panel host refuses every AI request
   (server.py ACT_FREE). Development and hosted hosts answer {required: false}: nothing is shown. */
(function () {
  'use strict';
  const H = { 'X-AIVB-Client': '1' };
  const css = `#aivbGate{position:fixed;inset:0;z-index:2147483000;background:#fff;overflow:auto;padding:20px 16px;
    font:14px/1.45 "Segoe UI",Arial,sans-serif;color:#2b2f36}
    #aivbGate h1{font-size:18px;margin:0 0 6px}#aivbGate p{margin:0 0 14px;color:#5c6670}
    #aivbGate label{display:block;font-weight:600;margin-bottom:6px}
    #aivbGate input{width:100%;box-sizing:border-box;padding:9px 10px;font:15px/1.2 Consolas,"Segoe UI",monospace;text-transform:uppercase;
      border:1px solid #d8dde6;border-radius:6px}
    #aivbGate input:focus{outline:2px solid #3645A9;outline-offset:1px}
    #aivbGate button{margin-top:12px;width:100%;padding:10px;font:600 14px "Segoe UI",Arial;color:#fff;background:#3645A9;border:0;border-radius:6px;cursor:pointer}
    #aivbGate button:disabled{opacity:.6}#aivbGate .m{margin-top:12px;min-height:20px}#aivbGate .bad{color:#b3261e}#aivbGate .ok{color:#1e7b3a}
    #aivbGate .s{font-size:12px;margin-top:18px}`;

  function show(state) {
    if (document.getElementById('aivbGate')) return;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const g = document.createElement('div'); g.id = 'aivbGate'; g.setAttribute('role', 'dialog'); g.setAttribute('aria-modal', 'true');
    g.innerHTML = '<h1>Activate SL Editor</h1><p>Enter the activation key your manager gave you. You only do this once on this PC.</p>' +
      '<form autocomplete="off"><label for="aivbKey">Activation key</label>' +
      '<input id="aivbKey" placeholder="AIVB-XXXXX-XXXXX-XXXXX-XXXXX" spellcheck="false" maxlength="40" required>' +
      '<button type="submit">Activate</button></form><div class="m" role="status" aria-live="polite"></div>' +
      '<p class="s">No key? Ask your manager. The SL Smart Design, SL Design and SL Animation commands work without it.</p>';
    document.body.appendChild(g);
    const msg = g.querySelector('.m'), btn = g.querySelector('button'), inp = g.querySelector('input');
    const say = (t, c) => { msg.textContent = t; msg.className = 'm ' + (c || ''); };
    if (state && state.reason && state.reason !== 'not-activated') say(state.message, 'bad');
    g.querySelector('form').addEventListener('submit', async e => {
      e.preventDefault();
      const key = inp.value.trim(); if (!key) return;
      btn.disabled = true; say('Checking the key…');
      try {
        const r = await fetch('/api/activate', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, H), body: JSON.stringify({ key }) });
        const j = await r.json();
        if (j.ok) { say('Activated' + (j.label ? ' for ' + j.label : '') + (j.expires ? ', valid until ' + j.expires : '') + '.', 'ok'); setTimeout(() => location.reload(), 800); }
        else { say(j.message || j.error || 'The key was not accepted.', 'bad'); btn.disabled = false; inp.select(); }
      } catch (err) { say('SL Editor is not running on this PC. Restart the PC (or run its service from the Start menu) and try again.', 'bad'); btn.disabled = false; }
    });
    setTimeout(() => inp.focus(), 50);
  }

  async function check() {
    try {
      const r = await fetch('/api/activation', { headers: H, cache: 'no-store' });
      if (!r.ok) return;
      const s = await r.json();
      if (s.required && !s.ok) show(s);
    } catch (e) { /* the panel's own "cannot reach the service" message covers this */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', check); else check();
  window.aivbGateCheck = check;
})();
