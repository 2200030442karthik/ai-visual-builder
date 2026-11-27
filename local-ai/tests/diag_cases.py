"""Napkin fixture cases for run_diag.py (the real requests' texts from samples.js)."""
import json, sys
CASES = [{'name': 'edu4', 'sample': 'Educational content', 'fmt': 'svg', 'files': [f'napkin-edu-{i}.svg' for i in range(4)]},
         {'name': 'eduSvg1', 'sample': 'Educational content', 'fmt': 'svg', 'files': ['napkin-edu-svg7-synthetic.svg']},
         {'name': 'auto4', 'sample': 'Automation validation report', 'fmt': 'svg', 'files': [f'napkin-autoval-{i}.svg' for i in range(4)]},
         {'name': 'facts4', 'sample': 'Quick facts', 'fmt': 'svg', 'files': [f'napkin-facts-{i}.svg' for i in range(4)]},
         {'name': 'genai', 'text': 'Generative AI\nGenerative AI can create new content such as text, images, music, videos, and computer code when you ask it to.', 'fmt': 'ppt', 'files': ['napkin-genai.pptx']},
         {'name': 'claudeDE4', 'sample': 'Data engineering platform (8 concepts)', 'fmt': 'svg', 'files': [f'claude-dataeng-{i}.svg' for i in range(4)]},
         {'name': 'ml5', 'sample': 'ML workflow (5 stages, intro)', 'fmt': 'svg', 'files': ['napkin-ml5.svg']}]
if __name__ == '__main__':
    want = sys.argv[1].split(',') if len(sys.argv) > 1 else None
    print(json.dumps([c for c in CASES if not want or c['name'] in want]))
