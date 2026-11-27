"""10.28.1: pres_clean.py - a clean copy without sideloaded add-in panes; the original only read; store add-ins kept."""
import hashlib
import os
import sys
import tempfile
import zipfile

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import pres_clean as P  # noqa: E402

ok = fails = 0


def check(name, cond):
    global ok, fails
    ok += bool(cond)
    fails += not cond
    print(('  PASS  ' if cond else '  FAIL  ') + name)


WE = '<we:webextension xmlns:we="http://schemas.microsoft.com/office/webextensions/webextension/2010/11" id="{{X}}"><we:reference id="{id}" version="1.0" store="{store}" storeType="{st}"/></we:webextension>'
d = tempfile.mkdtemp()
f = os.path.join(d, 'Deck.pptx')
with zipfile.ZipFile(f, 'w') as z:
    z.writestr('[Content_Types].xml', '<Types><Override PartName="/ppt/presentation.xml" ContentType="p"/><Override PartName="/ppt/webextensions/taskpanes.xml" ContentType="t"/>'
               '<Override PartName="/ppt/webextensions/webextension1.xml" ContentType="w"/><Override PartName="/ppt/webextensions/webextension2.xml" ContentType="w"/></Types>')
    z.writestr('_rels/.rels', '<Relationships><Relationship Id="rId1" Type="http://schemas.microsoft.com/office/2011/relationships/webextensiontaskpanes" Target="ppt/webextensions/taskpanes.xml"/><Relationship Id="rId2" Type="officeDocument" Target="ppt/presentation.xml"/></Relationships>')
    z.writestr('ppt/presentation.xml', '<p/>')
    z.writestr('ppt/webextensions/webextension1.xml', WE.format(id='2f01d600-c9ec-4d94-ade9-69b8b6f0bfa7', store='developer', st='Registry'))
    z.writestr('ppt/webextensions/webextension2.xml', WE.format(id='wa200010001', store='en-US', st='OMEX'))
    z.writestr('ppt/webextensions/taskpanes.xml', '<wetp:taskpanes xmlns:wetp="x"><wetp:taskpane visibility="1"><wetp:webextensionref r:id="rId1"/></wetp:taskpane><wetp:taskpane visibility="0"><wetp:webextensionref r:id="rId2"/></wetp:taskpane></wetp:taskpanes>')
    z.writestr('ppt/webextensions/_rels/taskpanes.xml.rels', '<Relationships><Relationship Id="rId1" Type="we" Target="webextension1.xml"/><Relationship Id="rId2" Type="we" Target="webextension2.xml"/></Relationships>')
h = hashlib.sha256(open(f, 'rb').read()).hexdigest()
r = P.clean_copy(f)
check('the original is only read', hashlib.sha256(open(f, 'rb').read()).hexdigest() == h)
check('the copy is "(clean)" next to it', r['copy'] == os.path.join(d, 'Deck (clean).pptx') and r['removed'] == ['2f01d600-c9ec-4d94-ade9-69b8b6f0bfa7'])
with zipfile.ZipFile(r['copy']) as z:
    names = set(z.namelist())
    tp = z.read('ppt/webextensions/taskpanes.xml').decode()
    check('the sideloaded add-in and its pane are gone', 'ppt/webextensions/webextension1.xml' not in names and 'rId1' not in tp and not P.developer_addins(z))
    check('an Office Store add-in stays, with its pane', 'ppt/webextensions/webextension2.xml' in names and 'rId2' in tp)
    check('content types follow', 'webextension1.xml' not in z.read('[Content_Types].xml').decode())
check('a clean file needs no copy', P.clean_copy(r['copy'])['copy'] is None)
print(f'pres clean: {ok}/{ok + fails} passed')
sys.exit(1 if fails else 0)
