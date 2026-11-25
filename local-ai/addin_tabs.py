r"""SL Editor 10.25 - the company's VBA add-ins behind the one SL Editor ribbon.

SL Editor (the web add-in) shows every command of SL Smart Design (SL_Smart_Design_v2_Key_Dec_25.ppam) and of SL Design /
SL Animation (SL_Audomation.ppam) and runs their ORIGINAL macros through PowerPoint (server.py /api/slsd/run). Their own
ribbon tabs would repeat those commands, so the installer puts a copy of each add-in in PowerPoint's add-in folder in
which ONLY customUI/customUI.xml differs (visible="false" on its tabs; VBA project, forms and licence check byte for
byte identical - checked), registers it to load with PowerPoint, and keeps the original for "restore" (the uninstaller).

    python addin_tabs.py install --src DIR --data DIR     add-ins in DIR (the package), or this PC's own copies
    python addin_tabs.py restore --data DIR               the originals back, tabs visible
    python addin_tabs.py status

Acts only while PowerPoint is closed (it holds the files). Standard library only. Windows only for the registry part.
"""
import argparse
import hashlib
import io
import json
import os
import re
import shutil
import subprocess
import sys
import time
import zipfile

ADDINS = ('SL_Smart_Design_v2_Key_Dec_25', 'SL_Audomation')
UI = 'customUI/customUI.xml'
TAB = re.compile(r'<tab\s[^>]*>')
STATE = 'addin-tabs.json'


def addin_dir():
    return os.path.join(os.environ.get('APPDATA', ''), 'Microsoft', 'AddIns')


def sha(b):
    return hashlib.sha256(b).hexdigest()


def tabs(data):
    """[(tab label, visible)] of a .ppam, or None when it is not a VBA add-in with a ribbon."""
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            if 'ppt/vbaProject.bin' not in z.namelist():
                return None
            x = z.read(UI).decode('utf-8-sig')
    except (zipfile.BadZipFile, KeyError, OSError, UnicodeDecodeError):
        return None
    out = []
    for m in TAB.finditer(x):
        lab = re.search(r'label="([^"]*)"', m.group(0))
        out.append((lab.group(1) if lab else '', 'visible="false"' not in m.group(0)))
    return out or None


def hidden_copy(data):
    """The add-in with all its own ribbon tabs hidden; ValueError unless every other part is byte for byte the same."""
    src, out = zipfile.ZipFile(io.BytesIO(data)), io.BytesIO()
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        for info in src.infolist():
            b = src.read(info.filename)
            if info.filename == UI:
                x = b.decode('utf-8-sig')

                def hide(m):
                    tag = m.group(0)
                    if 'visible=' in tag:
                        return re.sub(r'\svisible="[^"]*"', ' visible="false"', tag)
                    return tag[:-1].rstrip('/') + ' visible="false">' if not tag.endswith('/>') else tag[:-2] + ' visible="false"/>'
                b = TAB.sub(hide, x).encode('utf-8')
            z.writestr(info, b)
    res = out.getvalue()
    a, c = zipfile.ZipFile(io.BytesIO(data)), zipfile.ZipFile(io.BytesIO(res))
    if sorted(a.namelist()) != sorted(c.namelist()) or any(sha(a.read(n)) != sha(c.read(n)) for n in a.namelist() if n != UI):
        raise ValueError('a part other than the ribbon would change')
    if any(v for _, v in (tabs(res) or [('', True)])):
        raise ValueError('a tab was not hidden')
    return res


def powerpoint_running():
    if os.name != 'nt':
        return False
    try:
        out = subprocess.run(['tasklist', '/FI', 'IMAGENAME eq POWERPNT.EXE', '/NH', '/FO', 'CSV'], capture_output=True, text=True,
                             timeout=20, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0)).stdout
        return 'POWERPNT' in out.upper()
    except (OSError, subprocess.SubprocessError):
        return True


def register(name, on=True):
    """PowerPoint loads the add-ins listed under HKCU\\...\\PowerPoint\\AddIns (Path relative to the AddIns folder)."""
    if os.name != 'nt':
        return
    import winreg
    key = rf'Software\Microsoft\Office\16.0\PowerPoint\AddIns\{name}'
    if on:
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, key) as k:
            winreg.SetValueEx(k, 'Path', 0, winreg.REG_SZ, name + '.ppam')
            winreg.SetValueEx(k, 'AutoLoad', 0, winreg.REG_DWORD, 1)


