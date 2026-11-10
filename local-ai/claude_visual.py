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
PLAN_LAYOUTS = ['platform', 'stack3d', 'scene', 'capmap', 'swimlanes', 'planes', 'ecosystem', 'modules', 'pyramid', 'cycle', 'funnel', 'versus',
                'architecture', 'layers', 'capability', 'tree', 'pipeline', 'timeline', 'stair', 'hub', 'grid', 'columns', 'rows',
                'roadmap', 'pillars', 'quadrant']
PICTORIALS = ['collect', 'evaluate', 'clean', 'features', 'train', 'mlcore', 'predict', 'deploy', 'problem', 'database', 'dataset', 'folder', 'document',
              'server', 'cloud', 'gateway', 'app', 'window', 'code', 'gear', 'monitor', 'chartUp', 'shield', 'lock', 'checklist', 'magnifier', 'filter',
              'warning', 'calendar', 'team', 'person', 'org', 'chat', 'sheet', 'pages', 'image', 'text', 'video', 'music', 'cyber', 'fraud', 'bank', 'cart',
              'car', 'factory', 'medical', 'xray', 'book', 'cap', 'bulb', 'coin', 'flag', 'target', 'milestone', 'info', 'access', 'spark', 'profile',
              'shapes', 'globe', 'bowl', 'fingerprint']
ROLES = ['source', 'stage', 'output', 'support_control', 'support_quality', 'support_foundation', 'component', 'concept']
PLAN_SYSTEM = """You design one slide of a corporate training deck (Simplilearn): you analyse its content and return the content's
structure and its visual design as JSON. The panel draws the infographic itself, as editable PowerPoint shapes, in up to
four structurally different compositions from your one answer. You decide what the content is, how it is organised, which
compositions show that best and which object depicts each item.

Content - the most important rules:
- Every point of the content becomes exactly one item, in the text's order. Never merge two points, never drop one,
  never add one. A heading or an introduction sentence is not an item.
- label: the point's name as the text writes it (without numbering or a trailing colon).
- detail: the point's key words from the text, 2 to 6 words (at most 45 characters), in the text's own wording, so the
  meaning stays the same. Values (numbers, formulas, codes, e-mail addresses, conditions) exactly as written. Empty
  when the text gives nothing beyond the label.
- Never add facts, figures, examples, relationships or claims the text does not state. Never turn a statement into a question.
- title: the content's topic in the text's words (its heading when it has one).

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
  pipeline, timeline, stair, hub, grid, columns, rows. Never a composition that implies something the text does not say
  (an order for independent ideas, a hierarchy for a list).
- custom: a composition of your own when the content suggests one the list lacks, else zones []. The area is a grid of
  12 columns x 6 rows; each zone: id, label (a group's name or ""), items (item ids), col, row, w, h (whole cells, inside
  the grid, zones not overlapping), style: band (a strip with its label on the left), panel (a box with its label on top),
  nodes_row or nodes_column (items side by side or stacked). connectors: {from, to} item ids, only for relationships the
  text states. Every item in exactly one zone."""
_S = {'type': 'string'}
_I = {'type': 'integer'}
PLAN_SCHEMA = {
    'type': 'object', 'additionalProperties': False,
    'required': ['title', 'relation', 'groups', 'items', 'flow', 'layouts', 'custom'],
    'properties': {
        'title': _S,
        'relation': {'type': 'string', 'enum': ['sequence', 'pipeline_with_support', 'layers', 'hierarchy', 'categories', 'comparison', 'cycle', 'funnel', 'hub', 'independent']},
        'groups': {'type': 'array', 'items': {'type': 'object', 'additionalProperties': False, 'required': ['id', 'name', 'role'],
                   'properties': {'id': _S, 'name': _S, 'role': {'type': 'string', 'enum': ['flow', 'support', 'layer', 'category', 'output']}}}},
        'items': {'type': 'array', 'items': {'type': 'object', 'additionalProperties': False, 'required': ['id', 'label', 'detail', 'role', 'pictorial', 'icon_hint', 'group'],
                  'properties': {'id': _S, 'label': _S, 'detail': _S, 'role': {'type': 'string', 'enum': ROLES},
                                 'pictorial': {'type': 'string', 'enum': PICTORIALS}, 'icon_hint': _S, 'group': _S}}},
        'flow': {'type': 'array', 'items': _S},
        'layouts': {'type': 'array', 'items': {'type': 'string', 'enum': PLAN_LAYOUTS}},
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
