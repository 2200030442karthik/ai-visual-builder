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
import activation as ACT
import features as FEAT
import claude_visual as C
import learn as L
import hub as H

VERSION = '10.22'
HERE = os.path.dirname(os.path.abspath(__file__))
# 10.18: hosted mode (a central HTTPS service for the team, e.g. Azure App Service; deploy/README-PILOT.md). Off unless
# AIVB_HOSTED=1. Then: plain HTTP on $PORT behind the platform's HTTPS front end, bound to all interfaces; only the
# public host names in AIVB_PUBLIC_HOST are served; data (usage, kept results, log) in AIVB_DATA_DIR; API keys only from
# the environment (App Service settings, filled from Key Vault); access must be "entra" (Office single sign-on).
HOSTED = os.environ.get('AIVB_HOSTED') == '1'
DATA_DIR = os.environ.get('AIVB_DATA_DIR') or os.path.join(os.environ.get('LOCALAPPDATA') or (os.path.expanduser('~/Library/Application Support') if sys.platform == 'darwin' else os.path.expanduser('~')), 'AIVisualBuilder')   # 10.21: macOS
STATIC = {'/': ('v10.html', 'text/html; charset=utf-8'), '/v10.html': ('v10.html', 'text/html; charset=utf-8'),
          '/gallery-dialog.html': ('gallery-dialog.html', 'text/html; charset=utf-8'),
          '/slsd-notice.html': ('slsd-notice.html', 'text/html; charset=utf-8'),
          **{f'/{n}.js': (f'{n}.js', 'text/javascript; charset=utf-8') for n in ('gallery', 'understand', 'brand', 'svg2ppt', 'pptx', 'rebuild', 'plan', 'sections', 'original', 'faithful', 'napkin', 'studio', 'orchestrator', 'app', 'bridge', 'slsd', 'gate', 'antv', 'stylekit', 'sleditor', 'iconlib')},
          # 10.27: the icon library of the visuals (deploy/make-iconlib.py, from the team's asset share)
          '/assets/iconlib/iconlib.json': ('assets/iconlib/iconlib.json', 'application/json'),
          # the ribbon's icons (manifest-v10.xml), served by this host like the panel itself
          **{f'/assets/icon-{n}.png': (f'assets/icon-{n}.png', 'image/png') for n in (16, 32, 64, 80)},
          # 10.20.1: the SL Smart Design tab's icons (manifest-slsd.xml; made by sl-smart-design/make_icons.py)
          # 10.25: the 3D picture icons (3dicons v1, CC0) for 'Style the selection' > Replace the selected icon
          **{f'/assets/3dicons/{n}': (f'assets/3dicons/{n}', 'application/json' if n.endswith('.json') else 'image/png') for n in (os.listdir(os.path.join(HERE, 'assets', '3dicons')) if os.path.isdir(os.path.join(HERE, 'assets', '3dicons')) else []) if n.endswith(('.png', '.json'))},
          # 10.26: Microsoft Fluent Emoji 3D (MIT), a business and education subset
          **{f'/assets/fluent3d/{n}': (f'assets/fluent3d/{n}', 'application/json' if n.endswith('.json') else 'image/png') for n in (os.listdir(os.path.join(HERE, 'assets', 'fluent3d')) if os.path.isdir(os.path.join(HERE, 'assets', 'fluent3d')) else []) if n.endswith(('.png', '.json'))},
          **{f'/assets/slsd/{n}': (f'assets/slsd/{n}', 'image/png') for n in (os.listdir(os.path.join(HERE, 'assets', 'slsd')) if os.path.isdir(os.path.join(HERE, 'assets', 'slsd')) else []) if n.endswith('.png')},
          # 10.24: AntV Infographic (MIT, vendor/antv-infographic-LICENSE.txt), served locally - no CDN at run time
          '/vendor/antv-infographic.min.js': ('vendor/antv-infographic-0.2.20.min.js', 'text/javascript; charset=utf-8'),
          # design packs (packs/*.js): layout families added without changing the application
          **{f'/packs/{n}': (f'packs/{n}', 'text/javascript; charset=utf-8') for n in os.listdir(os.path.join(HERE, 'packs')) if n.endswith('.js')}}
MAX_BODY = 256 * 1024
GALLERY_MAX_BODY = 8 * 1024 * 1024     # the large gallery's thumbnails (V10.16)
MAX_TEXT = 10000

# paid_policy (10.13, orchestrator.js): whether "Generate visuals" may use the paid providers: never | when-needed | always;
# paid_order: "auto" (10.14: by the content - Claude for technical structure, Napkin for concepts) or a fixed list such as
# ["napkin", "claude"] (the next is the fallback). Set by the administrator; the app shows neither.
CONFIG = {'port': 44317, 'napkin_base': 'https://api.napkin.ai', 'napkin_max_per_day': 0, 'napkin_timeout_s': 60, 'claude_max_per_day': 0, 'claude_timeout_s': 300,
          'paid_policy': 'when-needed', 'paid_order': 'auto', 'soft_tints': False, 'sme_space': False, 'paid_engines': 1,
          'slsd_addin': 'SL_Smart_Design_v2_Key_Dec_25.ppam', 'mac_vba_bridge': False}
