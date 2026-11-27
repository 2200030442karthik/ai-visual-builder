r"""SL Editor 10.28.1 - a CLEAN COPY of a presentation for PCs without SL Editor (the original is never changed).

Why: PowerPoint saves an open add-in pane into the presentation (ppt/webextensions: the add-in's id, "store developer",
and whether its pane was open). SL Editor, like any add-in installed outside the Office Store, is a "developer" add-in,
so on a PC without it - a new laptop with only the classic SL Smart Design - PowerPoint opens that pane and shows
"ADD-IN ERROR: This add-in is no longer available: add-ins inserted during development ...".

The clean copy leaves out exactly those parts: every add-in reference whose store is "developer" (SL Editor, the earlier
AI Visual Builder pilot, any sideloaded add-in), the task panes that point to them, and their relationships and content
types. Slides, layouts, masters, media, notes, macros and Office Store add-ins are copied byte for byte. The copy is
written next to the original as "<name> (clean).pptx" (a number added if that exists); the original is only read.

    python pres_clean.py FILE_OR_FOLDER [...]       clean copies (a folder: every .pptx/.pptm/.potx/.ppsx in it)
    python pres_clean.py --check FILE_OR_FOLDER     only report which files carry such add-ins
    python pres_clean.py --out DIR FILE ...         the clean copies into DIR instead of next to the originals
"""
import os
import re
import sys
import zipfile

EXTS = ('.pptx', '.pptm', '.potx', '.potm', '.ppsx', '.ppsm')
WE_DIR = 'ppt/webextensions/'
TP = WE_DIR + 'taskpanes.xml'
TP_RELS = WE_DIR + '_rels/taskpanes.xml.rels'


def _txt(z, n):
    return z.read(n).decode('utf-8-sig')


def developer_addins(z):
    """{part name: add-in id} of the add-in references saved in the file whose store is "developer"."""
    out = {}
    for n in z.namelist():
        if n.startswith(WE_DIR) and re.fullmatch(r'ppt/webextensions/webextension\d*\.xml', n):
            m = re.search(r'<we:reference\b[^>]*>', _txt(z, n))
            if m and re.search(r'\bstore="developer"', m.group(0)):
                rid = re.search(r'\bid="([^"]*)"', m.group(0))
                out[n] = rid.group(1) if rid else '?'
    return out


def check(path):
    with zipfile.ZipFile(path) as z:
        return developer_addins(z)


def clean_bytes(z):
    """{part name: new bytes or None (left out)} for a clean copy, or {} when nothing needs to change."""
    dev = developer_addins(z)
    if not dev:
        return {}
    names = set(z.namelist())
    drop = set(dev) | {WE_DIR + '_rels/' + os.path.basename(n) + '.rels' for n in dev}
    change = {n: None for n in drop if n in names}
    # the task panes that point to a dropped add-in
    keep_panes = 0
    if TP in names:
        rels = _txt(z, TP_RELS) if TP_RELS in names else ''
        gone = {m.group(1) for m in re.finditer(r'<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"', rels)
                if WE_DIR + m.group(2).split('/')[-1] in dev}
        gone |= {m.group(2) for m in re.finditer(r'<Relationship\b[^>]*\bTarget="([^"]+)"[^>]*\bId="([^"]+)"', rels)
                 if WE_DIR + m.group(1).split('/')[-1] in dev}
        tp = _txt(z, TP)
        panes = re.findall(r'<wetp:taskpane\b.*?</wetp:taskpane>', tp, flags=re.S)
        kept = [p for p in panes if not any(f'r:id="{g}"' in p for g in gone)]
        keep_panes = len(kept)
        if keep_panes:
            head = tp[:tp.index(panes[0])] if panes else tp
            tail = tp[tp.rindex(panes[-1]) + len(panes[-1]):] if panes else ''
            change[TP] = (head + ''.join(kept) + tail).encode('utf-8')
            change[TP_RELS] = re.sub(r'<Relationship\b[^>]*/>', lambda m: '' if re.search(r'\bId="(' + '|'.join(map(re.escape, gone)) + r')"', m.group(0)) else m.group(0), rels).encode('utf-8') if gone else rels.encode('utf-8')
        else:
            change[TP] = None
            if TP_RELS in names:
                change[TP_RELS] = None
    # the package's relationship to the task panes, and the content types of the parts left out
    if not keep_panes and '_rels/.rels' in names:
        r = _txt(z, '_rels/.rels')
        change['_rels/.rels'] = re.sub(r'<Relationship\b[^>]*webextensiontaskpanes[^>]*/>', '', r).encode('utf-8')
    ct = _txt(z, '[Content_Types].xml')
    out_parts = {'/' + n for n, v in change.items() if v is None}
    change['[Content_Types].xml'] = re.sub(r'<Override\b[^>]*\bPartName="([^"]+)"[^>]*/>', lambda m: '' if m.group(1) in out_parts else m.group(0), ct).encode('utf-8')
    return change


def target(path, out_dir=None):
    stem, ext = os.path.splitext(os.path.join(out_dir, os.path.basename(path)) if out_dir else path)
    p = f'{stem} (clean){ext}'
    k = 2
    while os.path.exists(p):
        p = f'{stem} (clean {k}){ext}'
        k += 1
    return p


def clean_copy(path, out_dir=None):
    """{'file', 'copy' or None, 'removed': [add-in ids]} - the original is only read; the copy goes next to it, or into
    out_dir."""
    with zipfile.ZipFile(path) as z:
        dev = developer_addins(z)
        change = clean_bytes(z)
        if not change:
            return {'file': path, 'copy': None, 'removed': []}
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)
        out = target(path, out_dir)
        tmp = out + '.part'
        with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as w:
            for info in z.infolist():
                if info.filename in change:
                    if change[info.filename] is None:
                        continue
                    w.writestr(info, change[info.filename])
                else:
                    w.writestr(info, z.read(info.filename))
    with zipfile.ZipFile(tmp) as v:                      # the copy opens and carries no developer add-in
        if v.testzip() is not None or developer_addins(v):
            os.remove(tmp)
            raise ValueError('the clean copy could not be verified')
    os.replace(tmp, out)
    return {'file': path, 'copy': out, 'removed': sorted(set(dev.values()))}


def files(args):
    for a in args:
        if os.path.isdir(a):
            for n in sorted(os.listdir(a)):
                if n.lower().endswith(EXTS) and not n.startswith('~$') and '(clean' not in n:
                    yield os.path.join(a, n)
        elif a.lower().endswith(EXTS):
            yield a


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    only_check = '--check' in argv
    out_dir = None
    if '--out' in argv:
        i = argv.index('--out')
        out_dir = argv[i + 1]
        del argv[i:i + 2]
    argv = [a for a in argv if a != '--check']
    if not argv:
        print(__doc__)
        return 2
    bad = 0
    for f in files(argv):
        try:
            if only_check:
                d = check(f)
                print(('CARRIES ' + ', '.join(sorted(set(d.values()))) if d else 'clean   ') + '  ' + f)
            else:
                r = clean_copy(f, out_dir)
                print(f'clean copy: {r["copy"]}  (left out: {", ".join(r["removed"])})' if r['copy'] else f'already clean: {f}')
        except (OSError, zipfile.BadZipFile, ValueError) as e:
            bad += 1
            print(f'could not read {f}: {e}')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
