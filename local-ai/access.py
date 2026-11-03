"""AI Visual Builder 10.8 - who may generate, enforced in the panel host for every Napkin endpoint.

The policy is the administrator's file, kept outside the application source:
    %ProgramData%\\AIVisualBuilder\\access.json     (AIVB_ACCESS overrides the path; tests only)
No file, or an unreadable one: nobody may generate (Napkin endpoints answer 403). Example in access.example.json.

Modes
- "entra": the panel sends the Microsoft Entra ID access token that Office SSO gives the add-in
  (Office.auth.getAccessToken). It is verified here, not in the browser: RS256 signature against the tenant's published
  signing keys, issuer and tenant, audience (the add-in's app registration), expiry, required scope. The user is
  authorized by object id or UPN (allowed_users), app role (allowed_roles: assign the role to a security group in
  Entra) or group id (allowed_groups: needs the "groups" claim). A user-typed e-mail address is never used.
- "windows": the Windows account running the panel host on this PC (allowed_users: "DOMAIN\\user"). For a single PC
  whose user already holds the Napkin key; it cannot restrict that user, who has the key file anyway.

The same policy holds the approved template (Content Slide layout) and the Napkin request limits.
"""
import base64
import getpass
import hashlib
import hmac
import json
import os
import threading
import time
import urllib.request

POLICY_PATH = os.environ.get('AIVB_ACCESS') or os.path.join(os.environ.get('ProgramData') or r'C:\ProgramData', 'AIVisualBuilder', 'access.json')
# The approved template, read from LVC_Template.pptx (30 Oct 2026) and confirmed in PowerPoint Desktop: the content layout
# is named "Content_Slide" (1280 x 720 pt slide) and carries three shapes of its own, all read through PowerPoint's API
# for the selected slide (fingerprint): its content placeholder, its heading placeholder above it, and the strip of
# section tags just right of the slide. A layout merely renamed "Content Slide" in another deck does not have them.
# Not used: the number of layouts (importing a slide from another file adds one) and layout/master ids (PowerPoint
# renumbers them in saved copies).
DEFAULT_TEMPLATE = {'template_name': 'LVC_Template.pptx', 'layout_name': 'Content_Slide', 'master_names': [], 'layout_ids': [], 'master_ids': [],
                    'fingerprint': {'shapes': {'content placeholder': [101.7, 205.0, 1078.5, 435.2], 'heading placeholder': [101.7, 119.1, 1078.5, 71.2],
                                               'section tag strip': [1287.2, 0.0, 80.8, 720.3]}, 'tolerance': 3},
                    'xml_ids': {'master': 2147483673, 'layout': 2147483736, 'layout_creation_id': 189336738}, 'verified': True}
SKEW = 300                      # seconds of clock difference accepted on exp / nbf
JWKS_TTL = 6 * 3600
_jwks, _jwks_lock = {}, threading.Lock()
fetch_json = lambda url: json.load(urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'AIVisualBuilder'}), timeout=15))  # replaced in tests


def policy():
    """The administrator's policy, or None (not configured: generation denied)."""
    try:
        with open(POLICY_PATH, encoding='utf-8') as f:
            p = json.load(f)
    except (OSError, ValueError):
        return None
    if p.get('mode') not in ('entra', 'windows'):
        return None
    p['template'] = dict(DEFAULT_TEMPLATE, **(p.get('template') or {}))
    return p


def _b64(s):
    return base64.urlsafe_b64decode(s + '=' * (-len(s) % 4))


def _rsa_sha256_ok(n, e, data, sig):
    """RSASSA-PKCS1-v1_5 with SHA-256 (RFC 8017), standard library only."""
    k = (n.bit_length() + 7) // 8
    if len(sig) != k:
        return False
    em = pow(int.from_bytes(sig, 'big'), e, n).to_bytes(k, 'big')
    digest_info = bytes.fromhex('3031300d060960864801650304020105000420') + hashlib.sha256(data).digest()
    expected = b'\x00\x01' + b'\xff' * (k - 3 - len(digest_info)) + b'\x00' + digest_info
    return hmac.compare_digest(em, expected)


def _key(tenant, kid):
    url = f'https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys'
    with _jwks_lock:
        cached = _jwks.get(url)
        for attempt in (0, 1):
            if not cached or time.time() - cached[0] > JWKS_TTL or (attempt and kid not in cached[1]):
                keys = {k['kid']: k for k in fetch_json(url).get('keys', []) if k.get('kty') == 'RSA'}
                cached = _jwks[url] = (time.time(), keys)
            if kid in cached[1]:
                k = cached[1][kid]
                return int.from_bytes(_b64(k['n']), 'big'), int.from_bytes(_b64(k['e']), 'big')
    return None