# slsd_addin (10.20.1): the file name of the SL Smart Design VBA add-in whose macros the SL Smart Design tab runs
# mac_vba_bridge (10.21.1, macOS only, off by default, NOT YET TESTED ON A MAC): run the same allow-listed macros through
# PowerPoint for Mac's AppleScript command "run VB macro" (macOS asks the user once to allow the automation)
# paid_engines (10.18): 1 = one AI service per new text (the other only as fallback); 2 = both Napkin (its original
# infographics) and Claude (its own compositions) for a new text, so the gallery has both kinds of AI design (2x cost)
# soft_tints (10.17): allow one light tint of each palette colour for card fills (brand.js softTints); off by default
try:
    with open(os.path.join(HERE, 'config.json'), encoding='utf-8') as f:
        CONFIG.update({k: v for k, v in json.load(f).items() if k in CONFIG})
except (OSError, ValueError):
    pass
if CONFIG['paid_policy'] not in ('never', 'when-needed', 'always'):
    CONFIG['paid_policy'] = 'when-needed'
CONFIG['paid_order'] = ([k for k in CONFIG['paid_order'] if k in ('napkin', 'claude')] or 'auto') if isinstance(CONFIG['paid_order'], list) else 'auto'
CONFIG['paid_engines'] = 2 if CONFIG.get('paid_engines') == 2 else 1
if not (isinstance(CONFIG['slsd_addin'], str) and re.fullmatch(r'[A-Za-z0-9_. -]{1,100}\.ppam', CONFIG['slsd_addin'])):
    CONFIG['slsd_addin'] = 'SL_Smart_Design_v2_Key_Dec_25.ppam'     # a file name only: it becomes part of Application.Run's macro name
PORT = int(sys.argv[sys.argv.index('--port') + 1]) if '--port' in sys.argv else int(os.environ.get('PORT') or os.environ.get('WEBSITES_PORT') or 8000) if HOSTED else int(CONFIG['port'])   # --port: tests only
ALLOWED_HOSTS = {h.strip().lower() for h in os.environ.get('AIVB_PUBLIC_HOST', '').split(',') if h.strip()} if HOSTED else {f'localhost:{PORT}', f'127.0.0.1:{PORT}'}
if '--test' in sys.argv:    # tests only: also serve the test harness and its inputs
    STATIC.update({'/tests/harness.html': ('tests/harness.html', 'text/html; charset=utf-8'),
                   '/tests/diag.html': ('tests/diag.html', 'text/html; charset=utf-8'),
                   '/tests/probe.html': ('tests/probe.html', 'text/html; charset=utf-8'),
                   '/tests/studio.html': ('tests/studio.html', 'text/html; charset=utf-8'),
                   '/tests/original.html': ('tests/original.html', 'text/html; charset=utf-8'),
                   '/tests/faithful.html': ('tests/faithful.html', 'text/html; charset=utf-8'),
                   '/tests/app.html': ('tests/app.html', 'text/html; charset=utf-8'),
                   '/tests/slsd.html': ('tests/slsd.html', 'text/html; charset=utf-8'),
                   '/tests/upgrade.html': ('tests/upgrade.html', 'text/html; charset=utf-8'),
                   '/tests/samples.js': ('tests/samples.js', 'text/javascript; charset=utf-8'),
                   '/tests/mock.js': ('tests/mock.js', 'text/javascript; charset=utf-8')})
    for _n in os.listdir(os.path.join(HERE, 'tests', 'fixtures')):   # saved real Napkin outputs (regression fixtures)
        STATIC['/tests/fixtures/' + _n] = ('tests/fixtures/' + _n, 'application/octet-stream')
SCHEME = 'https'
# --test hosts never send a paid request, whatever keys this PC has (10.13: Generate decides on its own)
TEST_NO_PAID = '--test' in sys.argv

# V10.22 team installations (deploy/team): nothing works until this Windows user on this PC is activated with a key
# from the manager (activation.py: the key also unlocks the organization's Claude and Napkin keys in the package).
# Switched on by the team launcher (AIVB_ACTIVATION=1); the development host and the hosted service are unchanged.
ACTIVATION = os.environ.get('AIVB_ACTIVATION') == '1' and not HOSTED
ACT_BUNDLE = os.environ.get('AIVB_BUNDLE') or os.path.join(HERE, ACT.BUNDLE_NAME)
ACT_STATE = {'t': 0.0, 'v': None}
ACT_LOCK = threading.Lock()
ACT_TRIES = []
NOT_ACTIVATED = 'AI Visual Builder is not activated on this PC. Open AI Visual Builder and enter the activation key from your manager.'
STATIC['/activate.html'] = ('activate.html', 'text/html; charset=utf-8')
STATIC['/admin.html'] = ('admin.html', 'text/html; charset=utf-8')      # 10.28: the access hub's page (its API checks the admin key)
# Pages and scripts are always served: the panel page is also the SL Smart Design tab's function file (one runtime), and
# gate.js shows the activation form over the panel. Without activation only these APIs answer: status, the activation
# itself, and SL Smart Design's own commands and the panel opening (SL Smart Design has its own licence check).
ACT_FREE_GET = ('/api/status', '/api/activation', '/api/features', '/api/slsd/status', '/api/bridge/next', '/api/bridge/status')
# 10.24: /api/claude/icon is no longer free of activation - it can spend Claude credits
ACT_FREE_POST = ('/api/activate', '/api/features/activate', '/api/slsd/run', '/api/bridge/open', '/api/bridge/ack')


