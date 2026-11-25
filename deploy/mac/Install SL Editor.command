#!/bin/bash
# SL Editor for Mac (10.26) - double-click to install, for this Mac user. No administrator rights.
#   1. checks PowerPoint is closed and Python 3 is there (macOS offers to install it once if not)
#   2. copies SL Editor to ~/Library/Application Support/SL Editor and installs Claude's SDK for it
#   3. a certificate for https://localhost, trusted in your login keychain (macOS asks for your password once)
#   4. the SL Editor service, started now and at every log-in (LaunchAgent)
#   5. SL Editor in PowerPoint (the documented Mac sideload folder) and the company add-ins in PowerPoint's add-in folder
# Remove it again with "Uninstall SL Editor.command".
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
PAY="$HERE/payload"
ROOT="$HOME/Library/Application Support/SL Editor"
DATA="$HOME/Library/Application Support/AIVisualBuilder"
WEF="$HOME/Library/Containers/com.microsoft.Powerpoint/Data/Documents/wef"
ADDINS="$HOME/Library/Group Containers/UBF8T346G9.Office/User Content.localized/Add-Ins.localized"
AGENT="$HOME/Library/LaunchAgents/com.simplilearn.sleditor.plist"
PORT=44317
LOG="$DATA/install.log"

msg() { osascript -e "display dialog \"$1\" buttons {\"OK\"} default button 1 with title \"SL Editor\" with icon note" >/dev/null 2>&1 || echo "$1"; }
fail() { osascript -e "display dialog \"$1\" buttons {\"OK\"} default button 1 with title \"SL Editor\" with icon stop" >/dev/null 2>&1 || echo "$1"; exit 1; }
ask() { osascript -e "button returned of (display dialog \"$1\" buttons {\"Cancel\", \"$2\"} default button 2 with title \"SL Editor\")" 2>/dev/null; }

[ "$(uname)" = "Darwin" ] || fail "This installer is for a Mac."
[ -d "$PAY/app" ] || fail "The installer is incomplete: keep the payload folder next to this file (unzip the whole SL-Editor-Mac.zip)."
mkdir -p "$DATA"; : > "$LOG"
echo "SL Editor for Mac: installing..."

# 1. PowerPoint closed (it reads its add-ins at start)
while pgrep -x "Microsoft PowerPoint" >/dev/null 2>&1; do
  [ "$(ask "Please quit PowerPoint (save your work first), then click Continue." "Continue")" = "Continue" ] || exit 1
done

# Python 3.9 or later: python.org, Homebrew, or Apple's command line tools
PY=""
for p in /Library/Frameworks/Python.framework/Versions/Current/bin/python3 /opt/homebrew/bin/python3 /usr/local/bin/python3 /usr/bin/python3; do
  [ -x "$p" ] || continue
  if [ "$p" = /usr/bin/python3 ] && ! xcode-select -p >/dev/null 2>&1; then continue; fi    # Apple's stub: tools not installed
  if "$p" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)' >/dev/null 2>&1; then PY="$p"; break; fi
done
if [ -z "$PY" ]; then
  xcode-select --install >/dev/null 2>&1 || true
  fail "SL Editor needs Python 3, which macOS installs with its free command line tools. A window to install them has opened (or install Python from python.org). When it has finished, double-click Install SL Editor again."
fi
echo "Python: $PY ($("$PY" -V 2>&1))" >>"$LOG"

# 2. the app (a fresh copy; the activation and settings in $DATA are kept)
launchctl unload "$AGENT" >/dev/null 2>&1 || true
pkill -f "$ROOT/app/run_server.pyw" >/dev/null 2>&1 || true
rm -rf "$ROOT/app"; mkdir -p "$ROOT"
cp -R "$PAY/app" "$ROOT/app" || fail "SL Editor could not be copied to $ROOT."
xattr -dr com.apple.quarantine "$ROOT" >/dev/null 2>&1 || true
echo "Installing Claude's SDK for SL Editor (needs the internet; about a minute)..."
if ! "$PY" -m pip install --quiet --disable-pip-version-check --upgrade --target "$ROOT/site" "anthropic>=0.40" >>"$LOG" 2>&1; then
  msg "Claude's SDK could not be installed (no internet?). SL Editor works with its built-in designs; run the installer again later for Claude's designs."
