"""Builds the unified SL Smart Design ribbon (V10.20) from a COPY of the SL Smart Design add-in.

Only customUI/customUI.xml changes, and only so its tab and its Design group can be shared with the SL Smart Design AI
add-in (SLSD_AIVisualBuilder.ppam): the qualified ids idQ="sl:Template_Selector" / idQ="sl:Template_id" in the namespace
Simplilearn.SLSmartDesign. Every other part - the VBA project with its forms, licence check and callbacks - is copied
byte for byte, and checked to be identical. The original file is never written.

Usage: python make_unified_slsd.py SOURCE.ppam OUT_DIR
Prints what changed; never prints VBA content.
"""
import hashlib, os, re, sys, zipfile

NS = 'Simplilearn.SLSmartDesign'


def unify(xml):
    x = xml
    if 'xmlns:sl=' not in x:
        x = re.sub(r'(<customUI\b[^>]*?)(\s*>)', r'\1 xmlns:sl="' + NS + r'"\2', x, count=1)
    x, n1 = re.subn(r'<tab\s+id="Template_Selector"', '<tab idQ="sl:Template_Selector"', x, count=1)
    x, n2 = re.subn(r'<group\s+id="Template_id"', '<group idQ="sl:Template_id"', x, count=1)
    if (n1, n2) != (1, 1) and 'idQ="sl:Template_Selector"' not in xml:
        raise SystemExit('The SL Smart Design ribbon is not the expected one (tab Template_Selector, group Template_id); nothing written.')
    return x


def main():
    src, out_dir = sys.argv[1], sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)
    dst = os.path.join(out_dir, os.path.basename(src))
    if os.path.abspath(dst) == os.path.abspath(src):
        raise SystemExit('OUT_DIR must differ from the source folder (the original is never written).')
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(dst + '.tmp', 'w', zipfile.ZIP_DEFLATED) as zout:
        for info in zin.infolist():
            data = zin.read(info.filename)
            if info.filename == 'customUI/customUI.xml':
                new = unify(data.decode('utf-8-sig')).encode('utf-8')
                print(f'customUI/customUI.xml: {len(data)} -> {len(new)} bytes (tab and Design group shared: idQ in {NS})')
                data = new
            zout.writestr(info, data)
    os.replace(dst + '.tmp', dst)
    # every other part identical (the VBA project, its forms and licence check above all)
    h = lambda z, n: hashlib.sha256(z.read(n)).hexdigest()
    with zipfile.ZipFile(src) as a, zipfile.ZipFile(dst) as b:
        same = [n for n in a.namelist() if n != 'customUI/customUI.xml' and h(a, n) == h(b, n)]
        other = [n for n in a.namelist() if n != 'customUI/customUI.xml']
        if len(same) != len(other) or sorted(a.namelist()) != sorted(b.namelist()):
            raise SystemExit('A part other than the ribbon XML differs; the output is not valid.')
        print(f'unchanged parts: {len(same)} of {len(other)} identical (incl. ppt/vbaProject.bin: '
              f'{h(a, "ppt/vbaProject.bin")[:12]} = {h(b, "ppt/vbaProject.bin")[:12]})')
    print('written:', dst)


if __name__ == '__main__':
    main()
