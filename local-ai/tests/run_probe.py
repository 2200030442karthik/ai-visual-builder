"""Evaluate code in the real panel (tests/probe.html, stand-in PowerPoint; no network, no credits) and print the result.
The code is a JavaScript expression or async function body run in the probe page: `W` is the panel's window, `SAMPLES`
the sample texts, `fixture(name)` a saved result's text. Previews returned as {svg: {name: svgText}} are written to OUT_DIR.

Usage:  python tests/run_probe.py CODE_FILE.js [OUT_DIR]
"""
import getpass, json, os, shutil, subprocess, sys, time, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from edge_cdp import CDP, EDGE  # noqa: E402

PORT, DBG = 44396, 9336
PROFILE = os.path.join(HERE, '.edge-profile-probe')


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    with open(sys.argv[1], encoding='utf-8') as f:
        code = f.read()
    out_dir = sys.argv[2] if len(sys.argv) > 2 else None
    policy = os.path.join(HERE, '.access-probe.json')
    with open(policy, 'w', encoding='utf-8') as f:
        json.dump({'mode': 'windows', 'allowed_users': [getpass.getuser()]}, f)
    srv = subprocess.Popen([sys.executable, '-u', os.path.join(HERE, '..', 'server.py'), '--http', '--test', '--port', str(PORT)],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env=dict(os.environ, AIVB_ACCESS=policy))
    edge = None
    try:
        time.sleep(1)
        edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions', f'--remote-debugging-port={DBG}',
                                 f'--user-data-dir={PROFILE}', f'http://localhost:{PORT}/tests/probe.html'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        page = None
        for _ in range(60):
            try:
                page = next(t for t in json.load(urllib.request.urlopen(f'http://127.0.0.1:{DBG}/json')) if t['type'] == 'page')
                break
            except Exception:
                time.sleep(0.5)
        cdp = CDP(page['webSocketDebuggerUrl'])
        for _ in range(120):
            st = cdp.js("document.getElementById('out') ? document.getElementById('out').textContent : 'loading'")
            if st != 'loading':
                break
            time.sleep(0.5)
        if st != 'ready':
            raise SystemExit('probe page: ' + str(st))
        txt = cdp.js('(async () => { try { const r = await (async () => {\n' + code + '\n})(); return JSON.stringify(r); } catch (e) { return JSON.stringify({ error: String(e && e.stack || e) }); } })()')
        res = json.loads(txt) if txt else None
        if out_dir and isinstance(res, dict) and isinstance(res.get('svg'), dict):
            os.makedirs(out_dir, exist_ok=True)
            for name, svg in res.pop('svg').items():
                with open(os.path.join(out_dir, name + '.svg'), 'w', encoding='utf-8') as f:
                    f.write(svg)
        print(json.dumps(res, indent=1, ensure_ascii=False)[:30000])
    finally:
        ps = f"Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | Where-Object {{ $_.CommandLine -like '*{PROFILE}*' }} | ForEach-Object {{ Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }}"
        subprocess.run(['powershell', '-NoProfile', '-Command', ps], capture_output=True)
        for p in (edge, srv):
            if p:
                p.terminate()
        os.remove(policy) if os.path.exists(policy) else None
        time.sleep(1)
        shutil.rmtree(PROFILE, ignore_errors=True)


if __name__ == '__main__':
    main()