fi

# 3. certificate for https://localhost (Office loads add-ins only over HTTPS)
if [ ! -f "$DATA/cert.pem" ] || [ ! -f "$DATA/key.pem" ]; then
  openssl req -x509 -newkey rsa:2048 -nodes -days 730 -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" -addext "extendedKeyUsage=serverAuth" \
    -keyout "$DATA/key.pem" -out "$DATA/cert.pem" >>"$LOG" 2>&1 || fail "The certificate for https://localhost could not be made."
  chmod 600 "$DATA/key.pem"
  msg "Next, macOS asks for your password once: it trusts SL Editor's certificate for https://localhost (this Mac, this user only)."
  security add-trusted-cert -r trustRoot -k "$HOME/Library/Keychains/login.keychain-db" "$DATA/cert.pem" >>"$LOG" 2>&1 || fail "The certificate was not trusted, so PowerPoint would not load SL Editor. Run the installer again and allow it."
fi

# the access policy (this user) and the launcher settings: activation required, keys only from the encrypted bundle
ME="$(id -un)"
"$PY" - "$PAY/access-template.json" "$DATA/access.json" "$ME" "$ROOT/app/pilot.json" "$DATA" <<'PYEOF'
import json, os, sys
tpl_path, policy, me, pilot, data = sys.argv[1:6]
try: tpl = json.load(open(tpl_path, encoding='utf-8'))
except Exception: tpl = {}
json.dump({'_comment': 'SL Editor (Mac)', 'mode': 'windows', 'allowed_users': [me], 'napkin_max_per_day': 0,
           'napkin_max_per_user_per_day': 30, 'claude_max_per_user_per_day': 30, 'template': tpl}, open(policy, 'w', encoding='utf-8'), indent=2)
json.dump({'instance': 'SLEditorMac', 'port': 44317, 'data_dir': data, 'access_path': policy, 'activation': True, 'slsd_unify': False},
          open(pilot, 'w', encoding='utf-8'), indent=2)
PYEOF

# 4. the service, now and at log-in
mkdir -p "$(dirname "$AGENT")"
cat > "$AGENT" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.simplilearn.sleditor</string>
  <key>ProgramArguments</key><array><string>$PY</string><string>$ROOT/app/run_server.pyw</string></array>
  <key>WorkingDirectory</key><string>$ROOT/app</string>
  <key>EnvironmentVariables</key><dict><key>PYTHONPATH</key><string>$ROOT/site</string></dict>
  <key>RunAtLoad</key><true/><key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>StandardOutPath</key><string>$DATA/server.log</string><key>StandardErrorPath</key><string>$DATA/server.log</string>
</dict></plist>
PLIST
launchctl load "$AGENT" >>"$LOG" 2>&1 || fail "The SL Editor service could not be started (see $LOG)."

# 5. SL Editor in PowerPoint, and the company add-ins (SL Smart Design, SL Design and SL Animation tabs)
mkdir -p "$WEF"
sed "s/__PORT__/$PORT/g" "$PAY/manifest-slsd.template.xml" > "$WEF/manifest-slsd.xml"
if [ -d "$PAY/addins" ]; then mkdir -p "$ADDINS"; cp -f "$PAY/addins/"*.ppam "$ADDINS/" 2>>"$LOG" || true; fi

for i in $(seq 1 30); do
  if curl -sk --max-time 2 -H 'X-AIVB-Client: 1' "https://localhost:$PORT/api/status" >/dev/null 2>&1; then
    msg "SL Editor is installed.

1. Start PowerPoint and open a presentation.
2. Insert > Add-ins > My Add-ins > Developer Add-ins > SL Editor (first time only). Then use Home > SL Editor.
3. Enter your activation key once.
4. For the SL Smart Design, SL Design and SL Animation tools: Tools > PowerPoint Add-ins, tick SL_Smart_Design_v2_Key_Dec_25 and SL_Audomation (first time only)."
    exit 0
  fi
  sleep 1
done
fail "The SL Editor service did not answer. Restart the Mac and try again; details are in $DATA/server.log."
