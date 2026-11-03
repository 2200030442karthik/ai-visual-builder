"""V10.9 server checks without network or credits: napkin_call is replaced by a recorder, so nothing reaches Napkin.
- every request carries the one approved style_id; 1 or 4 visuals only; 4 asks for varied layouts (sort_strategy)
- meaningless text or another number of visuals -> refused before any request
- an old style_id in napkin.json is never sent; the retired Brand A id appears nowhere in the server
- Napkin's "invalid_style_id" warning (its silent fall-back to the default style) blocks the result's files
- the meaningful-text check gives the same answers as the panel's (same lists as tests/samples.js)
- the last request's files are kept on disk: checked again after a reload without any request to Napkin
- a create request needs the approved Content Slide; the same request twice needs an explicit repeat
- access (access.py): no policy -> denied; Windows mode by account; Entra mode with real RS256 tokens (a test key made
  here): valid, expired, other audience, other tenant, forged signature, not listed, app role, group
- Napkin's plan limits: rate-limit headers kept for the panel; 429 / 402 explained, never retried; the local caps
  come from the administrator's policy
- over HTTP, every Napkin endpoint answers 403 to an unauthorized caller and nothing reaches Napkin
Usage: python tests/test_server.py   (prints a summary; exit code 1 on failure)
"""
import base64
import hashlib
import json
import os
import random
import re
import threading
import time
import urllib.request
import shutil
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..'))
import access as A  # noqa: E402
import server as S  # noqa: E402

STYLE = 'EHH64S9R64R64C9DCMSKCSHD6GTPADHDC4SKJC1D68WP6CK66DJ32RV4CGVG'
RETIRED = 'EGVP6S9H6CS3ES9D70RKARSD6HGK2D9D71K3CSHDC5GP6E1K6XH66D1Q6RVG'


