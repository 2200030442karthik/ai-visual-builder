"""10.28: hub.py - the administrator's signed access list on the share, and what each PC does with it."""
import datetime as dt
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import activation as A  # noqa: E402
import hub as H  # noqa: E402

ok = fails = 0


def check(name, cond):
    global ok, fails
    ok += bool(cond)
    fails += not cond
    print(('  PASS  ' if cond else '  FAIL  ') + name)


# RFC 8032, test 1 (empty message)
sk = bytes.fromhex('9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60')
pk = bytes.fromhex('d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a')
sg = bytes.fromhex('e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b')
check('Ed25519: RFC 8032 public key', H.public_key(sk) == pk)
check('Ed25519: RFC 8032 signature', H.sign(sk, b'') == sg)
check('Ed25519: verifies; a changed message or signature does not', H.verify(pk, b'', sg) and not H.verify(pk, b'x', sg) and not H.verify(pk, b'', sg[:-1] + bytes([sg[-1] ^ 1])))

with tempfile.TemporaryDirectory() as root:
    share, admin, pc = (os.path.join(root, x) for x in ('share', 'admin', 'pc'))
    keys = os.path.join(root, 'keys')
    os.makedirs(keys)
    K1, K2 = A.new_key(), A.new_key()
    with open(os.path.join(keys, 'activation-keys.csv'), 'w', encoding='utf-8') as f:
        f.write(f'n,activation_key,given_to,expires\n1,{K1},Asha,2027-03-31\n2,{K2},Ravi,2027-03-31\n')
    id1, id2 = A.key_id(A.normalize(K1)), A.key_id(A.normalize(K2))
    cfg = H.admin_init(admin, share, keys)
    check('init: list published, admin here, public key only in the config', os.path.exists(os.path.join(share, 'access.json')) and H.is_admin(admin) and 'secret' not in json.dumps(cfg))
    hub = H.Hub(dict(cfg, grace_days=7), pc)
    check('a PC reads and accepts the signed list', hub.refresh() and hub.verdict(id1)['state'] == 'ok')
    o = H.admin_overview(admin)
    check('overview: both keys with names and last characters', {r['name'] for r in o['rows']} == {'Asha', 'Ravi'} and all(len(r['tail']) == 5 for r in o['rows']))
    H.admin_change(admin, 'revoke', K2[-5:])
    hub.refresh()
    check('withdraw by the last 5 characters: that key revoked, the other not', hub.verdict(id2)['state'] == 'revoked' and hub.verdict(id1)['state'] == 'ok')
    H.admin_change(admin, 'expires', id1, '2030-01-31')
    hub.refresh()
    check('a new expiry reaches the PC', hub.verdict(id1)['expires'] == '2030-01-31')
    H.admin_change(admin, 'approval', value='on')
    hub.refresh()
    newk = A.key_id(A.normalize(A.new_key()))
    check('approval mode: an unknown key waits, a listed key works', hub.verdict(newk)['state'] == 'pending' and hub.verdict(id1)['state'] == 'ok')
    H.admin_change(admin, 'restore', id2)
    hub.refresh()
    check('restore', hub.verdict(id2)['state'] == 'ok')
    # tampering and rollback
    p = os.path.join(share, 'access.json')
    good = json.load(open(p, encoding='utf-8'))
    bad = json.loads(json.dumps(good))
    bad['payload']['keys'][id2] = {'status': 'revoked'}
    json.dump(bad, open(p, 'w', encoding='utf-8'))
    check('a list changed by anyone else is ignored (the last valid one counts)', not hub.refresh() and hub.verdict(id2)['state'] == 'ok')
    old = json.loads(json.dumps(good))
    other = os.urandom(32)
    json.dump(H.seal_list(other, old['payload']), open(p, 'w', encoding='utf-8'))
    check('a list signed by another key is ignored', not hub.refresh())
    json.dump(good, open(p, 'w', encoding='utf-8'))
    H.admin_change(admin, 'revoke', id1)
    hub.refresh()
    json.dump(good, open(p, 'w', encoding='utf-8'))             # an older copy put back
    check('an older list cannot bring a withdrawn key back', not hub.refresh() and hub.verdict(id1)['state'] == 'revoked')
    # offline grace
    hub.cache['fetched'] = (dt.datetime.now() - dt.timedelta(days=9)).isoformat()
    check('off the network longer than the grace period: asks to connect', hub.verdict(id2)['state'] == 'offline')
    hub.cache['fetched'] = (dt.datetime.now() - dt.timedelta(days=3)).isoformat()
    check('within the grace period: the last list counts', hub.verdict(id2)['state'] == 'ok')
    far = H.Hub(dict(cfg, path=os.path.join(root, 'not-reachable'), grace_days=7), os.path.join(root, 'pc2'))
    far.cache['first_try'] = (dt.datetime.now() - dt.timedelta(days=40)).isoformat()
    check('a PC that never reached the hub folder is never locked out by it', not far.refresh() and far.verdict(id2)['state'] == 'ok')
    # activation.status with a hub verdict: withdrawn removes, waiting/expired keep the record
    bundle, rows = A.issue({'anthropic_api_key': 'sk-ant-test-only'}, 1, '2026-01-31')      # a key already expired by its own date
    bp, dd, key = os.path.join(root, 'bundle.json'), os.path.join(root, 'user'), rows[0]['activation_key']
    json.dump(bundle, open(bp, 'w', encoding='utf-8'))
    V = {'v': {'state': 'ok', 'expires': '2031-12-31', 'message': ''}}
    A.HUB = lambda kid, kind: V['v']
    try:
        r = A.activate(key, dd, bp)
        check('activation: an expired key works once the administrator extends it', r.get('ok') and r.get('expires') == '2031-12-31')
        V['v'] = {'state': 'pending', 'expires': None, 'message': 'waiting'}
        s = A.status(dd, bp)
        check('activation: waiting for approval - refused, the record kept', not s['ok'] and s['reason'] == 'pending' and os.path.exists(os.path.join(dd, A.RECORD_NAME)))
        V['v'] = {'state': 'ok', 'expires': '2020-01-01', 'message': ''}
        s = A.status(dd, bp)
        check('activation: expired by the administrator - refused, kept for an extension', not s['ok'] and s['reason'] == 'expired' and os.path.exists(os.path.join(dd, A.RECORD_NAME)))
        V['v'] = {'state': 'ok', 'expires': '2031-12-31', 'message': ''}
        check('activation: extended again - works without the key', A.status(dd, bp)['ok'])
        V['v'] = {'state': 'revoked', 'expires': None, 'message': 'withdrawn'}
        s = A.status(dd, bp)
        check('activation: withdrawn - refused and the AI keys removed', not s['ok'] and s['reason'] == 'revoked' and not os.path.exists(os.path.join(dd, A.RECORD_NAME)))
        check('activation: a withdrawn key cannot be entered again', A.unlock(bundle, key)[0] is None)
    finally:
        A.HUB = None
    check('no hub: activation unchanged (hub_verdict None)', A.hub_verdict('x') is None)
    # check-in
    hub.checked.clear()
    hub.checkin(id2, {'kind': 'ai', 'version': '10.28'})
    import time
    for _ in range(50):
        if os.path.exists(os.path.join(share, 'checkins', id2 + '.json')):
            break
        time.sleep(0.05)
    c = json.load(open(os.path.join(share, 'checkins', id2 + '.json'), encoding='utf-8'))
    check('check-in: user, PC and time on the share; the overview shows them', c['user'] and c['pc'] and any(r['id'] == id2 and r['last'] for r in H.admin_overview(admin)['rows']))
print(f'hub: {ok}/{ok + fails} passed')
sys.exit(1 if fails else 0)
