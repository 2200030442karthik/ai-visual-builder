@echo off
title AI Visual Builder V10 - remove the add-in from PowerPoint (V9 unchanged)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-v10-addin.ps1" -Remove
pause
