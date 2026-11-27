"""SL Editor 10.26 - access to SL Design and SL Animation (the company's SL_Audomation add-in), separate from the AI
activation.

Why: every installation shows the SL Design and SL Animation tabs, but they stay locked (greyed out) until the
administrator gives that user an access key. The AI SL Smart Design activation key does NOT unlock them.

How it is protected:
- The package carries only a LOCKED copy of the add-in: the same ribbon with every button disabled and NO macro code
  (its VBA project replaced by an empty one), so editing that file cannot unlock anything.
- The real add-in is in features-bundle.json, ENCRYPTED with a random data key; each access key (SLDA-XXXXX-XXXXX-XXXXX-
  XXXXX, 100 random bits) unwraps that data key (PBKDF2-HMAC-SHA256, 200,000 rounds, own salt) - the same scheme as
  activation.py. The bundle holds no key in plain text, only salted, wrapped copies.
- An activation is bound to this Windows user and this PC (a record authenticated with the data key, the data key under
  DPAPI), has the key's expiry date, and is checked when the SL Editor service starts: expired, withdrawn or copied
  activations put the locked copy back.
- Limits (said plainly): an offline check; while activated the real add-in is on that PC (it has to be, for PowerPoint
  to run it). Withdrawing a key takes effect with the next package.

Administrator:
    python features.py issue --addin SL_Audomation.ppam --count 25 --expires 2027-03-31 --out deploy\\team-keys [--names names.txt]
        -> features-bundle.json (goes into the package)  and  sled-keys.csv (PRIVATE: the keys to give out)
    python features.py add --bundle <bundle> --count 10 --expires 2027-03-31     (asks one existing key; more keys)
    python features.py revoke --bundle <bundle> --key SLDA-...
"""
import argparse
import csv
import datetime as dt
import getpass
import hmac
import io
import json
import os
import re
import secrets
import shutil
import sys
import zipfile

import activation as A

FEATURE = 'sled'
PREFIX = 'SLDA'
FORMAT = 1
BUNDLE_NAME = 'features-bundle.json'
RECORD_NAME = 'features.json'
ADDIN = 'SL_Audomation'
HINT = 'SLDA-XXXXX-XXXXX-XXXXX-XXXXX'
SIGNED = ('format', 'feature', 'id', 'label', 'expires', 'user', 'machine', 'activated')


# ---------------------------------------------------------------- keys
def new_key():
    raw = ''.join(secrets.choice(A.ALPHABET) for _ in range(20))
    return f'{PREFIX}-' + '-'.join(raw[i:i + 5] for i in range(0, 20, 5))


def normalize(key):
    s = ''.join(ch for ch in str(key or '').upper() if ch.isalnum())
    if s.startswith(PREFIX) and len(s) == 24:
        s = s[len(PREFIX):]
    elif s.startswith(A.PREFIX) and len(s) == 24:
        return ''                         # an AI SL Smart Design key: not for these tools
    s = s.replace('O', '0').replace('I', '1').replace('L', '1')
    return s if len(s) == 20 and all(ch in A.ALPHABET for ch in s) else ''


def key_id(norm):
    return A.hashlib.sha256(b'sled-id:' + norm.encode('ascii')).hexdigest()[:16]


# ---------------------------------------------------------------- the locked add-in
CONTROLS = re.compile(r'<(button|editBox|dropDown|gallery|menu|toggleButton|splitButton|checkBox|comboBox|dynamicMenu)\b[^>]*?(/?)>')


def locked_copy(data):
    """The add-in's ribbon with every control disabled and no VBA project at all (nothing to unlock by editing it)."""
    src, out = zipfile.ZipFile(io.BytesIO(data)), io.BytesIO()
    if A_UI not in src.namelist():
        raise ValueError('the add-in has no ribbon')
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        for info in src.infolist():
            n = info.filename
            if n.endswith('vbaProjectSignature.bin') or n.endswith('vbaProjectSignatureAgile.bin'):
                continue
            b = src.read(n)
            if n == 'ppt/vbaProject.bin':
                b = EMPTY_VBA          # PowerPoint loads only add-ins with a VBA project: an empty one (a comment, no code)
            if n == A_UI:
                x = b.decode('utf-8-sig')

                def off(m):
                    tag = re.sub(r'\s(enabled|getEnabled|onAction|onChange|getText|getPressed|onPressed)="[^"]*"', '', m.group(0))
                    end = '/>' if tag.endswith('/>') else '>'
                    return tag[:-len(end)].rstrip() + ' enabled="false"' + end
                x = CONTROLS.sub(off, x)
                b = x.encode('utf-8')
            z.writestr(info, b)
    res = out.getvalue()
    with zipfile.ZipFile(io.BytesIO(res)) as z:
        if z.read('ppt/vbaProject.bin') != EMPTY_VBA or 'onAction=' in z.read(A_UI).decode('utf-8'):
            raise ValueError('the locked copy still has code')
    return res


