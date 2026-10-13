@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22 or newer, then open this launcher again.
  pause
  exit /b 1
)
start "SubFinder" "http://localhost:3210/"
node --env-file-if-exists=.env server.mjs
pause
