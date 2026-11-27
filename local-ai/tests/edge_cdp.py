"""Headless Microsoft Edge driven over the Chrome DevTools Protocol (standard library only), used by run_tests.py."""
import base64
import json
import os
import socket

EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

class CDP:
    """Just enough of the Chrome DevTools Protocol over a raw WebSocket (standard library only)."""
    def __init__(self, ws_url):
        host_port, path = ws_url[len('ws://'):].split('/', 1)
        host, port = host_port.split(':')
        self.s = socket.create_connection((host, int(port)), timeout=60)
        key = base64.b64encode(os.urandom(16)).decode()
        self.s.sendall((f'GET /{path} HTTP/1.1\r\nHost: {host_port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
                        f'Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
        buf = b''
        while b'\r\n\r\n' not in buf:
            buf += self.s.recv(4096)
        self.rest = buf.split(b'\r\n\r\n', 1)[1]
        self.n = 0

    def _recv(self, k):
        while len(self.rest) < k:
            chunk = self.s.recv(65536)
            if not chunk:
                raise ConnectionError('closed')
            self.rest += chunk
        out, self.rest = self.rest[:k], self.rest[k:]
        return out

    def _read(self):
        data = b''
        while True:
            b1, b2 = self._recv(2)
            n = b2 & 0x7F
            if n == 126:
                n = int.from_bytes(self._recv(2), 'big')
            elif n == 127:
                n = int.from_bytes(self._recv(8), 'big')
            data += self._recv(n)
            if b1 & 0x80:
                return data

    def call(self, method, **params):
        self.n += 1
        msg = json.dumps({'id': self.n, 'method': method, 'params': params}).encode()
        mask = os.urandom(4)
        n = len(msg)
        head = bytes([0x81]) + (bytes([0x80 | n]) if n < 126 else bytes([0x80 | 126]) + n.to_bytes(2, 'big') if n < 65536
                                else bytes([0x80 | 127]) + n.to_bytes(8, 'big'))
        self.s.sendall(head + mask + bytes(c ^ mask[i % 4] for i, c in enumerate(msg)))
        while True:
            r = json.loads(self._read())
            if r.get('id') == self.n:
                if 'error' in r:
                    raise RuntimeError(r['error'])
                return r['result']

    def js(self, expr):
        r = self.call('Runtime.evaluate', expression=expr, awaitPromise=True, returnByValue=True)
        if 'exceptionDetails' in r:
            raise RuntimeError(r['exceptionDetails'].get('exception', {}).get('description', r['exceptionDetails']))
        return r['result'].get('value')
