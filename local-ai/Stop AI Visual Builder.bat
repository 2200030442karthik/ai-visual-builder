@echo off
title AI Visual Builder V10 - stop
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-ai-visual-builder.ps1" -Stop
pause
