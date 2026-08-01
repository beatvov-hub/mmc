@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Starting MMC Workline app...
node desktop-launcher.js
if errorlevel 1 (
  echo.
  echo MMC Workline could not start.
  echo Check that Node.js and Microsoft Edge are installed, and port 4310 is available.
  pause
)
