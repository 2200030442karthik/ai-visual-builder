"""AI Visual Builder - optional Claude (Anthropic API) visuals, the counterpart of Napkin AI for comparison.

Two kinds of answer:
- the design specification (the panel's only request, V10.11): one request returns the content's structure and its
  visual design as JSON (items in the text's own words with roles and pictorial objects, groups, main flow, ranked
  compositions, an optional composition of its own; structured output with PLAN_SCHEMA); the panel draws up to four
  different layouts from it (plan.js, design packs), each measured at 22 pt and checked.
- drawings (kept for compatibility and tests, not offered in the panel): one SVG infographic per variation. The SVGs go through the panel's Napkin
  pipeline (accuracy check, kept as designed or rebuilt in the template, layout checks, insertion).

The key is read from %LOCALAPPDATA%\\AIVisualBuilder\\claude.json (configure-claude.ps1, only this user can read it) or
the ANTHROPIC_API_KEY environment variable; it is never sent to the panel or logged. Requires the `anthropic` package
(pip install anthropic); without it Claude stays off and the rest of the panel host works as before.
Paid calls: one request per variation, max_retries=0 and no fallback model, so a failure costs nothing extra and is
reported instead of repeated. Model, effort, max_tokens and the prices for the cost estimate are set in claude.json.
"""
import concurrent.futures
import json
import os
import re
import time

try:
    import anthropic
except ImportError:          # Claude stays off; Napkin and the built-in suggestions are unaffected
    anthropic = None

DEFAULT_MODEL = 'claude-opus-5-5'
# The template's content area (v10.html TEMPLATE.contentArea, points): the SVG uses it 1:1, so 1 SVG unit = 1 pt.
AREA_W, AREA_H = 1079, 435
PALETTE = ['#62B7E4', '#E6A157', '#8ECDB7', '#9B99C7', '#E58F6D', '#DDB945', '#7EA2C8', '#D98CA1', '#B88968', '#C1A5C6']
NEUTRALS = {'#FFFFFF': 'background', '#F2F2F2': 'light panel', '#D9D9D9': 'rule', '#7F7F7F': 'connector', '#404040': 'text'}
# One arrangement per variation, so 4 variations differ the way Napkin's sort_strategy "variation" makes them differ.
ARRANGEMENTS = {False: ['cards in one or two rows, each with a small icon above its label',
                        'a hub: the topic in a central circle, the items placed around it with short connector lines',
                        'a column of horizontal bars, each with an icon badge on the left and its text on the right',
                        'a grid of tiles (2 or 3 per row), each with an icon and its text'],
                True: ['a left-to-right process flow: one box per step with arrows between them',
                       'a rising staircase: one step per item from bottom-left to top-right, read in order',
                       'a horizontal timeline: one marker per step on a line, the text alternating above and below',
                       'a column of numbered bars from top to bottom, one per step']}

SYSTEM = f"""You design one slide infographic as a single SVG for a corporate training deck (Simplilearn). The SVG is converted
into native, editable PowerPoint shapes, so follow these rules exactly.

Canvas: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {AREA_W} {AREA_H}" width="{AREA_W}" height="{AREA_H}">. One unit is
one point on the slide. Leave a 10-unit margin; nothing may extend beyond the canvas.

Content - the most important rule:
- Show the whole content given, every point, in the wording of the text (labels may be shortened to their key words).
- Never add facts, figures, examples or items that are not in the text. Never turn a statement into a question or quiz.
- A heading is optional; if used, it is the topic of the text (never a question) and at most one line.
- Numbers or arrows only when the text states an order. Values (numbers, formulas, e-mail addresses) exactly as written.

Text:
- font-family="Open Sans"; every font-size at least 22 (headings 28-32). Text colour #404040 on light fills, #FFFFFF only on #404040.
- SVG text does not wrap: break longer text into <tspan x=".." dy=".."> lines yourself (line height 1.2 x font-size).
  Estimate width as 0.55 x font-size per character and make every line fit inside its shape with 12 units of padding.
- Text never overlaps other text, icons or connector lines. Use text-anchor="middle" for centred labels.

Shapes and colours:
- Use only these colours: accents {", ".join(PALETTE)}; neutrals {", ".join(f"{k} ({v})" for k, v in NEUTRALS.items())}.
- Solid fills only: no gradients, filters, shadows, opacity effects, masks, clip paths, images, <foreignObject>, <style>, CSS
  classes or scripts. Put colours in fill / stroke attributes.
- Prefer <rect> (rx for rounded corners), <circle>, <ellipse>, <line>, <polyline> and straight-line <path> (M/L/H/V/Z):
  these become editable shapes. Curves become pictures, so use them only inside icons.
- Icons: small (36-56 units), flat, filled with one accent colour, built from a few simple shapes, each icon in its own <g>.
- Put each item (its shape, icon and text) in its own top-level <g>, so it becomes one PowerPoint group.
- Plenty of white space, aligned items, equal sizes for items of the same kind. No decorative illustrations.

Answer with the SVG only: start with <svg and end with </svg>, no explanation and no code fence."""

# The design specification (V10.11; the only request the panel makes now): one request returns the content's structure
# and its visual design as JSON - every item with its role and pictorial object, the groups, the main flow, the
# compositions that suit it and, when none of them fits, a composition of Claude's own on a 12 x 6 grid - and the panel
# draws up to four different layouts from it (plan.js and the design packs), each measured at 22 pt and checked. One paid
# request for every variation; the drawing - where generated SVGs fail (clipped labels, crossing connectors) - is done by
# code that measures it. The lists below must match the panel's (tests/test_claude.py checks them).
PLAN_LAYOUTS = ['platform', 'stack3d', 'scene', 'capmap', 'swimlanes', 'planes', 'ecosystem', 'modules', 'pyramid', 'cycle', 'cyclewheel', 'funnel', 'versus',
                'architecture', 'layers', 'capability', 'tree', 'pipeline', 'timeline', 'stair', 'hub', 'grid', 'columns', 'rows',
                'roadmap', 'pillars', 'quadrant', 'spotlight', 'storyboard', 'callout', 'journey', 'topicspot', 'topicband', 'cylsteps', 'arrowcards', 'badgecards',
                'avcylinders', 'avarrowrow', 'aviconline', 'avcirclearrows', 'avfunnel', 'avpyramid',
                'avstairsfront', 'avpucks', 'avdiamonds', 'avrise', 'avascending', 'avsnake', 'avtimeline', 'avring', 'avquarter',
                'avletters', 'avletterscompact', 'avgrouprows',
                'learnmap', 'herobanner', 'bridge', 'iconrows', 'badges', 'splitpanels', 'poster', 'ribbon', 'colortiles',
                'concepttiles', 'orbit', 'honeycomb', 'isostack', 'bento', 'keystatement',
                'numcards', 'chevrons', 'zigzag', 'contrast']