def activation_state(force=False):
    """{'ok': True} when no activation is needed or this user is activated (checked again at most once a minute while
    activated, at every request while not)."""
    if not ACTIVATION:
        return {'ok': True, 'required': False}
    with ACT_LOCK:
        v, now = ACT_STATE['v'], time.time()
        if force or not v or not v['ok'] or now - ACT_STATE['t'] > 60:
            v = dict(ACT.status(DATA_DIR, ACT_BUNDLE), required=True)
            ACT_STATE.update(t=now, v=v)
            hub_checkin(v, 'ai')
        return v


def activation_try(b):
    """The panel's activation page: at most 10 attempts a minute; the key is never logged."""
    now = time.time()
    with ACT_LOCK:
        ACT_TRIES[:] = [t for t in ACT_TRIES if now - t < 60]
        if len(ACT_TRIES) >= 10:
            raise NapkinError('Too many attempts. Wait a minute, then try again.', 429)
        ACT_TRIES.append(now)
    if not ACTIVATION:
        return {'ok': True, 'required': False}
    res = ACT.activate(str(b.get('key') or '')[:80], DATA_DIR, ACT_BUNDLE)
    log('activation ' + ('done' if res.get('ok') else 'refused (' + str(res.get('reason')) + ')'))
    activation_state(force=True)
    return {k: res.get(k) for k in ('ok', 'reason', 'message', 'label', 'expires', 'days_left', 'services') if k in res}
# ---------------------------------------------------------------- 10.26: SL Design and SL Animation access (features.py)
FEAT_BUNDLE = os.environ.get('AIVB_FEATURES') or os.path.join(HERE, FEAT.BUNDLE_NAME)
FEAT_TRIES, FEAT_LOCK = [], threading.Lock()


def feat_locked():
    """The package's LOCKED SL_Audomation (put back when access ends), or None."""
    for p in (os.path.join(HERE, '..', 'addins', FEAT.ADDIN + '.ppam'), os.path.join(HERE, 'addins', FEAT.ADDIN + '.ppam')):
        try:
            with open(p, 'rb') as f:
                b = f.read()
            if FEAT.is_locked(b):
                return b
        except OSError:
            pass
    return None


def features_state(clean=False):
    if not os.path.exists(FEAT_BUNDLE):
        return {'ok': False, 'reason': 'not-in-package', 'message': 'SL Design and SL Animation are not part of this installation.'}
    try:
        v = FEAT.status(DATA_DIR, FEAT_BUNDLE, clean=clean, locked_addin=feat_locked() if clean else None)
        hub_checkin(v, 'features')
        return v
    except Exception as e:      # never stops the service
        log(f'features: {type(e).__name__}')
        return {'ok': False, 'reason': 'error', 'message': 'The access could not be checked.'}


def _addin_live(on):
    if sys.platform != 'win32' or TEST_NO_PAID:
        return False
    try:
        import slsd_com
        return slsd_com.set_addin_loaded(FEAT.ADDIN, on)
    except Exception:
        return False


def features_try(b):
    """The panel's access page: at most 10 attempts a minute; the key is never logged. PowerPoint keeps running: the
    add-in is unloaded, replaced by the real one and loaded again."""
    now = time.time()
    with FEAT_LOCK:
        FEAT_TRIES[:] = [x for x in FEAT_TRIES if now - x < 60]
        if len(FEAT_TRIES) >= 10:
            raise NapkinError('Too many attempts. Wait a minute, then try again.', 429)
        FEAT_TRIES.append(now)
    if not os.path.exists(FEAT_BUNDLE):
        return features_state()
    key = str(b.get('key') or '')[:80]
    g, err = FEAT.unlock(FEAT.load_bundle(FEAT_BUNDLE), key)
    if not g:
        log('features: access refused')
        return {'ok': False, 'reason': 'invalid', 'message': err}
    was = _addin_live(False)
    res = FEAT.activate(key, DATA_DIR, FEAT_BUNDLE)
    live = _addin_live(True) if was else False
    log('features: access ' + ('given' if res.get('ok') else 'refused'))
    out = {k: res.get(k) for k in ('ok', 'reason', 'message', 'label', 'expires', 'days_left') if k in res}
    out['live'] = bool(live and res.get('placed'))
    out['restart'] = bool(res.get('ok') and not out['live'])
    return out


CSP = ("default-src 'self'; script-src 'self' 'unsafe-inline' https://appsforoffice.microsoft.com; "
       "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://appsforoffice.microsoft.com; "
       "font-src 'self' data:; connect-src 'self' https://*.microsoft.com https://*.office.com https://*.office.net; "
       "frame-src https://*.microsoft.com https://*.office.com https://*.office.net")


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


# ---------------------------------------------------------------- 10.28: the access hub (hub.py)
# A package with hub.json: the administrator's signed list on the team share decides each key (withdrawn, waiting for
# approval, a new expiry), read in the background; each PC reports its use there. Test hosts never touch the share.
HUB = None
if ACTIVATION and not TEST_NO_PAID:
    _hub_cfg = H.load_config(HERE)
    if _hub_cfg:
        HUB = H.Hub(_hub_cfg, DATA_DIR, log)
        ACT.HUB = HUB.verdict
        HUB.start()


