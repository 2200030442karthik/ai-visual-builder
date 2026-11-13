"""V10.18 hosted mode (AIVB_HOSTED=1): the central-service configuration of server.py, checked on this PC without
network, keys or credits. Starts server.py in hosted mode on a free local port with a temporary data folder and access
policy, then checks:
  - it refuses to start without AIVB_PUBLIC_HOST, and with a policy that is not "entra"
  - it serves the panel only for the public host name (any other Host header: 403)
  - API calls need the panel's header and a same-origin https Origin of the public host
  - without a sign-in token nobody may generate (access: not authorized), and no key is ever reported
Usage: python tests/test_hosted.py   (prints ALL PASSED or the failures)"""
import http.client, json, os, socket, subprocess, sys, tempfile, time

HERE = os.path.dirname(os.path.abspath(__file__))
SERVER = os.path.join(HERE, '..', 'server.py')


def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p


def start(env, port):
    e = dict(os.environ, **env, PORT=str(port))
    e.pop('NAPKIN_API_KEY', None); e.pop('ANTHROPIC_API_KEY', None)
    return subprocess.Popen([sys.executable, SERVER], env=e, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)


def get(port, path, host, headers=None):
    c = http.client.HTTPConnection('127.0.0.1', port, timeout=10)
    c.request('GET', path, headers=dict({'Host': host}, **(headers or {})))
    r = c.getresponse(); body = r.read(); c.close()
    return r.status, body


def main():
    fails = []
    tmp = tempfile.mkdtemp(prefix='aivb-hosted-')
    entra = os.path.join(tmp, 'access-entra.json'); win = os.path.join(tmp, 'access-windows.json')
    json.dump({'mode': 'entra', 'tenant_id': '00000000-0000-0000-0000-000000000000', 'client_id': '11111111-1111-1111-1111-111111111111',
               'required_scope': 'access_as_user', 'allowed_users': ['someone@example.com']}, open(entra, 'w'))
    json.dump({'mode': 'windows', 'allowed_users': ['someone']}, open(win, 'w'))
    base = {'AIVB_HOSTED': '1', 'AIVB_DATA_DIR': os.path.join(tmp, 'data')}
    os.makedirs(base['AIVB_DATA_DIR'], exist_ok=True)

    # refuses to start when misconfigured
    for name, env in [('no public host', dict(base, AIVB_ACCESS=entra)), ('windows policy', dict(base, AIVB_ACCESS=win, AIVB_PUBLIC_HOST='aivb.example.com'))]:
        p = start(env, free_port())
        try:
            out, _ = p.communicate(timeout=20)
        except subprocess.TimeoutExpired:
            p.kill(); out = ''
            fails.append(f'started although misconfigured ({name})')
        if p.returncode in (0, None):
            fails.append(f'did not refuse to start ({name}): {out[-200:]}')

    # a correctly configured hosted service
    port, host = free_port(), 'aivb.example.com'
    p = start(dict(base, AIVB_ACCESS=entra, AIVB_PUBLIC_HOST=host), port)
    try:
        for _ in range(50):
            try:
                socket.create_connection(('127.0.0.1', port), 0.3).close(); break
            except OSError:
                time.sleep(0.2)
        st, body = get(port, '/v10.html', host)
        if st != 200 or b'AI Visual Builder' not in body:
            fails.append(f'panel not served for the public host ({st})')
        st, _ = get(port, '/v10.html', 'localhost:%d' % port)
        if st != 403:
            fails.append(f'another host name was served ({st})')
        st, _ = get(port, '/api/status', host)
        if st != 403:
            fails.append(f'API call without the panel header was accepted ({st})')
        st, _ = get(port, '/api/status', host, {'X-AIVB-Client': '1', 'Origin': 'https://evil.example.net'})
        if st != 403:
            fails.append(f'cross-origin API call was accepted ({st})')
        st, body = get(port, '/api/status', host, {'X-AIVB-Client': '1', 'Origin': 'https://' + host})
        try:
            s = json.loads(body)
        except ValueError:
            s = {}
        if st != 200 or s.get('server', '').split('.')[0] != '10':
            fails.append(f'status not served to the panel ({st})')
        elif s.get('access', {}).get('authorized'):
            fails.append('authorized without a sign-in token')
        if b'sk-ant-' in body or b'api_key' in body:
            fails.append('a key appears in the status')
    finally:
        p.kill(); p.wait()
    print('hosted: ' + ('ALL PASSED' if not fails else 'FAILED: ' + '; '.join(fails)))
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
