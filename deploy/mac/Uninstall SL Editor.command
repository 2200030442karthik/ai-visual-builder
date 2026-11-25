#!/bin/bash
# SL Editor for Mac (10.26) - double-click to remove SL Editor for this Mac user.
# Removes the service, the app, the add-in registration, the company add-ins it copied and the localhost certificate.
# Your activation stays in ~/Library/Application Support/AIVisualBuilder (delete that folder to remove it too).
set -u
ROOT="$HOME/Library/Application Support/SL Editor"
DATA="$HOME/Library/Application Support/AIVisualBuilder"
WEF="$HOME/Library/Containers/com.microsoft.Powerpoint/Data/Documents/wef"
ADDINS="$HOME/Library/Group Containers/UBF8T346G9.Office/User Content.localized/Add-Ins.localized"
AGENT="$HOME/Library/LaunchAgents/com.simplilearn.sleditor.plist"
ask() { osascript -e "button returned of (display dialog \"$1\" buttons {\"Cancel\", \"$2\"} default button 2 with title \"SL Editor\")" 2>/dev/null; }

[ "$(ask "Remove SL Editor from this Mac? (Quit PowerPoint first.)" "Remove")" = "Remove" ] || exit 0
launchctl unload "$AGENT" >/dev/null 2>&1 || true
rm -f "$AGENT"
pkill -f "$ROOT/app/run_server.pyw" >/dev/null 2>&1 || true
rm -f "$WEF/manifest-slsd.xml"
rm -f "$ADDINS/SL_Smart_Design_v2_Key_Dec_25.ppam" "$ADDINS/SL_Audomation.ppam"
rm -rf "$ROOT"
if [ -f "$DATA/cert.pem" ]; then
  SHA="$(openssl x509 -in "$DATA/cert.pem" -noout -fingerprint -sha1 2>/dev/null | sed 's/.*=//; s/://g')"      # only SL Editor's certificate
  [ -n "$SHA" ] && security delete-certificate -Z "$SHA" "$HOME/Library/Keychains/login.keychain-db" >/dev/null 2>&1 || true
  rm -f "$DATA/cert.pem" "$DATA/key.pem"
fi
osascript -e 'display dialog "SL Editor was removed. Restart PowerPoint." buttons {"OK"} default button 1 with title "SL Editor"' >/dev/null 2>&1 || echo "SL Editor was removed."