A_UI = 'customUI/customUI.xml'
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets', 'sled-locked-vba.bin'), 'rb') as _f:
    EMPTY_VBA = _f.read()           # made by PowerPoint: one module with a comment, no code (no macro can run)


def is_locked(data):
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            return 'ppt/vbaProject.bin' not in z.namelist() or z.read('ppt/vbaProject.bin') == EMPTY_VBA
    except (zipfile.BadZipFile, OSError):
        return False


# ---------------------------------------------------------------- administrator
def _grant(d, label, expires, n):
    key = new_key()
    norm, salt = normalize(key), secrets.token_bytes(16)
    g = json.dumps({'d': A._b64(d), 'label': label, 'expires': expires, 'n': n, 'feature': FEATURE}).encode('utf-8')
    return key, {'id': key_id(norm), 's': A._b64(salt), 'r': A.ROUNDS, 'w': A.seal(A._derive(norm, salt), g)}


def issue(addin_bytes, count, expires, labels=None):
    if A_UI not in zipfile.ZipFile(io.BytesIO(addin_bytes)).namelist() or is_locked(addin_bytes):
        raise ValueError('that is not the original SL_Audomation add-in (it has no macros)')
    labels = list(labels or [])
    count = max(int(count or 0), len(labels))
    d = secrets.token_bytes(32)
    bundle = {'format': FORMAT, 'feature': FEATURE, 'product': 'SL Design and SL Animation', 'created': A._today().isoformat(),
              'payload': A.seal(d, addin_bytes), 'keys': [], 'revoked': []}
    return bundle, _add(bundle, d, count, expires, labels, 1)


def _add(bundle, d, count, expires, labels, first):
    rows = []
    for i in range(count):
        label = labels[i] if i < len(labels) else ''
        key, entry = _grant(d, label, expires, first + i)
        bundle['keys'].append(entry)
        rows.append({'n': first + i, 'access_key': key, 'given_to': label, 'expires': expires})
    return rows


def load_bundle(path):
    b = A._read(path)
    if not b or b.get('feature') != FEATURE or 'payload' not in b or not isinstance(b.get('keys'), list):
        raise ValueError('the SL Design and SL Animation bundle is missing or damaged')
    return b


def unlock(bundle, key):
    norm = normalize(key)
    if not norm:
        if ''.join(ch for ch in str(key or '').upper() if ch.isalnum()).startswith(A.PREFIX):
            return None, 'That is the AI SL Smart Design activation key. SL Design and SL Animation need their own access key (SLDA-...) from your administrator.'
        return None, f'That is not an access key. It looks like {HINT}.'
    kid = key_id(norm)
    if kid in (bundle.get('revoked') or []):
        return None, 'This access key was withdrawn by the administrator.'
    entry = next((k for k in bundle['keys'] if k.get('id') == kid), None)
    raw = entry and A.unseal(A._derive(norm, A._unb64(entry['s']), entry.get('r', A.ROUNDS)), entry['w'])
    if not raw:
        return None, 'This access key is not valid for this installation. Check it, or ask your administrator.'
    g = json.loads(raw.decode('utf-8'))
    g['id'] = kid
    hv = A.hub_verdict(kid, 'features')            # 10.28: the administrator's list (hub.py)
    if hv and hv['state'] == 'revoked':
        return None, hv['message']
    if hv and hv.get('expires'):
        g['expires'] = hv['expires']
    if A._expired(g.get('expires')):
        return None, f'This access key expired on {g.get("expires")}.'
    return g, ''


# ---------------------------------------------------------------- this user and PC
def _mac(d, rec):
    msg = json.dumps({k: rec.get(k) for k in SIGNED}, sort_keys=True, separators=(',', ':')).encode('utf-8')
    return hmac.new(A._sub(d, b'feature-record'), msg, A.hashlib.sha256).hexdigest()


