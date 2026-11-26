#!/bin/zsh
# Double-click in Finder: starts the AxiA v2 test server and opens it in Chrome.
# Close this Terminal window (or press Ctrl+C) to stop the server.
cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
URL="http://localhost:3001"
SRC="$PWD"
# Google Drive sometimes stalls Node's file reads forever, so the server runs from a local copy.
# The code is mirrored there on every start; data/ stays here on Drive (linked).
RUN="$HOME/Library/Caches/AxiA-v2"

# AI analyser off? Open its launcher in its own Terminal window (same as the Windows .bat).
curl -s -m 2 -o /dev/null http://127.0.0.1:8770/api/ping || { chmod +x ../axia-prototype/Axia-*-Mac.command; open -a Terminal ../axia-prototype/Axia-*-Mac.command; }  # Drive sometimes drops the run permission

# Already running? Just open it.
if curl -s -m 2 -o /dev/null "$URL"; then
  open -a "Google Chrome" "$URL"
  exit 0
fi

mkdir -p "$RUN" "$SRC/data"
rsync -a --delete --exclude node_modules --exclude .next --exclude data "$SRC/" "$RUN/"
cd "$RUN"
[ -L data ] && rm data  # the build needs a plain folder (Turbopack rejects links outside the project)
mkdir -p data
[ -d node_modules ] || npm install

( until curl -s -m 2 -o /dev/null "$URL"; do sleep 1; done; open -a "Google Chrome" "$URL" ) &
# Fast mode: build once (and again only when the code changed), then serve the built site.
# Pages then open instantly instead of compiling on first visit. To edit the code live, use `npm run dev`.
if [ ! -f .next/BUILD_ID ] || [ -n "$(find app lib public package.json -newer .next/BUILD_ID 2>/dev/null | head -1)" ]; then
  echo "Preparing AxiA v2… (first time takes about a minute)"
  npx next build || { echo "Build failed. Send this window to the team."; exit 1; }
fi
rmdir data && ln -s "$SRC/data" data  # the running site reads and saves projects on Drive
echo "Starting AxiA v2…"
exec npx next start -p 3001
