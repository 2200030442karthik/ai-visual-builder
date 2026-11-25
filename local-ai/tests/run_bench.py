"""Visual-quality benchmark (V10.16): the same example texts through Generate and "More visuals", measured
(tests/bench.js) and rendered as contact sheets, optionally next to an older version for a before/after comparison.
No network, no credits: the AI services are off and the stand-in PowerPoint is used.

Usage:  python tests/run_bench.py [--before GIT_REF] [--out DIR]
  --before  also run the benchmark on that commit (checked out into a temporary git worktree, removed afterwards)
  --out     where the results go (default tests/evidence/v10.19-bench): <example>.png contact sheets,
            summary.json (every measurement) and summary.md (the table)

Automated numbers are not proof of visual quality: the contact sheets are the evidence to look at.
"""
import argparse, html, json, os, pathlib, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
from edge_cdp import EDGE  # noqa: E402

NAMES = {'genai': 'Generative AI (one sentence, list between dashes)', 'ai': 'Artificial Intelligence slide (title, subtitle, one sentence)', 'claude': 'Claude AI (one statement)', 'aiml': 'AI & ML (What you learn / Best for)', 'dm': 'Digital Marketing (topics and outcomes)',
         'cloud': 'Cloud computing (a paragraph of four sentences)', 'dslife': 'Data science lifecycle (eight labelled points)', 'k8s': 'Kubernetes (one statement)',
         'lvcShort': 'LVC short: three benefits', 'lvcLong': 'LVC long: a paragraph on three kinds of ML', 'lvcStructured': 'LVC structured: course sections',
         'lvcCompare': 'LVC comparison: SQL vs NoSQL', 'lvcDense': 'LVC dense: ten numbered points with descriptions', 'lvcCycle': 'LVC cycle: the sprint cycle',
         'lvcLoops': 'LVC loops: kinds of Python loops (not a cycle)'}


def run(probe_py, svg_dir):
    env = dict(os.environ, AIVB_PROBE_FULL='1')
    r = subprocess.run([sys.executable, probe_py, os.path.join(HERE, 'bench.js'), svg_dir], capture_output=True, text=True, encoding='utf-8', env=env, timeout=900)
    txt = r.stdout.strip()
    try:
        res = json.loads(txt)
    except ValueError:
        raise SystemExit('benchmark failed:\n' + txt[-2000:] + r.stderr[-2000:])
    if 'error' in res:
        raise SystemExit('benchmark failed: ' + res['error'])
    return res['out']