PICTORIALS = ['collect', 'evaluate', 'clean', 'features', 'train', 'mlcore', 'predict', 'deploy', 'problem', 'database', 'dataset', 'folder', 'document',
              'server', 'cloud', 'gateway', 'app', 'window', 'code', 'gear', 'monitor', 'chartUp', 'shield', 'lock', 'checklist', 'magnifier', 'filter',
              'warning', 'calendar', 'team', 'person', 'org', 'chat', 'sheet', 'pages', 'image', 'text', 'video', 'music', 'cyber', 'fraud', 'bank', 'cart',
              'car', 'factory', 'medical', 'xray', 'book', 'cap', 'bulb', 'coin', 'flag', 'target', 'milestone', 'info', 'access', 'spark', 'profile',
              'shapes', 'globe', 'bowl', 'fingerprint', 'brain', 'megaphone', 'mail', 'briefcase', 'rocket', 'growth', 'social', 'analysis', 'trophy',
              'presentation', 'aidoc']
# V10.16: Claude's own compositions ("concepts"): the native shapes and colour tokens it may use
CONCEPT_SHAPES = ['rect', 'roundRect', 'ellipse', 'pill', 'hexagon', 'diamond', 'triangle', 'chevron', 'homePlate', 'parallelogram', 'donut',
                  'blockArc', 'can', 'shield', 'star5', 'tab', 'cube', 'trapezoid', 'callout', 'rtTriangle', 'cloud', 'foldedCorner']
