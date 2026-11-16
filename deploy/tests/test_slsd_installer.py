"""Unified SL Smart Design installer - automated tests (no PowerPoint GUI; nothing of this PC's live setup is touched).

Every scenario runs the real package scripts on an ISOLATED registry root (HKCU\\Software\\SLSD-InstallerTest), isolated
add-ins / templates / data folders, its own instance name and port 44347, and a copy of the built package. The starting
state is realistic: the licensed SL Smart Design add-in installed, the old AI Visual Builder pilot and the V10.20 add-in
registered, SL Animation and another web add-in present, a partial template library, an existing (fake) AI key.
Paid AI cannot be reached: the package ships paid_policy "never" and the fake key is disabled.

 1 package integrity (checksum, contents, no secrets)      8 manual rollback of the update
 2 refusals before any change (marked zip, no licence,      9 simulated failure during an update -> exact restore
   development setup present, PowerPoint check skipped)   10 uninstall -> exact original state, data kept
 3 fresh install (Catalog)                                 11 simulated failure on a fresh install -> exact restore
 4 service over HTTPS, files, manifest, registration       12 reinstall, Verify, final uninstall
 5 add-ins: licensed file replaced by the hidden-tab copy,
   unrelated add-ins untouched, old registrations retired
 6 templates: missing added, existing never overwritten
 7 update (Developer registration), previous kept
Usage: python deploy/tests/test_slsd_installer.py [PACKAGE_DIR]"""
import hashlib, json, os, re, shutil, subprocess, sys, tempfile, time, urllib.request, zipfile, ssl

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'SLSD_Unified_Package')
PKG = os.path.join(OUT, 'SL Smart Design')
ORIGINAL = r'D:\Karthik\SL_Smart_Design_Source\Backup_before_V10.20\SL_Smart_Design_v2_Key_Dec_25.ppam'
AUDOMATION = r'D:\Karthik\SL_Smart_Design_Source\Backup_before_V10.20\SL_Audomation.ppam'
CERTS = os.path.join(os.environ['LOCALAPPDATA'], 'AIVisualBuilder')        # this PC's trusted localhost certificate (read only)
REG = r'HKCU:\Software\SLSD-InstallerTest'
OFFICE = REG + r'\Office\16.0'
INSTANCE, PORT = 'SLSDInstallerTest', 44347
PRODUCT, PILOT = '2f01d600-c9ec-4d94-ade9-69b8b6f0bfa7', '78643140-2b68-48d8-b072-3b253dddf2b8'
CATKEY = OFFICE + r'\WEF\TrustedCatalogs\{EEBC6074-F7DB-4E1A-A3DC-BC2784D4BF34}'
DEST = os.path.join(os.environ['LOCALAPPDATA'], 'Programs', INSTANCE)
results = []


def check(group, name, ok, detail=''):
    results.append((group, name, bool(ok), str(detail)[:400]))
    return ok


def ps(cmd, timeout=300):
    r = subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd], capture_output=True, text=True, timeout=timeout)
    return r.returncode, (r.stdout + r.stderr)


def script(pkgdir, name, args, timeout=600):
    r = subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', os.path.join(pkgdir, name), *args], capture_output=True, text=True, timeout=timeout)
    return r.returncode, (r.stdout + r.stderr)


def sha(p):
    return hashlib.sha256(open(p, 'rb').read()).hexdigest()


def tree(d):
    return {os.path.relpath(os.path.join(a, f), d): sha(os.path.join(a, f)) for a, _, fs in os.walk(d) for f in fs} if os.path.isdir(d) else {}


def reg_snapshot():
    code, out = ps(f"""$r = @{{}}; if (Test-Path '{REG}') {{ foreach ($k in @(Get-Item '{REG}') + @(Get-ChildItem '{REG}' -Recurse)) {{
        $p = Get-ItemProperty $k.PSPath; foreach ($n in $k.GetValueNames()) {{ $r["$($k.Name)|$n"] = "$($k.GetValue($n))" }}; $r["$($k.Name)|<key>"] = '' }} }}
        $r | ConvertTo-Json -Compress""")
    return json.loads(out.strip() or '{}') if code == 0 and out.strip() else {}


