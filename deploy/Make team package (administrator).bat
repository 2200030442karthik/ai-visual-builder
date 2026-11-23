@echo off
title AI Visual Builder - make the team package (administrator)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Make-TeamPackage.ps1"
pause
