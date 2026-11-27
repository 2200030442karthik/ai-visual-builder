r"""SL Editor 10.25 - the company's VBA add-ins behind the one SL Editor ribbon.

SL Editor (the web add-in) shows every command of SL Smart Design (SL_Smart_Design_v2_Key_Dec_25.ppam) and of SL Design /
SL Animation (SL_Audomation.ppam) and runs their ORIGINAL macros through PowerPoint (server.py /api/slsd/run). Their own
ribbon tabs would repeat those commands, so PowerPoint loads a COPY of each add-in in which ONLY customUI/customUI.xml
differs (visible="false" on its tabs; VBA project, forms and licence check byte for byte identical - checked).

10.28.1 (owner's rule: work on copies, never change an original): the copies live in SL Editor's own folder
(<data>\addins-live, same file names, so the macros keep their names) and PowerPoint's registration of each add-in points
to the copy while SL Editor is installed. The ORIGINAL files in PowerPoint's add-in folder are never written: anyone who
copies "SL Smart Design" from this PC to a new laptop gets the untouched original. Earlier versions put the copies in
the add-in folder itself; install puts the kept originals back there. Uninstall points PowerPoint back to the originals.

    python addin_tabs.py install --src DIR --data DIR     add-ins in DIR (the package), or this PC's own originals
    python addin_tabs.py restore --data DIR               PowerPoint back to the originals, tabs visible
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


def live_dir(data_dir):
    """10.28.1: where SL Editor keeps the copies PowerPoint loads (never PowerPoint's own add-in folder)."""
    return os.path.join(data_dir, 'addins-live')


def register(name, path=None, on=True):
    """PowerPoint loads the add-ins listed under HKCU\\...\\PowerPoint\\AddIns: Path is a full path (SL Editor's copy) or
    a name in the AddIns folder (the original). on=False removes the entry."""
    if os.name != 'nt':
        return
    import winreg
    key = rf'Software\Microsoft\Office\16.0\PowerPoint\AddIns\{name}'
    if on:
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, key) as k:
            winreg.SetValueEx(k, 'Path', 0, winreg.REG_SZ, path or name + '.ppam')
            winreg.SetValueEx(k, 'AutoLoad', 0, winreg.REG_DWORD, 1)
    else:
        try:
            winreg.DeleteKey(winreg.HKEY_CURRENT_USER, key)
        except OSError:
            pass


def registered_path(name):
    if os.name != 'nt':
        return None
    import winreg
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, rf'Software\Microsoft\Office\16.0\PowerPoint\AddIns\{name}') as k:
            return winreg.QueryValueEx(k, 'Path')[0]
    except OSError:
        return None


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


def _ours(name, here, rec):
    """True when the file in PowerPoint's add-in folder was written by an earlier SL Editor (a hidden or locked copy),
    not a company original."""
    if here is None:
        return False
    if sha(here) in (rec.get('hidden_sha'), rec.get('locked_sha')):
        return True
    t = tabs(here)
    if t and not any(v for _, v in t):
        return True                                             # every tab hidden: a copy, never an original
    if name == LOCKED:
        import features as F
        return F.is_locked(here)
    return False


