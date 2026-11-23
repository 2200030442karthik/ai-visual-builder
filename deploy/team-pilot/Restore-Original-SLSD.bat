@echo off
title Restore Original SL Smart Design Add-in
echo ========================================================
echo   Restoring Original SL Smart Design Add-in
echo ========================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Restore-Original-SLSD.ps1"
echo.
pause
