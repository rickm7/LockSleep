@echo off
title LockSleep Desktop App
echo ========================================================
echo        LockSleep - App Desktop Monitoraggio Sonno
echo ========================================================
echo.

if not exist "node_modules\electron\dist\electron.exe" (
    echo Installazione delle dipendenze...
    call npm install
    if errorlevel 1 (
        echo Installazione non riuscita. Verifica la connessione e riprova.
        pause
        exit /b 1
    )
)

echo Avvio di LockSleep con Electron...
call npm start