CONCEPT_COLORS = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10', 'panel', 'rule', 'line', 'white', 'ink']
ROLES = ['source', 'stage', 'output', 'support_control', 'support_quality', 'support_foundation', 'component', 'concept']
PLAN_SYSTEM = """You design one slide of a corporate training deck (Simplilearn): you analyse its content and return the content's
structure and its visual design as JSON. The panel draws the infographic itself, as editable PowerPoint shapes, in up to
four structurally different compositions from your one answer. You decide what the content is, how it is organised, which
compositions show that best and which object depicts each item.

Content - the most important rules:
- Every point of the content becomes exactly one item, in the text's order. Never merge two points, never drop one,
  never add one. A heading or an introduction sentence is not an item.
- Content written as labelled sections ("What you learn: a, b, and c. Best for: x, y, or z."): every section is a
  group (role category, name exactly the section's label, e.g. "What you learn") and every entry of its list is one
  item of that group, in order, with a short label (1-4 words, the text's own words): a lead-in such as "working with
  tools like" is dropped ("ChatGPT or Python"); examples after "like" or "such as" go to detail; an acronym in
  brackets may be the label with the full name as detail. Every section is kept - never only the last one.
- label: the point's name as the text writes it (without numbering or a trailing colon).
- detail: the point's key words from the text, 2 to 6 words (at most 45 characters), in the text's own wording, so the
  meaning stays the same. Values (numbers, formulas, codes, e-mail addresses, conditions) exactly as written. Empty
  when the text gives nothing beyond the label.
- Never add facts, figures, examples, relationships or claims the text does not state. Never turn a statement into a question.
- title: the content's topic in the text's words (its heading when it has one).
- headline: the slide's message for learners in 3 to 8 words, in the text's own terms, inviting but plain (no
  question, no exclamation mark, no new claim). May equal the title.
- takeaway: the content's key message in one sentence of at most 90 characters, built only from what the text says;
  "" when the text states no message beyond its points.
- hero: the object from the pictorial list below that depicts the whole topic most accurately, or "" when none does.
- short: the topic's short name for a hero badge: an acronym the text gives ("AI & ML"), else 1-3 of the title's words.

Structure and semantics:
- relation: "sequence" for a process or steps in order; "pipeline_with_support" when some items form a main flow and
  others apply across all of it (orchestration, monitoring, security, governance); "layers" or "hierarchy" for levels;
  "categories" for named groups; "comparison" when 2-3 things are compared; "cycle" only for a stated cycle; "funnel"
  only for content that narrows down; "hub" when every item relates to one central topic; "independent" otherwise.
  Numbering in the text is not an order by itself: functions that apply across a flow are never steps of it.
- role of each item: stage (a step of the main flow), output (what the flow serves: analytics, reports), support_control
  (coordinates the flow: orchestration, scheduling), support_quality (watches it: monitoring, quality checks),
  support_foundation (applies to all of it: security, governance, compliance), source, component (a part of a system),
  concept (an independent idea).
- groups: only when the content clearly sorts the items into 2 to 4 groups (2-4 words each, the text's words where
  possible); role: flow, support, layer, category or output. Else []. group: the item's group id, or "".
- flow: the ids of the main flow's items in order ([] when there is no order).
- pictorial: the object from this list that depicts the item most accurately: """ + ', '.join(PICTORIALS) + """.
  icon_hint: the object in 1-3 words of your own (used when the list has nothing accurate).

Design:
- layouts: the 4 compositions that suit this content best, best first, each structurally different: platform (a platform
  frame: the flow's modules with the functions across it as bands), stack3d (layered system of stacked slabs), scene
  (technical illustration: one pictorial object per stage on one line, annotated), capmap (capability map: domain boxes,
  functions as a strip across them), swimlanes, planes (control and data planes), ecosystem (parts around a core),
  modules (modular blocks), pyramid, cycle, funnel, versus (two things compared), architecture, layers, capability, tree,
  pipeline, timeline, stair, hub, grid, columns, rows, roadmap (milestones on a road, steps in order), pillars (the
  points as columns under the topic), quadrant (four points around the topic), spotlight (a hero panel with the topic's
  object, headline and takeaway beside the points), storyboard (visual summary cards with big objects), callout (the
  topic's object large in the middle, the points called out around it), journey (a learning journey of 4-8 steps on a
  winding path), learnmap (a hero panel for the topic joined by a bracket to its sections, each section a panel of
  object-and-label columns under a pill heading - for labelled sections), herobanner (a hero band with the topic,
  the sections as cards below), bridge (two sections: what is learned on the left, the topic as a hub, what it is for
  on the right), iconrows (each section a band with its name on a chip and its items as object columns), badges
  (badge cards with an object disc over each), splitpanels (tall section panels led by an object for the section),
  poster (the headline large, the items as tagged object tiles), ribbon (two sections: the topic on a band across
  the middle, one section above it and one below), colortiles (colour tiles under each section's name), concepttiles
  (a hero card for the topic, a bracket, the items as icon tiles in a panel), orbit (the topic as a hub, the items as
  object discs around it), honeycomb (the items in hexagons along a zigzag), isostack (isometric slabs, one per
  section or item), bento (a bento grid: the topic as the large tile, the items as tiles of different sizes),
  keystatement (the topic in large type with what it does as pills, the items as a row of objects), cylsteps (rising
  2.5D cylinders, numbered, an icon badge over each - steps or growth), arrowcards (bordered icon cards joined by
  arrows - steps), badgecards (bordered white cards with a coloured round icon badge - the reference course style, any
  list), topicspot / topicband (the topic and its description, its named sections as bordered icon cards, the outcome
  as a bar - a topic with sections and an outcome). Premium structures (drawn by AntV Infographic, 3D where named):
  avcylinders (3D cylinders rising), avstairsfront (3D stacked steps), avpucks (3D pucks on a zigzag), avdiamonds (3D
  diamonds on a path), avarrowrow (an arrow timeline with icon badges above and below), aviconline (a coloured line
  with icon badges), avrise (a rising arrow with the steps along it), avascending (ascending steps), avsnake (a snake
  line with icons), avtimeline (a vertical timeline), avring (a ring cycle), avcirclearrows (circular arrows), avfunnel,
  avpyramid, avquarter (exactly four points as a quarter circle), avletters / avletterscompact (2-4 named groups as
  letter-headed cards - e.g. SWOT), avgrouprows (2-4 named groups as rows of their points). QUALITY FIRST: choose the most premium, most
  visual structures that truly fit - the av* structures, cylsteps, arrowcards, badgecards and topicspot first - and
  plain grids, rows or columns only when nothing richer suits. Never a composition that implies something the text does not say
  (an order for independent ideas, a hierarchy for a list).
- custom: a composition of your own when the content suggests one the list lacks, else zones []. The area is a grid of
  12 columns x 6 rows; each zone: id, label (a group's name or ""), items (item ids), col, row, w, h (whole cells, inside
  the grid, zones not overlapping), style: band (a strip with its label on the left), panel (a box with its label on top),
  nodes_row or nodes_column (items side by side or stacked). connectors: {from, to} item ids, only for relationships the
  text states. Every item in exactly one zone.
- One statement ("X helps you create, organize and edit A, B, C and D"): X is the hero (short), the listed examples
  are the items (the text's words), and what X does ("create, organize, and edit diverse types of content") is the
  single group's name or the headline - never the whole sentence as one block of text, never invented items.
- concepts: exactly 6 complete compositions of your own design, each a genuinely different visual idea that comes from
  THIS content's meaning (what flows into what, what contains what, what is compared, what grows, what surrounds the
  topic) rather than from a generic template - modern and engaging for learners like a polished AI infographic. Use six
  different structures and metaphors, for example: a hero object (a device, a disc, a card) joined by elbow connectors
  with dots to cards that each hold an icon tile and a label; an input -> topic -> outputs flow; a header pill over a
  panel of icon columns per section; an orbit or ecosystem around the topic; a winding learner journey; layered slabs or
  a stack; a bento grid of tiles of different sizes; a split comparison; a framework of quadrants; an illustrated scene
  with callouts - never the same arrangement in other colours or mirrored, never plain text in boxes. Each: name (2-4 words), idea (one sentence: why this picture suits the content)
  and elements, drawn in order (later elements on top) in the content area: x from 0 to 1079, y from 0 to 435 (points;
  16:9 slide, the slide's title is above it). Element kinds:
  shape: a native shape (shape from the list, color a token; text "" or a short label drawn on it);
  text: a text box (text, size, bold, align left or center; never right);
  object: a pictorial object from the list above, drawn in a square of side min(w, h) in color;
  line: a connector from (x, y) to (x2, y2) in color.
  item: the id of the item an element shows ("" for decoration, the hero or headings). Colour tokens: a1 to a10 the
  template's accent colours (light blue, orange, mint, lilac, coral, gold, steel blue, pink, brown, mauve), panel
  (light grey), rule (mid grey), line (connector grey), white, ink (dark text only). Text is always ink.
  Rules: every item's label appears exactly once as the text of a text or shape element with that item's id, in the
  text's words; its detail, when shown, as its own text element; the hero name and the group names or headline so
  that nothing the text says is lost; nothing else is added. Text sizes follow the template exactly: 22 pt for labels
  and descriptions, 24 pt for headings and the hero name (bold) - no other sizes; sentence case; a text box must be wide and tall enough for its words at 0.55 x size per character (0.6 for bold) and 1.2 x
  size per line; no text overlaps another text, an object or a line; nothing outside the area; leave 12 pt between
  unrelated elements. Flat design: no gradients, shadows, outlines around filled shapes or dashed lines. Make it
  polished and engaging for learners: one clear focal element, a hierarchy of sizes, an object for every item,
  generous spacing, balanced colour. Professional discipline (the reference course slides): build on a strict grid -
  equal card sizes in a row, aligned tops and baselines, equal gaps of 16-24 pt, margins of 24 pt; cards white with a
  coloured border (a coloured shape with a white one 2 pt inside it) or a light panel; each item's object on a coloured
  round badge (an ellipse in an accent colour, the object inside it); at most 3 accent colours used with intent; one
  focal element; never tiny objects (an object is at least 48 x 48 pt), never text smaller than the template sizes,
  never empty decorative areas larger than the content."""