def hub_checkin(v, kind):
    if HUB and v.get('ok') and v.get('id'):
        HUB.checkin(v['id'], {'kind': kind, 'label': v.get('label') or '', 'expires': v.get('expires') or '', 'version': VERSION})


def hub_admin(b=None):
    """The administrator's view and changes (only on the PC that holds the hub's private key)."""
    if TEST_NO_PAID or not H.is_admin(DATA_DIR):
        raise NapkinError('This PC does not manage the access hub.', 403)
    try:
        if b is None:
            return H.admin_overview(DATA_DIR)
        return H.admin_change(DATA_DIR, str(b.get('action') or ''), str(b.get('key') or '') or None, b.get('value'))
    except (ValueError, OSError) as e:
        raise NapkinError(f'The access list could not be changed: {e}', 400)


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


def claude_icons(b, who=None):
    """10.24: Claude designs an icon for every point of a visual (one request); off under paid_policy "never"."""
    items = b.get('items') if isinstance(b.get('items'), list) else []
    if not items:
        raise NapkinError('No points given.', 400)
    if TEST_NO_PAID or CONFIG['paid_policy'] == 'never':
        return {'ok': False, 'source': 'off', 'error': 'Claude is switched off by the administrator.', 'icons': [None] * min(8, len(items))}
    return C.generate_icons(C.settings(DATA_DIR), items, timeout_s=max(60, CONFIG.get('claude_timeout_s', 30)), style=str(b.get('style') or 'color'))


def icons_pick(b, who=None):
    """10.27: Claude chooses each point's icon among the library's candidates (with this user's earlier choices as examples)."""
    items = b.get('items') if isinstance(b.get('items'), list) else []
    if not items:
        raise NapkinError('No points given.', 400)
    if TEST_NO_PAID or CONFIG['paid_policy'] == 'never':
        return {'ok': False, 'source': 'off', 'error': 'Claude is switched off by the administrator.', 'icons': [None] * min(10, len(items))}
    res = C.pick_icons(C.settings(DATA_DIR), items, str(b.get('topic') or ''), L.examples(DATA_DIR))
    if res.get('source') == 'off':
        log('icons pick: ' + res.get('error', ''))
    return res


def claude_icon(b, who=None):
    desc = str(b.get('description') or b.get('prompt') or '').strip()
    if not desc:
        raise NapkinError('Please describe the icon you want to generate.', 400)
    if len(desc) > 120:
        raise NapkinError('Icon description is too long (maximum 120 characters).', 400)
    # 10.24: the administrator's paid_policy "never" (and a test host) keeps Claude off here too; the panel then offers
    # the matching icons of the built-in library, which cost nothing
    if TEST_NO_PAID or CONFIG['paid_policy'] == 'never':
        return {'ok': False, 'source': 'off', 'error': 'Claude is switched off by the administrator; choose one of the library icons.'}
    s = C.settings(DATA_DIR)
    try:
        return C.generate_icon(s, desc, timeout_s=CONFIG.get('claude_timeout_s', 30), style=str(b.get('style') or 'color'))
    except Exception as e:
        log(f'claude_icon failed: {e}')
        raise NapkinError(f'Icon generation failed: {e}', 500)



# ---------------------------------------------------------------- large gallery (V10.16)
# The panel's designs for its large gallery (an Office dialog, gallery-dialog.html): the panel publishes the thumbnails
# under a random key it made (32 hex characters) and only it can write (an authorized user); the dialog reads them with
# that key, which it gets in its address. Kept in memory only (never on disk or in the log), at most 20 galleries, each
# for up to 2 hours. The dialog sends its choices back to the panel through Office (messageParent), not through here.
GALLERY = {}


def gallery_put(b):
    k = str(b.get('k') or '')
    if not re.fullmatch(r'[0-9a-f]{32}', k):
        raise NapkinError('Bad gallery key.', 400)
    now = time.time()
    for x in [x for x, v in GALLERY.items() if now - v['at'] > 7200]:
        GALLERY.pop(x, None)
    if len(GALLERY) >= 20 and k not in GALLERY:
        GALLERY.pop(min(GALLERY, key=lambda x: GALLERY[x]['at']))
    items = [{'i': int(x.get('i', 0)), 'name': str(x.get('name') or '')[:120], 'category': str(x.get('category') or '')[:60], 'edit': str(x.get('edit') or '')[:20],
              'slides': int(x.get('slides') or 1), 'ai': bool(x.get('ai')), 'src': str(x.get('src') or '')[:12], 'srcName': str(x.get('srcName') or '')[:30], 'srcWhy': str(x.get('srcWhy') or '')[:200], 'svg': str(x.get('svg') or '')} for x in (b.get('items') or [])[:60] if isinstance(x, dict)]
    GALLERY[k] = {'at': now, 'data': {'v': int(b.get('v') or 0), 'items': items, 'sel': int(b.get('sel', -1)), 'note': str(b.get('note') or '')[:400],
                                      'err': bool(b.get('err')), 'busy': bool(b.get('busy')), 'open': b.get('open', True) is not False}}
    return {'ok': True}


