@echo off
title SL Smart Design - AI keys (administrator)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Configure-Keys.ps1" -Instance SLSmartDesign
pause
