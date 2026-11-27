"""SL Editor 10.27: the icon library of the visuals, made from the team's asset share.

Reads \\\\sl-dns-gd-006\\D\\elearning-video\\assets (or --src):
  icons\\*.svg + icons\\tags.json   Lucide (ISC) and Tabler (MIT) outline icons, recoloured per design
  iconsets\\logos.json              brand logos in colour (CC0; the logos are their owners' trademarks)
  iconsets\\simple-icons.json       Microsoft Office logos (CC0), drawn in each product's colour
and writes local-ai\\assets\\iconlib\\iconlib.json: every icon with its words (name and tags), the concept map (the
built-in concept catalogue's objects -> icons), the word map (slide vocabulary -> icons) and the brand names. Every
icon name the maps use is checked here, so the panel never asks for an icon that is not in the library.

Usage: python deploy\\make-iconlib.py [--src <assets folder>]
"""
import argparse, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'local-ai', 'assets', 'iconlib')
SHARE = r'\\sl-dns-gd-006\D\elearning-video\assets'

# The concept catalogue's objects (gallery.js CATALOG) -> icons, best first
CONCEPT = {
    'fingerprint': 'fingerprint', 'globe': 'globe earth', 'bowl': 'utensils soup', 'cap': 'graduation-cap school',
    'book': 'book-open notebook', 'xray': 'scan-line scan', 'medical': 'stethoscope heart-pulse', 'fraud': 'shield-alert alert-octagon',
    'bank': 'landmark building-bank', 'cart': 'shopping-cart', 'car': 'car', 'cyber': 'shield-alert bug', 'factory': 'factory',
    'problem': 'circle-help help-circle', 'collect': 'inbox download', 'clean': 'eraser filter', 'features': 'sliders-horizontal adjustments',
    'train': 'brain-circuit brain', 'evaluate': 'gauge clipboard-check', 'predict': 'trending-up chart-line', 'deploy': 'rocket',
    'mlcore': 'brain-circuit brain', 'text': 'type file-text', 'music': 'music', 'video': 'video', 'code': 'code code-xml',
    'image': 'image', 'chat': 'message-square messages', 'cloud': 'cloud', 'gateway': 'network', 'database': 'database',
    'folder': 'folder', 'dataset': 'table sheet', 'server': 'server', 'app': 'smartphone', 'window': 'app-window browser',
    'shield': 'shield-check shield', 'lock': 'lock', 'chartUp': 'chart-line trending-up', 'monitor': 'layout-dashboard monitor',
    'team': 'users', 'person': 'user', 'sheet': 'sheet table', 'pages': 'files printer', 'org': 'building-2 building',
    'warning': 'triangle-alert alert-triangle', 'milestone': 'milestone', 'flag': 'target flag', 'calendar': 'calendar',
    'document': 'file-text', 'checklist': 'list-checks clipboard-check', 'filter': 'filter funnel', 'magnifier': 'search',
    'bulb': 'lightbulb bulb', 'coin': 'coins', 'gear': 'settings', 'info': 'info', 'access': 'accessibility',
    'spark': 'sparkles', 'profile': 'user-check', 'shapes': 'shapes',
}