# ---------------------------------------------------------------- SL Smart Design bridge (V10.20)
# The AI Visual Builder button on the SL Smart Design tab (VBA, sl-smart-design/SLSD_AIVisualBuilder.bas) asks for the
# panel here; the panel's shared runtime (bridge.js) of that presentation picks the request up, opens its task pane
# with Office.addin.showAsTaskpane() and acknowledges. Only "open a view" can be asked: nothing is read or changed in
# a presentation through this. In memory only; a request expires after 20 seconds.
BRIDGE_VIEWS = ('generate', 'slides', 'edit')
BRIDGE = {'req': None}
BRIDGE_LOCK = threading.Lock()


def _bridge_doc(d):
    d = urllib.parse.unquote(str(d or '')).strip().replace('\\', '/').lower()
    return d if ('/' in d or ':' in d) else ''          # an unsaved presentation ("Presentation1") has no path


def bridge_open(b):
    view = str(b.get('view') or 'generate')
    if view not in BRIDGE_VIEWS:
        raise NapkinError('Unknown view.', 400)
    rid = hashlib.sha256(f'{time.time()}|{os.getpid()}|{view}'.encode()).hexdigest()[:16]
    with BRIDGE_LOCK:
        BRIDGE['req'] = {'id': rid, 'view': view, 'doc': _bridge_doc(b.get('doc')), 'at': time.time(), 'taken': False, 'acked': False}
    return {'id': rid}


def bridge_next(doc):
    with BRIDGE_LOCK:
        r = BRIDGE['req']
        if not r or r['taken'] or time.time() - r['at'] > 20 or _bridge_doc(doc) != r['doc']:
            return {}
        r['taken'] = True
        return {'id': r['id'], 'view': r['view']}


def bridge_ack(b):
    with BRIDGE_LOCK:
        r = BRIDGE['req']
        if r and r['id'] == str(b.get('id') or ''):
            r['acked'] = True
            log(f'bridge: the {r["view"]} view was opened in PowerPoint ({time.time() - r["at"]:.1f} s after the SL Smart Design button)')
            return {'ok': True}
    return {'ok': False}


def bridge_status(rid):
    with BRIDGE_LOCK:
        r = BRIDGE['req']
        return {'acked': bool(r and r['id'] == rid and r['acked']), 'taken': bool(r and r['id'] == rid and r['taken'])}


# ---------------------------------------------------------------- SL Smart Design commands (V10.20.1)
# The SL Smart Design ribbon tab belongs to this add-in (manifest-slsd.xml, slsd.js), so AI Visual Builder opens on the
# first click like any web add-in's task pane. The original SL Smart Design commands are run unchanged in the company's
# VBA add-in (licence check included) through PowerPoint's Application.Run (slsd_com.py). Only the macros below can be
# asked for - by key, never by name; one at a time (Alternative Design's Select Template window is modal).
SLSD_MACROS = {
    'alternative': 'ShowTemplateSelectorForm',
    'footer-note': 'ImportNoteSection', 'footer-info': 'ImportInfoSection',
    'blue-codebox': 'ImportBlueCodeboxSection', 'black-codebox': 'ImportBlackCodeboxSection',
    'problem-solution': 'ImportProblemSolutionSection', 'problem-solution-image': 'ImportProblemSolutionImageSection',
    'remove-animations': 'DeleteAllAnimationsAndTransitions', 'delete-empty': 'DeleteEmptyTextBoxesAndPlaceholders',
    'rename-text': 'RenameText', 'rename-heading': 'RenameHeading'}
# 10.25, SL Editor: the SL Design and SL Animation commands of the company's VBA add-in SL_Audomation.ppam (no licence
# check), run unchanged like the SL Smart Design ones. A command with a value (an animation ID, a shift, a colour) first
# runs the add-in's own ribbon setter with that value (its ribbon control argument is not used: Nothing is passed).
_NUM = r'-?\d{1,6}(?:[.,]\d{1,3})?'
SLED_MACROS = {
    **{f'an-{e}-{d}': f'{e}_{d}' for e in ('fade', 'zoom', 'fly', 'peek', 'wipe', 'split', 'circle') for d in ('in', 'out')},
    'an-motion-line': 'motion_path_line', 'an-spin': 'emphasis_spin', 'an-audio-sync': 'audio_sync',
    'an-import': 'import_from_resource_library', 'an-adjust-videos': 'Adjust_Animated_Videos', 'an-import-audio': 'Import_and_Update_Audio',
    'an-shift': 'Shift_All_Animations', 'an-export-video': 'Export_Video_Regular', 'an-transition-times': 'Transition_Timing',
    'de-rounded-box': 'Create_Rounded_Rectangle', 'de-text-box': 'Create_Rectangle_Text_Box', 'de-source-text': 'Add_Small_Print',
    'de-adjust-font': 'Adjust_Font', 'de-bullets': 'Create_Rectangle_Bullet_Point_Text_Box',
    **{f'de-template-{n}': f'Design_Template_0{n}' for n in range(1, 6)},
    'de-brandline-custom': 'Brandline_University', 'de-brandline-osl': 'Brandline_Simplilearn', 'de-brandline-lvc': 'Brandline_LVC',
    'de-notes-text': 'ExportNotesText', 'de-notes-vtt': 'ExportNotesVTT'}
