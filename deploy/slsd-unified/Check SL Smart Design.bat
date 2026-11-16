@echo off
title SL Smart Design - check
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Verify.ps1" -Instance SLSmartDesign
pause
