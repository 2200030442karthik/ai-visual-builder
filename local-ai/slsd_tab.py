r"""AI Visual Builder 10.22 - one SL Smart Design tab on team PCs, without ever losing SL Smart Design.

The SL Smart Design tab of the web add-in (manifest-slsd.xml: Alternative Design, AI Visual Builder, Several slides,
Edit a visual, SL Templates, Miscellaneous, Shape Rename) runs the ORIGINAL macros of the licensed VBA add-in
(SL_Smart_Design_v2_Key_Dec_25.ppam) through server.py /api/slsd/run. For one tab, the VBA add-in's own tab must be
hidden - and that is what made SL Smart Design "disappear" with the earlier installers: they hid it at once, before
PowerPoint showed the web tab (which needs "Add" once from the shared folder).

Here the panel host decides, every 15 seconds, and acts only while PowerPoint is CLOSED:
- hide   when PowerPoint has the web tab in its ribbon cache (it was added from the shared folder) and the add-in file
         is the original: the original is kept byte for byte in the data folder (slsd-original\), and a copy with only
         customUI/customUI.xml changed (visible="false" on its tab; VBA project, forms and licence check identical,
         checked) is written under the same name, so the same registration and the same macros are used;
- restore when the web tab is not there (not added yet, removed, Office cache cleared, catalog unregistered, or the
         administrator switched it off) and the file is our hidden copy: the original comes back byte for byte.
A new licensed version installed by the SL Smart Design administrator (tab visible, different bytes) becomes the new
original. Nothing is ever downloaded or shipped: the copy is made on this PC from this user's own add-in.

Command line (the installer / uninstaller / "Restore SL Smart Design.bat"):
    python slsd_tab.py status | step | restore      [--data-dir D] [--id PRODUCT_ID] [--catalog {GUID}] [--name VBA_NAME]
"""
import argparse
import glob
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import zipfile

PRODUCT_ID = '2f01d600-c9ec-4d94-ade9-69b8b6f0bfa7'            # the SL Smart Design web add-in (team product)
CATALOG_ID = '{EEBC6074-F7DB-4E1A-A3DC-BC2784D4BF34}'          # its trusted shared-folder catalog entry
VBA_NAME = 'SL_Smart_Design_v2_Key_Dec_25'
UI = 'customUI/customUI.xml'
TAB_RE = re.compile(r'<tab\s+id="Template_Selector"[^>]*>')
STATE = 'slsd-tab.json'


def addin_path(name=VBA_NAME):
    return os.path.join(os.environ.get('APPDATA', ''), 'Microsoft', 'AddIns', name + '.ppam')


def sha(b):
    return hashlib.sha256(b).hexdigest()


def tab_visible(data):
    """True / False for the SL Smart Design ribbon, None if the file is not the expected add-in."""
    try:
        with zipfile.ZipFile(__import__('io').BytesIO(data)) as z:
            x = z.read(UI).decode('utf-8-sig')
            if 'ppt/vbaProject.bin' not in z.namelist():
                return None
    except (zipfile.BadZipFile, KeyError, OSError, UnicodeDecodeError):
        return None
    m = TAB_RE.search(x)
    if not m:
        return None
    return 'visible="false"' not in m.group(0)


def hidden_copy(data):
    """The add-in with only its own tab hidden; raises ValueError unless every other part is byte for byte identical."""
    import io
    src, out = zipfile.ZipFile(io.BytesIO(data)), io.BytesIO()
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        for info in src.infolist():
            b = src.read(info.filename)
            if info.filename == UI:
                x = b.decode('utf-8-sig')
                m = TAB_RE.search(x)
                tag = m.group(0)
                new = re.sub(r'\svisible="[^"]*"', ' visible="false"', tag) if 'visible=' in tag else tag[:-1].rstrip('/') + ' visible="false">'
                b = (x[:m.start()] + new + x[m.end():]).encode('utf-8')
            z.writestr(info, b)
    res = out.getvalue()
    a, c = zipfile.ZipFile(io.BytesIO(data)), zipfile.ZipFile(io.BytesIO(res))
    if sorted(a.namelist()) != sorted(c.namelist()) or any(sha(a.read(n)) != sha(c.read(n)) for n in a.namelist() if n != UI):
        raise ValueError('a part other than the ribbon would change')
    if tab_visible(res) is not False:
        raise ValueError('the tab was not hidden')
    return res


def powerpoint_running():
    if os.name != 'nt':
        return True                         # never act where this cannot be checked
    try:
        out = subprocess.run(['tasklist', '/FI', 'IMAGENAME eq POWERPNT.EXE', '/NH', '/FO', 'CSV'], capture_output=True, text=True,
                             timeout=20, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0)).stdout
        return 'POWERPNT' in out.upper()
    except (OSError, subprocess.SubprocessError):
        return True


