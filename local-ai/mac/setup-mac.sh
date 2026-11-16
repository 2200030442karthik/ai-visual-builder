#!/bin/bash
# SL Smart Design / AI Visual Builder (10.21) - set up on a Mac, for the current user. No administrator rights.
#   1. a certificate for https://localhost in ~/Library/Application Support/AIVisualBuilder, trusted in your login
#      keychain (macOS asks for your password once - an approved, visible step; it is never trusted silently)
#   2. the panel host (python3 server.py) started now, and at log-in through a LaunchAgent (-n: not at log-in)
#   3. the add-in manifest copied to PowerPoint's documented Mac sideload folder
#      (~/Library/Containers/com.microsoft.Powerpoint/Data/Documents/wef)
# On a Mac the SL Smart Design commands (Alternative Design, SL Templates, Miscellaneous, Shape Rename) stay in the SL
# Smart Design add-in's own tab (its VBA works on Mac); the unified tab says so. AI Visual Builder works as on Windows.
# Remove everything again: setup-mac.sh --remove
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$HOME/Library/Application Support/AIVisualBuilder"
WEF="$HOME/Library/Containers/com.microsoft.Powerpoint/Data/Documents/wef"
AGENT="$HOME/Library/LaunchAgents/com.simplilearn.slsmartdesign.plist"
PRODUCT="2f01d600-c9ec-4d94-ade9-69b8b6f0bfa7"
AUTOSTART=1
case "${1:-}" in
  -n) AUTOSTART=0 ;;
  --remove)
    launchctl unload "$AGENT" 2>/dev/null || true; rm -f "$AGENT"
    pkill -f "$HERE/server.py" 2>/dev/null || true
    rm -f "$WEF/manifest-slsd.xml"
    if [ -f "$DATA/cert.pem" ]; then security delete-certificate -c localhost "$HOME/Library/Keychains/login.keychain-db" 2>/dev/null || true; rm -f "$DATA/cert.pem" "$DATA/key.pem"; fi
    echo "Removed. Restart PowerPoint."; exit 0 ;;
esac

[ "$(uname)" = "Darwin" ] || { echo "This script is for macOS."; exit 1; }
command -v python3 >/dev/null || { echo "python3 is needed (install it from python.org or the Xcode command line tools), then run this again."; exit 1; }
mkdir -p "$DATA" "$WEF"

# 1. certificate for https://localhost (Office loads add-ins only over HTTPS)
if [ ! -f "$DATA/cert.pem" ]; then
  openssl req -x509 -newkey rsa:2048 -nodes -days 730 -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" -addext "extendedKeyUsage=serverAuth" \
    -keyout "$DATA/key.pem" -out "$DATA/cert.pem" 2>/dev/null
  chmod 600 "$DATA/key.pem"
  echo "macOS will ask for your password to trust the certificate for https://localhost (this Mac, this user only)."
  security add-trusted-cert -r trustRoot -k "$HOME/Library/Keychains/login.keychain-db" "$DATA/cert.pem"
fi

# 2. the panel host, now and (unless -n) at log-in
pkill -f "$HERE/server.py" 2>/dev/null || true
if [ "$AUTOSTART" = 1 ]; then
  mkdir -p "$(dirname "$AGENT")"
  cat > "$AGENT" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.simplilearn.slsmartdesign</string>
  <key>ProgramArguments</key><array><string>$(command -v python3)</string><string>$HERE/server.py</string></array>
  <key>WorkingDirectory</key><string>$HERE</string>
  <key>RunAtLoad</key><true/><key>KeepAlive</key><false/>
  <key>StandardOutPath</key><string>$DATA/server.log</string><key>StandardErrorPath</key><string>$DATA/server.log</string>
</dict></plist>
PLIST
  launchctl unload "$AGENT" 2>/dev/null || true
  launchctl load "$AGENT"
else
  (cd "$HERE" && nohup python3 server.py >>"$DATA/server.log" 2>&1 &)
fi

# 3. the add-in for PowerPoint on this Mac
python3 "$HERE/sl-smart-design/make_manifest_slsd.py" --id "$PRODUCT" --out "$WEF/manifest-slsd.xml" >/dev/null
for i in $(seq 1 20); do
  if curl -s --max-time 2 -H 'X-AIVB-Client: 1' https://localhost:44317/api/status >/dev/null; then
    echo "Panel host running on https://localhost:44317 (certificate trusted)."
    echo "Next: quit and start PowerPoint, then Home > Add-ins (or Insert > Add-ins > My Add-ins) > SL Smart Design."
    exit 0
  fi
  sleep 1
done
echo "The panel host did not answer; see $DATA/server.log"; exit 1
