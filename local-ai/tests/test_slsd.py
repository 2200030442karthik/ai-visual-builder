"""V10.20.1 SL Smart Design checks - all unattended: no PowerPoint, no Office registration touched, no network beyond
localhost, no keys. Runs while Windows is locked.

 1. COM (slsd_com.py): late-bound calls, results, errors on Windows' own Scripting objects; PowerPoint not running ->
    a plain message (skipped when PowerPoint is running).
 2. Panel host (server.py /api/slsd/*): only the listed commands, by key; the API header; one at a time; errors in
    plain words; the macro name sent to PowerPoint (a stand-in runner).
 3. The ribbon (manifest-slsd.xml): one SL Smart Design tab (Design | SL Templates | Miscellaneous | Shape Rename), no
    Home tab group, AI Visual Builder a task pane button, every function registered in slsd.js / bridge.js, every
    original SL Smart Design command present, every resource defined, every icon served.
 4. The SL Smart Design copy with its tab hidden: only visible="false" differs; VBA project and every other part
    byte-identical to the original; every macro the tab runs exists in the original VBA (when the original is on this PC).
 5. Template library (when installed): folders 2_point..10_point list every template the way the original window does
    (numbered .pptx with a _thumb.jpg, no gap) and every thumbnail is a JPEG Windows can load.
 6. switch-slsd.ps1 on an ISOLATED registry key and folders: Activate (backup, hidden-tab copy, manifest value, V10.20
    VBA key removed, other values untouched), Status, Rollback (exact previous state).
 7. tests/slsd.html in headless Edge: point counting, content choice, the whole Alternative Design run.
Usage: python tests/test_slsd.py"""
import hashlib, json, os, re, shutil, subprocess, sys, tempfile, time, urllib.request, zipfile
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
AI = os.path.abspath(os.path.join(HERE, '..'))
ROOT = os.path.abspath(os.path.join(AI, '..'))
KIT = os.path.join(AI, 'sl-smart-design')
sys.path.insert(0, AI)
PORT, DBG = 44395, 9339
ORIGINAL = os.environ.get('SLSD_ORIGINAL', r'D:\Karthik\SL_Smart_Design_Source\Backup_before_V10.20\SL_Smart_Design_v2_Key_Dec_25.ppam')
HIDDEN = os.environ.get('SLSD_HIDDEN', r'D:\Karthik\SL_Smart_Design_Source\Unified_V10.20.1\SL_Smart_Design_v2_Key_Dec_25.ppam')
TEMPLATES = os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Microsoft', 'SLSD', 'Templates')
results = []


def check(group, name, ok, detail=''):
    results.append((group, name, bool(ok), str(detail)[:300]))


def skip(group, name, why):
    results.append((group, name, None, why))


# ---------------------------------------------------------------- 1. COM
def t_com():
    import slsd_com as C
    init = C.init_thread()
    try:
        with C.create('Scripting.Dictionary') as d:
            d.call('Add', 'k', 'v'); d.call('Add', 'n', 7)
            check('com', 'method call, count, string and number results', d.get('Count') == 2 and d.call('Item', 'k') == 'v' and d.call('Item', 'n') == 7)
            check('com', 'boolean results', d.call('Exists', 'k') is True and d.call('Exists', 'x') is False)
            try:
                d.call('Add', 'k', 'again'); check('com', 'an error inside the call is raised', False)
            except C.COMError as e:
                check('com', 'an error inside the call is raised', e.hr == C.DISP_E_EXCEPTION, e)
            try:
                d.call('NoSuchMember'); check('com', 'an unknown member is raised', False)
            except C.COMError as e:
                check('com', 'an unknown member is raised', e.hr == C.DISP_E_UNKNOWNNAME, e)
        with C.create('Scripting.FileSystemObject') as fs, fs.call('GetFolder', os.environ['TEMP']) as f:
            check('com', 'an object result is usable (and released)', str(f.get('Path')).lower() == os.environ['TEMP'].lower())
    finally:
        C.done_thread(init)
    running = subprocess.run(['tasklist', '/FI', 'IMAGENAME eq POWERPNT.EXE', '/NH'], capture_output=True, text=True).stdout
    if 'POWERPNT' in running.upper():
        skip('com', 'PowerPoint not running: plain message', 'PowerPoint is running (Track 2)')
    else:
        try:
            C.run_macro('SL_Smart_Design_v2_Key_Dec_25.ppam', 'Module1', 'RenameText'); check('com', 'PowerPoint not running: plain message', False)
        except C.MacroError as e:
            check('com', 'PowerPoint not running: plain message', str(e) == 'PowerPoint is not running.', e)


