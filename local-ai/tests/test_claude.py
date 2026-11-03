"""V10.10 Claude AI checks without network or cost: the Anthropic client is a stand-in that records each request, and the
panel host's data folder is a temporary one (the real claude.json and its key are never read).
- claude_visual: the content plan is one request with structured output (JSON schema, the configured effort), no
  beta; invalid or empty plans reported. Drawings: one request per variation, the configured model / effort / max_tokens, no fallback model or beta, no
  automatic retries (max_retries=0); refusal, missing SVG and API errors reported per variation, the others kept; the
  key never appears in an error; cost estimated from the token counts; claude.json read with or without a BOM
- server: not configured -> refused with the setup instruction; unconfirmed, 2 variations, meaningless text, another
  slide layout -> refused before any request; the job runs in the background and the panel polls it; files kept on
  disk and served again after a restart without a new request; the same request twice needs an explicit repeat; one
  request at a time; a failed job is reported and frees the lock
- HTTP: every Claude endpoint answers 403 to an unauthorized caller; /api/status reports Claude without the key
Usage: python tests/test_claude.py   (prints a summary; exit code 1 on failure)
"""
import json
import os
import shutil
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
from types import SimpleNamespace

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..'))
os.environ.pop('ANTHROPIC_API_KEY', None)            # the settings must come from the test's own claude.json
import claude_visual as C  # noqa: E402
import server as S  # noqa: E402

KEY = 'sk-ant-test-0123456789abcdef'
SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1079 435"><rect x="10" y="10" width="200" height="80" fill="#62B7E4"/><text x="110" y="55" font-size="22">Data collection</text></svg>'
TEXT = 'Machine learning workflow\n1. Data collection\n2. Model training\n3. Evaluation'
SLIDE = {'layout_name': 'Content_Slide', 'fingerprint_ok': True}
PLAN_JSON = json.dumps({'title': 'Machine learning workflow', 'relation': 'sequence', 'groups': [], 'flow': ['a', 'b', 'c'], 'layouts': ['pipeline', 'timeline', 'stair', 'rows'],
                        'items': [{'id': 'a', 'label': 'Data collection', 'detail': '', 'icon_hint': 'data', 'group': ''},
                                  {'id': 'b', 'label': 'Model training', 'detail': '', 'icon_hint': 'model', 'group': ''},
                                  {'id': 'c', 'label': 'Evaluation', 'detail': '', 'icon_hint': 'checklist', 'group': ''}]})


class Stream:
    def __init__(self, msg):
        self.msg = msg

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def get_final_message(self):
        if isinstance(self.msg, Exception):
            raise self.msg
        return self.msg


class FakeClient:
    """Records every request; answer(kwargs) gives the message (or an exception) for it."""
    def __init__(self, answer):
        self.calls, self.answer = [], answer
        self.messages = SimpleNamespace(stream=self.stream)
        self.beta = SimpleNamespace(messages=SimpleNamespace(stream=self.beta_stream))

    def stream(self, **kw):
        self.calls.append(kw)
        return Stream(self.answer(kw))

    def beta_stream(self, **kw):
        self.calls.append(dict(kw, beta=True))
        return Stream(self.answer(kw))


def msg(text, stop='end_turn', i=100, o=200):
    return SimpleNamespace(usage=SimpleNamespace(input_tokens=i, output_tokens=o), stop_reason=stop, content=[SimpleNamespace(type='text', text=text)])


