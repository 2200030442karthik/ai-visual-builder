"""V10.12.2 acceptance run: starts a test panel host (plain HTTP, port 44398, test files enabled), opens tests/harness.html
in ONE headless Edge, waits for the harness to finish and prints a summary; then the V10.12 studio tests
(tests/studio.html: more designs, edits, several slides) in the same Edge, with a screenshot of their previews
(tests/evidence/v10.12-studio.png). Lightweight on purpose: no AI models, no
GPU, one small Edge profile kept in local-ai/tests/.edge-profile (on this drive, reused, not a temp folder); only the
processes this script started are stopped.

The test panel host gets its own access policy (AIVB_ACCESS: this Windows account authorized, the Content Slide
template), so the gate is exercised exactly as in use; the file is removed afterwards.

Then runs tests/test_server.py (server brand, access and text checks, no network).

Usage:  python tests/run_tests.py [OUT_JSON]
"""
import getpass
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from edge_cdp import CDP, EDGE  # noqa: E402

PORT, DBG = 44398, 9338
PROFILE = os.path.join(HERE, '.edge-profile')


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    out_json = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'last-run.json')
    log = open(os.path.join(HERE, '.edge-profile-server.log'), 'w')
    policy = os.path.join(HERE, '.access-test.json')
    with open(policy, 'w', encoding='utf-8') as f:
        json.dump({'mode': 'windows', 'allowed_users': [getpass.getuser()]}, f)     # the template: access.py's default (LVC_Template.pptx)
    srv = subprocess.Popen([sys.executable, '-u', os.path.join(HERE, '..', 'server.py'), '--http', '--test', '--port', str(PORT)], stdout=log, stderr=log,
                           env=dict(os.environ, AIVB_ACCESS=policy))
    edge = None
    try:
        time.sleep(1)
        try:    # a headless Edge left over from an interrupted run would answer instead of this run's harness
            urllib.request.urlopen(f'http://127.0.0.1:{DBG}/json', timeout=2)
            raise SystemExit(f'Port {DBG} is already in use (an Edge from an earlier run?); stop it and run again.')
        except OSError:
            pass
        edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions', f'--remote-debugging-port={DBG}',
                                 f'--user-data-dir={PROFILE}', '--window-size=900,1200', f'http://localhost:{PORT}/tests/harness.html'],
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        page = None
        for _ in range(60):
            try:
                page = next(t for t in json.load(urllib.request.urlopen(f'http://127.0.0.1:{DBG}/json')) if t['type'] == 'page')
                break
            except Exception:
                time.sleep(0.5)
        cdp = CDP(page['webSocketDebuggerUrl'])
        t0 = time.time()
        while time.time() - t0 < 120:
            txt = cdp.js("document.getElementById('out') ? document.getElementById('out').textContent : 'loading'")
            if txt and txt not in ('running', 'loading'):
                break
            time.sleep(1)
        if txt in ('running', 'loading'):
            print('Harness did not finish; it was at:', cdp.js('document.title'))
        res = json.loads(txt)
        with open(out_json, 'w', encoding='utf-8') as f:
            json.dump(res, f, indent=1, ensure_ascii=False)
        report(res, time.time() - t0)
        acceptance_page(cdp, 'studio.html', 'V10.12', 'last-run-studio.json', 'v10.12-studio.png')
        acceptance_page(cdp, 'original.html', 'V10.12.1', 'last-run-original.json', 'v10.12.1-original.png')
        acceptance_page(cdp, 'faithful.html', 'V10.12.2', 'last-run-faithful.json', 'v10.12.2-faithful.png')
    finally:
        subprocess.run([sys.executable, os.path.join(HERE, 'test_server.py')])
        subprocess.run([sys.executable, os.path.join(HERE, 'test_claude.py')])
        if edge:    # Edge hands over to helper processes: stop every Edge process using this run's own profile folder
            ps = f"Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | Where-Object {{ $_.CommandLine -like '*{PROFILE}*' }} | ForEach-Object {{ Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }}"
            subprocess.run(['powershell', '-NoProfile', '-Command', ps], capture_output=True)
        for p in (edge, srv):
            if p:
                p.terminate()
                try:
                    p.wait(10)
                except subprocess.TimeoutExpired:
                    p.kill()
        time.sleep(1)                                   # Edge's helper processes release the profile
        os.remove(policy) if os.path.exists(policy) else None
        shutil.rmtree(PROFILE, ignore_errors=True)      # about 40 MB, rebuilt on every run


