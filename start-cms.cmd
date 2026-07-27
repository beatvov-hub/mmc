@echo off
chcp 65001 >nul
cd /d "%~dp0tools\mmc-cms"
call start-cms.cmd