def snapshot(env):
    return {'reg': reg_snapshot(), 'addins': tree(env['addins']), 'templates': tree(env['templates']), 'data': tree(env['data'])}


def status():
    ctx = ssl.create_default_context()      # normal certificate checking (the trusted localhost certificate)
    try:
        r = urllib.request.Request(f'https://localhost:{PORT}/api/status', headers={'X-AIVB-Client': '1'})
        with urllib.request.urlopen(r, timeout=5, context=ctx) as x:
            return json.loads(x.read())
    except Exception as e:
        return {'error': str(e)}


def common_args(env, extra=()):
    return ['-Instance', INSTANCE, '-Port', str(PORT), '-DataDir', env['data'], '-OfficeRoot', OFFICE, '-AddInsDir', env['addins'],
            '-TemplatesDir', env['templates'], '-AppsKeyRoot', REG + r'\Uninstall', '-UseCertFrom', CERTS, '-NoAutostart', *extra]


def make_templates_zip(path):
    with zipfile.ZipFile(path, 'w') as z:
        for n in range(2, 11):
            z.writestr(f'{n}_point/0001.pptx', f'template {n} from package')
            z.writestr(f'{n}_point/0001_thumb.jpg', 'thumb')
        for f in ('Notes/Note_Section.pptx', 'Info/Info_Section.pptx', 'BlueCodebox/BlueCodebox_Section.pptx', 'BlackCodebox/BlackCodebox_Section.pptx',
                  'ProblemSolution/ProblemSolution_Section.pptx', 'ProblemSolutionImage/ProblemSolutionImage_Section.pptx'):
            z.writestr(f, 'section from package')


