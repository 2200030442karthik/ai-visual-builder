"""AI Visual Builder - activation keys for team installations (V10.22).

Why: the team package carries the organization's Claude and Napkin keys, so that an activated user has the complete
app right after installing. The keys are stored ENCRYPTED in activation-bundle.json: only a valid activation key
unlocks them, and the panel host (server.py, team mode) serves nothing until this Windows user on this PC is activated.

Administrator - make activation keys (keys read from %LOCALAPPDATA%\\AIVisualBuilder\\claude.json and napkin.json,
or typed with --ask; never printed):
    python activation.py issue --count 25 --expires 2027-03-31 --out <folder> [--names names.txt]
        <folder>\\activation-bundle.json   goes into the package (encrypted; deploy/build-team-package.ps1)
        <folder>\\activation-keys.csv      the manager's list of keys - NEVER in the package, never in git
    python activation.py add --bundle <bundle> --count 10 --expires 2027-03-31   (asks one existing key; more keys)
    python activation.py revoke --bundle <bundle> --key AIVB-...                 (takes effect with the next package)
User - done by the installer and by the panel's activation page:
    python activation.py activate --data-dir <dir> --bundle <bundle>   (the key is read from standard input)
    python activation.py status --data-dir <dir> --bundle <bundle>

Cryptography (standard library only - the bundled Python runtime has no AES):
- an activation key has 100 random bits (20 Crockford base-32 characters, AIVB-XXXXX-XXXXX-XXXXX-XXXXX);
- PBKDF2-HMAC-SHA256 (200,000 rounds, own salt per key) turns it into a 256-bit key that unwraps the bundle's data key;
- the data key decrypts the AI keys: HMAC-SHA256 in counter mode, authenticated with HMAC-SHA256 (encrypt-then-MAC,
  separate sub-keys, a random nonce per message);
- the activation record on the PC (activation.json in the data folder) names this Windows user and a hash of this
  PC's id, is authenticated with the data key, and keeps the data key under Windows DPAPI (current user), so a copied
  record does not work for another user or on another PC.
Limits (an offline check, said plainly): a local administrator who reads this code can get round it; revocation takes
effect with a new package (or new AI keys). An expired, revoked or foreign activation removes the AI keys from the PC.
"""
import argparse
import base64
import csv
import datetime as dt
import getpass
import hashlib
import hmac
import json
import os
import re
import secrets
import subprocess
import sys

FORMAT = 1
ROUNDS = 200_000
ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'       # Crockford base 32: no I, L, O, U
PREFIX = 'AIVB'
BUNDLE_NAME = 'activation-bundle.json'
RECORD_NAME = 'activation.json'
KEY_FILES = ('napkin.json', 'claude.json')
SIGNED = ('format', 'id', 'label', 'expires', 'user', 'machine', 'activated')
DEFAULT_MODEL = 'claude-opus-5-5'
FORMAT_HINT = 'AIVB-XXXXX-XXXXX-XXXXX-XXXXX'


# ---------------------------------------------------------------- primitives
def _b64(b):
    return base64.b64encode(b).decode('ascii')


def _unb64(s):
    return base64.b64decode(str(s).encode('ascii'))


def _sub(key, label):
    return hmac.new(key, label, hashlib.sha256).digest()


def _stream(key, nonce, n):
    out, i = bytearray(), 0
    while len(out) < n:
        out += hmac.new(key, nonce + i.to_bytes(4, 'big'), hashlib.sha256).digest()
        i += 1
    return bytes(out[:n])


def _xor(a, b):
    return (int.from_bytes(a, 'big') ^ int.from_bytes(b, 'big')).to_bytes(len(a), 'big') if a else b''


def seal(key, data):
    """Encrypts and authenticates bytes with a 32-byte key."""
    nonce = secrets.token_bytes(16)
    ct = _xor(data, _stream(_sub(key, b'enc'), nonce, len(data)))
    return {'n': _b64(nonce), 'c': _b64(ct), 'm': _b64(hmac.new(_sub(key, b'mac'), nonce + ct, hashlib.sha256).digest())}


def unseal(key, box):
    """The bytes, or None when the key is wrong or the box was changed."""
    try:
        nonce, ct, mac = _unb64(box['n']), _unb64(box['c']), _unb64(box['m'])
    except (KeyError, TypeError, ValueError):
        return None
    if not hmac.compare_digest(mac, hmac.new(_sub(key, b'mac'), nonce + ct, hashlib.sha256).digest()):
        return None
    return _xor(ct, _stream(_sub(key, b'enc'), nonce, len(ct)))