def install(src, data_dir):
    """Every known add-in as a COPY in SL Editor's folder, registered for PowerPoint; the originals stay as they are.
    The copy is made from this PC's own original when it has one (a newer licensed version stays), else the package's."""
    keep, live = os.path.join(data_dir, 'addins-original'), live_dir(data_dir)
    os.makedirs(keep, exist_ok=True)
    os.makedirs(live, exist_ok=True)
    st = _read_json(os.path.join(data_dir, STATE))
    done = {}
    for name in ADDINS:
        dst, bak, out = os.path.join(addin_dir(), name + '.ppam'), os.path.join(keep, name + '.ppam'), os.path.join(live, name + '.ppam')
        here = open(dst, 'rb').read() if os.path.exists(dst) else None
        rec = st.get(name, {})
        # 1. an earlier SL Editor put its copy in PowerPoint's add-in folder: the original goes back there
        if _ours(name, here, rec):
            if os.path.exists(bak) and tabs(open(bak, 'rb').read()) and not _ours(name, open(bak, 'rb').read(), rec):
                _write(dst, open(bak, 'rb').read())
                here = open(dst, 'rb').read()
            else:
                os.remove(dst)                                   # only ever ours: the PC had no original
                here = None
        # 2. a safety copy of this PC's original (read only; the original itself is never written)
        if here is not None and tabs(here) and not os.path.exists(bak):
            _write(bak, here)
        # 3. SL Editor's copy, registered for PowerPoint
        if name == LOCKED:
            done[name] = install_locked(src, out, st)
            continue
        if here is not None and tabs(here):
            orig = here
        elif os.path.exists(bak) and tabs(open(bak, 'rb').read()):
            orig = open(bak, 'rb').read()
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
        _write(out, hid)
        register(name, out)
        st[name] = {'original_sha': sha(orig), 'hidden_sha': sha(hid), 'live': out, 'at': time.strftime('%Y-%m-%dT%H:%M:%S')}
        done[name] = 'installed (copy)'
    with open(os.path.join(data_dir, STATE), 'w', encoding='utf-8') as f:
        json.dump(st, f, indent=1)
    return done


LOCKED = 'SL_Audomation'       # 10.26: SL Design and SL Animation - visible but locked until access is given (features.py)


def install_locked(src, out, st):
    """The LOCKED SL_Audomation copy (tabs visible, every button disabled, no macro code) in SL Editor's folder. Access
    (features.py, the SL Editor service) puts the real add-in in place of this copy - never in the add-in folder."""
    import features as F
    p = os.path.join(src, LOCKED + '.ppam') if src else ''
    if not (p and os.path.exists(p)):
        return 'not available'
    locked = open(p, 'rb').read()
    if not F.is_locked(locked):
        if not tabs(locked):
            raise ValueError('the package must carry the LOCKED SL_Audomation (deploy/build-stage.ps1 makes it)')
        locked = F.locked_copy(locked)      # an older package (before 10.26) carried the add-in itself: locked here
    cur = open(out, 'rb').read() if os.path.exists(out) else None
    if cur is None or F.is_locked(cur):              # access given before: the real copy stays (the service checks it)
        _write(out, locked)
    register(LOCKED, out)
    st[LOCKED] = {'locked_sha': sha(locked), 'live': out, 'at': time.strftime('%Y-%m-%dT%H:%M:%S')}
    return 'installed (locked copy)'


def restore(data_dir):
    """PowerPoint back to the originals: each add-in's registration points to its original in the add-in folder (put
    back from the safety copy only if the folder has none), or is removed; SL Editor's copies are deleted."""
    st, keep, done = _read_json(os.path.join(data_dir, STATE)), os.path.join(data_dir, 'addins-original'), {}
    for name in ADDINS:
        dst, bak, out = os.path.join(addin_dir(), name + '.ppam'), os.path.join(keep, name + '.ppam'), os.path.join(live_dir(data_dir), name + '.ppam')
        here = open(dst, 'rb').read() if os.path.exists(dst) else None
        rec = st.get(name, {})
        if (here is None or _ours(name, here, rec)) and os.path.exists(bak) and tabs(open(bak, 'rb').read()):
            os.makedirs(addin_dir(), exist_ok=True)
            _write(dst, open(bak, 'rb').read())
            here = open(dst, 'rb').read()
        if here is not None and not _ours(name, here, rec):
            register(name)                                   # the original, as before SL Editor
            done[name] = 'original'
        else:
            if here is not None:
                os.remove(dst)
            register(name, on=False)
            done[name] = 'removed (this PC had no original)'
        try:
            os.remove(out)
        except OSError:
            pass
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
