"""Writes manifest-slsd.xml (repository root): AI Visual Builder with the SL Smart Design ribbon tab (V10.20.1).

Same add-in Id as manifest-v10.xml - it replaces that registration (sl-smart-design/switch-slsd.ps1), it is not a second
add-in. Differences: the "SL Smart Design" custom tab (Design | SL Templates | Miscellaneous | Shape Rename) instead of the
AI Visual Builder group on the Home tab. AI Visual Builder is a ShowTaskpane button (Office opens it on the first click);
every other button is a function of the shared runtime (slsd.js, bridge.js).
Usage: python make_manifest_slsd.py"""
import os, re, sys
from xml.sax.saxutils import escape

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
ID, VERSION, BASE = '08d15d9d-8629-4583-b67d-5f80143dde6d', '10.25.0.0', 'https://localhost:44317'
# Office caches add-in images by URL (and showed generic icons while the host sent Cache-Control: no-store, 16 Nov):
# the icons are versioned so Office fetches them afresh. Change ICONS when an icon changes.
ICONS = BASE + '/assets/v4'

# group id, label, group icon, [(control id, label, tooltip, icon, 'pane' | 'fn', function)]
GROUPS = [
    ('SLSD.Design', 'Design', 'design', [
        ('SLSD.AltDesign', 'Alternative Design', "Redesign the slide's points (2 to 10, one per line) with a template from the SL Smart Design library.", 'design', 'fn', 'slsdAlternativeDesign'),
        ('AIVB10.Open', 'AI SL Smart Design', "Turn the slide's content into editable infographics designed by AI: generate, preview, insert.", 'aivb', 'pane', None),
        ('AIVB10.Slides', 'Several slides', 'Spread long content over several slides, each with its own editable visual.', 'aivb', 'fn', 'aivbOpenSlides'),
        ('AIVB10.Edit', 'Edit a visual', 'Change the texts, icons, colours or layout of a visual AI Visual Builder inserted.', 'aivb', 'fn', 'aivbOpenEdit')]),
    ('SLSD.Templates', 'SL Templates', 'footer-note', [
        ('SLSD.FooterNote', 'Add Footer Note', 'Add the footer note section to this slide.', 'footer-note', 'fn', 'slsdFooterNote'),
        ('SLSD.BlueCode', 'Add Blue Codebox', 'Add the blue code box to this slide.', 'code-blue', 'fn', 'slsdBlueCodebox'),
        ('SLSD.BlackCode', 'Add Black Codebox', 'Add the black code box to this slide.', 'code-black', 'fn', 'slsdBlackCodebox'),
        ('SLSD.FooterInfo', 'Add Footer Info', 'Add the footer info section to this slide.', 'footer-info', 'fn', 'slsdFooterInfo'),
        ('SLSD.ProbSol', 'Add Problem Solution', 'Add the problem / solution section to this slide.', 'problem', 'fn', 'slsdProblemSolution'),
        ('SLSD.ProbSolImg', 'Add Problem Solution Image', 'Add the problem / solution section with an image to this slide.', 'problem-image', 'fn', 'slsdProblemSolutionImage')]),
    ('SLSD.Misc', 'Miscellaneous', 'no-animation', [
        ('SLSD.NoAnim', 'Remove Animations', 'Remove every animation and slide transition in this presentation.', 'no-animation', 'fn', 'slsdRemoveAnimations'),
        ('SLSD.DelEmpty', 'Delete Empty Boxes', 'Delete the empty text boxes and placeholders on every slide.', 'delete-empty', 'fn', 'slsdDeleteEmptyBoxes')]),
    ('SLSD.Rename', 'Shape Rename', 'rename-text', [
        ('SLSD.RenText', 'Text', 'Name the selected shapes Text_1, Text_2 ... in the order you selected them.', 'rename-text', 'fn', 'slsdRenameText'),
        ('SLSD.RenHead', 'Heading', 'Name the selected shapes T_Text_1, T_Text_2 ... in the order you selected them.', 'rename-heading', 'fn', 'slsdRenameHeading')]),
    # 10.25 SL Editor: the SL Design and SL Animation commands (SL_Audomation) in the panel's own tabs
    ('SLED.Design', 'SL Design', 'sldesign', [
        ('SLED.OpenDesign', 'SL Design', 'Brand shapes, text boxes, bullets, layout templates, brandlines and speaker notes.', 'sldesign', 'fn', 'sledOpenDesign')]),
    ('SLED.Anim', 'SL Animation', 'slanimation', [
        ('SLED.OpenAnim', 'SL Animation', 'Entrance and exit animations, bulk timing shift, transitions, audio and video export.', 'slanimation', 'fn', 'sledOpenAnimation')]),
]

