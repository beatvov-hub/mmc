@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo MMCローカルCMSを起動しています...
node server.js
if errorlevel 1 (
  echo.
  echo 起動できませんでした。Node.jsが利用できるか確認してください。
  pause
)
