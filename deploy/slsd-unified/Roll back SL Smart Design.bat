@echo off
title SL Smart Design - roll back
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Rollback.ps1" -Instance SLSmartDesign
pause