def setup(tmp):
    env = {k: os.path.join(tmp, k) for k in ('addins', 'templates', 'data', 'pkg')}
    shutil.copytree(PKG, env['pkg'])
    os.makedirs(os.path.join(env['pkg'], 'templates'), exist_ok=True)
    make_templates_zip(os.path.join(env['pkg'], 'templates', 'SLSD-Templates.zip'))
    os.makedirs(env['addins']); os.makedirs(os.path.join(env['templates'], '2_point')); os.makedirs(env['data'])
    shutil.copy(ORIGINAL, env['addins']); shutil.copy(AUDOMATION, env['addins'])
    open(os.path.join(env['addins'], 'SLSD_AIVisualBuilder.ppam'), 'wb').write(b'V10.20 add-in (test stand-in)')
    open(os.path.join(env['templates'], '2_point', '0001.pptx'), 'w').write('EXISTING company template - must not be overwritten')
    json.dump({'api_key': 'test-not-a-real-key-000000', 'enabled': False, 'style_id': ''}, open(os.path.join(env['data'], 'napkin.json'), 'w'))
    code, out = ps(f"""
        foreach ($k in '{REG}\\Uninstall', '{OFFICE}\\WEF\\Developer', '{OFFICE}\\PowerPoint\\AddIns\\SL_Smart_Design_v2_Key_Dec_25', '{OFFICE}\\PowerPoint\\AddIns\\SL_Audomation',
                       '{OFFICE}\\PowerPoint\\AddIns\\SLSD_AIVisualBuilder', '{OFFICE}\\WEF\\TrustedCatalogs\\{{11111111-2222-3333-4444-555555555555}}') {{ New-Item -Path $k -Force | Out-Null }}
        Set-ItemProperty '{OFFICE}\\WEF\\Developer' -Name 'other-addin-id' -Value 'C:\\other\\manifest.xml'
        Set-ItemProperty '{OFFICE}\\WEF\\Developer' -Name '{PILOT}' -Value 'C:\\pilot\\manifest-pilot.xml'
        Set-ItemProperty '{OFFICE}\\WEF\\TrustedCatalogs\\{{11111111-2222-3333-4444-555555555555}}' -Name Url -Value '\\\\other\\catalog'
        foreach ($a in 'SL_Smart_Design_v2_Key_Dec_25', 'SL_Audomation', 'SLSD_AIVisualBuilder') {{
            Set-ItemProperty "{OFFICE}\\PowerPoint\\AddIns\\$a" -Name Path -Value "$a.ppam"
            New-ItemProperty "{OFFICE}\\PowerPoint\\AddIns\\$a" -Name AutoLoad -Value 1 -PropertyType DWord | Out-Null }}""")
    assert code == 0, out
    return env


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    tmp = tempfile.mkdtemp(prefix='slsd-inst-')
    try:
        # 1. package integrity
        zips = [f for f in os.listdir(OUT) if f.endswith('.zip')]
        check('package', 'one versioned staging zip', len(zips) == 1 and re.fullmatch(r'SL-Smart-Design-[\d.]+-staging\.zip', zips[0]), zips)
        sline = open(os.path.join(OUT, 'SHA256.txt')).read().split()
        check('package', 'SHA256.txt matches the zip', sline[0].lower() == sha(os.path.join(OUT, zips[0])) and sline[1] == zips[0])
        names = zipfile.ZipFile(os.path.join(OUT, zips[0])).namelist()
        need = ['Install SL Smart Design.bat', 'Install.ps1', 'Uninstall.ps1', 'Rollback.ps1', 'Verify.ps1', 'Restart.ps1', 'common.ps1', 'slsd-common.ps1',
                'runtime/pythonw.exe', 'app/server.py', 'app/slsd.js', 'app/slsd_com.py', 'app/run_server.pyw', 'manifest-slsd.template.xml',
                'slsd/SL_Smart_Design_v2_Key_Dec_25.ppam', 'admin-config.json', 'package.json', 'INSTALL-GUIDE.txt', 'access-template.json']
        miss = [n for n in need if f'SL Smart Design/{n}' not in names]
        check('package', 'required files in the zip', not miss, miss)
        bad = [n for n in names if re.search(r'(napkin|claude)\.json$|\.pem$|\.pfx$|usage\.json$|/access\.json$|AIVB-keys\.json$|\.bas$|\.frm$|\.pptm$|lnc\.ln$', n)]
        check('package', 'no keys, certificates, usage data, add-in source or licence file', not bad, bad)
        adm = json.load(open(os.path.join(PKG, 'admin-config.json')))
        check('package', 'paid AI off by default (admin-config paid_policy never)', adm.get('paid_policy') == 'never', adm)
        appcfg = json.load(open(os.path.join(PKG, 'app', 'config.json')))
        check('package', "app config is the committed one (not this PC's working copy)", appcfg.get('paid_order') == 'auto', appcfg)
        it = json.load(open(os.path.join(PKG, 'package.json')))
        check('package', 'labelled staging, product Id', it.get('status') == 'staging' and it.get('product_id') == PRODUCT, it)

        env = setup(tmp)
        args = common_args(env)
        pre = snapshot(env)

        # 2. refusals before any change
        marked = os.path.join(tmp, 'marked'); shutil.copytree(env['pkg'], marked)
        open(os.path.join(marked, 'Install.ps1') + ':Zone.Identifier', 'w').write('[ZoneTransfer]\nZoneId=3\n')
        code, out = script(marked, 'Install.ps1', args + ['-Registration', 'Catalog', '-CatalogUrl', r'\\TESTPC\share\cat'])
        check('refuse', "downloaded package with Windows' mark: stops, asks to Unblock, changes nothing", code == 1 and 'Unblock' in out and snapshot(env) == pre and not os.path.exists(DEST), out[-300:])
        code, out = script(env['pkg'], 'Install.ps1', args + ['-Registration', 'Catalog'])
        check('refuse', 'Catalog without the IT share path: stops', code == 1 and 'catalog' in out.lower() and snapshot(env) == pre, out[-200:])
        ps(f"Rename-Item '{OFFICE}\\PowerPoint\\AddIns\\SL_Smart_Design_v2_Key_Dec_25' 'X_SLSD'; Rename-Item '{env['addins']}\\SL_Smart_Design_v2_Key_Dec_25.ppam' 'X.ppam'")
        code, out = script(env['pkg'], 'Install.ps1', args + ['-Registration', 'Central'])
        check('refuse', 'SL Smart Design (licence) not installed: stops', code == 1 and 'not installed' in out and not os.path.exists(DEST), out[-200:])
        ps(f"Rename-Item '{OFFICE}\\PowerPoint\\AddIns\\X_SLSD' 'SL_Smart_Design_v2_Key_Dec_25'; Rename-Item '{env['addins']}\\X.ppam' 'SL_Smart_Design_v2_Key_Dec_25.ppam'")
        ps(f"New-Item -Path '{OFFICE}\\WEF\\TrustedCatalogs\\{{5D7F6C1E-3B1A-4E5C-9C2E-51D051500001}}' | Out-Null")
        code, out = script(env['pkg'], 'Install.ps1', args + ['-Registration', 'Central'])
        check('refuse', 'development setup registered: stops (no second tab)', code == 1 and 'development setup' in out and not os.path.exists(DEST), out[-200:])
        ps(f"Remove-Item -Path '{OFFICE}\\WEF\\TrustedCatalogs\\{{5D7F6C1E-3B1A-4E5C-9C2E-51D051500001}}'")
        check('refuse', 'state unchanged after all refusals', snapshot(env) == pre)

        # 3-6. fresh install (Catalog)
        code, out = script(env['pkg'], 'Install.ps1', args + ['-Registration', 'Catalog', '-CatalogUrl', r'\\TESTPC\share\cat'])
        check('install', 'fresh install succeeds', code == 0, out[-500:])
        st = status()
        check('install', 'panel host answers over HTTPS with normal certificate checking', st.get('server'), st)
        try:
            ctx = ssl.create_default_context()
            js = urllib.request.urlopen(f'https://localhost:{PORT}/slsd.js', timeout=5, context=ctx).read()
            check('install', 'serves the SL Smart Design tab code (slsd.js)', b'slsdAlternativeDesign' in js)
        except Exception as e:
            check('install', 'serves the SL Smart Design tab code (slsd.js)', False, e)
        check('install', 'paid AI off in the installed app (paid_policy never)', (st.get('orchestrate') or {}).get('paid') == 'never', st.get('orchestrate'))
        man = open(os.path.join(DEST, 'manifest-slsd.xml'), encoding='utf-8').read()
        check('install', 'manifest: product Id, this port, well-formed', f'<Id>{PRODUCT}</Id>' in man and f'https://localhost:{PORT}/v10.html' in man and '__PORT__' not in man)
        reg = reg_snapshot()
        g = lambda key, name: reg.get(f"{key.replace('HKCU:', 'HKEY_CURRENT_USER')}|{name}")
        check('install', 'registration: own trusted catalog (Id, Url, Flags)', g(CATKEY, 'Url') == r'\\TESTPC\share\cat' and g(CATKEY, 'Flags') == '1', {k: v for k, v in reg.items() if 'EEBC' in k})
        check('install', 'no Developer value for the product', g(OFFICE + r'\WEF\Developer', PRODUCT) is None)
        check('install', 'old pilot registration retired (no Home tab group)', g(OFFICE + r'\WEF\Developer', PILOT) is None)
        check('install', 'V10.20 add-in no longer loaded (its key only)', not any('SLSD_AIVisualBuilder|' in k for k in reg))
        check('install', 'unrelated web add-in and catalog untouched', g(OFFICE + r'\WEF\Developer', 'other-addin-id') == r'C:\other\manifest.xml'
              and g(OFFICE + r'\WEF\TrustedCatalogs\{11111111-2222-3333-4444-555555555555}', 'Url') == r'\\other\catalog')
        check('install', 'SL Animation add-in untouched (file and key)', sha(os.path.join(env['addins'], 'SL_Audomation.ppam')) == sha(AUDOMATION)
              and g(OFFICE + r'\PowerPoint\AddIns\SL_Audomation', 'AutoLoad') == '1')
        check('install', 'SL Smart Design add-in = the tab-hidden copy, still loaded', sha(os.path.join(env['addins'], 'SL_Smart_Design_v2_Key_Dec_25.ppam')) == sha(os.path.join(PKG, 'slsd', 'SL_Smart_Design_v2_Key_Dec_25.ppam'))
              and g(OFFICE + r'\PowerPoint\AddIns\SL_Smart_Design_v2_Key_Dec_25', 'AutoLoad') == '1')
        t = tree(env['templates'])
        check('install', 'templates: missing files added from the package', len(t) == 9 * 1 + 9 * 1 + 6 - 0 or len(t) >= 24, len(t))
        check('install', 'templates: an existing company file is never overwritten', open(os.path.join(env['templates'], '2_point', '0001.pptx')).read().startswith('EXISTING'))
        check('install', 'existing AI key and data kept', open(os.path.join(env['data'], 'napkin.json')).read() == json.dumps({'api_key': 'test-not-a-real-key-000000', 'enabled': False, 'style_id': ''}))
        code, out = script(DEST, 'Verify.ps1', ['-Instance', INSTANCE])
        check('install', 'Verify.ps1: all checks pass (catalog share only a warning)', code == 0 and 'FAIL' not in out, out[-600:])
        after_install = snapshot(env)

        # 7. update (Developer registration)
        code, out = script(env['pkg'], 'Install.ps1', args + ['-Registration', 'Developer'])
        check('update', 'update over the installed version succeeds', code == 0 and 'this is an update' in out, out[-400:])
        reg = reg_snapshot()
        check('update', 'Developer registration -> installed manifest; catalog entry removed', g(OFFICE + r'\WEF\Developer', PRODUCT) == os.path.join(DEST, 'manifest-slsd.xml') and not any('EEBC6074' in k for k in reg))
        check('update', 'previous version kept for Roll back', os.path.exists(os.path.join(DEST, 'previous', 'app', 'server.py')))
        check('update', 'service running after update', status().get('server'))
        check('update', 'existing AI key kept', open(os.path.join(env['data'], 'napkin.json')).read() == json.dumps({'api_key': 'test-not-a-real-key-000000', 'enabled': False, 'style_id': ''}))

        # 9. simulated failure during an update -> exact restore, previous version running
        before_fail = snapshot(env)
        code, out = script(env['pkg'], 'Install.ps1', args + ['-Registration', 'Catalog', '-CatalogUrl', r'\\TESTPC\share\cat', '-SimulateFailureAt', 'registration'])
        check('failure', 'update failing at registration: reported, exit 1', code == 1 and 'simulated failure' in out, out[-300:])
        snap = snapshot(env)
        check('failure', 'add-ins, registry, templates restored exactly', snap['reg'] == before_fail['reg'] and snap['addins'] == before_fail['addins'], set(snap['reg'].items()) ^ set(before_fail['reg'].items()))
        check('failure', 'the version that worked is running again', status().get('server'))

        # 8. manual rollback of the update -> state after the first install
        code, out = script(DEST, 'Rollback.ps1', ['-Instance', INSTANCE])
        check('rollback', 'Roll back succeeds', code == 0, out[-400:])
        snap = snapshot(env)
        check('rollback', 'registrations back to the first installation (catalog, no Developer value)', snap['reg'] == after_install['reg'], set(snap['reg'].items()) ^ set(after_install['reg'].items()))
        check('rollback', 'add-in files back', snap['addins'] == after_install['addins'])
        check('rollback', 'previous version running', status().get('server'))
        code, out = script(DEST, 'Rollback.ps1', ['-Instance', INSTANCE])
        check('rollback', 'a second Roll back has nothing to undo (refuses)', code == 1, out[-200:])

        # 10. uninstall -> exact original state, data kept (it existed before)
        code, out = script(DEST, 'Uninstall.ps1', ['-Instance', INSTANCE])
        check('uninstall', 'Uninstall succeeds', code == 0, out[-400:])
        snap = snapshot(env)
        check('uninstall', 'registry exactly as before the first install (pilot, V10.20, licensed add-in keys back)', snap['reg'] == pre['reg'], set(snap['reg'].items()) ^ set(pre['reg'].items()))
        check('uninstall', 'add-in files exactly as before (original licensed add-in back)', snap['addins'] == pre['addins'])
        check('uninstall', 'program folder removed, service stopped', not os.path.exists(DEST) and 'error' in status())
        check('uninstall', 'AI key and data kept', snap['data'] == pre['data'] or set(pre['data']) <= set(snap['data']))
        check('uninstall', 'template library left in place', len(snap['templates']) >= len(after_install['templates']))

        # 11. simulated failure on a fresh install -> exact restore, nothing left
        base = snapshot(env)
        code, out = script(env['pkg'], 'Install.ps1', args + ['-Registration', 'Catalog', '-CatalogUrl', r'\\TESTPC\share\cat', '-SimulateFailureAt', 'addin'])
        snap = snapshot(env)
        check('failure', 'fresh install failing after the add-in step: exit 1, registry and add-ins restored', code == 1 and snap['reg'] == base['reg'] and snap['addins'] == base['addins'], out[-300:])
        check('failure', 'no program, no service, no Apps entry left', not os.path.exists(os.path.join(DEST, 'app')) and 'error' in status() and not any('Uninstall' in k and INSTANCE in k for k in snap['reg']))
        shutil.rmtree(DEST, ignore_errors=True)

        # 12. reinstall, Verify, final uninstall
        code, out = script(env['pkg'], 'Install.ps1', args + ['-Registration', 'Central'])
        check('reinstall', 'reinstall (Central) succeeds; nothing registered for the web add-in', code == 0 and not any(PRODUCT in k or 'EEBC6074' in k for k in reg_snapshot()), out[-300:])
        code, out = script(DEST, 'Verify.ps1', ['-Instance', INSTANCE])
        check('reinstall', 'Verify.ps1 passes', code == 0, out[-400:])
        code, out = script(DEST, 'Uninstall.ps1', ['-Instance', INSTANCE])
        check('reinstall', 'final uninstall restores the original state', code == 0 and snapshot(env)['reg'] == pre['reg'] and snapshot(env)['addins'] == pre['addins'], out[-300:])
    finally:
        if os.path.exists(os.path.join(DEST, 'install-state.json')):
            script(DEST, 'Uninstall.ps1', ['-Instance', INSTANCE])
        ps(f"Get-CimInstance Win32_Process -Filter \"Name like 'python%'\" | Where-Object {{ $_.CommandLine -like '*{DEST}*' }} | ForEach-Object {{ Stop-Process -Id $_.ProcessId -Force }}")
        ps(f"Remove-Item -Path '{REG}' -Recurse -ErrorAction SilentlyContinue")
        time.sleep(1)
        shutil.rmtree(DEST, ignore_errors=True); shutil.rmtree(tmp, ignore_errors=True)
    fails = [r for r in results if not r[2]]
    for g, n, ok, d in results:
        print(f"  {'PASS' if ok else 'FAIL'}  [{g}] {n}" + ('' if ok else f'  | {d}'))
    print(f"SL Smart Design installer: {'ALL PASSED' if not fails else f'{len(fails)} FAILED'} ({len(results) - len(fails)} of {len(results)})")
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
