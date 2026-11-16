"""10.21 upgrade checks (tests/upgrade.html in headless Edge on a test panel host): text analysis, the vivid pack,
variety, icon paint order, generation time. No PowerPoint, no paid request (test hosts refuse them)."""
import json, os, shutil, subprocess, sys, time, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from edge_cdp import CDP, EDGE  # noqa: E402
PORT, DBG = 44396, 9341
PROFILE = os.path.join(HERE, '.edge-profile-upgrade')


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    srv = subprocess.Popen([sys.executable, os.path.join(HERE, '..', 'server.py'), '--http', '--test', '--port', str(PORT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    edge = None
    try:
        time.sleep(1.5)
        edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions', f'--remote-debugging-port={DBG}',
                                 f'--user-data-dir={PROFILE}', f'http://localhost:{PORT}/tests/upgrade.html'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        page = None
        for _ in range(60):
            try:
                page = next(t for t in json.load(urllib.request.urlopen(f'http://127.0.0.1:{DBG}/json')) if t['type'] == 'page'); break
            except Exception:
                time.sleep(0.5)
        cdp = CDP(page['webSocketDebuggerUrl'])
        txt = 'running'
        for _ in range(240):
            txt = cdp.js("document.getElementById('out') ? document.getElementById('out').textContent : 'running'")
            if txt and txt != 'running':
                break
            time.sleep(0.5)
        res = json.loads(txt) if txt != 'running' else {'acceptance': [{'name': 'page finished', 'ok': False, 'evidence': 'timed out'}]}
    finally:
        ps = f"Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | Where-Object {{ $_.CommandLine -like '*{PROFILE}*' }} | ForEach-Object {{ Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }}"
        subprocess.run(['powershell', '-NoProfile', '-Command', ps], capture_output=True)
        for p in (edge, srv):
            if p:
                p.terminate()
        time.sleep(1)
        shutil.rmtree(PROFILE, ignore_errors=True)
    acc = res['acceptance']
    for a in acc:
        print(f"  {'PASS' if a['ok'] else 'FAIL'}  {a['name']}" + ('' if a['ok'] and not a['name'].startswith(('design set', 'generation time')) else f"  | {a['evidence']}"))
    fails = [a for a in acc if not a['ok']]
    print(f"10.21 upgrade: {'ALL PASSED' if not fails else f'{len(fails)} FAILED'} ({len(acc) - len(fails)} of {len(acc)})")
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