_S = {'type': 'string'}
_I = {'type': 'integer'}
_N = {'type': 'number'}
PLAN_SCHEMA = {
    'type': 'object', 'additionalProperties': False,
    'required': ['title', 'headline', 'takeaway', 'hero', 'short', 'relation', 'groups', 'items', 'flow', 'layouts', 'custom', 'concepts'],
    'properties': {
        'title': _S, 'headline': _S, 'takeaway': _S,
        'hero': {'type': 'string', 'enum': [''] + PICTORIALS}, 'short': _S,
        'relation': {'type': 'string', 'enum': ['sequence', 'pipeline_with_support', 'layers', 'hierarchy', 'categories', 'comparison', 'cycle', 'funnel', 'hub', 'independent']},
        'groups': {'type': 'array', 'items': {'type': 'object', 'additionalProperties': False, 'required': ['id', 'name', 'role'],
                   'properties': {'id': _S, 'name': _S, 'role': {'type': 'string', 'enum': ['flow', 'support', 'layer', 'category', 'output']}}}},
        'items': {'type': 'array', 'items': {'type': 'object', 'additionalProperties': False, 'required': ['id', 'label', 'detail', 'role', 'pictorial', 'icon_hint', 'group'],
                  'properties': {'id': _S, 'label': _S, 'detail': _S, 'role': {'type': 'string', 'enum': ROLES},
                                 'pictorial': {'type': 'string', 'enum': PICTORIALS}, 'icon_hint': _S, 'group': _S}}},
        'flow': {'type': 'array', 'items': _S},
        'layouts': {'type': 'array', 'items': {'type': 'string', 'enum': PLAN_LAYOUTS}},
        'concepts': {'type': 'array', 'items': {'type': 'object', 'additionalProperties': False, 'required': ['name', 'idea', 'elements'], 'properties': {
            'name': _S, 'idea': _S,
            'elements': {'type': 'array', 'items': {'type': 'object', 'additionalProperties': False,
                         'required': ['kind', 'shape', 'x', 'y', 'w', 'h', 'x2', 'y2', 'color', 'text', 'size', 'bold', 'align', 'object', 'item'],
                         'properties': {'kind': {'type': 'string', 'enum': ['shape', 'text', 'object', 'line']}, 'shape': {'type': 'string', 'enum': [''] + CONCEPT_SHAPES},
                                        'x': _N, 'y': _N, 'w': _N, 'h': _N, 'x2': _N, 'y2': _N, 'color': {'type': 'string', 'enum': [''] + CONCEPT_COLORS},
                                        'text': _S, 'size': _I, 'bold': {'type': 'boolean'}, 'align': {'type': 'string', 'enum': ['left', 'center']},
                                        'object': {'type': 'string', 'enum': [''] + PICTORIALS}, 'item': _S}}}}}},
        'custom': {'type': 'object', 'additionalProperties': False, 'required': ['name', 'zones', 'connectors'], 'properties': {
            'name': _S,
            'zones': {'type': 'array', 'items': {'type': 'object', 'additionalProperties': False, 'required': ['id', 'label', 'items', 'col', 'row', 'w', 'h', 'style'],
                      'properties': {'id': _S, 'label': _S, 'items': {'type': 'array', 'items': _S}, 'col': _I, 'row': _I, 'w': _I, 'h': _I,
                                     'style': {'type': 'string', 'enum': ['band', 'panel', 'nodes_row', 'nodes_column']}}}},
            'connectors': {'type': 'array', 'items': {'type': 'object', 'additionalProperties': False, 'required': ['from', 'to'], 'properties': {'from': _S, 'to': _S}}}}},
    }}


# Configurable in claude.json (configure-claude.ps1): model, effort (low|medium|high|xhigh|max), max_tokens, and the
# prices used for the cost estimate shown in the panel ($ per million tokens; the bill itself is in platform.claude.com).
DEFAULTS = {'model': DEFAULT_MODEL, 'effort': 'high', 'max_tokens': 32000}
PRICES = {'claude-opus-5-5': (4.0, 20.0), 'claude-sonnet-5-5': (2.0, 10.0), 'claude-haiku-5-5': (0.10, 0.50), 'claude-fable-5-1': (10.0, 50.0)}
EFFORTS = ('low', 'medium', 'high', 'xhigh', 'max')


def settings(data_dir):
    try:      # utf-8-sig: Windows PowerShell 5.1 writes the file with a byte-order mark
        with open(os.path.join(data_dir, 'claude.json'), encoding='utf-8-sig') as f:
            s = json.load(f)
    except (OSError, ValueError):
        s = {}
    # the key stored by configure-claude.ps1 first; the environment variable only when it looks like a key (a placeholder
    # such as a single character must not make Claude look configured)
    looks = lambda k: isinstance(k, str) and k.strip().startswith('sk-ant-') and len(k.strip()) > 20
    key = next((k.strip() for k in (s.get('api_key'), os.environ.get('ANTHROPIC_API_KEY')) if looks(k)), '')
    model = str(s.get('model') or DEFAULTS['model'])
    effort = s.get('effort') if s.get('effort') in EFFORTS else DEFAULTS['effort']
    try:
        max_tokens = min(128000, max(4000, int(s.get('max_tokens') or DEFAULTS['max_tokens'])))
    except (TypeError, ValueError):
        max_tokens = DEFAULTS['max_tokens']
    pin, pout = PRICES.get(model, (None, None))
    try:
        pin, pout = float(s.get('price_input_per_mtok', pin)), float(s.get('price_output_per_mtok', pout))
    except (TypeError, ValueError):
        pin = pout = None
    return {'key': key, 'model': model, 'effort': effort, 'max_tokens': max_tokens, 'prices': (pin, pout) if pin is not None else None,
            'sdk': anthropic is not None, 'enabled': bool(key) and anthropic is not None and s.get('enabled', True) is not False}