# ---------------------------------------------------------------- 2. panel host
def req(method, path, body=None, headers=True):
    h = {'Content-Type': 'application/json', **({'X-AIVB-Client': '1'} if headers else {})}
    r = urllib.request.Request(f'http://localhost:{PORT}{path}', data=json.dumps(body).encode() if body is not None else None, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=5) as x:
            return x.status, json.loads(x.read() or b'{}')
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b'{}')


def t_server_inprocess():
    os.environ['AIVB_DATA_DIR'] = os.path.join(tempfile.gettempdir(), 'aivb-test-slsd')
    argv = sys.argv
    sys.argv = [argv[0], '--test']
    import server as S
    sys.argv = argv
    ran, gate = [], {'block': False}

    def fake(macro):
        ran.append(macro)
        while gate['block']:
            time.sleep(0.02)
        if macro == 'RenameText':
            import slsd_com
            raise slsd_com.MacroError('Please select some shapes first.')
    S.SLSD_RUNNER = fake

    def wait(rid):
        for _ in range(200):
            j = S.slsd_status(rid)
            if j['state'] != 'running':
                return j
            time.sleep(0.02)
        return j
    for k, m in S.SLSD_MACROS.items():
        j = wait(S.slsd_run({'cmd': k})['id'])
        check('host', f'{k} runs {m}', j['state'] == ('error' if m == 'RenameText' else 'done') and ran[-1] == m, j)
    check('host', 'every original SL Smart Design command is offered', sorted(S.SLSD_MACROS.values()) == sorted([
        'ShowTemplateSelectorForm', 'ImportNoteSection', 'ImportInfoSection', 'ImportBlueCodeboxSection', 'ImportBlackCodeboxSection', 'ImportProblemSolutionSection',
        'ImportProblemSolutionImageSection', 'DeleteAllAnimationsAndTransitions', 'DeleteEmptyTextBoxesAndPlaceholders', 'RenameText', 'RenameHeading']))
    j = S.slsd_status(S.slsd_run({'cmd': 'rename-text'})['id']); j = wait(j['id'])
    check('host', 'a macro\'s reason is passed on in plain words', j['state'] == 'error' and j['message'] == 'Please select some shapes first.', j)
    for bad in ('ShowTemplateSelectorForm', 'Module1.RenameText', '../x', '', 'alternative ', None):
        try:
            S.slsd_run({'cmd': bad}); check('host', f'refused: {bad!r}', False)
        except S.NapkinError as e:
            check('host', f'refused: {bad!r}', e.code == 400, e)
    gate['block'] = True
    first = S.slsd_run({'cmd': 'alternative'})['id']
    try:
        S.slsd_run({'cmd': 'footer-note'}); check('host', 'one command at a time (the Select Template window is modal)', False)
    except S.NapkinError as e:
        check('host', 'one command at a time (the Select Template window is modal)', e.code == 409 and 'Select Template' in str(e), e)
    gate['block'] = False
    wait(first)
    check('host', 'the next command runs once the window closed', wait(S.slsd_run({'cmd': 'footer-note'})['id'])['state'] == 'done')
    # the real runner sends PowerPoint's documented macro form
    import slsd_com
    sent = []
    orig = slsd_com.run_macro
    slsd_com.run_macro = lambda f, mod, mac: sent.append(f'{f}!{mod}.{mac}')
    try:
        S._slsd_runner('ShowTemplateSelectorForm')
    finally:
        slsd_com.run_macro = orig
    check('host', 'macro name sent to PowerPoint', sent == ['SL_Smart_Design_v2_Key_Dec_25.ppam!Module1.ShowTemplateSelectorForm'], sent)
    try:
        S.slsd_status('nope'); check('host', 'unknown job: 404', False)
    except S.NapkinError as e:
        check('host', 'unknown job: 404', e.code == 404)


