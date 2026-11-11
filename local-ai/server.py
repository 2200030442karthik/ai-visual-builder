"""AI Visual Builder V10.8 - lightweight panel host.

Serves the add-in panel (v10.html, gallery.js) at https://localhost:<port>/ and, only when the user has configured a
key, passes Napkin AI requests on so the key never reaches the browser. Python standard library only; about 20 MB
of memory, no GPU, no AI models.

Security:
- Listens on 127.0.0.1 only. Same-origin only: no CORS headers, API calls need the X-AIVB-Client header, the Host
  header must be localhost (blocks DNS rebinding), cross-site fetches are refused.
- The Napkin key is read from %LOCALAPPDATA%\\AIVisualBuilder\\napkin.json (only this user can read it, see
  configure-napkin.ps1) or the NAPKIN_API_KEY environment variable. It is never sent to the panel or logged.
- Napkin is off until configured and enabled; at most one request at a time. No daily cap of its own by default (Napkin's
  credits and rate limits apply); an administrator may set one (napkin_max_per_day, 0 = none).
- Who may generate is the administrator's policy (access.py, %ProgramData%\\AIVisualBuilder\\access.json), checked
  here for every Napkin endpoint (create, status, download, kept results), never only in the panel. No policy: denied.
  A create request must also come from the approved template's Content Slide (the layout the panel reads from
  PowerPoint) and must not repeat the last request word for word unless the user asks again explicitly.
- Claude (claude_visual.py, Anthropic API) is the optional counterpart for comparison, with the same gates; its key is
  read from %LOCALAPPDATA%\\AIVisualBuilder\\claude.json (configure-claude.ps1) or ANTHROPIC_API_KEY, never sent to the panel.
  Its default answer is the content plan (one request, JSON); the panel draws up to 4 layouts from it (plan.js).
- Every Napkin request carries the one approved Simplilearn brand style (NAPKIN_STYLE_ID); no other style_id can be
  sent. Napkin answers an unknown style with its default style plus an "invalid_style_id" warning, so a request with
  that warning is blocked here: its files are never passed on. Text that is not meaningful is refused before
  any request (the same check as the panel's, read from understand.js), so it never uses credits.

Run:  pythonw server.py            (normally started by "Start AI Visual Builder.bat" or at sign-in)
      python server.py --http     (plain HTTP on the same port, for tests in a browser without the certificate)
"""
import hashlib
import json
import os
import re
import socket
import ssl
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import access as A
import claude_visual as C

VERSION = '10.15.0'
HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(os.environ.get('LOCALAPPDATA') or os.path.expanduser('~'), 'AIVisualBuilder')
STATIC = {'/': ('v10.html', 'text/html; charset=utf-8'), '/v10.html': ('v10.html', 'text/html; charset=utf-8'),
          **{f'/{n}.js': (f'{n}.js', 'text/javascript; charset=utf-8') for n in ('gallery', 'understand', 'brand', 'svg2ppt', 'pptx', 'rebuild', 'plan', 'sections', 'original', 'faithful', 'napkin', 'studio', 'orchestrator', 'app')},
          # the ribbon's icons (manifest-v10.xml), served by this host like the panel itself
          **{f'/assets/icon-{n}.png': (f'assets/icon-{n}.png', 'image/png') for n in (16, 32, 64, 80)},
          # design packs (packs/*.js): layout families added without changing the application
          **{f'/packs/{n}': (f'packs/{n}', 'text/javascript; charset=utf-8') for n in os.listdir(os.path.join(HERE, 'packs')) if n.endswith('.js')}}
MAX_BODY = 256 * 1024
MAX_TEXT = 10000

# paid_policy (10.13, orchestrator.js): whether "Generate visuals" may use the paid providers: never | when-needed | always;
# paid_order: "auto" (10.14: by the content - Claude for technical structure, Napkin for concepts) or a fixed list such as
# ["napkin", "claude"] (the next is the fallback). Set by the administrator; the app shows neither.
CONFIG = {'port': 44317, 'napkin_base': 'https://api.napkin.ai', 'napkin_max_per_day': 0, 'napkin_timeout_s': 60, 'claude_max_per_day': 0, 'claude_timeout_s': 300,
          'paid_policy': 'when-needed', 'paid_order': 'auto'}
try:
    with open(os.path.join(HERE, 'config.json'), encoding='utf-8') as f:
        CONFIG.update({k: v for k, v in json.load(f).items() if k in CONFIG})
except (OSError, ValueError):
    pass
if CONFIG['paid_policy'] not in ('never', 'when-needed', 'always'):
    CONFIG['paid_policy'] = 'when-needed'