HEAD = '''<?xml version="1.0" encoding="UTF-8"?>
<!-- SL Smart Design (V10.20.1): AI Visual Builder with the SL Smart Design ribbon tab. Written by
     local-ai/sl-smart-design/make_manifest_slsd.py - edit that script, not this file. Same Id as manifest-v10.xml: it
     replaces that registration (switch-slsd.ps1). The SL Smart Design commands run the original macros of the SL Smart
     Design VBA add-in (slsd.js -> server.py /api/slsd/run -> PowerPoint Application.Run); that add-in's own tab is hidden
     in the copy this setup installs. The panel is served on this PC by local-ai\\server.py (https://localhost:44317). -->
<OfficeApp xmlns="http://schemas.microsoft.com/office/appforoffice/1.1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bt="http://schemas.microsoft.com/office/officeappbasictypes/1.0" xmlns:ov="http://schemas.microsoft.com/office/taskpaneappversionoverrides" xsi:type="TaskPaneApp">
  <Id>@ID@</Id>
  <Version>@VERSION@</Version>
  <ProviderName>Simplilearn</ProviderName>
  <DefaultLocale>en-US</DefaultLocale>
  <DisplayName DefaultValue="SL Editor"/>
  <Description DefaultValue="SL Editor: AI SL Smart Design (AI infographics, editing, SL Smart Design templates), SL Design and SL Animation in one add-in."/>
  <IconUrl DefaultValue="@ICONS@/icon-32.png"/>
  <HighResolutionIconUrl DefaultValue="@ICONS@/icon-64.png"/>
  <SupportUrl DefaultValue="https://2200030442karthik.github.io/ai-visual-builder/"/>
  <AppDomains><AppDomain>@BASE@</AppDomain></AppDomains>
  <Hosts><Host Name="Presentation"/></Hosts>
  <Requirements><Sets DefaultMinVersion="1.1"><Set Name="PowerPointApi" MinVersion="1.5"/><Set Name="SharedRuntime" MinVersion="1.1"/></Sets></Requirements>
  <DefaultSettings><SourceLocation DefaultValue="@BASE@/v10.html"/></DefaultSettings>
  <Permissions>ReadWriteDocument</Permissions>

  <VersionOverrides xmlns="http://schemas.microsoft.com/office/taskpaneappversionoverrides" xsi:type="VersionOverridesV1_0">
    <Hosts>
      <Host xsi:type="Presentation">
        <Runtimes>
          <Runtime resid="Taskpane.Url" lifetime="long"/>
        </Runtimes>
        <DesktopFormFactor>
          <GetStarted>
            <Title resid="GetStarted.Title"/>
            <Description resid="GetStarted.Description"/>
            <LearnMoreUrl resid="GetStarted.LearnMoreUrl"/>
          </GetStarted>
          <FunctionFile resid="Taskpane.Url"/>
'''
MIDDLE = '''        </DesktopFormFactor>
      </Host>
    </Hosts>
    <Resources>
'''
TAIL = '''    </Resources>
  </VersionOverrides>
</OfficeApp>
'''


def icon_url(name, n):
    return f'{ICONS}/icon-{n}.png' if name in ('aivb', 'sleditor') else f'{ICONS}/slsd/{name}-{n}.png'


def rid(cid, kind):
    return (cid.replace('.', '') + '.' + kind)[:32]