def visual_tests(fails, tmp):
    # settings: claude.json written by Windows PowerShell 5.1 (with a BOM) is read; effort, model, prices
    with open(os.path.join(tmp, 'claude.json'), 'w', encoding='utf-8-sig') as f:
        json.dump({'api_key': KEY, 'enabled': True, 'model': 'claude-opus-5-5', 'effort': 'medium', 'max_tokens': 20000}, f)
    s = C.settings(tmp)
    if not (s['key'] == KEY and s['effort'] == 'medium' and s['max_tokens'] == 20000 and s['prices'] == (4.0, 20.0) and s['enabled'] == (C.anthropic is not None)):
        fails.append(f'settings from claude.json with a BOM: { {k: v for k, v in s.items() if k != "key"} }')
    # a placeholder in ANTHROPIC_API_KEY (as found on this PC: one character) never makes Claude look configured
    os.environ['ANTHROPIC_API_KEY'] = 'x'
    empty = tempfile.mkdtemp(prefix='aivb-claude-empty-')
    if C.settings(empty)['key'] or C.settings(tmp)['key'] != KEY:
        fails.append('a placeholder ANTHROPIC_API_KEY was taken as a key')
    os.environ.pop('ANTHROPIC_API_KEY', None)
    shutil.rmtree(empty, ignore_errors=True)
    # four variations: four requests, four different arrangements, no fallback model or beta
    fc = FakeClient(lambda kw: msg(SVG))
    r = C.generate(s, TEXT, 'Topic: ML.', 4, True, 60, client=fc)
    arr = {c['messages'][0]['content'].split('Arrangement for this design:')[-1] for c in fc.calls}
    bad = [c for c in fc.calls if c.get('beta') or 'fallbacks' in c or 'betas' in c or c['model'] != 'claude-opus-5-5' or c['max_tokens'] != 20000 or c['output_config'] != {'effort': 'medium'}]
    if len(fc.calls) != 4 or len(arr) != 4 or bad or len(r['svgs']) != 4 or r['errors']:
        fails.append(f'4 variations: {len(fc.calls)} requests, {len(arr)} arrangements, bad {bad[:1]}, {len(r["svgs"])} SVGs, errors {r["errors"]}')
    if r['usage'] != {'input_tokens': 400, 'output_tokens': 800} or r['cost_usd'] != round(400 / 1e6 * 4 + 800 / 1e6 * 20, 4):
        fails.append(f'usage / cost: {r["usage"]} {r["cost_usd"]}')
    # one visual: one request, no arrangement imposed (Claude chooses what suits the content)
    fc = FakeClient(lambda kw: msg(SVG))
    r = C.generate(s, TEXT, '', 1, False, 60, client=fc)
    if len(fc.calls) != 1 or 'Arrangement for this design' in fc.calls[0]['messages'][0]['content']:
        fails.append('1 visual: not exactly one request with free arrangement')
    # failures per variation: refusal, cut off, no SVG, an exception carrying the key; the good one is kept
    seq = iter([msg(SVG), msg('', stop='refusal'), msg('<svg', stop='max_tokens'), RuntimeError(f'boom {KEY}')])
    lock = threading.Lock()

    def nxt(kw):
        with lock:
            return next(seq)
    fc = FakeClient(nxt)
    r = C.generate(s, TEXT, '', 4, False, 60, client=fc)
    joined = ' '.join(r['errors'])
    if len(r['svgs']) != 1 or len(r['errors']) != 3 or KEY in joined or len(fc.calls) != 4:
        fails.append(f'failures per variation: {len(r["svgs"])} SVGs, errors {r["errors"]}, {len(fc.calls)} requests (no retries expected)')
    fc = FakeClient(lambda kw: msg('Here is a description, but no picture.'))
    r = C.generate(s, TEXT, '', 1, False, 60, client=fc)
    if r['svgs'] or 'did not contain an SVG' not in ' '.join(r['errors']):
        fails.append(f'an answer without SVG was not reported: {r}')
    # the real client is built with max_retries=0 (no automatic repeat of a paid request)
    if C.anthropic is not None:
        made = {}
        real = C.anthropic.Anthropic
        C.anthropic.Anthropic = lambda **kw: made.update(kw) or FakeClient(lambda k: msg(SVG))
        try:
            C.generate(s, TEXT, '', 1, False, 60)
        finally:
            C.anthropic.Anthropic = real
        if made.get('max_retries') != 0 or made.get('api_key') != KEY:
            fails.append(f'client options: { {k: v for k, v in made.items() if k != "api_key"} }')
    # the content plan: one request (whatever the number of layouts), structured output with the schema, no beta
    fc = FakeClient(lambda kw: msg(PLAN_JSON))
    r = C.generate(s, TEXT, 'Topic: ML.', 4, True, 60, client=fc, mode='plan')
    c0 = fc.calls[0] if fc.calls else {}
    oc = c0.get('output_config', {})
    if len(fc.calls) != 1 or c0.get('beta') or c0.get('system') != C.PLAN_SYSTEM or oc.get('effort') != 'medium' or (oc.get('format') or {}).get('type') != 'json_schema' \
            or oc['format'].get('schema') != C.PLAN_SCHEMA or r['errors'] or len(r['files']) != 1 or json.loads(r['files'][0])['items'][0]['label'] != 'Data collection':
        fails.append(f'content plan request: {len(fc.calls)} requests, output_config {str(oc)[:120]}, errors {r["errors"]}')
    # the schema: every object closed (additionalProperties false), every property required, layouts from the panel's list
    def closed(o):
        if isinstance(o, dict):
            if o.get('type') == 'object' and (o.get('additionalProperties') is not False or set(o.get('required', [])) != set(o.get('properties', {}))):
                return False
            return all(closed(v) for v in o.values())
        return all(closed(v) for v in o) if isinstance(o, list) else True
    if not closed(C.PLAN_SCHEMA) or C.PLAN_SCHEMA['properties']['layouts']['items']['enum'] != C.PLAN_LAYOUTS:
        fails.append('plan schema: an object is not closed or a property is optional')
    # the lists Claude chooses from are the panel's: every layout family (plan.js and the design packs) and every object
    import re
    js = open(os.path.join(HERE, '..', 'plan.js'), encoding='utf-8').read() + ''.join(open(os.path.join(HERE, '..', 'packs', f), encoding='utf-8').read() for f in os.listdir(os.path.join(HERE, '..', 'packs')) if f.endswith('.js'))
    gal = open(os.path.join(HERE, '..', 'gallery.js'), encoding='utf-8').read()
    objs = set(re.findall(r'^\s{2}([a-zA-Z0-9]+): \(x, y, s, c\)', gal[gal.index('const CMP = {'):gal.index('const CATALOG')], re.M))
    if sorted(re.findall(r"regPlan\('([a-z0-9]+)'", js)) != sorted(C.PLAN_LAYOUTS) or [k for k in C.PICTORIALS if k not in objs]:
        fails.append(f'design lists out of step with the panel: families {sorted(set(re.findall(chr(114) + "egPlan", js)))[:3]}, objects missing {[k for k in C.PICTORIALS if k not in objs]}')
    for bad_answer, why in (('not json at all', 'no valid JSON'), (json.dumps({'items': [{'id': 'a'}]}), 'fewer than 2 items')):
        fc = FakeClient(lambda kw, a=bad_answer: msg(a))
        r = C.generate(s, TEXT, '', 1, False, 60, client=fc, mode='plan')
        if r['files'] or why not in ' '.join(r['errors']) or len(fc.calls) != 1:
            fails.append(f'bad plan ({why}) not reported: {r["errors"]}, {len(fc.calls)} requests')