def cost(usage, prices):
    """Estimated cost in US dollars from the token counts, or None when no price is known for the model."""
    if not prices or prices[0] is None:
        return None
    return round(usage['input_tokens'] / 1e6 * prices[0] + usage['output_tokens'] / 1e6 * prices[1], 4)


def prompt(content, context, arrangement):
    return (f'Content (show all of it):\n<content>\n{content}\n</content>\n\n'
            + (f'Guidance (not content; do not draw it as text): {context}\n\n' if context else '')
            + (f'Arrangement for this design: {arrangement}.' if arrangement else 'Choose the arrangement that suits this content best.'))


class ClaudeError(Exception):
    pass


def one_svg(client, s, content, context, arrangement):
    """One variation: (svg text, usage dict). Raises ClaudeError with a plain explanation. One request, no fallback model:
    a declined request is reported, never re-run elsewhere (no extra paid calls)."""
    with client.messages.stream(
            model=s['model'], max_tokens=s['max_tokens'], system=SYSTEM,
            output_config={'effort': s['effort']},
            messages=[{'role': 'user', 'content': prompt(content, context, arrangement)}]) as stream:
        msg = stream.get_final_message()
    usage = {'input_tokens': msg.usage.input_tokens, 'output_tokens': msg.usage.output_tokens}
    if msg.stop_reason == 'refusal':
        raise ClaudeError('Claude declined this request.')
    if msg.stop_reason == 'max_tokens':
        raise ClaudeError('the answer was cut off (too long).')
    text = ''.join(b.text for b in msg.content if b.type == 'text')
    m = re.search(r'<svg[\s>][\s\S]*</svg>', text)
    if not m:
        raise ClaudeError('the answer did not contain an SVG picture.')
    return m.group(0), usage


def one_plan(client, s, content, context, _arrangement=None):
    """The content plan: (JSON text, usage). One request with structured output (the schema guarantees valid JSON)."""
    with client.messages.stream(
            model=s['model'], max_tokens=s['max_tokens'], system=PLAN_SYSTEM,
            output_config={'effort': s['effort'], 'format': {'type': 'json_schema', 'schema': PLAN_SCHEMA}},
            messages=[{'role': 'user', 'content': f'Content:\n<content>\n{content}\n</content>' + (f'\n\nGuidance (not content): {context}' if context else '')}]) as stream:
        msg = stream.get_final_message()
    usage = {'input_tokens': msg.usage.input_tokens, 'output_tokens': msg.usage.output_tokens}
    if msg.stop_reason == 'refusal':
        raise ClaudeError('Claude declined this request.')
    if msg.stop_reason == 'max_tokens':
        raise ClaudeError('the answer was cut off (too long).')
    text = ''.join(b.text for b in msg.content if b.type == 'text')
    try:
        data = json.loads(text)
    except ValueError:
        raise ClaudeError('the answer was not a content plan (no valid JSON).')
    if not isinstance(data, dict) or not isinstance(data.get('items'), list) or len(data['items']) < 2:
        raise ClaudeError('the content plan has fewer than 2 items.')
    return json.dumps(data, ensure_ascii=False), usage


def generate(s, content, context, variations, ordered, timeout_s, client=None, mode='svg'):
    """mode 'plan': one request for the content plan (the panel draws up to 4 layouts from it). mode 'svg': all
    variations in parallel, one request each. max_retries=0: nothing is repeated automatically.
    s: settings(). Returns {files: [..] (= svgs), errors: [..], usage: {...}, cost_usd, seconds, model, effort}."""
    key, model = s['key'], s['model']
    client = client or anthropic.Anthropic(api_key=key, timeout=timeout_s, max_retries=0)
    one = one_plan if mode == 'plan' else one_svg
    plans = [''] if mode == 'plan' or variations <= 1 else ARRANGEMENTS[bool(ordered)][:variations]
    t0, svgs, errors, usage = time.time(), [None] * len(plans), [], {'input_tokens': 0, 'output_tokens': 0}
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(plans)) as pool:
        futs = {pool.submit(one, client, s, content, context, a): i for i, a in enumerate(plans)}
        for f in concurrent.futures.as_completed(futs):
            i = futs[f]
            try:
                svgs[i], u = f.result()
                for k in usage:
                    usage[k] += u[k]
            except ClaudeError as e:
                errors.append(f'variation {i + 1}: {e}')
            except anthropic.AuthenticationError:
                errors.append('the API key is not valid; run "Configure Claude.bat" with a new key')
            except anthropic.PermissionDeniedError:
                errors.append('the API key is not allowed to use this model')
            except anthropic.NotFoundError:
                errors.append(f'the model "{model}" was not found; check "model" in claude.json')
            except anthropic.RateLimitError:
                errors.append(f'variation {i + 1}: the rate limit of your Anthropic account was reached')
            except anthropic.APIStatusError as e:
                errors.append(f'variation {i + 1}: Anthropic API error {e.status_code} ({str(e.message)[:200]})')
            except anthropic.APIConnectionError:
                errors.append(f'variation {i + 1}: the Anthropic API could not be reached')
            except Exception as e:      # anything else: reported for this variation, the others are kept
                errors.append(f'variation {i + 1}: {type(e).__name__}')
    key_hidden = lambda t: t.replace(key, '<key>') if key else t
    files = [x for x in svgs if x]
    return {'files': files, 'svgs': files, 'mode': mode, 'errors': [key_hidden(e) for e in dict.fromkeys(errors)], 'usage': usage,
            'cost_usd': cost(usage, s.get('prices')), 'seconds': round(time.time() - t0, 1), 'model': model, 'effort': s['effort']}


