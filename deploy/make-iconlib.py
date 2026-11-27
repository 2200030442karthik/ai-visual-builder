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


# 10.28: the colour icons of every outline icon the matcher uses, best first.
#   F:<name>  icons_fluent\<name>.svg       Microsoft Fluent colour icons with soft gradients (MIT)
#   E:<name>  iconsets\fluent-emoji-flat    Microsoft Fluent flat colour icons (MIT)
#   C:<name>  iconsets\flat-color-icons     flat colour business icons (MIT)
# The matcher still decides what a point means (outline names, tags, vocabulary); the colour icon is its picture.
COLOR = {
    'accessibility': 'E:wheelchair-symbol', 'activity': 'F:chart_increasing C:line-chart', 'adjustments': 'E:level-slider E:control-knobs',
    'alarm-clock': 'F:alarm_clock', 'alert-octagon': 'F:stop_sign', 'alert-triangle': 'F:warning', 'align-center-vertical': 'F:compass F:bullseye',
    'app-window': 'E:window C:template', 'archive': 'E:card-file-box F:file_cabinet', 'arrow-down-wide-narrow': 'C:generic-sorting-desc',
    'audio-lines': 'E:studio-microphone C:audio-file', 'award': 'F:sports_medal E:rosette', 'badge': 'E:name-badge E:rosette',
    'badge-check': 'F:check_mark_button C:approval', 'badge-dollar-sign': 'F:money_bag E:heavy-dollar-sign', 'bell': 'F:bell', 'bell-ring': 'F:bell',
    'blocks': 'F:puzzle_piece E:brick', 'book-open': 'F:open_book', 'book-open-text': 'F:open_book F:books', 'bookmark': 'F:bookmark_tabs E:bookmark',
    'bot': 'F:robot', 'bot-message-square': 'F:robot C:assistant', 'boxes': 'F:package E:card-file-box', 'brain': 'F:brain',
    'brain-circuit': 'F:brain F:robot', 'briefcase': 'E:briefcase C:briefcase', 'browser': 'E:window F:globe_with_meridians',
    'building': 'F:office_building', 'building-2': 'F:office_building E:department-store', 'building-bank': 'E:bank E:classical-building',
    'bulb': 'F:light_bulb', 'calculator': 'C:calculator E:abacus', 'calendar': 'F:spiral_calendar F:calendar',
    'calendar-clock': 'F:calendar F:alarm_clock', 'calendar-range': 'F:spiral_calendar C:timeline', 'camera': 'E:camera C:camera',
    'car': 'E:automobile', 'chart-column': 'F:bar_chart', 'chart-column-big': 'F:bar_chart C:statistics', 'chart-line': 'F:chart_increasing C:line-chart',
    'chart-no-axes-combined': 'F:chart_increasing C:combo-chart', 'chart-pie': 'C:pie-chart C:doughnut-chart', 'chart-scatter': 'C:scatter-plot',
    'chart-spline': 'F:chart_increasing C:area-chart', 'check-check': 'F:check_mark_button C:checkmark', 'chess-knight': 'E:chess-pawn',
    'circle-alert': 'F:warning E:red-exclamation-mark', 'circle-check': 'F:check_mark_button', 'circle-dot': 'F:bullseye E:radio-button',
    'circle-help': 'E:red-question-mark C:questions', 'circle-x': 'F:cross_mark', 'clipboard-check': 'F:clipboard C:inspection',
    'clipboard-list': 'F:clipboard C:todo-list', 'clipboard-pen': 'F:clipboard F:memo', 'clock': 'F:stopwatch C:clock', 'cloud': 'F:cloud',
    'code': 'C:command-line F:laptop', 'code-xml': 'C:command-line F:laptop', 'coins': 'E:coin F:money_bag', 'compass': 'F:compass',
    'contact': 'C:business-contact C:contacts', 'copy': 'E:card-index F:card_index_dividers', 'cpu': 'C:electronics C:circuit',
    'credit-card': 'E:credit-card', 'crosshair': 'F:bullseye', 'crown': 'E:crown', 'database': 'C:database', 'download': 'C:download E:inbox-tray',
    'earth': 'E:globe-showing-europe-africa F:globe_with_meridians', 'eraser': 'E:broom C:clear-filters', 'eye': 'F:eyes E:eye',
    'eye-off': 'C:privacy', 'factory': 'E:factory C:factory', 'file': 'F:page_facing_up C:file', 'file-chart-column': 'C:data-sheet F:bar_chart',
    'file-code': 'C:command-line F:page_facing_up', 'file-input': 'C:import E:inbox-tray', 'file-json': 'C:data-sheet F:page_facing_up',
    'file-lock': 'E:locked-with-pen C:data-encryption', 'file-output': 'C:export E:outbox-tray', 'file-pen': 'F:memo',
    'file-pen-line': 'F:memo E:fountain-pen', 'file-question': 'C:faq E:red-question-mark', 'file-search': 'F:magnifying_glass_tilted_left C:search',
    'file-spreadsheet': 'C:data-sheet', 'file-text': 'F:page_facing_up F:memo', 'files': 'F:card_index_dividers C:document', 'filter': 'C:filled-filter',
    'flag': 'F:triangular_flag F:chequered_flag', 'flask-conical': 'F:test_tube E:alembic', 'folder': 'E:file-folder C:folder',
    'folder-kanban': 'E:open-file-folder C:opened-folder', 'funnel': 'C:filled-filter', 'gauge': 'C:sales-performance F:stopwatch', 'gem': 'E:gem-stone',
    'gift': 'E:wrapped-gift', 'git-compare': 'F:balance_scale E:left-right-arrow', 'git-fork': 'C:make-decision C:decision',
    'globe': 'F:globe_with_meridians', 'graduation-cap': 'F:graduation_cap', 'hand-coins': 'F:money_bag E:money-with-wings', 'handshake': 'F:handshake',
    'hard-drive': 'E:computer-disk C:data-backup', 'hard-hat': 'E:rescue-workers-helmet', 'headset': 'C:customer-support E:headphone',
    'heart': 'F:red_heart', 'heart-handshake': 'F:handshake F:red_heart', 'heart-pulse': 'E:anatomical-heart E:stethoscope',
    'help-circle': 'E:red-question-mark', 'history': 'F:hourglass_done', 'house': 'F:house', 'id-card': 'E:identification-card E:name-badge',
    'image': 'E:framed-picture C:picture', 'images': 'C:stack-of-photos E:framed-picture', 'inbox': 'E:inbox-tray', 'info': 'E:information C:info',
    'key-round': 'F:key', 'landmark': 'E:classical-building E:bank', 'languages': 'F:globe_with_meridians F:speech_balloon', 'laptop': 'F:laptop',
    'layers': 'F:bookmark_tabs F:card_index_dividers', 'layout-dashboard': 'C:combo-chart F:desktop_computer', 'layout-grid': 'E:card-index C:grid',
    'layout-template': 'C:template', 'library-big': 'F:books C:library', 'life-buoy': 'E:ring-buoy', 'lightbulb': 'F:light_bulb', 'link': 'F:link',
    'list': 'C:list C:todo-list', 'list-checks': 'C:todo-list E:check-box-with-check', 'list-collapse': 'F:memo', 'list-ordered': 'C:list C:numerical-sorting-12',
    'list-todo': 'C:todo-list', 'lock': 'F:locked', 'mail': 'E:e-mail E:envelope-with-arrow F:envelope', 'map': 'F:world_map', 'map-pin': 'F:pushpin E:round-pushpin',
    'maximize-2': 'C:expand', 'megaphone': 'F:megaphone', 'merge': 'C:multiple-inputs', 'message-circle': 'F:speech_balloon',
    'message-square': 'F:speech_balloon', 'message-square-text': 'F:speech_balloon C:comments', 'messages': 'C:comments F:speech_balloon',
    'messages-square': 'C:comments', 'mic': 'E:studio-microphone E:microphone', 'microscope': 'F:microscope', 'milestone': 'F:chequered_flag F:triangular_flag',
    'minimize-2': 'C:collapse', 'monitor': 'F:desktop_computer', 'monitor-check': 'F:desktop_computer', 'mouse-pointer-click': 'F:computer_mouse C:cursor',
    'music': 'E:musical-notes', 'network': 'C:multiple-devices C:mind-map', 'notebook': 'E:notebook E:spiral-notepad', 'notebook-pen': 'E:spiral-notepad F:memo',
    'package': 'F:package', 'package-check': 'F:package C:shipped', 'palette': 'E:artist-palette', 'pen-line': 'F:pencil E:fountain-pen',
    'pen-tool': 'E:fountain-pen F:pencil', 'pencil': 'F:pencil', 'percent': 'C:pie-chart', 'phone': 'E:telephone-receiver C:phone',
    'piggy-bank': 'F:money_bag', 'plane': 'E:airplane', 'plug': 'E:electric-plug', 'presentation': 'C:podium-with-speaker C:voice-presentation',
    'printer': 'E:printer', 'puzzle': 'F:puzzle_piece', 'radar': 'E:satellite-antenna C:radar-plot', 'receipt': 'E:receipt', 'receipt-text': 'E:receipt',
    'recycle': 'E:recycling-symbol C:reuse', 'refresh-cw': 'F:counterclockwise_arrows_button C:synchronize', 'repeat': 'E:repeat-button F:counterclockwise_arrows_button',
    'rocket': 'F:rocket', 'route': 'E:motorway F:world_map', 'ruler': 'E:straight-ruler E:triangular-ruler', 'save': 'E:floppy-disk', 'scale': 'F:balance_scale',
    'scaling': 'C:expand', 'scan': 'E:x-ray', 'scan-line': 'E:x-ray', 'school': 'E:school', 'scissors': 'E:scissors', 'scroll-text': 'E:scroll',
    'search': 'F:magnifying_glass_tilted_left', 'server': 'C:data-configuration C:database', 'settings': 'F:gear', 'settings-2': 'F:gear E:control-knobs',
    'shapes': 'E:large-orange-diamond', 'share-2': 'C:share', 'sheet': 'C:data-sheet', 'shield': 'F:shield', 'shield-alert': 'F:shield F:warning',
    'shield-check': 'F:shield C:data-protection', 'shopping-bag': 'E:shopping-bags', 'shopping-cart': 'E:shopping-cart', 'shrink': 'C:collapse',
    'shuffle': 'E:shuffle-tracks-button', 'signature': 'C:signature E:fountain-pen', 'siren': 'F:warning', 'sliders-horizontal': 'E:level-slider E:control-knobs',
    'smartphone': 'F:mobile_phone', 'soup': 'E:steaming-bowl', 'sparkles': 'F:sparkles', 'split': 'C:make-decision', 'square-code': 'C:command-line',
    'square-terminal': 'C:command-line', 'terminal': 'C:command-line', 'stamp': 'C:approval', 'star': 'F:star', 'stethoscope': 'E:stethoscope',
    'store': 'E:convenience-store C:shop', 'table': 'C:data-sheet C:grid', 'tag': 'E:label', 'target': 'F:bullseye', 'trending-down': 'F:chart_decreasing C:negative-dynamic',
    'trending-up': 'F:chart_increasing C:positive-dynamic', 'triangle-alert': 'F:warning', 'trophy': 'F:trophy', 'truck': 'E:delivery-truck', 'type': 'F:memo',
    'upload': 'C:upload E:outbox-tray', 'user': 'C:businessman C:businesswoman', 'user-check': 'C:businessman C:approval', 'user-cog': 'C:manager C:businessman',
    'user-plus': 'C:invite C:businessman', 'user-round': 'C:businesswoman C:businessman', 'user-search': 'C:conference-call C:businessman',
    'user-star': 'E:crown C:vip', 'users': 'C:conference-call C:collaboration', 'users-round': 'C:collaboration C:conference-call',
    'utensils': 'E:fork-and-knife-with-plate', 'video': 'E:video-camera C:video-call', 'wallet': 'E:money-with-wings F:money_bag', 'wand-sparkles': 'E:magic-wand',
    'warehouse': 'F:package C:in-transit', 'workflow': 'C:workflow C:flow-chart', 'wrench': 'F:wrench F:hammer_and_wrench', 'zap': 'F:high_voltage',
    'fingerprint': 'C:privacy F:key',
}
# colour icons that may also match a point by their own names (professional objects; no faces, food, animals, flags)
COLOR_EXTRA = ('E:airplane E:ambulance E:hospital E:pill E:syringe E:dna E:atom-symbol E:satellite E:telescope E:toolbox E:magnet E:battery '
               'E:thermometer E:hammer E:nut-and-bolt E:gear E:hourglass-not-done E:newspaper E:ledger E:spiral-notepad E:paintbrush E:crayon '
               'E:loudspeaker E:television E:radio E:keyboard E:printer E:fax-machine E:satellite-antenna E:mechanical-arm E:construction '
               'E:building-construction E:bridge-at-night E:cityscape E:houses E:stadium E:school E:post-office E:passport-control E:customs '
               'E:ticket E:admission-tickets E:luggage E:fuel-pump E:light-rail E:bus E:ship E:delivery-truck E:articulated-lorry E:tractor '
               'E:seedling E:potted-plant E:deciduous-tree E:sun E:fire E:droplet E:water-wave E:recycling-symbol E:balance-scale E:judge '
               'E:teacher E:student E:scientist E:technologist E:office-worker E:health-worker E:mechanic E:farmer E:factory-worker E:artist '
               'E:detective E:guard E:pilot E:astronaut E:police-officer E:firefighter E:construction-worker E:cook E:singer '
               'E:1st-place-medal E:military-medal E:ribbon E:rosette E:bookmark E:label E:pushpin E:paperclip E:linked-paperclips E:scissors '
               'E:straight-ruler E:triangular-ruler E:abacus E:bank E:dollar-banknote E:euro-banknote E:pound-banknote E:yen-banknote E:coin '
               'E:gem-stone E:crystal-ball E:magic-wand E:game-die E:joystick E:video-game E:jigsaw E:mobile-phone-with-arrow E:envelope-with-arrow '
               'E:incoming-envelope E:outbox-tray E:inbox-tray E:open-mailbox-with-raised-flag E:postbox E:card-file-box E:file-cabinet E:wastebasket '
               'E:locked-with-key E:unlocked E:old-key E:shield E:chains E:broken-chain E:link E:hook E:ladder E:microscope E:petri-dish E:test-tube '
               'E:alembic E:stethoscope E:adhesive-bandage E:x-ray E:lungs E:brain E:anatomical-heart E:eyes E:footprints E:hundred-points '
               'E:speech-balloon E:thought-balloon E:left-speech-bubble E:speaking-head E:bust-in-silhouette E:busts-in-silhouette E:name-badge '
               'E:identification-card E:mantelpiece-clock E:watch E:timer-clock E:stopwatch E:alarm-clock E:hourglass-done E:spiral-calendar '
               'E:tear-off-calendar E:calendar E:world-map E:compass E:globe-with-meridians E:round-pushpin E:triangular-flag E:chequered-flag '
               'E:direct-hit E:bullseye E:trophy E:sports-medal E:party-popper E:confetti-ball E:wrapped-gift E:balloon E:light-bulb E:flashlight '
               'E:candle E:high-voltage E:electric-plug E:battery E:low-battery E:desktop-computer E:laptop E:computer-mouse E:trackball '
               'E:computer-disk E:floppy-disk E:optical-disk E:dvd E:movie-camera E:film-projector E:clapper-board E:camera E:video-camera '
               'E:studio-microphone E:microphone E:headphone E:musical-notes E:artist-palette E:framed-picture E:books E:open-book E:closed-book '
               'E:notebook E:page-facing-up E:page-with-curl E:scroll E:memo E:pencil E:fountain-pen E:pen E:clipboard E:bar-chart '
               'E:chart-increasing E:chart-decreasing E:money-bag E:money-with-wings E:credit-card E:receipt E:shopping-cart E:shopping-bags '
               'E:package E:convenience-store E:department-store E:office-building E:classical-building E:factory E:house E:robot E:rocket '
               'E:satellite E:handshake E:wrench E:hammer-and-wrench E:gear E:puzzle-piece E:star E:glowing-star E:sparkles E:warning E:no-entry '
               'E:prohibited E:check-mark-button E:cross-mark E:red-question-mark E:information E:locked E:key E:bell E:megaphone E:envelope E:e-mail')
