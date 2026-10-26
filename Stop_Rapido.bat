@echo off
title LockSleep - Stop Rapido
cd /d "%~dp0"
if not exist "node_modules\electron\dist\electron.exe" (
    echo Electron non trovato. Avvia Avvia_LockSleep.bat per installare le dipendenze.
    pause
    exit /b 1
)
call npm start -- --autostop
