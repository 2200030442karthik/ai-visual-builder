"""Diagnosis run (no network, no credits): starts a test panel host, opens tests/diag.html in headless Edge with the
given sample texts and saved Napkin fixtures, writes the JSON and every preview as SVG into OUT_DIR.

Usage:  python tests/run_diag.py OUT_DIR "Sample name,Other sample" '[{"name":..,"text":..,"fmt":"svg","files":[..]}]'
"""
import getpass, json, os, subprocess, sys, time, urllib.parse, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from edge_cdp import CDP, EDGE  # noqa: E402

PORT, DBG = 44399, 9339
PROFILE = os.path.join(HERE, '.edge-profile-diag')


def run(out_dir, texts, napkin):
    os.makedirs(out_dir, exist_ok=True)
    policy = os.path.join(HERE, '.access-diag.json')
    with open(policy, 'w', encoding='utf-8') as f:
        json.dump({'mode': 'windows', 'allowed_users': [getpass.getuser()]}, f)
    srv = subprocess.Popen([sys.executable, '-u', os.path.join(HERE, '..', 'server.py'), '--http', '--test', '--port', str(PORT)],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env=dict(os.environ, AIVB_ACCESS=policy))
    edge = None
    try:
        time.sleep(1)
        q = urllib.parse.urlencode({'texts': texts, 'napkin': napkin})
        edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions', f'--remote-debugging-port={DBG}',
                                 f'--user-data-dir={PROFILE}', f'http://localhost:{PORT}/tests/diag.html?{q}'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        page = None
        for _ in range(60):
            try:
                page = next(t for t in json.load(urllib.request.urlopen(f'http://127.0.0.1:{DBG}/json')) if t['type'] == 'page')
                break
            except Exception:
                time.sleep(0.5)
        cdp = CDP(page['webSocketDebuggerUrl'])
        t0, txt = time.time(), 'running'
        while time.time() - t0 < 180:
            txt = cdp.js("document.getElementById('out') ? document.getElementById('out').textContent : 'running'")
            if txt and txt != 'running':
                break
            time.sleep(1)
        res = json.loads(txt)
        for g in res.get('gallery', []):
            for si, s in enumerate(g.get('sections', [])):
                for k, t in enumerate(s.pop('thumbs', []) or []):
                    with open(os.path.join(out_dir, f"g-{g['name'][:20]}-{si}-{k:02d}.svg".replace(' ', '_')), 'w', encoding='utf-8') as f:
                        f.write(t['svg'])
        for v in res.get('napkin', []):
            for it in v.get('items', []):
                with open(os.path.join(out_dir, f"n-{v['name'][:20]}-{it['n']}.svg".replace(' ', '_')), 'w', encoding='utf-8') as f:
                    f.write(it.pop('shot'))
        with open(os.path.join(out_dir, 'diag.json'), 'w', encoding='utf-8') as f:
            json.dump(res, f, indent=1, ensure_ascii=False)
        return res
    finally:
        ps = f"Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | Where-Object {{ $_.CommandLine -like '*{PROFILE}*' }} | ForEach-Object {{ Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }}"
        subprocess.run(['powershell', '-NoProfile', '-Command', ps], capture_output=True)
        for p in (edge, srv):
            if p:
                p.terminate()
        os.remove(policy) if os.path.exists(policy) else None


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    r = run(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else '', sys.argv[3] if len(sys.argv) > 3 else '[]')
    print(json.dumps(r, indent=1, ensure_ascii=False)[:20000])