FC_SKIP = set('android-os bbc debian dribbble google linux reddit steam stumbleupon wikipedia vlc kindle nook ipad iphone cd-logo dvd-logo '
              'icons8-cup entering-heaven-alive do-not-inhale do-not-insert do-not-mix biohazard butting-in copyleft'.split())


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
    # 10.28: colour icons (Fluent with gradients, Fluent flat, flat business icons) and the outline -> colour map
    fe = json.load(open(os.path.join(src, 'iconsets', 'fluent-emoji-flat.json'), encoding='utf-8'))
    fc = json.load(open(os.path.join(src, 'iconsets', 'flat-color-icons.json'), encoding='utf-8'))
    f3dir = os.path.join(src, 'icons_fluent')

    def colour(ref):
        """the library id of a colour icon (added on first use), or None when the share does not have it"""
        kind, nm = ref.split(':', 1)
        iid = {'F': 'fl-', 'E': 'fe-', 'C': 'fc-'}[kind] + nm.replace('_', '-')
        if iid in names:
            return iid
        if kind == 'F':
            p = os.path.join(f3dir, nm + '.svg')
            if not os.path.exists(p):
                return None
            vb, body = svg_parts(open(p, encoding='utf-8').read())
            st = 'fluent3d'
        else:
            d = fe if kind == 'E' else fc
            ic = d['icons'].get(nm)
            if not ic or (kind == 'C' and nm in FC_SKIP):
                return None
            w, h = ic.get('width', d.get('width', 32)), ic.get('height', d.get('height', 32))
            vb, body = f'0 0 {w} {h}', re.sub(r'\s+', ' ', ic['body'])
            st = 'fluent' if kind == 'E' else 'flatcolor'
        if not body:
            return None
        names[iid] = len(icons)
        icons.append([iid, st, nm.replace('_', ' ').replace('-', ' ').lower(), vb, body, 'c'])
        return iid

    color, cmiss = {}, []
    for outline, spec in COLOR.items():
        got = [i for i in (colour(r) for r in spec.split()) if i]
        if got and outline in names:
            color[outline] = got
        else:
            cmiss.append(outline if outline not in names else spec)
    for r in COLOR_EXTRA.split():
        colour(r)
    for nm in fc['icons']:
        colour('C:' + nm)
    for fn in os.listdir(f3dir):
        if fn.endswith('.svg'):
            colour('F:' + fn[:-4])
    if cmiss:
        print('colour map entries left out:', '; '.join(cmiss))
    # the maps, with only icons that exist
    def keep(spec, where):
        out = [n for n in spec.split() if n in names]
        if not out:
            missing.append(f'{where}: {spec}')
        return out
    concept = {k: keep(v, 'concept ' + k) for k, v in CONCEPT.items()}
    words = {k: keep(v, 'word ' + k) for k, v in WORDS.items()}
    lib = {'version': 2, 'made': 'deploy/make-iconlib.py', 'color': color,
           'sets': {'lucide': 'Lucide (ISC licence)', 'tabler': 'Tabler Icons (MIT licence)',
                    'fluent3d': 'Microsoft Fluent colour icons (MIT licence)', 'fluent': 'Microsoft Fluent Emoji, flat (MIT licence)',
                    'flatcolor': 'Flat Color Icons by Icons8 (MIT licence)',
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
          f'{sum(1 for i in icons if i[1] in ("fluent3d", "fluent", "flatcolor"))} colour, {len(brands)} brand names; '
          f'{len(color)} outline icons have colour versions), {size / 1e6:.2f} MB')
    if missing:
        print('not in the library (left out of the maps):', '; '.join(missing))


if __name__ == '__main__':
    sys.exit(main())