def verify_entra(token, p):
    """Claims of a valid token for this tenant and app, or raises ValueError with the reason."""
    try:
        h64, c64, s64 = token.split('.')
        head, claims = json.loads(_b64(h64)), json.loads(_b64(c64))
    except (ValueError, TypeError):
        raise ValueError('not a valid sign-in token')
    tenant, client = p.get('tenant_id', ''), p.get('client_id', '')
    if head.get('alg') != 'RS256' or not head.get('kid'):
        raise ValueError('unsupported token signature')
    key = _key(tenant, head['kid'])
    if not key or not _rsa_sha256_ok(key[0], key[1], (h64 + '.' + c64).encode(), _b64(s64)):
        raise ValueError('the token signature is not valid')
    now = time.time()
    if claims.get('exp', 0) < now - SKEW or claims.get('nbf', 0) > now + SKEW:
        raise ValueError('the sign-in has expired')
    if claims.get('tid') != tenant or claims.get('iss') not in (f'https://login.microsoftonline.com/{tenant}/v2.0', f'https://sts.windows.net/{tenant}/'):
        raise ValueError('the token is from another organization')
    aud = claims.get('aud', '')
    if not client or not (aud == client or aud.endswith('/' + client) or aud in (p.get('audiences') or [])):
        raise ValueError('the token is not for this add-in')
    scope = p.get('required_scope', 'access_as_user')
    if scope and scope not in str(claims.get('scp', '')).split():
        raise ValueError(f'the token lacks the {scope} permission')
    return claims


def identify(auth_header, p=None):
    """{ok, user, reason}: who is asking and whether the policy allows them to generate."""
    p = policy() if p is None else p
    if not p:
        return {'ok': False, 'user': None, 'reason': 'Access is not configured by the administrator (access.json).'}
    allow = {str(x).lower() for x in p.get('allowed_users') or []}
    if p['mode'] == 'windows':
        dom = os.environ.get('USERDOMAIN', '')
        user = (dom + '\\' if dom else '') + getpass.getuser()
        ok = user.lower() in allow or getpass.getuser().lower() in allow
        return {'ok': ok, 'user': user, 'reason': '' if ok else f'{user} is not on the list of authorized users.'}
    token = auth_header[7:].strip() if (auth_header or '').lower().startswith('bearer ') else ''
    if not token:
        return {'ok': False, 'user': None, 'reason': 'Sign in with your organization account (Office single sign-on).'}
    try:
        c = verify_entra(token, p)
    except ValueError as e:
        return {'ok': False, 'user': None, 'reason': f'Sign-in not accepted: {e}.'}
    except OSError:
        return {'ok': False, 'user': None, 'reason': 'The organization sign-in keys could not be checked (network).'}
    user = c.get('preferred_username') or c.get('upn') or c.get('oid')
    if '_claim_names' in c and 'groups' in (c.get('_claim_names') or {}) and p.get('allowed_groups'):
        groups_note = ' (the token lists too many groups; use allowed_roles or allowed_users)'
    else:
        groups_note = ''
    ok = bool({str(c.get('oid', '')).lower(), str(user).lower()} & allow
              or set(c.get('roles') or []) & set(p.get('allowed_roles') or [])
              or {g.lower() for g in c.get('groups') or []} & {str(g).lower() for g in p.get('allowed_groups') or []})
    return {'ok': ok, 'user': user, 'reason': '' if ok else f'{user} is not authorized to generate visuals{groups_note}.'}


def slide_ok(slide, p):
    """The selected slide the panel reports (layout and master from PowerPoint's API) against the approved template."""
    t = (p or {}).get('template') or DEFAULT_TEMPLATE
    s = slide or {}
    norm = lambda v: ' '.join(str(v or '').lower().replace('_', ' ').split())     # "Content_Slide" = "Content Slide"
    if norm(s.get('layout_name')) != norm(t['layout_name']):
        return False
    if t.get('fingerprint') and s.get('fingerprint_ok') is not True:
        return False
    if t.get('layout_ids') and s.get('layout_id') not in t['layout_ids']:
        return False
    if t.get('master_ids') and s.get('master_id') not in t['master_ids']:
        return False
    if t.get('master_names') and norm(s.get('master_name')) not in {norm(m) for m in t['master_names']}:
        return False
    return True
