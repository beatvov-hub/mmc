@echo off
chcp 65001 >nul
call "%~dp0start-workline.cmd"
if errorlevel 1 (
  echo.
  echo MMC Workline could not start.
  pause
)