def samples(name):
    """A list from samples.js, read as JSON (its strings use JSON-compatible escapes)."""
    src = open(os.path.join(HERE, 'samples.js'), encoding='utf-8').read()
    body = re.search(r'var ' + name + r' = (\[.*?\]);', src, re.S).group(1)
    return json.loads(re.sub(r",\s*\]", ']', body.replace("'", '"')))


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sent, fails, answer, gets = [], [], {}, []
    quota_tests(fails)
    S.NAPKIN_CACHE = tempfile.mkdtemp(prefix='aivb-test-')      # never the real app data folder
    S.napkin_call = lambda method, url, body=None, raw=False: (sent.append(body) if method == 'POST' else gets.append(url)) or (b'FILE ' + url.encode() if raw else dict(answer.get(method, {})))
    S.napkin_usage = lambda add=0, user=None, name='napkin': {'day': 'test', 'requests': 0}
    S.napkin_settings = lambda: {'key': 'test-key', 'enabled': True, 'style_id': 'OLD-UNAPPROVED-STYLE'}   # as an old napkin.json could have
    ok_text = 'Machine learning workflow\n1. Data collection\n2. Model training'

    def create(**kw):
        try:
            return S.napkin_create(dict({'content': ok_text, 'format': 'svg', 'variations': 1, 'confirmed': True, 'slide': {'layout_name': 'Content_Slide', 'fingerprint_ok': True}, 'repeat': True}, **kw)), None
        except S.NapkinError as e:
            return None, str(e)

    answer['POST'] = {'id': 'job1', 'status': 'pending'}
    for v in (1, 4):
        n = len(sent)
        res, err = create(variations=v)
        b = sent[-1] if len(sent) > n else {}
        if err or b.get('style_id') != STYLE or res.get('style_id') != STYLE or b.get('number_of_visuals') != v or (v == 4) != (b.get('sort_strategy') == 'variation'):
            fails.append(f'{v} visual(s): {err or b}')
    # guidance goes in Napkin's documented `context` field (never into the content), capped at 1000 characters; none without it
    n = len(sent)
    create(context='Topic: X. ' + 'y' * 2000)
    b = sent[-1] if len(sent) > n else {}
    if not b.get('context', '').startswith('Topic: X.') or len(b['context']) > 1000 or 'Topic: X.' in b.get('content', ''):
        fails.append(f'context not forwarded as documented: {str(b)[:200]}')
    if 'context' in sent[0]:
        fails.append('context sent although the panel gave none')
    # no local daily cap by default: 150 requests today still go through (Napkin's own limits apply); an administrator cap still works
    usage, policy = S.napkin_usage, S.A.policy
    S.napkin_usage = lambda add=0, user=None, name='napkin': {'day': 'test', 'requests': 150, 'users': {'local': 150}}
    try:
        if create()[1]:
            fails.append('150 requests today were refused although there is no local cap: ' + create()[1])
        S.A.policy = lambda: dict(policy() or {}, napkin_max_per_day=100)
        if 'daily cap of 100' not in (create()[1] or ''):
            fails.append('an administrator cap of 100 was not applied')
    finally:
        S.napkin_usage, S.A.policy = usage, policy
    for kw, why in (({'variations': 2}, '2 variations'), ({'variations': 3}, '3 variations'),
                    ({'content': 'Cvjbk hfvdk;valvxho;bdf\n\nvl;dfvj fkl’\n\nFb d’fbhdfbfd'}, 'meaningless text')):
        n = len(sent)
        res, err = create(**kw)
        if not err or len(sent) != n:
            fails.append(f'{why}: should be refused before any request (got {res})')
    if any(b.get('style_id') != STYLE for b in sent):
        fails.append('a request carried another style_id')
    if RETIRED in open(S.__file__, encoding='utf-8').read():
        fails.append('the retired Brand A id is still in server.py')
    # Napkin falls back to its default style and warns: the result must be blocked
    answer['GET'] = {'status': 'completed', 'generated_files': [{'url': 'https://example.com/f.svg'}], 'warnings': [{'code': 'invalid_style_id'}]}
    st = S.napkin_status('job1')
    try:
        S.napkin_file('job1', 0, 'svg')
        served = True
    except S.NapkinError:
        served = False
    if not st.get('style_rejected') or st.get('files') or served:
        fails.append(f'invalid_style_id not blocked: {st}, file served: {served}')
    answer['GET'] = {'status': 'completed', 'generated_files': [{'url': 'https://example.com/a.svg'}, {'url': 'https://example.com/b.svg'}]}
    st = S.napkin_status('job2')
    if st.get('files') != 2 or st.get('style_rejected'):
        fails.append(f'a normal answer was not passed on: {st}')
    # the last request's files: downloaded once, then served from disk with no request to Napkin
    answer['POST'] = {'id': 'job3', 'status': 'pending'}
    create(variations=4, format='ppt')
    answer['GET'] = {'status': 'completed', 'generated_files': [{'url': f'https://example.com/{k}.pptx'} for k in range(4)]}
    S.NAPKIN_FILES.clear()
    st = S.napkin_status('job3')
    files = [S.napkin_file('job3', k, 'ppt')[0] for k in range(4)]
    S.NAPKIN_FILES.clear()                                       # as after a panel host restart
    n_get, n_post = len(gets), len(sent)
    st2 = S.napkin_status('job3')
    files2 = [S.napkin_file('job3', k, 'ppt')[0] for k in range(4)]
    last = S.napkin_last()
    if st.get('files') != 4 or st2.get('files') != 4 or not st2.get('cached') or files2 != files or len(gets) != n_get or len(sent) != n_post             or last.get('id') != 'job3' or last.get('asked') != 4 or last.get('format') != 'ppt':
        fails.append(f'last result not kept: {st2}, {last}, network {len(gets) - n_get} GET / {len(sent) - n_post} POST')
    answer['POST'] = {'id': 'job4', 'status': 'pending'}          # a new request replaces the kept files
    create()
    if S.napkin_last().get('id') != 'job4' or os.path.exists(S.cached_file('job3', 0)):
        fails.append('a new request did not replace the kept files')
    shutil.rmtree(S.NAPKIN_CACHE, ignore_errors=True)
    # template and duplicates (A.policy() is None here: the default template, "Content Slide")
    n = len(sent)
    for slide in ({'layout_name': 'Course_Name', 'fingerprint_ok': True}, {'layout_name': 'Content Slide', 'fingerprint_ok': False}, {'layout_name': 'Content_Slide'}, None):
        res, err = create(slide=slide, content=ok_text + '\n3. Evaluation')
        if not err or 'Content Slide' not in err or len(sent) != n:
            fails.append(f'a request from {slide} was not refused: {res}')
    answer['POST'] = {'id': 'job5', 'status': 'pending'}
    if create(slide={'layout_name': 'Content Slide', 'fingerprint_ok': True}, content=ok_text + '\n3. Tuning')[1]:
        fails.append('"Content Slide" with the template fingerprint was refused (names match without underscores)')
    res1, e1 = create(content=ok_text + '\n3. Prediction', repeat=False)
    res2, e2 = create(content=ok_text + '\n3. Prediction', repeat=False)
    res3, e3 = create(content=ok_text + '\n3. Prediction', repeat=True)
    if e1 or not (e2 or '').startswith('duplicate') or e3:
        fails.append(f'duplicate request handling: {e1} / {e2} / {e3}')
    shutil.rmtree(S.NAPKIN_CACHE, ignore_errors=True)
    access_tests(fails)
    http_tests(fails, sent)
    valid, invalid = samples('QUALITY_VALID'), samples('QUALITY_INVALID')
    bad_v = [t for t in valid if not S.content_quality(t)]
    bad_i = [t for t in invalid if S.content_quality(t)]
    if bad_v:
        fails.append(f'valid text refused by the server: {bad_v}')
    if bad_i:
        fails.append(f'meaningless text accepted by the server: {bad_i}')
    print(f'server: {len(sent)} recorded requests, style_ids sent: {sorted({b["style_id"][:4] + "..." + b["style_id"][-4:] for b in sent})}; '
          f'quality lists {len(valid)} valid / {len(invalid)} invalid; ' + ('ALL PASSED' if not fails else 'FAILED'))
    for f in fails:
        print('  FAIL', f)
    return 1 if fails else 0


