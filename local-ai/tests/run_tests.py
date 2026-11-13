"""V10.18 acceptance run: starts a test panel host (plain HTTP, port 44398, test files enabled), opens tests/harness.html
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
        acceptance_page(cdp, 'app.html', 'V10.20', 'last-run-app.json', 'v10.20-app.png')
        ribbon_check()
    finally:
        subprocess.run([sys.executable, os.path.join(HERE, 'test_server.py')])
        subprocess.run([sys.executable, os.path.join(HERE, 'test_claude.py')])
        subprocess.run([sys.executable, os.path.join(HERE, 'test_hosted.py')])    # 10.18: hosted mode
        subprocess.run([sys.executable, os.path.join(HERE, 'test_v10_20.py')])    # 10.20: SL Smart Design bridge, registry regression
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


def ribbon_check():
    """V10.15: the ribbon entry (manifest-v10.xml): a group on the Home tab, three buttons that open the task pane, and
    every URL and icon it names served by the panel host (checked against this test host); the SL Smart Design kit
    (sl-smart-design): its ribbon lines are well-formed, every callback they name is in the VBA module, and the helper
    (open-panel.ps1) presses buttons with the manifest's own labels."""
    import urllib.request
    import xml.etree.ElementTree as ET
    ns = {'o': 'http://schemas.microsoft.com/office/appforoffice/1.1', 'v': 'http://schemas.microsoft.com/office/taskpaneappversionoverrides',
          'bt': 'http://schemas.microsoft.com/office/officeappbasictypes/1.0'}
    fails = []
    root = ET.parse(os.path.join(HERE, '..', '..', 'manifest-v10.xml')).getroot()
    tab = root.find('.//v:OfficeTab', ns)          # 10.15: a group at the end of PowerPoint's Home tab
    if tab is None or tab.get('id') != 'TabHome':
        fails.append('the group is not on the Home tab')
    else:
        btns = tab.findall('.//v:Control', ns)
        # 10.20: one shared runtime - "Generate visuals" shows the task pane, "Several slides" and "Edit a visual" are
        # functions of that runtime (registered in bridge.js), which open the same pane on their section
        kinds = [c.find('v:Action', ns).get('{http://www.w3.org/2001/XMLSchema-instance}type') for c in btns]
        if len(btns) != 3 or kinds[0] != 'ShowTaskpane' or any(k != 'ExecuteFunction' for k in kinds[1:]):
            fails.append(f'{len(btns)} buttons, or not: one task pane button and two function buttons ({kinds})')
        bridge = open(os.path.join(HERE, '..', 'bridge.js'), encoding='utf-8').read()
        for c in btns[1:]:
            fn = (c.find('v:Action/v:FunctionName', ns).text or '') if c.find('v:Action/v:FunctionName', ns) is not None else ''
            if f"associate('{fn}'" not in bridge:
                fails.append(f'function {fn!r} is not registered in bridge.js')
        rt = root.find('.//v:Host/v:Runtimes/v:Runtime', ns)
        if rt is None or rt.get('lifetime') != 'long' or rt.get('resid') != 'Taskpane.Url':
            fails.append('the shared runtime (Runtimes/Runtime resid=Taskpane.Url lifetime=long) is not declared')
        if not any(s.get('Name') == 'SharedRuntime' for s in root.iter() if s.tag.endswith('}Set')):
            fails.append('the SharedRuntime requirement is not declared')
        if len(tab.findall('v:Group', ns)) != 1 or tab.find('v:Group/v:Label', ns) is None:
            fails.append('one labelled group expected')
    urls = [u.get('DefaultValue') for u in root.iter() if u.tag.endswith('}Url') or u.tag.endswith('}Image') and u.get('DefaultValue')] +            [e.get('DefaultValue') for e in root.iter() if e.tag.split('}')[1] in ('IconUrl', 'HighResolutionIconUrl', 'SourceLocation')]
    for u in [x for x in urls if x]:
        if not u.startswith('https://localhost:44317/'):
            fails.append('not served by the panel host: ' + u)
            continue
        try:
            with urllib.request.urlopen(f'http://localhost:{PORT}/' + u.split('/', 3)[3], timeout=10) as r:
                if r.status != 200:
                    fails.append(f'{u}: {r.status}')
        except Exception as e:
            fails.append(f'{u}: {e}')
    import re
    kit = os.path.join(HERE, '..', 'sl-smart-design')
    add = open(os.path.join(kit, 'customUI-addition.xml'), encoding='utf-8').read()
    try:
        ET.fromstring('<g>' + re.sub(r'(?s)<!--.*?-->', '', add) + '</g>')
    except ET.ParseError as e:
        fails.append(f'SL Smart Design ribbon lines are not well-formed: {e}')
    bas = open(os.path.join(kit, 'AIVisualBuilder.bas'), encoding='cp1252').read()
    missing = [a for a in set(re.findall(r'onAction="([^"]+)"', add)) if not re.search(r'Public Sub ' + re.escape(a) + r'\(control As IRibbonControl\)', bas)]
    if missing:
        fails.append(f'SL Smart Design callbacks missing in AIVisualBuilder.bas: {missing}')
    # 10.20: the unified SL Smart Design ribbon - the SL Smart Design AI add-in shares the tab and the Design group (idQ)
    # with SL Smart Design (whose ribbon make_unified_slsd.py qualifies); every button has its VBA callback
    ui = open(os.path.join(kit, 'SLSD_AIVisualBuilder.customUI.xml'), encoding='utf-8').read()
    try:
        x = ET.fromstring(ui)
        cu = '{http://schemas.microsoft.com/office/2006/01/customui}'
        tq = [t.get('idQ') for t in x.iter(cu + 'tab')]; gq = [g.get('idQ') for g in x.iter(cu + 'group')]
        if tq != ['sl:Template_Selector'] or gq != ['sl:Template_id'] or 'xmlns:sl="Simplilearn.SLSmartDesign"' not in ui:
            fails.append(f'SL Smart Design AI does not share the SL Smart Design tab and Design group: {tq} {gq}')
        slsd = open(os.path.join(kit, 'SLSD_AIVisualBuilder.bas'), encoding='cp1252').read()
        miss = [b.get('onAction') for b in x.iter(cu + 'button') if not re.search(r'Public Sub ' + re.escape(b.get('onAction')) + r'\(control As IRibbonControl\)', slsd)]
        if miss:
            fails.append(f'SL Smart Design AI callbacks missing in SLSD_AIVisualBuilder.bas: {miss}')
        import importlib.util
        spec = importlib.util.spec_from_file_location('mk', os.path.join(kit, 'make_unified_slsd.py')); mk = importlib.util.module_from_spec(spec); spec.loader.exec_module(mk)
        sample = '<customUI xmlns="http://schemas.microsoft.com/office/2006/01/customui"><ribbon><tabs><tab id="Template_Selector" label="SL Smart Design"><group id="Template_id" label="Design"><button id="Template_Button1" onAction="module1.ShowTemplateSelectorForm"/></group></tab></tabs></ribbon></customUI>'
        u = mk.unify(sample)
        if 'idQ="sl:Template_Selector"' not in u or 'idQ="sl:Template_id"' not in u or 'onAction="module1.ShowTemplateSelectorForm"' not in u:
            fails.append('make_unified_slsd.py does not qualify the SL Smart Design tab and group as expected')
        ET.fromstring(u)
    except Exception as e:
        fails.append(f'SL Smart Design AI ribbon: {e}')
    helper = open(os.path.join(HERE, '..', 'open-panel.ps1'), encoding='utf-8').read()
    labels = {s.get('id'): s.get('DefaultValue') for s in root.iter() if s.tag.endswith('}String')}
    for rid in ('Button.Label', 'Slides.Label', 'Edit.Label', 'Group.Label'):
        if f"'{labels.get(rid)}'" not in helper:
            fails.append(f'open-panel.ps1 does not look for "{labels.get(rid)}" ({rid})')
    if "HostTab = 'Home'" not in helper:
        fails.append('open-panel.ps1 does not look on the Home tab')
    print(f"ribbon and task pane: {'ALL PASSED' if not fails else 'FAILED ' + '; '.join(fails)} ({len(urls)} URLs checked; SL Smart Design kit checked)")


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