# Slide vocabulary -> icons (best first). Keys are words or phrases as written; the panel stems both sides.
WORDS = {
    # people and roles
    'role': 'id-card contact user-cog', 'roles': 'id-card users', 'customer': 'user-round users', 'client': 'user-round briefcase',
    'employee': 'id-card user', 'staff': 'users', 'manager': 'user-cog', 'leader': 'crown user-star', 'leadership': 'crown',
    'stakeholder': 'users-round', 'team': 'users', 'audience': 'users-round presentation', 'reader': 'book-open-text',
    'learner': 'graduation-cap', 'student': 'graduation-cap', 'teacher': 'presentation', 'trainer': 'presentation',
    'hr': 'id-card users', 'human resources': 'id-card', 'recruitment': 'user-plus', 'hiring': 'user-plus', 'onboarding': 'user-plus',
    'expert': 'award', 'owner': 'user-check', 'user': 'user', 'vendor': 'store', 'supplier': 'truck', 'partner': 'handshake',
    'department': 'building-2', 'unit': 'building-2', 'regulator': 'scale', 'who': 'user-search users',
    # work and admin
    'email': 'mail', 'emails': 'mail', 'mail': 'mail', 'inbox': 'inbox', 'draft': 'file-pen', 'drafting': 'file-pen pen-line',
    'write': 'pen-line', 'writing': 'pen-line', 'edit': 'pencil', 'document': 'file-text', 'documents': 'files',
    'documentation': 'file-text', 'report': 'file-chart-column file-text', 'status report': 'file-chart-column', 'summary': 'file-text',
    'meeting': 'users presentation', 'meetings': 'calendar-clock users', 'agenda': 'list-ordered', 'minutes': 'notebook-pen',
    'schedule': 'calendar-clock calendar', 'scheduling': 'calendar-clock', 'calendar': 'calendar', 'deadline': 'alarm-clock',
    'time': 'clock', 'timeline': 'calendar-range', 'cadence': 'repeat', 'task': 'clipboard-list', 'tasks': 'clipboard-list list-todo',
    'checklist': 'list-checks', 'todo': 'list-todo', 'organize': 'folder-kanban', 'organizing': 'folder-kanban', 'plan': 'map',
    'planning': 'map clipboard-list', 'project': 'folder-kanban', 'projects': 'folder-kanban', 'program': 'layers',
    'approval': 'stamp badge-check', 'approve': 'stamp', 'approves': 'stamp', 'sign-off': 'stamp signature', 'signoff': 'stamp',
    'policy': 'scroll-text', 'policies': 'scroll-text', 'procedure': 'list-ordered', 'process': 'workflow', 'workflow': 'workflow',
    'workflows': 'workflow', 'template': 'layout-template', 'templates': 'layout-template', 'library': 'library-big library',
    'form': 'clipboard-pen', 'forms': 'clipboard-pen', 'invoice': 'receipt', 'invoices': 'receipt', 'purchase order': 'receipt-text',
    'purchase': 'shopping-bag', 'procurement': 'shopping-cart', 'order': 'package', 'orders': 'package', 'inventory': 'boxes',
    'stock': 'boxes', 'warehouse': 'warehouse', 'logistics': 'truck', 'shipping': 'truck', 'delivery': 'truck', 'supply chain': 'route truck',
    'supply': 'package', 'demand': 'trending-up', 'forecast': 'chart-spline trending-up', 'forecasting': 'chart-spline',
    'expense': 'wallet', 'expenses': 'wallet', 'budget': 'piggy-bank wallet', 'cost': 'coins', 'costs': 'coins', 'price': 'tag',
    'pricing': 'tag badge-dollar-sign', 'rate': 'percent', 'rates': 'percent', 'margin': 'percent', 'margins': 'percent',
    'revenue': 'badge-dollar-sign', 'profit': 'hand-coins', 'payment': 'credit-card', 'payments': 'credit-card', 'finance': 'landmark',
    'financial': 'landmark', 'accounting': 'calculator', 'tax': 'receipt', 'audit': 'file-search', 'compliance': 'shield-check',
    'regulated': 'scale', 'regulation': 'scale', 'legal': 'scale', 'law': 'scale', 'contract': 'file-pen-line signature', 'contracts': 'file-pen-line signature',
    'restricted': 'lock', 'classified': 'file-lock', 'confidential': 'file-lock', 'sensitive': 'eye-off', 'privacy': 'shield-check',
    'export': 'file-output', 'import': 'file-input', 'rfp': 'file-question', 'proposal': 'file-text', 'proposals': 'file-text',
    # quality and decisions
    'quality': 'badge-check', 'standard': 'badge-check', 'standards': 'badge-check', 'aligned': 'badge-check', 'check': 'circle-check',
    'verify': 'circle-check', 'validate': 'shield-check', 'validating': 'shield-check', 'validation': 'shield-check',
    'accuracy': 'crosshair target', 'accurate': 'crosshair', 'fact': 'circle-check', 'facts': 'circle-check', 'figures': 'chart-column',
    'review': 'file-search', 'reviews': 'file-search', 'feedback': 'message-square-text', 'decision': 'git-fork split',
    'decide': 'git-fork', 'choice': 'git-fork', 'option': 'list', 'options': 'list', 'compare': 'git-compare', 'comparison': 'git-compare',
    'risk': 'triangle-alert', 'risks': 'triangle-alert', 'issue': 'circle-alert', 'issues': 'circle-alert', 'problem': 'circle-help',
    'question': 'circle-help', 'questions': 'circle-help', 'assumption': 'lightbulb', 'assumptions': 'lightbulb', 'constraint': 'lock',
    'constraints': 'settings-2 lock', 'constrain': 'minimize-2 shrink', 'limit': 'gauge', 'limits': 'gauge', 'scope': 'crosshair',
    'objective': 'target', 'objectives': 'target', 'goal': 'target', 'goals': 'target', 'target': 'target', 'targets': 'target',
    'vision': 'eye', 'mission': 'flag', 'strategy': 'chess-knight compass', 'strategic': 'compass', 'priority': 'list-ordered',
    'deliverable': 'package-check', 'deliverables': 'package-check', 'milestone': 'milestone', 'milestones': 'milestone flag',
    'background': 'history', 'context': 'layers', 'format': 'table layout-grid', 'tone': 'megaphone users-round', 'voice': 'mic',
    'governance': 'landmark scale', 'success': 'trophy', 'achievement': 'trophy', 'reward': 'gift', 'recognition': 'award',
    'measure': 'ruler gauge', 'measures': 'ruler', 'metric': 'gauge', 'metrics': 'gauge chart-column', 'kpi': 'gauge', 'kpis': 'gauge',
    'performance': 'gauge chart-no-axes-combined', 'progress': 'chart-no-axes-combined', 'track': 'radar activity', 'tracking': 'radar',
    'monitor': 'monitor-check activity', 'monitoring': 'activity', 'alignment': 'align-center-vertical', 'improve': 'trending-up',
    'improvement': 'trending-up', 'growth': 'trending-up', 'increase': 'trending-up', 'decrease': 'trending-down', 'reduce': 'trending-down',
    'efficiency': 'zap', 'productivity': 'zap', 'speed': 'zap', 'fast': 'zap', 'save': 'save', 'saving': 'piggy-bank',
    'refine': 'refresh-cw', 'iterate': 'refresh-cw', 'iteration': 'refresh-cw', 'iterative': 'refresh-cw', 'expand': 'maximize-2',
    'depth': 'layers', 'fit': 'scaling', 'cut': 'scissors', 'trim': 'scissors', 'fix': 'wrench', 'correct': 'circle-check',
    'support': 'life-buoy headset', 'help': 'life-buoy', 'service': 'headset', 'customer service': 'headset', 'helpdesk': 'headset',
    'training': 'graduation-cap', 'learning': 'graduation-cap book-open', 'skill': 'award', 'skills': 'award', 'course': 'book-open',
    'knowledge': 'brain book-open', 'research': 'microscope search', 'analysis': 'chart-column-big', 'analyze': 'chart-column-big',
    'analyzing': 'chart-column-big', 'analytics': 'chart-pie chart-column', 'insight': 'lightbulb', 'insights': 'lightbulb eye',
    'idea': 'lightbulb', 'ideas': 'lightbulb', 'innovation': 'lightbulb rocket', 'creative': 'palette', 'design': 'palette pen-tool',
    'brainstorm': 'lightbulb', 'communication': 'messages-square', 'communications': 'messages-square', 'message': 'message-square',
    'chat': 'message-circle', 'call': 'phone', 'phone': 'phone', 'announcement': 'megaphone', 'marketing': 'megaphone',
    'social media': 'share-2', 'campaign': 'megaphone', 'brand': 'badge', 'sales': 'handshake chart-line', 'negotiation': 'handshake',
    'relationship': 'handshake', 'collaboration': 'users handshake', 'collaborate': 'users', 'share': 'share-2', 'sharing': 'share-2',
    'network': 'network', 'connect': 'link', 'connection': 'link', 'integration': 'plug', 'integrate': 'plug', 'api': 'plug',
    'apis': 'plug', 'web': 'globe', 'website': 'globe', 'internet': 'globe', 'global': 'globe', 'world': 'globe', 'travel': 'plane',
    'location': 'map-pin', 'office': 'building', 'remote': 'house', 'home': 'house', 'health': 'heart-pulse', 'safety': 'hard-hat',
    'wellbeing': 'heart', 'culture': 'heart-handshake', 'ethics': 'scale', 'ethical': 'scale', 'fairness': 'scale', 'bias': 'scale',
    'trust': 'shield-check', 'security': 'shield', 'secure': 'lock', 'protect': 'shield', 'protection': 'shield', 'access': 'key-round',
    'password': 'key-round', 'identity': 'fingerprint', 'permission': 'key-round', 'permissions': 'key-round', 'threat': 'shield-alert',
    'incident': 'siren', 'emergency': 'siren', 'error': 'circle-x', 'errors': 'circle-x', 'mismatch': 'circle-x', 'mismatches': 'circle-x',
    'match': 'check-check', 'matching': 'check-check', 'matches': 'check-check', 'flag': 'flag', 'flags': 'flag', 'alert': 'bell',
    'alerts': 'bell', 'notification': 'bell', 'notifications': 'bell', 'reminder': 'bell-ring', 'reminders': 'bell-ring',
    # data and technology
    'data': 'database', 'data source': 'database', 'data sources': 'database', 'database': 'database', 'databases': 'database',
    'file': 'file', 'files': 'files', 'file-based': 'files', 'csv': 'file-spreadsheet', 'json': 'file-json', 'xml': 'file-code',
    'txt': 'file-text', 'spreadsheet': 'file-spreadsheet sheet', 'spreadsheets': 'file-spreadsheet', 'table': 'table', 'tables': 'table',
    'chart': 'chart-column', 'charts': 'chart-column', 'graph': 'chart-line', 'dashboard': 'layout-dashboard', 'dashboards': 'layout-dashboard',
    'interactive': 'mouse-pointer-click', 'visualization': 'chart-pie', 'visualisation': 'chart-pie', 'output': 'file-output',
    'outputs': 'file-output', 'input': 'file-input', 'inputs': 'file-input', 'storage': 'hard-drive', 'backup': 'archive',
    'archive': 'archive', 'cloud': 'cloud', 'cloud-based': 'cloud', 'server': 'server', 'servers': 'server', 'hardware': 'cpu',
    'software': 'app-window', 'app': 'smartphone', 'apps': 'layout-grid', 'application': 'app-window', 'applications': 'app-window',
    'tool': 'wrench', 'tools': 'wrench', 'platform': 'layers', 'system': 'monitor', 'systems': 'monitor', 'device': 'smartphone',
    'mobile': 'smartphone', 'computer': 'laptop', 'laptop': 'laptop', 'code': 'code-xml', 'coding': 'code-xml', 'script': 'square-code',
    'scripts': 'square-code', 'developer': 'square-terminal', 'programming': 'code-xml', 'test': 'flask-conical', 'testing': 'flask-conical',
    'test case': 'flask-conical', 'test cases': 'flask-conical', 'bug': 'bug', 'debug': 'bug', 'automation': 'bot zap', 'automate': 'bot',
    'automating': 'bot', 'automated': 'bot', 'robot': 'bot', 'bot': 'bot', 'chatbot': 'bot-message-square', 'assistant': 'bot',
    'ai': 'brain-circuit sparkles', 'artificial intelligence': 'brain-circuit', 'genai': 'sparkles', 'generative ai': 'sparkles',
    'generate': 'sparkles wand-sparkles', 'generating': 'sparkles', 'generation': 'sparkles', 'model': 'brain-circuit', 'models': 'brain-circuit',
    'machine learning': 'brain-circuit', 'llm': 'brain-circuit', 'prompt': 'message-square-text terminal', 'prompts': 'message-square-text',
    'prompting': 'message-square-text', 'chain': 'link', 'chaining': 'link', 'linked': 'link', 'reasoning': 'brain', 'thinking': 'brain',
    'thought': 'brain', 'chain-of-thought': 'brain', 'zero-shot': 'zap', 'few-shot': 'copy', 'example': 'copy', 'examples': 'copy',
    'pattern': 'copy', 'search': 'search', 'find': 'search', 'discover': 'compass', 'explore': 'compass', 'translate': 'languages',
    'translation': 'languages', 'language': 'languages', 'speech': 'mic', 'image': 'image', 'images': 'images', 'photo': 'camera',
    'video': 'video', 'audio': 'audio-lines', 'presentation': 'presentation', 'slides': 'presentation', 'slide': 'presentation',
    'upload': 'upload', 'download': 'download', 'sync': 'refresh-cw', 'update': 'refresh-cw', 'updates': 'refresh-cw', 'install': 'download',
    'setup': 'settings', 'settings': 'settings', 'configuration': 'settings-2', 'custom': 'sliders-horizontal', 'personalize': 'user-cog',
    'scale': 'scaling', 'scalable': 'scaling', 'speed up': 'zap', 'clean': 'eraser', 'cleaning': 'eraser', 'transform': 'shuffle',
    'merge': 'merge', 'filter': 'filter', 'sort': 'arrow-down-wide-narrow', 'summarize': 'list-collapse', 'summarise': 'list-collapse',
    'library': 'library-big', 'reusable': 'recycle', 'reuse': 'recycle', 'repeatable': 'repeat', 'one-time': 'circle-dot',
    'internal': 'building', 'framework': 'layers', 'frameworks': 'layers', 'overview': 'layout-grid', 'other data sources': 'plug', 'external': 'globe', 'expectations': 'clipboard-check', 'expectation': 'clipboard-check',
    'requirements': 'clipboard-list', 'requirement': 'clipboard-list', 'promise': 'handshake', 'promises': 'handshake',
    'resources': 'boxes', 'resource': 'boxes', 'information': 'info', 'info': 'info', 'job': 'briefcase', 'work': 'briefcase',
    'career': 'briefcase', 'business': 'briefcase', 'company': 'building-2', 'organization': 'building-2', 'enterprise': 'building-2',
    'erp': 'blocks', 'crm': 'contact', 'hrms': 'id-card', 'sap': 'blocks', 'sql': 'database', 'python': 'code-xml', 'r': 'chart-scatter',
    'web apis': 'plug', 'sharepoint lists': 'list', 'interactive reports': 'chart-column', 'cloud-based services': 'cloud',
    'record-to-report': 'file-chart-column', 'procure-to-pay': 'shopping-cart', 'order-to-cash': 'hand-coins',
}

