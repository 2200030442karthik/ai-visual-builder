@echo off
title AI Visual Builder (Team Pilot) - 1-Click Installer
echo ========================================================
echo   Installing AI Visual Builder for Microsoft PowerPoint
echo ========================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install.ps1"
echo.
pause
