"""SL Smart Design - Alternative Design gallery: numbered designs, clearer selection (V10.21.1).

Builds a COPY of the SL Smart Design add-in whose "Select Template" gallery (DynamicTemplateSelectorForm)
  - names every design by its number ("Design 1", "Design 2", ...) and shows the count in the title bar,
  - outlines the chosen design and makes its caption bold blue,
  - selects a design when its thumbnail is clicked (before: only the small option button), inserts it on a double-click.

What changes, and only this:
  - DynamicTemplateSelectorForm: its code gets the lines above (anchored on its existing lines; refused when they are not
    there exactly once). Its designer (the form's layout, the .frx data) is copied unchanged.
  - a new class module, ThumbClick (the click / double-click of each thumbnail).
  - the compiled p-code cache is left out, so PowerPoint compiles the project from its source when it loads it (as after
    any edit in the VBA editor). Every module's source is kept.
Unchanged, checked byte for byte after the build: Module1 (every macro, the ribbon callbacks and the licence check),
LicenseForm, both forms' designers, the ribbon (customUI) and every other part of the package. The original file is
never written.

Usage: python patch_altdesign.py SOURCE.ppam OUT_DIR
Standard library only (MS-CFB container, MS-OVBA compression). Never prints VBA source.
"""
import hashlib, os, re, struct, sys, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
FORM = 'DynamicTemplateSelectorForm'
CLASS = 'ThumbClick'
END, FREE, NOSTREAM = 0xFFFFFFFE, 0xFFFFFFFF, 0xFFFFFFFF

