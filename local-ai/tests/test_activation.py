"""V10.22 activation keys (activation.py) and the team panel host's gate (server.py, AIVB_ACTIVATION=1).
No network, no paid request: dummy AI keys, a panel host on plain HTTP in a temporary data folder.
- keys: format, typing variants (case, spaces, O for 0), 100-bit randomness, distinct
- bundle: no AI key in plain text; a wrong, unknown, withdrawn or expired key is refused; a changed bundle is refused
- activation: writes napkin.json / claude.json in the usual format, a record bound to this user and PC (DPAPI on Windows)
- record: changed, copied to another user/PC, expired, withdrawn, or a new bundle -> refused and the AI keys removed
- server gate: before activation every page is the activation page, every API except status/activation answers 403,
  scripts are refused and icons are served; the activate API (rate-limited) unlocks everything at once; the key is
  never logged
Usage: python tests/test_activation.py   (exit code 1 on failure)
"""
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, APP)
import activation as A  # noqa: E402

RESULTS = []
SEC = {'anthropic_api_key': 'sk-ant-TEST' + '0' * 30, 'napkin_api_key': 'napkin-test-token-0000', 'claude_model': 'claude-opus-5-5'}


def check(name, ok, detail=''):
    RESULTS.append((name, bool(ok)))
    print(('PASS ' if ok else 'FAIL ') + name + (f'  ({detail})' if detail and not ok else ''))


def files(d):
    return sorted(os.listdir(d)) if os.path.isdir(d) else []


def unit(tmp):
    k = A.new_key()
    check('key format AIVB-XXXXX-XXXXX-XXXXX-XXXXX', len(k) == 28 and k.startswith('AIVB-') and len(A.normalize(k)) == 20)
    check('typing variants accepted', A.normalize(k.lower().replace('-', ' ')) == A.normalize(k) and A.normalize('AIVB-0OOOO-11111-22222-33333') == '00000111112222233333')
    check('not a key -> ""', A.normalize('hello') == '' and A.normalize('AIVB-12345') == '')
    check('keys distinct', len({A.new_key() for _ in range(500)}) == 500)
    bundle, rows = A.issue(SEC, 3, '2099-12-31', ['Asha', 'Ravi'])
    raw = json.dumps(bundle)
    check('bundle has no key in plain text', SEC['anthropic_api_key'] not in raw and SEC['napkin_api_key'] not in raw and 'sk-ant-' not in raw)
    check('rows: count, names, expiry', len(rows) == 3 and rows[0]['given_to'] == 'Asha' and rows[2]['given_to'] == '' and rows[1]['expires'] == '2099-12-31')
    bp = os.path.join(tmp, 'b', A.BUNDLE_NAME)
    A._write(bp, bundle)
    dd = os.path.join(tmp, 'data')
    check('unknown key refused', not A.activate(A.new_key(), dd, bp)['ok'] and files(dd) == [])
    check('no key at all refused', A.activate('', dd, bp)['reason'] == 'invalid')
    r = A.activate(rows[0]['activation_key'], dd, bp)
    check('valid key activates', r['ok'] and r['label'] == 'Asha' and r['services'] == ['Napkin AI', 'Claude'], r)
    c = json.load(open(os.path.join(dd, 'claude.json')))
    n = json.load(open(os.path.join(dd, 'napkin.json')))
    check('AI keys written in the usual format', c['api_key'] == SEC['anthropic_api_key'] and c['enabled'] and c['model'] == 'claude-opus-5-5' and n['api_key'] == SEC['napkin_api_key'])
    rec = json.load(open(os.path.join(dd, A.RECORD_NAME)))
    check('record holds no plain data key, bound to this user', rec['key'].startswith('dpapi:' if os.name == 'nt' else 'plain:') and rec['user'] == A.current_user())
    check('status ok', A.status(dd, bp)['ok'])

    def again():
        A.activate(rows[0]['activation_key'], dd, bp)
        return json.load(open(os.path.join(dd, A.RECORD_NAME)))
    rec = again(); rec['expires'] = '2199-01-01'; A._write(os.path.join(dd, A.RECORD_NAME), rec)
    s = A.status(dd, bp)
    check('changed record refused, AI keys removed', not s['ok'] and s['reason'] == 'changed' and files(dd) == [])
    rec = again(); rec['user'] = 'OTHER\\someone'; rec['mac'] = 'x'; A._write(os.path.join(dd, A.RECORD_NAME), rec)
    check('record of another user refused', not A.status(dd, bp)['ok'] and files(dd) == [])
    if os.name == 'nt':
        rec = again(); rec['key'] = 'dpapi:' + A._b64(b'not a dpapi blob'); A._write(os.path.join(dd, A.RECORD_NAME), rec)
        check('record copied from another PC/user (DPAPI) refused', A.status(dd, bp)['reason'] == 'other-user' and files(dd) == [])
    rec = again()
    b2, _ = A.issue(SEC, 1, '2099-12-31')
    bp2 = os.path.join(tmp, 'b2', A.BUNDLE_NAME); A._write(bp2, b2)
    check('a new bundle needs a new activation', A.status(dd, bp2)['reason'] == 'new-keys')
    again()
    bundle['revoked'].append(A.key_id(A.normalize(rows[0]['activation_key']))); A._write(bp, bundle)
    check('withdrawn key: record refused, keys removed', A.status(dd, bp)['reason'] == 'revoked' and files(dd) == [])
    check('withdrawn key cannot activate', 'withdrawn' in A.activate(rows[0]['activation_key'], dd, bp)['message'])
    check('other keys still work', A.activate(rows[1]['activation_key'], dd, bp)['ok'])
    old, _ = A.issue(SEC, 1, '2020-01-01')
    bp3 = os.path.join(tmp, 'b3', A.BUNDLE_NAME); A._write(bp3, old)
    ok_old = A.unlock(old, _[0]['activation_key'])
    check('expired key refused', ok_old[0] is None and 'expired' in ok_old[1])
    bad = json.loads(json.dumps(bundle)); bad['payload']['c'] = A._b64(b'x' * 40); A._write(bp, bad)
    check('changed bundle refused', not A.status(dd, bp)['ok'])
    A._write(bp, bundle)
    try:
        A.issue({'anthropic_api_key': '', 'napkin_api_key': ''}, 1, '2099-01-01'); check('bundle without AI keys refused', False)
    except ValueError:
        check('bundle without AI keys refused', True)
    return bundle, rows, bp