# command -> [(value name, setter Sub, pattern)]
SLED_VALUES = {'an-import': [('id', 'Animation_ID_Number', r'\d{1,5}')],
               'an-shift': [('from', 'Shift_Animations_User_Form', _NUM), ('by', 'Shift_By_User_Form', _NUM)],
               'de-brandline-custom': [('color', 'Brandline_University_ColorCode', r'#?[0-9A-Fa-f]{6}')]}
SLSD = {'jobs': {}, 'busy': None}
SLSD_LOCK = threading.Lock()


class SlsdUnavailable(Exception):
    pass


SlsdUnavailable.__name__ = 'MacroError'      # shown to the user in plain words (slsd_run)


def mac_bridge_on():
    return sys.platform == 'darwin' and CONFIG.get('mac_vba_bridge') is True and not TEST_NO_PAID


def mac_script(macro, addin=None):
    # the AppleScript for one allow-listed macro of the configured add-in (both checked: no quote can get in)
    addin = addin or CONFIG['slsd_addin']
    allowed = set(SLSD_MACROS.values()) | set(SLED_MACROS.values())
    if macro not in allowed or not re.fullmatch(r'[A-Za-z0-9_. -]{1,100}\.ppam', addin):
        raise SlsdUnavailable('This command is not available.')
    return f'tell application "Microsoft PowerPoint" to run VB macro macro name "{addin}!Module1.{macro}"'


def _mac_runner(macro, addin=None):
    # 10.21.1, opt-in (mac_vba_bridge; the 10.26 Mac installer turns it on): PowerPoint for Mac runs the original macro
    # itself (licence check included)
    import subprocess
    r = subprocess.run(['osascript', '-e', mac_script(macro, addin)], capture_output=True, text=True, timeout=3600)
    if r.returncode != 0:
        why = (r.stderr or '').strip().splitlines()[-1:] or ['']
        raise SlsdUnavailable('PowerPoint for Mac could not run the command' + (f' ({why[0][:160]})' if why[0] else '') +
                              ". Allow the automation in System Settings > Privacy & Security > Automation, or use the SL Smart Design add-in's own tab.")


def _slsd_runner(macro):
    if sys.platform != 'win32':     # 10.21: on a Mac the VBA add-in runs its commands from its own tab (no COM there)
        if mac_bridge_on():
            return _mac_runner(macro)
        raise SlsdUnavailable("On a Mac, use the SL Smart Design add-in's own tab for this command (its VBA works on Mac). AI Visual Builder works here as on Windows.")
    import slsd_com      # Windows only; imported when a command is first asked for
    if TEST_NO_PAID:     # a test panel host never acts on the PowerPoint the user is working in
        raise slsd_com.MacroError('PowerPoint commands are switched off on a test panel host.')
    slsd_com.run_macro(CONFIG['slsd_addin'], 'Module1', macro)


SLSD_RUNNER = _slsd_runner      # replaced by the tests (no PowerPoint)


def _sled_runner(macro, pre):
    addin = CONFIG.get('sled_addin') if isinstance(CONFIG.get('sled_addin'), str) and re.fullmatch(r'[A-Za-z0-9_. -]{1,100}\.ppam', CONFIG.get('sled_addin')) else 'SL_Audomation.ppam'
    if sys.platform != 'win32':
        # 10.26: on a Mac, AppleScript runs the commands that need no typed value; the others from the add-in's own tab
        if mac_bridge_on() and not pre:
            return _mac_runner(macro, addin)
        raise SlsdUnavailable('On a Mac, use the SL Design and SL Animation tabs of the SL_Audomation add-in for this command.')
    import slsd_com
    if TEST_NO_PAID:
        raise slsd_com.MacroError('PowerPoint commands are switched off on a test panel host.')
    for setter, v in pre:        # VBA's CDbl reads the PC's own decimal separator
        if setter in ('Shift_Animations_User_Form', 'Shift_By_User_Form'):
            v = v.replace('.', _decimal_sep())
        slsd_com.run_macro(addin, 'Module1', setter, args=(slsd_com.NULL_OBJECT, v), title='SL Editor')
    slsd_com.run_macro(addin, 'Module1', macro, title='SL Editor')


def _decimal_sep():
    try:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r'Control Panel\International') as k:
            return str(winreg.QueryValueEx(k, 'sDecimal')[0] or '.')[:1]
    except OSError:
        return '.'


SLED_RUNNER = _sled_runner      # replaced by the tests (no PowerPoint)


def _sled_job(cmd, b):
    # the setter calls (validated values) and the command's own macro
    vals = b.get('values') if isinstance(b.get('values'), dict) else {}
    pre = []
    for name, setter, pat in SLED_VALUES.get(cmd, []):
        v = str(vals.get(name, '')).strip()
        if not re.fullmatch(pat, v):
            raise NapkinError(f'Enter a valid {name} first.', 400)
        if setter == 'Brandline_University_ColorCode':
            v = v.lstrip('#').upper()
        if name in ('from', 'by'):
            v = v.replace(',', '.')
        pre.append((setter, v))
    return pre


