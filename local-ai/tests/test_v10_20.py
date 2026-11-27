"""V10.20 checks (no network beyond localhost, no keys, no PowerPoint):
- SL Smart Design bridge (server.py /api/bridge/*): a request is taken only by the runtime of the presentation it names
  (an unsaved one by a runtime without a path), once; acknowledged; expires; only open-a-view; the API headers required
- Regression (V10.19 installer defect): no script may recreate the Office add-in registry key with -Force (that wiped
  every other sideloaded add-in)."""
import json, os, re, subprocess, sys, time, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
PORT = 44394
fails = []


def req(method, path, body=None, headers=True):
    h = {'X-AIVB-Client': '1', 'Content-Type': 'application/json'} if headers else {'Content-Type': 'application/json'}
    r = urllib.request.Request(f'http://localhost:{PORT}{path}', data=json.dumps(body).encode() if body is not None else None, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=5) as x:
            return x.status, json.loads(x.read() or b'{}')
    except urllib.error.HTTPError as e:
        return e.code, {}


srv = subprocess.Popen([sys.executable, os.path.join(HERE, '..', 'server.py'), '--http', '--test', '--port', str(PORT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    time.sleep(1.5)
    doc = r'C:\Users\Someone\Documents\LVC deck.pptx'
    s, o = req('POST', '/api/bridge/open', {'view': 'slides', 'doc': doc})
    if s != 200 or len(o.get('id', '')) != 16: fails.append(f'open: {s} {o}')
    rid = o.get('id')
    if req('GET', '/api/bridge/next?doc=' + urllib.parse.quote('C:/Other/deck.pptx'))[1]: fails.append('another presentation took the request')
    if req('GET', '/api/bridge/next?doc=')[1]: fails.append('an unsaved presentation took a saved one\'s request')
    if req('GET', f'/api/bridge/status?id={rid}')[1].get('taken'): fails.append('taken too early')
    s, n = req('GET', '/api/bridge/next?doc=' + urllib.parse.quote('c:/users/someone/documents/LVC%20deck.pptx'))
    if n.get('id') != rid or n.get('view') != 'slides': fails.append(f'its presentation did not take it (path forms differ): {n}')
    if req('GET', '/api/bridge/next?doc=' + urllib.parse.quote(doc))[1]: fails.append('taken twice')
    if req('POST', '/api/bridge/ack', {'id': rid})[1].get('ok') is not True: fails.append('ack refused')
    st = req('GET', f'/api/bridge/status?id={rid}')[1]
    if not (st.get('acked') and st.get('taken')): fails.append(f'status after ack: {st}')
    # an unsaved presentation ("Presentation1": no path) is served by a runtime without a path
    rid2 = req('POST', '/api/bridge/open', {'view': 'generate', 'doc': 'Presentation1'})[1].get('id')
    if req('GET', '/api/bridge/next?doc=')[1].get('id') != rid2: fails.append('unsaved presentation not matched')
    # only open-a-view; headers required
    if req('POST', '/api/bridge/open', {'view': 'delete'})[0] != 400: fails.append('an unknown view was accepted')
    if req('POST', '/api/bridge/open', {'view': 'generate'}, headers=False)[0] != 403: fails.append('accepted without the API header')
    # expiry (20 s): a request left unanswered is not taken later
    import importlib
    sys.path.insert(0, os.path.join(HERE, '..'))
finally:
    srv.terminate()

# expiry, in-process (no 20 s wait)
sys.argv = [sys.argv[0], '--test']
sys.path.insert(0, os.path.join(HERE, '..'))
os.environ['AIVB_DATA_DIR'] = os.path.join(os.environ.get('TEMP', '.'), 'aivb-test-v1020')
import server as S  # noqa: E402
r = S.bridge_open({'view': 'edit', 'doc': 'C:/a.pptx'}); S.BRIDGE['req']['at'] -= 30
if S.bridge_next('C:/a.pptx'): fails.append('an expired request was taken')

# regression: the add-in registry key is never recreated with -Force
bad = []
for d, _, files in os.walk(ROOT):
    if any(x in d for x in ('.git', 'Manager_Pilot_Package', 'node_modules')): continue
    for f in files:
        if f.endswith('.ps1'):
            t = open(os.path.join(d, f), encoding='utf-8', errors='replace').read()
            for m in re.finditer(r'New-Item\s+-Path\s+(\$\w+|["\']?HKCU:[^\s|]*)[^\n|;]*-Force', t):
                line = t[t.rfind('\n', 0, m.start()) + 1: t.find('\n', m.end())]
                if re.search(r'WEF|\$WefKey|\$Key\b', line) and 'Test-Path' not in line:
                    bad.append(f'{os.path.relpath(os.path.join(d, f), ROOT)}: {line.strip()[:90]}')
if bad: fails.append('registry key recreated with -Force (wipes other add-ins): ' + '; '.join(bad))

print('v10.20 (bridge, registry): ' + ('ALL PASSED' if not fails else 'FAILED\n  ' + '\n  '.join(fails)))
sys.exit(1 if fails else 0)