def addin_path():
    if sys.platform == 'darwin':
        return os.path.expanduser('~/Library/Group Containers/UBF8T346G9.Office/User Content.localized/Add-Ins.localized/' + ADDIN + '.ppam')
    # 10.28.1: SL Editor's own copy (addin_tabs.live_dir), never the original in PowerPoint's add-in folder
    data = os.environ.get('AIVB_DATA_DIR') or os.path.join(os.environ.get('LOCALAPPDATA') or os.path.expanduser('~'), 'AIVisualBuilder')
    return os.path.join(data, 'addins-live', ADDIN + '.ppam')


def _put(path, data):
    """Writes the add-in file; False when PowerPoint holds it (it is put in place at the next start of the service)."""
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        tmp = path + '.new'
        with open(tmp, 'wb') as f:
            f.write(data)
        os.replace(tmp, path)
        return True
    except OSError:
        return False


def activate(key, data_dir, bundle_path):
    try:
        bundle = load_bundle(bundle_path)
    except ValueError as e:
        return {'ok': False, 'reason': 'no-bundle', 'message': f'{e}. Reinstall SL Editor.'}
    g, err = unlock(bundle, key)
    if not g:
        return {'ok': False, 'reason': 'invalid', 'message': err}
    d = A._unb64(g['d'])
    addin = A.unseal(d, bundle['payload'])
    if addin is None:
        return {'ok': False, 'reason': 'no-bundle', 'message': 'The SL Design and SL Animation bundle is damaged. Reinstall SL Editor.'}
    rec = {'format': FORMAT, 'feature': FEATURE, 'id': g['id'], 'label': g.get('label') or '', 'expires': g.get('expires') or '',
           'user': A.current_user(), 'machine': A.machine_id(), 'activated': dt.datetime.now().replace(microsecond=0).isoformat()}
    rec['mac'] = _mac(d, rec)
    rec['key'] = A.protect(d)
    A._write(os.path.join(data_dir, RECORD_NAME), rec, private=True)
    placed = _put(addin_path(), addin)
    return dict(status(data_dir, bundle_path, clean=False), placed=placed)


def status(data_dir, bundle_path, clean=True, locked_addin=None):
    """{'ok': True, ...} when this user on this PC may use SL Design and SL Animation. clean: an invalid activation is
    removed and the locked copy put back (locked_addin: its bytes)."""
    def no(reason, message):
        if clean:
            try:
                os.remove(os.path.join(data_dir, RECORD_NAME))
            except OSError:
                pass
            if locked_addin:
                cur = _readb(addin_path())
                if cur is not None and not is_locked(cur):
                    _put(addin_path(), locked_addin)
        return {'ok': False, 'reason': reason, 'message': message}
    rec = A._read(os.path.join(data_dir, RECORD_NAME))
    if not rec:
        return no('not-activated', 'SL Design and SL Animation are locked. Enter the access key from your administrator.')
    try:
        bundle = load_bundle(bundle_path)
        d = A.unprotect(rec.get('key'))
    except (OSError, ValueError, TypeError):
        return no('other-user', 'This access belongs to another user or PC. Enter your own access key.')
    if not hmac.compare_digest(str(rec.get('mac') or ''), _mac(d, rec)):
        return no('changed', 'The access record was changed. Enter your access key again.')
    if str(rec.get('user', '')).lower() != A.current_user().lower() or rec.get('machine') != A.machine_id():
        return no('other-user', 'This access belongs to another user or PC. Enter your own access key.')
    if rec.get('id') in (bundle.get('revoked') or []):
        return no('revoked', 'Your access to SL Design and SL Animation was withdrawn by the administrator.')
    hv = A.hub_verdict(rec.get('id'), 'features')  # 10.28: the administrator's list (hub.py)
    if hv and hv['state'] == 'revoked':
        return no('revoked', hv['message'])
    expires = (hv or {}).get('expires') or rec.get('expires')
    if hv and (hv['state'] in ('pending', 'offline') or A._expired(expires)):
        # locked again (the locked copy goes back), but the record stays: an approval or a new date opens it again
        msg = hv['message'] if hv['state'] in ('pending', 'offline') else f'Your access to SL Design and SL Animation expired on {expires}. Ask your administrator to extend it.'
        if clean and locked_addin:
            cur = _readb(addin_path())
            if cur is not None and not is_locked(cur):
                _put(addin_path(), locked_addin)
        return {'ok': False, 'reason': hv['state'] if hv['state'] != 'ok' else 'expired', 'message': msg, 'hub': True}
    if A._expired(expires):
        return no('expired', f'Your access to SL Design and SL Animation expired on {rec.get("expires")}.')
    left = (dt.date.fromisoformat(expires) - A._today()).days if expires else None
    out = {'ok': True, 'reason': '', 'label': rec.get('label') or '', 'expires': expires or '', 'days_left': left, 'id': rec.get('id')}
    cur = _readb(addin_path())
    if clean and (cur is None or is_locked(cur)):            # activated, but the locked copy is in place: the real one
        addin = A.unseal(d, bundle['payload'])
        out['placed'] = bool(addin) and _put(addin_path(), addin)
    return out


