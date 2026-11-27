"""Builds the unified SL Smart Design ribbon (V10.20) from a COPY of the SL Smart Design add-in.

Only customUI/customUI.xml changes, and only so its tab and its Design group can be shared with the SL Smart Design AI
add-in (SLSD_AIVisualBuilder.ppam): the qualified ids idQ="sl:Template_Selector" / idQ="sl:Template_id" in the namespace
Simplilearn.SLSmartDesign. Every other part - the VBA project with its forms, licence check and callbacks - is copied
byte for byte, and checked to be identical. The original file is never written.

Usage: python make_unified_slsd.py SOURCE.ppam OUT_DIR [--hide-tab]
Prints what changed; never prints VBA content.

--hide-tab (V10.20.1): the SL Smart Design tab is now shown by the AI Visual Builder web add-in (manifest-slsd.xml), which
runs this add-in's original macros; this add-in's own tab is hidden (visible="false" on the tab, ids unchanged) so there
is one SL Smart Design tab. Its macros, forms, licence check and callbacks are untouched and stay loaded.
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


def hide_tab(xml):
    """The original ribbon with its tab hidden; nothing else changes (V10.20.1)."""
    m = re.search(r'<tab\s+id="Template_Selector"[^>]*>', xml)
    if not m:
        raise SystemExit('The SL Smart Design ribbon is not the expected one (tab Template_Selector); nothing written.')
    tag = m.group(0)
    new = re.sub(r'\svisible="[^"]*"', ' visible="false"', tag) if 'visible=' in tag else tag[:-1].rstrip('/') + ' visible="false">'
    return xml[:m.start()] + new + xml[m.end():]


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    change = hide_tab if '--hide-tab' in sys.argv else unify
    src, out_dir = args[0], args[1]
    os.makedirs(out_dir, exist_ok=True)
    dst = os.path.join(out_dir, os.path.basename(src))
    if os.path.abspath(dst) == os.path.abspath(src):
        raise SystemExit('OUT_DIR must differ from the source folder (the original is never written).')
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(dst + '.tmp', 'w', zipfile.ZIP_DEFLATED) as zout:
        for info in zin.infolist():
            data = zin.read(info.filename)
            if info.filename == 'customUI/customUI.xml':
                new = change(data.decode('utf-8-sig')).encode('utf-8')
                what = 'its own tab hidden (visible="false")' if change is hide_tab else f'tab and Design group shared: idQ in {NS}'
                print(f'customUI/customUI.xml: {len(data)} -> {len(new)} bytes ({what})')
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
