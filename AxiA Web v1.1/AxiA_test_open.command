#!/bin/zsh
# Double-click in Finder: starts the AxiA test server and opens it in Chrome.
# Close this Terminal window (or press Ctrl+C) to stop the server.
cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
URL="http://localhost:3000"

[ -d node_modules ] || npm install

# AI analyser off? Open its launcher in its own Terminal window (same as the Windows .bat).
curl -s -m 2 -o /dev/null http://127.0.0.1:8770/api/ping || { chmod +x ../axia-prototype/Axia-*-Mac.command; open -a Terminal ../axia-prototype/Axia-*-Mac.command; }  # Drive sometimes drops the run permission

# Already running? Just open it.
if curl -s -m 2 -o /dev/null "$URL"; then
  open -a "Google Chrome" "$URL"
  exit 0
fi

echo "Starting AxiA… (first start can take ~30s on Google Drive)"
( until curl -s -m 2 -o /dev/null "$URL"; do sleep 1; done; open -a "Google Chrome" "$URL" ) &
exec npx next dev -p 3000
