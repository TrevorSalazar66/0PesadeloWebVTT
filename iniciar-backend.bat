@echo off
chcp 65001 >nul
title Arcana VTT - Backend Gateway Local
echo ===================================================
echo   Arcana VTT - Backend Gateway Local (Porta 8787)
echo ===================================================
echo.
cd /d "%~dp0Código\Backend"
node src/local-server.js
pause
