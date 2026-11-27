"""Read-only: the VBA module sources kept in an Office file's vbaProject.bin (MS-CFB container, MS-OVBA compression).
Standard library only. Used by test_slsd.py to check that every macro the SL Smart Design tab runs exists in the
original add-in; it returns text to the caller and never prints or writes VBA source.
Usage (from Python): module_sources(PATH) -> {module name: source}"""
import struct, zipfile
def cfb_streams(data):
    ss = 1 << struct.unpack_from('<H', data, 30)[0]
    mss = 1 << struct.unpack_from('<H', data, 32)[0]
    nfat, dir0, cutoff, mfat0, nmfat, difat0, ndifat = struct.unpack_from('<I I 4x I I I I I', data, 44)
    sec = lambda i: data[512 + i * ss: 512 + (i + 1) * ss]
    difat = list(struct.unpack_from('<109I', data, 76))
    d = difat0
    for _ in range(ndifat):
        v = struct.unpack('<%dI' % (ss // 4), sec(d)); difat += v[:-1]; d = v[-1]
    fat = []
    for f in difat[:nfat]:
        fat += struct.unpack('<%dI' % (ss // 4), sec(f))
    def chain(s):
        out = []
        while s < 0xFFFFFFFA and len(out) < 100000:
            out.append(s); s = fat[s]
        return out
    read = lambda s: b''.join(sec(i) for i in chain(s))
    dirs = read(dir0)
    ents = []
    for i in range(len(dirs) // 128):
        e = dirs[i * 128:(i + 1) * 128]
        n = struct.unpack_from('<H', e, 64)[0]
        name = e[:max(0, n - 2)].decode('utf-16-le', 'replace')
        typ = e[66]; l, r, c = struct.unpack_from('<III', e, 68); start, size = struct.unpack_from('<IQ', e, 116)
        ents.append(dict(name=name, type=typ, left=l, right=r, child=c, start=start, size=size))
    root = ents[0]; ministream = read(root['start'])
    mfat = []
    for s in chain(mfat0) if nmfat else []:
        mfat += struct.unpack('<%dI' % (ss // 4), sec(s))
    def mread(s, size):
        out = b''
        while s < 0xFFFFFFFA and len(out) < size:
            out += ministream[s * mss:(s + 1) * mss]; s = mfat[s]
        return out[:size]
    # paths
    paths = {}
    def walk(i, prefix):
        if i == 0xFFFFFFFF or i >= len(ents): return
        e = ents[i]; walk(e['left'], prefix); walk(e['right'], prefix)
        p = prefix + '/' + e['name']
        if e['type'] == 2:
            paths[p] = (mread(e['start'], e['size']) if e['size'] < cutoff else read(e['start'])[:e['size']])
        elif e['type'] == 1:
            walk(e['child'], p)
    walk(root['child'], '')
    return paths


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
                    lmask = 0xFFFF >> bc; off = (tok >> (16 - bc)) + 1; ln = (tok & lmask) + 3
                    for _ in range(ln): out.append(out[-off])
    return bytes(out)


def modules(dirdata):
    """(stream name, text offset) of every module, from the dir stream."""
    i, out, name = 0, [], None
    while i + 6 <= len(dirdata):
        rid, size = struct.unpack_from('<HI', dirdata, i); i += 6
        if rid == 0x0009: size = 6           # PROJECTVERSION: fixed size
        val = dirdata[i:i + size]; i += size
        if rid == 0x001A: name = val.decode('latin-1')
        elif rid == 0x0031 and name: out.append((name, struct.unpack('<I', val)[0])); name = None
    return out


def module_sources(path):
    with zipfile.ZipFile(path) as z:
        data = z.read(next(n for n in z.namelist() if n.lower().endswith('vbaproject.bin')))
    vba = {k.split('/')[-1]: v for k, v in cfb_streams(data).items() if '/VBA/' in k}
    return {name: decompress(vba[name][off:]).decode('cp1252', 'replace') for name, off in modules(decompress(vba['dir']))}
