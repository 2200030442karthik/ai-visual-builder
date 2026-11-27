"""10.28.1: SL Editor works on COPIES of the company's add-ins; the originals in PowerPoint's add-in folder are never
changed (addin_tabs.py install / restore, features.py access). Temporary folders and a stand-in registry only."""
import hashlib
import io
import os
import sys
import tempfile
import zipfile

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

ok = fails = 0


def check(name, cond, info=''):
    global ok, fails
    ok += bool(cond)
    fails += not cond
    print(('  PASS  ' if cond else '  FAIL  ') + name + ('' if cond else f'  | {info}'))


def ppam(label, extra=b''):
    b = io.BytesIO()
    with zipfile.ZipFile(b, 'w') as z:
        z.writestr('[Content_Types].xml', '<Types/>')
        z.writestr('ppt/vbaProject.bin', b'VBA' * 9000 + extra)
        z.writestr('customUI/customUI.xml', f'<customUI><ribbon><tabs><tab id="T1" label="{label}"><group id="g"><button id="b" label="x" onAction="Module1.Go"/></group></tab></tabs></ribbon></customUI>')
    return b.getvalue()


sha = lambda b: hashlib.sha256(b).hexdigest()   # noqa: E731
root = tempfile.mkdtemp()
os.environ['APPDATA'] = os.path.join(root, 'Roaming')
os.environ['AIVB_DATA_DIR'] = data = os.path.join(root, 'AIVisualBuilder')
import addin_tabs as AT  # noqa: E402
import features as F  # noqa: E402

REG = {}
AT.register = lambda name, path=None, on=True: REG.__setitem__(name, (path or name + '.ppam') if on else None)
addins, pkg = AT.addin_dir(), os.path.join(root, 'pkg')
os.makedirs(addins)
os.makedirs(pkg)
slsd, audo = ppam('SL Smart Design'), ppam('SL Design', b'real')
locked = F.locked_copy(audo)
open(os.path.join(addins, 'SL_Smart_Design_v2_Key_Dec_25.ppam'), 'wb').write(slsd)
open(os.path.join(addins, 'SL_Audomation.ppam'), 'wb').write(audo)
open(os.path.join(pkg, 'SL_Audomation.ppam'), 'wb').write(locked)
open(os.path.join(pkg, 'SL_Smart_Design_v2_Key_Dec_25.ppam'), 'wb').write(slsd)
orig = {n: sha(open(os.path.join(addins, n + '.ppam'), 'rb').read()) for n in AT.ADDINS}

r = AT.install(pkg, data)
live = AT.live_dir(data)
check('install: originals in the add-in folder byte for byte unchanged', all(sha(open(os.path.join(addins, n + '.ppam'), 'rb').read()) == orig[n] for n in AT.ADDINS), r)
check('install: the copies are in SL Editor\'s folder, same file names', all(os.path.exists(os.path.join(live, n + '.ppam')) for n in AT.ADDINS))
cp = open(os.path.join(live, 'SL_Smart_Design_v2_Key_Dec_25.ppam'), 'rb').read()
check('install: the SL Smart Design copy has its tab hidden, its macros identical', AT.tabs(cp) == [('SL Smart Design', False)]
      and zipfile.ZipFile(io.BytesIO(cp)).read('ppt/vbaProject.bin') == zipfile.ZipFile(io.BytesIO(slsd)).read('ppt/vbaProject.bin'))
check('install: SL_Audomation copy locked until access', F.is_locked(open(os.path.join(live, 'SL_Audomation.ppam'), 'rb').read()))
check('install: PowerPoint registered to the copies', all(REG[n] == os.path.join(live, n + '.ppam') for n in AT.ADDINS), REG)
check('access: features writes SL Editor\'s copy, never the add-in folder', F.addin_path() == os.path.join(live, 'SL_Audomation.ppam'))
check('install again: still no original changed', AT.install(pkg, data) and all(sha(open(os.path.join(addins, n + '.ppam'), 'rb').read()) == orig[n] for n in AT.ADDINS))

# a PC set up by an earlier SL Editor (its copies were written into the add-in folder): the originals go back there
open(os.path.join(addins, 'SL_Smart_Design_v2_Key_Dec_25.ppam'), 'wb').write(AT.hidden_copy(slsd))
open(os.path.join(addins, 'SL_Audomation.ppam'), 'wb').write(locked)
AT.install(pkg, data)
check('upgrade from an earlier version: the originals are back in the add-in folder', all(sha(open(os.path.join(addins, n + '.ppam'), 'rb').read()) == orig[n] for n in AT.ADDINS))

# uninstall: PowerPoint back to the originals, the copies gone
r = AT.restore(data)
check('restore: registered to the originals again, copies removed', all(REG[n] == n + '.ppam' for n in AT.ADDINS) and not any(os.path.exists(os.path.join(live, n + '.ppam')) for n in AT.ADDINS), (r, REG))
check('restore: originals still byte for byte the same', all(sha(open(os.path.join(addins, n + '.ppam'), 'rb').read()) == orig[n] for n in AT.ADDINS))

# a PC that never had the add-ins: copies only; nothing appears in the add-in folder; uninstall unregisters
for n in AT.ADDINS:
    os.remove(os.path.join(addins, n + '.ppam'))
import shutil  # noqa: E402
shutil.rmtree(os.path.join(data, 'addins-original'))
AT.install(pkg, data)
check('new PC: nothing written to the add-in folder', not os.listdir(addins), os.listdir(addins))
AT.restore(data)
check('new PC uninstall: registrations removed', all(REG[n] is None for n in AT.ADDINS), REG)
print(f'addin copies: {ok}/{ok + fails} passed')
sys.exit(1 if fails else 0)