# ---------------- AI Icon Generation ----------------
ICON_SYSTEM = """You design a single minimalist corporate icon for a PowerPoint slide representing the user's description.
Return ONLY a valid JSON object matching the schema below. No markdown backticks, no explanatory text.
The icon is drawn on a 100 x 100 coordinate grid (0 to 100).
Rules:
1. Compose the icon using 2 to 8 simple geometric shapes from this allowed list:
   rect, roundRect, ellipse, triangle, trapezoid, diamond, cube, pill, chevron, can, cloud, foldedCorner, gear6, hexagon, shield, blockArc, tab, donut, plus, star5, rtTriangle, parallelogram.
2. Coordinates x, y, w, h are numbers from 0 to 100. Center the icon nicely (overall bounding box within 10 to 90).
3. Allowed colors:
   - "primary": main brand accent color (e.g. blue)
   - "tint": lighter tint of the accent color
   - "shade": darker shade of the accent color
   - "white": pure white (#FFFFFF) for windows, cutouts, inner details
   - "dark": dark charcoal (#2B2B2B) for wheels, tracks, stands, bases
   - "coral": accent coral (#E58F6D) for lights, alerts, indicators
   - "gold": accent gold (#DDB945) for highlights, badges
   - "none": transparent
4. Return format:
{
  "name": "snake_case_name",
  "label": "Display Title",
  "elements": [
    { "shape": "shapeName", "x": 10, "y": 30, "w": 80, "h": 40, "fill": "primary", "line": "none", "lineW": 0, "rot": 0 }
  ],
  "svg": "<svg viewBox=\\"0 0 100 100\\" xmlns=\\"http://www.w3.org/2000/svg\\">...</svg>"
}"""

FALLBACK_ICON_TEMPLATES = {
    'vehicle': {
        'name': 'vehicle',
        'label': 'Vehicle',
        'elements': [
            {'shape': 'trapezoid', 'x': 28, 'y': 34, 'w': 44, 'h': 20, 'fill': 'primary'},
            {'shape': 'roundRect', 'x': 12, 'y': 50, 'w': 76, 'h': 22, 'fill': 'primary'},
            {'shape': 'rect', 'x': 34, 'y': 38, 'w': 14, 'h': 12, 'fill': 'white'},
            {'shape': 'rect', 'x': 52, 'y': 38, 'w': 14, 'h': 12, 'fill': 'white'},
            {'shape': 'ellipse', 'x': 22, 'y': 64, 'w': 18, 'h': 18, 'fill': 'dark'},
            {'shape': 'ellipse', 'x': 27, 'y': 69, 'w': 8, 'h': 8, 'fill': 'white'},
            {'shape': 'ellipse', 'x': 60, 'y': 64, 'w': 18, 'h': 18, 'fill': 'dark'},
            {'shape': 'ellipse', 'x': 65, 'y': 69, 'w': 8, 'h': 8, 'fill': 'white'},
            {'shape': 'rect', 'x': 12, 'y': 55, 'w': 5, 'h': 7, 'fill': 'coral'}
        ],
        'svg': '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><polygon points="34,34 66,34 72,54 28,54" fill="#62B7E4"/><rect x="12" y="50" width="76" height="22" rx="4" fill="#62B7E4"/><rect x="34" y="38" width="14" height="12" fill="#FFFFFF"/><rect x="52" y="38" width="14" height="12" fill="#FFFFFF"/><circle cx="31" cy="73" r="9" fill="#2B2B2B"/><circle cx="31" cy="73" r="4" fill="#FFFFFF"/><circle cx="69" cy="73" r="9" fill="#2B2B2B"/><circle cx="69" cy="73" r="4" fill="#FFFFFF"/></svg>'
    },
    'truck': {
        'name': 'delivery_truck',
        'label': 'Delivery Truck',
        'elements': [
            {'shape': 'roundRect', 'x': 10, 'y': 28, 'w': 52, 'h': 42, 'fill': 'tint'},
            {'shape': 'roundRect', 'x': 58, 'y': 38, 'w': 32, 'h': 32, 'fill': 'primary'},
            {'shape': 'rect', 'x': 68, 'y': 42, 'w': 16, 'h': 12, 'fill': 'white'},
            {'shape': 'ellipse', 'x': 18, 'y': 64, 'w': 18, 'h': 18, 'fill': 'dark'},
            {'shape': 'ellipse', 'x': 40, 'y': 64, 'w': 18, 'h': 18, 'fill': 'dark'},
            {'shape': 'ellipse', 'x': 70, 'y': 64, 'w': 18, 'h': 18, 'fill': 'dark'},
            {'shape': 'rect', 'x': 86, 'y': 54, 'w': 4, 'h': 8, 'fill': 'gold'}
        ],
        'svg': '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="28" width="52" height="42" rx="3" fill="#A8D8F0"/><rect x="58" y="38" width="32" height="32" rx="3" fill="#62B7E4"/><rect x="68" y="42" width="16" height="12" fill="#FFFFFF"/><circle cx="27" cy="73" r="9" fill="#2B2B2B"/><circle cx="49" cy="73" r="9" fill="#2B2B2B"/><circle cx="79" cy="73" r="9" fill="#2B2B2B"/></svg>'
    },
    'robot': {
        'name': 'robot',
        'label': 'Robot',
        'elements': [
            {'shape': 'roundRect', 'x': 30, 'y': 22, 'w': 40, 'h': 28, 'fill': 'primary'},
            {'shape': 'ellipse', 'x': 38, 'y': 32, 'w': 8, 'h': 8, 'fill': 'coral'},
            {'shape': 'ellipse', 'x': 54, 'y': 32, 'w': 8, 'h': 8, 'fill': 'coral'},
            {'shape': 'roundRect', 'x': 25, 'y': 54, 'w': 50, 'h': 34, 'fill': 'tint'},
            {'shape': 'rect', 'x': 35, 'y': 60, 'w': 30, 'h': 16, 'fill': 'white'},
            {'shape': 'plus', 'x': 46, 'y': 10, 'w': 8, 'h': 12, 'fill': 'primary'}
        ],
        'svg': '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="30" y="22" width="40" height="28" rx="4" fill="#62B7E4"/><circle cx="42" cy="36" r="4" fill="#E58F6D"/><circle cx="58" cy="36" r="4" fill="#E58F6D"/><rect x="25" y="54" width="50" height="34" rx="4" fill="#A8D8F0"/><rect x="35" y="60" width="30" height="16" fill="#FFFFFF"/></svg>'
    },
    'drone': {
        'name': 'drone',
        'label': 'Drone',
        'elements': [
            {'shape': 'roundRect', 'x': 35, 'y': 42, 'w': 30, 'h': 18, 'fill': 'primary'},
            {'shape': 'ellipse', 'x': 45, 'y': 54, 'w': 10, 'h': 10, 'fill': 'dark'},
            {'shape': 'pill', 'x': 16, 'y': 34, 'w': 30, 'h': 6, 'fill': 'shade'},
            {'shape': 'pill', 'x': 54, 'y': 34, 'w': 30, 'h': 6, 'fill': 'shade'},
            {'shape': 'ellipse', 'x': 10, 'y': 28, 'w': 22, 'h': 14, 'fill': 'tint'},
            {'shape': 'ellipse', 'x': 68, 'y': 28, 'w': 22, 'h': 14, 'fill': 'tint'}
        ],
        'svg': '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="35" y="42" width="30" height="18" rx="4" fill="#62B7E4"/><circle cx="50" cy="59" r="5" fill="#2B2B2B"/><ellipse cx="21" cy="35" rx="11" ry="7" fill="#A8D8F0"/><ellipse cx="79" cy="35" rx="11" ry="7" fill="#A8D8F0"/></svg>'
    },
    'solar': {
        'name': 'solar_panel',
        'label': 'Solar Panel',
        'elements': [
            {'shape': 'parallelogram', 'x': 15, 'y': 22, 'w': 70, 'h': 46, 'fill': 'primary'},
            {'shape': 'pill', 'x': 46, 'y': 66, 'w': 8, 'h': 24, 'fill': 'dark'},
            {'shape': 'star5', 'x': 70, 'y': 10, 'w': 20, 'h': 20, 'fill': 'gold'}
        ],
        'svg': '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><polygon points="25,22 85,22 75,68 15,68" fill="#62B7E4"/><rect x="46" y="66" width="8" height="24" rx="4" fill="#2B2B2B"/></svg>'
    }
}