# Brand names (as written in a point's name) -> (set, icon, colour for one-colour logos)
BRANDS = {
    'excel': ('simple', 'microsoftexcel', '#217346'), 'microsoft excel': ('simple', 'microsoftexcel', '#217346'),
    'word': None, 'microsoft word': ('simple', 'microsoftword', '#2B579A'), 'powerpoint': ('simple', 'microsoftpowerpoint', '#B7472A'),
    'outlook': ('simple', 'microsoftoutlook', '#0078D4'), 'sharepoint': ('simple', 'microsoftsharepoint', '#038387'),
    'onedrive': ('simple', 'microsoftonedrive', '#0078D4'), 'onenote': ('simple', 'microsoftonenote', '#7719AA'),
    'microsoft access': ('simple', 'microsoftaccess', '#A4373A'), 'visio': ('simple', 'microsoftvisio', '#3955A3'),
    'sql server': ('simple', 'microsoftsqlserver', '#CC2927'), 'microsoft 365': ('simple', 'microsoftoffice', '#D83B01'),
    'office 365': ('simple', 'microsoftoffice', '#D83B01'), 'teams': ('logos', 'microsoft-teams', ''), 'microsoft teams': ('logos', 'microsoft-teams', ''),
    'power bi': ('logos', 'microsoft-power-bi', ''), 'powerbi': ('logos', 'microsoft-power-bi', ''), 'azure': ('logos', 'microsoft-azure', ''),
    'aws': ('logos', 'aws', ''), 'amazon s3': ('logos', 'aws-s3', ''), 'aws s3': ('logos', 'aws-s3', ''), 'lambda': ('logos', 'aws-lambda', ''),
    'google analytics': ('logos', 'google-analytics', ''), 'google drive': ('logos', 'google-drive', ''), 'gmail': ('logos', 'google-gmail', ''),
    'google calendar': ('logos', 'google-calendar', ''), 'google cloud': ('logos', 'google-cloud', ''), 'gemini': ('logos', 'google-gemini-icon', ''),
    'google meet': ('logos', 'google-meet', ''), 'google sheets': ('simple', 'googlesheets', '#34A853'), 'google docs': ('simple', 'googledocs', '#4285F4'),
    'salesforce': ('logos', 'salesforce', ''), 'sap': ('logos', 'sap', ''), 'oracle': ('logos', 'oracle', ''), 'mysql': ('logos', 'mysql-icon', ''),
    'postgresql': ('logos', 'postgresql', ''), 'postgres': ('logos', 'postgresql', ''), 'sqlite': ('logos', 'sqlite', ''), 'mongodb': ('logos', 'mongodb-icon', ''),
    'python': ('logos', 'python', ''), 'java': ('logos', 'java', ''), 'javascript': ('logos', 'javascript', ''), 'slack': ('logos', 'slack-icon', ''),
    'jira': ('logos', 'jira', ''), 'confluence': ('logos', 'confluence', ''), 'zoom': ('logos', 'zoom-icon', ''), 'tableau': ('logos', 'tableau-icon', ''),
    'openai': ('logos', 'openai-icon', ''), 'chatgpt': ('logos', 'openai-icon', ''), 'claude': ('logos', 'claude-icon', ''),
    'copilot': ('logos', 'github-copilot', ''), 'github': ('logos', 'github-icon', ''), 'gitlab': ('logos', 'gitlab', ''), 'docker': ('logos', 'docker-icon', ''),
    'kubernetes': ('logos', 'kubernetes', ''), 'whatsapp': ('logos', 'whatsapp-icon', ''), 'linkedin': ('logos', 'linkedin-icon', ''),
    'youtube': ('logos', 'youtube-icon', ''), 'notion': ('logos', 'notion-icon', ''), 'trello': ('logos', 'trello', ''), 'asana': ('logos', 'asana-icon', ''),
    'hubspot': ('logos', 'hubspot', ''), 'shopify': ('logos', 'shopify', ''), 'stripe': ('logos', 'stripe', ''), 'paypal': ('logos', 'paypal', ''),
    'servicenow': ('simple', 'servicenow', '#62D84E'), 'workday': ('simple', 'workday', '#0875E1'), 'snowflake': ('logos', 'snowflake-icon', ''),
    'databricks': ('simple', 'databricks', '#FF3621'), 'power automate': ('simple', 'powerautomate', '#0066FF'), 'power apps': ('simple', 'powerapps', '#742774'),
    'dynamics 365': ('simple', 'dynamics365', '#0B53CE'), 'zendesk': ('logos', 'zendesk-icon', ''), 'dropbox': ('logos', 'dropbox', ''),
    'box': None, 'figma': ('logos', 'figma', ''), 'canva': ('simple', 'canva', '#00C4CC'), 'adobe': ('simple', 'adobe', '#FF0000'),
}


