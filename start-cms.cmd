@echo off
chcp 65001 >nul
cd /d "%~dp0tools\mmc-cms"
node server.js
if errorlevel 1 (
  echo.
  echo MMC CMS could not start.
  echo Check that Node.js is installed and port 4310 is available.
  pause
)