# ---------------------------------------------------------------- Napkin quota
def quota_tests(fails):
    import io
    import urllib.error
    real_open, calls = S.urllib.request.urlopen, []
    S.napkin_settings = lambda: {'key': 'test-key', 'enabled': True}

    def refuse(code, body, headers):
        def urlopen(req, timeout=None):
            calls.append(req.full_url)
            raise urllib.error.HTTPError(req.full_url, code, 'refused', headers, io.BytesIO(json.dumps(body).encode()))
        return urlopen
    try:
        from email.message import Message
        h = Message()
        for k, v in {'X-RateLimit-Limit': '30', 'X-RateLimit-Remaining': '0', 'X-RateLimit-Window': '1h', 'Retry-After': '120'}.items():
            h[k] = v
        S.urllib.request.urlopen = refuse(429, {'error': 'rate_limit_exceeded', 'retry_after': 120}, h)
        try:
            S.napkin_call('POST', 'https://api.napkin.ai/v1/visual', {'content': 'x'})
            fails.append('429 was not reported')
        except S.NapkinError as e:
            if e.code != 429 or 'rate limit' not in str(e) or '120' not in str(e) or len(calls) != 1:
                fails.append(f'429 handling: {e.code} {e} ({len(calls)} calls)')
        if S.NAPKIN_RATE.get('X-RateLimit-Limit') != '30' or S.NAPKIN_RATE.get('X-RateLimit-Remaining') != '0':
            fails.append(f'rate-limit headers not kept: {S.NAPKIN_RATE}')
        S.urllib.request.urlopen = refuse(402, {'error': 'no_credits'}, Message())
        try:
            S.napkin_call('POST', 'https://api.napkin.ai/v1/visual', {'content': 'x'})
        except S.NapkinError as e:
            if e.code != 402 or 'no credits' not in str(e):
                fails.append(f'402 handling: {e.code} {e}')
        if S.limits({'napkin_max_per_day': 50, 'napkin_max_per_user_per_day': 5}) != {'per_day': 50, 'per_user_per_day': 5} or S.limits({})['per_day'] != S.CONFIG['napkin_max_per_day'] or S.CONFIG['napkin_max_per_day'] != 0 or S.limits({'napkin_max_per_day': 0})['per_day'] != 0:
            fails.append('local caps do not follow the policy')
    finally:
        S.urllib.request.urlopen = real_open


