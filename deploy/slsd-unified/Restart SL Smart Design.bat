@echo off
title SL Smart Design - restart
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Restart.ps1" -Instance SLSmartDesign
pause
