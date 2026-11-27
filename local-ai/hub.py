"""SL Editor 10.28 - the access hub: the administrator manages every key from one place, the team's network share.

Why: activation keys are checked offline on each PC (activation.py, features.py), so a withdrawn key only stopped with
a new package and nobody could see who used SL Editor. The hub adds one place the administrator controls:

  <share>\\access.json         the access list, SIGNED by the administrator's PC (Ed25519, below): per key its state
                               (active, revoked), its expiry (extends or shortens the date in the key), and the rules:
                               approval mode (a key nobody approved does not work) and the offline grace period
  <share>\\checkins\\<id>.json  one file per key, written by the PC that uses it: who, which PC, when, which version

Every PC reads access.json at start and every 30 minutes (in the background: a share that does not answer never stops
the panel), checks the signature with the public key in the package (hub.json) and keeps the last valid list. Without
the share (off the office network or VPN) the last list counts for grace_days days, then SL Editor asks to connect once.
A list older than the one kept (its seq) is ignored, so an old copy cannot bring a withdrawn key back. Only the PC with
the private key (hub-admin.json in its data folder, protected by Windows DPAPI for its user) can change the list.

Limits, said plainly: the check-in files are not signed (they are a usage view, not a security control); anyone who
can read the share sees key ids, states and dates (no names, no keys); a local administrator who changes the code on
their own PC can get round any offline check.

Administrator, command line (the panel's access page, /admin.html, does the same):
    python hub.py init --share \\\\server\\share\\SL-Editor-Access [--keys deploy\\team-keys]
    python hub.py list
    python hub.py revoke|restore|approve <key id or the key's last 5 characters>
    python hub.py expires <key id or last 5> YYYY-MM-DD
    python hub.py approval on|off
"""
import argparse
import csv
import datetime as dt
import hashlib
import json
import os
import platform
import sys
import threading
import time

import activation as A

CONFIG_NAME = 'hub.json'            # in the package: {"path", "mac_path"?, "public_key", "grace_days"}
CACHE_NAME = 'hub-cache.json'       # this PC: the last valid list and when it was read
ADMIN_NAME = 'hub-admin.json'       # the administrator's PC only: the private key (DPAPI), the share, the key lists
LIST_NAME = 'access.json'
FORMAT = 1
REFRESH = 30 * 60
CHECKIN_EVERY = 6 * 3600