def _read_json(p):
    try:
        with open(p, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def _write(path, data):
    tmp = path + '.sled-tmp'
    with open(tmp, 'wb') as f:
        f.write(data)
    os.replace(tmp, path)


def install(src, data_dir):
    """Every known add-in: this PC's own copy when it has one (a newer licensed version stays), else the package's;
    the original kept in data_dir\\addins-original, the hidden copy installed and registered."""
    os.makedirs(addin_dir(), exist_ok=True)
    keep = os.path.join(data_dir, 'addins-original')
    os.makedirs(keep, exist_ok=True)
    st = _read_json(os.path.join(data_dir, STATE))
    done = {}
    for name in ADDINS:
        dst, bak = os.path.join(addin_dir(), name + '.ppam'), os.path.join(keep, name + '.ppam')
        here = open(dst, 'rb').read() if os.path.exists(dst) else None
        rec = st.get(name, {})
        if here is not None and sha(here) == rec.get('hidden_sha') and os.path.exists(bak):
            orig = open(bak, 'rb').read()                       # installed before: our copy; its original is kept
        elif here is not None and tabs(here):
            orig = here                                          # this PC's own add-in (any version)
            if tabs(orig) and not any(v for _, v in tabs(orig)):
                # a copy hidden by an earlier installer (slsd_tab.py): its kept original, if any, is the real one
                old = os.path.join(data_dir, 'slsd-original', name + '.ppam')
                if os.path.exists(old) and tabs(open(old, 'rb').read()):
                    orig = open(old, 'rb').read()
        else:
            p = os.path.join(src, name + '.ppam') if src else ''
            if not (p and os.path.exists(p)):
                done[name] = 'not available'
                continue
            orig = open(p, 'rb').read()
            if not tabs(orig):
                done[name] = 'not an add-in'
                continue
        hid = hidden_copy(orig) if any(v for _, v in tabs(orig)) else orig
        _write(bak, orig)
        if sha(open(bak, 'rb').read()) != sha(orig):
            raise OSError('the kept original could not be verified')
        _write(dst, hid)
        register(name)
        st[name] = {'original_sha': sha(orig), 'hidden_sha': sha(hid), 'at': time.strftime('%Y-%m-%dT%H:%M:%S')}
        done[name] = 'installed'
    with open(os.path.join(data_dir, STATE), 'w', encoding='utf-8') as f:
        json.dump(st, f, indent=1)
    return done


def restore(data_dir):
    st, keep, done = _read_json(os.path.join(data_dir, STATE)), os.path.join(data_dir, 'addins-original'), {}
    for name in ADDINS:
        dst, bak = os.path.join(addin_dir(), name + '.ppam'), os.path.join(keep, name + '.ppam')
        if not os.path.exists(bak):
            continue
        here = open(dst, 'rb').read() if os.path.exists(dst) else None
        if here is not None and sha(here) != (st.get(name) or {}).get('hidden_sha'):
            done[name] = 'left as it is (changed since)'
            continue
        shutil.copyfile(bak, dst)
        done[name] = 'restored'
    return done


def main(argv=None):
    ap = argparse.ArgumentParser(description='SL Editor: the VBA add-ins behind its ribbon')
    ap.add_argument('cmd', choices=['install', 'restore', 'status'])
    ap.add_argument('--src', default='')
    ap.add_argument('--data', default=os.path.join(os.environ.get('LOCALAPPDATA') or os.path.expanduser('~'), 'AIVisualBuilder'))
    a = ap.parse_args(argv)
    if a.cmd == 'status':
        out = {}
        for n in ADDINS:
            p = os.path.join(addin_dir(), n + '.ppam')
            out[n] = tabs(open(p, 'rb').read()) if os.path.exists(p) else None
        print(json.dumps(out))
        return 0
    if powerpoint_running():
        print(json.dumps({'ok': False, 'error': 'Close PowerPoint first.'}))
        return 2
    try:
        r = install(a.src, a.data) if a.cmd == 'install' else restore(a.data)
    except (OSError, ValueError) as e:
        print(json.dumps({'ok': False, 'error': str(e)}))
        return 1
    print(json.dumps({'ok': True, 'done': r}))
    return 0


if __name__ == '__main__':
    sys.exit(main())
