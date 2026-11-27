"""10.27: learn.py - what earlier visuals teach the next ones (kept on this PC only)."""
import os, sys, tempfile
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import learn as L  # noqa: E402

ok = fails = 0


def check(name, cond):
    global ok, fails
    ok += bool(cond)
    fails += not cond
    print(('  PASS  ' if cond else '  FAIL  ') + name)


with tempfile.TemporaryDirectory() as d:
    check('empty state', L.state(d) == {'icons': {}, 'layouts': {}, 'recent': [], 'examples': 0})
    L.record(d, {'kind': 'insert', 'layout': 'ref_l2rows:3', 'icons': [['Role', 'L:id-card'], ['Context', 'L:layers']]})
    s = L.state(d)
    check('insert: icons per point name', s['icons'] == {'role': {'id-card': 1}, 'context': {'layers': 1}})
    check('insert: layout used and recent (colour suffix removed)', s['layouts']['ref_l2rows']['used'] == 1 and s['recent'] == ['ref_l2rows'])
    L.record(d, {'kind': 'icon', 'icons': [['Role', 'L:user-cog']]})
    check('a correction weighs double and the earlier choice loses weight', L.state(d)['icons']['role'] == {'user-cog': 2})
    L.record(d, {'kind': 'shown', 'layouts': ['ref_l2rows', 'ref_rhex']})
    check('shown counted', L.state(d)['layouts']['ref_rhex']['shown'] == 1)
    L.record(d, {'kind': 'insert', 'layout': '../etc', 'icons': [['x', '<script>'], ['y' * 200, 'L:ok-icon']]})
    s = L.state(d)
    check('bad names never stored', '../etc' not in s['layouts'] and 'x' not in s['icons'] and max(len(k) for k in s['icons']) <= 80)
    check('examples for Claude', ['role', 'id-card'] in L.examples(d))
    check('garbage ignored', L.record(d, 'nonsense') == {'ok': False})
print(f'learn: {ok}/{ok + fails} passed')
sys.exit(1 if fails else 0)