# ---------------------------------------------------------------- Ed25519 (RFC 8032, section 6; standard library only)
_p = 2 ** 255 - 19
_q = 2 ** 252 + 27742317777372353535851937790883648493
_inv = lambda x: pow(x, _p - 2, _p)                                           # noqa: E731
_d = -121665 * _inv(121666) % _p
_sqrt_m1 = pow(2, (_p - 1) // 4, _p)


def _add(P, Q):
    a, b = (P[1] - P[0]) * (Q[1] - Q[0]) % _p, (P[1] + P[0]) * (Q[1] + Q[0]) % _p
    c, d = 2 * P[3] * Q[3] * _d % _p, 2 * P[2] * Q[2] % _p
    e, f, g, h = b - a, d - c, d + c, b + a
    return (e * f, g * h, f * g, e * h)


def _mul(s, P):
    Q = (0, 1, 1, 0)
    while s > 0:
        if s & 1:
            Q = _add(Q, P)
        P = _add(P, P)
        s >>= 1
    return Q


def _eq(P, Q):
    return (P[0] * Q[2] - Q[0] * P[2]) % _p == 0 and (P[1] * Q[2] - Q[1] * P[2]) % _p == 0


def _recover_x(y, sign):
    if y >= _p:
        return None
    x2 = (y * y - 1) * _inv(_d * y * y + 1)
    if x2 == 0:
        return None if sign else 0
    x = pow(x2, (_p + 3) // 8, _p)
    if (x * x - x2) % _p:
        x = x * _sqrt_m1 % _p
    if (x * x - x2) % _p:
        return None
    if (x & 1) != sign:
        x = _p - x
    return x


_gy = 4 * _inv(5) % _p
_gx = _recover_x(_gy, 0)
_G = (_gx, _gy, 1, _gx * _gy % _p)


def _compress(P):
    zi = _inv(P[2])
    x, y = P[0] * zi % _p, P[1] * zi % _p
    return int.to_bytes(y | ((x & 1) << 255), 32, 'little')


def _decompress(s):
    if len(s) != 32:
        return None
    y = int.from_bytes(s, 'little')
    sign, y = y >> 255, y & ((1 << 255) - 1)
    x = _recover_x(y, sign)
    return None if x is None else (x, y, 1, x * y % _p)


def _expand(secret):
    h = hashlib.sha512(secret).digest()
    a = int.from_bytes(h[:32], 'little')
    a &= (1 << 254) - 8
    a |= 1 << 254
    return a, h[32:]


def _hq(b):
    return int.from_bytes(hashlib.sha512(b).digest(), 'little') % _q


def public_key(secret):
    return _compress(_mul(_expand(secret)[0], _G))


def sign(secret, msg):
    a, prefix = _expand(secret)
    pub = _compress(_mul(a, _G))
    r = _hq(prefix + msg)
    R = _compress(_mul(r, _G))
    s = (r + _hq(R + pub + msg) * a) % _q
    return R + int.to_bytes(s, 32, 'little')


def verify(pub, msg, sig):
    if len(pub) != 32 or len(sig) != 64:
        return False
    Ap, R = _decompress(pub), _decompress(sig[:32])
    s = int.from_bytes(sig[32:], 'little')
    if not Ap or not R or s >= _q:
        return False
    return _eq(_mul(s, _G), _add(R, _mul(_hq(sig[:32] + pub + msg), Ap)))


# ---------------------------------------------------------------- the signed list
def _canon(payload):
    return json.dumps(payload, sort_keys=True, separators=(',', ':'), ensure_ascii=True).encode('ascii')


def seal_list(secret, payload):
    return {'payload': payload, 'sig': sign(secret, _canon(payload)).hex()}


def open_list(pub_hex, doc):
    """The payload of a list signed by the administrator, or None."""
    try:
        pl = doc['payload']
        if pl.get('format') != FORMAT or not verify(bytes.fromhex(pub_hex), _canon(pl), bytes.fromhex(doc['sig'])):
            return None
        return pl
    except (KeyError, TypeError, ValueError, AttributeError):
        return None


def _now():
    return dt.datetime.now().replace(microsecond=0)


def _read(path):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def _write(path, data):
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=1)
    for i in range(5):              # a virus scanner or another PC reading the file can hold it for a moment
        try:
            os.replace(tmp, path)
            return
        except PermissionError:
            if i == 4:
                raise
            time.sleep(0.2 * (i + 1))


# ---------------------------------------------------------------- every PC
def load_config(app_dir):
    """The package's hub settings, or None when this installation has no hub (then nothing changes)."""
    c = _read(os.path.join(app_dir, CONFIG_NAME))
    if not c or not isinstance(c.get('public_key'), str) or len(c['public_key']) != 64:
        return None
    path = c.get('mac_path') if sys.platform == 'darwin' else c.get('path')
    if not path:
        return None                       # a Mac without a mounted share: the keys' own dates count, as before
    return {'path': path, 'public_key': c['public_key'], 'grace_days': int(c.get('grace_days') or 7)}


class Hub:
    """The list this PC goes by (cached), refreshed in the background; the verdict for a key id."""

    def __init__(self, cfg, data_dir, log=None):
        self.cfg, self.dir, self.log = cfg, data_dir, log or (lambda m: None)
        self.lock = threading.Lock()
        self.cache = _read(os.path.join(data_dir, CACHE_NAME)) or {}
        if not self.cache.get('first_try'):
            self.cache['first_try'] = _now().isoformat()
            self._save()
        self.checked = {}

    def _save(self):
        try:
            os.makedirs(self.dir, exist_ok=True)
            _write(os.path.join(self.dir, CACHE_NAME), self.cache)
        except OSError:
            pass

    def _read_share(self, timeout=20):
        """access.json from the share, read in a thread: a share that does not answer never blocks."""
        box = {}

        def run():
            box['doc'] = _read(os.path.join(self.cfg['path'], LIST_NAME))
        t = threading.Thread(target=run, daemon=True)
        t.start()
        t.join(timeout)
        return box.get('doc')

    def refresh(self):
        doc = self._read_share()
        pl = open_list(self.cfg['public_key'], doc) if doc else None
        with self.lock:
            if doc and not pl:
                self.log('hub: the access list on the share is not signed by the administrator; ignored')
            if not pl:
                return False
            old = (self.cache.get('payload') or {}).get('seq', 0)
            if pl.get('seq', 0) < old:
                self.log('hub: an older access list on the share; ignored')
                return False
            self.cache.update(payload=pl, fetched=_now().isoformat())
            self._save()
        return True

    def loop(self):
        while True:
            try:
                self.refresh()
            except Exception as e:          # never stops the service
                self.log(f'hub: {type(e).__name__}')
            time.sleep(REFRESH)

    def start(self):
        threading.Thread(target=self.loop, daemon=True).start()

    def verdict(self, kid, kind='ai'):
        """{'state': 'ok'|'revoked'|'pending'|'offline', 'expires': date or None, 'message'}."""
        with self.lock:
            pl, fetched = self.cache.get('payload'), self.cache.get('fetched') or self.cache.get('first_try')
        if not pl:
            # never read here (the hub folder is not reachable from this PC): the keys' own dates and withdrawals count,
            # as before the hub - a PC that cannot see the folder is never locked out by it
            return {'state': 'ok', 'expires': None, 'message': ''}
        grace = pl.get('grace_days') or self.cfg['grace_days']
        try:
            age = (_now() - dt.datetime.fromisoformat(fetched)).total_seconds() / 86400
        except (TypeError, ValueError):
            age = 0
        if age > grace:
            return {'state': 'offline', 'expires': None,
                    'message': f'SL Editor could not check your access for {int(age)} days. Connect to the office network or VPN once, then open SL Editor again.'}
        e =(pl.get('keys') or {}).get(kid)
        what = 'SL Design and SL Animation' if kind == 'features' else 'SL Editor'
        if e and e.get('status') == 'revoked':
            return {'state': 'revoked', 'expires': None, 'message': f'Your access to {what} was withdrawn by the administrator.'}
        if (not e or e.get('status') != 'active') and pl.get('approval'):
            return {'state': 'pending', 'expires': None, 'message': f'Your key for {what} is waiting for the administrator\'s approval. It works as soon as it is approved (within 30 minutes; reopen SL Editor).'}
        return {'state': 'ok', 'expires': (e or {}).get('expires') or None, 'message': ''}

    def checkin(self, kid, info):
        """This PC's use of a key, for the administrator's view (at most every 6 hours per key; never blocks)."""
        if not kid or time.time() - self.checked.get(kid, 0) < CHECKIN_EVERY:
            return
        self.checked[kid] = time.time()
        rec = dict(info, key=kid, user=A.current_user(), pc=platform.node(), last=_now().isoformat())

        def run():
            try:
                d = os.path.join(self.cfg['path'], 'checkins')
                os.makedirs(d, exist_ok=True)
                p = os.path.join(d, kid + '.json')
                old = _read(p) or {}
                rec['first'] = old.get('first') or rec['last']
                _write(p, rec)
            except OSError:
                pass
        threading.Thread(target=run, daemon=True).start()


# ---------------------------------------------------------------- the administrator's PC
def admin_load(data_dir):
    a = _read(os.path.join(data_dir, ADMIN_NAME))
    if not a:
        return None
    try:
        a['secret'] = A.unprotect(a['key'])
    except Exception:
        return None                       # another user or PC: not the administrator here
    return a


def is_admin(data_dir):
    return admin_load(data_dir) is not None


def admin_init(data_dir, share, keys_dir=None, grace_days=7):
    """The signing key (on this PC, for this user only), the first list on the share and hub.json for the package."""
    if admin_load(data_dir):
        raise ValueError('this PC already manages an access hub')
    import secrets
    secret = secrets.token_bytes(32)
    pub = public_key(secret).hex()
    os.makedirs(share, exist_ok=True)
    os.makedirs(os.path.join(share, 'checkins'), exist_ok=True)
    payload = {'format': FORMAT, 'seq': 1, 'issued': _now().isoformat(), 'approval': False, 'grace_days': grace_days, 'keys': {}}
    _write(os.path.join(share, LIST_NAME), seal_list(secret, payload))
    os.makedirs(data_dir, exist_ok=True)
    a = {'format': FORMAT, 'share': share, 'keys_dir': keys_dir or '', 'public_key': pub, 'key': A.protect(secret)}
    _write(os.path.join(data_dir, ADMIN_NAME), a)
    A._private(os.path.join(data_dir, ADMIN_NAME))
    return {'path': share, 'public_key': pub, 'grace_days': grace_days}


def _iso(s):
    """A date as the key lists hold it (2027-03-31, or 3/31/2027 after Excel saved the file) -> YYYY-MM-DD, or ''."""
    s = str(s or '').strip()
    for fmt in ('%Y-%m-%d', '%m/%d/%Y', '%d-%m-%Y', '%Y/%m/%d'):
        try:
            return dt.datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            pass
    return ''


def _keys_from_csv(keys_dir):
    """{key id: {name, kind, tail, expires}} from the administrator's private key lists (never leaves this PC)."""
    import features as F
    out = {}
    for fn, kind, norm, kid in (('activation-keys.csv', 'ai', A.normalize, A.key_id), ('sled-keys.csv', 'features', F.normalize, F.key_id)):
        p = os.path.join(keys_dir or '', fn)
        if not keys_dir or not os.path.exists(p):
            continue
        with open(p, encoding='utf-8-sig') as f:
            for row in csv.DictReader(f):
                k = row.get('activation_key') or row.get('access_key') or next((v for v in row.values() if v and '-' in v and len(v) > 20), '')
                n = norm(k)
                if n:
                    out[kid(n)] = {'name': row.get('given_to') or '', 'kind': kind, 'tail': n[-5:], 'expires': _iso(row.get('expires'))}
    return out


def admin_overview(data_dir):
    a = admin_load(data_dir)
    if not a:
        raise PermissionError('this PC does not manage the access hub')
    doc = _read(os.path.join(a['share'], LIST_NAME))
    pl = open_list(a['public_key'], doc) if doc else None
    if not pl:
        raise ValueError(f'the access list on {a["share"]} cannot be read or is not signed by this PC')
    known = _keys_from_csv(a.get('keys_dir'))
    seen = {}
    cdir = os.path.join(a['share'], 'checkins')
    try:
        for fn in os.listdir(cdir):
            if fn.endswith('.json'):
                c = _read(os.path.join(cdir, fn))
                if c and c.get('key'):
                    seen[c['key']] = c
    except OSError:
        pass
    rows, names = [], a.get('names') or {}
    for kid in sorted(set(known) | set(pl['keys']) | set(seen)):
        k, e, c = dict(known.get(kid, {})), pl['keys'].get(kid, {}), seen.get(kid, {})
        if names.get(kid):
            k['name'] = names[kid]          # named on the access page (kept on this PC only, never on the share)
        status = e.get('status') or ('pending' if pl.get('approval') else 'active')
        exp = e.get('expires') or k.get('expires') or ''
        if status == 'active' and exp and A._expired(exp):
            status = 'expired'
        rows.append({'id': kid, 'name': k.get('name') or c.get('label') or '', 'kind': k.get('kind') or c.get('kind') or '', 'tail': k.get('tail') or '',
                     'status': status, 'expires': exp, 'user': c.get('user') or '', 'pc': c.get('pc') or '', 'last': c.get('last') or '',
                     'first': c.get('first') or '', 'version': c.get('version') or ''})
    rows.sort(key=lambda r: (not r['last'], [-ord(ch) for ch in r['last']], r['kind'], r['tail']))   # in use first, latest first
    return {'share': a['share'], 'seq': pl['seq'], 'issued': pl['issued'], 'approval': bool(pl.get('approval')), 'grace_days': pl.get('grace_days'), 'rows': rows}


def admin_change(data_dir, action, kid=None, value=None):
    """One change, signed and published at once: revoke, restore, approve, expires (value YYYY-MM-DD), approval (on/off),
    grace (days)."""
    a = admin_load(data_dir)
    if not a:
        raise PermissionError('this PC does not manage the access hub')
    if action == 'name':                  # a person's name for a key: on this PC only (the share has no names)
        raw = _read(os.path.join(data_dir, ADMIN_NAME))
        raw.setdefault('names', {})[str(kid)] = str(value or '').strip()[:80]
        _write(os.path.join(data_dir, ADMIN_NAME), raw)
        return admin_overview(data_dir)
    path = os.path.join(a['share'], LIST_NAME)
    pl = open_list(a['public_key'], _read(path) or {})
    if not pl:
        raise ValueError('the access list on the share cannot be read or is not signed by this PC')
    keys = pl.setdefault('keys', {})
    if action in ('revoke', 'restore', 'approve', 'expires'):
        if not kid:
            raise ValueError('which key?')
        if len(kid) != 16:              # the last characters of a key, as the administrator sees them
            known = _keys_from_csv(a.get('keys_dir'))
            m = [i for i, k in known.items() if k['tail'] == str(kid).upper()[-5:]]
            if len(m) != 1:
                raise ValueError('no single key ends with ' + str(kid))
            kid = m[0]
        e = keys.setdefault(kid, {'status': 'active'})
        if action == 'revoke':
            e['status'] = 'revoked'
        elif action in ('restore', 'approve'):
            e['status'] = 'active'
        else:
            dt.date.fromisoformat(str(value))
            e['expires'] = str(value)
    elif action == 'approval':
        pl['approval'] = value in (True, 'on', '1', 1, 'true')
        if pl['approval']:                # keys already in use stay approved; only new ones wait
            for kid2 in list(admin_overview_seen(a)):
                keys.setdefault(kid2, {'status': 'active'})
    elif action == 'grace':
        pl['grace_days'] = max(1, min(60, int(value)))
    else:
        raise ValueError('unknown change')
    pl['seq'] = int(pl.get('seq', 0)) + 1
    pl['issued'] = _now().isoformat()
    _write(path, seal_list(a['secret'], pl))
    return admin_overview(data_dir)


def admin_overview_seen(a):
    try:
        return [fn[:-5] for fn in os.listdir(os.path.join(a['share'], 'checkins')) if fn.endswith('.json')]
    except OSError:
        return []


# ---------------------------------------------------------------- command line
def main(argv=None):
    ap = argparse.ArgumentParser(description='SL Editor access hub (administrator)')
    ap.add_argument('--data-dir', default=os.path.join(os.environ.get('LOCALAPPDATA') or os.path.expanduser('~'), 'AIVisualBuilder'))
    sub = ap.add_subparsers(dest='cmd', required=True)
    i = sub.add_parser('init')
    i.add_argument('--share', required=True)
    i.add_argument('--keys', default='')
    i.add_argument('--grace', type=int, default=7)
    i.add_argument('--out', default='', help='where to write hub.json for the package (default: next to this file)')
    sub.add_parser('list')
    for c in ('revoke', 'restore', 'approve'):
        sub.add_parser(c).add_argument('key')
    e = sub.add_parser('expires')
    e.add_argument('key')
    e.add_argument('date')
    sub.add_parser('approval').add_argument('on_off', choices=['on', 'off'])
    args = ap.parse_args(argv)
    if args.cmd == 'init':
        cfg = admin_init(args.data_dir, args.share, os.path.abspath(args.keys) if args.keys else '', args.grace)
        out = args.out or os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'deploy', CONFIG_NAME)
        _write(out, cfg)
        print(f'Access hub ready on {args.share}.\n  {out}  (goes into the package: the public key, no secret)')
        return 0
    if args.cmd == 'list':
        o = admin_overview(args.data_dir)
        print(f'{o["share"]}  list {o["seq"]} of {o["issued"]}  approval {"on" if o["approval"] else "off"}  grace {o["grace_days"]} days')
        for r in o['rows']:
            print(f'  {r["tail"] or r["id"]:<17} {r["kind"]:<9} {r["status"]:<8} {r["expires"]:<11} {r["name"][:24]:<24} {r["user"]} {r["pc"]} {r["last"]}')
        return 0
    if args.cmd in ('revoke', 'restore', 'approve'):
        admin_change(args.data_dir, args.cmd, args.key)
    elif args.cmd == 'expires':
        admin_change(args.data_dir, 'expires', args.key, args.date)
    elif args.cmd == 'approval':
        admin_change(args.data_dir, 'approval', value=args.on_off)
    print('Published. PCs pick it up within 30 minutes (or when SL Editor starts).')
    return 0


if __name__ == '__main__':
    sys.exit(main())