def _match_fallback_icon(description, generic=True):
    words = re.findall(r'[a-zA-Z0-9]+', description.lower())
    for w in words:
        if w in ('vehicle', 'car', 'automobile', 'auto', 'drive', 'van', 'suv'):
            return FALLBACK_ICON_TEMPLATES['vehicle']
        if w in ('truck', 'delivery', 'cargo', 'freight', 'shipping', 'lorry'):
            return FALLBACK_ICON_TEMPLATES['truck']
        if w in ('robot', 'bot', 'android', 'cyborg'):
            return FALLBACK_ICON_TEMPLATES['robot']
        if w in ('drone', 'uav', 'quadcopter'):
            return FALLBACK_ICON_TEMPLATES['drone']
        if w in ('solar', 'sun', 'panel', 'green', 'clean'):
            return FALLBACK_ICON_TEMPLATES['solar']
    if not generic:
        return None
    # generic dynamic fallback
    clean_name = re.sub(r'[^a-z0-9]+', '_', description.strip().lower())[:24].strip('_') or 'custom_icon'
    clean_label = ' '.join(w.capitalize() for w in clean_name.split('_'))
    return {
        'name': clean_name,
        'label': clean_label,
        'elements': [
            {'shape': 'roundRect', 'x': 16, 'y': 16, 'w': 68, 'h': 68, 'fill': 'tint'},
            {'shape': 'ellipse', 'x': 30, 'y': 30, 'w': 40, 'h': 40, 'fill': 'primary'},
            {'shape': 'star5', 'x': 40, 'y': 40, 'w': 20, 'h': 20, 'fill': 'white'}
        ],
        'svg': '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="16" y="16" width="68" height="68" rx="12" fill="#A8D8F0"/><circle cx="50" cy="50" r="20" fill="#62B7E4"/></svg>'
    }


ICON_STYLES = {
    'flat': 'Style: flat - one plane, solid shapes, no depth faces.',
    '3d': 'Style: 3D (2.5D isometric) - give the main object a lighter top face ("tint") and a darker side face ("shade") so it reads as a solid object, like a premium 3D icon.',
}


def generate_icon(s, description, timeout_s=30, client=None, style='flat'):
    """Generates a custom corporate icon representing `description` using Claude API.
    Falls back to smart vector templates if API key is not configured or on connection failure.
    """
    desc = str(description or '').strip()
    if not desc:
        raise ValueError('No description given.')

    key = s.get('key') if isinstance(s, dict) else ''
    model = s.get('model') if isinstance(s, dict) else DEFAULT_MODEL
    enabled = bool(s.get('enabled')) if isinstance(s, dict) else False

    # If Claude is configured and anthropic package is installed:
    if enabled and key and anthropic is not None:
        try:
            client = client or anthropic.Anthropic(api_key=key, timeout=timeout_s, max_retries=0)
            with client.messages.stream(
                    model=model, max_tokens=2000, system=ICON_SYSTEM,
                    messages=[{'role': 'user', 'content': f'Design a corporate slide icon for: {desc}\n' + ICON_STYLES.get(style, ICON_STYLES['flat'])}]) as stream:
                msg = stream.get_final_message()
            text = ''.join(b.text for b in msg.content if b.type == 'text')
            m = re.search(r'\{[\s\S]*\}', text)
            if m:
                data = json.loads(m.group(0))
                els = _clean_icon_elements(data.get('elements')) if isinstance(data, dict) else []
                if els:
                    clean_name = re.sub(r'[^a-z0-9_]+', '', str(data.get('name') or desc).lower().replace(' ', '_'))[:30] or 'ai_icon'
                    return {'ok': True, 'source': 'claude',
                            'icon': {'name': clean_name, 'label': str(data.get('label') or desc.title())[:40], 'elements': els}}
            err = 'Claude returned no usable icon'
        except Exception as e:
            err = f'{type(e).__name__}'.replace(key, '<key>') if key else type(e).__name__
        # 10.24: said as it is - a stand-in drawing is never presented as Claude's design
        fb = _match_fallback_icon(desc, generic=False)
        return {'ok': bool(fb), 'source': 'template', 'icon': fb, 'error': '' if fb else f'Claude could not design this icon ({err}).'}
    fb = _match_fallback_icon(desc, generic=False)
    return {'ok': bool(fb), 'source': 'template', 'icon': fb, 'error': '' if fb else 'Claude is not set up on this PC; choose one of the library icons.'}