CONFIG['paid_order'] = ([k for k in CONFIG['paid_order'] if k in ('napkin', 'claude')] or 'auto') if isinstance(CONFIG['paid_order'], list) else 'auto'
PORT = int(sys.argv[sys.argv.index('--port') + 1]) if '--port' in sys.argv else int(CONFIG['port'])   # --port: tests only
ALLOWED_HOSTS = {f'localhost:{PORT}', f'127.0.0.1:{PORT}'}
if '--test' in sys.argv:    # tests only: also serve the test harness and its inputs
    STATIC.update({'/tests/harness.html': ('tests/harness.html', 'text/html; charset=utf-8'),
                   '/tests/diag.html': ('tests/diag.html', 'text/html; charset=utf-8'),
                   '/tests/probe.html': ('tests/probe.html', 'text/html; charset=utf-8'),
                   '/tests/studio.html': ('tests/studio.html', 'text/html; charset=utf-8'),
                   '/tests/original.html': ('tests/original.html', 'text/html; charset=utf-8'),
                   '/tests/faithful.html': ('tests/faithful.html', 'text/html; charset=utf-8'),
                   '/tests/app.html': ('tests/app.html', 'text/html; charset=utf-8'),
                   '/tests/samples.js': ('tests/samples.js', 'text/javascript; charset=utf-8'),
                   '/tests/mock.js': ('tests/mock.js', 'text/javascript; charset=utf-8')})
    for _n in os.listdir(os.path.join(HERE, 'tests', 'fixtures')):   # saved real Napkin outputs (regression fixtures)
        STATIC['/tests/fixtures/' + _n] = ('tests/fixtures/' + _n, 'application/octet-stream')
SCHEME = 'https'
# --test hosts never send a paid request, whatever keys this PC has (10.13: Generate decides on its own)
TEST_NO_PAID = '--test' in sys.argv
CSP = ("default-src 'self'; script-src 'self' 'unsafe-inline' https://appsforoffice.microsoft.com; "
       "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://appsforoffice.microsoft.com; "
       "font-src 'self' data:; connect-src 'self' https://*.microsoft.com https://*.office.com https://*.office.net; "
       "frame-src https://*.microsoft.com https://*.office.com https://*.office.net")


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


# ---------------------------------------------------------------- Napkin AI (https://api.napkin.ai/)
# Documented: Bearer token; POST /v1/visual creates an asynchronous request; GET /v1/visual/{id}/status returns
# generated_files with download URLs (valid 30 minutes, download needs the same Authorization header); every request
# uses paid credits. Verified 29 Oct 2026 with validation errors (no credits): body fields format (png|svg|ppt),
# content, language (BCP 47), number_of_visuals (1-4). Napkin sits behind Cloudflare, which refuses Python's default
# User-Agent ("Python-urllib", error 1010 browser_signature_banned, HTTP 403), so every call sends USER_AGENT.
NAPKIN_FORMATS = {'svg': 'image/svg+xml', 'png': 'image/png', 'ppt':
                  'application/vnd.openxmlformats-officedocument.presentationml.presentation'}
USER_AGENT = f'AIVisualBuilder/{VERSION}'
NAPKIN_HINTS = {'invalid_token': 'the API token is not valid; create a new one in Napkin > Settings > Developers and run "Configure Napkin AI.bat"',
                'token_expired': 'the API token has expired; create a new one and run "Configure Napkin AI.bat"',
                'missing_authorization': 'no token was sent; run "Configure Napkin AI.bat"',
                'insufficient_scope': 'the token lacks the permission for this request; check its Teamspace/API access in Napkin',
                'forbidden': 'this account or Teamspace is not allowed to use the API (check the plan and Teamspace settings)',
                'origin_not_allowed': 'Napkin refused the request origin',
                'browser_signature_banned': "Napkin's Cloudflare edge refused this client's signature (User-Agent)"}