def acceptance_page(cdp, name, label, out_json, png):
    """An acceptance page in the same Edge (V10.12 tests/studio.html, V10.12.1 tests/original.html); its previews saved
    as tests/evidence/<png>."""
    cdp.js(f"location.href = 'http://localhost:{PORT}/tests/{name}'")
    time.sleep(1)
    t0, txt = time.time(), 'loading'
    while time.time() - t0 < 400:
        try:
            txt = cdp.js("document.getElementById('out') ? document.getElementById('out').textContent : 'loading'")
        except Exception:
            txt = 'loading'
        if txt and txt not in ('running', 'loading'):
            break
        time.sleep(1)
    if txt in ('running', 'loading'):
        print(f'{name} did not finish; it was at:', cdp.js('document.title'))
        return
    res = json.loads(txt)
    with open(os.path.join(HERE, out_json), 'w', encoding='utf-8') as f:
        json.dump(res, f, indent=1, ensure_ascii=False)
    if 'fatal' in res:
        print(f'{name} FATAL', res['fatal'], res.get('errors'))
        return
    try:
        cdp.js("document.getElementById('f').style.display = 'none'; document.getElementById('out').style.display = 'none'; 1")
        h = cdp.js("document.getElementById('evidence').getBoundingClientRect().bottom")
        shot = cdp.call('Page.captureScreenshot', format='png', captureBeyondViewport=True, clip={'x': 0, 'y': 0, 'width': 1260, 'height': h + 10, 'scale': 1})
        import base64
        os.makedirs(os.path.join(HERE, 'evidence'), exist_ok=True)
        with open(os.path.join(HERE, 'evidence', png), 'wb') as f:
            f.write(base64.b64decode(shot['data']))
        print(f'{name} previews: tests/evidence/{png}')
    except Exception as e:
        print(f'{name} screenshot not taken:', e)
    acc = res.get('acceptance', [])
    print(f"{label} acceptance: {sum(a['ok'] for a in acc)} of {len(acc)} passed")
    for a in acc:
        print(f"  {'PASS' if a['ok'] else 'FAIL'}  {a['name']}  | {a['evidence'][:300]}")


def report(res, secs):
    if 'fatal' in res:
        print('FATAL', res['fatal'], res.get('errors'))
        return
    p = res['panel']
    print(f"Harness finished in {secs:.0f} s. Panel: 'Try an example' UI present: {p['examplesUI']}; AI/picture controls left: {p['aiUI'] or 'none'}")
    print(f"Script errors in the panel: {res['errors'] or 'none'}")
    print(f"Napkin section: {p.get('napkin')}")
    print(f"{'case':<22}{'n':>3} {'mode':<6}{'A':>4}{'B':>4}{'C':>4}  inserted   ms   notes")
    for c in res['cases']:
        if c.get('error'):
            print(f"{c['id']:<22} ERROR {c['error'][:300]}")
            continue
        ins = c['inserts']
        notes = []
        if c.get('missing'): notes.append('MISSING ' + '; '.join(c['missing'])[:200])
        if c.get('tokensMissing'): notes.append('tokens missing ' + str(c['tokensMissing']))
        if c.get('dataMissing'): notes.append('data missing ' + str(c['dataMissing']))
        if c.get('nOK') is False: notes.append(f"expected another point count")
        if ins['failed']: notes.append('INSERT FAILED ' + ' | '.join(ins['failed'])[:300])
        if ins['skippedShapes']: notes.append(f"{ins['skippedShapes']} decorative shapes refused")
        if ins.get('fontBad'): notes.append(f"{ins['fontBad']} texts not in Open Sans")
        if c.get('brand'): notes.append('OFF-BRAND ' + json.dumps(c['brand'])[:200])
        if 'rejectOK' in c: notes.append('rejected as meaningless: ' + ('OK' if c['rejectOK'] else 'NO - ' + c.get('message', '')[:80]))
        if 'relationOK' in c: notes.append(f"relation {c['relation']} " + ('OK' if c['relationOK'] else 'WRONG'))
        if 'countOK' in c and not c['countOK']: notes.append('suggestion count outside the expected range')
        if 'unorderedOK' in c: notes.append('categories, no process: ' + ('OK' if c['unorderedOK'] else 'NO ' + str(c.get('labels'))))
        if 'iconsOK' in c: notes.append('distinct accurate icons: ' + ('OK' if c['iconsOK'] else 'NO ' + str(c.get('icons'))))
        print(f"{c['id']:<22}{str(c.get('n')):>3} {str(c.get('mode')):<6}{c['A']:>4}{c['B']:>4}{c['C']:>4}  {ins['ok']:>3}/{c['A'] + c['B'] + c['C']:<4} {c['ms']:>6} {'; '.join(notes)}")
    q = res.get('quality', {})
    print(f"content quality: valid rejected {q.get('validRejected') or 'none'}; nonsense accepted {q.get('invalidAccepted') or 'none'}")
    print('svg conversion:', json.dumps(res.get('svg'), ensure_ascii=False)[:900])
    print('continuation slides:', json.dumps(res.get('continuation'), ensure_ascii=False))
    print('access gate:', json.dumps(res.get('gate'), ensure_ascii=False)[:1500])
    print('napkin options:', res.get('napkinOptions'), '| brand selector controls:', res.get('napkinBrandUI'))
    for v in res.get('napkin', []):
        print('napkin:', json.dumps({k: x for k, x in v.items() if k != 'composite'}, ensure_ascii=False)[:900])
    for f in res['faults']:
        print('fault:', json.dumps(f, ensure_ascii=False))
    acc = res.get('acceptance', [])
    print()
    for x in res.get('diversity', []):
        print(f"layouts for {x['name']} ({x['points']} points{', record' if x.get('record') else ''}{', point names' if x.get('names') else ''}): {x['families']} - {', '.join(x['layouts'])}; not offered: {'; '.join(x['skipped'])[:200]}")
    for p in res.get('diversityPairs', []):
        print(f"diversity: {p['a']} / {p['b']}: similarity {p['sim']}")
    print(f"V10.11 acceptance (+ Z of V10.12): {sum(a['ok'] for a in acc)} of {len(acc)} passed")
    for a in acc:
        print(f"  {'PASS' if a['ok'] else 'FAIL'}  {a['name']}  | {a['evidence'][:220]}")


if __name__ == '__main__':
    main()
