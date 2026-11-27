"""SL Editor 10.27: what this user's earlier visuals teach the next ones (kept on this PC only, %LOCALAPPDATA%\\AIVisualBuilder\\learning.json).

Recorded from the panel (POST /api/learn):
  insert  a design was inserted: its layout and the icon of each point (the user accepted them)
  icon    an icon was replaced by the user: the new icon for that point's name (a correction weighs double)
  shown   the layouts a Generate showed (a layout shown often and never chosen steps back)
Used by the panel (GET /api/learn) and by Claude's icon choice (examples()):
  icons    point name -> {icon: weight}: the icon chosen before wins for the same name
  layouts  layout -> {used, shown}: often-used layouts first, the last few inserted ones step back (variety)
  recent   the last inserted layouts, newest first
Only point names (at most 80 characters), icon names and layout names are kept, never the slide text; at most 3000
names and 200 examples (oldest dropped). Nothing leaves this PC except the few examples given to Claude with an icon
choice, which already sees the points.
"""
import json, os, re, threading, time

NAME = 'learning.json'
MAX_NAMES, MAX_EXAMPLES = 3000, 200
_LOCK = threading.Lock()


def _key(s):
    return re.sub(r'[^a-z0-9]+', ' ', str(s or '').lower()).strip()[:80]


def _icon(s):
    s = re.sub(r'^L:', '', str(s or ''))
    return s if re.fullmatch(r'[a-z0-9][a-z0-9-]{0,60}', s) else ''


def _layout(s):
    s = re.sub(r':\d+$', '', str(s or ''))
    return s if re.fullmatch(r'[A-Za-z0-9_:.-]{1,60}', s) else ''


def load(data_dir):
    try:
        with open(os.path.join(data_dir, NAME), encoding='utf-8') as f:
            d = json.load(f)
        if isinstance(d, dict):
            for k, v in (('icons', {}), ('layouts', {}), ('recent', []), ('examples', [])):
                if not isinstance(d.get(k), type(v)):
                    d[k] = v
            return d
    except (OSError, ValueError):
        pass
    return {'icons': {}, 'layouts': {}, 'recent': [], 'examples': []}


def _save(data_dir, d):
    os.makedirs(data_dir, exist_ok=True)
    p = os.path.join(data_dir, NAME)
    tmp = p + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, separators=(',', ':'))
    for i in range(5):              # 10.28: a virus scanner can hold the file for a moment ("access denied"): try again
        try:
            os.replace(tmp, p)
            return
        except PermissionError:
            if i == 4:
                raise
            time.sleep(0.1 * (i + 1))


def record(data_dir, ev):
    """One event from the panel; returns a short summary. Bad input is ignored, never stored."""
    if not isinstance(ev, dict):
        return {'ok': False}
    kind = str(ev.get('kind') or '')
    with _LOCK:
        d = load(data_dir)
        n = 0
        pairs = ev.get('icons') if isinstance(ev.get('icons'), list) else []
        w = 2 if kind == 'icon' else 1
        for p in pairs[:12]:
            if not (isinstance(p, (list, tuple)) and len(p) == 2):
                continue
            k, ic = _key(p[0]), _icon(p[1])
            if not k or not ic:
                continue
            m = d['icons'].setdefault(k, {})
            if kind == 'icon':                      # a correction: the earlier choice for this name loses weight
                for o in list(m):
                    if o != ic:
                        m[o] -= 1
                        if m[o] <= 0:
                            del m[o]
            m[ic] = min(50, m.get(ic, 0) + w)
            n += 1
        if kind == 'insert':
            lay = _layout(ev.get('layout'))
            if lay:
                L = d['layouts'].setdefault(lay, {'used': 0, 'shown': 0})
                L['used'] = L.get('used', 0) + 1
                d['recent'] = [lay] + [x for x in d['recent'] if x != lay][:11]
                d['examples'] = (d['examples'] + [{'at': int(time.time()), 'layout': lay, 'points': [[_key(p[0]), _icon(p[1])] for p in pairs[:8]
                                                                                                    if isinstance(p, (list, tuple)) and len(p) == 2]}])[-MAX_EXAMPLES:]
        elif kind == 'shown':
            for lay in (ev.get('layouts') or [])[:40]:
                lay = _layout(lay)
                if lay:
                    L = d['layouts'].setdefault(lay, {'used': 0, 'shown': 0})
                    L['shown'] = L.get('shown', 0) + 1
        if len(d['icons']) > MAX_NAMES:                 # the least used names go first
            for k in sorted(d['icons'], key=lambda k: sum(d['icons'][k].values()))[:len(d['icons']) - MAX_NAMES]:
                d['icons'].pop(k, None)
        _save(data_dir, d)
    return {'ok': True, 'names': n}


def state(data_dir):
    d = load(data_dir)
    return {'icons': d['icons'], 'layouts': d['layouts'], 'recent': d['recent'][:12], 'examples': len(d['examples'])}


def examples(data_dir, n=12):
    """The last accepted point -> icon choices (for Claude's icon choice: this user's own taste)."""
    out = []
    for e in reversed(load(data_dir)['examples']):
        for k, ic in e.get('points') or []:
            if k and ic and [k, ic] not in out:
                out.append([k, ic])
        if len(out) >= n:
            break
    return out[:n]
