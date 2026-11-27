"""Makes Dist_Installer\\SL-Editor-Mac.zip: SL Editor for Mac (10.26), from the folder build-stage.ps1 staged.

The zip holds one folder, "SL Editor": Install SL Editor.command, Uninstall SL Editor.command, READ ME FIRST.txt and
payload\\ (the same app, encrypted activation bundle, company add-ins and manifest template as the Windows installer;
no Windows Python runtime - the Mac uses its own Python 3 and installs Claude's SDK at install time).
The .command files are stored with Unix line endings and execute permission, so a double-click runs them on a Mac.
Usage: python deploy/make-mac-installer.py [--stage "Build_Stage/SL Editor"] [--out Dist_Installer/SL-Editor-Mac.zip]"""
import argparse, json, os, re, sys, time, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SKIP_APP = set()          # every file: the Windows-only modules are imported only on Windows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--stage', default=os.path.join(ROOT, 'Build_Stage', 'SL Editor'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'Dist_Installer', 'SL-Editor-Mac.zip'))
    a = ap.parse_args()
    app = os.path.join(a.stage, 'app')
    for need in (app, os.path.join(app, 'activation-bundle.json'), os.path.join(a.stage, 'manifest-slsd.template.xml')):
        if not os.path.exists(need):
            sys.exit(f'Missing {need}: run deploy\\build-stage.ps1 first (Make-InstallerExe.ps1 does).')
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    tmp = a.out + '.tmp'
    t0, n = time.time(), 0
    with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        def put(arc, data, exe=False):
            nonlocal n
            zi = zipfile.ZipInfo('SL Editor/' + arc, date_time=time.localtime()[:6])
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = ((0o100755 if exe else 0o100644) << 16)
            zi.create_system = 3                                   # Unix: macOS's Archive Utility keeps the permissions
            z.writestr(zi, data)
            n += 1
        for f in ('Install SL Editor.command', 'Uninstall SL Editor.command'):
            put(f, open(os.path.join(HERE, 'mac', f), 'rb').read().replace(b'\r\n', b'\n'), exe=True)
        put('READ ME FIRST.txt', open(os.path.join(HERE, 'mac', 'READ ME FIRST.txt'), 'rb').read())
        for dirpath, dirs, files in os.walk(app):
            dirs[:] = [d for d in dirs if d != '__pycache__']
            for f in files:
                rel = os.path.relpath(os.path.join(dirpath, f), app).replace(os.sep, '/')
                if rel in SKIP_APP or f.endswith('.pyc'):
                    continue
                data = open(os.path.join(dirpath, f), 'rb').read()
                if rel == 'config.json':                            # the Mac runs the company add-ins' commands through AppleScript
                    cfg = json.loads(data.decode('utf-8-sig'))
                    cfg['mac_vba_bridge'] = True
                    data = json.dumps(cfg, indent=2).encode('utf-8')
                put('payload/app/' + rel, data, exe=rel.endswith('.pyw'))
        for f in ('manifest-slsd.template.xml', 'access-template.json'):
            p = os.path.join(a.stage, f)
            if os.path.exists(p):
                put('payload/' + f, open(p, 'rb').read())
        ad = os.path.join(a.stage, 'addins')
        for f in sorted(os.listdir(ad)) if os.path.isdir(ad) else []:
            if re.fullmatch(r'(SL_Smart_Design_v2_Key_Dec_25|SL_Audomation)\.ppam', f):
                put('payload/addins/' + f, open(os.path.join(ad, f), 'rb').read())
    # nothing secret: no plain key, no certificate, no usage or activation record
    with zipfile.ZipFile(tmp) as z:
        bad = [i.filename for i in z.infolist() if re.search(r'/(napkin|claude|activation|access)\.json$|\.pem$|usage\.json$|activation-keys\.csv$', i.filename)]
        leak = [i.filename for i in z.infolist() if i.filename.endswith(('.py', '.pyw', '.js', '.html', '.json', '.txt', '.xml', '.command'))
                and re.search(rb'sk-ant-[A-Za-z0-9_\-]{20,}', z.read(i))]
    if bad or leak:
        os.remove(tmp)
        sys.exit(f'Private files in the Mac package: {bad + leak}')
    os.replace(tmp, a.out)
    print(f'Mac installer: {a.out} ({os.path.getsize(a.out) / 1048576:.1f} MB, {n} files, {time.time() - t0:.0f} s)')


if __name__ == '__main__':
    main()
