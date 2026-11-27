@echo off
rem Double-click in Explorer: starts the AxiA test server and opens it in Chrome.
rem Close this window (or press Ctrl+C) to stop the server.
cd /d "%~dp0"
set URL=http://localhost:3000
set OPEN=try { Start-Process chrome '%URL%' } catch { Start-Process '%URL%' }

where node > nul 2> nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org and run this again.
  pause
  exit /b
)

if not exist node_modules call npm install
rem node_modules may come from the Mac via Google Drive; add the Windows compiler if missing.
if not exist node_modules\@next\swc-win32-x64-msvc call npm install --no-save @next/swc-win32-x64-msvc@16.2.7

rem Start the AI analyser (axia-prototype, port 8770) in its own window if it is not running.
rem Wildcard keeps this file ASCII: the analyser launcher has Korean in its name.
curl -s -m 2 -o nul http://127.0.0.1:8770/api/ping
if errorlevel 1 for %%f in ("%~dp0..\axia-prototype\Axia-*-Windows.bat") do start "AxiA analyser" /d "%~dp0..\axia-prototype" "%%~f"

rem Already running? Just open it.
curl -s -m 2 -o nul %URL%
if not errorlevel 1 (
  powershell -NoProfile -Command "%OPEN%"
  exit /b
)

echo Starting AxiA... (first start can take ~30s on Google Drive)
start "" /b powershell -NoProfile -Command "while ($true) { try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 '%URL%' | Out-Null; break } catch { Start-Sleep 1 } }; %OPEN%"
rem Run Next directly: node_modules\.bin made on a Mac has no Windows launcher, so npx can fail.
node node_modules\next\dist\bin\next dev -p 3000
rem Keep the window open so any error stays readable.
pause