def sheet(out_dir, key, runs):
    """One HTML page per example: a row of thumbnails per version, each named with its measurements."""
    parts = [f'<h1>{html.escape(NAMES.get(key, key))}</h1>']
    for label, (res, svg_dir) in runs.items():
        ex = res[key]
        parts.append(f'<h2>{html.escape(label)}: {ex["generate"]} designs, +{ex["more"]} from More visuals &middot; {ex["categories"]} categories &middot; '
                     f'{ex["lookAlikePairs"]} look-alike pairs &middot; {ex["familyRepeats"]} repeated families</h2><div class="g">')
        for i, dsg in enumerate(ex['designs']):
            name = f'{key}-{i:02d}' + ('-more' if i >= ex['generate'] else '') + '.svg'
            p = os.path.join(svg_dir, name)
            svg = open(p, encoding='utf-8').read() if os.path.exists(p) else ''
            flags = ([f'missing: {", ".join(dsg["missing"])}'] if dsg['missing'] else []) + (['text only'] if not dsg['objects'] else []) + \
                    ([f'{dsg["issues"]} layout issue(s)'] if dsg['issues'] > 0 else []) + (['More visuals'] if i >= ex['generate'] else [])
            parts.append(f'<figure><div class="t">{svg}</div><figcaption><b>{i + 1}. {html.escape(dsg["name"])}</b> &middot; {html.escape(dsg["category"])} &middot; '
                         f'{dsg["objects"]} objects' + (f'<br><span class="w">{html.escape("; ".join(flags))}</span>' if flags else '') + '</figcaption></figure>')
        parts.append('</div>')
    n = max(len(r[0][key]['designs']) for r in runs.values())
    page = ('<!doctype html><meta charset="utf-8"><style>body{font-family:Segoe UI,sans-serif;margin:16px;background:#fff;color:#222}'
            'h1{font-size:22px;margin:0 0 6px}h2{font-size:16px;margin:14px 0 6px;color:#333}.g{display:grid;grid-template-columns:repeat(5,320px);gap:10px}'
            'figure{margin:0;border:1px solid #ddd;border-radius:6px;padding:4px}.t svg{width:310px;height:174px;display:block}'
            'figcaption{font-size:12px;line-height:1.3}.w{color:#b00}</style>' + ''.join(parts))
    hp = os.path.join(out_dir, key + '.html')
    open(hp, 'w', encoding='utf-8').write(page)
    rows = sum((len(r[0][key]['designs']) + 4) // 5 for r in runs.values())
    subprocess.run([EDGE, '--headless=new', '--disable-gpu', '--hide-scrollbars', f'--screenshot={os.path.join(out_dir, key + ".png")}',
                    f'--window-size=1700,{120 + rows * 232 + len(runs) * 40}', pathlib.Path(hp).resolve().as_uri()], capture_output=True, timeout=120)
    os.remove(hp)


def summary(runs):
    lines = ['| Example | Version | Designs (Generate + More) | Generate (ms) | Categories | Look-alike pairs | Repeated families | Text-only designs | Designs missing a fact | Layout issues | Smallest text (pt) | Cycle designs in top 3 | Top 3 |',
             '|---|---|---|---|---|---|---|---|---|---|---|---|---|']
    for key in NAMES:
        for label, (res, _) in runs.items():
            if key not in res:
                continue
            ex, D = res[key], res[key]['designs']
            lines.append(f'| {NAMES[key]} | {label} | {ex["generate"]} + {ex["more"]} | {ex.get("genMs", "")} | {ex["categories"]} | {ex["lookAlikePairs"]} | {ex["familyRepeats"]} | '
                         f'{sum(1 for x in D if not x["objects"])} | {sum(1 for x in D if x["missing"])} | {sum(1 for x in D if x["issues"] > 0)} | '
                         f'{min([x["minPt"] for x in D] or [0])} | {ex.get("cycleTop3", "")} | {", ".join(ex.get("top3", []))} |')
    return '\n'.join(lines) + '\n'


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    ap = argparse.ArgumentParser()
    ap.add_argument('--before')
    ap.add_argument('--out', default=os.path.join(HERE, 'evidence', 'v10.19-bench'))
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix='aivb-bench-')
    runs = {}
    try:
        if a.before:
            wt = os.path.join(tmp, 'before')
            subprocess.run(['git', '-C', ROOT, 'worktree', 'add', '--detach', wt, a.before], check=True, capture_output=True)
            # this version's probe runner (full output) serving the older version's panel
            shutil.copy(os.path.join(HERE, 'run_probe.py'), os.path.join(wt, 'local-ai', 'tests', 'run_probe.py'))
            try:
                runs[f'Before ({a.before})'] = (run(os.path.join(wt, 'local-ai', 'tests', 'run_probe.py'), os.path.join(tmp, 'svg-before')), os.path.join(tmp, 'svg-before'))
            finally:
                subprocess.run(['git', '-C', ROOT, 'worktree', 'remove', '--force', wt], capture_output=True)
        runs['After (this version)'] = (run(os.path.join(HERE, 'run_probe.py'), os.path.join(tmp, 'svg-after')), os.path.join(tmp, 'svg-after'))
        for key in NAMES:
            sheet(a.out, key, runs)
        json.dump({k: v[0] for k, v in runs.items()}, open(os.path.join(a.out, 'summary.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
        md = summary(runs)
        open(os.path.join(a.out, 'summary.md'), 'w', encoding='utf-8').write(md)
        print(md)
        print('Contact sheets:', ', '.join(os.path.join(a.out, k + '.png') for k in NAMES))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