def slsd_run(b):
    cmd = str(b.get('cmd') or '')
    if cmd not in SLSD_MACROS and cmd not in SLED_MACROS:
        raise NapkinError('Unknown SL Smart Design command.', 400)
    pre = _sled_job(cmd, b) if cmd in SLED_MACROS else None
    if HOSTED:
        raise NapkinError('SL Smart Design commands run only on the PC with PowerPoint.', 403)
    rid = hashlib.sha256(f'{time.time()}|{os.getpid()}|{cmd}'.encode()).hexdigest()[:16]
    with SLSD_LOCK:
        busy = SLSD['busy'] and SLSD['jobs'].get(SLSD['busy'])
        if busy and busy['state'] == 'running':
            raise NapkinError('SL Smart Design is still running a command. Close its window (for example Select Template) first.', 409)
        for k in [k for k, j in SLSD['jobs'].items() if time.time() - j['at'] > 3600]:
            SLSD['jobs'].pop(k)
        SLSD['jobs'][rid] = {'cmd': cmd, 'state': 'running', 'message': '', 'at': time.time()}
        SLSD['busy'] = rid

    def work():
        t0, state, msg = time.time(), 'done', ''
        try:
            if pre is None:
                SLSD_RUNNER(SLSD_MACROS[cmd])
            else:
                SLED_RUNNER(SLED_MACROS[cmd], pre)
        except Exception as e:      # MacroError: a plain-language reason; anything else: its type only
            state, msg = 'error', (str(e) if type(e).__name__ == 'MacroError' else f'SL Smart Design could not run the command ({type(e).__name__}).')
        with SLSD_LOCK:
            SLSD['jobs'][rid].update(state=state, message=msg)
        log(f'slsd: {cmd} {state} in {time.time() - t0:.1f} s')
    threading.Thread(target=work, daemon=True, name='slsd-' + cmd).start()
    return {'id': rid}


def slsd_status(rid):
    with SLSD_LOCK:
        j = SLSD['jobs'].get(str(rid or ''))
        if not j:
            raise NapkinError('This SL Smart Design command is not known.', 404)
        return {'id': rid, 'cmd': j['cmd'], 'state': j['state'], 'message': j['message']}


def gallery_get(k):
    if not re.fullmatch(r'[0-9a-f]{32}', k or '') or k not in GALLERY:
        raise NapkinError('This gallery is not available any more. Press Generate visuals in the panel.', 404)
    return GALLERY[k]['data']


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
        a0 = str(args[0]) if args else ''
        if '/api/status' not in a0 and '/api/bridge/next' not in a0 and '/api/bridge/status' not in a0 and '/api/slsd/status' not in a0:   # polls: not logged
            log(self.address_string(), fmt % args)

    def guard(self, api):
        if self.headers.get('Host', '').lower() not in ALLOWED_HOSTS:
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
        h = {'Content-Type': ctype, 'Content-Length': str(len(body)), 'Cache-Control': 'no-store',
             'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', **(extra or {})}
        if ctype.startswith('image/') and code == 200:
            # 10.20.1: Office must be able to cache add-in images; any Cache-Control directive on them makes the ribbon
            # show a generic icon (Microsoft: troubleshoot-development-errors; manifest <Image>). Real PowerPoint, 16 Nov.
            h.pop('Cache-Control')
            # and a reason to keep them: an HTTP/1.0 answer with no freshness and no validator was fetched by Office
            # but not cached (generic icons remained, 16 Nov). Expires + Last-Modified, still no Cache-Control directive.
            h.setdefault('Expires', time.strftime('%a, %d %b %Y %H:%M:%S GMT', time.gmtime(time.time() + 365 * 86400)))
            h.setdefault('Last-Modified', 'Mon, 16 Nov 2026 00:00:00 GMT')
        for k, v in h.items():
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
        # 10.20.1: versioned icon URLs (/assets/v2/...): Office caches add-in images by URL, so new icons need new URLs
        path = re.sub(r'^/assets/v\d{1,4}/', '/assets/', path)
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
        act = activation_state()
        if path == '/api/activation':
            return self.send(200, act)
        if path == '/api/features':
            return self.send(200, features_state())
        if path == '/api/hub/admin':           # 10.28: the administrator's access page (own guard: the hub's private key)
            try:
                return self.send(200, hub_admin())
            except NapkinError as e:
                return self.fail(e.code, str(e))
        if path == '/api/hub/me':
            return self.send(200, {'admin': not TEST_NO_PAID and H.is_admin(DATA_DIR), 'hub': bool(HUB)})
        if not act['ok'] and path not in ACT_FREE_GET:
            return self.fail(403, NOT_ACTIVATED)
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
                if TEST_NO_PAID or CONFIG['paid_policy'] == 'never':     # test host / administrator: paid providers off
                    napkin['enabled'] = claude['enabled'] = False
                orchestrate = {'paid': CONFIG['paid_policy'], 'order': CONFIG['paid_order'], 'engines': CONFIG['paid_engines']}
                return self.send(200, {'server': VERSION, 'access': access, 'napkin': napkin, 'claude': claude, 'orchestrate': orchestrate,
                                       'brand': {'soft_tints': CONFIG['soft_tints'] is True, 'sme_space': CONFIG['sme_space'] is True}, 'slsd': {'mac_bridge': mac_bridge_on()},
                                       'activation': act})
            if path == '/api/learn':      # 10.27: a test host neither reads nor writes this PC's learning
                return self.send(200, {'icons': {}, 'layouts': {}, 'recent': []} if TEST_NO_PAID else L.state(DATA_DIR))
            if path == '/api/gallery':
                return self.send(200, gallery_get(arg('k')))
            if path == '/api/bridge/next':
                return self.send(200, bridge_next(arg('doc')))
            if path == '/api/bridge/status':
                return self.send(200, bridge_status(arg('id')))
            if path == '/api/slsd/status':
                return self.send(200, slsd_status(arg('id')))
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
            if n > (GALLERY_MAX_BODY if path == '/api/gallery' else MAX_BODY) or 'application/json' not in self.headers.get('Content-Type', ''):
                return self.fail(400, 'JSON up to 256 KB expected.')
            b = json.loads(self.rfile.read(n) or b'{}')
            if path == '/api/activate':
                return self.send(200, activation_try(b))
            if path == '/api/features/activate':
                return self.send(200, features_try(b))
            if path == '/api/hub/admin':
                return self.send(200, hub_admin(b))
            if path not in ACT_FREE_POST and not activation_state()['ok']:
                return self.fail(403, NOT_ACTIVATED)
            # a test panel host never makes a paid request (the tests use saved results and stand-ins)
            if TEST_NO_PAID and path in ('/api/napkin/visual', '/api/claude/visual'):
                return self.fail(403, 'Paid requests are switched off on a test panel host.')
            # 10.20.1: paid_policy "never" is enforced here too, not only in the panel - a key present on the PC (for
            # example ANTHROPIC_API_KEY in the user's environment) cannot be used, whatever the panel asks
            if CONFIG['paid_policy'] == 'never' and path in ('/api/napkin/visual', '/api/claude/visual'):
                return self.fail(403, 'The AI design services (Napkin, Claude) are switched off by the administrator (paid_policy "never"). The built-in designs work as usual.')
            if path == '/api/napkin/visual':
                who = self.authorized()
                return who and self.send(200, napkin_create(b, who))
            if path == '/api/claude/visual':
                who = self.authorized()
                return who and self.send(200, claude_create(b, who))
            if path == '/api/learn':
                return self.send(200, {'ok': True, 'test': True} if TEST_NO_PAID else L.record(DATA_DIR, b))
            if path == '/api/icons/pick':
                who = self.authorized()
                return who and self.send(200, icons_pick(b, who))
            if path == '/api/claude/icons':
                who = self.authorized()
                return who and self.send(200, claude_icons(b, who))
            if path == '/api/claude/icon':
                who = self.authorized()
                return who and self.send(200, claude_icon(b, who))
            if path == '/api/gallery':
                who = self.authorized()
                return who and self.send(200, gallery_put(b))
            if path == '/api/bridge/open':
                return self.send(200, bridge_open(b))
            if path == '/api/bridge/ack':
                return self.send(200, bridge_ack(b))
            if path == '/api/slsd/run':
                return self.send(200, slsd_run(b))
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


