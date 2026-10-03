@echo off
rem GoSkinly - send new plotter models (TIA Creation / Mobicare) to the website.
rem Double-click this file. Keep it in the same folder as plt-sync.ps1.
title GoSkinly model sync
echo Sending TIA Creation / Mobicare models to goskinly.com ...
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0plt-sync.ps1"
echo.
if errorlevel 1 (echo Something went wrong - see plt-sync.log in this folder.) else (echo Done. New models are waiting in Admin ^> Models ^> New models found.)
echo.
pause
