@echo off
chcp 65001 >nul
cd /d "%~dp0"
if exist "%~dp0dist\MMC Workline.exe" (
  start "" "%~dp0dist\MMC Workline.exe"
  exit /b
)
call npm.cmd start
if errorlevel 1 (
  echo.
  echo MMC Workline could not start.
  echo Check that Node.js is installed and run npm.cmd install in this folder.
  pause
)