def slsd_tab_loop():
    """V10.22 team installations (AIVB_SLSD_UNIFY=1): one SL Smart Design tab, decided by slsd_tab.py every 15 s and
    changed only while PowerPoint is closed; the original add-in comes back whenever the web tab is not there."""
    import slsd_tab as T
    while True:
        try:
            did = T.step(DATA_DIR, os.environ.get('AIVB_SLSD_ID') or T.PRODUCT_ID, os.environ.get('AIVB_SLSD_CATALOG') or T.CATALOG_ID)
            if did:
                log(f'SL Smart Design: its own tab {did} (one SL Smart Design tab: the web tab is {"there" if did == "hidden" else "not there"})')
        except Exception as e:      # never stops the panel host
            log(f'SL Smart Design tab check: {type(e).__name__}: {e}')
        time.sleep(15)


def main():
    global SCHEME
    plain = '--http' in sys.argv or HOSTED
    SCHEME = 'https' if HOSTED else 'http' if plain else 'https'     # hosted: the public scheme (TLS ends at the platform)
    if HOSTED:
        import access as _acc
        pol = _acc.policy()
        if not ALLOWED_HOSTS:
            sys.exit('Hosted mode needs AIVB_PUBLIC_HOST (the public host name, e.g. aivb.example.com).')
        if not pol or pol.get('mode') != 'entra':
            sys.exit('Hosted mode needs an access policy in "entra" mode (AIVB_ACCESS); Windows mode works only on one PC.')
    try:
        srv = Server(('0.0.0.0' if HOSTED else '127.0.0.1', PORT), Handler)
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
    if not HOSTED and not TEST_NO_PAID:    # expired, withdrawn or copied access: the locked copy back; access given: the real add-in
        threading.Thread(target=features_state, kwargs={'clean': True}, daemon=True, name='features').start()
    if os.environ.get('AIVB_SLSD_UNIFY') == '1' and not HOSTED and sys.platform == 'win32':
        threading.Thread(target=slsd_tab_loop, daemon=True, name='slsd-tab').start()
    log(f'AI Visual Builder {VERSION} on ' + (f'port {PORT} (hosted for {", ".join(sorted(ALLOWED_HOSTS))})' if HOSTED else f'{SCHEME}://localhost:{PORT}/') + '  (Ctrl+C to stop)')
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
