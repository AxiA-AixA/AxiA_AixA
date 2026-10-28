@echo off
rem Double-click in Explorer: starts the AxiA test server and opens it in Chrome.
rem Close this window (or press Ctrl+C) to stop the server.
cd /d "%~dp0"
set URL=http://localhost:3000
set OPEN=try { Start-Process chrome '%URL%' } catch { Start-Process '%URL%' }

if not exist node_modules call npm install
rem node_modules may come from the Mac via Google Drive; add the Windows compiler if missing.
if not exist node_modules\@next\swc-win32-x64-msvc call npm install --no-save @next/swc-win32-x64-msvc@16.2.7

rem Already running? Just open it.
curl -s -m 2 -o nul %URL%
if not errorlevel 1 (
  powershell -NoProfile -Command "%OPEN%"
  exit /b
)

echo Starting AxiA... (first start can take ~30s on Google Drive)
start "" /b powershell -NoProfile -Command "while ($true) { try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 '%URL%' | Out-Null; break } catch { Start-Sleep 1 } }; %OPEN%"
npx next dev -p 3000