def server_tests(fails, tmp):
    S.DATA_DIR = tmp
    S.CLAUDE_CACHE = os.path.join(tmp, 'claude-last')
    calls, gate = [], threading.Event()
    gate.set()
    conf = {'key': KEY, 'model': 'claude-opus-5-5', 'effort': 'high', 'max_tokens': 32000, 'prices': (4.0, 20.0), 'sdk': True, 'enabled': True}
    S.C.settings = lambda d: dict(conf)
    plan = {'svgs': [SVG, SVG], 'errors': []}

    def fake_generate(s, content, ctx, variations, ordered, timeout, client=None, mode='svg'):
        calls.append({'variations': variations, 'ordered': ordered, 'context': ctx, 'mode': mode})
        gate.wait(10)
        if plan.get('raise'):
            raise RuntimeError(plan['raise'])
        files = [PLAN_JSON] if mode == 'plan' else plan['svgs'][:variations]
        return {'files': files, 'svgs': files, 'errors': plan['errors'], 'usage': {'input_tokens': 10, 'output_tokens': 20}, 'cost_usd': 0.0004,
                'seconds': 0.1, 'model': s['model'], 'effort': s['effort']}
    S.C.generate = fake_generate

    def create(**kw):
        try:
            return S.claude_create(dict({'content': TEXT, 'variations': 1, 'format': 'svg', 'confirmed': True, 'slide': SLIDE, 'repeat': True, 'context': 'Topic: ML.'}, **kw), {'user': 'tester'}), None
        except S.NapkinError as e:
            return None, (e.code, str(e))

    def wait(rid):
        for _ in range(100):
            st = S.claude_status(rid)
            if st['status'] != 'pending':
                return st
            time.sleep(0.05)
        return st
    # refused before any request
    conf['enabled'] = False
    _, e = create()
    conf['enabled'] = True
    if not e or e[0] != 409 or 'Configure Claude' not in e[1]:
        fails.append(f'not configured: {e}')
    for kw, why in (({'confirmed': False}, 'unconfirmed'), ({'variations': 2}, '2 variations'), ({'content': 'asdfgh jkl qwerty'}, 'meaningless text'),
                    ({'slide': {'layout_name': 'Title Slide', 'fingerprint_ok': True}}, 'another layout'), ({'slide': None}, 'no slide')):
        _, e = create(**kw)
        if not e:
            fails.append(f'{why}: not refused')
    if calls:
        fails.append(f'a refused request reached Claude: {calls}')
    # a request: background job, polled, files kept and served again after a restart without a new request
    res, e = create(variations=4, ordered=True, repeat=False)
    st = wait(res['id']) if res else {}
    if e or st.get('status') != 'completed' or st.get('files') != 2 or st.get('cost_usd') != 0.0004 or calls[-1] != {'variations': 4, 'ordered': True, 'context': 'Topic: ML.', 'mode': 'svg'}:
        fails.append(f'request: {e} {st} {calls[-1:]}')
    if res:
        files = [S.claude_file(res['id'], i)[0] for i in range(2)]
        S.CLAUDE_JOBS.clear()                                # as after a restart of the panel host
        n = len(calls)
        st2 = S.claude_status(res['id'])
        files2 = [S.claude_file(res['id'], i)[0] for i in range(2)]
        if not st2.get('cached') or files2 != files or len(calls) != n or files[0].decode() != SVG:
            fails.append(f'kept result: {st2}, new requests {len(calls) - n}')
        last = S.napkin_last(cache=S.CLAUDE_CACHE)
        if last.get('id') != res['id'] or last.get('asked') != 4 or KEY in json.dumps(last):
            fails.append(f'last.json: {last}')
    # the same request twice needs an explicit repeat
    _, e1 = create(content=TEXT + '\n4. Deployment', repeat=False)
    wait(S.napkin_last(cache=S.CLAUDE_CACHE)['id'])
    _, e2 = create(content=TEXT + '\n4. Deployment', repeat=False)
    if e1 or not e2 or not e2[1].startswith('duplicate'):
        fails.append(f'duplicate: {e1} / {e2}')
    # one request at a time
    gate.clear()
    r1, e1 = create(content=TEXT + '\n4. Monitoring')
    _, e2 = create(content=TEXT + '\n4. Tuning')
    gate.set()
    if r1:
        wait(r1['id'])
    if e1 or not e2 or 'already running' not in e2[1]:
        fails.append(f'concurrent requests: {e1} / {e2}')
    # failures: no SVG at all -> failed with the reason; an exception -> failed, key hidden; the lock is freed each time
    plan.update(svgs=[], errors=['variation 1: Claude declined this request.'])
    r, _ = create(content=TEXT + '\n4. Reporting')
    st = wait(r['id']) if r else {}
    plan.update(svgs=[SVG], errors=[], **{'raise': f'connection lost {KEY}'})
    r2, _ = create(content=TEXT + '\n4. Review')
    st2 = wait(r2['id']) if r2 else {}
    plan.pop('raise')
    r3, e3 = create(content=TEXT + '\n4. Release')
    if r3:
        wait(r3['id'])
    if st.get('status') != 'failed' or 'declined' not in (st.get('error') or '') or st2.get('status') != 'failed' or KEY in json.dumps(st2) or e3:
        fails.append(f'failed jobs: {st} / {st2} / next request {e3}')
    # the content plan: one request even when 4 variations are asked, served as JSON, its own duplicate key
    n = len(calls)
    r, e = create(format='plan', variations=4, repeat=False, content=TEXT + '\n4. Monitoring plan')
    st = wait(r['id']) if r else {}
    last = S.napkin_last(cache=S.CLAUDE_CACHE)
    data, ctype = S.claude_file(r['id'], 0) if r else (b'', '')
    if e or len(calls) != n + 1 or calls[-1]['mode'] != 'plan' or calls[-1]['variations'] != 1 or st.get('files') != 1 or last.get('format') != 'plan' \
            or last.get('asked') != 4 or not ctype.startswith('application/json') or json.loads(data)['title'] != 'Machine learning workflow':
        fails.append(f'content plan job: {e} {st} {calls[-1:]} {last.get("format")} {ctype}')
    _, e2 = create(format='plan', repeat=False, content=TEXT + '\n4. Monitoring plan')
    r3, e3 = create(format='svg', repeat=False, content=TEXT + '\n4. Monitoring plan')
    if r3:
        wait(r3['id'])
    if not e2 or not e2[1].startswith('duplicate') or e3:
        fails.append(f'plan duplicate key: same plan {e2}, the drawings of the same text {e3}')
    try:
        S.claude_status('nope')
        fails.append('an unknown request id was answered')
    except S.NapkinError as e:
        if e.code != 404:
            fails.append(f'unknown id: {e.code}')


