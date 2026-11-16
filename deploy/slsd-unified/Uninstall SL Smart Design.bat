@echo off
title SL Smart Design - uninstall
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Uninstall.ps1" -Instance SLSmartDesign
pause
