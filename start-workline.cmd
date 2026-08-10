@echo off
chcp 65001 >nul
set "WORKLINE_DIR=%~dp0tools\mmc-cms"
set "WORKLINE_APP=%WORKLINE_DIR%\dist\MMC Workline.exe"
if exist "%WORKLINE_APP%" (
  start "" "%WORKLINE_APP%"
  exit /b
)
cd /d "%WORKLINE_DIR%"
call npm.cmd start
if errorlevel 1 (
  echo.
  echo MMC Workline could not start.
  echo Check that Node.js is installed and run npm.cmd install in tools\mmc-cms.
  pause
)