# ---------------------------------------------------------------- access
def _prime(bits, rnd):
    while True:
        n = rnd.getrandbits(bits) | (1 << bits - 1) | 1
        if all(n % p for p in (3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37)) and all(pow(a, n - 1, n) == 1 for a in (2, 3, 5, 7, 11, 13, 17, 19, 23, 29)):
            d, r = n - 1, 0
            while d % 2 == 0:
                d, r = d // 2, r + 1
            if all(_mr(a, d, r, n) for a in (2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37)):
                return n


def _mr(a, d, r, n):
    x = pow(a, d, n)
    if x in (1, n - 1):
        return True
    for _ in range(r - 1):
        x = pow(x, 2, n)
        if x == n - 1:
            return True
    return False


def _rsa_key():
    rnd, e = random.Random(1077), 65537
    while True:
        p, q = _prime(1024, rnd), _prime(1024, rnd)
        phi = (p - 1) * (q - 1)
        if p != q and phi % e:
            return p * q, e, pow(e, -1, phi)


def _b64u(b):
    return base64.urlsafe_b64encode(b).rstrip(b'=').decode()


def _token(key, claims, kid='k1'):
    n, e, d = key
    k = (n.bit_length() + 7) // 8
    h = _b64u(json.dumps({'alg': 'RS256', 'kid': kid, 'typ': 'JWT'}).encode()) + '.' + _b64u(json.dumps(claims).encode())
    di = bytes.fromhex('3031300d060960864801650304020105000420') + hashlib.sha256(h.encode()).digest()
    em = b'\x00\x01' + b'\xff' * (k - 3 - len(di)) + b'\x00' + di
    return h + '.' + _b64u(pow(int.from_bytes(em, 'big'), d, n).to_bytes(k, 'big'))


