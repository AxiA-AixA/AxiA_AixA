#!/bin/zsh
# Double-click in Finder: starts the AxiA test server and opens it in Chrome.
# Close this Terminal window (or press Ctrl+C) to stop the server.
cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
URL="http://localhost:3000"

[ -d node_modules ] || npm install

# Already running? Just open it.
if curl -s -m 2 -o /dev/null "$URL"; then
  open -a "Google Chrome" "$URL"
  exit 0
fi

echo "Starting AxiA… (first start can take ~30s on Google Drive)"
( until curl -s -m 2 -o /dev/null "$URL"; do sleep 1; done; open -a "Google Chrome" "$URL" ) &
exec npx next dev -p 3000