def new_key():
    raw = ''.join(secrets.choice(ALPHABET) for _ in range(20))
    return f'{PREFIX}-' + '-'.join(raw[i:i + 5] for i in range(0, 20, 5))


def normalize(key):
    """The 20 characters of an activation key as typed (any case, spaces, dashes, O for 0), or '' if it is not one."""
    s = ''.join(ch for ch in str(key or '').upper() if ch.isalnum())
    if s.startswith(PREFIX) and len(s) == 24:
        s = s[len(PREFIX):]
    s = s.replace('O', '0').replace('I', '1').replace('L', '1')
    return s if len(s) == 20 and all(ch in ALPHABET for ch in s) else ''


def key_id(norm):
    return hashlib.sha256(b'aivb-id:' + norm.encode('ascii')).hexdigest()[:16]


def _derive(norm, salt, rounds=ROUNDS):
    return hashlib.pbkdf2_hmac('sha256', norm.encode('ascii'), salt, int(rounds), 32)


def _today():
    return dt.date.today()


def _expired(expires):
    try:
        return bool(expires) and _today() > dt.date.fromisoformat(expires)
    except ValueError:
        return True


# ---------------------------------------------------------------- this user and PC
def current_user():
    if os.name == 'nt':
        dom, name = os.environ.get('USERDOMAIN', ''), os.environ.get('USERNAME', '')
        return f'{dom}\\{name}' if dom else name
    return getpass.getuser()


def machine_id():
    raw = ''
    if os.name == 'nt':
        try:
            import winreg
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r'SOFTWARE\Microsoft\Cryptography', 0,
                                winreg.KEY_READ | winreg.KEY_WOW64_64KEY) as k:
                raw = winreg.QueryValueEx(k, 'MachineGuid')[0]
        except OSError:
            raw = ''
    if not raw and sys.platform == 'darwin':          # 10.26: the Mac's hardware UUID (its network name can change)
        try:
            import subprocess
            out = subprocess.run(['ioreg', '-rd1', '-c', 'IOPlatformExpertDevice'], capture_output=True, text=True, timeout=10).stdout
            m = re.search(r'"IOPlatformUUID"\s*=\s*"([^"]+)"', out)
            raw = m.group(1) if m else ''
        except Exception:
            raw = ''
    if not raw:
        import platform
        raw = platform.node()
    return hashlib.sha256(('aivb-pc:' + raw.lower()).encode('utf-8')).hexdigest()[:24]


def _dpapi(data, protect):
    import ctypes
    from ctypes import wintypes

    class Blob(ctypes.Structure):
        _fields_ = [('cbData', wintypes.DWORD), ('pbData', ctypes.POINTER(ctypes.c_char))]

    def blob(b):
        buf = ctypes.create_string_buffer(b, len(b))
        return Blob(len(b), ctypes.cast(buf, ctypes.POINTER(ctypes.c_char))), buf

    crypt32, kernel32 = ctypes.windll.crypt32, ctypes.windll.kernel32
    inp, _keep1 = blob(data)
    ent, _keep2 = blob(b'AIVB-activation')
    out = Blob()
    if protect:
        ok = crypt32.CryptProtectData(ctypes.byref(inp), ctypes.c_wchar_p('AI Visual Builder activation'), ctypes.byref(ent),
                                      None, None, 0x1, ctypes.byref(out))
    else:
        ok = crypt32.CryptUnprotectData(ctypes.byref(inp), None, ctypes.byref(ent), None, None, 0x1, ctypes.byref(out))
    if not ok:
        raise OSError('DPAPI refused')
    try:
        return ctypes.string_at(out.pbData, out.cbData)
    finally:
        kernel32.LocalFree(ctypes.cast(out.pbData, ctypes.c_void_p))


def protect(data):
    if os.name == 'nt':
        return 'dpapi:' + _b64(_dpapi(data, True))
    return 'plain:' + _b64(data)        # macOS / tests: the record file is readable by this user only


def unprotect(s):
    kind, _, b = str(s).partition(':')
    if kind == 'dpapi' and os.name == 'nt':
        return _dpapi(_unb64(b), False)
    if kind == 'plain' and os.name != 'nt':
        return _unb64(b)
    raise OSError('not protected for this system')


# ---------------------------------------------------------------- files
def _read(path):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def _write(path, obj, private=False):
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(obj, f, indent=2)
    os.replace(tmp, path)
    if private:
        _private(path)