def build():
    images = {}
    short = {'Tab.Label': 'SL Editor', 'GetStarted.Title': 'SL Editor is ready'}
    long_ = {'GetStarted.Description': 'Home > SL Editor opens the panel: AI SL Smart Design, SL Design and SL Animation. '
                                       'If it does not load, run "Restart AI SL Smart Design" from the Start menu.'}

    def icon(name, ind):
        out = [f'{ind}<Icon>']
        for n in (16, 32, 80):
            k = f'Icon.{name}.{n}'
            images[k] = icon_url(name, n)
            out.append(f'{ind}  <bt:Image size="{n}" resid="{k}"/>')
        return out + [f'{ind}</Icon>']

    tab = ['          <ExtensionPoint xsi:type="PrimaryCommandSurface">', '            <CustomTab id="AISLSD.Tab">']
    for gid, glabel, gicon, controls in GROUPS:
        short[rid(gid, 'Label')] = glabel
        tab += [f'              <Group id="{gid}">', f'                <Label resid="{rid(gid, "Label")}"/>'] + icon(gicon, '                ')
        for cid, label, tip, ic, kind, fn in controls:
            short[rid(cid, 'Label')], long_[rid(cid, 'Tip')] = label, tip
            tab += [f'                <Control xsi:type="Button" id="{cid}">', f'                  <Label resid="{rid(cid, "Label")}"/>',
                    '                  <Supertip>', f'                    <Title resid="{rid(cid, "Label")}"/>',
                    f'                    <Description resid="{rid(cid, "Tip")}"/>', '                  </Supertip>'] + icon(ic, '                  ')
            if kind == 'pane':
                tab += ['                  <Action xsi:type="ShowTaskpane">', '                    <TaskpaneId>AIVisualBuilderV10Pane</TaskpaneId>',
                        '                    <SourceLocation resid="Taskpane.Url"/>', '                  </Action>']
            else:
                tab += ['                  <Action xsi:type="ExecuteFunction">', f'                    <FunctionName>{fn}</FunctionName>', '                  </Action>']
            tab.append('                </Control>')
        tab.append('              </Group>')
    tab += ['              <Label resid="Tab.Label"/>', '            </CustomTab>']
    short['Group.AISLSD.Label'] = 'SL Editor'
    short['SLEDHome.Label'] = 'SL Editor'
    long_['SLEDHome.Tip'] = 'Open SL Editor: AI SL Smart Design (AI infographics and editing), SL Design and SL Animation.'
    tab += [
        '            <OfficeTab id="TabHome">',
        '              <Group id="AISLSD.HomeGroup">',
        '                <Label resid="Group.AISLSD.Label"/>',
    ] + icon('sleditor', '                ') + [
        '                <Control xsi:type="Button" id="AIVB10.HomeOpen">',
        '                  <Label resid="SLEDHome.Label"/>',
        '                  <Supertip>',
        '                    <Title resid="SLEDHome.Label"/>',
        '                    <Description resid="SLEDHome.Tip"/>',
        '                  </Supertip>',
    ] + icon('sleditor', '                  ') + [
        '                  <Action xsi:type="ShowTaskpane">',
        '                    <TaskpaneId>AIVisualBuilderV10Pane</TaskpaneId>',
        '                    <SourceLocation resid="Taskpane.Url"/>',
        '                  </Action>',
        '                </Control>',
        '                <Control xsi:type="Button" id="AIVB10.HomeSlides">',
        '                  <Label resid="SLEDOpenDesign.Label"/>',
        '                  <Supertip>',
        '                    <Title resid="SLEDOpenDesign.Label"/>',
        '                    <Description resid="SLEDOpenDesign.Tip"/>',
        '                  </Supertip>',
    ] + icon('sldesign', '                  ') + [
        '                  <Action xsi:type="ExecuteFunction">',
        '                    <FunctionName>sledOpenDesign</FunctionName>',
        '                  </Action>',
        '                </Control>',
        '                <Control xsi:type="Button" id="AIVB10.HomeEdit">',
        '                  <Label resid="SLEDOpenAnim.Label"/>',
        '                  <Supertip>',
        '                    <Title resid="SLEDOpenAnim.Label"/>',
        '                    <Description resid="SLEDOpenAnim.Tip"/>',
        '                  </Supertip>',
    ] + icon('slanimation', '                  ') + [
        '                  <Action xsi:type="ExecuteFunction">',
        '                    <FunctionName>sledOpenAnimation</FunctionName>',
        '                  </Action>',
        '                </Control>',
        '              </Group>',
        '            </OfficeTab>',
        '          </ExtensionPoint>'
    ]

    def res(tag, item, d):
        return [f'      <bt:{tag}>'] + [f'        <bt:{item} id="{k}" DefaultValue="{escape(v, {chr(34): "&quot;"})}"/>' for k, v in d.items()] + [f'      </bt:{tag}>']
    urls = {'Taskpane.Url': f'{BASE}/v10.html', 'GetStarted.LearnMoreUrl': f'{BASE}/v10.html'}
    head = HEAD.replace('@ID@', ID).replace('@VERSION@', VERSION).replace('@ICONS@', ICONS).replace('@BASE@', BASE)
    body = res('Images', 'Image', images) + res('Urls', 'Url', urls) + res('ShortStrings', 'String', short) + res('LongStrings', 'String', long_)
    return head + '\n'.join(tab) + '\n' + MIDDLE + '\n'.join(body) + '\n' + TAIL


def main():
    """--base URL  the panel host the manifest points at (default https://localhost:44317; the pilot package uses its
                   own port; a central HTTPS host for Microsoft 365 Centralized Deployment would be named here)
       --id GUID   the add-in Id (the installed product's own; default: the development Id)
       --out FILE  where to write (default: manifest-slsd.xml in the repository root)"""
    global BASE, ICONS, ID
    a = sys.argv[1:]
    if '--id' in a:       # the installed product has its own add-in Id (the development registration keeps 08d15d9d-...)
        ID = a[a.index('--id') + 1]
        if not re.fullmatch(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', ID):
            raise SystemExit('--id must be a GUID in lower case.')
    if '--base' in a:
        BASE = a[a.index('--base') + 1].rstrip('/')
        if not re.fullmatch(r'https://[A-Za-z0-9.-]+(:(\d{2,5}|__PORT__))?', BASE):
            raise SystemExit('--base must be an https:// address (Office loads add-ins only over HTTPS).')
        ICONS = BASE + '/assets/v4'
    out = a[a.index('--out') + 1] if '--out' in a else os.path.join(ROOT, 'manifest-slsd.xml')
    with open(out, 'w', encoding='utf-8', newline='\n') as f:
        f.write(build())
    print('written:', out, f'({sum(len(g[3]) for g in GROUPS)} buttons in {len(GROUPS)} groups)')


if __name__ == '__main__':
    main()