def _readb(p):
    try:
        with open(p, 'rb') as f:
            return f.read()
    except OSError:
        return None


# ---------------------------------------------------------------- command line
def main(argv=None):
    ap = argparse.ArgumentParser(description='SL Design and SL Animation access keys')
    sub = ap.add_subparsers(dest='cmd', required=True)
    i = sub.add_parser('issue')
    i.add_argument('--addin', required=True, help='the ORIGINAL SL_Audomation.ppam')
    i.add_argument('--count', type=int, default=25)
    i.add_argument('--expires', required=True)
    i.add_argument('--out', required=True)
    i.add_argument('--names')
    a = sub.add_parser('add')
    a.add_argument('--bundle', required=True)
    a.add_argument('--count', type=int, default=10)
    a.add_argument('--expires', required=True)
    a.add_argument('--names')
    r = sub.add_parser('revoke')
    r.add_argument('--bundle', required=True)
    r.add_argument('--key', required=True)
    lk = sub.add_parser('locked')
    lk.add_argument('--addin', required=True)
    lk.add_argument('--out', required=True)
    args = ap.parse_args(argv)
    names = []
    if getattr(args, 'names', None):
        with open(args.names, encoding='utf-8-sig') as f:
            names = [ln.strip() for ln in f if ln.strip()]
    if args.cmd == 'issue':
        dt.date.fromisoformat(args.expires)
        with open(args.addin, 'rb') as f:
            bundle, rows = issue(f.read(), args.count, args.expires, names)
        os.makedirs(args.out, exist_ok=True)
        A._write(os.path.join(args.out, BUNDLE_NAME), bundle)
        _csv(os.path.join(args.out, 'sled-keys.csv'), rows, append=False)
        print(f'{len(rows)} access keys: {os.path.join(args.out, "sled-keys.csv")} (PRIVATE). Bundle: {os.path.join(args.out, BUNDLE_NAME)}')
    elif args.cmd == 'add':
        bundle = load_bundle(args.bundle)
        g, err = unlock(bundle, getpass.getpass('One existing SLDA access key of this bundle: '))
        if not g:
            sys.exit(err)
        rows = _add(bundle, A._unb64(g['d']), args.count, args.expires, names, len(bundle['keys']) + 1)
        A._write(args.bundle, bundle)
        _csv(os.path.join(os.path.dirname(os.path.abspath(args.bundle)), 'sled-keys.csv'), rows, append=True)
        print(f'{len(rows)} more access keys added (sled-keys.csv). Rebuild the installers to ship them.')
    elif args.cmd == 'revoke':
        bundle, norm = load_bundle(args.bundle), normalize(args.key)
        if not norm:
            sys.exit('not an SLDA access key')
        bundle.setdefault('revoked', [])
        if key_id(norm) not in bundle['revoked']:
            bundle['revoked'].append(key_id(norm))
        A._write(args.bundle, bundle)
        print('Withdrawn. It takes effect when users install the next package.')
    elif args.cmd == 'locked':
        with open(args.addin, 'rb') as f:
            data = locked_copy(f.read())
        with open(args.out, 'wb') as f:
            f.write(data)
        print(f'locked copy: {args.out} ({len(data)} bytes, no macros)')


def _csv(path, rows, append):
    new = not (append and os.path.exists(path))
    with open(path, 'a' if append else 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=['n', 'access_key', 'given_to', 'expires'])
        if new:
            w.writeheader()
        w.writerows(rows)


if __name__ == '__main__':
    main()