def _private(path):
    if os.name == 'nt':
        user = os.environ.get('USERNAME')
        if user:
            try:
                subprocess.run(['icacls', path, '/inheritance:r', '/grant:r', f'{user}:(R,W)'], capture_output=True,
                               timeout=20, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            except (OSError, subprocess.SubprocessError):
                pass
    else:
        try:
            os.chmod(path, 0o600)
        except OSError:
            pass


def load_bundle(path):
    b = _read(path)
    if not b or b.get('format') != FORMAT or 'payload' not in b or not isinstance(b.get('keys'), list):
        raise ValueError('the activation bundle is missing or damaged')
    return b


def wipe(data_dir):
    """Removes the AI keys and the activation record (the rest of the data folder stays)."""
    gone = []
    for n in KEY_FILES + (RECORD_NAME,):
        p = os.path.join(data_dir, n)
        if os.path.exists(p):
            try:
                os.remove(p)
                gone.append(n)
            except OSError:
                pass
    return gone


def write_keys(data_dir, sec):
    """The AI keys in the same files and format as "Set AI keys" (napkin.json, claude.json); existing choices kept."""
    done = []
    nk = str(sec.get('napkin_api_key') or '').strip()
    if len(nk) >= 10:
        p = os.path.join(data_dir, 'napkin.json')
        old = _read(p) or {}
        _write(p, {'api_key': nk, 'enabled': True, 'style_id': old.get('style_id') or ''}, private=True)
        done.append('Napkin AI')
    ck = str(sec.get('anthropic_api_key') or '').strip()
    if ck.startswith('sk-ant-'):
        p = os.path.join(data_dir, 'claude.json')
        old = _read(p) or {}
        c = {'api_key': ck, 'enabled': True, 'model': sec.get('claude_model') or old.get('model') or DEFAULT_MODEL}
        for q in ('effort', 'max_tokens', 'prices'):
            if old.get(q):
                c[q] = old[q]
        _write(p, c, private=True)
        done.append('Claude')
    return done


# ---------------------------------------------------------------- administrator
def _grant_entry(d, label, expires, n):
    key = new_key()
    norm, salt = normalize(key), secrets.token_bytes(16)
    grant = json.dumps({'d': _b64(d), 'label': label, 'expires': expires, 'n': n}).encode('utf-8')
    return key, {'id': key_id(norm), 's': _b64(salt), 'r': ROUNDS, 'w': seal(_derive(norm, salt), grant)}


def issue(sec, count, expires, labels=None):
    """A new bundle (new data key) and its activation keys: (bundle, rows)."""
    if not (str(sec.get('anthropic_api_key') or '').startswith('sk-ant-') or len(str(sec.get('napkin_api_key') or '')) >= 10):
        raise ValueError('no Claude or Napkin key to put in the bundle')
    labels = list(labels or [])
    count = max(int(count or 0), len(labels))
    if count < 1:
        raise ValueError('at least one activation key is needed')
    d = secrets.token_bytes(32)
    bundle = {'format': FORMAT, 'product': 'AI Visual Builder', 'created': _today().isoformat(),
              'payload': seal(d, json.dumps(sec).encode('utf-8')), 'keys': [], 'revoked': []}
    rows = _add(bundle, d, count, expires, labels, 1)
    return bundle, rows


def _add(bundle, d, count, expires, labels, first):
    rows = []
    for i in range(count):
        label = labels[i] if i < len(labels) else ''
        key, entry = _grant_entry(d, label, expires, first + i)
        bundle['keys'].append(entry)
        rows.append({'n': first + i, 'activation_key': key, 'given_to': label, 'expires': expires})
    return rows


def unlock(bundle, key):
    """(grant, '') for a valid key, else (None, message for the user)."""
    norm = normalize(key)
    if not norm:
        return None, f'That is not an activation key. It looks like {FORMAT_HINT}.'
    kid = key_id(norm)
    if kid in (bundle.get('revoked') or []):
        return None, 'This activation key was withdrawn by the administrator. Ask your manager for a new one.'
    entry = next((k for k in bundle['keys'] if k.get('id') == kid), None)
    raw = entry and unseal(_derive(norm, _unb64(entry['s']), entry.get('r', ROUNDS)), entry['w'])
    if not raw:
        return None, 'This activation key is not valid for this package. Check it, or ask your manager.'
    g = json.loads(raw.decode('utf-8'))
    g['id'] = kid
    if _expired(g.get('expires')):
        return None, f'This activation key expired on {g.get("expires")}. Ask your manager for a new one.'
    return g, ''


def _mac(d, rec):
    msg = json.dumps({k: rec.get(k) for k in SIGNED}, sort_keys=True, separators=(',', ':')).encode('utf-8')
    return hmac.new(_sub(d, b'record'), msg, hashlib.sha256).hexdigest()


# ---------------------------------------------------------------- user
def activate(key, data_dir, bundle_path):
    """Checks the key, writes this user's AI keys and the activation record. Never returns or logs a secret."""
    try:
        bundle = load_bundle(bundle_path)
    except ValueError as e:
        return {'ok': False, 'reason': 'no-bundle', 'message': f'Activation is not possible: {e}. Reinstall from the team package.'}
    g, err = unlock(bundle, key)
    if not g:
        return {'ok': False, 'reason': 'invalid', 'message': err}
    d = _unb64(g['d'])
    raw = unseal(d, bundle['payload'])
    if raw is None:
        return {'ok': False, 'reason': 'no-bundle', 'message': 'The activation bundle is damaged. Reinstall from the team package.'}
    os.makedirs(data_dir, exist_ok=True)
    done = write_keys(data_dir, json.loads(raw.decode('utf-8')))
    rec = {'format': FORMAT, 'id': g['id'], 'label': g.get('label') or '', 'expires': g.get('expires') or '',
           'user': current_user(), 'machine': machine_id(), 'activated': dt.datetime.now().replace(microsecond=0).isoformat()}
    rec['mac'] = _mac(d, rec)
    rec['key'] = protect(d)
    _write(os.path.join(data_dir, RECORD_NAME), rec, private=True)
    return dict(status(data_dir, bundle_path, clean=False), services=done)


def status(data_dir, bundle_path, clean=True):
    """{'ok': True, label, expires, days_left} when this user on this PC is activated; otherwise ok False, a reason
    and a message. clean: a foreign, changed, expired or withdrawn activation (or AI keys without one) is removed."""
    def no(reason, message):
        if clean:
            wipe(data_dir)
        return {'ok': False, 'reason': reason, 'message': message}
    rec = _read(os.path.join(data_dir, RECORD_NAME))
    if not rec:
        return no('not-activated', 'AI Visual Builder is not activated for this Windows user. Enter the activation key from your manager.')
    try:
        bundle = load_bundle(bundle_path)
    except ValueError:
        return {'ok': False, 'reason': 'no-bundle', 'message': 'The activation bundle is missing. Reinstall from the team package.'}
    try:
        d = unprotect(rec.get('key'))
    except (OSError, ValueError, TypeError):
        return no('other-user', 'This activation belongs to another Windows user or PC. Enter your own activation key.')
    if not hmac.compare_digest(str(rec.get('mac') or ''), _mac(d, rec)):
        return no('changed', 'The activation record was changed. Enter your activation key again.')
    if str(rec.get('user', '')).lower() != current_user().lower() or rec.get('machine') != machine_id():
        return no('other-user', 'This activation belongs to another Windows user or PC. Enter your own activation key.')
    if rec.get('id') in (bundle.get('revoked') or []):
        return no('revoked', 'Your activation key was withdrawn by the administrator. Ask your manager for a new one.')
    if unseal(d, bundle['payload']) is None:
        return no('new-keys', 'This version of AI Visual Builder comes with new AI keys. Enter your activation key again.')
    if _expired(rec.get('expires')):
        return no('expired', f'Your activation expired on {rec.get("expires")}. Ask your manager for a new activation key.')
    left = (dt.date.fromisoformat(rec['expires']) - _today()).days if rec.get('expires') else None
    return {'ok': True, 'reason': '', 'label': rec.get('label') or '', 'expires': rec.get('expires') or '', 'days_left': left,
            'activated': rec.get('activated')}


# ---------------------------------------------------------------- command line
def _secrets_from(args):
    if args.ask:
        sec = {'napkin_api_key': getpass.getpass('Napkin AI API token (Enter to leave out): ').strip(),
               'anthropic_api_key': getpass.getpass('Anthropic (Claude) API key, sk-ant-... (Enter to leave out): ').strip()}
    else:
        src = args.keys_from or os.path.join(os.environ.get('LOCALAPPDATA') or os.path.expanduser('~'), 'AIVisualBuilder')
        n, c = _read(os.path.join(src, 'napkin.json')) or {}, _read(os.path.join(src, 'claude.json')) or {}
        sec = {'napkin_api_key': n.get('api_key') or '', 'anthropic_api_key': c.get('api_key') or ''}
        if c.get('model'):
            sec['claude_model'] = c['model']
    return sec


def _labels(path):
    if not path:
        return []
    with open(path, encoding='utf-8-sig') as f:
        return [ln.strip() for ln in f if ln.strip()]


def _date(s):
    dt.date.fromisoformat(s)
    return s


def _write_rows(path, rows, append=False):
    new = not (append and os.path.exists(path))
    with open(path, 'a' if append else 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['n', 'activation_key', 'given_to', 'expires'])
        if new:
            w.writeheader()
        w.writerows(rows)
    _private(path)


def main(argv=None):
    ap = argparse.ArgumentParser(description='AI Visual Builder activation keys', formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest='cmd', required=True)
    a = sp.add_parser('issue', help='administrator: a new bundle and its activation keys')
    a.add_argument('--count', type=int, default=0)
    a.add_argument('--names', help='a text file, one name per line (each gets a key)')
    a.add_argument('--expires', type=_date, required=True, help='YYYY-MM-DD: the last day the keys work')
    a.add_argument('--out', required=True, help='an empty folder for activation-bundle.json and activation-keys.csv')
    a.add_argument('--keys-from', help='data folder with claude.json / napkin.json (default %%LOCALAPPDATA%%\\AIVisualBuilder)')
    a.add_argument('--ask', action='store_true', help='type the AI keys (hidden) instead')
    a2 = sp.add_parser('add', help='administrator: more activation keys for an existing bundle')
    a2.add_argument('--bundle', required=True)
    a2.add_argument('--count', type=int, default=0)
    a2.add_argument('--names')
    a2.add_argument('--expires', type=_date, required=True)
    r = sp.add_parser('revoke', help='administrator: withdraw an activation key (with the next package)')
    r.add_argument('--bundle', required=True)
    r.add_argument('--key', required=True)
    for name in ('activate', 'status'):
        u = sp.add_parser(name)
        u.add_argument('--data-dir', default=os.path.join(os.environ.get('LOCALAPPDATA') or os.path.expanduser('~'), 'AIVisualBuilder'))
        u.add_argument('--bundle', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), BUNDLE_NAME))
    args = ap.parse_args(argv)

    if args.cmd == 'issue':
        out = os.path.abspath(args.out)
        if os.path.exists(os.path.join(out, BUNDLE_NAME)):
            sys.exit(f'{out} already has a bundle; use another folder (keys already given out would stop working).')
        bundle, rows = issue(_secrets_from(args), args.count, args.expires, _labels(args.names))
        os.makedirs(out, exist_ok=True)
        _write(os.path.join(out, BUNDLE_NAME), bundle)
        _write_rows(os.path.join(out, 'activation-keys.csv'), rows)
        print(f'{len(rows)} activation keys, valid until {args.expires}.\n  {os.path.join(out, BUNDLE_NAME)}  (for the package)\n'
              f'  {os.path.join(out, "activation-keys.csv")}  (the manager\'s list: keep it private, never in the package)')
        return 0
    if args.cmd == 'add':
        bundle = load_bundle(args.bundle)
        g, err = unlock(bundle, getpass.getpass('One activation key of this bundle (hidden): '))
        if not g:
            sys.exit(err)
        first = len(bundle['keys']) + 1
        labels = _labels(args.names)
        rows = _add(bundle, _unb64(g['d']), max(args.count, len(labels)), args.expires, labels, first)
        _write(args.bundle, bundle)
        _write_rows(os.path.join(os.path.dirname(os.path.abspath(args.bundle)), 'activation-keys.csv'), rows, append=True)
        print(f'{len(rows)} activation keys added (rebuild the package to give them out).')
        return 0
    if args.cmd == 'revoke':
        bundle, norm = load_bundle(args.bundle), normalize(args.key)
        if not norm:
            sys.exit('That is not an activation key.')
        bundle.setdefault('revoked', [])
        if key_id(norm) not in bundle['revoked']:
            bundle['revoked'].append(key_id(norm))
        _write(args.bundle, bundle)
        print('Withdrawn. It stops working when this package version is installed; rotate the AI keys to stop it at once.')
        return 0
    if args.cmd == 'activate':
        key = sys.stdin.readline().strip()
        res = activate(key, args.data_dir, args.bundle)
    else:
        res = status(args.data_dir, args.bundle, clean=False)
    print(json.dumps(res))
    return 0 if res.get('ok') else 1


if __name__ == '__main__':
    sys.exit(main())
