"""AI Visual Builder (team installation): starts the panel host (server.py) with the bundled Python runtime.

Reads pilot.json next to this file (written by Install.ps1): the data folder (certificate, keys, usage, log), this
user's access policy, and that activation is required (server.py serves nothing until this Windows user on this PC is
activated; activation.py). Nothing else differs from the desktop version: the same server.py, panel, packs and checks.
"""
import json
import os
import runpy
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(HERE, 'pilot.json'), encoding='utf-8') as f:
    PILOT = json.load(f)

os.environ.pop('AIVB_HOSTED', None)                 # always the local (single-PC) mode
os.environ.pop('ANTHROPIC_API_KEY', None)           # only the keys unlocked by activation are used
os.environ['AIVB_DATA_DIR'] = PILOT['data_dir']
if PILOT.get('access_path'):
    os.environ['AIVB_ACCESS'] = PILOT['access_path']
if PILOT.get('activation'):
    os.environ['AIVB_ACTIVATION'] = '1'
if PILOT.get('slsd_unify'):                         # one SL Smart Design tab (slsd_tab.py; only while PowerPoint is closed)
    os.environ['AIVB_SLSD_UNIFY'] = '1'
os.makedirs(PILOT['data_dir'], exist_ok=True)

if sys.stdout is None or sys.stderr is None:      # pythonw.exe has no console: log to the data folder
    log = open(os.path.join(PILOT['data_dir'], 'server.log'), 'a', encoding='utf-8', buffering=1)
    sys.stdout = sys.stdout or log
    sys.stderr = sys.stderr or log

os.chdir(HERE)
sys.path.insert(0, HERE)
sys.argv = [os.path.join(HERE, 'server.py')] + sys.argv[1:]
runpy.run_path(sys.argv[0], run_name='__main__')