# ------------------------------------------------------------------ MS-CFB (compound file) read / write
def cfb_read(data):
    """The compound file as a tree: {'name','type','clsid','state','times','data','kids':[...]} (root first)."""
    if data[:8] != bytes.fromhex('D0CF11E0A1B11AE1'):
        raise SystemExit('vbaProject.bin is not a compound file.')
    ss = 1 << struct.unpack_from('<H', data, 30)[0]
    mss = 1 << struct.unpack_from('<H', data, 32)[0]
    nfat, dir0, _tx, cutoff, mfat0, nmfat, difat0, ndifat = struct.unpack_from('<IIIIIIII', data, 44)
    sec = lambda i: data[512 + i * ss: 512 + (i + 1) * ss] if ss == 512 else data[(i + 1) * ss:(i + 2) * ss]
    difat = list(struct.unpack_from('<109I', data, 76))
    d = difat0
    for _ in range(ndifat):
        v = struct.unpack('<%dI' % (ss // 4), sec(d)); difat += v[:-1]; d = v[-1]
    fat = []
    for f in difat[:nfat]:
        fat += struct.unpack('<%dI' % (ss // 4), sec(f))
    def chain(s, table):
        out, seen = [], set()
        while s < 0xFFFFFFFA:
            if s in seen: raise SystemExit('vbaProject.bin: a sector chain loops.')
            seen.add(s); out.append(s); s = table[s]
        return out
    read = lambda s: b''.join(sec(i) for i in chain(s, fat))
    dirs = read(dir0)
    ents = []
    for i in range(len(dirs) // 128):
        e = dirs[i * 128:(i + 1) * 128]
        n = struct.unpack_from('<H', e, 64)[0]
        ents.append(dict(name=e[:max(0, n - 2)].decode('utf-16-le'), type=e[66], left=struct.unpack_from('<I', e, 68)[0],
                         right=struct.unpack_from('<I', e, 72)[0], child=struct.unpack_from('<I', e, 76)[0], clsid=e[80:96],
                         state=e[96:100], times=e[100:116], start=struct.unpack_from('<I', e, 116)[0], size=struct.unpack_from('<Q', e, 120)[0] & 0xFFFFFFFF))
    root = ents[0]
    mini = read(root['start'])[:root['size']] if root['size'] else b''
    mfat = []
    for s in (chain(mfat0, fat) if nmfat else []):
        mfat += struct.unpack('<%dI' % (ss // 4), sec(s))
    def node(i):
        e = ents[i]; out = dict(name=e['name'], type=e['type'], clsid=e['clsid'], state=e['state'], times=e['times'], kids=[], data=None)
        if e['type'] == 2:
            out['data'] = (b''.join(mini[s * mss:(s + 1) * mss] for s in chain(e['start'], mfat)) if e['size'] < cutoff else read(e['start']))[:e['size']]
        elif e['type'] in (1, 5):
            def walk(j):
                if j == NOSTREAM or j >= len(ents): return
                walk(ents[j]['left']); out['kids'].append(node(j)); walk(ents[j]['right'])
            walk(e['child'])
        return out
    return node(0)


def _cfb_key(name):
    return (len(name), name.upper())


def cfb_write(root):
    """A version-3 compound file (512-byte sectors, 64-byte mini sectors, cutoff 4096) holding `root`'s tree."""
    SS, MSS, CUT = 512, 64, 4096
    entries = []                                     # flat list in directory order
    def add(n):
        idx = len(entries); entries.append(dict(n=n, left=NOSTREAM, right=NOSTREAM, child=NOSTREAM)); return idx
    def build(n):
        me = add(n)
        kids = sorted(n['kids'], key=lambda k: _cfb_key(k['name']))
        idxs = [build(k) for k in kids]
        def tree(lo, hi):                            # a balanced binary search tree of the siblings (all black)
            if lo > hi: return NOSTREAM
            mid = (lo + hi) // 2; e = entries[idxs[mid]]
            e['left'] = tree(lo, mid - 1); e['right'] = tree(mid + 1, hi)
            return idxs[mid]
        entries[me]['child'] = tree(0, len(idxs) - 1)
        return me
    build(root)
    # stream data: big streams in sectors, small ones in the mini stream
    big, mini, minifat = [], bytearray(), []
    for e in entries:
        n = e['n']
        if n['type'] != 2: continue
        data = n['data'] or b''
        e['size'] = len(data)
        if len(data) == 0:
            e['start'] = END
        elif len(data) < CUT:
            first = len(mini) // MSS; cnt = -(-len(data) // MSS)
            mini += data + b'\0' * (cnt * MSS - len(data))
            minifat += [first + k + 1 for k in range(cnt - 1)] + [END]
            e['start'] = first
        else:
            big.append((e, data))
    sectors, fat = [], []                             # sector contents and FAT entries (data sectors first)
    def alloc(data):
        if not data: return END
        cnt = -(-len(data) // SS); first = len(sectors)
        for k in range(cnt):
            sectors.append(data[k * SS:(k + 1) * SS].ljust(SS, b'\0')); fat.append(first + k + 1 if k < cnt - 1 else END)
        return first
    for e, data in big:
        e['start'] = alloc(data)
    root_e = entries[0]
    root_e['start'] = alloc(bytes(mini)); root_e['size'] = len(mini)
    mf = b''.join(struct.pack('<I', v) for v in minifat)
    mf += struct.pack('<I', FREE) * ((-len(minifat)) % (SS // 4))
    mfat_start = alloc(mf) if minifat else END; n_mfat = len(mf) // SS if minifat else 0
    # directory
    def dent(e):
        n = e['n']; nm = n['name'].encode('utf-16-le')
        if len(nm) > 62: raise SystemExit('A stream name is too long: ' + n['name'])
        typ = n['type']
        return (nm + b'\0\0').ljust(64, b'\0') + struct.pack('<HBB', len(nm) + 2, typ, 1) + struct.pack('<III', e['left'], e['right'], e['child']) + \
            (n['clsid'] or b'\0' * 16) + (n['state'] or b'\0' * 4) + (n['times'] or b'\0' * 16) + \
            struct.pack('<IQ', e.get('start', END) if typ != 1 else 0, e.get('size', 0) if typ != 1 else 0)
    dirdata = b''.join(dent(e) for e in entries)
    pad = (-len(entries)) % (SS // 128)
    dirdata += (b'\0' * 64 + struct.pack('<HBB', 0, 0, 0) + struct.pack('<III', NOSTREAM, NOSTREAM, NOSTREAM) + b'\0' * 36 + struct.pack('<IQ', 0, 0)) * pad
    dir_start = alloc(dirdata)
    # FAT sectors (they describe themselves too)
    nfat = 1
    while True:
        total = len(sectors) + nfat
        if nfat * (SS // 4) >= total: break
        nfat += 1
    if nfat > 109: raise SystemExit('The VBA project is too large for this writer.')
    fat_first = len(sectors)
    fat_full = fat + [0xFFFFFFFD] * nfat
    fat_full += [FREE] * (nfat * (SS // 4) - len(fat_full))
    fatbytes = b''.join(struct.pack('<I', v) for v in fat_full)
    for k in range(nfat):
        sectors.append(fatbytes[k * SS:(k + 1) * SS])
    hdr = bytes.fromhex('D0CF11E0A1B11AE1') + b'\0' * 16 + struct.pack('<HHHHH', 0x3E, 3, 0xFFFE, 9, 6) + b'\0' * 6 + \
        struct.pack('<IIIIIIIII', 0, nfat, dir_start, 0, CUT, mfat_start, n_mfat, END, 0)
    difat = [fat_first + k for k in range(nfat)] + [FREE] * (109 - nfat)
    hdr += b''.join(struct.pack('<I', v) for v in difat)
    assert len(hdr) == 512
    return hdr + b''.join(sectors)

# ------------------------------------------------------------------ MS-OVBA compression
def decompress(b):
    if not b or b[0] != 1: raise ValueError('not compressed')
    out = bytearray(); i = 1
    while i < len(b):
        hdr = struct.unpack_from('<H', b, i)[0]; size = (hdr & 0x0FFF) + 3; flag = hdr & 0x8000; end = min(len(b), i + size); i += 2
        start = len(out)
        if not flag:
            out += b[i:i + 4096]; i += 4096; continue
        while i < end:
            fb = b[i]; i += 1
            for bit in range(8):
                if i >= end: break
                if not (fb >> bit) & 1:
                    out.append(b[i]); i += 1
                else:
                    tok = struct.unpack_from('<H', b, i)[0]; i += 2
                    dpos = len(out) - start; bc = max(4, (dpos - 1).bit_length())
                    off = (tok >> (16 - bc)) + 1; ln = (tok & (0xFFFF >> bc)) + 3
                    for _ in range(ln): out.append(out[-off])
    return bytes(out)


def _chunk(c):
    out, i, n, heads = bytearray(), 0, len(c), {}
    while i < n:
        flag_at = len(out); out.append(0); flags = 0
        for bit in range(8):
            if i >= n: break
            bc = max(4, (i - 1).bit_length()) if i > 0 else 4
            maxlen = (0xFFFF >> bc) + 3; maxoff = 1 << bc
            best_len, best_off = 0, 0
            if i + 3 <= n:
                for p in reversed(heads.get(c[i:i + 3], [])):
                    off = i - p
                    if off > maxoff: break
                    ln = 3
                    while ln < maxlen and i + ln < n and c[p + ln] == c[i + ln]: ln += 1
                    if ln > best_len: best_len, best_off = ln, off
                    if ln == maxlen: break
            step = best_len if best_len >= 3 else 1
            if best_len >= 3:
                out += struct.pack('<H', ((best_off - 1) << (16 - bc)) | (best_len - 3)); flags |= 1 << bit
            else:
                out.append(c[i])
            for q in range(i, i + step):
                if q + 3 <= n: heads.setdefault(c[q:q + 3], []).append(q)
            i += step
        out[flag_at] = flags
    return bytes(out)


def compress(data):
    out = bytearray([1])
    for s in range(0, max(1, len(data)), 4096):
        c = data[s:s + 4096]
        if not c: break
        body = _chunk(c)
        if len(body) > 4096 and len(c) == 4096:   # incompressible full chunk: stored raw
            out += struct.pack('<H', 0x3000 | (4096 + 2 - 3)) + c
        else:
            out += struct.pack('<H', 0x8000 | 0x3000 | (len(body) + 2 - 3)) + body
    return bytes(out)

# ------------------------------------------------------------------ the VBA project
def dir_records(d):
    recs, i = [], 0
    while i + 6 <= len(d):
        rid, size = struct.unpack_from('<HI', d, i)
        if rid == 0x0009: size = 6
        recs.append((rid, d[i + 6:i + 6 + size], d[i:i + 6 + size])); i += 6 + size
    return recs


def rec(rid, val):
    return struct.pack('<HI', rid, len(val)) + val


def find(node, path):
    for part in path.split('/'):
        node = next((k for k in node['kids'] if k['name'] == part), None)
        if node is None: return None
    return node


CLASS_SOURCE = '\r\n'.join([
    'Attribute VB_Name = "ThumbClick"',
    'Attribute VB_GlobalNameSpace = False',
    'Attribute VB_Creatable = False',
    'Attribute VB_PredeclaredId = False',
    'Attribute VB_Exposed = False',
    'Option Explicit',
    "' 10.21.1 (AI Visual Builder kit): one design of the Select Template gallery. A click on its thumbnail selects it,",
    "' a double-click inserts it; the chosen design is outlined (DynamicTemplateSelectorForm.OutlineChosen).",
    'Public WithEvents Img As MSForms.Image',
    'Public WithEvents Opt As MSForms.OptionButton',
    'Public Owner As Object',
    '',
    'Private Sub Img_Click()',
    '    Opt.Value = True',
    '    Owner.OutlineChosen',
    'End Sub',
    '',
    'Private Sub Img_DblClick(ByVal Cancel As MSForms.ReturnBoolean)',
    '    Opt.Value = True',
    '    Owner.OutlineChosen',
    '    Owner.InsertChosen',
    'End Sub',
    '',
    'Private Sub Opt_Click()',
    '    Owner.OutlineChosen',
    'End Sub',
    '']).encode('cp1252')

FORM_EDITS = [   # (anchor, replacement) - each anchor must be in the form's code exactly once
    ('Private numLines As Integer\r\n',
     'Private numLines As Integer\r\n'
     "' 10.21.1 (AI Visual Builder kit): numbered designs, the chosen one outlined, a click on a thumbnail selects it\r\n"
     'Private thumbs As Collection\r\n'),
    ('radioButton.Caption = " Select"\r\n',
     'radioButton.Caption = " Design " & i\r\n'
     '        radioButton.Font.Bold = True\r\n'
     '        AddThumb imageControl, radioButton\r\n'),
    ('actualTemplateCount = i - 1\r\n',
     'actualTemplateCount = i - 1\r\n'
     '    If actualTemplateCount > 0 Then Me.Caption = "Select Template - " & actualTemplateCount & IIf(actualTemplateCount = 1, " design", " designs") & IIf(actualTemplateCount > maxTemplatesVisible, " (scroll for more)", "")\r\n'),
]
FORM_TAIL = '\r\n'.join([
    '',
    "' 10.21.1 (AI Visual Builder kit): each thumbnail and its option button, so a click on the picture selects the design",
    'Private Sub AddThumb(ByVal img As Object, ByVal opt As Object)',
    '    Dim t As ThumbClick',
    '    If thumbs Is Nothing Then Set thumbs = New Collection',
    '    Set t = New ThumbClick',
    '    Set t.Img = img',
    '    Set t.Opt = opt',
    '    Set t.Owner = Me',
    '    thumbs.Add t',
    'End Sub',
    '',
    "' the chosen design outlined in blue, its caption bold blue; the others plain",
    'Public Sub OutlineChosen()',
    '    Dim t As ThumbClick',
    '    If thumbs Is Nothing Then Exit Sub',
    '    For Each t In thumbs',
    '        If t.Opt.Value Then',
    '            t.Img.BorderStyle = fmBorderStyleSingle',
    '            t.Img.BorderColor = RGB(0, 102, 204)',
    '            t.Opt.ForeColor = RGB(0, 102, 204)',
    '        Else',
    '            t.Img.BorderStyle = fmBorderStyleNone',
    '            t.Opt.ForeColor = RGB(0, 0, 0)',
    '        End If',
    '    Next t',
    'End Sub',
    '',
    "' a double-click on a thumbnail: the same as choosing it and pressing OK",
    'Public Sub InsertChosen()',
    '    OKButton_Click',
    'End Sub',
    '']).encode('cp1252')


def patch_form(src):
    s = src.decode('cp1252')
    for anchor, new in FORM_EDITS:
        if s.count(anchor) != 1:
            raise SystemExit(f'The Select Template form is not the expected one ({anchor.strip()!r} found {s.count(anchor)} times); nothing written.')
        s = s.replace(anchor, new)
    for must in ('Private Sub OKButton_Click()', 'Private Sub UserForm_Initialize()'):
        if must not in s: raise SystemExit(f'The Select Template form has no {must}; nothing written.')
    if 'ThumbClick' in src.decode('cp1252'):
        raise SystemExit('This add-in already has the numbered gallery; nothing written.')
    return s.encode('cp1252').rstrip(b'\r\n') + b'\r\n' + FORM_TAIL


def patch_project(vba_bin):
    root = cfb_read(vba_bin)
    vba = find(root, 'VBA')
    d = decompress(find(vba, 'dir')['data'])
    recs = dir_records(d)
    # module stream name -> source (the text after its p-code)
    mods, name = [], None
    for rid, val, _ in recs:
        if rid == 0x001A: name = val.decode('latin-1')
        elif rid == 0x0031 and name: mods.append((name, struct.unpack('<I', val)[0])); name = None
    sources = {}
    for n, off in mods:
        sources[n] = decompress(find(vba, n)['data'][off:])
    if FORM not in sources: raise SystemExit(f'No {FORM} module; nothing written.')
    if CLASS in sources: raise SystemExit('This add-in already has the numbered gallery; nothing written.')
    new_sources = dict(sources); new_sources[FORM] = patch_form(sources[FORM]); new_sources[CLASS] = CLASS_SOURCE
    # dir: every module's source at offset 0 (no p-code), one more module (ThumbClick, a class module)
    out = bytearray()
    for rid, val, raw in recs:
        if rid == 0x000F: out += rec(0x000F, struct.pack('<H', struct.unpack('<H', val)[0] + 1))
        elif rid == 0x0031: out += rec(0x0031, struct.pack('<I', 0))
        elif rid == 0x0010:
            cn = CLASS.encode('latin-1'); cu = CLASS.encode('utf-16-le')
            out += rec(0x0019, cn) + rec(0x0047, cu) + rec(0x001A, cn) + rec(0x0032, cu) + rec(0x001C, b'') + rec(0x0048, b'') + \
                rec(0x0031, struct.pack('<I', 0)) + rec(0x001E, struct.pack('<I', 0)) + rec(0x002C, struct.pack('<H', 0xFFFF)) + \
                rec(0x0022, b'') + rec(0x002B, b'') + raw
        else: out += raw
    kids = [k for k in vba['kids'] if not k['name'].startswith('__SRP_') and k['name'] not in ('dir', '_VBA_PROJECT') and k['name'] not in new_sources]
    for k in vba['kids']:
        if k['name'] in new_sources: k['data'] = compress(new_sources[k['name']]); kids.append(k)
    proto = find(vba, 'Module1')
    kids.append(dict(name=CLASS, type=2, clsid=b'\0' * 16, state=b'\0' * 4, times=proto['times'], kids=[], data=compress(CLASS_SOURCE)))
    kids.append(dict(find(vba, 'dir'), data=compress(bytes(out))))
    # _VBA_PROJECT without its performance cache: PowerPoint compiles the project from source on load
    kids.append(dict(find(vba, '_VBA_PROJECT'), data=b'\xCC\x61\xFF\xFF\x00\x00\x00'))
    vba['kids'] = kids
    # PROJECT: the class listed; PROJECTwm: its name
    pr = find(root, 'PROJECT'); txt = pr['data'].decode('latin-1')
    if '\r\nModule=Module1\r\n' not in txt: raise SystemExit('The VBA project description is not the expected one; nothing written.')
    pr['data'] = txt.replace('\r\nModule=Module1\r\n', '\r\nModule=Module1\r\nClass=' + CLASS + '\r\n', 1).encode('latin-1')
    wm = find(root, 'PROJECTwm')
    if not wm['data'].endswith(b'\0\0'): raise SystemExit('The VBA project name map is not the expected one; nothing written.')
    wm['data'] = wm['data'][:-2] + CLASS.encode('latin-1') + b'\0' + CLASS.encode('utf-16-le') + b'\0\0' + b'\0\0'
    return cfb_write(root), sources, new_sources


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) != 2: raise SystemExit(__doc__)
    src, out_dir = args
    os.makedirs(out_dir, exist_ok=True)
    dst = os.path.join(out_dir, os.path.basename(src))
    if os.path.abspath(dst) == os.path.abspath(src):
        raise SystemExit('OUT_DIR must differ from the source folder (the original is never written).')
    with zipfile.ZipFile(src) as zin:
        names = zin.namelist()
        vname = next(n for n in names if n.lower().endswith('vbaproject.bin'))
        new_bin, before, after = patch_project(zin.read(vname))
        with zipfile.ZipFile(dst + '.tmp', 'w', zipfile.ZIP_DEFLATED) as zout:
            for info in zin.infolist():
                zout.writestr(info, new_bin if info.filename == vname else zin.read(info.filename))
    os.replace(dst + '.tmp', dst)
    # checks on what was written: every other part identical, every module's source as intended
    check = verify(src, dst)
    print(f'{dst}: {FORM} numbered and selectable; class {CLASS} added; ' + check)


def verify(src, dst):
    sys.path.insert(0, os.path.join(HERE, '..', 'tests'))
    import vba_read
    with zipfile.ZipFile(src) as a, zipfile.ZipFile(dst) as b:
        if sorted(a.namelist()) != sorted(b.namelist()): raise SystemExit('Parts differ after the build.')
        for n in a.namelist():
            if not n.lower().endswith('vbaproject.bin') and a.read(n) != b.read(n): raise SystemExit('A part changed that must not: ' + n)
        va, vb = a.read(next(n for n in a.namelist() if n.lower().endswith('vbaproject.bin'))), b.read(next(n for n in b.namelist() if n.lower().endswith('vbaproject.bin')))
    sa, sb = vba_read.module_sources(src), vba_read.module_sources(dst)
    for n in sa:
        if n != FORM and sa[n] != sb.get(n): raise SystemExit(f'Module {n} changed; nothing may change there.')
    if set(sb) != set(sa) | {CLASS}: raise SystemExit('Unexpected module list after the build.')
    # the forms' designers (layout, .frx data) unchanged
    ta, tb = vba_read.cfb_streams(va), vba_read.cfb_streams(vb)
    for k, v in ta.items():
        if not k.startswith('/VBA/') and k not in ('/PROJECT', '/PROJECTwm') and tb.get(k) != v: raise SystemExit('Changed: ' + k)
    return f'Module1 and LicenseForm unchanged (sha256 {hashlib.sha256(sb["Module1"].encode("utf-8")).hexdigest()[:12]}), designers and other parts identical'


if __name__ == '__main__':
    main()