ICONS_SYSTEM = ICON_SYSTEM.split('4. Return format:')[0] + """5. Depth (2.5D, like premium 3D icons): where it helps, give the main object a lighter top face ("tint") and a darker
   side face ("shade") so it reads as a solid object; keep it simple and centred.
6. You get several points of one slide; draw one icon for each, in the same style, each clearly about its own point.
Return ONLY JSON: {"icons": [{"name": "snake_case", "label": "Title", "elements": [ ...as above... ]}, ...]} - one per point, in order."""


def generate_icons(s, items, timeout_s=60, client=None, style='3d'):
    """10.24: one Claude request designs an icon for every point of a slide (label and description given); returns
    {'ok', 'source': 'claude', 'icons': [icon or None per point]}. Never a stand-in: without Claude, ok is False."""
    pts = [{'label': str(i.get('label') or '')[:80], 'detail': str(i.get('detail') or '')[:160]} for i in (items or [])[:8] if isinstance(i, dict) and i.get('label')]
    if not pts:
        raise ValueError('No points given.')
    key = s.get('key') if isinstance(s, dict) else ''
    if not (isinstance(s, dict) and s.get('enabled') and key and anthropic is not None):
        return {'ok': False, 'source': 'off', 'error': 'Claude is not set up on this PC.', 'icons': [None] * len(pts)}
    try:
        client = client or anthropic.Anthropic(api_key=key, timeout=timeout_s, max_retries=0)
        listing = '\n'.join(f'{n + 1}. {p["label"]}' + (f' - {p["detail"]}' if p['detail'] else '') for n, p in enumerate(pts))
        with client.messages.stream(model=s.get('model') or DEFAULT_MODEL, max_tokens=8000, system=ICONS_SYSTEM,
                                    messages=[{'role': 'user', 'content': 'Design one slide icon for each of these points:\n' + listing + '\n' + ICON_STYLES.get(style, ICON_STYLES['3d'])}]) as stream:
            msg = stream.get_final_message()
        text = ''.join(b.text for b in msg.content if b.type == 'text')
        m = re.search(r'\{[\s\S]*\}', text)
        data = json.loads(m.group(0)) if m else {}
        out = []
        for n, ic in enumerate((data.get('icons') if isinstance(data, dict) else None) or []):
            if n >= len(pts):
                break
            els = _clean_icon_elements(ic.get('elements')) if isinstance(ic, dict) else []
            name = re.sub(r'[^a-z0-9_]+', '', str((ic or {}).get('name') or pts[n]['label']).lower().replace(' ', '_'))[:30] or f'icon_{n}'
            out.append({'name': name, 'label': str((ic or {}).get('label') or pts[n]['label'])[:40], 'elements': els} if els else None)
        out += [None] * (len(pts) - len(out))
        usage = getattr(msg, 'usage', None)
        return {'ok': any(out), 'source': 'claude', 'icons': out, 'usage': {'input_tokens': getattr(usage, 'input_tokens', 0), 'output_tokens': getattr(usage, 'output_tokens', 0)}}
    except Exception as e:
        return {'ok': False, 'source': 'claude', 'error': f'Claude could not design the icons ({type(e).__name__}).', 'icons': [None] * len(pts)}

ICON_SHAPES = {'rect', 'roundRect', 'ellipse', 'triangle', 'trapezoid', 'diamond', 'cube', 'pill', 'chevron', 'can', 'cloud', 'foldedCorner',
               'gear6', 'hexagon', 'shield', 'blockArc', 'tab', 'donut', 'plus', 'star5', 'rtTriangle', 'parallelogram', 'line'}
ICON_COLOURS = {'primary', 'tint', 'shade', 'white', 'dark', 'coral', 'gold', 'none'}


def _clean_icon_elements(els):
    """Claude's icon parts, checked: known shapes and colour tokens only, numbers on the 0-100 grid, at most 12 parts."""
    out = []
    num = lambda v, lo=0.0, hi=100.0: max(lo, min(hi, float(v)))
    for e in (els if isinstance(els, list) else [])[:12]:
        try:
            if not isinstance(e, dict) or e.get('shape') not in ICON_SHAPES:
                continue
            col = lambda k: e.get(k) if e.get(k) in ICON_COLOURS else ('primary' if k == 'fill' else 'none')
            if e['shape'] == 'line':
                out.append({'shape': 'line', 'x1': num(e['x1']), 'y1': num(e['y1']), 'x2': num(e['x2']), 'y2': num(e['y2']),
                            'line': col('line') if e.get('line') not in (None, 'none') else col('fill'), 'lineW': num(e.get('lineW', 3), 1, 12)})
                continue
            w, h = num(e['w'], 1), num(e['h'], 1)
            if w < 2 or h < 2:
                continue
            out.append({'shape': e['shape'], 'x': num(e['x']), 'y': num(e['y']), 'w': w, 'h': h, 'fill': col('fill'), 'line': 'none',
                        'rot': num(e.get('rot', 0), -360, 360)})
        except (KeyError, TypeError, ValueError):
            continue
    return out