def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p


def server(tmp, bp, rows):
    port = free_port()
    dd = os.path.join(tmp, 'srv')
    os.makedirs(dd)
    with open(os.path.join(dd, 'napkin.json'), 'w') as f:       # a plain-text key left by an older package
        json.dump({'api_key': 'old-plain-text-key-123', 'enabled': True}, f)
    env = dict(os.environ, AIVB_ACTIVATION='1', AIVB_DATA_DIR=dd, AIVB_BUNDLE=bp, AIVB_ACCESS=os.path.join(dd, 'access.json'))
    env.pop('AIVB_HOSTED', None)
    log = open(os.path.join(tmp, 'server.out'), 'w')
    proc = subprocess.Popen([sys.executable, os.path.join(APP, 'server.py'), '--http', '--port', str(port)], cwd=APP, env=env, stdout=log, stderr=log)
    base = f'http://localhost:{port}'

    def req(path, body=None, api=True):
        h = {'X-AIVB-Client': '1'} if api else {}
        data = None
        if body is not None:
            h['Content-Type'] = 'application/json'; data = json.dumps(body).encode()
        try:
            with urllib.request.urlopen(urllib.request.Request(base + path, data=data, headers=h), timeout=10) as r:
                return r.status, r.read()
        except urllib.error.HTTPError as e:
            return e.code, e.read()
    try:
        for _ in range(50):
            try:
                if req('/api/status')[0] == 200:
                    break
            except OSError:
                time.sleep(0.2)
        code, body = req('/api/status')
        st = json.loads(body)
        check('server: status answers before activation', code == 200 and st['activation']['required'] and not st['activation']['ok'])
        check('server: an old plain-text key is removed', not os.path.exists(os.path.join(dd, 'napkin.json')))
        code, body = req('/v10.html?open=slides', api=False)
        check('server: panel page served with the activation gate', code == 200 and b'/gate.js' in body)
        check('server: gate script and SL Smart Design function scripts served', all(req(p, api=False)[0] == 200 for p in ('/gate.js', '/slsd.js', '/bridge.js', '/app.js')))
        check('server: activation page served', b'Activate AI Visual Builder' in req('/activate.html', api=False)[1])
        check('server: ribbon icons served', req('/assets/icon-32.png', api=False)[0] == 200)
        a = json.loads(req('/api/activation')[1])
        check('server: activation state tells the gate to show', a['required'] and not a['ok'])
        check('server: SL Smart Design commands work without activation', req('/api/slsd/status?id=none')[0] != 403 and req('/api/bridge/next?doc=x')[0] != 403)
        check('server: APIs refused (GET)', req('/api/gallery?k=x')[0] == 403 and req('/api/claude/last')[0] == 403)
        check('server: APIs refused (POST)', req('/api/claude/visual', {'content': 'x'})[0] == 403 and req('/api/gallery', {'k': 'x'})[0] == 403)
        code, body = req('/api/activate', {'key': A.new_key()})
        check('server: wrong key refused', code == 200 and not json.loads(body)['ok'])
        code, body = req('/api/activate', {'key': rows[2]['activation_key']})
        r = json.loads(body)
        check('server: activation by the panel', code == 200 and r['ok'] and r['services'] == ['Napkin AI', 'Claude'], body)
        check('server: answer has no secret', b'sk-ant-' not in body and b'"d"' not in body)
        st = json.loads(req('/api/status')[1])
        check('server: activated, AI services configured', st['activation']['ok'] and st['claude']['configured'] and st['napkin']['configured'])
        check('server: gate stays hidden after activation', json.loads(req('/api/activation')[1])['ok'])
        check('server: AI APIs after activation', req('/api/gallery?k=x')[0] == 404)
        codes = [req('/api/activate', {'key': 'AIVB-00000-00000-00000-00000'})[0] for _ in range(10)]
        check('server: activation attempts rate-limited', 429 in codes)
    finally:
        proc.terminate(); proc.wait(10); log.close()
    out = open(os.path.join(tmp, 'server.out'), encoding='utf-8', errors='replace').read()
    check('server: no key in the log', rows[2]['activation_key'] not in out and A.normalize(rows[2]['activation_key']) not in out and 'sk-ant-' not in out)
    check('server: activation logged', 'activation done' in out)


def main():
    tmp = tempfile.mkdtemp(prefix='aivb-act-')
    try:
        bundle, rows, bp = unit(tmp)
        server(tmp, bp, rows)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    bad = [n for n, ok in RESULTS if not ok]
    print(f'\nactivation: {len(RESULTS) - len(bad)}/{len(RESULTS)} passed' + (f'; FAILED: {", ".join(bad)}' if bad else ''))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
