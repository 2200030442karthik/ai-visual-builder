"""SL Editor 10.26 - SL Design and SL Animation access (features.py): locked copy, separate keys, expiry, withdrawal.
Uses a small stand-in add-in (no company file needed). Usage: python tests/test_features.py"""
import io, os, sys, tempfile, zipfile
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..'))
import features as F  # noqa: E402

ok = fails = 0


def check(name, cond, info=''):
    global ok, fails
    ok, fails = ok + bool(cond), fails + (not cond)
    print(('PASS ' if cond else 'FAIL ') + name + (f'  | {info}' if not cond and info else ''))


UI = ('<customUI xmlns="http://schemas.microsoft.com/office/2006/01/customui"><ribbon><tabs>'
      '<tab id="t1" label="SL Animation"><group id="g"><button id="b1" label="Fade" onAction="module1.fade_in"/>'
      '<editBox id="e1" label="ID" onChange="module1.set_id"/></group></tab>'
      '<tab id="t2" label="SL Design"><group id="g2"><button id="b2" label="Box" enabled="true" onAction="module1.box"/></group></tab></tabs></ribbon></customUI>')
buf = io.BytesIO()
with zipfile.ZipFile(buf, 'w') as z:
    z.writestr('[Content_Types].xml', '<Types/>'); z.writestr('ppt/presentation.xml', '<p/>')
    z.writestr('ppt/vbaProject.bin', b'REAL-MACROS' * 3000); z.writestr('customUI/customUI.xml', UI)
orig = buf.getvalue()

lk = F.locked_copy(orig)
z = zipfile.ZipFile(io.BytesIO(lk)); x = z.read('customUI/customUI.xml').decode()
check('locked: no macro code (empty VBA project)', z.read('ppt/vbaProject.bin') == F.EMPTY_VBA and b'REAL-MACROS' not in lk)
check('locked: every control disabled, no actions', x.count('enabled="false"') == 3 and 'onAction' not in x and 'onChange' not in x and 'enabled="true"' not in x, x)
check('locked: tabs still visible', 'visible="false"' not in x and 'SL Design' in x and 'SL Animation' in x)
check('locked copy recognised, original not', F.is_locked(lk) and not F.is_locked(orig))

d = tempfile.mkdtemp()
F.addin_path = lambda: os.path.join(d, 'AddIns', 'SL_Audomation.ppam')
os.makedirs(os.path.dirname(F.addin_path())); open(F.addin_path(), 'wb').write(lk)
bundle, rows = F.issue(orig, 3, '2099-12-31', ['Asha'])
bp = os.path.join(d, F.BUNDLE_NAME); F.A._write(bp, bundle)
raw = open(bp, 'rb').read()
check('bundle: the add-in only encrypted, no key in plain text', b'REAL-MACROS' not in raw and not any(r['access_key'].encode() in raw for r in rows))
check('keys: SLDA format', all(r['access_key'].startswith('SLDA-') and len(r['access_key']) == 28 for r in rows))
check('locked before activation', not F.status(d, bp)['ok'])
r = F.activate('AIVB-ABCDE-FGHJK-MNPQR-STVWX', d, bp)
check('an AI SL Smart Design key does not unlock it', not r['ok'] and 'AI SL Smart Design' in r['message'], r)
check('a wrong key is refused', not F.activate('SLDA-00000-00000-00000-00000', d, bp)['ok'])
r = F.activate(rows[0]['access_key'].lower().replace('-', ' '), d, bp)
check('the right key (any case, spaces) activates and places the real add-in', r['ok'] and open(F.addin_path(), 'rb').read() == orig, r)
check('status ok, with the label and expiry', F.status(d, bp)['ok'] and F.status(d, bp)['expires'] == '2099-12-31')
rec = F.A._read(os.path.join(d, F.RECORD_NAME)); rec['expires'] = '2100-01-01'; F.A._write(os.path.join(d, F.RECORD_NAME), rec)
s = F.status(d, bp, locked_addin=lk)
check('a changed record is refused and the locked copy put back', not s['ok'] and s['reason'] == 'changed' and F.is_locked(open(F.addin_path(), 'rb').read()), s)
F.activate(rows[1]['access_key'], d, bp)
open(F.addin_path(), 'wb').write(lk)
check('activated but locked copy in place (reinstall): the real one is put back', F.status(d, bp, locked_addin=lk)['ok'] and not F.is_locked(open(F.addin_path(), 'rb').read()))
bundle['revoked'].append(F.key_id(F.normalize(rows[1]['access_key']))); F.A._write(bp, bundle)
s = F.status(d, bp, locked_addin=lk)
check('a withdrawn key: locked again', not s['ok'] and s['reason'] == 'revoked' and F.is_locked(open(F.addin_path(), 'rb').read()), s)
b2, r2 = F.issue(orig, 1, '2000-01-01'); bp2 = os.path.join(d, 'b2.json'); F.A._write(bp2, b2)
check('an expired key is refused', not F.activate(r2[0]['access_key'], d, bp2)['ok'])
print(f'\nfeatures: {ok}/{ok + fails} passed')
sys.exit(1 if fails else 0)
