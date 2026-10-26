@echo off
title LockSleep Desktop App
echo ========================================================
echo        LockSleep - App Desktop Monitoraggio Sonno
echo ========================================================
echo.

if not exist "node_modules\electron\dist\electron.exe" (
    where npm >nul 2>&1
    if errorlevel 1 (
        echo Node.js con npm non e' disponibile nel PATH. Installa Node.js LTS, poi riprova.
        pause
        exit /b 1
    )
    echo Installazione delle dipendenze...
    call npm install
    if errorlevel 1 (
        echo Installazione dipendenze non riuscita. Verifica npm e la connessione Internet, poi riprova.
        pause
        exit /b 1
    )
)

if not exist "node_modules\electron\dist\electron.exe" (
    echo Electron non e' stato installato correttamente. Il binario electron.exe non e' presente.
    pause
    exit /b 1
)

echo Avvio di LockSleep con Electron...
call npm start
