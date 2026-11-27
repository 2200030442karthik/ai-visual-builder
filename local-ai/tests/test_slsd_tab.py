"""V10.22 one SL Smart Design tab (slsd_tab.py), with a stand-in add-in in a temporary APPDATA - the real add-in, the
registry and PowerPoint are never touched (catalog_registered and powerpoint_running are replaced).
- web tab not in PowerPoint yet -> nothing changes (the original tab stays)
- web tab there, PowerPoint open -> nothing changes
- web tab there, PowerPoint closed -> original kept byte for byte, copy with only the tab hidden (VBA identical)
- web tab gone (cache cleared / catalog unregistered) -> the original comes back byte for byte
- 'restore' always brings the original back; a new licensed version becomes the new original
- an unexpected add-in (no SL Smart Design tab) is never written
Usage: python tests/test_slsd_tab.py
"""
import io
import os
import shutil
import sys
import tempfile
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import slsd_tab as T  # noqa: E402

RESULTS = []


def check(name, ok):
    RESULTS.append((name, bool(ok)))
    print(('PASS ' if ok else 'FAIL ') + name)


def ppam(vba=b'VBA-PROJECT-1', tab='<tab id="Template_Selector" label="SL Smart Design" visible="true">'):
    b = io.BytesIO()
    with zipfile.ZipFile(b, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', '<Types/>')
        z.writestr('ppt/vbaProject.bin', vba)
        z.writestr('customUI/customUI.xml', f'<customUI><ribbon><tabs>{tab}<group id="Template_id"/></tab></tabs></ribbon></customUI>')
    return b.getvalue()


def main():
    tmp = tempfile.mkdtemp(prefix='aivb-tab-')
    old_env = {k: os.environ.get(k) for k in ('APPDATA', 'LOCALAPPDATA')}
    os.environ['APPDATA'] = os.path.join(tmp, 'roaming')
    os.environ['LOCALAPPDATA'] = os.path.join(tmp, 'local')
    flags = {'reg': True, 'ppt': False}
    T.catalog_registered = lambda catalog=None: flags['reg']
    T.powerpoint_running = lambda: flags['ppt']
    try:
        p = T.addin_path()
        os.makedirs(os.path.dirname(p))
        orig = ppam()
        open(p, 'wb').write(orig)
        dd = os.path.join(tmp, 'data'); os.makedirs(dd)
        cache = os.path.join(os.environ['LOCALAPPDATA'], 'Microsoft', 'Office', '16.0', 'Wef', 'AppCommands', '18.0', 'TrustedCatalog')
        cfile = os.path.join(cache, T.PRODUCT_ID + '18.0PowerPointen-US')
        cur = lambda: open(p, 'rb').read()
        vba = lambda b: zipfile.ZipFile(io.BytesIO(b)).read('ppt/vbaProject.bin')

        check('web tab not added yet: nothing changes', T.step(dd) == '' and cur() == orig)
        os.makedirs(cache); open(cfile, 'w').close()
        flags['ppt'] = True
        check('PowerPoint open: nothing changes', T.step(dd) == '' and cur() == orig)
        flags['ppt'] = False
        check('web tab there, PowerPoint closed: own tab hidden', T.step(dd) == 'hidden' and T.tab_visible(cur()) is False)
        check('VBA project identical', vba(cur()) == vba(orig))
        check('original kept byte for byte', open(os.path.join(dd, 'slsd-original', T.VBA_NAME + '.ppam'), 'rb').read() == orig)
        check('stable: nothing more to do', T.step(dd) == '')
        os.remove(cfile)
        check('web tab gone: original back byte for byte', T.step(dd) == 'restored' and cur() == orig)
        open(cfile, 'w').close(); T.step(dd)
        flags['reg'] = False
        check('catalog unregistered: original back', T.step(dd) == 'restored' and cur() == orig)
        flags['reg'] = True; T.step(dd)
        check('restore command: original back', T.step(dd, force_restore=True) == 'restored' and cur() == orig)
        new = ppam(vba=b'VBA-PROJECT-2-NEW-LICENCE')
        open(p, 'wb').write(new)
        check('new licensed version becomes the original', T.step(dd) == 'hidden' and vba(cur()) == b'VBA-PROJECT-2-NEW-LICENCE')
        check('...and comes back exactly', T.step(dd, force_restore=True) == 'restored' and cur() == new)
        odd = ppam(tab='<tab id="Other" label="X">')
        open(p, 'wb').write(odd)
        check('unexpected add-in never written', T.step(dd) == '' and cur() == odd)
        check('status reports', T.status(dd)['web_tab'] is True and T.status(dd)['present'])
    finally:
        for k, v in old_env.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
        shutil.rmtree(tmp, ignore_errors=True)
    bad = [n for n, ok in RESULTS if not ok]
    print(f'\nslsd_tab: {len(RESULTS) - len(bad)}/{len(RESULTS)} passed' + (f'; FAILED: {", ".join(bad)}' if bad else ''))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