def access_tests(fails):
    tmp = tempfile.mkdtemp(prefix='aivb-acc-')
    A.POLICY_PATH = os.path.join(tmp, 'access.json')
    def put(pol):
        with open(A.POLICY_PATH, 'w', encoding='utf-8') as f:
            json.dump(pol, f)
    try:
        if A.identify('')['ok']:
            fails.append('no policy: access was granted')
        import getpass
        put({'mode': 'windows', 'allowed_users': [getpass.getuser()]})
        if not A.identify('')['ok']:
            fails.append('windows mode: the listed account was refused')
        put({'mode': 'windows', 'allowed_users': ['someone-else']})
        if A.identify('')['ok']:
            fails.append('windows mode: an unlisted account was allowed')
        key, tid, cid = _rsa_key(), '11111111-2222-3333-4444-555555555555', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
        jwks = {'keys': [{'kty': 'RSA', 'kid': 'k1', 'n': _b64u(key[0].to_bytes(256, 'big')), 'e': _b64u(key[1].to_bytes(3, 'big'))}]}
        A.fetch_json, A._jwks = (lambda url: jwks), {}
        put({'mode': 'entra', 'tenant_id': tid, 'client_id': cid, 'allowed_users': ['alice@simplilearn.net'], 'allowed_roles': ['Visuals.Generate'], 'allowed_groups': ['g-1']})
        now = int(time.time())
        base = {'aud': f'api://localhost:44317/{cid}', 'iss': f'https://login.microsoftonline.com/{tid}/v2.0', 'tid': tid, 'exp': now + 600, 'nbf': now - 10,
                'scp': 'access_as_user', 'oid': 'o-1', 'preferred_username': 'alice@simplilearn.net'}
        cases = [('valid, listed user', base, True), ('expired', dict(base, exp=now - 3600), False), ('other audience', dict(base, aud='api://other/app'), False),
                 ('other tenant', dict(base, tid='x', iss='https://login.microsoftonline.com/x/v2.0'), False),
                 ('not listed', dict(base, preferred_username='bob@simplilearn.net', oid='o-2'), False),
                 ('app role', dict(base, preferred_username='carol@simplilearn.net', oid='o-3', roles=['Visuals.Generate']), True),
                 ('group', dict(base, preferred_username='dan@simplilearn.net', oid='o-4', groups=['G-1']), True),
                 ('no scope', dict(base, scp='openid'), False)]
        for name, claims, want in cases:
            got = A.identify('Bearer ' + _token(key, claims))
            if got['ok'] != want:
                fails.append(f'entra {name}: expected {want}, got {got}')
        forged = _token(key, base).rsplit('.', 1)[0] + '.' + _token(key, dict(base, preferred_username='mallory@x')).rsplit('.', 1)[1]
        if A.identify('Bearer ' + forged)['ok'] or A.identify('Bearer not-a-token')['ok'] or A.identify('')['ok']:
            fails.append('entra: a forged, malformed or missing token was accepted')
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
        A.POLICY_PATH = os.path.join(tmp, 'gone.json')     # no policy for what follows


def http_tests(fails, sent):
    """The real request handler: an unauthorized caller gets 403 on every Napkin endpoint, Napkin is never called."""
    srv = S.Server(('127.0.0.1', 0), S.Handler)
    port = srv.server_address[1]
    S.ALLOWED_HOSTS = {f'localhost:{port}', f'127.0.0.1:{port}'}
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    n = len(sent)
    try:
        def call(path, body=None):
            req = urllib.request.Request(f'http://127.0.0.1:{port}{path}', data=json.dumps(body).encode() if body else None, method='POST' if body else 'GET',
                                         headers={'X-AIVB-Client': '1', 'Content-Type': 'application/json', 'Authorization': 'Bearer forged.token.value'})
            try:
                with urllib.request.urlopen(req, timeout=10) as r:
                    return r.status, json.loads(r.read() or b'{}')
            except urllib.error.HTTPError as e:
                return e.code, json.loads(e.read() or b'{}')
        status = call('/api/status')
        codes = {p: call(p)[0] for p in ('/api/napkin/last', '/api/napkin/status?id=job1', '/api/napkin/file?id=job1&i=0&format=svg')}
        codes['/api/napkin/visual'] = call('/api/napkin/visual', {'content': 'Machine learning workflow\n1. Data collection\n2. Model training', 'format': 'svg', 'variations': 1,
                                                                  'confirmed': True, 'slide': {'layout_name': 'Content_Slide', 'fingerprint_ok': True}})[0]
        if any(c != 403 for c in codes.values()) or len(sent) != n:
            fails.append(f'unauthorized HTTP calls were not all refused: {codes}, Napkin calls {len(sent) - n}')
        st = status[1]
        if status[0] != 200 or st.get('access', {}).get('authorized') or 'used_today' in st.get('napkin', {}):
            fails.append(f'status for an unauthorized caller: {status}')
    finally:
        srv.shutdown()


if __name__ == '__main__':
    sys.exit(main())
