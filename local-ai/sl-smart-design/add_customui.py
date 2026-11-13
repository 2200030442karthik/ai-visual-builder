"""Adds a ribbon (customUI/customUI.xml + its package relationship) to a .ppam written by PowerPoint, by rewriting the
package with Python's zipfile (in-place updates with .NET's ZipArchive gave packages PowerPoint refused to load).
Usage: python add_customui.py IN.ppam CUSTOMUI.xml OUT.ppam"""
import sys, zipfile

src, ui, dst = sys.argv[1:4]
REL = ('<Relationship Id="rIdSLSDAI" Type="http://schemas.microsoft.com/office/2006/relationships/ui/extensibility" '
       'Target="customUI/customUI.xml"/>')
with zipfile.ZipFile(src) as zin, zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as zout:
    for info in zin.infolist():
        if info.filename == 'customUI/customUI.xml':
            continue
        data = zin.read(info.filename)
        if info.filename == '_rels/.rels' and b'ui/extensibility' not in data:
            data = data.replace(b'</Relationships>', REL.encode() + b'</Relationships>')
        zout.writestr(info, data)
    zout.writestr('customUI/customUI.xml', open(ui, encoding='utf-8').read().encode('utf-8'))
print('written:', dst)