# The one approved Simplilearn Napkin style. Napkin's changelog: an invalid style_id falls back to the default style
# with an "invalid_style_id" warning; sort_strategy "variation" increases layout variety between visuals.
NAPKIN_STYLE_ID = 'EHH64S9R64R64C9DCMSKCSHD6GTPADHDC4SKJC1D68WP6CK66DJ32RV4CGVG'
NAPKIN_VARIATIONS = (1, 4)
NAPKIN_BLOCKED = set()   # request ids whose answer reported invalid_style_id: their files are never served
QUALITY_MSG = 'The content could not be understood. Please enter meaningful text.'
NAPKIN_LOCK = threading.Lock()
NAPKIN_FILES = {}        # request id -> list of generated file URLs (kept server side; the panel only gets indexes)
# The last request's files, kept on disk so they can be checked again and inserted after a panel reload without a new
# (paid) request; only the last request is kept. last.json: {id, format, asked, files}.
NAPKIN_CACHE = os.path.join(DATA_DIR, 'napkin-last')
# Napkin's own rate limiter (FAQ: POST /v1/visual is limited per second/minute/hour/day by plan; responses that hit the
# limiter carry X-RateLimit-Limit/Remaining/Reset/Window). The last values seen are shown in the panel.
NAPKIN_RATE = {}
RATE_HEADERS = ('X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'X-RateLimit-Window', 'Retry-After')
NAPKIN_ERRORS = {'rate_limit_exceeded': "Napkin's rate limit for your plan was reached",
                 'generation_limit_exceeded': "Napkin's generation limit for your plan was reached",
                 'too_many_failed_attempts': 'Napkin paused requests after too many failed attempts',
                 'no_credits': 'your Napkin account has no credits left (top up or wait for the monthly refresh in app.napkin.ai)'}


class NapkinError(Exception):
    def __init__(self, msg, code=502):
        super().__init__(msg)
        self.code = code


# ---------------------------------------------------------------- meaningful-text check (same rules as understand.js)
def _quality_lists():
    try:
        with open(os.path.join(HERE, 'understand.js'), encoding='utf-8') as f:
            src = f.read()
        big = re.search(r"const QUALITY_BIGRAMS = '([^']*)'", src).group(1)
        words = ' '.join(re.findall(r"'([^']*)'", re.search(r"const QUALITY_WORDS = ((?:'[^']*'\s*\+?\s*)+);", src).group(1)))
        return set(big.split()), set(words.split())
    except (OSError, AttributeError):
        return None, None


BIGRAMS, COMMON_WORDS = _quality_lists()


def _plausible(w, proper):
    if not re.search('[aeiouy]', w) or re.search('[bcdfghjklmnpqrstvwxz]{6,}', w) or re.search(r'(.)\1\1', w):
        return False
    if len(w) < 4:
        return w[:2] in BIGRAMS or w[1:3] in BIGRAMS
    hit = sum(1 for i in range(len(w) - 1) if w[i:i + 2] in BIGRAMS)
    return hit / (len(w) - 1) >= (0.25 if proper else 0.6)


def _word_kind(w):
    if re.fullmatch('[A-Z][A-Z0-9&]{1,6}s?', w):
        return 'known'
    lw = re.sub("['’]s$", '', w.lower())
    if lw in COMMON_WORDS or re.sub('(?:es|s|ed|ing|ly|er|ers)$', '', lw) in COMMON_WORDS:
        return 'known'
    if len(lw) < 3:
        return 'short'
    parts = [p for p in re.sub('[^a-zà-ɏ ]', '', re.sub('([a-z])([A-Z])', r'\1 \2', w).lower()).split(' ') if len(p) >= 2]
    return 'word' if parts and all(_plausible(p, bool(re.match('[A-Z]', w))) for p in parts) else 'junk'


def content_quality(text):
    """True when the text could be meaningful (see understand.js contentQuality, which this mirrors)."""
    t = str(text or '').strip()
    if not t:
        return False
    if BIGRAMS is None:                 # understand.js missing: the panel's own check still applies
        return True
    letters = len(re.findall(r'[^\W\d_]', t))
    latin, digits = len(re.findall('[A-Za-zÀ-ɏ]', t)), len(re.findall('[0-9]', t))
    if letters and latin < letters * 0.5:
        return True
    if sum(1 for line in t.split('\n') if line.count('|') >= 2) >= 2:
        return True
    if digits >= 2 and digits >= letters * 0.2:
        return True
    if re.search(r'[=(){}\[\]]', t) and re.search(r'(?:^|[\s(])[A-Za-z_][\w.]*\s*(?:\(|=|:=|\[)', t, re.M | re.A):
        return True
    known = good = junk = 0
    for w in re.findall("[A-Za-zÀ-ɏ]+(?:['’][A-Za-z]+)*", t):
        k = _word_kind(w)
        if k == 'short':
            continue
        if k == 'junk':
            junk += len(w)
            continue
        good += len(w)
        known += k == 'known'
    ratio = good / (good + junk) if good + junk else 0
    return ratio >= 0.6 if known else (ratio >= 0.8 and good >= 5)


def napkin_settings():
    try:
        with open(os.path.join(DATA_DIR, 'napkin.json'), encoding='utf-8') as f:
            s = json.load(f)
    except (OSError, ValueError):
        s = {}
    key = os.environ.get('NAPKIN_API_KEY') or s.get('api_key') or ''
    # napkin.json may still hold an old style_id: it is ignored, only NAPKIN_STYLE_ID is ever sent
    return {'key': key, 'enabled': bool(key) and s.get('enabled', True) is not False}


def napkin_usage(add=0, user=None, name='napkin'):
    path, today = os.path.join(DATA_DIR, f'{name}-usage.json'), time.strftime('%Y-%m-%d')
    try:
        with open(path, encoding='utf-8') as f:
            u = json.load(f)
    except (OSError, ValueError):
        u = {}
    if u.get('day') != today:
        u = {'day': today, 'requests': 0}
    if add:
        u['requests'] += add
        if user:
            u.setdefault('users', {})[user] = u.get('users', {}).get(user, 0) + add
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(u, f)
    return u


def napkin_call(method, url, body=None, raw=False):
    s = napkin_settings()
    if not s['enabled']:
        raise NapkinError('Napkin AI is not configured. Run "Configure Napkin AI.bat" with your API key.', 409)
    if not url.startswith('https://'):
        raise NapkinError('Refusing a non-HTTPS Napkin URL.')
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Authorization': 'Bearer ' + s['key'], 'Accept': '*/*' if raw else 'application/json', 'User-Agent': USER_AGENT,
                                          **({'Content-Type': 'application/json'} if body is not None else {})})
    try:
        with urllib.request.urlopen(req, timeout=CONFIG['napkin_timeout_s']) as r:
            rate_seen(r.headers)
            data = r.read(25 * 1024 * 1024)
            return data if raw else json.loads(data or b'{}')
    except urllib.error.HTTPError as e:
        # Napkin answers {"error": code, "message": text}; Cloudflare in front of it answers {"error_name", "detail", ...}.
        try:
            detail = json.loads(e.read(8192) or b'{}')
        except ValueError:
            detail = {}
        edge = 'error_name' in detail or 'ray_id' in detail or (e.headers.get('Content-Type', '').startswith('text/html') and e.headers.get('CF-RAY'))
        code = str(detail.get('error_name') or detail.get('error') or ('cloudflare_block' if edge else 'http_' + str(e.code)))
        msg = str(detail.get('message') or detail.get('detail') or detail.get('title') or e.reason).replace(s['key'], '<key>')[:300]
        rate_seen(e.headers)
        if code in NAPKIN_ERRORS:      # plan limits and credits: explained, never retried automatically
            wait = e.headers.get('Retry-After') or detail.get('retry_after')
            raise NapkinError(NAPKIN_ERRORS[code] + (f'; Napkin says to wait {wait} s' if wait else '') + '. Nothing was retried.', e.code if e.code in (402, 429) else 400)
        hint = NAPKIN_HINTS.get(code, '')
        log(f'napkin {method} {url.split("?")[0][:80]} -> {e.code} {code} ({"cloudflare edge" if edge else "napkin"})')
        raise NapkinError(f'{"Cloudflare (in front of Napkin)" if edge else "Napkin AI"} answered {e.code} {code}: {msg}' + (f' - {hint}.' if hint else ''),
                          502 if e.code >= 500 else 400)
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        raise NapkinError(f'Napkin AI could not be reached ({e}).')


def rate_seen(headers):
    seen = {k: headers.get(k) for k in RATE_HEADERS if headers and headers.get(k) is not None}
    if seen:
        NAPKIN_RATE.clear()
        NAPKIN_RATE.update(seen, seen_at=time.strftime('%Y-%m-%d %H:%M'))


def limits(p=None, name='napkin'):
    """Optional local caps (0 = none, the default): the administrator's policy, else config.json. Usage is counted either
    way; Napkin's own credits and rate limits (or the Anthropic account's limits) always apply."""
    p = A.policy() if p is None else p
    p = p or {}
    day = p[f'{name}_max_per_day'] if f'{name}_max_per_day' in p else CONFIG[f'{name}_max_per_day']
    return {'per_day': max(0, int(day or 0)), 'per_user_per_day': max(0, int(p.get(f'{name}_max_per_user_per_day') or 0))}


def request_key(content, fmt, variations):
    return hashlib.sha256(f'{fmt}|{variations}|{" ".join(content.split())}'.encode('utf-8')).hexdigest()


def napkin_create(b, who=None):
    content = str(b.get('content') or '').strip()
    fmt = b.get('format') if b.get('format') in NAPKIN_FORMATS else 'svg'
    if not content:
        raise NapkinError('No text to send.', 400)
    if len(content) > MAX_TEXT:
        raise NapkinError(f'Text is longer than {MAX_TEXT} characters.', 400)
    if not b.get('confirmed'):
        raise NapkinError('Napkin requests use paid credits and must be confirmed in the panel.', 400)
    variations = int(b.get('variations') or 1)
    if variations not in NAPKIN_VARIATIONS:
        raise NapkinError('Choose 1 visual or 4 variations.', 400)
    if not content_quality(content):
        raise NapkinError(QUALITY_MSG, 400)
    p = A.policy()
    if not A.slide_ok(b.get('slide'), p):
        raise NapkinError('Select a Content Slide from the approved template.', 403)
    key = request_key(content, fmt, variations)
    if napkin_last().get('key') == key and not b.get('repeat'):
        raise NapkinError('duplicate: this exact request was already made; its results are kept ("Re-check last Napkin result", no credits).', 409)
    if not NAPKIN_LOCK.acquire(blocking=False):
        raise NapkinError('A Napkin request is already running.', 409)
    try:
        lim, used, user = limits(p), napkin_usage(), (who or {}).get('user') or 'local'
        if lim['per_day'] and used['requests'] >= lim['per_day']:
            raise NapkinError(f'The local daily cap of {lim["per_day"]} Napkin requests is reached (set by the administrator: napkin_max_per_day).', 429)
        if lim['per_user_per_day'] and used.get('users', {}).get(user, 0) >= lim['per_user_per_day']:
            raise NapkinError(f'Your daily cap of {lim["per_user_per_day"]} Napkin requests is reached (napkin_max_per_user_per_day).', 429)
        body = {'format': fmt, 'content': content, 'language': str(b.get('language') or 'en-US'),
                'number_of_visuals': variations, 'style_id': NAPKIN_STYLE_ID}
        if variations > 1:
            body['sort_strategy'] = 'variation'      # documented: more different layouts between the visuals
        ctx = str(b.get('context') or '').strip()[:1000]
        if ctx:
            body['context'] = ctx                    # documented (replaces context_before/after): guidance, not drawn as content
        log(f'napkin create: style_id {NAPKIN_STYLE_ID[:4]}...{NAPKIN_STYLE_ID[-4:]}, {variations} visual(s), {fmt}')
        res = napkin_call('POST', CONFIG['napkin_base'] + '/v1/visual', body)
        napkin_usage(1, user)
        rid = res.get('id') or res.get('request_id')
        if style_rejected(res) and rid:
            NAPKIN_BLOCKED.add(rid)
        if rid:
            napkin_last({'id': rid, 'format': fmt, 'asked': variations, 'files': 0, 'key': key, 'source': str(b.get('source') or content)[:MAX_TEXT]}, reset=True)
        return {'id': rid, 'status': res.get('status', 'pending'), 'format': fmt, 'style_id': NAPKIN_STYLE_ID, 'style_rejected': rid in NAPKIN_BLOCKED}
    finally:
        NAPKIN_LOCK.release()


def style_rejected(res):
    """True when Napkin says it did not use our style_id (it then silently uses its default style)."""
    return 'invalid_style_id' in json.dumps(res.get('warnings') or res.get('warning') or [])


def napkin_last(update=None, reset=False, cache=None):
    """The last request's record; update merges into it, reset also removes the previous request's cached files."""
    cache = cache or NAPKIN_CACHE
    path = os.path.join(cache, 'last.json')
    try:
        with open(path, encoding='utf-8') as f:
            last = json.load(f)
    except (OSError, ValueError):
        last = {}
    if update is None:
        return last
    os.makedirs(cache, exist_ok=True)
    if reset:
        for n in os.listdir(cache):
            os.remove(os.path.join(cache, n))
        last = {}
    last.update(update)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(last, f)
    return last


def cached_file(rid, i, cache=None):
    return os.path.join(cache or NAPKIN_CACHE, f'{rid}-{int(i)}.bin')


def napkin_status(rid):
    if not rid or not all(c.isalnum() or c in '-_' for c in rid):
        raise NapkinError('Bad request id.', 400)
    last = napkin_last()
    if last.get('id') == rid and last.get('blocked'):
        NAPKIN_BLOCKED.add(rid)
    if last.get('id') == rid and not last.get('blocked') and last.get('files') and all(os.path.exists(cached_file(rid, i)) for i in range(last['files'])):
        return {'id': rid, 'status': 'completed', 'files': last['files'], 'style_id': NAPKIN_STYLE_ID, 'cached': True}   # no request to Napkin
    res = napkin_call('GET', f"{CONFIG['napkin_base']}/v1/visual/{urllib.parse.quote(rid)}/status")
    files = [f.get('url') if isinstance(f, dict) else f for f in (res.get('generated_files') or [])]
    NAPKIN_FILES[rid] = [u for u in files if isinstance(u, str) and u.startswith('https://')]
    err = res.get('error')
    if style_rejected(res):
        NAPKIN_BLOCKED.add(rid)
    if last.get('id') == rid:
        napkin_last({'files': len(NAPKIN_FILES[rid]), 'blocked': rid in NAPKIN_BLOCKED})
    if rid in NAPKIN_BLOCKED:
        log(f'napkin {rid}: invalid_style_id - files blocked')
        return {'id': rid, 'status': 'failed', 'files': 0, 'style_rejected': True,
                'error': 'Napkin did not accept the approved brand style (invalid_style_id); its default-style result is blocked.'}
    # Napkin's documented warnings (not_enough_visuals, missing_visual_ids, ...), passed on as plain codes for the panel
    warns = res.get('warnings') or res.get('warning') or []
    warns = [str((w.get('code') or w.get('message')) if isinstance(w, dict) else w)[:80] for w in (warns if isinstance(warns, list) else [warns])]
    return {'id': rid, 'status': res.get('status'), 'files': len(NAPKIN_FILES[rid]), 'style_id': NAPKIN_STYLE_ID, 'warnings': warns[:5],
            'error': (err.get('message') or err.get('code')) if isinstance(err, dict) else err}


def napkin_file(rid, i, fmt):
    if rid in NAPKIN_BLOCKED:
        raise NapkinError('This result was not made in the approved brand style and is blocked.', 409)
    ctype = NAPKIN_FORMATS.get(fmt, 'application/octet-stream')
    if os.path.exists(cached_file(rid, i)):
        with open(cached_file(rid, i), 'rb') as f:
            return f.read(), ctype
    urls = NAPKIN_FILES.get(rid) or []
    if not 0 <= i < len(urls):
        raise NapkinError('No such file; check the status first (download links expire after 30 minutes).', 404)
    data = napkin_call('GET', urls[i], raw=True)
    if napkin_last().get('id') == rid:
        with open(cached_file(rid, i), 'wb') as f:
            f.write(data)
    return data, ctype


# ---------------------------------------------------------------- Claude (Anthropic API), for comparison with Napkin
# format 'plan' (default): one request for the content plan (JSON), from which the panel draws up to 4 layouts.
# format 'svg': the same request as Napkin's (structured text + guidance, 1 or 4 variations), answered with SVGs that the
# panel checks and rebuilds exactly as it does Napkin's. Same gates: authorized user, approved Content Slide, meaningful
# text, confirmation, no word-for-word repeat, one request at a time. Claude answers synchronously, so the request runs in
# a background thread and the panel polls /api/claude/status as it does for Napkin. The last result is kept on disk.
CLAUDE_CACHE = os.path.join(DATA_DIR, 'claude-last')
CLAUDE_LOCK = threading.Lock()
CLAUDE_JOBS = {}         # request id -> {status, files, error, warnings, usage, seconds, model}


def claude_create(b, who=None):
    content = str(b.get('content') or '').strip()
    if not content:
        raise NapkinError('No text to send.', 400)
    if len(content) > MAX_TEXT:
        raise NapkinError(f'Text is longer than {MAX_TEXT} characters.', 400)
    if not b.get('confirmed'):
        raise NapkinError('Claude requests are billed to your Anthropic account and must be confirmed in the panel.', 400)
    fmt = 'plan' if b.get('format', 'plan') == 'plan' else 'svg'
    variations = int(b.get('variations') or 1)
    if variations not in NAPKIN_VARIATIONS:
        raise NapkinError('Choose 1 visual or 4 variations.', 400)
    if fmt == 'plan':
        variations = 1          # one request; the panel draws the layouts
    if not content_quality(content):
        raise NapkinError(QUALITY_MSG, 400)
    s = C.settings(DATA_DIR)
    if not s['enabled']:
        raise NapkinError('Claude is not configured. Run "Configure Claude.bat" with your Anthropic API key.' if s['sdk']
                          else 'The anthropic Python package is missing: run "py -m pip install anthropic", then restart the panel host.', 409)
    p = A.policy()
    if not A.slide_ok(b.get('slide'), p):
        raise NapkinError('Select a Content Slide from the approved template.', 403)
    key = request_key(content, 'claude-' + fmt, variations)
    if napkin_last(cache=CLAUDE_CACHE).get('key') == key and not b.get('repeat'):
        raise NapkinError('duplicate: this exact request was already made; its results are kept ("Re-check last Claude result", no cost).', 409)
    if not CLAUDE_LOCK.acquire(blocking=False):
        raise NapkinError('A Claude request is already running.', 409)
    try:
        lim, used, user = limits(p, 'claude'), napkin_usage(name='claude'), (who or {}).get('user') or 'local'
        if lim['per_day'] and used['requests'] >= lim['per_day']:
            raise NapkinError(f'The local daily cap of {lim["per_day"]} Claude requests is reached (set by the administrator: claude_max_per_day).', 429)
        if lim['per_user_per_day'] and used.get('users', {}).get(user, 0) >= lim['per_user_per_day']:
            raise NapkinError(f'Your daily cap of {lim["per_user_per_day"]} Claude requests is reached (claude_max_per_user_per_day).', 429)
        rid = hashlib.sha256(f'{key}|{time.time()}'.encode()).hexdigest()[:32]
        CLAUDE_JOBS[rid] = {'status': 'pending', 'files': 0}
        napkin_last({'id': rid, 'format': fmt, 'asked': 4 if fmt == 'plan' else variations, 'files': 0, 'key': key, 'model': s['model'],
                     'source': str(b.get('source') or content)[:MAX_TEXT]}, reset=True, cache=CLAUDE_CACHE)
        napkin_usage(1, user, 'claude')
        ctx = str(b.get('context') or '').strip()[:1000]

        def run():
            try:
                log(f'claude create: {s["model"]} ({s["effort"]}), ' + ('content plan' if fmt == 'plan' else f'{variations} visual(s)'))
                res = C.generate(s, content, ctx, variations, bool(b.get('ordered')), CONFIG['claude_timeout_s'], mode=fmt)
                for i, svg in enumerate(res['files']):
                    with open(cached_file(rid, i, CLAUDE_CACHE), 'w', encoding='utf-8') as f:
                        f.write(svg)
                info = {k: res.get(k) for k in ('usage', 'seconds', 'model', 'effort', 'cost_usd')}
                napkin_last({'files': len(res['files']), 'warnings': res['errors'], **info}, cache=CLAUDE_CACHE)
                CLAUDE_JOBS[rid] = {'status': 'completed' if res['files'] else 'failed', 'files': len(res['files']), 'warnings': res['errors'],
                                    'error': '; '.join(res['errors']) if not res['files'] else None, **info}
                log(f'claude {rid[:8]}: {len(res["files"])} of {variations} in {res["seconds"]} s, {res["usage"]}')
            except Exception as e:      # never leave the panel polling a job that died
                CLAUDE_JOBS[rid] = {'status': 'failed', 'files': 0, 'error': str(e).replace(s['key'], '<key>')[:300]}
                log(f'claude {rid[:8]}: failed {type(e).__name__}')
            finally:
                CLAUDE_LOCK.release()

        threading.Thread(target=run, daemon=True).start()
    except BaseException:          # the background thread releases the lock once it has started
        CLAUDE_LOCK.release()
        raise
    return {'id': rid, 'status': 'pending', 'format': fmt, 'model': s['model']}


def claude_status(rid):
    if not rid or not all(c.isalnum() for c in rid):
        raise NapkinError('Bad request id.', 400)
    if rid in CLAUDE_JOBS:
        return {'id': rid, **CLAUDE_JOBS[rid]}
    last = napkin_last(cache=CLAUDE_CACHE)       # kept from an earlier run of the panel host
    if last.get('id') == rid and last.get('files') and all(os.path.exists(cached_file(rid, i, CLAUDE_CACHE)) for i in range(last['files'])):
        return {'id': rid, 'status': 'completed', 'cached': True, **{k: last.get(k) for k in ('files', 'warnings', 'usage', 'seconds', 'model', 'effort', 'cost_usd')}}
    raise NapkinError('This Claude request is not known (any more).', 404)


def claude_file(rid, i):
    if not rid or not all(c.isalnum() for c in rid) or not os.path.exists(cached_file(rid, i, CLAUDE_CACHE)):
        raise NapkinError('No such file.', 404)
    with open(cached_file(rid, i, CLAUDE_CACHE), 'rb') as f:
        data = f.read()
    return data, 'application/json; charset=utf-8' if data[:1] == b'{' else 'image/svg+xml'


# ---------------------------------------------------------------- HTTP
class Handler(BaseHTTPRequestHandler):
    server_version = 'AIVB/' + VERSION
    sys_version = ''
    timeout = 30            # a client that stalls (also during the TLS handshake) only blocks its own thread

    def setup(self):
        super().setup()
        if isinstance(self.connection, ssl.SSLSocket):
            self.connection.do_handshake()

    def log_message(self, fmt, *args):
        if '/api/status' not in (args[0] if args else ''):
            log(self.address_string(), fmt % args)

    def guard(self, api):
        if self.headers.get('Host', '') not in ALLOWED_HOSTS:
            self.fail(403, 'Wrong host.')
            return False
        if api:
            origin = self.headers.get('Origin')
            if self.headers.get('X-AIVB-Client') != '1' or (origin and origin not in {f'{SCHEME}://{h}' for h in ALLOWED_HOSTS}) \
                    or self.headers.get('Sec-Fetch-Site') not in (None, 'same-origin', 'none'):
                self.fail(403, 'Cross-origin requests are not allowed.')
                return False
        return True

    def send(self, code, body, ctype='application/json; charset=utf-8', extra=None):
        if not isinstance(body, (bytes, bytearray)):
            body = json.dumps(body).encode('utf-8')
        self.send_response(code)
        for k, v in {'Content-Type': ctype, 'Content-Length': str(len(body)), 'Cache-Control': 'no-store',
                     'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', **(extra or {})}.items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def fail(self, code, msg):
        self.send(code, {'error': msg})

    def authorized(self):
        """The caller's identity if the administrator's policy allows them to generate; otherwise answers 403."""
        who = A.identify(self.headers.get('Authorization'))
        if not who['ok']:
            log(f'denied {self.path.partition("?")[0]}: {who["reason"]}')
            self.fail(403, 'Not authorized: ' + who['reason'])
            return None
        return who

    def do_OPTIONS(self):          # never grant cross-origin access
        self.fail(403, 'Cross-origin requests are not allowed.')

    def do_GET(self):
        path, _, qs = self.path.partition('?')
        if path in STATIC:
            if self.guard(False):
                name, ctype = STATIC[path]
                with open(os.path.join(HERE, name), 'rb') as f:
                    data = f.read()
                if '--test' in sys.argv:    # tests: no CSP (the harness evaluates code in the panel) and collect script errors
                    data = data.replace(b'<script src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js"></script>', b'')   # the harness supplies a stand-in
                    data = data.replace(b'<head>', b"<head><script>window.__errs=[];addEventListener('error',e=>__errs.push(e.message+' @'+e.lineno))</script>", 1)
                    return self.send(200, data, ctype)
                self.send(200, data, ctype, {'Content-Security-Policy': CSP})
            return
        if path == '/favicon.ico':
            return self.send(204, b'', 'image/x-icon')
        if not path.startswith('/api/'):
            return self.fail(404, 'Not found.')
        if not self.guard(True):
            return
        q = urllib.parse.parse_qs(qs)
        arg = lambda k: q.get(k, [''])[0]
        try:
            if path == '/api/status':
                s, p = napkin_settings(), A.policy()
                who, lim, used = A.identify(self.headers.get('Authorization'), p), limits(p), napkin_usage()
                access = {'configured': bool(p), 'mode': (p or {}).get('mode'), 'authorized': who['ok'], 'user': who['user'], 'reason': who['reason'],
                          'template': (p or {}).get('template') or A.DEFAULT_TEMPLATE, 'tenant_id': (p or {}).get('tenant_id'), 'client_id': (p or {}).get('client_id')}
                napkin = {'configured': bool(s['key']), 'enabled': s['enabled'], 'style_id': NAPKIN_STYLE_ID, 'variations': NAPKIN_VARIATIONS}
                if who['ok']:       # usage and kept results only for authorized users
                    napkin.update({'last': bool(napkin_last().get('id')), 'used_today': used['requests'], 'max_per_day': lim['per_day'],
                                   'max_per_user_per_day': lim['per_user_per_day'], 'mine_today': used.get('users', {}).get(who['user'], 0), 'rate': dict(NAPKIN_RATE)})
                cs, clim, cused = C.settings(DATA_DIR), limits(p, 'claude'), napkin_usage(name='claude')
                claude = {'configured': bool(cs['key']), 'enabled': cs['enabled'], 'sdk': cs['sdk'], 'model': cs['model'], 'effort': cs['effort'],
                          'max_tokens': cs['max_tokens'], 'prices': cs['prices'], 'variations': NAPKIN_VARIATIONS, 'formats': ['plan', 'svg']}
                if who['ok']:
                    claude.update({'last': bool(napkin_last(cache=CLAUDE_CACHE).get('id')), 'used_today': cused['requests'], 'max_per_day': clim['per_day'],
                                   'max_per_user_per_day': clim['per_user_per_day'], 'mine_today': cused.get('users', {}).get(who['user'], 0)})
                if TEST_NO_PAID:     # a test panel host: both paid providers shown as switched off
                    napkin['enabled'] = claude['enabled'] = False
                orchestrate = {'paid': CONFIG['paid_policy'], 'order': CONFIG['paid_order']}
                return self.send(200, {'server': VERSION, 'access': access, 'napkin': napkin, 'claude': claude, 'orchestrate': orchestrate})
            if path.startswith(('/api/napkin/', '/api/claude/')) and not self.authorized():
                return
            if path == '/api/napkin/status':
                return self.send(200, napkin_status(arg('id')))
            if path == '/api/napkin/last':
                last = napkin_last()
                return self.send(200, {k: last.get(k) for k in ('id', 'format', 'asked', 'source')} if last.get('id') else {})
            if path == '/api/napkin/file':
                data, ctype = napkin_file(arg('id'), int(arg('i') or 0), arg('format'))
                return self.send(200, data, ctype)
            if path == '/api/claude/status':
                return self.send(200, claude_status(arg('id')))
            if path == '/api/claude/last':
                last = napkin_last(cache=CLAUDE_CACHE)
                return self.send(200, {k: last.get(k) for k in ('id', 'format', 'asked', 'source')} if last.get('id') else {})
            if path == '/api/claude/file':
                data, ctype = claude_file(arg('id'), int(arg('i') or 0))
                return self.send(200, data, ctype)
            return self.fail(404, 'Not found.')
        except NapkinError as e:
            return self.fail(e.code, str(e))
        except ValueError as e:
            return self.fail(400, f'Bad request ({e}).')
        except Exception as e:      # answered, never a dropped connection; only the error type is logged (no keys, no content)
            log(f'error on {path}: {type(e).__name__}')
            return self.fail(500, f'The panel host had an internal error ({type(e).__name__}); see server.log.')

    def do_POST(self):
        path = self.path.partition('?')[0]
        if not self.guard(True):
            return
        try:
            n = int(self.headers.get('Content-Length') or 0)
            if n > MAX_BODY or 'application/json' not in self.headers.get('Content-Type', ''):
                return self.fail(400, 'JSON up to 256 KB expected.')
            b = json.loads(self.rfile.read(n) or b'{}')
            # a test panel host never makes a paid request (the tests use saved results and stand-ins)
            if TEST_NO_PAID and path in ('/api/napkin/visual', '/api/claude/visual'):
                return self.fail(403, 'Paid requests are switched off on a test panel host.')
            if path == '/api/napkin/visual':
                who = self.authorized()
                return who and self.send(200, napkin_create(b, who))
            if path == '/api/claude/visual':
                who = self.authorized()
                return who and self.send(200, claude_create(b, who))
            if path == '/api/selftest':
                # result of the in-PowerPoint drawing self-test (API names and pass/fail only), kept for diagnosis
                os.makedirs(DATA_DIR, exist_ok=True)
                with open(os.path.join(DATA_DIR, 'selftest.json'), 'w', encoding='utf-8') as f:
                    json.dump(b, f, indent=1)
                return self.send(200, {'ok': True})
            return self.fail(404, 'Not found.')
        except NapkinError as e:
            return self.fail(e.code, str(e))
        except (ValueError, TypeError) as e:
            return self.fail(400, f'Bad request ({e}).')
        except Exception as e:
            log(f'error on {path}: {type(e).__name__}')
            return self.fail(500, f'The panel host had an internal error ({type(e).__name__}); see server.log.')


class Server(ThreadingHTTPServer):
    daemon_threads = True
    # Exclusive port: http.server's SO_REUSEADDR lets a second copy bind the same port on Windows while the first keeps
    # answering, so an outdated panel host could hide a newer one. Now a second copy fails to start instead.
    allow_reuse_address = False

    def server_bind(self):
        if hasattr(socket, 'SO_EXCLUSIVEADDRUSE'):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()

    def handle_error(self, request, client_address):     # one bad connection never stops the server
        log('connection error from', client_address[0], sys.exc_info()[1])


def main():
    global SCHEME
    plain = '--http' in sys.argv
    SCHEME = 'http' if plain else 'https'
    try:
        srv = Server(('127.0.0.1', PORT), Handler)
    except OSError as e:
        sys.exit(f'Port {PORT} is already in use ({e}). Another panel host is running: use "Stop AI Visual Builder.bat" '
                 'or "Restart AI Visual Builder.bat".')
    if not plain:
        cert, key = os.path.join(DATA_DIR, 'cert.pem'), os.path.join(DATA_DIR, 'key.pem')
        if not (os.path.exists(cert) and os.path.exists(key)):
            sys.exit('No certificate yet. Run "Set up AI Visual Builder.bat" once first.')
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.minimum_version = ssl.TLSVersion.TLSv1_2
        ctx.load_cert_chain(cert, key)
        # the handshake happens in each request's own thread (Handler.setup), not in the accept loop
        srv.socket = ctx.wrap_socket(srv.socket, server_side=True, do_handshake_on_connect=False)
    log(f'AI Visual Builder {VERSION} on {SCHEME}://localhost:{PORT}/  (Ctrl+C to stop)')
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