def svg_parts(text):
    """(viewBox, inner markup) of a one-file SVG, without comments and the outer element."""
    text = re.sub(r'<!--.*?-->', '', text, flags=re.S)
    m = re.search(r'<svg\b([^>]*)>(.*)</svg>', text, flags=re.S)
    if not m:
        return None, None
    vb = re.search(r'viewBox="([^"]+)"', m.group(1))
    body = re.sub(r'\s+', ' ', m.group(2)).replace('> <', '><').strip()
    return (vb.group(1) if vb else '0 0 24 24'), body


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=SHARE)
    a = ap.parse_args()
    src = a.src
    tags = json.load(open(os.path.join(src, 'icons', 'tags.json'), encoding='utf-8'))
    icons, names = [], {}
    for fn in sorted(os.listdir(os.path.join(src, 'icons'))):
        if not fn.endswith('.svg'):
            continue
        name = fn[:-4]
        raw = open(os.path.join(src, 'icons', fn), encoding='utf-8').read()
        st = 'tabler' if 'tabler-icons' in raw else 'lucide'
        if st == 'tabler' and (name.endswith('-off') or name.endswith('-filled')):
            continue          # negations and filled duplicates: never the best picture of a point
        vb, body = svg_parts(raw)
        if not body or len(body) > 6000:
            continue
        words = ' '.join([name.replace('-', ' ')] + [t for t in tags.get(name, [])])
        names[name] = len(icons)
        icons.append([name, st, words.lower(), vb, body, 's'])
    # brand logos: colour (logos) or one colour in the product's colour (simple-icons)
    sets = {}
    for key in ('logos', 'simple'):
        fn = 'logos.json' if key == 'logos' else 'simple-icons.json'
        sets[key] = json.load(open(os.path.join(src, 'iconsets', fn), encoding='utf-8'))
    brands, missing = {}, []
    for phrase, v in BRANDS.items():
        if not v:
            continue
        st, nm, colour = v
        d = sets[st]
        ic = d['icons'].get(nm)
        if not ic and nm in (d.get('aliases') or {}):
            ic = d['icons'].get(d['aliases'][nm].get('parent'))
        if not ic:
            missing.append(f'{st}:{nm}')
            continue
        iid = f'{st}-{nm}'
        if iid not in names:
            w, h = ic.get('width', d.get('width', 24)), ic.get('height', d.get('height', 24))
            body = ic['body'].replace('currentColor', colour) if colour else ic['body']
            names[iid] = len(icons)
            icons.append([iid, st, phrase.lower(), f'0 0 {w} {h}', body, 'c'])
        brands[phrase] = iid
    # the maps, with only icons that exist
    def keep(spec, where):
        out = [n for n in spec.split() if n in names]
        if not out:
            missing.append(f'{where}: {spec}')
        return out
    concept = {k: keep(v, 'concept ' + k) for k, v in CONCEPT.items()}
    words = {k: keep(v, 'word ' + k) for k, v in WORDS.items()}
    lib = {'version': 1, 'made': 'deploy/make-iconlib.py',
           'sets': {'lucide': 'Lucide (ISC licence)', 'tabler': 'Tabler Icons (MIT licence)',
                    'logos': 'SVG Logos by Gil Barbara (CC0; the logos are trademarks of their owners)',
                    'simple': 'Simple Icons (CC0; the logos are trademarks of their owners)'},
           'concept': {k: v for k, v in concept.items() if v}, 'words': {k: v for k, v in words.items() if v},
           'brands': brands, 'icons': icons}
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'iconlib.json'), 'w', encoding='utf-8') as f:
        json.dump(lib, f, ensure_ascii=False, separators=(',', ':'))
    lic = os.path.join(OUT, 'LICENSES.txt')
    with open(lic, 'w', encoding='utf-8') as f:
        f.write('Icons in iconlib.json (from the team asset share, ' + src + '):\n')
        for v in lib['sets'].values():
            f.write(' - ' + v + '\n')
        for fn in ('LICENSE-lucide.txt', 'LICENSE-tabler.txt'):
            p = os.path.join(src, 'icons', fn)
            if os.path.exists(p):
                f.write('\n==== ' + fn + '\n' + open(p, encoding='utf-8', errors='replace').read())
    size = os.path.getsize(os.path.join(OUT, 'iconlib.json'))
    print(f'{len(icons)} icons ({sum(1 for i in icons if i[1] == "lucide")} Lucide, {sum(1 for i in icons if i[1] == "tabler")} Tabler, '
          f'{len(brands)} brand names), {size / 1e6:.2f} MB')
    if missing:
        print('not in the library (left out of the maps):', '; '.join(missing))


if __name__ == '__main__':
    sys.exit(main())