def catalog_registered(catalog=CATALOG_ID):
    if os.name != 'nt':
        return False
    import winreg
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, rf'Software\Microsoft\Office\16.0\WEF\TrustedCatalogs\{catalog}') as k:
            return bool(winreg.QueryValueEx(k, 'Url')[0])
    except OSError:
        return False


def web_tab_in_powerpoint(product_id=PRODUCT_ID):
    """PowerPoint keeps a ribbon cache entry for a shared-folder add-in once it was added (real PowerPoint, 18 Nov 2026:
    Wef\\AppCommands\\<ver>\\TrustedCatalog\\<id><ver>PowerPoint<lang>)."""
    root = os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Microsoft', 'Office', '16.0', 'Wef', 'AppCommands')
    return bool(glob.glob(os.path.join(root, '*', 'TrustedCatalog', product_id + '*')))


def _read(p):
    try:
        with open(p, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def _write_file(path, data):
    tmp = path + '.aivb-tmp'
    with open(tmp, 'wb') as f:
        f.write(data)
    os.replace(tmp, path)


def status(data_dir, product_id=PRODUCT_ID, catalog=CATALOG_ID, name=VBA_NAME, enabled=True):
    p = addin_path(name)
    st = _read(os.path.join(data_dir, STATE))
    data = open(p, 'rb').read() if os.path.exists(p) else None
    vis = tab_visible(data) if data else None
    ours = bool(data) and sha(data) == st.get('hidden_sha')
    want = bool(enabled and catalog_registered(catalog) and web_tab_in_powerpoint(product_id))
    return {'addin': p, 'present': data is not None, 'tab_visible': vis, 'our_copy': ours, 'web_tab': want,
            'backup': os.path.exists(os.path.join(data_dir, 'slsd-original', name + '.ppam')), 'powerpoint': powerpoint_running(),
            'want': 'hidden' if want else 'visible'}


def step(data_dir, product_id=PRODUCT_ID, catalog=CATALOG_ID, name=VBA_NAME, enabled=True, force_restore=False):
    """One decision; returns what was done ('hidden', 'restored', or '' for nothing)."""
    s = status(data_dir, product_id, catalog, name, enabled and not force_restore)
    if not s['present'] or s['tab_visible'] is None or s['powerpoint']:
        return ''
    p, bdir = s['addin'], os.path.join(data_dir, 'slsd-original')
    bpath, spath = os.path.join(bdir, name + '.ppam'), os.path.join(data_dir, STATE)
    st = _read(spath)
    data = open(p, 'rb').read()
    if s['want'] == 'hidden' and s['tab_visible']:
        hid = hidden_copy(data)                                   # raises (nothing written) if anything else would change
        os.makedirs(bdir, exist_ok=True)
        _write_file(bpath, data)                                  # this PC's current original, byte for byte
        if sha(open(bpath, 'rb').read()) != sha(data):
            raise OSError('the backup of the original add-in could not be verified')
        _write_file(p, hid)
        st.update(original_sha=sha(data), hidden_sha=sha(hid), hidden_at=time.strftime('%Y-%m-%dT%H:%M:%S'))
        with open(spath, 'w', encoding='utf-8') as f:
            json.dump(st, f, indent=1)
        return 'hidden'
    if s['want'] == 'visible' and s['tab_visible'] is False and s['our_copy'] and os.path.exists(bpath):
        orig = open(bpath, 'rb').read()
        if sha(orig) != st.get('original_sha') or tab_visible(orig) is not True:
            raise OSError('the kept original does not match its record; restore it from the SL Smart Design administrator')
        _write_file(p, orig)
        st.update(restored_at=time.strftime('%Y-%m-%dT%H:%M:%S'), hidden_sha='')
        with open(spath, 'w', encoding='utf-8') as f:
            json.dump(st, f, indent=1)
        return 'restored'
    return ''


def main(argv=None):
    ap = argparse.ArgumentParser(description='One SL Smart Design tab (AI Visual Builder team installation)')
    ap.add_argument('cmd', choices=['status', 'step', 'restore'])
    ap.add_argument('--data-dir', default=os.path.join(os.environ.get('LOCALAPPDATA') or os.path.expanduser('~'), 'AIVisualBuilder'))
    ap.add_argument('--id', default=PRODUCT_ID)
    ap.add_argument('--catalog', default=CATALOG_ID)
    ap.add_argument('--name', default=VBA_NAME)
    a = ap.parse_args(argv)
    if a.cmd == 'status':
        print(json.dumps(status(a.data_dir, a.id, a.catalog, a.name)))
        return 0
    try:
        did = step(a.data_dir, a.id, a.catalog, a.name, force_restore=(a.cmd == 'restore'))
    except (OSError, ValueError) as e:
        print(json.dumps({'ok': False, 'error': str(e)}))
        return 1
    s = status(a.data_dir, a.id, a.catalog, a.name)
    ok = not (a.cmd == 'restore' and s['tab_visible'] is False)
    print(json.dumps({'ok': ok, 'done': did, 'tab_visible': s['tab_visible'], 'powerpoint': s['powerpoint']}))
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