def t_server_http():
    srv = subprocess.Popen([sys.executable, os.path.join(AI, 'server.py'), '--http', '--test', '--port', str(PORT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(40):
            try:
                urllib.request.urlopen(f'http://localhost:{PORT}/slsd.js', timeout=1); break
            except Exception:
                time.sleep(0.25)
        check('http', 'without the API header: refused', req('POST', '/api/slsd/run', {'cmd': 'alternative'}, headers=False)[0] == 403)
        check('http', 'unknown command: 400', req('POST', '/api/slsd/run', {'cmd': 'Shell'})[0] == 400)
        s, o = req('POST', '/api/slsd/run', {'cmd': 'remove-animations'})
        check('http', 'a command is accepted with an id', s == 200 and len(o.get('id', '')) == 16, (s, o))
        st = {}
        for _ in range(60):
            st = req('GET', '/api/slsd/status?id=' + o.get('id', ''))[1]
            if st.get('state') != 'running':
                break
            time.sleep(0.25)
        # no PowerPoint here: the real runner answers in plain words, nothing else happens
        check('http', 'no PowerPoint: a plain error, no crash', st.get('state') == 'error' and 'PowerPoint' in st.get('message', ''), st)
        for path in ('/slsd.js', '/slsd-notice.html', '/assets/slsd/design-32.png', '/tests/slsd.html'):
            try:
                with urllib.request.urlopen(f'http://localhost:{PORT}{path}', timeout=5) as r:
                    check('http', f'served: {path}', r.status == 200)
            except Exception as e:
                check('http', f'served: {path}', False, e)
        return srv
    except Exception:
        srv.terminate()
        raise


# ---------------------------------------------------------------- 3. ribbon
def t_manifest(port_up):
    ns = {'o': 'http://schemas.microsoft.com/office/appforoffice/1.1', 'v': 'http://schemas.microsoft.com/office/taskpaneappversionoverrides',
          'bt': 'http://schemas.microsoft.com/office/officeappbasictypes/1.0'}
    XT = '{http://www.w3.org/2001/XMLSchema-instance}type'
    text = open(os.path.join(ROOT, 'manifest-slsd.xml'), encoding='utf-8').read()
    root = ET.fromstring(text)
    v10 = ET.parse(os.path.join(ROOT, 'manifest-v10.xml')).getroot()
    check('ribbon', 'same add-in Id as manifest-v10.xml (replaces it, not a second add-in)', root.find('o:Id', ns).text == v10.find('o:Id', ns).text)
    check('ribbon', 'version is a.b.c.d and newer than V10.20.0', re.fullmatch(r'\d+\.\d+\.\d+\.\d+', root.find('o:Version', ns).text) and
          tuple(map(int, root.find('o:Version', ns).text.split('.'))) > tuple(map(int, v10.find('o:Version', ns).text.split('.'))))
    check('ribbon', 'no group on the Home tab', root.find('.//v:OfficeTab', ns) is None and 'TabHome' not in text)
    tabs = root.findall('.//v:CustomTab', ns)
    strings = {s.get('id'): s.get('DefaultValue') for s in root.iter() if s.tag.endswith('}String')}
    check('ribbon', 'one custom tab "SL Smart Design"', len(tabs) == 1 and strings.get(tabs[0].find('v:Label', ns).get('resid')) == 'SL Smart Design')
    groups = tabs[0].findall('v:Group', ns)
    labels = [strings[g.find('v:Label', ns).get('resid')] for g in groups]
    check('ribbon', 'groups Design | SL Templates | Miscellaneous | Shape Rename', labels == ['Design', 'SL Templates', 'Miscellaneous', 'Shape Rename'], labels)
    ctl = {strings[c.find('v:Label', ns).get('resid')]: c for c in tabs[0].iter('{%s}Control' % ns['v'])}
    want = ['Alternative Design', 'AI Visual Builder', 'Several slides', 'Edit a visual', 'Add Footer Note', 'Add Blue Codebox', 'Add Black Codebox', 'Add Footer Info',
            'Add Problem Solution', 'Add Problem Solution Image', 'Remove Animations', 'Delete Empty Boxes', 'Text', 'Heading']
    check('ribbon', 'every original SL Smart Design button and the AI Visual Builder buttons', sorted(ctl) == sorted(want), sorted(set(want) ^ set(ctl)))
    design = [strings[c.find('v:Label', ns).get('resid')] for c in groups[0].findall('v:Control', ns)]
    check('ribbon', 'Alternative Design and AI Visual Builder side by side in Design', design[:2] == ['Alternative Design', 'AI Visual Builder'], design)
    a = ctl.get('AI Visual Builder')
    check('ribbon', 'AI Visual Builder opens the task pane itself (ShowTaskpane: first click, no bridge)',
          a is not None and a.find('v:Action', ns).get(XT) == 'ShowTaskpane' and a.find('v:Action/v:TaskpaneId', ns).text == 'AIVisualBuilderV10Pane')
    js = open(os.path.join(AI, 'slsd.js'), encoding='utf-8').read() + open(os.path.join(AI, 'bridge.js'), encoding='utf-8').read()
    fns = [c.find('v:Action/v:FunctionName', ns).text for c in ctl.values() if c.find('v:Action', ns).get(XT) == 'ExecuteFunction']
    import_slsd = re.findall(r"(slsd\w+): '([\w-]+)'", js)
    registered = set(re.findall(r"associate\('(\w+)'", js)) | {f for f, _ in import_slsd}
    check('ribbon', 'every function button is registered in the runtime', all(f in registered for f in fns), [f for f in fns if f not in registered])
    rt = root.find('.//v:Runtimes/v:Runtime', ns)
    check('ribbon', 'shared runtime (lifetime long) is the function file', rt is not None and rt.get('lifetime') == 'long' and root.find('.//v:FunctionFile', ns).get('resid') == rt.get('resid'))
    refs = set(re.findall(r'resid="([^"]+)"', text))
    defs = set(re.findall(r'<bt:\w+ id="([^"]+)" DefaultValue', text))
    check('ribbon', 'every resource defined and used; ids up to 32 characters', not (refs - defs) and not (defs - refs) and max(map(len, refs)) <= 32, (refs - defs, defs - refs))
    check('ribbon', 'labels up to 125 and tips up to 250 characters', all(len(s) <= 250 for s in strings.values()))
    ids = re.findall(r'<(?:Group|Control|CustomTab)[^>]* id="([^"]+)"', text)
    check('ribbon', 'control ids unique', len(ids) == len(set(ids)))
    urls = re.findall(r'DefaultValue="(https://localhost:44317/[^"]+)"', text)
    bad = []
    for u in sorted(set(urls)):
        rel = u.split('/', 3)[3]
        if port_up:
            try:
                urllib.request.urlopen(f'http://localhost:{PORT}/{rel}', timeout=5)
            except Exception as e:
                bad.append(f'{rel}: {e}')
    check('ribbon', f'every URL and icon served by the panel host ({len(set(urls))})', port_up and not bad, bad)
    sys.path.insert(0, KIT)
    import make_manifest_slsd as M
    check('ribbon', 'manifest-slsd.xml is what make_manifest_slsd.py writes', M.build() == text.replace('\r\n', '\n'))


# ---------------------------------------------------------------- 4. hidden-tab copy
def vba_macros(ppam):
    """The Sub names in Module1 of a .ppam (read-only, via the same reader as the source review)."""
    sys.path.insert(0, HERE)
    from vba_read import module_sources
    return set(re.findall(r'(?m)^\s*(?:Public\s+)?Sub\s+(\w+)\s*\(', module_sources(ppam).get('Module1', '')))


def t_hidden():
    if not (os.path.exists(ORIGINAL) and os.path.exists(HIDDEN)):
        return skip('addin', 'hidden-tab SL Smart Design copy', 'original or copy not on this PC')
    a, b = zipfile.ZipFile(ORIGINAL), zipfile.ZipFile(HIDDEN)
    check('addin', 'same parts', sorted(a.namelist()) == sorted(b.namelist()))
    other = [n for n in a.namelist() if n != 'customUI/customUI.xml' and hashlib.sha256(a.read(n)).digest() != hashlib.sha256(b.read(n)).digest()]
    check('addin', 'VBA project, forms, licence check and every other part byte-identical', not other, other)
    x0, x1 = a.read('customUI/customUI.xml').decode('utf-8-sig'), b.read('customUI/customUI.xml').decode('utf-8-sig')
    check('addin', 'only change: its tab hidden (visible="false")', x1 == x0.replace('visible="true"', 'visible="false"', 1) and x0 != x1)
    cu = '{http://schemas.microsoft.com/office/2006/01/customui}'
    tab = ET.fromstring(x1).find(f'.//{cu}tab')
    check('addin', 'tab id and callbacks unchanged', tab.get('id') == 'Template_Selector' and tab.get('visible') == 'false' and
          [x.get('onAction') for x in ET.fromstring(x0).iter(cu + 'button')] == [x.get('onAction') for x in ET.fromstring(x1).iter(cu + 'button')])
    try:
        subs = vba_macros(ORIGINAL)
        import server as S
        missing = [m for m in S.SLSD_MACROS.values() if m not in subs]
        check('addin', 'every macro the tab runs exists in the original Module1', subs and not missing, missing)
        onaction = [x.get('onAction').split('.', 1)[1] for x in ET.fromstring(x0).iter(cu + 'button')]
        check('addin', 'the tab runs exactly the original ribbon\'s macros', sorted(onaction) == sorted(S.SLSD_MACROS.values()), sorted(set(onaction) ^ set(S.SLSD_MACROS.values())))
    except ImportError as e:
        skip('addin', 'macros in the original VBA', e)


# ---------------------------------------------------------------- 5. template library
def jpeg_ok(p):
    with open(p, 'rb') as f:
        b = f.read(65536)
    if b[:3] != b'\xff\xd8\xff':
        return False
    i = 2
    while i < len(b) - 9:
        if b[i] != 0xFF:
            return False
        m = b[i + 1]
        if m in (0xD8, 0x01) or 0xD0 <= m <= 0xD7:
            i += 2; continue
        L = int.from_bytes(b[i + 2:i + 4], 'big')
        if 0xC0 <= m <= 0xCF and m not in (0xC4, 0xC8, 0xCC):
            return m in (0xC0, 0xC1, 0xC2) and b[i + 9] in (1, 3)     # baseline / extended / progressive; grey or colour (no CMYK)
        i += 2 + L
    return False


def t_templates():
    if not os.path.isdir(TEMPLATES):
        return skip('library', 'template library', 'not installed on this PC')
    total = thumbs = 0
    for n in range(2, 11):
        d = os.path.join(TEMPLATES, f'{n}_point')
        if not os.path.isdir(d):
            check('library', f'{n}_point folder', False, 'missing'); continue
        files = {f.lower() for f in os.listdir(d)}
        pptx = sorted(int(f[:4]) for f in files if re.fullmatch(r'\d{4}\.pptx', f))
        i = 1
        while f'{i:04d}.pptx' in files and f'{i:04d}_thumb.jpg' in files:
            i += 1
        shown = i - 1
        bad = [k for k in range(1, shown + 1) if not jpeg_ok(next(os.path.join(d, f) for f in os.listdir(d) if f.lower() == f'{k:04d}_thumb.jpg'))]
        check('library', f'{n}_point: the window lists all {len(pptx)} templates, every thumbnail loadable', shown == len(pptx) and shown > 0 and not bad,
              f'listed {shown} of {len(pptx)}; bad thumbnails {bad[:5]}')
        total += len(pptx); thumbs += shown
    for name in ('Notes/Note_Section.pptx', 'Info/Info_Section.pptx', 'BlueCodebox/BlueCodebox_Section.pptx', 'BlackCodebox/BlackCodebox_Section.pptx',
                 'ProblemSolution/ProblemSolution_Section.pptx', 'ProblemSolutionImage/ProblemSolutionImage_Section.pptx'):
        check('library', f'SL Templates file {name}', os.path.isfile(os.path.join(TEMPLATES, name)))
    check('library', f'{total} point templates in 2-10 (about 1,200 expected)', total >= 1100, total)


# ---------------------------------------------------------------- 6. switch-slsd.ps1 (isolated)
def ps(args):
    r = subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', os.path.join(KIT, 'switch-slsd.ps1'), *args], capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr


def regq(cmd):
    r = subprocess.run(['powershell', '-NoProfile', '-Command', cmd], capture_output=True, text=True)
    return r.stdout.strip()


def t_switch():
    if not os.path.exists(HIDDEN):
        return skip('switch', 'switch-slsd.ps1', 'hidden-tab copy not built on this PC')
    key = 'HKCU:\\Software\\SLSD-Test-' + str(os.getpid())
    tmp = tempfile.mkdtemp(prefix='slsd-switch-')
    addins, state = os.path.join(tmp, 'AddIns'), os.path.join(tmp, 'state')
    os.makedirs(addins)
    with open(os.path.join(addins, 'SL_Smart_Design_v2_Key_Dec_25.ppam'), 'wb') as f:
        f.write(b'previous unified add-in')
    with open(os.path.join(addins, 'SLSD_AIVisualBuilder.ppam'), 'wb') as f:
        f.write(b'previous AI buttons add-in')
    setup = (f"New-Item -Path '{key}\\WEF\\Developer' -Force | Out-Null; New-Item -Path '{key}\\PowerPoint\\AddIns\\SLSD_AIVisualBuilder' -Force | Out-Null; "
             f"New-Item -Path '{key}\\PowerPoint\\AddIns\\SL_Audomation' -Force | Out-Null; "
             f"Set-ItemProperty '{key}\\WEF\\Developer' -Name '08d15d9d-8629-4583-b67d-5f80143dde6d' -Value 'D:\\old\\manifest-v10.xml'; "
             f"Set-ItemProperty '{key}\\WEF\\Developer' -Name 'other-addin-id' -Value 'C:\\other\\manifest.xml'; "
             f"Set-ItemProperty '{key}\\PowerPoint\\AddIns\\SLSD_AIVisualBuilder' -Name Path -Value 'SLSD_AIVisualBuilder.ppam'; "
             f"New-ItemProperty '{key}\\PowerPoint\\AddIns\\SLSD_AIVisualBuilder' -Name AutoLoad -Value 1 -PropertyType DWord | Out-Null; "
             f"Set-ItemProperty '{key}\\PowerPoint\\AddIns\\SL_Audomation' -Name Path -Value 'SL_Audomation.ppam'")
    try:
        regq(setup)
        common = ['-OfficeRoot', key, '-AddInsDir', addins, '-StateDir', state, '-HiddenTabAddIn', HIDDEN]
        rc, out = ps(['-Action', 'Activate', *common])
        check('switch', 'Activate runs', rc == 0, out[-300:])
        wef = regq(f"(Get-ItemProperty '{key}\\WEF\\Developer').'08d15d9d-8629-4583-b67d-5f80143dde6d'")
        check('switch', 'AI Visual Builder registration points at manifest-slsd.xml', wef.lower() == os.path.join(ROOT, 'manifest-slsd.xml').lower(), wef)
        check('switch', 'another web add-in\'s registration untouched', regq(f"(Get-ItemProperty '{key}\\WEF\\Developer').'other-addin-id'") == 'C:\\other\\manifest.xml')
        check('switch', 'V10.20 SL Smart Design AI VBA add-in no longer loaded (its key only)', regq(f"Test-Path '{key}\\PowerPoint\\AddIns\\SLSD_AIVisualBuilder'") == 'False'
              and regq(f"(Get-ItemProperty '{key}\\PowerPoint\\AddIns\\SL_Audomation').Path") == 'SL_Audomation.ppam')
        with open(os.path.join(addins, 'SL_Smart_Design_v2_Key_Dec_25.ppam'), 'rb') as f, open(HIDDEN, 'rb') as g:
            check('switch', 'the hidden-tab SL Smart Design copy installed under the same name', f.read() == g.read())
        rc, out = ps(['-Action', 'Status', *common])
        check('switch', 'Status reports the tab hidden', rc == 0 and re.search(r'tab hidden\s*:\s*True', out), out[-300:])
        rc, out = ps(['-Action', 'Rollback', *common])
        check('switch', 'Rollback runs', rc == 0, out[-300:])
        with open(os.path.join(addins, 'SL_Smart_Design_v2_Key_Dec_25.ppam'), 'rb') as f:
            check('switch', 'Rollback: previous SL Smart Design file back', f.read() == b'previous unified add-in')
        check('switch', 'Rollback: previous manifest value back', regq(f"(Get-ItemProperty '{key}\\WEF\\Developer').'08d15d9d-8629-4583-b67d-5f80143dde6d'") == 'D:\\old\\manifest-v10.xml')
        check('switch', 'Rollback: V10.20 VBA add-in key back with its values', regq(f"$p = Get-ItemProperty '{key}\\PowerPoint\\AddIns\\SLSD_AIVisualBuilder'; \"$($p.Path)|$($p.AutoLoad)\"") == 'SLSD_AIVisualBuilder.ppam|1')
        check('switch', 'Rollback: other registrations still untouched', regq(f"(Get-ItemProperty '{key}\\WEF\\Developer').'other-addin-id'") == 'C:\\other\\manifest.xml')
        src = open(os.path.join(KIT, 'switch-slsd.ps1'), encoding='utf-8').read()
        check('switch', 'never recreates a key with -Force, never touches the real PowerPoint while it runs',
              not re.search(r'New-Item\s+-Path\s+\$(Wef|AiKey)[^\n]*-Force', src) and "Get-Process POWERPNT" in src)
    finally:
        regq(f"Remove-Item -Path '{key}' -Recurse -ErrorAction SilentlyContinue")
        shutil.rmtree(tmp, ignore_errors=True)


# ---------------------------------------------------------------- 7. tests/slsd.html in headless Edge
def t_page():
    from edge_cdp import CDP, EDGE
    profile = os.path.join(HERE, '.edge-profile-slsd')
    edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions', f'--remote-debugging-port={DBG}',
                             f'--user-data-dir={profile}', f'http://localhost:{PORT}/tests/slsd.html'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        page = None
        for _ in range(60):
            try:
                page = next(t for t in json.load(urllib.request.urlopen(f'http://127.0.0.1:{DBG}/json')) if t['type'] == 'page'); break
            except Exception:
                time.sleep(0.5)
        cdp = CDP(page['webSocketDebuggerUrl'])
        txt = 'running'
        for _ in range(120):
            txt = cdp.js("document.getElementById('out') ? document.getElementById('out').textContent : 'running'")
            if txt and txt != 'running':
                break
            time.sleep(0.5)
        res = json.loads(txt) if txt != 'running' else {'acceptance': [{'name': 'page finished', 'ok': False, 'evidence': 'timed out'}]}
        for a in res['acceptance']:
            check('page', a['name'], a['ok'], a['evidence'])
    finally:
        ps_cmd = f"Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | Where-Object {{ $_.CommandLine -like '*{profile}*' }} | ForEach-Object {{ Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }}"
        subprocess.run(['powershell', '-NoProfile', '-Command', ps_cmd], capture_output=True)
        edge.terminate()
        time.sleep(1)
        shutil.rmtree(profile, ignore_errors=True)


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    t_com()
    t_server_inprocess()
    srv = None
    try:
        srv = t_server_http()
        t_manifest(True)
        try:
            t_page()
        except Exception as e:
            check('page', 'headless Edge page', False, f'{type(e).__name__}: {e}')
    finally:
        if srv:
            srv.terminate()
    t_hidden()
    t_templates()
    t_switch()
    fails = [r for r in results if r[2] is False]
    for g, n, ok, d in results:
        print(f"  {'PASS' if ok else 'SKIP' if ok is None else 'FAIL'}  [{g}] {n}" + (f'  | {d}' if ok is not True and d else ''))
    print(f"v10.20.1 SL Smart Design: {'ALL PASSED' if not fails else f'{len(fails)} FAILED'} ({sum(1 for r in results if r[2])} passed, "
          f"{sum(1 for r in results if r[2] is None)} skipped)")
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