def http_tests(fails, tmp):
    S.A.POLICY_PATH = os.path.join(tmp, 'no-policy.json')    # no administrator policy: nobody is authorized
    srv = S.Server(('127.0.0.1', 0), S.Handler)
    port = srv.server_address[1]
    S.ALLOWED_HOSTS = {f'localhost:{port}', f'127.0.0.1:{port}'}
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    n = len(S.CLAUDE_JOBS)
    try:
        def call(path, body=None):
            req = urllib.request.Request(f'http://127.0.0.1:{port}{path}', data=json.dumps(body).encode() if body else None, method='POST' if body else 'GET',
                                         headers={'X-AIVB-Client': '1', 'Content-Type': 'application/json', 'Authorization': 'Bearer forged.token.value'})
            try:
                with urllib.request.urlopen(req, timeout=10) as r:
                    return r.status, r.read()
            except urllib.error.HTTPError as e:
                return e.code, e.read()
        codes = {p: call(p)[0] for p in ('/api/claude/last', '/api/claude/status?id=abc', '/api/claude/file?id=abc&i=0')}
        codes['/api/claude/visual'] = call('/api/claude/visual', {'content': TEXT, 'variations': 1, 'confirmed': True, 'slide': SLIDE})[0]
        if any(c != 403 for c in codes.values()) or len(S.CLAUDE_JOBS) != n:
            fails.append(f'unauthorized Claude calls not all refused: {codes}')
        code, body = call('/api/status')
        st = json.loads(body)
        if code != 200 or 'claude' not in st or st['claude'].get('model') != 'claude-opus-5-5' or KEY.encode() in body or 'used_today' in st['claude'] or st.get('server') != S.VERSION:
            fails.append(f'status: {code} {st.get("claude")}')
    finally:
        srv.shutdown()


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    fails, tmp = [], tempfile.mkdtemp(prefix='aivb-claude-')
    try:
        visual_tests(fails, tmp)
        server_tests(fails, tmp)
        http_tests(fails, tmp)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print(f'claude: SDK {"present" if C.anthropic else "absent"}; ' + ('ALL PASSED' if not fails else f'FAILED ({len(fails)})'))
    for f in fails:
        print('  FAIL', f)
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
